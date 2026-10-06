"""
用户奖励、签到、任务、六维分数、排行榜
"""
import math
import os
from datetime import datetime, date, timedelta
from zoneinfo import ZoneInfo

from fastapi import APIRouter, Depends, HTTPException, status, Query, Header
from sqlalchemy.orm import Session
from sqlalchemy import and_, func, or_, desc

from database import get_db
from models import (
    User,
    UserRewards,
    UserCheckIn,
    UserTaskClaim,
    UserCognitiveScores,
    UserGameReward,
    UserGamePlayByDay,
    UserGamePlayed,
    UserItemInventory,
    UserHomeSystemInventory,
    UserHomeSystemLoadout,
    UserAssessmentSession,
    UserAssessmentTopicStat,
    UserAssessmentAnswer,
    UserCourseEntitlement,
    UserLearningTopicProgress,
    UserLearningQuestionProgress,
    UserLearningStudyTime,
    UserLearningPracticeReport,
    UserLearningPracticeReportAnswer,
)
from schemas import (
    APIResponse,
    RewardsState,
    CognitiveScoresBody,
    CognitiveScoresResponse,
    LeaderboardEntry,
    AssessmentSessionCreate,
    LearningQuestionAttemptCreate,
    LearningTopicProgressReset,
    LearningStudyTimeCreate,
    LearningPracticeReportUpsert,
    MentalMathUnlockDiamondsBody,
    HomeSystemLoadoutBody,
)
from auth import get_current_active_user
from config.shop_items import SHOP_ITEMS, get_shop_items_by_game, is_item_available_for_game
from config.home_system import HOME_SYSTEM_ITEMS, get_home_system_item, is_free_home_system_item
from config.learning_commerce import MENTAL_MATH_COURSE_KEY, get_learning_bundle_commerce
from config.learning_media import get_making_whole_question_video_key
from utils.r2_storage import generate_object_read_url

router = APIRouter(prefix="/api/user", tags=["用户"])

CHECK_IN_COINS = 50
PLUS_CHECK_IN_BONUS_DIAMONDS = 5
PREMIUM_CHECK_IN_BONUS_COINS = 50
PREMIUM_CHECK_IN_BONUS_DIAMONDS = 10
STREAK_TOTAL_COINS = 200
STREAK_DIAMONDS = 1
STREAK_DAYS = 7
DAILY_TASK_COINS = 10
MONTHLY_TASK_DIAMONDS = 10
GAME_MODE_DAILY_1 = "chessmater"
GAME_MODE_DAILY_2 = "chess-tourmaster"
GAME_MODE_MONTHLY = "chess-tourmaster"
MONTHLY_TARGET = 20

# 未传或无效时区时回退到 UTC
DEFAULT_TZ = "UTC"


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
        "last_attempted_at": topic_row.last_attempted_at.isoformat() if topic_row.last_attempted_at else None,
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
        "finished_at": report_row.finished_at.isoformat() if report_row.finished_at else None,
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
        "finished_at": report_row.finished_at.isoformat() if report_row.finished_at else None,
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


def _today_in_tz(tz: str) -> str:
    """用户当地时区的今日日期 YYYY-MM-DD"""
    try:
        return datetime.now(ZoneInfo(tz)).date().isoformat()
    except Exception:
        return datetime.now(ZoneInfo(DEFAULT_TZ)).date().isoformat()


def _this_month_in_tz(tz: str) -> str:
    """用户当地时区的当月 YYYY-MM"""
    try:
        return datetime.now(ZoneInfo(tz)).strftime("%Y-%m")
    except Exception:
        return datetime.now(ZoneInfo(DEFAULT_TZ)).strftime("%Y-%m")


@router.post("/learning/progress/question-attempt", response_model=APIResponse)
async def record_learning_question_attempt(
    body: LearningQuestionAttemptCreate,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db),
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
    was_correct_ever = bool(question_row.is_correct_ever) if question_row is not None else False
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
    topic_row.attempted_unique_questions = int(topic_row.attempted_unique_questions or 0)
    topic_row.correct_unique_questions = int(topic_row.correct_unique_questions or 0)
    topic_row.progress_percent_attempted = int(topic_row.progress_percent_attempted or 0)
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


@router.post("/learning/progress/topic-reset", response_model=APIResponse)
async def reset_learning_topic_progress(
    body: LearningTopicProgressReset,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db),
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

    topic_row.total_questions = body.total_questions if body.total_questions > 0 else int(topic_row.total_questions or 0)
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


