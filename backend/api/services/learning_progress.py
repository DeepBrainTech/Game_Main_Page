"""learning progress business logic."""

from datetime import datetime

from fastapi import HTTPException, status
from sqlalchemy import func
from sqlalchemy.orm import Session

from config.learning_media import get_making_whole_question_video_key
from models import (
    User,
    UserLearningPracticeReport,
    UserLearningPracticeReportAnswer,
    UserLearningQuestionProgress,
    UserLearningStudyTime,
    UserLearningTopicProgress,
)
from schemas import (
    APIResponse,
    LearningPracticeReportUpsert,
    LearningQuestionAttemptCreate,
    LearningStudyTimeCreate,
    LearningTopicProgressReset,
)
from utils.r2_storage import generate_object_read_url


def _to_progress_percent(numerator: int, denominator: int) -> int:
    if denominator <= 0:
        return 0
    return max(0, min(100, round((numerator / denominator) * 100)))


def _build_topic_progress_payload(
    topic_row: UserLearningTopicProgress,
    question_rows: list[UserLearningQuestionProgress],
    has_practice_report: bool = False,
) -> dict:
    total_questions = int(topic_row.total_questions or 0)
    attempted_unique_questions = int(topic_row.attempted_unique_questions or 0)
    correct_unique_questions = int(topic_row.correct_unique_questions or 0)
    progress_percent_attempted = int(topic_row.progress_percent_attempted or 0)
    progress_percent_correct = int(topic_row.progress_percent_correct or 0)
    return {
        "subject_key": topic_row.subject_key,
        "module_key": topic_row.module_key,
        "topic_key": topic_row.topic_key,
        "total_questions": total_questions,
        "attempted_unique_questions": attempted_unique_questions,
        "correct_unique_questions": correct_unique_questions,
        "progress_percent_attempted": progress_percent_attempted,
        "progress_percent_correct": progress_percent_correct,
        "last_attempted_question_key": topic_row.last_attempted_question_key,
        "last_attempted_at": topic_row.last_attempted_at.isoformat()
        if topic_row.last_attempted_at
        else None,
        "attempted_question_keys": [row.question_key for row in question_rows],
        "has_practice_report": has_practice_report,
        "question_attempts": [
            {
                "question_key": row.question_key,
                "user_answer": row.user_answer,
                "is_correct": bool(row.is_correct_latest),
                "time_spent_seconds": int(row.time_spent_seconds or 0),
            }
            for row in question_rows
        ],
    }


def _topic_has_practice_report(
    db: Session,
    user_id: int,
    subject_key: str,
    module_key: str,
    topic_key: str,
) -> bool:
    return (
        db.query(UserLearningPracticeReport.id)
        .filter(
            UserLearningPracticeReport.user_id == user_id,
            UserLearningPracticeReport.subject_key == subject_key,
            UserLearningPracticeReport.module_key == module_key,
            UserLearningPracticeReport.topic_key == topic_key,
        )
        .first()
        is not None
    )


def _build_practice_report_payload(
    report_row: UserLearningPracticeReport,
    answer_rows: list[UserLearningPracticeReportAnswer],
) -> dict:
    return {
        "id": int(report_row.id),
        "subject_key": report_row.subject_key,
        "module_key": report_row.module_key,
        "topic_key": report_row.topic_key,
        "accuracy": int(report_row.accuracy or 0),
        "correct_count": int(report_row.correct_count or 0),
        "total_questions": int(report_row.total_questions or 0),
        "duration_seconds": int(report_row.duration_seconds or 0),
        "attempt_number": int(report_row.attempt_number or 1),
        "finished_at": report_row.finished_at.isoformat()
        if report_row.finished_at
        else None,
        "answers": [
            {
                "topic_key": row.topic_key,
                "question_text": row.question_text,
                "user_answer": row.user_answer,
                "correct_answer": row.correct_answer,
                "is_correct": bool(row.is_correct),
                "is_timeout": bool(row.is_timeout),
                "time_spent_ms": int(row.time_spent_ms or 0),
            }
            for row in answer_rows
        ],
    }


