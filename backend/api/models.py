"""
数据库模型
若已有 users 表，需先执行迁移再启用 Google 登录：
  PostgreSQL: ALTER TABLE users ADD COLUMN IF NOT EXISTS google_id VARCHAR(255) UNIQUE;
              ALTER TABLE users ALTER COLUMN hashed_password DROP NOT NULL;
              ALTER TABLE users ADD COLUMN IF NOT EXISTS membership_trial_used BOOLEAN NOT NULL DEFAULT FALSE;
  MySQL:      ALTER TABLE users ADD COLUMN google_id VARCHAR(255) UNIQUE; ALTER TABLE users MODIFY hashed_password VARCHAR(255) NULL;
              ALTER TABLE users ADD COLUMN membership_trial_used TINYINT(1) NOT NULL DEFAULT 0;
"""
from sqlalchemy import Column, Integer, String, Boolean, DateTime, Date, Text, ForeignKey, JSON, UniqueConstraint, Index
from sqlalchemy.orm import relationship
from datetime import datetime
from database import Base


class User(Base):
    """用户模型"""
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    username = Column(String(50), unique=True, index=True, nullable=False)
    email = Column(String(100), unique=True, index=True, nullable=False)
    hashed_password = Column(String(255), nullable=True)  # Google 登录用户可为空
    google_id = Column(String(255), unique=True, index=True, nullable=True)  # Google 唯一标识
    google_avatar_url = Column(String(1024), nullable=True)  # Google profile image URL
    avatar_object_key = Column(String(512), nullable=True)  # User-uploaded avatar object key
    date_of_birth = Column(Date, nullable=True)  # 出生日期，用于计算年龄
    country = Column(String(2), nullable=True)  # ISO 3166-1 alpha-2 country code
    is_active = Column(Boolean, default=True)
    is_superuser = Column(Boolean, default=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    # Membership for portal (learning premium gate, etc.); persisted server-side.
    membership_plan = Column(String(20), default="free", nullable=False)
    membership_expires_at = Column(DateTime, nullable=True)
    # Last chosen billing cadence for paid tiers: "monthly" | "annual" (UI / renewals).
    membership_billing_interval = Column(String(10), nullable=True)
    membership_pending_plan = Column(String(20), nullable=True)
    membership_pending_billing_interval = Column(String(10), nullable=True)
    membership_pending_effective_at = Column(DateTime, nullable=True)
    stripe_customer_id = Column(String(255), nullable=True, index=True)
    stripe_subscription_id = Column(String(255), nullable=True, index=True)
    stripe_subscription_schedule_id = Column(String(255), nullable=True)
    # True after any paid subscription or trial; one lifetime trial per account.
    membership_trial_used = Column(Boolean, default=False, nullable=False)

    # 关联游戏访问记录
    game_accesses = relationship("GameAccess", back_populates="user")
    game_rewards = relationship("UserGameReward", back_populates="user")
    game_likes = relationship("GameLike", back_populates="user")
    games_played = relationship("UserGamePlayed", back_populates="user")
    notifications = relationship("UserNotification", back_populates="user")


class UserNotification(Base):
    """Per-user notification feed for billing and purchase events."""

    __tablename__ = "user_notifications"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    type = Column(String(50), nullable=False, index=True)
    title = Column(String(120), nullable=False)
    message = Column(Text, nullable=False)
    icon = Column(String(50), nullable=False)
    is_read = Column(Boolean, default=False, nullable=False, index=True)
    source = Column(String(50), nullable=True)
    source_event_id = Column(String(255), unique=True, nullable=True, index=True)
    notification_metadata = Column(JSON, default=dict)
    read_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False, index=True)

    user = relationship("User", back_populates="notifications")


class GameConfig(Base):
    """游戏配置模型 - 存储各个游戏数据库的连接信息"""
    __tablename__ = "game_configs"

    id = Column(Integer, primary_key=True, index=True)
    game_name = Column(String(100), unique=True, index=True, nullable=False)
    game_display_name = Column(String(200), nullable=False)
    description = Column(Text)
    
    # 数据库连接配置（加密存储）
    db_type = Column(String(50), nullable=False)  # postgresql, mysql, mongodb, etc.
    db_host = Column(String(200), nullable=False)
    db_port = Column(Integer, nullable=False)
    db_name = Column(String(100), nullable=False)
    db_user = Column(String(100), nullable=False)
    db_password = Column(String(255), nullable=False)  # 实际应用中应该加密
    
    # 游戏访问URL
    game_url = Column(String(500))
    
    # 是否启用
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # 关联游戏访问记录
    game_accesses = relationship("GameAccess", back_populates="game")