@router.get("/learning/progress/module", response_model=APIResponse)
async def get_learning_module_progress(
    subject_key: str = Query(..., min_length=1, max_length=64),
    module_key: str = Query(..., min_length=1, max_length=64),
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db),
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


@router.post("/learning/progress/practice-report", response_model=APIResponse)
async def upsert_learning_practice_report(
    body: LearningPracticeReportUpsert,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db),
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
        scope_query.with_entities(func.max(UserLearningPracticeReport.attempt_number)).scalar() or 0
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
        .order_by(UserLearningPracticeReportAnswer.sort_order.asc(), UserLearningPracticeReportAnswer.id.asc())
        .all()
    )
    return APIResponse(
        success=True,
        message="ok",
        data=_build_practice_report_payload(report_row, answer_rows),
    )


@router.get("/learning/progress/practice-report/history", response_model=APIResponse)
async def list_learning_practice_report_history(
    subject_key: str = Query(..., min_length=1, max_length=64),
    module_key: str = Query(..., min_length=1, max_length=64),
    topic_key: str = Query(..., min_length=1, max_length=64),
    limit: int = Query(50, ge=1, le=100),
    offset: int = Query(0, ge=0),
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db),
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


@router.get("/learning/progress/practice-report/by-id/{report_id}", response_model=APIResponse)
async def get_learning_practice_report_by_id(
    report_id: int,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db),
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
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="practice_report_not_found")

    answer_rows = (
        db.query(UserLearningPracticeReportAnswer)
        .filter(UserLearningPracticeReportAnswer.report_id == report_row.id)
        .order_by(UserLearningPracticeReportAnswer.sort_order.asc(), UserLearningPracticeReportAnswer.id.asc())
        .all()
    )
    return APIResponse(
        success=True,
        message="ok",
        data=_build_practice_report_payload(report_row, answer_rows),
    )


@router.get("/learning/progress/practice-report", response_model=APIResponse)
async def get_learning_practice_report(
    subject_key: str = Query(..., min_length=1, max_length=64),
    module_key: str = Query(..., min_length=1, max_length=64),
    topic_key: str = Query(..., min_length=1, max_length=64),
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db),
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
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="practice_report_not_found")

    answer_rows = (
        db.query(UserLearningPracticeReportAnswer)
        .filter(UserLearningPracticeReportAnswer.report_id == report_row.id)
        .order_by(UserLearningPracticeReportAnswer.sort_order.asc(), UserLearningPracticeReportAnswer.id.asc())
        .all()
    )
    return APIResponse(
        success=True,
        message="ok",
        data=_build_practice_report_payload(report_row, answer_rows),
    )


@router.get("/learning/progress/subject", response_model=APIResponse)
async def get_learning_subject_progress(
    subject_key: str = Query(..., min_length=1, max_length=64),
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db),
):
    rows = (
        db.query(
            UserLearningTopicProgress.module_key.label("module_key"),
            func.coalesce(func.sum(UserLearningTopicProgress.total_questions), 0).label("total_questions"),
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


@router.get("/learning/study-time", response_model=APIResponse)
async def get_learning_study_time(
    subject_key: str = Query(..., min_length=1, max_length=64),
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db),
):
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
            "last_recorded_at": row.last_recorded_at.isoformat() if row and row.last_recorded_at else None,
        },
    )


@router.post("/learning/study-time/session", response_model=APIResponse)
async def record_learning_study_time(
    body: LearningStudyTimeCreate,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db),
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
            "last_recorded_at": row.last_recorded_at.isoformat() if row.last_recorded_at else None,
        },
    )


@router.get("/learning/mental-math/making-whole/question-video", response_model=APIResponse)
async def get_making_whole_question_video(
    lesson_key: str = Query(..., description="lesson1 ... lesson5"),
    secret_key: str = Query(..., description="secret1 ... secret20"),
    question_number: int = Query(..., ge=1, description="1 ... 20"),
    current_user: User = Depends(get_current_active_user),
):
    """Get a signed video URL for a Making Whole practice question."""
    _ = current_user
    object_key = get_making_whole_question_video_key(lesson_key, secret_key, question_number)
    if not object_key:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="invalid_question_video_request")

    try:
        url = generate_object_read_url(object_key=object_key, expires_seconds=600)
    except RuntimeError as exc:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(exc)) from exc
    except Exception as exc:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail="video_url_generate_failed") from exc

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


def _get_course_entitlement(
    db: Session, user_id: int, course_key: str
) -> UserCourseEntitlement | None:
    return (
        db.query(UserCourseEntitlement)
        .filter(
            UserCourseEntitlement.user_id == user_id,
            UserCourseEntitlement.course_key == course_key,
        )
        .first()
    )