def _build_practice_report_summary(report_row: UserLearningPracticeReport) -> dict:
    return {
        "id": int(report_row.id),
        "subject_key": report_row.subject_key,
        "module_key": report_row.module_key,
        "topic_key": report_row.topic_key,
        "accuracy": int(report_row.accuracy or 0),
        "correct_count": int(report_row.correct_count or 0),
        "total_questions": int(report_row.total_questions or 0),
        "duration_seconds": int(report_row.duration_seconds or 0),
        "attempt_number": int(report_row.attempt_number or 1),
        "finished_at": report_row.finished_at.isoformat()
        if report_row.finished_at
        else None,
    }


def _practice_report_scope_filter(
    query,
    user_id: int,
    subject_key: str,
    module_key: str,
    topic_key: str,
):
    return query.filter(
        UserLearningPracticeReport.user_id == user_id,
        UserLearningPracticeReport.subject_key == subject_key,
        UserLearningPracticeReport.module_key == module_key,
        UserLearningPracticeReport.topic_key == topic_key,
    )


async def record_learning_question_attempt(
    body: LearningQuestionAttemptCreate, current_user: User, db: Session
):
    now = datetime.utcnow()
    question_row = (
        db.query(UserLearningQuestionProgress)
        .filter(
            UserLearningQuestionProgress.user_id == current_user.id,
            UserLearningQuestionProgress.subject_key == body.subject_key,
            UserLearningQuestionProgress.module_key == body.module_key,
            UserLearningQuestionProgress.topic_key == body.topic_key,
            UserLearningQuestionProgress.question_key == body.question_key,
        )
        .first()
    )
    is_new_question = question_row is None
    was_correct_ever = (
        bool(question_row.is_correct_ever) if question_row is not None else False
    )
    if question_row is None:
        question_row = UserLearningQuestionProgress(
            user_id=current_user.id,
            subject_key=body.subject_key,
            module_key=body.module_key,
            topic_key=body.topic_key,
            question_key=body.question_key,
            attempt_count=1,
            is_correct_latest=body.is_correct,
            is_correct_ever=body.is_correct,
            user_answer=body.user_answer,
            time_spent_seconds=int(body.time_spent_seconds or 0),
            first_attempted_at=now,
            last_attempted_at=now,
        )
        db.add(question_row)
    else:
        question_row.attempt_count = int(question_row.attempt_count or 0) + 1
        question_row.is_correct_latest = body.is_correct
        question_row.is_correct_ever = was_correct_ever or body.is_correct
        if body.user_answer is not None:
            question_row.user_answer = body.user_answer
        question_row.time_spent_seconds = int(body.time_spent_seconds or 0)
        question_row.last_attempted_at = now
        db.add(question_row)

    topic_row = (
        db.query(UserLearningTopicProgress)
        .filter(
            UserLearningTopicProgress.user_id == current_user.id,
            UserLearningTopicProgress.subject_key == body.subject_key,
            UserLearningTopicProgress.module_key == body.module_key,
            UserLearningTopicProgress.topic_key == body.topic_key,
        )
        .first()
    )
    if topic_row is None:
        topic_row = UserLearningTopicProgress(
            user_id=current_user.id,
            subject_key=body.subject_key,
            module_key=body.module_key,
            topic_key=body.topic_key,
        )
        db.add(topic_row)
    topic_row.total_questions = int(topic_row.total_questions or 0)
    topic_row.attempted_unique_questions = int(
        topic_row.attempted_unique_questions or 0
    )
    topic_row.correct_unique_questions = int(topic_row.correct_unique_questions or 0)
    topic_row.progress_percent_attempted = int(
        topic_row.progress_percent_attempted or 0
    )
    topic_row.progress_percent_correct = int(topic_row.progress_percent_correct or 0)

    if body.total_questions > 0:
        topic_row.total_questions = body.total_questions
    elif topic_row.total_questions <= 0:
        topic_row.total_questions = 0

    if is_new_question:
        topic_row.attempted_unique_questions += 1
    if body.is_correct and (is_new_question or not was_correct_ever):
        topic_row.correct_unique_questions += 1

    topic_row.progress_percent_attempted = _to_progress_percent(
        topic_row.attempted_unique_questions, topic_row.total_questions
    )
    topic_row.progress_percent_correct = _to_progress_percent(
        topic_row.correct_unique_questions, topic_row.total_questions
    )
    topic_row.last_attempted_question_key = body.question_key
    topic_row.last_attempted_at = now
    db.add(topic_row)
    db.commit()
    db.refresh(topic_row)
    topic_question_rows = (
        db.query(UserLearningQuestionProgress)
        .filter(
            UserLearningQuestionProgress.user_id == current_user.id,
            UserLearningQuestionProgress.subject_key == body.subject_key,
            UserLearningQuestionProgress.module_key == body.module_key,
            UserLearningQuestionProgress.topic_key == body.topic_key,
        )
        .order_by(UserLearningQuestionProgress.question_key.asc())
        .all()
    )

    return APIResponse(
        success=True,
        message="ok",
        data=_build_topic_progress_payload(
            topic_row,
            topic_question_rows,
            _topic_has_practice_report(
                db,
                current_user.id,
                body.subject_key,
                body.module_key,
                body.topic_key,
            ),
        ),
    )


