"""cognitive scores business logic."""

from sqlalchemy.orm import Session

from config.cognitive import DIMENSION_COLUMNS
from models import User, UserCognitiveScores
from schemas import APIResponse, CognitiveScoresBody


async def get_cognitive_scores(current_user: User, db: Session):
    """Get cognitive scores."""
    row = (
        db.query(UserCognitiveScores)
        .filter(UserCognitiveScores.user_id == current_user.id)
        .first()
    )
    if not row:
        return APIResponse(
            success=True,
            message="ok",
            data={
                "memory": 0,
                "logic": 0,
                "focus": 0,
                "reaction": 0,
                "strategy": 0,
                "spatial": 0,
            },
        )
    return APIResponse(
        success=True,
        message="ok",
        data={
            "memory": row.memory,
            "logic": row.logic,
            "focus": row.focus,
            "reaction": row.reaction,
            "strategy": row.strategy,
            "spatial": row.spatial,
        },
    )


async def update_cognitive_scores(
    body: CognitiveScoresBody, current_user: User, db: Session
):
    """Update cognitive scores."""
    row = (
        db.query(UserCognitiveScores)
        .filter(UserCognitiveScores.user_id == current_user.id)
        .first()
    )
    if not row:
        row = UserCognitiveScores(user_id=current_user.id)
        db.add(row)
        db.flush()
    for key in DIMENSION_COLUMNS:
        v = getattr(body, key, None)
        if v is not None:
            setattr(row, key, min(100, max(0, v)))
    db.commit()
    db.refresh(row)
    return APIResponse(
        success=True,
        message="ok",
        data={
            "memory": row.memory,
            "logic": row.logic,
            "focus": row.focus,
            "reaction": row.reaction,
            "strategy": row.strategy,
            "spatial": row.spatial,
        },
    )