class GameAccess(Base):
    """游戏访问记录 - 记录用户对游戏的访问情况"""
    __tablename__ = "game_accesses"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    game_id = Column(Integer, ForeignKey("game_configs.id"), nullable=False)
    
    # 访问统计
    access_count = Column(Integer, default=0)
    last_access_at = Column(DateTime)
    first_access_at = Column(DateTime, default=datetime.utcnow)
    
    # 权限相关
    can_access = Column(Boolean, default=True)
    
    # 扩展数据（存储游戏特定的用户数据）
    access_metadata = Column(JSON, default=dict)

    # 关系
    user = relationship("User", back_populates="game_accesses")
    game = relationship("GameConfig", back_populates="game_accesses")


class UserGameReward(Base):
    """用户-游戏每日奖励记录（按游戏模式）"""
    __tablename__ = "user_game_rewards"
    __table_args__ = (
        UniqueConstraint("user_id", "game_mode", name="uq_user_game_mode_reward"),
    )

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    game_mode = Column(String(50), nullable=False, index=True)

    click_count = Column(Integer, default=0)
    flowers_earned = Column(Integer, default=0)
    last_played_at = Column(DateTime)
    last_claimed_at = Column(DateTime)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    user = relationship("User", back_populates="game_rewards")


class UserGamePlayByDay(Base):
    """用户按日游戏打开次数（用于每日/每月任务进度：当天点开即计一次）"""
    __tablename__ = "user_game_play_by_day"
    __table_args__ = (
        UniqueConstraint("user_id", "game_mode", "play_date", name="uq_user_game_play_date"),
    )

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    game_mode = Column(String(50), nullable=False, index=True)
    play_date = Column(String(10), nullable=False, index=True)  # YYYY-MM-DD 用户当地日期
    count = Column(Integer, default=0, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class GameLike(Base):
    __tablename__ = "game_likes"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    game_key = Column(String(100), nullable=False, index=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    user = relationship("User", back_populates="game_likes")


class UserGamePlayed(Base):
    """Distinct games the user ever opened from the portal (not tied to rewards)."""

    __tablename__ = "user_game_played"
    __table_args__ = (UniqueConstraint("user_id", "game_key", name="uq_user_game_played_game"),)

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    game_key = Column(String(100), nullable=False, index=True)
    first_played_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    user = relationship("User", back_populates="games_played")


class UserRewards(Base):
    """用户金币/钻石/鲜花与签到、任务领取状态"""
    __tablename__ = "user_rewards"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, unique=True, index=True)
    coins = Column(Integer, default=0)
    diamonds = Column(Integer, default=0)
    flowers = Column(Integer, default=0)
    last_streak_award_start = Column(String(10), nullable=True)  # 最近一次 7 日连续签到发钻石的起始日 YYYY-MM-DD
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class StripeCheckoutFulfillment(Base):
    """Idempotency record for completed one-time Stripe Checkout sessions."""
    __tablename__ = "stripe_checkout_fulfillments"

    id = Column(Integer, primary_key=True, index=True)
    stripe_session_id = Column(String(255), unique=True, nullable=False, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    kind = Column(String(50), nullable=False)
    amount = Column(Integer, default=0, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)


class UserCheckIn(Base):
    """用户签到记录（按日）"""
    __tablename__ = "user_check_ins"
    __table_args__ = (UniqueConstraint("user_id", "check_in_date", name="uq_user_check_in_date"),)

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    check_in_date = Column(String(10), nullable=False, index=True)  # YYYY-MM-DD
    created_at = Column(DateTime, default=datetime.utcnow)


class UserTaskClaim(Base):
    """用户任务领取记录（防止重复领取）"""
    __tablename__ = "user_task_claims"
    __table_args__ = (UniqueConstraint("user_id", "task_id", "claimed_date", name="uq_user_task_claimed"),)

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    task_id = Column(String(50), nullable=False, index=True)
    claimed_date = Column(String(10), nullable=False, index=True)  # YYYY-MM-DD 或 YYYY-MM 每月任务
    created_at = Column(DateTime, default=datetime.utcnow)


class UserItemInventory(Base):
    """用户道具背包（用于兑换后的道具持有量）"""
    __tablename__ = "user_item_inventories"
    __table_args__ = (UniqueConstraint("user_id", "item_id", name="uq_user_item_inventory"),)

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    item_id = Column(String(100), nullable=False, index=True)
    quantity = Column(Integer, default=0, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    created_at = Column(DateTime, default=datetime.utcnow)


class UserHomeSystemInventory(Base):
    """Permanent cosmetic ownership for the home-system avatar."""

    __tablename__ = "user_home_system_inventories"
    __table_args__ = (UniqueConstraint("user_id", "item_id", name="uq_user_home_system_item"),)

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    item_id = Column(String(100), nullable=False, index=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)


class UserHomeSystemLoadout(Base):
    """The currently equipped home-system cosmetic IDs."""

    __tablename__ = "user_home_system_loadouts"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, unique=True, index=True)
    head_item_id = Column(String(100), nullable=True)
    body_item_id = Column(String(100), nullable=True)
    hand_item_id = Column(String(100), nullable=True)
    background_item_id = Column(String(100), nullable=True)
    limited_item_id = Column(String(100), nullable=True)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)


class UserCognitiveScores(Base):
    """用户六维认知分数（雷达图）"""
    __tablename__ = "user_cognitive_scores"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, unique=True, index=True)
    memory = Column(Integer, default=0)
    logic = Column(Integer, default=0)
    focus = Column(Integer, default=0)
    reaction = Column(Integer, default=0)
    strategy = Column(Integer, default=0)
    spatial = Column(Integer, default=0)
    previous_total_rank = Column(Integer, nullable=True)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class UserAssessmentSession(Base):
    __tablename__ = "user_assessment_sessions"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    subject = Column(String(50), nullable=False, index=True)
    started_at = Column(DateTime, nullable=False)
    finished_at = Column(DateTime, nullable=False)
    duration_seconds = Column(Integer, default=0, nullable=False)
    total_questions = Column(Integer, default=0, nullable=False)
    correct_count = Column(Integer, default=0, nullable=False)
    accuracy = Column(Integer, default=0, nullable=False)
    strongest_area = Column(String(100), nullable=True)
    weakest_area = Column(String(100), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)


