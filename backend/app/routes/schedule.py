#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
智能日程安排路由

提供智能日程安排相关的 REST API 接口：
- POST /schedule/analyze - 分析工作描述并推荐时间段
- POST /schedule/confirm - 确认选定时机并创建任务
"""

from typing import List
from fastapi import APIRouter, HTTPException, status
from app.models.task import (
    ScheduleAnalyzeRequest,
    ScheduleAnalyzeResponse,
    ScheduleConfirmRequest,
    ScheduleConfirmResponse,
    WorkInfo,
    TimeSlot
)
from app.services.task_service import TaskService
from app.services.deepseek_service import DeepSeekService
from app.utils.config import get_settings

# 创建路由器
router = APIRouter()

# 初始化服务
task_service = TaskService()
deepseek_service = DeepSeekService(get_settings())

@router.post("/schedule/analyze", response_model=ScheduleAnalyzeResponse)
async def analyze_schedule(request: ScheduleAnalyzeRequest):
    """
    智能日程分析接口
    
    分析工作描述，考虑现有日程，推荐最佳的时间安排
    """
    try:
        # 获取现有任务列表
        existing_tasks = await task_service.get_all_tasks()
        
        # 转换为字典格式，便于 DeepSeek 服务处理
        existing_tasks_dict = []
        for task in existing_tasks:
            task_dict = {
                'id': task.id,
                'title': task.title,
                'start': task.start.isoformat() if task.start else '',
                'end': task.end.isoformat() if task.end else '',
                'priority': task.priority.value if task.priority else 'medium'
            }
            existing_tasks_dict.append(task_dict)
        
        # 调用 DeepSeek 服务进行智能分析
        work_info, time_slots = await deepseek_service.analyze_schedule(request.description, existing_tasks_dict)
        
        return ScheduleAnalyzeResponse(
            success=True,
            work_info=work_info,
            recommendations=time_slots
        )
    
    except Exception as e:
        return ScheduleAnalyzeResponse(
            success=False,
            work_info=None,
            recommendations=[],
            error=str(e)
        )

@router.post("/schedule/confirm", response_model=ScheduleConfirmResponse)
async def confirm_schedule(request: ScheduleConfirmRequest):
    """
    确认日程安排接口
    
    确认用户选定的时间段，创建对应的任务
    """
    try:
        # 根据选定的时间段和工作信息创建任务
        from app.models import TaskCreate, TaskPriority
        from datetime import datetime
        
        # 创建任务数据
        task_create = TaskCreate(
            title=request.work_info.title,
            start=request.selected_slot.start,
            end=request.selected_slot.end,
            priority=TaskPriority.MEDIUM,
            is_recurring=False,
            recurrence_rule=None
        )
        
        # 创建任务
        created_task = await task_service.create_task(task_create)
        
        return ScheduleConfirmResponse(
            success=True,
            task=created_task
        )
    
    except Exception as e:
        return ScheduleConfirmResponse(
            success=False,
            task=None,
            error=str(e)
        )