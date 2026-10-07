"""Target validators registered by individual paid game products."""

import re
from uuid import UUID


def quantum_review_target(value: str) -> str:
    if value.startswith("room:"):
        try:
            return "room:" + str(UUID(value[5:]))
        except ValueError:
            pass
    if re.fullmatch(r"local:[0-9a-f]{64}", value):
        return value
    raise ValueError("invalid_review_target")


def chessmater_replay_target(value: str) -> str:
    if re.fullmatch(r"level:[1-9][0-9]{0,5}", value):
        return value
    raise ValueError("invalid_replay_target")
