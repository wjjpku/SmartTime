#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
智能任务管理系统 - FastAPI 后端主入口

提供任务管理的 REST API 接口，包括：
- 自然语言任务解析（集成 DeepSeek-v3 API）
- 任务 CRUD 操作
- 本地 JSON 文件存储
"""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.routes import tasks, schedule

# 创建 FastAPI 应用实例
app = FastAPI(
    title="智能任务管理系统 API",
    description="基于自然语言处理的任务管理系统后端服务",
    version="1.0.0",
    docs_url="/docs",
    redoc_url="/redoc"
)

# 配置 CORS 中间件，允许前端跨域访问
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],  # Vite 默认端口
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# 注册路由
app.include_router(tasks.router, prefix="/api", tags=["tasks"])
app.include_router(schedule.router, prefix="/api", tags=["schedule"])

# 根路径健康检查
@app.get("/")
async def root():
    """API 健康检查接口"""
    return {
        "message": "智能任务管理系统 API 服务正常运行",
        "version": "1.0.0",
        "status": "healthy"
    }

# 健康检查接口
@app.get("/health")
async def health_check():
    """详细健康检查接口"""
    return {
        "status": "healthy",
        "service": "智能任务管理系统",
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