#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
任务提醒服务

处理任务提醒逻辑，包括提醒时间计算、提醒状态管理等
"""

from datetime import datetime, timedelta
from typing import List, Optional
from ..models.task import Task, ReminderType
import logging

logger = logging.getLogger(__name__)

class ReminderService:
    """任务提醒服务类"""
    
    def __init__(self):
        """初始化提醒服务"""
        self.reminder_offsets = {
            ReminderType.NONE: None,
            ReminderType.AT_TIME: timedelta(0),
            ReminderType.BEFORE_5MIN: timedelta(minutes=5),
            ReminderType.BEFORE_15MIN: timedelta(minutes=15),
            ReminderType.BEFORE_30MIN: timedelta(minutes=30),
            ReminderType.BEFORE_1HOUR: timedelta(hours=1),
            ReminderType.BEFORE_1DAY: timedelta(days=1)
        }
    
    def calculate_reminder_time(self, task: Task) -> Optional[datetime]:
        """
        计算任务的提醒时间
        
        Args:
            task: 任务对象
            
        Returns:
            提醒时间，如果无需提醒则返回None
        """
        if task.reminder_type == ReminderType.NONE:
            return None
            
        offset = self.reminder_offsets.get(task.reminder_type)
        if offset is None:
            return None
            
        reminder_time = task.start - offset
        return reminder_time
    
    def get_pending_reminders(self, tasks: List[Task], current_time: Optional[datetime] = None) -> List[Task]:
        """
        获取需要发送提醒的任务列表
        
        Args:
            tasks: 任务列表
            current_time: 当前时间，默认为系统当前时间
            
        Returns:
            需要发送提醒的任务列表
        """
        if current_time is None:
            current_time = datetime.now()
            
        pending_reminders = []
        
        for task in tasks:
            # 跳过已发送提醒的任务
            if task.reminder_sent:
                continue
                
            # 跳过无需提醒的任务
            if task.reminder_type == ReminderType.NONE:
                continue
                
            # 计算提醒时间
            reminder_time = self.calculate_reminder_time(task)
            if reminder_time is None:
                continue
                
            # 检查是否到了提醒时间
            if current_time >= reminder_time:
                pending_reminders.append(task)
        
        # 按重要性和开始时间排序
        pending_reminders.sort(key=lambda t: (not t.is_important, t.start))
        
        return pending_reminders
    
    def get_upcoming_reminders(self, tasks: List[Task], hours_ahead: int = 24) -> List[dict]:
        """
        获取即将到来的提醒列表（用于前端显示）
        
        Args:
            tasks: 任务列表
            hours_ahead: 提前多少小时查看，默认24小时
            
        Returns:
            即将到来的提醒信息列表
        """
        current_time = datetime.now()
        end_time = current_time + timedelta(hours=hours_ahead)
        
        upcoming_reminders = []
        
        for task in tasks:
            # 跳过已发送提醒的任务
            if task.reminder_sent:
                continue
                
            # 跳过无需提醒的任务
            if task.reminder_type == ReminderType.NONE:
                continue
                
            # 计算提醒时间
            reminder_time = self.calculate_reminder_time(task)
            if reminder_time is None:
                continue
                
            # 检查是否在指定时间范围内
            if current_time <= reminder_time <= end_time:
                upcoming_reminders.append({
                    'task': task,
                    'reminder_time': reminder_time,
                    'time_until_reminder': reminder_time - current_time,
                    'time_until_task': task.start - current_time
                })
        
        # 按提醒时间排序
        upcoming_reminders.sort(key=lambda r: r['reminder_time'])
        
        return upcoming_reminders
    
    def format_reminder_message(self, task: Task) -> str:
        """
        格式化提醒消息
        
        Args:
            task: 任务对象
            
        Returns:
            格式化的提醒消息
        """
        priority_emoji = {
            'high': '🔴',
            'medium': '🟡',
            'low': '🟢'
        }
        
        important_prefix = '⭐ ' if task.is_important else ''
        priority_prefix = priority_emoji.get(task.priority, '🟡')
        
        # 计算时间差
        current_time = datetime.now()
        time_diff = task.start - current_time
        
        if time_diff.total_seconds() <= 0:
            time_text = "现在开始"
        elif time_diff.total_seconds() < 3600:  # 小于1小时
            minutes = int(time_diff.total_seconds() / 60)
            time_text = f"{minutes}分钟后开始"
        elif time_diff.total_seconds() < 86400:  # 小于1天
            hours = int(time_diff.total_seconds() / 3600)
            time_text = f"{hours}小时后开始"
        else:
            days = int(time_diff.total_seconds() / 86400)
            time_text = f"{days}天后开始"
        
        message = f"{important_prefix}{priority_prefix} {task.title}\n{time_text}"
        
        if task.end:
            duration = task.end - task.start
            if duration.total_seconds() > 0:
                hours = int(duration.total_seconds() / 3600)
                minutes = int((duration.total_seconds() % 3600) / 60)
                if hours > 0:
                    duration_text = f"预计时长：{hours}小时{minutes}分钟"
                else:
                    duration_text = f"预计时长：{minutes}分钟"
                message += f"\n{duration_text}"
        
        return message
    
    def get_reminder_type_display(self, reminder_type: ReminderType) -> str:
        """
        获取提醒类型的显示文本
        
        Args:
            reminder_type: 提醒类型
            
        Returns:
            显示文本
        """
        display_map = {
            ReminderType.NONE: "无提醒",
            ReminderType.AT_TIME: "准时提醒",
            ReminderType.BEFORE_5MIN: "提前5分钟",
            ReminderType.BEFORE_15MIN: "提前15分钟",
            ReminderType.BEFORE_30MIN: "提前30分钟",
            ReminderType.BEFORE_1HOUR: "提前1小时",
            ReminderType.BEFORE_1DAY: "提前1天"
        }
        return display_map.get(reminder_type, "未知")

# 全局提醒服务实例
reminder_service = ReminderService()