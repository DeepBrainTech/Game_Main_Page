from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv
import os

# 加载环境变量
load_dotenv()

# 导入路由
from routes import auth, games
from database import init_db

# 创建 FastAPI 应用实例
app = FastAPI(
    title="Main Page API",
    description="主页面后端 API - DeepBrain Tech",
    version="1.0.0"
)

# 配置 CORS - 允许前端访问
# 从环境变量读取允许的源，支持 Docker 环境
cors_origins_str = os.getenv(
    "CORS_ORIGINS",
    "http://localhost:3000,http://127.0.0.1:3000"
)
cors_regex = os.getenv("CORS_ORIGIN_REGEX", "")
# 清理并分割 origins
cors_origins = [origin.strip() for origin in cors_origins_str.split(",") if origin.strip()]

# 添加更多开发环境常见的前端地址
if "http://localhost:3000" not in cors_origins:
    cors_origins.append("http://localhost:3000")
if "http://127.0.0.1:3000" not in cors_origins:
    cors_origins.append("http://127.0.0.1:3000")

app.add_middleware(
    CORSMiddleware,
    allow_origins=cors_origins,
    allow_origin_regex=cors_regex if cors_regex else None,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["*"],
)

# 注册路由
app.include_router(auth.router)
app.include_router(games.router)


@app.on_event("startup")
async def startup_event():
    """应用启动时初始化数据库"""
    try:
        init_db()
        print("数据库初始化成功")
    except Exception as e:
        print(f"数据库初始化失败: {str(e)}")


@app.get("/")
async def root():
    """根路径 - 健康检查"""
    return {
        "message": "欢迎使用 DeepBrain Tech API",
        "status": "running",
        "version": "1.0.0"
    }


@app.get("/api/health")
async def health_check():
    """健康检查端点"""
    return {
        "status": "healthy",
        "service": "main-page-api"
    }