class UserAssessmentTopicStat(Base):
    __tablename__ = "user_assessment_topic_stats"
    __table_args__ = (
        UniqueConstraint("session_id", "topic_key", name="uq_assessment_session_topic"),
    )

    id = Column(Integer, primary_key=True, index=True)
    session_id = Column(Integer, ForeignKey("user_assessment_sessions.id"), nullable=False, index=True)
    topic_key = Column(String(120), nullable=False, index=True)
    total = Column(Integer, default=0, nullable=False)
    correct = Column(Integer, default=0, nullable=False)
    accuracy = Column(Integer, default=0, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)


class UserCourseEntitlement(Base):
    """
    Per-user per-course paid access (diamond unlock tiers). Keys align with config/learning_commerce.py.
    Site-wide Premium for learning uses User.membership_plan instead.
    """

    __tablename__ = "user_course_entitlements"
    __table_args__ = (
        UniqueConstraint("user_id", "course_key", name="uq_user_course_entitlement"),
    )

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    course_key = Column(String(64), nullable=False, index=True)
    diamond_tier = Column(String(20), nullable=True)  # three_month | lifetime
    expires_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class UserAssessmentAnswer(Base):
    __tablename__ = "user_assessment_answers"

    id = Column(Integer, primary_key=True, index=True)
    session_id = Column(Integer, ForeignKey("user_assessment_sessions.id"), nullable=False, index=True)
    topic_key = Column(String(120), nullable=False, index=True)
    question_text = Column(Text, nullable=False)
    user_answer = Column(String(50), nullable=True)
    correct_answer = Column(String(50), nullable=True)
    is_correct = Column(Boolean, default=False, nullable=False)
    is_timeout = Column(Boolean, default=False, nullable=False)
    time_spent_ms = Column(Integer, default=0, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)


