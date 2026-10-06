"""
Pydantic 数据验证模型
"""
from pydantic import BaseModel, EmailStr, Field
from typing import Optional, Dict, Any, List, Literal
from datetime import datetime, date


def compute_age(birth: Optional[date]) -> Optional[int]:
    """根据出生日期计算年龄（周岁），未提供则返回 None"""
    if not birth:
        return None
    today = date.today()
    age = today.year - birth.year
    if (today.month, today.day) < (birth.month, birth.day):
        age -= 1
    return age


# ========== 用户相关 ==========
class UserBase(BaseModel):
    """用户基础模型"""
    username: str = Field(..., min_length=3, max_length=50)
    email: EmailStr


class UserCreate(UserBase):
    """创建用户模型"""
    password: str = Field(..., min_length=6, max_length=100)
    verification_code: str = Field(..., min_length=6, max_length=6)
    date_of_birth: Optional[date] = None  # 出生日期，可选（测试阶段用于年龄分析）
    country: Optional[str] = Field(None, min_length=2, max_length=2)  # ISO 3166-1 alpha-2


class UserLogin(BaseModel):
    """用户登录模型"""
    username: str
    password: str


class UserResponse(UserBase):
    """用户响应模型

    Auth is carried by the cross-subdomain HttpOnly cookie set on /api/auth/*;
    no token fields are exposed in the body.
    """
    id: int
    is_active: bool
    is_superuser: bool
    created_at: datetime
    date_of_birth: Optional[date] = None
    country: Optional[str] = None
    avatar_url: Optional[str] = None
    age: Optional[int] = None  # 由 date_of_birth 计算，序列化时由路由填充
    membership_plan: str = "free"
    membership_expires_at: Optional[datetime] = None
    membership_billing_interval: Optional[str] = None
    membership_pending_plan: Optional[str] = None
    membership_pending_billing_interval: Optional[str] = None
    membership_pending_effective_at: Optional[datetime] = None
    stripe_customer_id: Optional[str] = None
    stripe_subscription_id: Optional[str] = None
    membership_trial_used: bool = False

    class Config:
        from_attributes = True


class MentalMathUnlockDiamondsBody(BaseModel):
    tier: Literal["three_month", "lifetime"]


class BillingCheckoutBody(BaseModel):
    plan: Literal["plus", "premium"]
    billing_interval: Literal["monthly", "annual"] = "monthly"
    locale: str = Field(default="en", min_length=2, max_length=5)


class BillingDiamondCheckoutBody(BaseModel):
    bundle_id: Literal["diamonds10", "diamonds25", "diamonds70", "diamonds200", "diamonds300"]
    locale: str = Field(default="en", min_length=2, max_length=5)


class BillingCoinCheckoutBody(BaseModel):
    bundle_id: Literal["coins100", "coins250", "coins800", "coins1500", "coins2500"]
    locale: str = Field(default="en", min_length=2, max_length=5)


class BillingPortalBody(BaseModel):
    locale: str = Field(default="en", min_length=2, max_length=5)


class BillingChangeSubscriptionBody(BaseModel):
    """Switch paid tier or billing period on the existing Stripe subscription."""
    plan: Literal["plus", "premium"]
    billing_interval: Literal["monthly", "annual"] = "monthly"
    locale: str = Field(default="en", min_length=2, max_length=5)
    proration_date: Optional[int] = None


class BillingUpdatePaymentMethodBody(BaseModel):
    """Set a Stripe PaymentMethod from a confirmed SetupIntent as the subscription default."""
    payment_method_id: str = Field(..., min_length=3, max_length=255)


class CompleteProfileBody(BaseModel):
    """Google 用户补全资料：用户名、出生日期"""
    username: Optional[str] = Field(None, min_length=3, max_length=50)
    date_of_birth: Optional[date] = None
    country: Optional[str] = Field(None, min_length=2, max_length=2)  # ISO 3166-1 alpha-2


# ========== 认证相关 ==========
# Token / TokenData schemas removed: auth is cookie-only now and the body
# never carries the access token.


class GoogleTokenRequest(BaseModel):
    """Google 登录请求：前端传入 Google ID Token"""
    id_token: str = Field(..., min_length=1)
    remember_me: Optional[bool] = None


class SendVerificationCode(BaseModel):
    """发送验证码请求模型"""
    email: EmailStr
    language: Optional[str] = "zh"  # 语言：zh(中文) 或 en(英文)，默认中文


class ResetPassword(BaseModel):
    """重置密码请求模型"""
    email: EmailStr
    verification_code: str = Field(..., min_length=6, max_length=6)
    new_password: str = Field(..., min_length=6, max_length=100)


# ========== 游戏相关 ==========
class GameConfigBase(BaseModel):
    """游戏配置基础模型"""
    game_name: str
    game_display_name: str
    description: Optional[str] = None
    db_type: str
    db_host: str
    db_port: int
    db_name: str
    db_user: str
    db_password: str
    game_url: Optional[str] = None
    is_active: bool = True


class GameConfigResponse(BaseModel):
    """游戏配置响应模型"""
    id: int
    game_name: str
    game_display_name: str
    description: Optional[str]
    db_type: str
    game_url: Optional[str]
    is_active: bool
    created_at: datetime

    class Config:
        from_attributes = True


