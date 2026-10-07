"""assessments business logic."""

from fastapi import HTTPException, status
from sqlalchemy import and_, func, or_
from sqlalchemy.orm import Session

from models import (
    User,
    UserAssessmentAnswer,
    UserAssessmentSession,
    UserAssessmentTopicStat,
)
from schemas import APIResponse, AssessmentSessionCreate


def _serialize_assessment_session(
    db: Session,
    session: UserAssessmentSession,
    include_answers: bool = False,
) -> dict:
    attempt_number = (
        db.query(func.count(UserAssessmentSession.id))
        .filter(
            UserAssessmentSession.user_id == session.user_id,
            UserAssessmentSession.subject == session.subject,
            or_(
                UserAssessmentSession.finished_at < session.finished_at,
                and_(
                    UserAssessmentSession.finished_at == session.finished_at,
                    UserAssessmentSession.id <= session.id,
                ),
            ),
        )
        .scalar()
    ) or 1
    topic_rows = (
        db.query(UserAssessmentTopicStat)
        .filter(UserAssessmentTopicStat.session_id == session.id)
        .order_by(UserAssessmentTopicStat.topic_key.asc())
        .all()
    )
    data = {
        "id": session.id,
        "subject": session.subject,
        "started_at": session.started_at.isoformat(),
        "finished_at": session.finished_at.isoformat(),
        "duration_seconds": session.duration_seconds,
        "total_questions": session.total_questions,
        "correct_count": session.correct_count,
        "accuracy": session.accuracy,
        "attempt_number": int(attempt_number),
        "strongest_area": session.strongest_area,
        "weakest_area": session.weakest_area,
        "topic_stats": [
            {
                "topic_key": row.topic_key,
                "total": row.total,
                "correct": row.correct,
                "accuracy": row.accuracy,
            }
            for row in topic_rows
        ],
    }
    if include_answers:
        answer_rows = (
            db.query(UserAssessmentAnswer)
            .filter(UserAssessmentAnswer.session_id == session.id)
            .order_by(UserAssessmentAnswer.id.asc())
            .all()
        )
        data["answers"] = [
            {
                "topic_key": row.topic_key,
                "question_text": row.question_text,
                "user_answer": row.user_answer,
                "correct_answer": row.correct_answer,
                "is_correct": row.is_correct,
                "is_timeout": row.is_timeout,
                "time_spent_ms": row.time_spent_ms,
            }
            for row in answer_rows
        ]
    return data


def _build_topic_delta(
    base_topic_stats: list[dict], target_topic_stats: list[dict]
) -> list[dict]:
    base_map = {row["topic_key"]: row for row in base_topic_stats}
    target_map = {row["topic_key"]: row for row in target_topic_stats}
    all_keys = sorted(set(base_map.keys()) | set(target_map.keys()))
    result = []
    for key in all_keys:
        base_accuracy = int(base_map.get(key, {}).get("accuracy", 0))
        target_accuracy = int(target_map.get(key, {}).get("accuracy", 0))
        result.append(
            {
                "topic_key": key,
                "base_accuracy": base_accuracy,
                "target_accuracy": target_accuracy,
                "delta_accuracy": target_accuracy - base_accuracy,
            }
        )
    return result


async def create_assessment_session(
    body: AssessmentSessionCreate, current_user: User, db: Session
):
    session = UserAssessmentSession(
        user_id=current_user.id,
        subject=body.subject,
        started_at=body.started_at,
        finished_at=body.finished_at,
        duration_seconds=body.duration_seconds,
        total_questions=body.total_questions,
        correct_count=body.correct_count,
        accuracy=body.accuracy,
        strongest_area=body.strongest_area,
        weakest_area=body.weakest_area,
    )
    db.add(session)
    db.flush()

    for row in body.topic_stats:
        db.add(
            UserAssessmentTopicStat(
                session_id=session.id,
                topic_key=row.topic_key,
                total=row.total,
                correct=row.correct,
                accuracy=row.accuracy,
            )
        )

    for row in body.answers:
        db.add(
            UserAssessmentAnswer(
                session_id=session.id,
                topic_key=row.topic_key,
                question_text=row.question_text,
                user_answer=row.user_answer,
                correct_answer=row.correct_answer,
                is_correct=row.is_correct,
                is_timeout=row.is_timeout,
                time_spent_ms=row.time_spent_ms,
            )
        )

    db.commit()
    db.refresh(session)

    return APIResponse(
        success=True,
        message="ok",
        data={"session_id": session.id},
    )


