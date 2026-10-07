"""HTTP endpoints for user."""

from uuid import UUID

from fastapi import APIRouter, Depends, Header, Query
from sqlalchemy.orm import Session

from auth import get_current_active_user
from database import get_db
from models import User
from schemas import (
    APIResponse,
    AssessmentSessionCreate,
    CognitiveScoresBody,
    HomeSystemLoadoutBody,
    LearningPracticeReportUpsert,
    LearningQuestionAttemptCreate,
    LearningStudyTimeCreate,
    LearningTopicProgressReset,
    MentalMathUnlockDiamondsBody,
)
from services import (
    assessments,
    assets,
    cognitive_scores,
    cosmetics,
    inventory,
    learning_commerce,
    learning_progress,
    rewards,
)

router = APIRouter(prefix="/api/user", tags=["用户"])


@router.post("/learning/progress/question-attempt", response_model=APIResponse)
async def record_learning_question_attempt(
    body: LearningQuestionAttemptCreate,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db),
):
    return await learning_progress.record_learning_question_attempt(
        body=body, current_user=current_user, db=db
    )


@router.post("/learning/progress/topic-reset", response_model=APIResponse)
async def reset_learning_topic_progress(
    body: LearningTopicProgressReset,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db),
):
    return await learning_progress.reset_learning_topic_progress(
        body=body, current_user=current_user, db=db
    )


@router.get("/learning/progress/module", response_model=APIResponse)
async def get_learning_module_progress(
    subject_key: str = Query(..., min_length=1, max_length=64),
    module_key: str = Query(..., min_length=1, max_length=64),
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db),
):
    return await learning_progress.get_learning_module_progress(
        subject_key=subject_key, module_key=module_key, current_user=current_user, db=db
    )


@router.post("/learning/progress/practice-report", response_model=APIResponse)
async def upsert_learning_practice_report(
    body: LearningPracticeReportUpsert,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db),
):
    return await learning_progress.upsert_learning_practice_report(
        body=body, current_user=current_user, db=db
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
    return await learning_progress.list_learning_practice_report_history(
        subject_key=subject_key,
        module_key=module_key,
        topic_key=topic_key,
        limit=limit,
        offset=offset,
        current_user=current_user,
        db=db,
    )


@router.get(
    "/learning/progress/practice-report/by-id/{report_id}", response_model=APIResponse
)
async def get_learning_practice_report_by_id(
    report_id: int,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db),
):
    return await learning_progress.get_learning_practice_report_by_id(
        report_id=report_id, current_user=current_user, db=db
    )


@router.get("/learning/progress/practice-report", response_model=APIResponse)
async def get_learning_practice_report(
    subject_key: str = Query(..., min_length=1, max_length=64),
    module_key: str = Query(..., min_length=1, max_length=64),
    topic_key: str = Query(..., min_length=1, max_length=64),
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db),
):
    return await learning_progress.get_learning_practice_report(
        subject_key=subject_key,
        module_key=module_key,
        topic_key=topic_key,
        current_user=current_user,
        db=db,
    )


@router.get("/learning/progress/subject", response_model=APIResponse)
async def get_learning_subject_progress(
    subject_key: str = Query(..., min_length=1, max_length=64),
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db),
):
    return await learning_progress.get_learning_subject_progress(
        subject_key=subject_key, current_user=current_user, db=db
    )


@router.get("/learning/study-time", response_model=APIResponse)
async def get_learning_study_time(
    subject_key: str = Query(..., min_length=1, max_length=64),
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db),
):
    return await learning_progress.get_learning_study_time(
        subject_key=subject_key, current_user=current_user, db=db
    )


@router.post("/learning/study-time/session", response_model=APIResponse)
async def record_learning_study_time(
    body: LearningStudyTimeCreate,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db),
):
    return await learning_progress.record_learning_study_time(
        body=body, current_user=current_user, db=db
    )


@router.get(
    "/learning/mental-math/making-whole/question-video", response_model=APIResponse
)
async def get_making_whole_question_video(
    lesson_key: str = Query(..., description="lesson1 ... lesson5"),
    secret_key: str = Query(..., description="secret1 ... secret20"),
    question_number: int = Query(..., ge=1, description="1 ... 20"),
    current_user: User = Depends(get_current_active_user),
):
    return await learning_progress.get_making_whole_question_video(
        lesson_key=lesson_key,
        secret_key=secret_key,
        question_number=question_number,
        current_user=current_user,
    )


@router.get("/learning/mental-math/bundle-access", response_model=APIResponse)
async def get_mental_math_bundle_access(
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db),
):
    return await learning_commerce.get_mental_math_bundle_access(
        current_user=current_user, db=db
    )


@router.post("/learning/mental-math/unlock-with-diamonds", response_model=APIResponse)
async def unlock_mental_math_with_diamonds(
    body: MentalMathUnlockDiamondsBody,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db),
    request_id: UUID | None = Query(
        None, description="Reuse this UUID when retrying the same operation"
    ),
):
    return await learning_commerce.unlock_mental_math_with_diamonds(
        body=body, current_user=current_user, db=db, request_id=request_id
    )


@router.post("/assessments", response_model=APIResponse)
async def create_assessment_session(
    body: AssessmentSessionCreate,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db),
):
    return await assessments.create_assessment_session(
        body=body, current_user=current_user, db=db
    )


