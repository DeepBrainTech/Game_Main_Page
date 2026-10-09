"""Exercise real asset mutations and replay without a live portal database."""

import os
import unittest
from unittest.mock import patch
from uuid import uuid4

from fastapi import HTTPException
from sqlalchemy import create_engine
from sqlalchemy.orm import Session

from config.game_auth import _jwt_settings, get_game_auth_entry_by_game_key
from jose import jwt
with patch.dict(os.environ, {"DATABASE_URL": "sqlite:///flower-test-bootstrap.db"}):
    from models import AssetTransaction, CommerceOperation, User, UserNotification, UserRewards
    from services.assets import get_asset_balances
    from services.flower_gifts import transfer_flowers, transfer_status, verify_intent, player_balances


class FlowerGiftTests(unittest.TestCase):
    def setUp(self):
        self.env = patch.dict(os.environ, {"QUANTUMGO_JWT_SECRET": "flower-test-secret",
                                           "QUANTUMGO_JWT_ALG": "HS256",
                                           "QUANTUMGO_JWT_AUD": "quantum-go",
                                           "QUANTUMGO_JWT_ISS": "main-portal"})
        self.env.start()
        self.engine = create_engine("sqlite://")
        for model in (User, UserRewards, AssetTransaction, CommerceOperation, UserNotification):
            model.__table__.create(self.engine)
        self.db = Session(self.engine)
        self.db.add_all([User(id=1, username="alice", email="alice@example.test"),
                         User(id=2, username="bob", email="bob@example.test")])
        self.db.add(UserRewards(user_id=1, coins=7, diamonds=9, flowers=10))
        self.db.commit()
        self.notifications = patch("services.assets.schedule_notification_event")
        self.notifications.start()
        self.claims = {"purpose": "flower-intent", "game_key": "quantumgo", "user_id": 1,
                       "recipient_id": 2, "sender_game_id": str(uuid4()),
                       "recipient_game_id": str(uuid4()), "room_id": str(uuid4()),
                       "request_id": str(uuid4()), "amount": 5, "heat_eligible": True}

    def tearDown(self):
        self.db.close()
        self.engine.dispose()
        self.notifications.stop()
        self.env.stop()

    def token(self, **changes):
        from time import time
        claims = {**self.claims, "aud": "quantum-go", "iss": "main-portal:flower-intent",
                  "exp": int(time()) + 60, **changes}
        return jwt.encode(claims, "flower-test-secret", algorithm="HS256")

    def test_transfer_and_replay_only_move_flowers_once(self):
        first = transfer_flowers(self.db, 1, self.token())
        repeated = transfer_flowers(self.db, 1, self.token(heat_eligible=False))
        self.assertEqual(get_asset_balances(self.db, 1), {"coins": 7, "diamonds": 9, "flowers": 5})
        self.assertEqual(get_asset_balances(self.db, 2)["flowers"], 5)
        self.assertEqual(self.db.query(AssetTransaction).count(), 2)
        self.assertEqual(self.db.query(CommerceOperation).count(), 1)
        self.assertTrue(first["heat_eligible"])
        self.assertTrue(repeated["heat_eligible"])
        self.assertEqual(first["request_id"], repeated["request_id"])

    def test_received_flowers_can_be_sent_back_repeatedly(self):
        for _ in range(3):
            self.claims["request_id"] = str(uuid4())
            transfer_flowers(self.db, 1, self.token())
            transfer_flowers(self.db, 2, self.token(user_id=2, recipient_id=1,
                                                  sender_game_id=self.claims["recipient_game_id"],
                                                  recipient_game_id=self.claims["sender_game_id"],
                                                  request_id=str(uuid4()), heat_eligible=False))
        self.assertEqual(get_asset_balances(self.db, 1)["flowers"], 10)
        self.assertEqual(get_asset_balances(self.db, 2)["flowers"], 0)
        self.assertEqual(self.db.query(AssetTransaction).count(), 12)

    def test_insufficient_balance_rolls_back_without_credit(self):
        self.db.query(UserRewards).filter_by(user_id=1).update({"flowers": 1})
        self.db.commit()
        with self.assertRaises(HTTPException) as error:
            transfer_flowers(self.db, 1, self.token())
        self.assertEqual(error.exception.detail, "insufficient_assets")
        self.assertEqual(get_asset_balances(self.db, 1)["flowers"], 1)
        self.assertEqual(get_asset_balances(self.db, 2)["flowers"], 0)
        self.assertEqual(self.db.query(AssetTransaction).count(), 0)

    def test_recipient_failure_rolls_back_sender_debit(self):
        with patch("services.flower_gifts.credit_assets", side_effect=RuntimeError("credit failure")):
            with self.assertRaises(RuntimeError):
                transfer_flowers(self.db, 1, self.token())
        self.assertEqual(get_asset_balances(self.db, 1)["flowers"], 10)
        self.assertEqual(self.db.query(AssetTransaction).count(), 0)
        self.assertEqual(self.db.query(CommerceOperation).count(), 0)

    def test_request_id_cannot_be_reused_with_other_amount(self):
        transfer_flowers(self.db, 1, self.token())
        with self.assertRaises(HTTPException) as error:
            transfer_flowers(self.db, 1, self.token(amount=10))
        self.assertEqual(error.exception.status_code, 409)
        self.assertEqual(get_asset_balances(self.db, 1)["flowers"], 5)

    def test_recovery_receipt_is_scoped_and_owned(self):
        transfer_flowers(self.db, 1, self.token())
        result = transfer_status(self.db, 1, self.claims["request_id"])
        secret, algorithm, audience, issuer, _ = _jwt_settings(get_game_auth_entry_by_game_key("quantumgo"))
        claims = jwt.decode(result["receipt_token"], secret, algorithms=[algorithm], audience=audience, issuer=issuer)
        self.assertEqual(claims["purpose"], "flower-receipt")
        self.assertEqual(claims["recipient_id"], 2)
        with self.assertRaises(HTTPException) as error:
            transfer_status(self.db, 2, self.claims["request_id"])
        self.assertEqual(error.exception.status_code, 404)

    def test_bad_intents_do_not_mutate_assets(self):
        for changes in ({"user_id": 2}, {"recipient_id": 1}, {"amount": 0}, {"amount": True},
                        {"purpose": "flower-receipt"}, {"exp": 1}, {"iss": "main-portal"},
                        {"heat_eligible": 1}, {"request_id": "bad-id"}):
            with self.subTest(changes=changes), self.assertRaises(HTTPException):
                verify_intent(self.token(**changes), 1)
        self.assertEqual(get_asset_balances(self.db, 1)["flowers"], 10)
        self.assertEqual(self.db.query(CommerceOperation).count(), 0)

    def test_scoped_player_balances_only_return_flowers(self):
        players = [{"user_id": self.claims["sender_game_id"], "portal_user_id": 1},
                   {"user_id": self.claims["recipient_game_id"], "portal_user_id": 2}]
        token = self.token(purpose="flower-balances", iss="main-portal:flower-balances", players=players)
        result = player_balances(self.db, 1, token)
        self.assertEqual(result["players"], [{"user_id": players[0]["user_id"], "flowers": 10},
                                             {"user_id": players[1]["user_id"], "flowers": 0}])
        self.assertEqual(self.db.query(AssetTransaction).count(), 0)

    def test_player_balances_reject_other_accounts_and_gift_tokens(self):
        players = [{"user_id": self.claims["sender_game_id"], "portal_user_id": 1}]
        good = self.token(purpose="flower-balances", iss="main-portal:flower-balances", players=players)
        with self.assertRaises(HTTPException):
            player_balances(self.db, 2, good)
        with self.assertRaises(HTTPException):
            player_balances(self.db, 1, self.token())
        for invalid in ([], players * 3, [{"user_id": "bad", "portal_user_id": 1}],
                        [{"user_id": self.claims["sender_game_id"], "portal_user_id": True}]):
            with self.subTest(players=invalid), self.assertRaises(HTTPException):
                player_balances(self.db, 1, self.token(purpose="flower-balances",
                    iss="main-portal:flower-balances", players=invalid))

    def test_unlinked_player_balance_is_unknown_not_zero(self):
        player = {"user_id": self.claims["recipient_game_id"], "portal_user_id": None}
        result = player_balances(self.db, 1, self.token(purpose="flower-balances",
            iss="main-portal:flower-balances", players=[player]))
        self.assertIsNone(result["players"][0]["flowers"])


if __name__ == "__main__":
    unittest.main()