class UserLearningTopicProgress(Base):
    """Per-user learning progress aggregate in a topic scope."""
    __tablename__ = "user_learning_topic_progresses"
    __table_args__ = (
        UniqueConstraint(
            "user_id",
            "subject_key",
            "module_key",
            "topic_key",
            name="uq_user_learning_topic_progress_scope",
        ),
    )

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    subject_key = Column(String(64), nullable=False, index=True)
    module_key = Column(String(64), nullable=False, index=True)
    topic_key = Column(String(64), nullable=False, index=True)
    total_questions = Column(Integer, default=0, nullable=False)
    attempted_unique_questions = Column(Integer, default=0, nullable=False)
    correct_unique_questions = Column(Integer, default=0, nullable=False)
    progress_percent_attempted = Column(Integer, default=0, nullable=False)
    progress_percent_correct = Column(Integer, default=0, nullable=False)
    last_attempted_question_key = Column(String(128), nullable=True)
    last_attempted_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class UserLearningQuestionProgress(Base):
    """Per-user per-question progress in learning scopes."""
    __tablename__ = "user_learning_question_progresses"
    __table_args__ = (
        UniqueConstraint(
            "user_id",
            "subject_key",
            "module_key",
            "topic_key",
            "question_key",
            name="uq_user_learning_question_progress_unique",
        ),
    )

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    subject_key = Column(String(64), nullable=False, index=True)
    module_key = Column(String(64), nullable=False, index=True)
    topic_key = Column(String(64), nullable=False, index=True)
    question_key = Column(String(128), nullable=False, index=True)
    attempt_count = Column(Integer, default=1, nullable=False)
    is_correct_latest = Column(Boolean, default=False, nullable=False)
    is_correct_ever = Column(Boolean, default=False, nullable=False)
    user_answer = Column(String(128), nullable=True)
    time_spent_seconds = Column(Integer, default=0, nullable=False)
    first_attempted_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    last_attempted_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class UserLearningStudyTime(Base):
    """Per-user aggregate study time in a learning subject."""
    __tablename__ = "user_learning_study_times"
    __table_args__ = (
        UniqueConstraint(
            "user_id",
            "subject_key",
            name="uq_user_learning_study_time_subject",
        ),
    )

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    subject_key = Column(String(64), nullable=False, index=True)
    total_seconds = Column(Integer, default=0, nullable=False)
    last_recorded_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class UserLearningPracticeReport(Base):
    """Saved practice report snapshots for a learning topic (multiple per topic)."""
    __tablename__ = "user_learning_practice_reports"
    __table_args__ = (
        Index(
            "ix_user_learning_practice_report_scope_finished",
            "user_id",
            "subject_key",
            "module_key",
            "topic_key",
            "finished_at",
        ),
    )

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    subject_key = Column(String(64), nullable=False, index=True)
    module_key = Column(String(64), nullable=False, index=True)
    topic_key = Column(String(64), nullable=False, index=True)
    accuracy = Column(Integer, default=0, nullable=False)
    correct_count = Column(Integer, default=0, nullable=False)
    total_questions = Column(Integer, default=0, nullable=False)
    duration_seconds = Column(Integer, default=0, nullable=False)
    attempt_number = Column(Integer, default=1, nullable=False)
    finished_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    answers = relationship(
        "UserLearningPracticeReportAnswer",
        back_populates="report",
        cascade="all, delete-orphan",
    )


class UserLearningPracticeReportAnswer(Base):
    """Answer rows for a saved practice report."""
    __tablename__ = "user_learning_practice_report_answers"

    id = Column(Integer, primary_key=True, index=True)
    report_id = Column(Integer, ForeignKey("user_learning_practice_reports.id"), nullable=False, index=True)
    topic_key = Column(String(64), nullable=False)
    question_text = Column(Text, nullable=False)
    user_answer = Column(String(128), nullable=True)
    correct_answer = Column(String(128), nullable=True)
    is_correct = Column(Boolean, default=False, nullable=False)
    is_timeout = Column(Boolean, default=False, nullable=False)
    time_spent_ms = Column(Integer, default=0, nullable=False)
    sort_order = Column(Integer, default=0, nullable=False)
    report = relationship("UserLearningPracticeReport", back_populates="answers")