@router.get("/assessments", response_model=APIResponse)
async def list_assessment_sessions(
    subject: str = Query("mental-math"),
    limit: int = Query(20, ge=1, le=100),
    offset: int = Query(0, ge=0),
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db),
):
    return await assessments.list_assessment_sessions(
        subject=subject, limit=limit, offset=offset, current_user=current_user, db=db
    )


@router.get("/assessments/{session_id}", response_model=APIResponse)
async def get_assessment_session_detail(
    session_id: int,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db),
):
    return await assessments.get_assessment_session_detail(
        session_id=session_id, current_user=current_user, db=db
    )


@router.get("/assessments/{session_id}/compare", response_model=APIResponse)
async def compare_assessment_sessions(
    session_id: int,
    target_session_id: int | None = Query(None),
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db),
):
    return await assessments.compare_assessment_sessions(
        session_id=session_id,
        target_session_id=target_session_id,
        current_user=current_user,
        db=db,
    )


@router.get("/assessments/history/trend", response_model=APIResponse)
async def get_assessment_trend(
    subject: str = Query("mental-math"),
    limit: int = Query(20, ge=2, le=100),
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db),
):
    return await assessments.get_assessment_trend(
        subject=subject, limit=limit, current_user=current_user, db=db
    )


@router.get("/rewards", response_model=APIResponse)
async def get_rewards(
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db),
    x_user_timezone: str | None = Header(None, alias="X-User-Timezone"),
):
    return await rewards.get_rewards(
        current_user=current_user, db=db, x_user_timezone=x_user_timezone
    )


@router.get("/assets", response_model=APIResponse)
async def get_assets(
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db),
):
    return await assets.get_assets(current_user=current_user, db=db)


@router.get("/home-system", response_model=APIResponse)
async def get_home_system(
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db),
):
    return await cosmetics.get_home_system(current_user=current_user, db=db)


@router.post("/home-system/redeem", response_model=APIResponse)
async def redeem_home_system_item(
    item_id: str = Query(..., min_length=1, max_length=100),
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db),
    equip: bool = Query(False),
    request_id: UUID | None = Query(
        None, description="Reuse this UUID when retrying the same operation"
    ),
):
    return await cosmetics.redeem_home_system_item(
        item_id=item_id,
        current_user=current_user,
        db=db,
        equip=equip,
        request_id=request_id,
    )


@router.put("/home-system/loadout", response_model=APIResponse)
async def update_home_system_loadout(
    body: HomeSystemLoadoutBody,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db),
):
    return await cosmetics.update_home_system_loadout(
        body=body, current_user=current_user, db=db
    )


@router.get("/shop/items", response_model=APIResponse)
async def get_shop_items(
    game_mode: str | None = Query(None, description="可选：按游戏模式过滤道具"),
    current_user: User = Depends(get_current_active_user),
):
    return await inventory.get_shop_items(
        game_mode=game_mode, current_user=current_user
    )


@router.post("/check-in", response_model=APIResponse)
async def do_check_in(
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db),
    x_user_timezone: str | None = Header(None, alias="X-User-Timezone"),
):
    return await rewards.do_check_in(
        current_user=current_user, db=db, x_user_timezone=x_user_timezone
    )


@router.get("/cognitive-scores", response_model=APIResponse)
async def get_cognitive_scores(
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db),
):
    return await cognitive_scores.get_cognitive_scores(current_user=current_user, db=db)


@router.put("/cognitive-scores", response_model=APIResponse)
async def update_cognitive_scores(
    body: CognitiveScoresBody,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db),
):
    return await cognitive_scores.update_cognitive_scores(
        body=body, current_user=current_user, db=db
    )


@router.post("/tasks/claim", response_model=APIResponse)
async def claim_task(
    task_id: str = Query(..., description="daily-1, daily-2, monthly-1"),
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db),
    x_user_timezone: str | None = Header(None, alias="X-User-Timezone"),
):
    return await rewards.claim_task(
        task_id=task_id,
        current_user=current_user,
        db=db,
        x_user_timezone=x_user_timezone,
    )


@router.get("/shop/inventory", response_model=APIResponse)
async def get_inventory(
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db),
):
    return await inventory.get_inventory(current_user=current_user, db=db)


@router.post("/shop/redeem", response_model=APIResponse)
async def redeem_item(
    item_id: str = Query(..., description="道具 ID，如 avatar_hat_crown"),
    game_mode: str | None = Query(
        None, description="可选：当前游戏模式，用于校验道具可用范围"
    ),
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db),
    request_id: UUID | None = Query(
        None, description="Reuse this UUID when retrying the same operation"
    ),
):
    return await inventory.redeem_item(
        item_id=item_id,
        game_mode=game_mode,
        current_user=current_user,
        db=db,
        request_id=request_id,
    )


@router.post("/shop/consume", response_model=APIResponse)
async def consume_item(
    item_id: str = Query(..., description="道具 ID，如 chess_tourmaster_hint"),
    count: int = Query(1, ge=1, le=99, description="消耗数量，默认 1"),
    game_mode: str | None = Query(
        None, description="可选：当前游戏模式，用于校验道具可用范围"
    ),
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db),
    request_id: UUID | None = Query(
        None, description="Reuse this UUID when retrying the same operation"
    ),
):
    return await inventory.consume_item(
        item_id=item_id,
        count=count,
        game_mode=game_mode,
        current_user=current_user,
        db=db,
        request_id=request_id,
    )