async def reset_learning_topic_progress(
    body: LearningTopicProgressReset, current_user: User, db: Session
):
    db.query(UserLearningQuestionProgress).filter(
        UserLearningQuestionProgress.user_id == current_user.id,
        UserLearningQuestionProgress.subject_key == body.subject_key,
        UserLearningQuestionProgress.module_key == body.module_key,
        UserLearningQuestionProgress.topic_key == body.topic_key,
    ).delete(synchronize_session=False)

    topic_row = (
        db.query(UserLearningTopicProgress)
        .filter(
            UserLearningTopicProgress.user_id == current_user.id,
            UserLearningTopicProgress.subject_key == body.subject_key,
            UserLearningTopicProgress.module_key == body.module_key,
            UserLearningTopicProgress.topic_key == body.topic_key,
        )
        .first()
    )
    if topic_row is None:
        topic_row = UserLearningTopicProgress(
            user_id=current_user.id,
            subject_key=body.subject_key,
            module_key=body.module_key,
            topic_key=body.topic_key,
        )
        db.add(topic_row)

    topic_row.total_questions = (
        body.total_questions
        if body.total_questions > 0
        else int(topic_row.total_questions or 0)
    )
    topic_row.attempted_unique_questions = 0
    topic_row.correct_unique_questions = 0
    topic_row.progress_percent_attempted = 0
    topic_row.progress_percent_correct = 0
    topic_row.last_attempted_question_key = None
    topic_row.last_attempted_at = None
    db.add(topic_row)
    db.commit()
    db.refresh(topic_row)

    return APIResponse(
        success=True,
        message="ok",
        data=_build_topic_progress_payload(
            topic_row,
            [],
            _topic_has_practice_report(
                db,
                current_user.id,
                body.subject_key,
                body.module_key,
                body.topic_key,
            ),
        ),
    )


async def get_learning_module_progress(
    subject_key: str, module_key: str, current_user: User, db: Session
):
    topic_rows = (
        db.query(UserLearningTopicProgress)
        .filter(
            UserLearningTopicProgress.user_id == current_user.id,
            UserLearningTopicProgress.subject_key == subject_key,
            UserLearningTopicProgress.module_key == module_key,
        )
        .order_by(UserLearningTopicProgress.topic_key.asc())
        .all()
    )

    question_rows = (
        db.query(UserLearningQuestionProgress)
        .filter(
            UserLearningQuestionProgress.user_id == current_user.id,
            UserLearningQuestionProgress.subject_key == subject_key,
            UserLearningQuestionProgress.module_key == module_key,
        )
        .order_by(
            UserLearningQuestionProgress.topic_key.asc(),
            UserLearningQuestionProgress.question_key.asc(),
        )
        .all()
    )
    questions_by_topic: dict[str, list[UserLearningQuestionProgress]] = {}
    for row in question_rows:
        questions_by_topic.setdefault(row.topic_key, []).append(row)

    report_topic_keys = {
        row.topic_key
        for row in db.query(UserLearningPracticeReport.topic_key)
        .filter(
            UserLearningPracticeReport.user_id == current_user.id,
            UserLearningPracticeReport.subject_key == subject_key,
            UserLearningPracticeReport.module_key == module_key,
        )
        .all()
    }

    return APIResponse(
        success=True,
        message="ok",
        data={
            "subject_key": subject_key,
            "module_key": module_key,
            "practice_report_topic_keys": sorted(report_topic_keys),
            "topics": [
                _build_topic_progress_payload(
                    row,
                    questions_by_topic.get(row.topic_key, []),
                    row.topic_key in report_topic_keys,
                )
                for row in topic_rows
            ],
        },
    )


