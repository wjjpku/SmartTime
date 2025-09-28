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
from fastapi import APIRouter, HTTPException, Depends, status, Query
from app.models import (
    Task, TaskCreate, TaskUpdate, TaskParseRequest, TaskParseResponse,
    TaskListResponse, TaskResponse, DeleteResponse, TaskDeleteRequest, TaskDeleteResponse,
    BatchDeleteRequest, BatchDeleteResponse, BatchCreateRequest, BatchCreateResponse,
    BatchUpdateRequest, BatchUpdateResponse
)
from app.services.task_service import TaskService
from app.services.deepseek_service import DeepSeekService
from app.services.reminder_service import ReminderService
from app.services.async_task_queue import task_queue, TaskStatus
from app.middleware.auth import get_current_user_id
from app.utils.config import get_settings
import logging

logger = logging.getLogger(__name__)

# 创建路由器
router = APIRouter()

# 初始化服务
task_service = TaskService()
deepseek_service = DeepSeekService(get_settings())
reminder_service = ReminderService()

async def _process_task_parsing(text: str, user_id: str):
    """
    异步处理任务解析的内部函数
    """
    try:
        # 调用 DeepSeek API 解析自然语言
        parsed_tasks = await deepseek_service.parse_tasks(text)
        
        # 保存解析出的任务到本地存储
        saved_tasks = []
        for task_data in parsed_tasks:
            task = await task_service.create_task(task_data, user_id)
            saved_tasks.append(task)
        
        return {
            "success": True,
            "tasks": [task.dict() for task in saved_tasks]
        }
    
    except Exception as e:
        return {
            "success": False,
            "tasks": [],
            "error": str(e)
        }

@router.post("/tasks/parse", response_model=TaskParseResponse)
async def parse_tasks(request: TaskParseRequest, user_id: str = Depends(get_current_user_id)):
    """
    自然语言任务解析接口（同步版本）
    
    将用户输入的自然语言描述解析为结构化的任务数据
    """
    try:
        # 调用 DeepSeek API 解析自然语言
        parsed_tasks = await deepseek_service.parse_tasks(request.text)
        
        # 保存解析出的任务到本地存储
        saved_tasks = []
        for task_data in parsed_tasks:
            task = await task_service.create_task(task_data, user_id)
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

@router.post("/tasks/parse/async")
async def parse_tasks_async(request: TaskParseRequest, user_id: str = Depends(get_current_user_id)):
    """
    异步任务解析接口
    
    将任务解析请求提交到队列，立即返回任务ID，客户端可以轮询状态
    """
    try:
        # 提交任务到异步队列
        task_id = task_queue.submit_task(
            _process_task_parsing,
            request.text,
            user_id
        )
        
        return {
            "success": True,
            "task_id": task_id,
            "message": "任务已提交到处理队列"
        }
    
    except Exception as e:
        return {
            "success": False,
            "error": str(e)
        }

@router.get("/tasks/async/{task_id}/status")
async def get_async_task_status(task_id: str, user_id: str = Depends(get_current_user_id)):
    """
    获取异步任务状态
    """
    try:
        status_info = task_queue.get_task_status(task_id)
        if not status_info:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"任务 {task_id} 不存在"
            )
        
        return status_info
    
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"获取任务状态失败: {str(e)}"
        )

@router.get("/tasks", response_model=TaskListResponse)
async def get_all_tasks(user_id: str = Depends(get_current_user_id)):
    """
    获取当前用户的所有任务列表
    """
    try:
        tasks = await task_service.get_all_tasks(user_id)
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
async def get_task(task_id: str, user_id: str = Depends(get_current_user_id)):
    """
    获取单个任务详情
    """
    try:
        task = await task_service.get_task_by_id(task_id, user_id)
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
async def update_task(task_id: str, task_update: TaskUpdate, user_id: str = Depends(get_current_user_id)):
    """
    更新任务信息
    """
    try:
        # 检查任务是否存在
        existing_task = await task_service.get_task_by_id(task_id, user_id)
        if not existing_task:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"任务 {task_id} 不存在"
            )
        
        # 更新任务
        updated_task = await task_service.update_task(task_id, task_update, user_id)
        return TaskResponse(task=updated_task)
    
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"更新任务失败: {str(e)}"
        )

@router.delete("/tasks/{task_id}", response_model=DeleteResponse)
async def delete_task(task_id: str, user_id: str = Depends(get_current_user_id)):
    """
    删除任务
    """
    try:
        # 检查任务是否存在
        existing_task = await task_service.get_task_by_id(task_id, user_id)
        if not existing_task:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"任务 {task_id} 不存在"
            )
        
        # 删除任务
        success = await task_service.delete_task(task_id, user_id)
        
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
async def create_task_direct(task: TaskCreate, user_id: str = Depends(get_current_user_id)):
    """
    直接创建任务接口
    
    直接根据提供的任务数据创建任务，不进行自然语言解析
    """
    try:
        created_task = await task_service.create_task(task, user_id)
        return TaskResponse(task=created_task)
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"创建任务失败: {str(e)}"
        )

@router.delete("/tasks/description/{description}", response_model=TaskResponse)
async def delete_task_by_description(description: str, user_id: str = Depends(get_current_user_id)):
    """根据任务描述删除任务"""
    try:
        # 获取所有任务
        all_tasks = await task_service.get_all_tasks(user_id)
        
        # 查找匹配的任务
        task_to_delete = None
        for task in all_tasks:
            if task.description == description:
                task_to_delete = task
                break
        
        if not task_to_delete:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"未找到描述为 '{description}' 的任务"
            )
        
        # 删除任务
        deleted_task = await task_service.delete_task(task_to_delete.id, user_id)
        return TaskResponse(task=deleted_task)
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"根据描述删除任务失败: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"删除任务失败: {str(e)}"
        )

