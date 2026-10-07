"""leaderboard business logic."""

from sqlalchemy import desc, text
from sqlalchemy.orm import Session

from config.cognitive import DIMENSION_COLUMNS
from models import User, UserCognitiveScores
from schemas import APIResponse
from services.avatars import avatar_url


async def get_leaderboard(type: str, limit: int, current_user: User, db: Session):
    """Get leaderboard."""
    if type == "total":
        subq = db.query(
            UserCognitiveScores.user_id,
            UserCognitiveScores.previous_total_rank,
            UserCognitiveScores.memory,
            UserCognitiveScores.logic,
            UserCognitiveScores.focus,
            UserCognitiveScores.reaction,
            UserCognitiveScores.strategy,
            UserCognitiveScores.spatial,
            (
                (
                    UserCognitiveScores.memory
                    + UserCognitiveScores.logic
                    + UserCognitiveScores.focus
                    + UserCognitiveScores.reaction
                    + UserCognitiveScores.strategy
                    + UserCognitiveScores.spatial
                )
                / 6
            ).label("score"),
        ).subquery()
        rows = (
            db.query(
                User.id,
                User.username,
                User.country,
                subq.c.score,
                subq.c.previous_total_rank,
                User.avatar_object_key,
                User.google_avatar_url,
                subq.c.memory,
                subq.c.logic,
                subq.c.focus,
                subq.c.reaction,
                subq.c.strategy,
                subq.c.spatial,
            )
            .join(subq, User.id == subq.c.user_id)
            .order_by(desc(subq.c.score))
            .limit(limit)
            .all()
        )
    elif type in DIMENSION_COLUMNS:
        col = getattr(UserCognitiveScores, type)
        rows = (
            db.query(
                User.id,
                User.username,
                User.country,
                col,
                UserCognitiveScores.previous_total_rank,
                User.avatar_object_key,
                User.google_avatar_url,
            )
            .join(UserCognitiveScores, User.id == UserCognitiveScores.user_id)
            .order_by(desc(col))
            .limit(limit)
            .all()
        )
    else:
        return APIResponse(success=False, message="invalid type", data=None)

    result = []
    for i, r in enumerate(rows):
        current_rank = i + 1
        country = r[2]
        score = round(r[3]) if r[3] is not None else 0
        previous_rank = r[4]
        avatar_object_key = r[5]
        google_avatar_url = r[6]

        resolved_avatar_url = avatar_url(avatar_object_key, google_avatar_url)

        if previous_rank is None or previous_rank == current_rank:
            trend = "stable"
        elif previous_rank > current_rank:
            trend = "up"
        else:
            trend = "down"

        result.append(
            {
                "rank": current_rank,
                "user_id": r[0],
                "username": r[1],
                "country": country,
                "score": score,
                "trend": trend,
                "avatar_url": resolved_avatar_url,
                "memory": round(r[7]) if len(r) > 7 and r[7] is not None else None,
                "logic": round(r[8]) if len(r) > 8 and r[8] is not None else None,
                "focus": round(r[9]) if len(r) > 9 and r[9] is not None else None,
                "reaction": round(r[10]) if len(r) > 10 and r[10] is not None else None,
                "strategy": round(r[11]) if len(r) > 11 and r[11] is not None else None,
                "spatial": round(r[12]) if len(r) > 12 and r[12] is not None else None,
            }
        )

    return APIResponse(success=True, message="ok", data={"list": result})


async def snapshot_global_ranks(secret: str, db: Session):
    """Snapshot global ranks."""
    import os

    expected_secret = os.getenv("ADMIN_SECRET", "deepbrain2026")
    if secret != expected_secret:
        return APIResponse(success=False, message="unauthorized", data=None)

    sql = text("""
        WITH current_ranks AS (
            SELECT 
                user_id,
                RANK() OVER (
                    ORDER BY (memory + logic + focus + reaction + strategy + spatial) DESC
                ) as rank
            FROM user_cognitive_scores
        )
        UPDATE user_cognitive_scores
        SET previous_total_rank = current_ranks.rank
        FROM current_ranks
        WHERE user_cognitive_scores.user_id = current_ranks.user_id;
    """)
    try:
        db.execute(sql)
        db.commit()
        return APIResponse(
            success=True, message="Ranks snapshot updated successfully", data=None
        )
    except Exception as e:
        db.rollback()
        return APIResponse(success=False, message=str(e), data=None)
