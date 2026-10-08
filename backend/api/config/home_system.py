"""Home-system cosmetic catalog and pricing."""

from __future__ import annotations

from typing import Any


HOME_SYSTEM_ITEMS: dict[str, dict[str, Any]] = {
    "head-glasses": {
        "name": "Glasses",
        "slot": "head",
        "tier": "common",
        "cost": {"coins": 150, "diamonds": 0, "flowers": 0},
    },
    "body-blue-tshirt": {
        "name": "Blue T-Shirt",
        "slot": "body",
        "tier": "common",
        "cost": {"coins": 250, "diamonds": 0, "flowers": 0},
    },
    "body-sweater": {
        "name": "Sweater",
        "slot": "body",
        "tier": "common",
        "cost": {"coins": 250, "diamonds": 0, "flowers": 0},
    },
    "head-paper-hat": {
        "name": "Paper Hat",
        "slot": "head",
        "tier": "common",
        "cost": {"coins": 150, "diamonds": 0, "flowers": 0},
    },
    "head-headphones": {
        "name": "Headphones",
        "slot": "head",
        "tier": "rare",
        "cost": {"coins": 350, "diamonds": 0, "flowers": 0},
    },
    "body-speaker": {
        "name": "Speaker",
        "slot": "hand",
        "tier": "rare",
        "cost": {"coins": 550, "diamonds": 0, "flowers": 0},
    },
    "head-astronaut-helmet": {
        "name": "Astronaut Helmet",
        "slot": "head",
        "tier": "rare",
        "cost": {"coins": 350, "diamonds": 0, "flowers": 0},
    },
    "body-wizard-cloak": {
        "name": "Wizard Cloak",
        "slot": "body",
        "tier": "premium",
        "cost": {"coins": 0, "diamonds": 25, "flowers": 0},
    },
    "head-wizard-hat": {
        "name": "Wizard Hat",
        "slot": "head",
        "tier": "premium",
        "cost": {"coins": 0, "diamonds": 15, "flowers": 0},
    },
    "body-wizard-wand": {
        "name": "Wizard Wand",
        "slot": "hand",
        "tier": "premium",
        "cost": {"coins": 0, "diamonds": 25, "flowers": 0},
    },
    "body-pirate-sword": {
        "name": "Pirate Sword",
        "slot": "hand",
        "tier": "premium",
        "cost": {"coins": 0, "diamonds": 25, "flowers": 0},
    },
    "body-thanksgiving-handpiece": {
        "name": "Thanksgiving Handpiece",
        "slot": "hand",
        "tier": "limited",
        "cost": {"coins": 0, "diamonds": 35, "flowers": 0},
    },
    "body-fireworks-handpiece": {
        "name": "Fireworks Handpiece",
        "slot": "hand",
        "tier": "limited",
        "cost": {"coins": 0, "diamonds": 35, "flowers": 0},
    },
    "body-pirate-costume": {
        "name": "Pirate Costume",
        "slot": "body",
        "tier": "premium",
        "cost": {"coins": 0, "diamonds": 25, "flowers": 0},
    },
    "head-pirate-bandana": {
        "name": "Pirate Bandana",
        "slot": "head",
        "tier": "premium",
        "cost": {"coins": 0, "diamonds": 15, "flowers": 0},
    },
    "body-thanksgiving-outfit": {
        "name": "Thanksgiving Outfit",
        "slot": "body",
        "tier": "limited",
        "cost": {"coins": 0, "diamonds": 35, "flowers": 0},
    },
    "head-thanksgiving-headpiece": {
        "name": "Thanksgiving Headpiece",
        "slot": "head",
        "tier": "limited",
        "cost": {"coins": 0, "diamonds": 25, "flowers": 0},
    },
    "body-fireworks-outfit": {
        "name": "Fireworks Outfit",
        "slot": "body",
        "tier": "limited",
        "cost": {"coins": 0, "diamonds": 35, "flowers": 0},
    },
    "head-fireworks-headpiece": {
        "name": "Fireworks Headpiece",
        "slot": "head",
        "tier": "limited",
        "cost": {"coins": 0, "diamonds": 25, "flowers": 0},
    },
    "background-fireworks": {
        "name": "Fireworks Background",
        "slot": "background",
        "tier": "common",
        "cost": {"coins": 300, "diamonds": 0, "flowers": 0},
    },
    "background-cloudy": {
        "name": "Cloudy Background",
        "slot": "background",
        "tier": "rare",
        "cost": {"coins": 700, "diamonds": 0, "flowers": 0},
    },
    "background-beach": {
        "name": "Beach",
        "slot": "background",
        "tier": "premium",
        "cost": {"coins": 0, "diamonds": 30, "flowers": 0},
    },
    "background-green-free": {
        "name": "Green Background",
        "slot": "background",
        "tier": "free",
        "is_free": True,
        "cost": {"coins": 0, "diamonds": 0, "flowers": 0},
    },
    "background-red-free": {
        "name": "Red Background",
        "slot": "background",
        "tier": "free",
        "is_free": True,
        "cost": {"coins": 0, "diamonds": 0, "flowers": 0},
    },
    "background-blue-free": {
        "name": "Blue Background",
        "slot": "background",
        "tier": "free",
        "is_free": True,
        "cost": {"coins": 0, "diamonds": 0, "flowers": 0},
    },
    "limited-jindouyun-monkey": {
        "name": "Jindouyun Monkey",
        "slot": "limited",
        "tier": "limited",
        "cost": {"coins": 0, "diamonds": 45, "flowers": 0},
    },
}

HOME_SYSTEM_HAND_ITEM_IDS = tuple(
    item_id for item_id, item in HOME_SYSTEM_ITEMS.items() if item["slot"] == "hand"
)


def get_home_system_item(item_id: str) -> dict[str, Any] | None:
    return HOME_SYSTEM_ITEMS.get(item_id)


def is_free_home_system_item(item: dict[str, Any]) -> bool:
    return bool(item.get("is_free"))