@router.delete("/by-description", response_model=TaskDeleteResponse)
async def delete_tasks_by_description(request: TaskDeleteRequest, user_id: str = Depends(get_current_user_id)):
    """通过自然语言描述删除任务"""
    try:
        # 使用 DeepSeek 服务匹配并删除任务
        deleted_tasks = await deepseek_service.delete_tasks_by_description(request.description, user_id)
        
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

@router.post("/tasks/delete", response_model=TaskDeleteResponse)
async def delete_tasks_by_description_post(request: TaskDeleteRequest, user_id: str = Depends(get_current_user_id)):
    """通过自然语言描述删除任务 (POST方法，用于前端兼容)"""
    try:
        # 使用 DeepSeek 服务匹配并删除任务
        deleted_tasks = await deepseek_service.delete_tasks_by_description(request.description, user_id)
        
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
async def delete_tasks_by_day(request: BatchDeleteRequest, user_id: str = Depends(get_current_user_id)):
    """删除指定日期的所有任务"""
    try:
        deleted_tasks = await task_service.delete_tasks_by_day(request.date, user_id)
        
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
async def delete_tasks_by_week(request: BatchDeleteRequest, user_id: str = Depends(get_current_user_id)):
    """删除指定日期所在周的所有任务"""
    try:
        deleted_tasks = await task_service.delete_tasks_by_week(request.date, user_id)
        
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
async def delete_tasks_by_month(request: BatchDeleteRequest, user_id: str = Depends(get_current_user_id)):
    """删除指定日期所在月的所有任务"""
    try:
        deleted_tasks = await task_service.delete_tasks_by_month(request.date, user_id)
        
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


@router.get("/tasks/reminders", response_model=List[Task])
async def get_reminder_tasks(user_id: str = Depends(get_current_user_id)):
    """获取需要提醒的任务"""
    try:
        reminder_tasks = await reminder_service.get_reminder_tasks(user_id)
        return reminder_tasks
    except Exception as e:
        logger.error(f"获取提醒任务失败: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"获取提醒任务失败: {str(e)}"
        )


@router.get("/tasks/upcoming", response_model=List[Task])
async def get_upcoming_tasks(days: int = Query(7, description="未来天数"), user_id: str = Depends(get_current_user_id)):
    """获取即将到来的任务"""
    try:
        upcoming_tasks = await reminder_service.get_upcoming_tasks(days, user_id)
        return upcoming_tasks
    except Exception as e:
        logger.error(f"获取即将到来的任务失败: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"获取即将到来的任务失败: {str(e)}"
        )


@router.post("/tasks/batch/create", response_model=BatchCreateResponse)
async def batch_create_tasks(request: BatchCreateRequest, user_id: str = Depends(get_current_user_id)):
    """批量创建任务，优化数据库保存性能"""
    try:
        created_tasks = await task_service.batch_create_tasks(request.tasks, user_id)
        
        return BatchCreateResponse(
            success=True,
            created_count=len(created_tasks),
            created_tasks=created_tasks,
            message=f"成功批量创建 {len(created_tasks)} 个任务"
        )
    except Exception as e:
        logger.error(f"批量创建任务失败: {str(e)}")
        return BatchCreateResponse(
            success=False,
            created_count=0,
            created_tasks=[],
            message="批量创建任务失败",
            error=str(e)
        )


@router.post("/tasks/batch/delete", response_model=BatchDeleteResponse)
async def batch_delete_tasks_by_ids(request: dict, user_id: str = Depends(get_current_user_id)):
    """批量删除任务，优化数据库保存性能"""
    try:
        task_ids = request.get("task_ids", [])
        if not task_ids:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="任务ID列表不能为空"
            )
        
        deleted_ids = await task_service.batch_delete_tasks(task_ids, user_id)
        
        return BatchDeleteResponse(
            success=True,
            deleted_count=len(deleted_ids),
            deleted_tasks=[],  # 只返回ID，不返回完整任务对象以节省带宽
            message=f"成功批量删除 {len(deleted_ids)} 个任务"
        )
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"批量删除任务失败: {str(e)}")
        return BatchDeleteResponse(
            success=False,
            deleted_count=0,
            deleted_tasks=[],
            message="批量删除任务失败",
            error=str(e)
        )


@router.post("/tasks/batch/update", response_model=BatchUpdateResponse)
async def batch_update_tasks(request: BatchUpdateRequest, user_id: str = Depends(get_current_user_id)):
    """批量更新任务，优化数据库保存性能"""
    try:
        # 将请求转换为元组列表格式
        updates = [(update.task_id, update.task_update) for update in request.updates]
        
        updated_tasks = await task_service.batch_update_tasks(updates, user_id)
        
        return BatchUpdateResponse(
            success=True,
            updated_count=len(updated_tasks),
            updated_tasks=updated_tasks,
            message=f"成功批量更新 {len(updated_tasks)} 个任务"
        )
    except Exception as e:
        logger.error(f"批量更新任务失败: {str(e)}")
        return BatchUpdateResponse(
            success=False,
            updated_count=0,
            updated_tasks=[],
            message="批量更新任务失败",
            error=str(e)
        )