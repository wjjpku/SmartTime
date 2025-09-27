#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
认证相关路由
处理用户注册、登录等功能
"""

from fastapi import APIRouter

router = APIRouter()

# 验证码相关功能已移除
# 注册流程已简化，不再需要邮箱验证