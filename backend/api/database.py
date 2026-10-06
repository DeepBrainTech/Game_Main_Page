"""
数据库连接和会话管理
"""
from sqlalchemy import bindparam, create_engine, text
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
import os
from dotenv import load_dotenv
from config.home_system import HOME_SYSTEM_HAND_ITEM_IDS

load_dotenv()

# 主数据库连接（用户认证数据库）
DATABASE_URL = os.getenv(
    "DATABASE_URL",
    "postgresql://postgres:postgres@localhost:5432/main_page_db"
)

# 创建数据库引擎
engine = create_engine(
    DATABASE_URL,
    pool_pre_ping=True,  # 自动重连
    pool_size=10,
    max_overflow=20
)

# 创建会话工厂
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

# 创建基础模型类
Base = declarative_base()


def get_db():
    """
    获取数据库会话（依赖注入）
    """
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def init_db():
    """
    初始化数据库（创建表 + 兼容旧表结构）
    """
    # 确保所有模型已注册到 Base（用于创建 user_rewards 等新表）
    import models  # noqa: F401
    Base.metadata.create_all(bind=engine)
    ensure_users_table_compatibility()


def ensure_users_table_compatibility():
    """
    向后兼容旧版 users 表结构。
    目前仅在 PostgreSQL 下自动补齐 Google 登录所需字段，避免旧库直接升级时报错。
    """
    if engine.dialect.name != "postgresql":
        return

    with engine.begin() as conn:
        # 兼容旧库：补齐 Google 登录字段
        conn.execute(text("ALTER TABLE users ADD COLUMN IF NOT EXISTS google_id VARCHAR(255)"))
        # 兼容旧库：允许 Google-only 用户密码为空
        conn.execute(text("ALTER TABLE users ALTER COLUMN hashed_password DROP NOT NULL"))
        # 为 google_id 添加唯一索引（NULL 不冲突）
        conn.execute(text("CREATE UNIQUE INDEX IF NOT EXISTS ix_users_google_id ON users (google_id)"))
        # 兼容旧库：出生日期，用于计算年龄
        conn.execute(text("ALTER TABLE users ADD COLUMN IF NOT EXISTS date_of_birth DATE"))
        # 兼容旧库：国家（ISO 3166-1 alpha-2）
        conn.execute(text("ALTER TABLE users ADD COLUMN IF NOT EXISTS country VARCHAR(2)"))
        # Backward compatibility: Google avatar and user-uploaded avatar fields
        conn.execute(text("ALTER TABLE users ADD COLUMN IF NOT EXISTS google_avatar_url VARCHAR(1024)"))
        conn.execute(text("ALTER TABLE users ADD COLUMN IF NOT EXISTS avatar_object_key VARCHAR(512)"))
        # 兼容旧库：统一资产账户新增鲜花字段
        conn.execute(text("ALTER TABLE user_rewards ADD COLUMN IF NOT EXISTS flowers INTEGER DEFAULT 0"))
        conn.execute(text("ALTER TABLE user_home_system_loadouts ADD COLUMN IF NOT EXISTS limited_item_id VARCHAR(100)"))
        conn.execute(text("ALTER TABLE user_home_system_loadouts ADD COLUMN IF NOT EXISTS hand_item_id VARCHAR(100)"))
        # Preserve existing ownership IDs while moving hand equipment out of the body slot.
        conn.execute(
            text("""
                UPDATE user_home_system_loadouts
                SET hand_item_id = COALESCE(hand_item_id, body_item_id), body_item_id = NULL
                WHERE body_item_id IN :hand_item_ids
            """).bindparams(bindparam("hand_item_ids", expanding=True)),
            {"hand_item_ids": HOME_SYSTEM_HAND_ITEM_IDS},
        )
        conn.execute(text("""
            CREATE TABLE IF NOT EXISTS game_likes (
                id SERIAL PRIMARY KEY,
                user_id INTEGER NOT NULL REFERENCES users(id),
                game_key VARCHAR(100) NOT NULL,
                created_at TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT NOW()
            )
        """))
        conn.execute(text(
            "CREATE UNIQUE INDEX IF NOT EXISTS ix_game_likes_user_game_key ON game_likes (user_id, game_key)"
        ))
        conn.execute(text("CREATE INDEX IF NOT EXISTS ix_game_likes_game_key ON game_likes (game_key)"))
        conn.execute(text("""
            CREATE TABLE IF NOT EXISTS user_game_played (
                id SERIAL PRIMARY KEY,
                user_id INTEGER NOT NULL REFERENCES users(id),
                game_key VARCHAR(100) NOT NULL,
                first_played_at TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT NOW()
            )
        """))
        conn.execute(
            text(
                "CREATE UNIQUE INDEX IF NOT EXISTS uq_user_game_played_game "
                "ON user_game_played (user_id, game_key)"
            )
        )
        conn.execute(text("CREATE INDEX IF NOT EXISTS ix_user_game_played_user_id ON user_game_played (user_id)"))
        # 兼容旧库：新增全局排行快照字段
        conn.execute(text("ALTER TABLE user_cognitive_scores ADD COLUMN IF NOT EXISTS previous_total_rank INTEGER"))
        conn.execute(text("ALTER TABLE users ADD COLUMN IF NOT EXISTS membership_plan VARCHAR(20) DEFAULT 'free'"))
        conn.execute(text("ALTER TABLE users ADD COLUMN IF NOT EXISTS membership_expires_at TIMESTAMP WITHOUT TIME ZONE"))
        conn.execute(text("ALTER TABLE users ADD COLUMN IF NOT EXISTS membership_billing_interval VARCHAR(10)"))
        conn.execute(text("ALTER TABLE users ADD COLUMN IF NOT EXISTS membership_pending_plan VARCHAR(20)"))
        conn.execute(text("ALTER TABLE users ADD COLUMN IF NOT EXISTS membership_pending_billing_interval VARCHAR(10)"))
        conn.execute(text("ALTER TABLE users ADD COLUMN IF NOT EXISTS membership_pending_effective_at TIMESTAMP WITHOUT TIME ZONE"))
        conn.execute(text("ALTER TABLE users ADD COLUMN IF NOT EXISTS stripe_customer_id VARCHAR(255)"))
        conn.execute(text("ALTER TABLE users ADD COLUMN IF NOT EXISTS stripe_subscription_id VARCHAR(255)"))
        conn.execute(text("ALTER TABLE users ADD COLUMN IF NOT EXISTS stripe_subscription_schedule_id VARCHAR(255)"))
        conn.execute(text("ALTER TABLE users ADD COLUMN IF NOT EXISTS membership_trial_used BOOLEAN NOT NULL DEFAULT FALSE"))
        conn.execute(
            text(
                "CREATE UNIQUE INDEX IF NOT EXISTS uq_users_stripe_subscription_id "
                "ON users (stripe_subscription_id) WHERE stripe_subscription_id IS NOT NULL"
            )
        )
        conn.execute(text("""
            CREATE TABLE IF NOT EXISTS stripe_checkout_fulfillments (
                id SERIAL PRIMARY KEY,
                stripe_session_id VARCHAR(255) NOT NULL UNIQUE,
                user_id INTEGER NOT NULL REFERENCES users(id),
                kind VARCHAR(50) NOT NULL,
                amount INTEGER NOT NULL DEFAULT 0,
                created_at TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT NOW()
            )
        """))
        conn.execute(
            text(
                "CREATE UNIQUE INDEX IF NOT EXISTS ix_stripe_checkout_fulfillments_session "
                "ON stripe_checkout_fulfillments (stripe_session_id)"
            )
        )
        conn.execute(text("CREATE INDEX IF NOT EXISTS ix_stripe_checkout_fulfillments_user_id ON stripe_checkout_fulfillments (user_id)"))
        conn.execute(text("""
            CREATE TABLE IF NOT EXISTS user_notifications (
                id SERIAL PRIMARY KEY,
                user_id INTEGER NOT NULL REFERENCES users(id),
                type VARCHAR(50) NOT NULL,
                title VARCHAR(120) NOT NULL,
                message TEXT NOT NULL,
                icon VARCHAR(50) NOT NULL,
                is_read BOOLEAN NOT NULL DEFAULT FALSE,
                source VARCHAR(50),
                source_event_id VARCHAR(255) UNIQUE,
                notification_metadata JSON,
                read_at TIMESTAMP WITHOUT TIME ZONE,
                created_at TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT NOW()
            )
        """))
        conn.execute(text("CREATE INDEX IF NOT EXISTS ix_user_notifications_user_id ON user_notifications (user_id)"))
        conn.execute(text("CREATE INDEX IF NOT EXISTS ix_user_notifications_type ON user_notifications (type)"))
        conn.execute(text("CREATE INDEX IF NOT EXISTS ix_user_notifications_is_read ON user_notifications (is_read)"))
        conn.execute(text("CREATE INDEX IF NOT EXISTS ix_user_notifications_created_at ON user_notifications (created_at)"))
        conn.execute(
            text(
                "CREATE UNIQUE INDEX IF NOT EXISTS ix_user_notifications_source_event_id "
                "ON user_notifications (source_event_id) WHERE source_event_id IS NOT NULL"
            )
        )
        conn.execute(
            text(
                "ALTER TABLE user_learning_question_progresses "
                "ADD COLUMN IF NOT EXISTS user_answer VARCHAR(128)"
            )
        )
        conn.execute(
            text(
                "ALTER TABLE user_learning_question_progresses "
                "ADD COLUMN IF NOT EXISTS time_spent_seconds INTEGER DEFAULT 0 NOT NULL"
            )
        )
        conn.execute(text("""
            CREATE TABLE IF NOT EXISTS user_learning_practice_reports (
                id SERIAL PRIMARY KEY,
                user_id INTEGER NOT NULL REFERENCES users(id),
                subject_key VARCHAR(64) NOT NULL,
                module_key VARCHAR(64) NOT NULL,
                topic_key VARCHAR(64) NOT NULL,
                accuracy INTEGER NOT NULL DEFAULT 0,
                correct_count INTEGER NOT NULL DEFAULT 0,
                total_questions INTEGER NOT NULL DEFAULT 0,
                duration_seconds INTEGER NOT NULL DEFAULT 0,
                attempt_number INTEGER NOT NULL DEFAULT 1,
                finished_at TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT NOW(),
                created_at TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT NOW(),
                updated_at TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT NOW()
            )
        """))
        conn.execute(
            text(
                "ALTER TABLE user_learning_practice_reports "
                "DROP CONSTRAINT IF EXISTS uq_user_learning_practice_report_scope"
            )
        )
        conn.execute(
            text(
                "DROP INDEX IF EXISTS uq_user_learning_practice_report_scope"
            )
        )
        conn.execute(
            text(
                "CREATE INDEX IF NOT EXISTS ix_user_learning_practice_report_scope_finished "
                "ON user_learning_practice_reports (user_id, subject_key, module_key, topic_key, finished_at DESC)"
            )
        )
        conn.execute(text("""
            CREATE TABLE IF NOT EXISTS user_learning_practice_report_answers (
                id SERIAL PRIMARY KEY,
                report_id INTEGER NOT NULL REFERENCES user_learning_practice_reports(id) ON DELETE CASCADE,
                topic_key VARCHAR(64) NOT NULL,
                question_text TEXT NOT NULL,
                user_answer VARCHAR(128),
                correct_answer VARCHAR(128),
                is_correct BOOLEAN NOT NULL DEFAULT FALSE,
                is_timeout BOOLEAN NOT NULL DEFAULT FALSE,
                time_spent_ms INTEGER NOT NULL DEFAULT 0,
                sort_order INTEGER NOT NULL DEFAULT 0
            )
        """))
        conn.execute(
            text(
                "CREATE INDEX IF NOT EXISTS ix_user_learning_practice_report_answers_report_id "
                "ON user_learning_practice_report_answers (report_id)"
            )
        )