def _compute_mental_math_bundle_access(
    user: User, entitlement: UserCourseEntitlement | None
) -> dict:
    """Effective bundle access for lesson list UI (premium > lifetime diamond > timed diamond)."""
    now = datetime.utcnow()

    plan = getattr(user, "membership_plan", None) or "free"
    if plan == "premium":
        exp = getattr(user, "membership_expires_at", None)
        if exp is None or exp > now:
            return {
                "bundle_unlocked": True,
                "access_badge": "premium",
                "days_left": None,
                "expires_at": exp.isoformat() if exp else None,
            }

    if entitlement is not None and entitlement.diamond_tier == "lifetime":
        return {
            "bundle_unlocked": True,
            "access_badge": "full",
            "days_left": None,
            "expires_at": None,
        }

    if (
        entitlement is not None
        and entitlement.diamond_tier == "three_month"
        and entitlement.expires_at is not None
        and entitlement.expires_at > now
    ):
        sec_left = (entitlement.expires_at - now).total_seconds()
        days_left = max(0, math.ceil(sec_left / 86400.0))
        return {
            "bundle_unlocked": True,
            "access_badge": "timed",
            "days_left": days_left,
            "expires_at": entitlement.expires_at.isoformat(),
        }

    return {
        "bundle_unlocked": False,
        "access_badge": "none",
        "days_left": None,
        "expires_at": None,
    }


@router.get("/learning/mental-math/bundle-access", response_model=APIResponse)
async def get_mental_math_bundle_access(
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db),
):
    """Server-side Mental Math paid bundle + membership; drives learning UI."""
    ent = _get_course_entitlement(db, current_user.id, MENTAL_MATH_COURSE_KEY)
    data = _compute_mental_math_bundle_access(current_user, ent)
    rewards = _get_or_create_rewards(db, current_user.id)
    data["diamonds"] = rewards.diamonds
    return APIResponse(success=True, message="ok", data=data)


@router.post("/learning/mental-math/unlock-with-diamonds", response_model=APIResponse)
async def unlock_mental_math_with_diamonds(
    body: MentalMathUnlockDiamondsBody,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db),
):
    """Spend diamonds to unlock the Mental Math bundle (90-day or lifetime)."""
    commerce = get_learning_bundle_commerce(MENTAL_MATH_COURSE_KEY)
    cost = (
        commerce.diamonds_three_month if body.tier == "three_month" else commerce.diamonds_lifetime
    )

    rewards = _get_or_create_rewards(db, current_user.id)
    if rewards.diamonds < cost:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="insufficient_diamonds")

    ent = _get_course_entitlement(db, current_user.id, MENTAL_MATH_COURSE_KEY)
    if ent is None:
        ent = UserCourseEntitlement(
            user_id=current_user.id,
            course_key=MENTAL_MATH_COURSE_KEY,
        )
        db.add(ent)

    if ent.diamond_tier == "lifetime":
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="already_lifetime_unlocked")

    if body.tier == "lifetime":
        ent.diamond_tier = "lifetime"
        ent.expires_at = None
    else:
        now = datetime.utcnow()
        base = now
        if ent.expires_at and ent.expires_at > now:
            base = ent.expires_at
        ent.diamond_tier = "three_month"
        ent.expires_at = base + timedelta(days=commerce.timed_tier_days)

    rewards.diamonds -= cost
    db.add(ent)
    db.add(rewards)
    db.commit()
    db.refresh(rewards)
    db.refresh(ent)

    access = _compute_mental_math_bundle_access(current_user, ent)
    access["diamonds"] = rewards.diamonds
    return APIResponse(success=True, message="ok", data=access)


def _get_or_create_rewards(db: Session, user_id: int) -> UserRewards:
    r = db.query(UserRewards).filter(UserRewards.user_id == user_id).first()
    if r:
        return r
    r = UserRewards(user_id=user_id)
    db.add(r)
    db.commit()
    db.refresh(r)
    return r


def _check_in_dates_this_month(db: Session, user_id: int, today_iso: str) -> list[str]:
    """当月签到日期列表（以用户当地当月为准）"""
    d = date.fromisoformat(today_iso)
    start = d.replace(day=1).isoformat()
    end = today_iso
    rows = (
        db.query(UserCheckIn.check_in_date)
        .filter(UserCheckIn.user_id == user_id, UserCheckIn.check_in_date >= start, UserCheckIn.check_in_date <= end)
        .order_by(UserCheckIn.check_in_date)
        .all()
    )
    return [r[0] for r in rows]