async def upsert_learning_practice_report(
    body: LearningPracticeReportUpsert, current_user: User, db: Session
):
    now = datetime.utcnow()
    scope_query = _practice_report_scope_filter(
        db.query(UserLearningPracticeReport),
        current_user.id,
        body.subject_key,
        body.module_key,
        body.topic_key,
    )
    last_attempt_number = (
        scope_query.with_entities(
            func.max(UserLearningPracticeReport.attempt_number)
        ).scalar()
        or 0
    )
    attempt_number = max(int(body.attempt_number or 1), int(last_attempt_number) + 1)

    report_row = UserLearningPracticeReport(
        user_id=current_user.id,
        subject_key=body.subject_key,
        module_key=body.module_key,
        topic_key=body.topic_key,
        accuracy=int(body.accuracy or 0),
        correct_count=int(body.correct_count or 0),
        total_questions=int(body.total_questions or 0),
        duration_seconds=int(body.duration_seconds or 0),
        attempt_number=attempt_number,
        finished_at=now,
    )
    db.add(report_row)
    db.flush()

    for index, answer in enumerate(body.answers):
        db.add(
            UserLearningPracticeReportAnswer(
                report_id=report_row.id,
                topic_key=answer.topic_key,
                question_text=answer.question_text,
                user_answer=answer.user_answer,
                correct_answer=answer.correct_answer,
                is_correct=answer.is_correct,
                is_timeout=answer.is_timeout,
                time_spent_ms=int(answer.time_spent_ms or 0),
                sort_order=index,
            )
        )

    db.commit()
    db.refresh(report_row)
    answer_rows = (
        db.query(UserLearningPracticeReportAnswer)
        .filter(UserLearningPracticeReportAnswer.report_id == report_row.id)
        .order_by(
            UserLearningPracticeReportAnswer.sort_order.asc(),
            UserLearningPracticeReportAnswer.id.asc(),
        )
        .all()
    )
    return APIResponse(
        success=True,
        message="ok",
        data=_build_practice_report_payload(report_row, answer_rows),
    )


async def list_learning_practice_report_history(
    subject_key: str,
    module_key: str,
    topic_key: str,
    limit: int,
    offset: int,
    current_user: User,
    db: Session,
):
    scope_query = _practice_report_scope_filter(
        db.query(UserLearningPracticeReport),
        current_user.id,
        subject_key,
        module_key,
        topic_key,
    )
    total = scope_query.count()
    rows = (
        scope_query.order_by(
            UserLearningPracticeReport.finished_at.desc(),
            UserLearningPracticeReport.id.desc(),
        )
        .offset(offset)
        .limit(limit)
        .all()
    )
    return APIResponse(
        success=True,
        message="ok",
        data={
            "total": total,
            "list": [_build_practice_report_summary(row) for row in rows],
        },
    )


async def get_learning_practice_report_by_id(
    report_id: int, current_user: User, db: Session
):
    report_row = (
        db.query(UserLearningPracticeReport)
        .filter(
            UserLearningPracticeReport.id == report_id,
            UserLearningPracticeReport.user_id == current_user.id,
        )
        .first()
    )
    if report_row is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="practice_report_not_found"
        )

    answer_rows = (
        db.query(UserLearningPracticeReportAnswer)
        .filter(UserLearningPracticeReportAnswer.report_id == report_row.id)
        .order_by(
            UserLearningPracticeReportAnswer.sort_order.asc(),
            UserLearningPracticeReportAnswer.id.asc(),
        )
        .all()
    )
    return APIResponse(
        success=True,
        message="ok",
        data=_build_practice_report_payload(report_row, answer_rows),
    )


async def get_learning_practice_report(
    subject_key: str, module_key: str, topic_key: str, current_user: User, db: Session
):
    report_row = (
        _practice_report_scope_filter(
            db.query(UserLearningPracticeReport),
            current_user.id,
            subject_key,
            module_key,
            topic_key,
        )
        .order_by(
            UserLearningPracticeReport.finished_at.desc(),
            UserLearningPracticeReport.id.desc(),
        )
        .first()
    )
    if report_row is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="practice_report_not_found"
        )

    answer_rows = (
        db.query(UserLearningPracticeReportAnswer)
        .filter(UserLearningPracticeReportAnswer.report_id == report_row.id)
        .order_by(
            UserLearningPracticeReportAnswer.sort_order.asc(),
            UserLearningPracticeReportAnswer.id.asc(),
        )
        .all()
    )
    return APIResponse(
        success=True,
        message="ok",
        data=_build_practice_report_payload(report_row, answer_rows),
    )


