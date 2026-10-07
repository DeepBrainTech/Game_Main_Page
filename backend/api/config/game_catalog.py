"""Portal game catalog, including games without a token endpoint."""

from config.game_auth import GAME_AUTH_ENTRIES

SUPPORTED_GAME_KEYS = {
    "sudoku",
    "intercontinental-chess",
    "mathchess",
    "chessmater",
    "quantumgo",
    "fogchess",
    "chess-tourmaster",
    "online-chess",
    "dash-dot-simulator",
    "stack_math_chess",
    "recon_chess",
    "number-blast",
    "soccer_chess",
    "no-king-chess",
} | {entry.game_key for entry in GAME_AUTH_ENTRIES}

REWARD_STATUS_GAME_KEYS = (
    "fogchess",
    "sudoku",
    "quantumgo",
    "chessmater",
    "chess-tourmaster",
)