def _current_streak(db: Session, user_id: int, sorted_dates: list[str], today_iso: str) -> int:
    if not sorted_dates:
        return 0
    if today_iso not in sorted_dates:
        return 0
    streak = 0
    d = date.fromisoformat(today_iso)
    while True:
        key = d.isoformat()
        if key not in sorted_dates:
            break
        streak += 1
        d -= timedelta(days=1)
    return streak


def _active_membership_bonus_plan(user: User) -> str | None:
    plan = getattr(user, "membership_plan", None) or "free"
    if plan not in {"plus", "premium"}:
        return None
    expires_at = getattr(user, "membership_expires_at", None)
    if expires_at is not None and expires_at <= datetime.utcnow():
        return None
    return plan


def _daily_progress_from_games(db: Session, user_id: int, today_iso: str) -> dict:
    """从按日表读取当日点开次数，作为每日任务进度。task_id: daily-1 -> chessmater, daily-2 -> chess-tourmaster"""
    out = {}
    for mode, task_id in [(GAME_MODE_DAILY_1, "daily-1"), (GAME_MODE_DAILY_2, "daily-2")]:
        r = db.query(UserGamePlayByDay).filter(
            UserGamePlayByDay.user_id == user_id,
            UserGamePlayByDay.game_mode == mode,
            UserGamePlayByDay.play_date == today_iso,
        ).first()
        out[task_id] = r.count if r else 0
    return out


def _monthly_progress_from_games(db: Session, user_id: int, month_ym: str) -> int:
    """当月该游戏模式点开次数之和（用于每月任务进度）"""
    row = (
        db.query(func.coalesce(func.sum(UserGamePlayByDay.count), 0))
        .filter(
            UserGamePlayByDay.user_id == user_id,
            UserGamePlayByDay.game_mode == GAME_MODE_MONTHLY,
            UserGamePlayByDay.play_date.like(f"{month_ym}-%"),
        )
        .scalar()
    )
    return int(row) if row is not None else 0


def _task_claimed_today(db: Session, user_id: int, today_iso: str) -> list[str]:
    rows = db.query(UserTaskClaim.task_id).filter(
        UserTaskClaim.user_id == user_id, UserTaskClaim.claimed_date == today_iso
    ).all()
    return [r[0] for r in rows]


def _monthly_claimed(db: Session, user_id: int, month_ym: str) -> bool:
    return db.query(UserTaskClaim).filter(
        UserTaskClaim.user_id == user_id,
        UserTaskClaim.task_id == "monthly-1",
        UserTaskClaim.claimed_date == month_ym,
    ).first() is not None


def _balances_dict(rewards: UserRewards) -> dict:
    """统一返回三种资产余额"""
    return {
        "coins": rewards.coins,
        "diamonds": rewards.diamonds,
        "flowers": rewards.flowers,
    }


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


def _build_topic_delta(base_topic_stats: list[dict], target_topic_stats: list[dict]) -> list[dict]:
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


@router.post("/assessments", response_model=APIResponse)
async def create_assessment_session(
    body: AssessmentSessionCreate,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db),
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


@router.get("/assessments", response_model=APIResponse)
async def list_assessment_sessions(
    subject: str = Query("mental-math"),
    limit: int = Query(20, ge=1, le=100),
    offset: int = Query(0, ge=0),
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db),
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
            "list": [_serialize_assessment_session(db, row, include_answers=False) for row in rows],
        },
    )


@router.get("/assessments/{session_id}", response_model=APIResponse)
async def get_assessment_session_detail(
    session_id: int,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db),
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
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="assessment_not_found")
    return APIResponse(success=True, message="ok", data=_serialize_assessment_session(db, row, include_answers=True))


@router.get("/assessments/{session_id}/compare", response_model=APIResponse)
async def compare_assessment_sessions(
    session_id: int,
    target_session_id: int | None = Query(None),
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db),
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
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="assessment_not_found")

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
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="compare_target_not_found")

    base_data = _serialize_assessment_session(db, base_row, include_answers=False)
    target_data = _serialize_assessment_session(db, target_row, include_answers=False)
    return APIResponse(
        success=True,
        message="ok",
        data={
            "base_session_id": base_row.id,
            "target_session_id": target_row.id,
            "accuracy_delta": int(target_row.accuracy - base_row.accuracy),
            "duration_seconds_delta": int(target_row.duration_seconds - base_row.duration_seconds),
            "correct_count_delta": int(target_row.correct_count - base_row.correct_count),
            "topic_deltas": _build_topic_delta(base_data["topic_stats"], target_data["topic_stats"]),
            "base": base_data,
            "target": target_data,
        },
    )


