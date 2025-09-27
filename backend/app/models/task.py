#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
任务数据模型定义

定义任务相关的 Pydantic 模型，用于数据验证和序列化
"""

from datetime import datetime
from typing import Optional, List
from pydantic import BaseModel, Field
from enum import Enum

class TaskPriority(str, Enum):
    """任务优先级枚举"""
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"

class RecurrenceFrequency(str, Enum):
    """重复频率枚举"""
    DAILY = "daily"
    WEEKLY = "weekly"
    MONTHLY = "monthly"
    YEARLY = "yearly"

class RecurrenceRule(BaseModel):
    """重复规则模型"""
    frequency: RecurrenceFrequency = Field(..., description="重复频率")
    interval: int = Field(1, ge=1, le=365, description="间隔数（如每2周的2）")
    days_of_week: Optional[List[int]] = Field(None, description="星期几（0=周一，6=周日），仅weekly时使用")
    day_of_month: Optional[int] = Field(None, ge=1, le=31, description="每月的第几天，仅monthly时使用")
    end_date: Optional[datetime] = Field(None, description="重复结束日期")
    count: Optional[int] = Field(None, ge=1, description="重复次数限制")

class TaskBase(BaseModel):
    """任务基础模型"""
    title: str = Field(..., min_length=1, max_length=200, description="任务标题")
    start: datetime = Field(..., description="开始时间（ISO 8601格式）")
    end: Optional[datetime] = Field(None, description="结束时间（ISO 8601格式，可选）")
    priority: Optional[TaskPriority] = Field(TaskPriority.MEDIUM, description="任务优先级")
    recurrence_rule: Optional[RecurrenceRule] = Field(None, description="重复规则（可选）")
    is_recurring: bool = Field(False, description="是否为重复任务")
    parent_task_id: Optional[str] = Field(None, description="父任务ID（用于重复任务实例）")

class TaskCreate(TaskBase):
    """创建任务请求模型"""
    pass

class TaskUpdate(BaseModel):
    """更新任务请求模型"""
    title: Optional[str] = Field(None, min_length=1, max_length=200, description="任务标题")
    start: Optional[datetime] = Field(None, description="开始时间（ISO 8601格式）")
    end: Optional[datetime] = Field(None, description="结束时间（ISO 8601格式）")
    priority: Optional[TaskPriority] = Field(None, description="任务优先级")

class Task(TaskBase):
    """完整任务模型（包含系统字段）"""
    id: str = Field(..., description="任务唯一标识符")
    created_at: datetime = Field(..., description="创建时间")
    updated_at: datetime = Field(..., description="更新时间")

    class Config:
        """Pydantic 配置"""
        json_encoders = {
            datetime: lambda v: v.isoformat()
        }

class TaskParseRequest(BaseModel):
    """自然语言任务解析请求模型"""
    text: str = Field(..., min_length=1, max_length=1000, description="用户输入的自然语言任务描述")

class TaskParseResponse(BaseModel):
    """自然语言任务解析响应模型"""
    success: bool = Field(..., description="解析是否成功")
    tasks: List[Task] = Field(default=[], description="解析出的任务列表")
    error: Optional[str] = Field(None, description="错误信息（解析失败时）")

class TaskListResponse(BaseModel):
    """任务列表响应模型"""
    tasks: List[Task] = Field(..., description="任务列表")
    total: int = Field(..., description="任务总数")

class TaskResponse(BaseModel):
    """单个任务响应模型"""
    task: Task = Field(..., description="任务详情")

class DeleteResponse(BaseModel):
    """删除操作响应模型"""
    success: bool = Field(..., description="删除是否成功")
    message: str = Field(..., description="操作结果消息")