async def get_learning_subject_progress(
    subject_key: str, current_user: User, db: Session
):
    rows = (
        db.query(
            UserLearningTopicProgress.module_key.label("module_key"),
            func.coalesce(func.sum(UserLearningTopicProgress.total_questions), 0).label(
                "total_questions"
            ),
            func.coalesce(
                func.sum(UserLearningTopicProgress.attempted_unique_questions), 0
            ).label("attempted_unique_questions"),
            func.coalesce(
                func.sum(UserLearningTopicProgress.correct_unique_questions), 0
            ).label("correct_unique_questions"),
        )
        .filter(
            UserLearningTopicProgress.user_id == current_user.id,
            UserLearningTopicProgress.subject_key == subject_key,
        )
        .group_by(UserLearningTopicProgress.module_key)
        .order_by(UserLearningTopicProgress.module_key.asc())
        .all()
    )
    modules = []
    for row in rows:
        total_questions = int(row.total_questions or 0)
        attempted_unique_questions = int(row.attempted_unique_questions or 0)
        correct_unique_questions = int(row.correct_unique_questions or 0)
        modules.append(
            {
                "module_key": row.module_key,
                "total_questions": total_questions,
                "attempted_unique_questions": attempted_unique_questions,
                "correct_unique_questions": correct_unique_questions,
                "progress_percent_attempted": _to_progress_percent(
                    attempted_unique_questions, total_questions
                ),
                "progress_percent_correct": _to_progress_percent(
                    correct_unique_questions, total_questions
                ),
            }
        )
    return APIResponse(
        success=True,
        message="ok",
        data={
            "subject_key": subject_key,
            "modules": modules,
        },
    )


async def get_learning_study_time(subject_key: str, current_user: User, db: Session):
    row = (
        db.query(UserLearningStudyTime)
        .filter(
            UserLearningStudyTime.user_id == current_user.id,
            UserLearningStudyTime.subject_key == subject_key,
        )
        .first()
    )
    total_seconds = int(row.total_seconds or 0) if row is not None else 0
    return APIResponse(
        success=True,
        message="ok",
        data={
            "subject_key": subject_key,
            "total_seconds": total_seconds,
            "total_hours": round(total_seconds / 3600.0, 2),
            "last_recorded_at": row.last_recorded_at.isoformat()
            if row and row.last_recorded_at
            else None,
        },
    )


async def record_learning_study_time(
    body: LearningStudyTimeCreate, current_user: User, db: Session
):
    now = datetime.utcnow()
    row = (
        db.query(UserLearningStudyTime)
        .filter(
            UserLearningStudyTime.user_id == current_user.id,
            UserLearningStudyTime.subject_key == body.subject_key,
        )
        .first()
    )
    if row is None:
        row = UserLearningStudyTime(
            user_id=current_user.id,
            subject_key=body.subject_key,
            total_seconds=0,
        )
    row.total_seconds = int(row.total_seconds or 0) + body.duration_seconds
    row.last_recorded_at = now
    db.add(row)
    db.commit()
    db.refresh(row)
    return APIResponse(
        success=True,
        message="ok",
        data={
            "subject_key": row.subject_key,
            "total_seconds": int(row.total_seconds or 0),
            "total_hours": round(int(row.total_seconds or 0) / 3600.0, 2),
            "last_recorded_at": row.last_recorded_at.isoformat()
            if row.last_recorded_at
            else None,
        },
    )


async def get_making_whole_question_video(
    lesson_key: str, secret_key: str, question_number: int, current_user: User
):
    """Get a signed video URL for a Making Whole practice question."""
    _ = current_user
    object_key = get_making_whole_question_video_key(
        lesson_key, secret_key, question_number
    )
    if not object_key:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="invalid_question_video_request",
        )

    try:
        url = generate_object_read_url(object_key=object_key, expires_seconds=600)
    except RuntimeError as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(exc)
        ) from exc
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="video_url_generate_failed",
        ) from exc

    return APIResponse(
        success=True,
        message="ok",
        data={
            "lesson_key": lesson_key,
            "secret_key": secret_key,
            "question_number": question_number,
            "url": url,
        },
    )