@router.get("/assessments/history/trend", response_model=APIResponse)
async def get_assessment_trend(
    subject: str = Query("mental-math"),
    limit: int = Query(20, ge=2, le=100),
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db),
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


@router.get("/assessment-trend", response_model=APIResponse)
async def get_assessment_trend_compat(
    subject: str = Query("mental-math"),
    limit: int = Query(20, ge=2, le=100),
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db),
):
    """兼容趋势接口：避免与 /assessments/{session_id} 路由冲突。"""
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


@router.get("/rewards", response_model=APIResponse)
async def get_rewards(
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db),
    x_user_timezone: str | None = Header(None, alias="X-User-Timezone"),
):
    """获取金币、钻石、签到状态、每日/每月任务进度。日期按请求头 X-User-Timezone 的用户当地时间计算。"""
    tz = (x_user_timezone or "").strip() or DEFAULT_TZ
    today_iso = _today_in_tz(tz)
    month_ym = _this_month_in_tz(tz)

    rewards = _get_or_create_rewards(db, current_user.id)
    check_in_dates = _check_in_dates_this_month(db, current_user.id, today_iso)
    all_dates = (
        db.query(UserCheckIn.check_in_date)
        .filter(UserCheckIn.user_id == current_user.id)
        .order_by(UserCheckIn.check_in_date)
        .all()
    )
    sorted_dates = [r[0] for r in all_dates]
    streak = _current_streak(db, current_user.id, sorted_dates, today_iso)
    daily_progress = _daily_progress_from_games(db, current_user.id, today_iso)
    monthly_progress = _monthly_progress_from_games(db, current_user.id, month_ym)
    task_claimed = _task_claimed_today(db, current_user.id, today_iso)
    monthly_claimed = _monthly_claimed(db, current_user.id, month_ym)

    played_game_count = (
        db.query(UserGamePlayed).filter(UserGamePlayed.user_id == current_user.id).count()
    )

    return APIResponse(
        success=True,
        message="ok",
        data={
            "coins": rewards.coins,
            "diamonds": rewards.diamonds,
            "flowers": rewards.flowers,
            "check_in_dates": check_in_dates,
            "has_checked_in_today": today_iso in sorted_dates,
            "current_streak": streak,
            "daily_progress": daily_progress,
            "monthly_progress": monthly_progress,
            "monthly_target": MONTHLY_TARGET,
            "task_claimed_today": task_claimed,
            "monthly_claimed": monthly_claimed,
            "played_game_count": played_game_count,
        },
    )


@router.get("/assets", response_model=APIResponse)
async def get_assets(
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db),
):
    """获取统一资产余额（金币/钻石/鲜花），供官网与游戏端读取。"""
    rewards = _get_or_create_rewards(db, current_user.id)
    return APIResponse(success=True, message="ok", data=_balances_dict(rewards))


@router.get("/home-system", response_model=APIResponse)
async def get_home_system(
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db),
):
    """Return the cosmetic catalog, ownership, and current loadout."""
    owned_rows = (
        db.query(UserHomeSystemInventory.item_id)
        .filter(UserHomeSystemInventory.user_id == current_user.id)
        .all()
    )
    owned_item_ids = {row[0] for row in owned_rows}
    owned_item_ids.update(
        item_id for item_id, item in HOME_SYSTEM_ITEMS.items() if is_free_home_system_item(item)
    )

    loadout_row = (
        db.query(UserHomeSystemLoadout)
        .filter(UserHomeSystemLoadout.user_id == current_user.id)
        .first()
    )
    loadout = {
        "head": loadout_row.head_item_id if loadout_row else None,
        "body": loadout_row.body_item_id if loadout_row else None,
        "hand": loadout_row.hand_item_id if loadout_row else None,
        "background": loadout_row.background_item_id if loadout_row else None,
        "limited": loadout_row.limited_item_id if loadout_row else None,
    }
    items = [
        {
            "item_id": item_id,
            **item,
            "is_owned": item_id in owned_item_ids,
        }
        for item_id, item in HOME_SYSTEM_ITEMS.items()
    ]

    return APIResponse(
        success=True,
        message="ok",
        data={
            "items": items,
            "owned_item_ids": sorted(owned_item_ids),
            "loadout": loadout,
        },
    )


def _home_system_loadout_dict(loadout: UserHomeSystemLoadout) -> dict:
    return {
        slot: getattr(loadout, f"{slot}_item_id")
        for slot in ("head", "body", "hand", "background", "limited")
    }


