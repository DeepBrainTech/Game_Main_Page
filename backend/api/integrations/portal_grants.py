"""Copy into a game backend to verify portal-issued paid grants."""

from jose import jwt


def verify_paid_grant(
    token: str,
    *,
    secret: str,
    audience: str,
    game_key: str,
    product_id: str,
    purpose: str,
    user_id: int,
    target: str,
    issuer: str = "main-portal",
    algorithm: str = "HS256",
) -> dict:
    """The expected user and target must come from the game's trusted session/state."""
    if not secret:
        raise ValueError("missing_portal_secret")
    claims = jwt.decode(
        token,
        secret,
        algorithms=[algorithm],
        audience=audience,
        issuer=issuer,
        options={"require_exp": True, "require_aud": True, "require_iss": True},
    )
    expected = {
        "game_key": game_key,
        "product_id": product_id,
        "purpose": purpose,
        "user_id": user_id,
        "target": target,
    }
    if any(claims.get(key) != value for key, value in expected.items()):
        raise ValueError("invalid_paid_grant_scope")
    if not claims.get("purchase_id"):
        raise ValueError("missing_purchase_id")
    return claims
