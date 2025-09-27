#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
配置管理

负责应用配置的加载和管理
"""

import os
from pathlib import Path
from functools import lru_cache
from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    """应用配置类"""
    
    # 应用基本配置
    app_name: str = "SmartTime"
    app_version: str = "1.0.0"
    debug: bool = False
    
    # API 配置
    api_host: str = "0.0.0.0"
    api_port: int = 8000
    api_prefix: str = "/api"
    
    # CORS 配置
    cors_origins: list = ["http://localhost:3000", "http://localhost:5173"]
    cors_methods: list = ["GET", "POST", "PUT", "DELETE", "OPTIONS"]
    cors_headers: list = ["*"]
    
    # DeepSeek API 配置
    deepseek_api_key: str = ""
    deepseek_api_url: str = "https://api.deepseek.com/v1/chat/completions"
    deepseek_model: str = "deepseek-chat"
    
    # Supabase 配置
    supabase_url: str = ""
    supabase_anon_key: str = ""
    supabase_service_role_key: str = ""
    supabase_jwt_secret: str = ""
    
    # JWT 配置
    jwt_secret_key: str = "your-jwt-secret-key"
    jwt_algorithm: str = "HS256"
    jwt_expire_minutes: int = 30
    
    # 数据存储配置
    data_dir: str = "data"
    tasks_file: str = "tasks.json"
    
    # 日志配置
    log_level: str = "INFO"
    log_format: str = "%(asctime)s - %(name)s - %(levelname)s - %(message)s"
    
    class Config:
        """Pydantic 配置"""
        # 使用绝对路径确保能找到.env文件
        env_file = Path(__file__).parent.parent.parent / ".env"
        env_file_encoding = "utf-8"
        case_sensitive = False

@lru_cache()
def get_settings() -> Settings:
    """获取应用配置（单例模式）"""
    return Settings()

def get_data_file_path(filename: str) -> str:
    """获取数据文件的完整路径"""
    settings = get_settings()
    data_dir = settings.data_dir
    
    # 确保数据目录存在
    os.makedirs(data_dir, exist_ok=True)
    
    return os.path.join(data_dir, filename)