def _set_home_system_loadout_item(db: Session, user_id: int, slot: str, item_id: str | None):
    loadout = db.query(UserHomeSystemLoadout).filter(UserHomeSystemLoadout.user_id == user_id).first()
    if loadout is None:
        loadout = UserHomeSystemLoadout(user_id=user_id)
        db.add(loadout)
    setattr(loadout, f"{slot}_item_id", item_id)
    if item_id and slot == "limited":
        loadout.head_item_id = None
        loadout.body_item_id = None
        loadout.hand_item_id = None
    elif item_id and slot in {"head", "body", "hand"}:
        loadout.limited_item_id = None
    return loadout


@router.post("/home-system/redeem", response_model=APIResponse)
async def redeem_home_system_item(
    item_id: str = Query(..., min_length=1, max_length=100),
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db),
    equip: bool = Query(False),
):
    """Permanently redeem one home-system cosmetic."""
    item = get_home_system_item(item_id)
    if item is None:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="invalid_home_system_item")
    if is_free_home_system_item(item):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="item_is_free")

    existing = (
        db.query(UserHomeSystemInventory)
        .filter(
            UserHomeSystemInventory.user_id == current_user.id,
            UserHomeSystemInventory.item_id == item_id,
        )
        .first()
    )
    if existing is not None:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="already_owned")

    rewards = _get_or_create_rewards(db, current_user.id)
    cost = item["cost"]
    if (
        rewards.coins < cost["coins"]
        or rewards.diamonds < cost["diamonds"]
        or rewards.flowers < cost["flowers"]
    ):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="insufficient_assets")

    rewards.coins -= cost["coins"]
    rewards.diamonds -= cost["diamonds"]
    rewards.flowers -= cost["flowers"]
    db.add(UserHomeSystemInventory(user_id=current_user.id, item_id=item_id))
    db.add(rewards)
    loadout = _set_home_system_loadout_item(db, current_user.id, item["slot"], item_id) if equip else None
    db.commit()
    db.refresh(rewards)

    return APIResponse(
        success=True,
        message="ok",
        data={
            "item_id": item_id,
            "item_name": item["name"],
            "cost": cost,
            "assets": _balances_dict(rewards),
            "loadout": _home_system_loadout_dict(loadout) if loadout is not None else None,
        },
    )


@router.put("/home-system/loadout", response_model=APIResponse)
async def update_home_system_loadout(
    body: HomeSystemLoadoutBody,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db),
):
    """Equip or clear one home-system slot."""
    item = get_home_system_item(body.item_id) if body.item_id else None
    if body.item_id and item is None:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="invalid_home_system_item")
    if item and item["slot"] != body.slot:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="item_slot_mismatch")

    if item and not is_free_home_system_item(item):
        owned = (
            db.query(UserHomeSystemInventory)
            .filter(
                UserHomeSystemInventory.user_id == current_user.id,
                UserHomeSystemInventory.item_id == body.item_id,
            )
            .first()
        )
        if owned is None:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="item_not_owned")

    loadout = _set_home_system_loadout_item(db, current_user.id, body.slot, body.item_id)
    db.commit()
    db.refresh(loadout)

    return APIResponse(
        success=True,
        message="ok",
        data={
            "loadout": _home_system_loadout_dict(loadout)
        },
    )


@router.get("/shop/items", response_model=APIResponse)
async def get_shop_items(
    game_mode: str | None = Query(None, description="可选：按游戏模式过滤道具"),
    current_user: User = Depends(get_current_active_user),
):
    """获取可兑换道具配置。"""
    _ = current_user
    return APIResponse(
        success=True,
        message="ok",
        data={"items": get_shop_items_by_game(game_mode), "game_mode": game_mode},
    )


