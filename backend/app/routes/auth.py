#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
认证相关路由
处理用户注册、登录等功能
"""

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from supabase import create_client, Client
import os
import logging

router = APIRouter()
logger = logging.getLogger(__name__)

# Supabase 配置
SUPABASE_URL = os.getenv('SUPABASE_URL')
SUPABASE_SERVICE_ROLE_KEY = os.getenv('SUPABASE_SERVICE_ROLE_KEY')

if not SUPABASE_URL or not SUPABASE_SERVICE_ROLE_KEY:
    logger.error("缺少 Supabase 配置")
    raise ValueError("缺少 Supabase 配置")

# 创建 Supabase 管理员客户端
supabase_admin: Client = create_client(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

class ConfirmEmailRequest(BaseModel):
    userId: str

@router.post("/confirm-email")
async def confirm_email(request: dict):
    """
    确认用户邮箱
    """
    import logging
    from datetime import datetime
    
    logger = logging.getLogger(__name__)
    timestamp = datetime.now().isoformat()
    
    try:
        user_id = request.get("userId")
        logger.info(f"[{timestamp}] 开始邮箱确认流程: userId={user_id}")
        
        if not user_id:
            logger.error(f"[{timestamp}] 邮箱确认失败: 缺少用户ID")
            raise HTTPException(status_code=400, detail="缺少用户ID")
        
        # 使用service role key直接更新用户的email_confirm状态
        logger.info(f"[{timestamp}] 调用Supabase Admin API更新用户邮箱确认状态: userId={user_id}")
        
        response = supabase_admin.auth.admin.update_user_by_id(
            user_id,
            {"email_confirm": True}
        )
        
        logger.info(f"[{timestamp}] Supabase Admin API响应: {response}")
        logger.info(f"[{timestamp}] 邮箱确认成功: userId={user_id}")
        
        return {"success": True, "message": "邮箱确认成功", "userId": user_id, "timestamp": timestamp}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"[{timestamp}] 邮箱确认过程中发生异常: userId={user_id}, error={str(e)}, type={type(e).__name__}")
        raise HTTPException(status_code=500, detail=f"邮箱确认失败: {str(e)}")