async def list_assessment_sessions(
    subject: str, limit: int, offset: int, current_user: User, db: Session
):
    rows = (
        db.query(UserAssessmentSession)
        .filter(
            UserAssessmentSession.user_id == current_user.id,
            UserAssessmentSession.subject == subject,
        )
        .order_by(UserAssessmentSession.finished_at.desc())
        .offset(offset)
        .limit(limit)
        .all()
    )
    total = (
        db.query(func.count(UserAssessmentSession.id))
        .filter(
            UserAssessmentSession.user_id == current_user.id,
            UserAssessmentSession.subject == subject,
        )
        .scalar()
    ) or 0

    return APIResponse(
        success=True,
        message="ok",
        data={
            "total": int(total),
            "list": [
                _serialize_assessment_session(db, row, include_answers=False)
                for row in rows
            ],
        },
    )


async def get_assessment_session_detail(
    session_id: int, current_user: User, db: Session
):
    row = (
        db.query(UserAssessmentSession)
        .filter(
            UserAssessmentSession.id == session_id,
            UserAssessmentSession.user_id == current_user.id,
        )
        .first()
    )
    if row is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="assessment_not_found"
        )
    return APIResponse(
        success=True,
        message="ok",
        data=_serialize_assessment_session(db, row, include_answers=True),
    )


async def compare_assessment_sessions(
    session_id: int, target_session_id: int | None, current_user: User, db: Session
):
    base_row = (
        db.query(UserAssessmentSession)
        .filter(
            UserAssessmentSession.id == session_id,
            UserAssessmentSession.user_id == current_user.id,
        )
        .first()
    )
    if base_row is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="assessment_not_found"
        )

    if target_session_id is not None:
        target_row = (
            db.query(UserAssessmentSession)
            .filter(
                UserAssessmentSession.id == target_session_id,
                UserAssessmentSession.user_id == current_user.id,
                UserAssessmentSession.subject == base_row.subject,
            )
            .first()
        )
    else:
        target_row = (
            db.query(UserAssessmentSession)
            .filter(
                UserAssessmentSession.user_id == current_user.id,
                UserAssessmentSession.subject == base_row.subject,
                UserAssessmentSession.finished_at < base_row.finished_at,
            )
            .order_by(UserAssessmentSession.finished_at.desc())
            .first()
        )

    if target_row is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="compare_target_not_found"
        )

    base_data = _serialize_assessment_session(db, base_row, include_answers=False)
    target_data = _serialize_assessment_session(db, target_row, include_answers=False)
    return APIResponse(
        success=True,
        message="ok",
        data={
            "base_session_id": base_row.id,
            "target_session_id": target_row.id,
            "accuracy_delta": int(target_row.accuracy - base_row.accuracy),
            "duration_seconds_delta": int(
                target_row.duration_seconds - base_row.duration_seconds
            ),
            "correct_count_delta": int(
                target_row.correct_count - base_row.correct_count
            ),
            "topic_deltas": _build_topic_delta(
                base_data["topic_stats"], target_data["topic_stats"]
            ),
            "base": base_data,
            "target": target_data,
        },
    )


async def get_assessment_trend(
    subject: str, limit: int, current_user: User, db: Session
):
    rows = (
        db.query(UserAssessmentSession)
        .filter(
            UserAssessmentSession.user_id == current_user.id,
            UserAssessmentSession.subject == subject,
        )
        .order_by(UserAssessmentSession.finished_at.desc())
        .limit(limit)
        .all()
    )
    rows = list(reversed(rows))
    return APIResponse(
        success=True,
        message="ok",
        data={
            "points": [
                {
                    "session_id": row.id,
                    "finished_at": row.finished_at.isoformat(),
                    "accuracy": row.accuracy,
                    "duration_seconds": row.duration_seconds,
                }
                for row in rows
            ]
        },
    )