@router.post("/check-in", response_model=APIResponse)
async def do_check_in(
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db),
    x_user_timezone: str | None = Header(None, alias="X-User-Timezone"),
):
    """Daily check-in (user timezone). Base CHECK_IN_COINS; each 7-day streak milestone adds streak coins to STREAK_TOTAL_COINS that day and STREAK_DIAMONDS once per 7-day window."""
    tz = (x_user_timezone or "").strip() or DEFAULT_TZ
    today = _today_in_tz(tz)

    existing = db.query(UserCheckIn).filter(
        UserCheckIn.user_id == current_user.id, UserCheckIn.check_in_date == today
    ).first()
    if existing:
        return APIResponse(
            success=True,
            message="already_checked_in",
            data={
                "coins": 0,
                "membership_bonus_plan": None,
                "membership_bonus_coins": 0,
                "membership_bonus_diamonds": 0,
                "diamonds": 0,
                "flowers": 0,
            },
        )

    db.add(UserCheckIn(user_id=current_user.id, check_in_date=today))
    rewards = _get_or_create_rewards(db, current_user.id)
    rewards.coins += CHECK_IN_COINS
    coins_awarded = CHECK_IN_COINS
    diamonds_awarded = 0
    membership_bonus_plan = _active_membership_bonus_plan(current_user)
    membership_bonus_coins = 0
    membership_bonus_diamonds = 0
    if membership_bonus_plan == "plus":
        rewards.diamonds += PLUS_CHECK_IN_BONUS_DIAMONDS
        membership_bonus_diamonds = PLUS_CHECK_IN_BONUS_DIAMONDS
    elif membership_bonus_plan == "premium":
        rewards.coins += PREMIUM_CHECK_IN_BONUS_COINS
        rewards.diamonds += PREMIUM_CHECK_IN_BONUS_DIAMONDS
        membership_bonus_coins = PREMIUM_CHECK_IN_BONUS_COINS
        membership_bonus_diamonds = PREMIUM_CHECK_IN_BONUS_DIAMONDS
    # Session is configured with autoflush=False, so persist pending check-in
    # before querying streak dates; otherwise "today" is missing from all_dates.
    db.flush()

    all_dates = [
        r[0] for r in
        db.query(UserCheckIn.check_in_date).filter(UserCheckIn.user_id == current_user.id).order_by(UserCheckIn.check_in_date).all()
    ]
    streak = _current_streak(db, current_user.id, all_dates, today)
    if streak >= STREAK_DAYS and streak % STREAK_DAYS == 0:
        streak_start = date.fromisoformat(today) - timedelta(days=STREAK_DAYS - 1)
        streak_start_str = streak_start.isoformat()
        if rewards.last_streak_award_start != streak_start_str:
            # Milestone day total should be 200 coins, not 200 + daily base.
            milestone_extra_coins = max(0, STREAK_TOTAL_COINS - CHECK_IN_COINS)
            rewards.coins += milestone_extra_coins
            coins_awarded += milestone_extra_coins
            rewards.diamonds += STREAK_DIAMONDS
            rewards.last_streak_award_start = streak_start_str
            diamonds_awarded = STREAK_DIAMONDS
    db.commit()
    db.refresh(rewards)
    return APIResponse(
        success=True,
        message="ok",
        data={
            "coins": coins_awarded,
            "membership_bonus_plan": membership_bonus_plan,
            "membership_bonus_coins": membership_bonus_coins,
            "membership_bonus_diamonds": membership_bonus_diamonds,
            "diamonds": diamonds_awarded,
            "flowers": 0,
        },
    )


@router.get("/cognitive-scores", response_model=APIResponse)
async def get_cognitive_scores(
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db),
):
    """获取当前用户六维认知分数"""
    row = db.query(UserCognitiveScores).filter(UserCognitiveScores.user_id == current_user.id).first()
    if not row:
        return APIResponse(
            success=True,
            message="ok",
            data={"memory": 0, "logic": 0, "focus": 0, "reaction": 0, "strategy": 0, "spatial": 0},
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


@router.put("/cognitive-scores", response_model=APIResponse)
async def update_cognitive_scores(
    body: CognitiveScoresBody,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db),
):
    """更新六维分数（只更新传入的维度，用于测试完成后合并）"""
    row = db.query(UserCognitiveScores).filter(UserCognitiveScores.user_id == current_user.id).first()
    if not row:
        row = UserCognitiveScores(user_id=current_user.id)
        db.add(row)
        db.flush()
    for key in ("memory", "logic", "focus", "reaction", "strategy", "spatial"):
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


@router.post("/tasks/claim", response_model=APIResponse)
async def claim_task(
    task_id: str = Query(..., description="daily-1, daily-2, monthly-1"),
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db),
    x_user_timezone: str | None = Header(None, alias="X-User-Timezone"),
):
    """领取任务奖励。今日/当月按请求头 X-User-Timezone 的用户当地时间计算。"""
    tz = (x_user_timezone or "").strip() or DEFAULT_TZ
    today = _today_in_tz(tz)
    month = _this_month_in_tz(tz)

    rewards = _get_or_create_rewards(db, current_user.id)

    if task_id == "daily-1":
        progress = _daily_progress_from_games(db, current_user.id, today).get("daily-1", 0)
        if progress < 1:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="task_not_completed")
        if task_id in _task_claimed_today(db, current_user.id, today):
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="already_claimed")
        rewards.coins += DAILY_TASK_COINS
        db.add(UserTaskClaim(user_id=current_user.id, task_id=task_id, claimed_date=today))
    elif task_id == "daily-2":
        progress = _daily_progress_from_games(db, current_user.id, today).get("daily-2", 0)
        if progress < 1:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="task_not_completed")
        if task_id in _task_claimed_today(db, current_user.id, today):
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="already_claimed")
        rewards.coins += DAILY_TASK_COINS
        db.add(UserTaskClaim(user_id=current_user.id, task_id=task_id, claimed_date=today))
    elif task_id == "monthly-1":
        progress = _monthly_progress_from_games(db, current_user.id, month)
        if progress < MONTHLY_TARGET:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="task_not_completed")
        if _monthly_claimed(db, current_user.id, month):
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="already_claimed")
        rewards.diamonds += MONTHLY_TASK_DIAMONDS
        db.add(UserTaskClaim(user_id=current_user.id, task_id=task_id, claimed_date=month))
    else:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="invalid_task_id")
    db.commit()
    db.refresh(rewards)
    return APIResponse(success=True, message="ok", data=_balances_dict(rewards))


