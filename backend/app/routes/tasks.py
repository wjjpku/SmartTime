#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
任务管理路由

提供任务相关的 REST API 接口：
- POST /tasks/parse - 自然语言任务解析
- GET /tasks - 获取所有任务
- GET /tasks/{task_id} - 获取单个任务
- PUT /tasks/{task_id} - 更新任务
- DELETE /tasks/{task_id} - 删除任务
"""

from datetime import datetime, timedelta
from typing import List
from fastapi import APIRouter, HTTPException, Depends, status
from app.models import (
    Task, TaskCreate, TaskUpdate, TaskParseRequest, TaskParseResponse,
    TaskListResponse, TaskResponse, DeleteResponse, TaskDeleteRequest, TaskDeleteResponse,
    BatchDeleteRequest, BatchDeleteResponse
)
from app.services.task_service import TaskService
from app.services.deepseek_service import DeepSeekService
from app.services.reminder_service import ReminderService
from app.utils.config import get_settings
import logging

logger = logging.getLogger(__name__)

# 创建路由器
router = APIRouter()

# 初始化服务
task_service = TaskService()
deepseek_service = DeepSeekService(get_settings())
reminder_service = ReminderService()

@router.post("/tasks/parse", response_model=TaskParseResponse)
async def parse_tasks(request: TaskParseRequest):
    """
    自然语言任务解析接口
    
    将用户输入的自然语言描述解析为结构化的任务数据
    """
    try:
        # 调用 DeepSeek API 解析自然语言
        parsed_tasks = await deepseek_service.parse_tasks(request.text)
        
        # 保存解析出的任务到本地存储
        saved_tasks = []
        for task_data in parsed_tasks:
            task = await task_service.create_task(task_data)
            saved_tasks.append(task)
        
        return TaskParseResponse(
            success=True,
            tasks=saved_tasks
        )
    
    except Exception as e:
        return TaskParseResponse(
            success=False,
            tasks=[],
            error=str(e)
        )

@router.get("/tasks", response_model=TaskListResponse)
async def get_all_tasks():
    """
    获取所有任务列表
    """
    try:
        tasks = await task_service.get_all_tasks()
        return TaskListResponse(
            tasks=tasks,
            total=len(tasks)
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"获取任务列表失败: {str(e)}"
        )

@router.get("/tasks/{task_id}", response_model=TaskResponse)
async def get_task(task_id: str):
    """
    获取单个任务详情
    """
    try:
        task = await task_service.get_task_by_id(task_id)
        if not task:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"任务 {task_id} 不存在"
            )
        return TaskResponse(task=task)
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"获取任务失败: {str(e)}"
        )

@router.put("/tasks/{task_id}", response_model=TaskResponse)
async def update_task(task_id: str, task_update: TaskUpdate):
    """
    更新任务信息
    """
    try:
        # 检查任务是否存在
        existing_task = await task_service.get_task_by_id(task_id)
        if not existing_task:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"任务 {task_id} 不存在"
            )
        
        # 更新任务
        updated_task = await task_service.update_task(task_id, task_update)
        return TaskResponse(task=updated_task)
    
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"更新任务失败: {str(e)}"
        )

@router.delete("/tasks/{task_id}", response_model=DeleteResponse)
async def delete_task(task_id: str):
    """
    删除任务
    """
    try:
        # 检查任务是否存在
        existing_task = await task_service.get_task_by_id(task_id)
        if not existing_task:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"任务 {task_id} 不存在"
            )
        
        # 删除任务
        success = await task_service.delete_task(task_id)
        
        if success:
            return DeleteResponse(
                success=True,
                message=f"任务 {task_id} 删除成功"
            )
        else:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"删除任务 {task_id} 失败"
            )
    
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"删除任务失败: {str(e)}"
        )

@router.post("/tasks", response_model=TaskResponse)
async def create_task_direct(task: TaskCreate):
    """
    直接创建任务接口
    
    直接根据提供的任务数据创建任务，不进行自然语言解析
    """
    try:
        created_task = await task_service.create_task(task)
        return TaskResponse(task=created_task)
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"创建任务失败: {str(e)}"
        )

@router.delete("/by-description", response_model=TaskDeleteResponse)
async def delete_tasks_by_description(request: TaskDeleteRequest):
    """通过自然语言描述删除任务"""
    try:
        # 使用 DeepSeek 服务匹配并删除任务
        deleted_tasks = await deepseek_service.delete_tasks_by_description(request.description)
        
        return TaskDeleteResponse(
            success=True,
            deleted_count=len(deleted_tasks),
            deleted_tasks=deleted_tasks,
            message=f"成功删除 {len(deleted_tasks)} 个任务"
        )
    except Exception as e:
        logger.error(f"删除任务失败: {str(e)}")
        return TaskDeleteResponse(
            success=False,
            deleted_count=0,
            deleted_tasks=[],
            message="删除任务失败",
            error=str(e)
        )


@router.post("/tasks/delete/day", response_model=BatchDeleteResponse)
async def delete_tasks_by_day(request: BatchDeleteRequest):
    """删除指定日期的所有任务"""
    try:
        deleted_tasks = await task_service.delete_tasks_by_day(request.date)
        
        return BatchDeleteResponse(
            success=True,
            deleted_count=len(deleted_tasks),
            deleted_tasks=deleted_tasks,
            message=f"成功删除 {request.date.strftime('%Y年%m月%d日')} 的 {len(deleted_tasks)} 个任务"
        )
    except Exception as e:
        logger.error(f"删除当日任务失败: {str(e)}")
        return BatchDeleteResponse(
            success=False,
            deleted_count=0,
            deleted_tasks=[],
            message="删除当日任务失败",
            error=str(e)
        )


@router.post("/tasks/delete/week", response_model=BatchDeleteResponse)
async def delete_tasks_by_week(request: BatchDeleteRequest):
    """删除指定日期所在周的所有任务"""
    try:
        deleted_tasks = await task_service.delete_tasks_by_week(request.date)
        
        # 计算周的范围用于显示
        days_since_monday = request.date.weekday()
        start_of_week = request.date - timedelta(days=days_since_monday)
        end_of_week = start_of_week + timedelta(days=6)
        
        return BatchDeleteResponse(
            success=True,
            deleted_count=len(deleted_tasks),
            deleted_tasks=deleted_tasks,
            message=f"成功删除 {start_of_week.strftime('%m月%d日')} 至 {end_of_week.strftime('%m月%d日')} 本周的 {len(deleted_tasks)} 个任务"
        )
    except Exception as e:
        logger.error(f"删除本周任务失败: {str(e)}")
        return BatchDeleteResponse(
            success=False,
            deleted_count=0,
            deleted_tasks=[],
            message="删除本周任务失败",
            error=str(e)
        )


@router.post("/tasks/delete/month", response_model=BatchDeleteResponse)
async def delete_tasks_by_month(request: BatchDeleteRequest):
    """删除指定日期所在月的所有任务"""
    try:
        deleted_tasks = await task_service.delete_tasks_by_month(request.date)
        
        return BatchDeleteResponse(
            success=True,
            deleted_count=len(deleted_tasks),
            deleted_tasks=deleted_tasks,
            message=f"成功删除 {request.date.strftime('%Y年%m月')} 的 {len(deleted_tasks)} 个任务"
        )
    except Exception as e:
        logger.error(f"删除本月任务失败: {str(e)}")
        return BatchDeleteResponse(
            success=False,
            deleted_count=0,
            deleted_tasks=[],
            message="删除本月任务失败",
            error=str(e)
        )


@router.get("/tasks/reminders", response_model=TaskListResponse)
async def get_reminder_tasks():
    """获取需要提醒的任务"""
    try:
        # 获取所有任务
        all_tasks = await task_service.get_all_tasks()
        
        # 获取需要提醒的任务
        reminder_tasks = reminder_service.get_pending_reminders(all_tasks)
        
        return TaskListResponse(
            tasks=reminder_tasks,
            total=len(reminder_tasks)
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"获取提醒任务失败: {str(e)}"
        )


@router.get("/tasks/upcoming", response_model=TaskListResponse)
async def get_upcoming_tasks():
    """获取即将到来的任务"""
    try:
        # 获取所有任务
        all_tasks = await task_service.get_all_tasks()
        
        # 获取即将到来的任务
        upcoming_tasks = reminder_service.get_upcoming_reminders(all_tasks)
        
        return TaskListResponse(
            tasks=upcoming_tasks,
            total=len(upcoming_tasks)
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"获取即将到来的任务失败: {str(e)}"
        )