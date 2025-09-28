#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
SmartTime - FastAPI 后端主入口

提供任务管理的 REST API 接口，包括：
- 自然语言任务解析（集成 DeepSeek-v3 API）
- 任务 CRUD 操作
- 本地 JSON 文件存储
"""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.routes import tasks, schedule, auth
from app.services.async_task_queue import task_queue
import logging
import asyncio

# 配置日志
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)

logger = logging.getLogger(__name__)

# 创建 FastAPI 应用实例
app = FastAPI(
    title="SmartTime API",
    description="智能时间管理系统后端 API",
    version="1.0.0"
)

@app.on_event("startup")
async def startup_event():
    """应用启动时的事件处理"""
    logger.info("正在启动 SmartTime API...")
    # 启动异步任务队列
    await task_queue.start()
    logger.info("异步任务队列已启动")

@app.on_event("shutdown")
async def shutdown_event():
    """应用关闭时的事件处理"""
    logger.info("正在关闭 SmartTime API...")
    # 停止异步任务队列
    await task_queue.stop()
    logger.info("异步任务队列已停止")

# 配置 CORS 中间件，允许前端跨域访问
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173", 
        "http://127.0.0.1:5173",  # 本地开发
        "https://traedduqw5r8-wjjpku-justin-wus-projects-e244beee.vercel.app",  # Vercel 部署域名
        "https://*.vercel.app"  # 所有 Vercel 域名
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# 注册路由
app.include_router(tasks.router, prefix="/api", tags=["tasks"])
app.include_router(schedule.router, prefix="/api", tags=["schedule"])
app.include_router(auth.router, prefix="/api/auth", tags=["auth"])

# 根路径健康检查
@app.get("/")
async def root():
    """API 健康检查接口"""
    return {
        "message": "SmartTime API 服务正常运行",
        "version": "1.0.0",
        "status": "healthy"
    }

# 健康检查接口
@app.get("/health")
async def health_check():
    """详细健康检查接口"""
    return {
        "status": "healthy",
        "service": "SmartTime",
        "version": "1.0.0"
    }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        "main:app",
        host="0.0.0.0",
        port=8000,
        reload=True,
        log_level="info"
    )