class GameAccessResponse(BaseModel):
    """游戏访问响应模型"""
    id: int
    game_id: int
    access_count: int
    last_access_at: Optional[datetime]
    first_access_at: datetime
    can_access: bool
    access_metadata: Dict[str, Any] = {}

    class Config:
        from_attributes = True


# ========== 用户奖励 / 签到 / 任务 / 认知分数 ==========
class RewardsState(BaseModel):
    """用户奖励与签到状态"""
    coins: int = 0
    diamonds: int = 0
    flowers: int = 0
    check_in_dates: list[str] = []  # 本月已签到日期 YYYY-MM-DD
    has_checked_in_today: bool = False
    current_streak: int = 0
    daily_progress: Dict[str, int] = {}  # task_id -> count (来自游戏)
    monthly_progress: int = 0  # 本月棋境之旅完成局数
    task_claimed_today: List[str] = []  # 今日已领取的 daily task_id
    monthly_claimed: bool = False
    played_game_count: int = 0  # distinct games from user_game_played only


class GamePlayRecordIn(BaseModel):
    """Report first-time play for dashboard Games Played (no reward side effects)."""

    game_key: str = Field(..., min_length=1, max_length=100)


class CognitiveScoresBody(BaseModel):
    """六维分数（单维或全量）"""
    memory: Optional[int] = None
    logic: Optional[int] = None
    focus: Optional[int] = None
    reaction: Optional[int] = None
    strategy: Optional[int] = None
    spatial: Optional[int] = None


class CognitiveScoresResponse(BaseModel):
    """六维分数响应"""
    memory: int = 0
    logic: int = 0
    focus: int = 0
    reaction: int = 0
    strategy: int = 0
    spatial: int = 0


class HomeSystemLoadoutBody(BaseModel):
    """Set or clear one home-system equipment slot."""

    slot: Literal["head", "body", "hand", "background", "limited"]
    item_id: Optional[str] = Field(None, min_length=1, max_length=100)


class LeaderboardEntry(BaseModel):
    """排行榜单项"""
    rank: int
    user_id: int
    username: str
    score: int


class AssessmentTopicStatIn(BaseModel):
    topic_key: str
    total: int = 0
    correct: int = 0
    accuracy: int = 0


class AssessmentAnswerIn(BaseModel):
    topic_key: str
    question_text: str
    user_answer: Optional[str] = None
    correct_answer: Optional[str] = None
    is_correct: bool = False
    is_timeout: bool = False
    time_spent_ms: int = 0


class AssessmentSessionCreate(BaseModel):
    subject: str = Field(..., min_length=1, max_length=50)
    started_at: datetime
    finished_at: datetime
    duration_seconds: int = 0
    total_questions: int = 0
    correct_count: int = 0
    accuracy: int = 0
    strongest_area: Optional[str] = None
    weakest_area: Optional[str] = None
    topic_stats: List[AssessmentTopicStatIn] = []
    answers: List[AssessmentAnswerIn] = []


class LearningQuestionAttemptCreate(BaseModel):
    subject_key: str = Field(..., min_length=1, max_length=64)
    module_key: str = Field(..., min_length=1, max_length=64)
    topic_key: str = Field(..., min_length=1, max_length=64)
    question_key: str = Field(..., min_length=1, max_length=128)
    total_questions: int = Field(0, ge=0)
    is_correct: bool = False
    user_answer: Optional[str] = Field(None, max_length=128)
    time_spent_seconds: int = Field(0, ge=0, le=86400)


class LearningTopicProgressReset(BaseModel):
    subject_key: str = Field(..., min_length=1, max_length=64)
    module_key: str = Field(..., min_length=1, max_length=64)
    topic_key: str = Field(..., min_length=1, max_length=64)
    total_questions: int = Field(0, ge=0)


class LearningStudyTimeCreate(BaseModel):
    subject_key: str = Field(..., min_length=1, max_length=64)
    duration_seconds: int = Field(..., ge=1, le=86400)


class LearningPracticeReportAnswerIn(BaseModel):
    topic_key: str = Field(..., min_length=1, max_length=64)
    question_text: str = Field(..., min_length=1, max_length=500)
    user_answer: Optional[str] = Field(None, max_length=128)
    correct_answer: Optional[str] = Field(None, max_length=128)
    is_correct: bool = False
    is_timeout: bool = False
    time_spent_ms: int = Field(0, ge=0, le=86_400_000)


class LearningPracticeReportUpsert(BaseModel):
    subject_key: str = Field(..., min_length=1, max_length=64)
    module_key: str = Field(..., min_length=1, max_length=64)
    topic_key: str = Field(..., min_length=1, max_length=64)
    accuracy: int = Field(0, ge=0, le=100)
    correct_count: int = Field(0, ge=0)
    total_questions: int = Field(0, ge=0)
    duration_seconds: int = Field(0, ge=0, le=86400)
    attempt_number: int = Field(1, ge=1)
    answers: List[LearningPracticeReportAnswerIn] = []


# ========== API 响应 ==========
class APIResponse(BaseModel):
    """通用 API 响应"""
    success: bool
    message: str
    data: Optional[Dict[str, Any]] = None