@router.get("/shop/inventory", response_model=APIResponse)
async def get_inventory(
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db),
):
    """获取当前用户道具背包。"""
    rows = (
        db.query(UserItemInventory)
        .filter(UserItemInventory.user_id == current_user.id)
        .order_by(UserItemInventory.item_id.asc())
        .all()
    )
    return APIResponse(
        success=True,
        message="ok",
        data={
            "items": [
                {"item_id": r.item_id, "quantity": r.quantity}
                for r in rows
            ]
        },
    )


@router.post("/shop/redeem", response_model=APIResponse)
async def redeem_item(
    item_id: str = Query(..., description="道具 ID，如 avatar_hat_crown"),
    game_mode: str | None = Query(None, description="可选：当前游戏模式，用于校验道具可用范围"),
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db),
):
    """兑换道具：服务端校验并扣减金币/钻石/鲜花，成功后写入背包。"""
    item = SHOP_ITEMS.get(item_id)
    if not item:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="invalid_item_id")
    if not is_item_available_for_game(item, game_mode):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="item_not_available_for_game")

    rewards = _get_or_create_rewards(db, current_user.id)
    cost = item["cost"]

    if rewards.coins < cost["coins"] or rewards.diamonds < cost["diamonds"] or rewards.flowers < cost["flowers"]:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="insufficient_assets")

    rewards.coins -= cost["coins"]
    rewards.diamonds -= cost["diamonds"]
    rewards.flowers -= cost["flowers"]

    inventory_row = (
        db.query(UserItemInventory)
        .filter(
            UserItemInventory.user_id == current_user.id,
            UserItemInventory.item_id == item_id,
        )
        .first()
    )
    if inventory_row is None:
        inventory_row = UserItemInventory(
            user_id=current_user.id,
            item_id=item_id,
            quantity=1,
        )
        db.add(inventory_row)
    else:
        inventory_row.quantity += 1
        db.add(inventory_row)

    db.add(rewards)
    db.commit()
    db.refresh(rewards)
    db.refresh(inventory_row)

    return APIResponse(
        success=True,
        message="ok",
        data={
            "item_id": item_id,
            "item_name": item["name"],
            "games": item.get("games", []),
            "game_mode": game_mode,
            "cost": cost,
            "inventory_quantity": inventory_row.quantity,
            "assets": _balances_dict(rewards),
        },
    )


@router.post("/shop/consume", response_model=APIResponse)
async def consume_item(
    item_id: str = Query(..., description="道具 ID，如 chess_tourmaster_hint"),
    count: int = Query(1, ge=1, le=99, description="消耗数量，默认 1"),
    game_mode: str | None = Query(None, description="可选：当前游戏模式，用于校验道具可用范围"),
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db),
):
    """消耗道具：服务端校验库存并扣减数量。"""
    item = SHOP_ITEMS.get(item_id)
    if not item:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="invalid_item_id")
    if not is_item_available_for_game(item, game_mode):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="item_not_available_for_game")

    inventory_row = (
        db.query(UserItemInventory)
        .filter(
            UserItemInventory.user_id == current_user.id,
            UserItemInventory.item_id == item_id,
        )
        .first()
    )
    if inventory_row is None or inventory_row.quantity < count:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="insufficient_inventory")

    inventory_row.quantity -= count
    remain = inventory_row.quantity
    if inventory_row.quantity <= 0:
        db.delete(inventory_row)
        remain = 0
    else:
        db.add(inventory_row)
    db.commit()

    return APIResponse(
        success=True,
        message="ok",
        data={
            "item_id": item_id,
            "consumed_count": count,
            "inventory_quantity": remain,
            "game_mode": game_mode,
        },
    )
