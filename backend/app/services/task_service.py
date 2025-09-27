#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
任务服务层

负责任务的业务逻辑处理和数据持久化
"""

import json
import uuid
from datetime import datetime
from typing import List, Optional, Dict, Any
from pathlib import Path
from app.models import Task, TaskCreate, TaskUpdate, TaskPriority

class TaskService:
    """任务服务类"""
    
    def __init__(self, data_file: str = "backend/data/tasks.json"):
        """初始化任务服务"""
        self.data_file = Path(data_file)
        self.data_file.parent.mkdir(parents=True, exist_ok=True)
        
        # 如果数据文件不存在，创建初始结构
        if not self.data_file.exists():
            self._init_data_file()
    
    def _init_data_file(self):
        """初始化数据文件"""
        initial_data = {
            "tasks": [],
            "metadata": {
                "version": "1.0",
                "last_updated": datetime.now().isoformat()
            }
        }
        self._save_data(initial_data)
    
    def _load_data(self) -> Dict[str, Any]:
        """从文件加载数据"""
        try:
            with open(self.data_file, 'r', encoding='utf-8') as f:
                return json.load(f)
        except (FileNotFoundError, json.JSONDecodeError):
            # 如果文件损坏或不存在，重新初始化
            self._init_data_file()
            return self._load_data()
    
    def _save_data(self, data: Dict[str, Any]):
        """保存数据到文件"""
        # 更新元数据
        data["metadata"]["last_updated"] = datetime.now().isoformat()
        
        with open(self.data_file, 'w', encoding='utf-8') as f:
            json.dump(data, f, ensure_ascii=False, indent=2)
    
    def _generate_task_id(self) -> str:
        """生成唯一的任务ID"""
        return f"task_{uuid.uuid4().hex[:8]}"
    
    def _dict_to_task(self, task_dict: Dict[str, Any]) -> Task:
        """将字典转换为Task对象"""
        return Task(
            id=task_dict["id"],
            title=task_dict["title"],
            start=datetime.fromisoformat(task_dict["start"]),
            end=datetime.fromisoformat(task_dict["end"]) if task_dict.get("end") else None,
            priority=TaskPriority(task_dict.get("priority", "medium")),
            created_at=datetime.fromisoformat(task_dict["created_at"]),
            updated_at=datetime.fromisoformat(task_dict["updated_at"])
        )
    
    def _task_to_dict(self, task: Task) -> Dict[str, Any]:
        """将Task对象转换为字典"""
        return {
            "id": task.id,
            "title": task.title,
            "start": task.start.isoformat(),
            "end": task.end.isoformat() if task.end else None,
            "priority": task.priority.value,
            "created_at": task.created_at.isoformat(),
            "updated_at": task.updated_at.isoformat()
        }
    
    async def create_task(self, task_create: TaskCreate) -> Task:
        """创建新任务"""
        now = datetime.now()
        
        # 创建任务对象
        task = Task(
            id=self._generate_task_id(),
            title=task_create.title,
            start=task_create.start,
            end=task_create.end,
            priority=task_create.priority or TaskPriority.MEDIUM,
            created_at=now,
            updated_at=now
        )
        
        # 保存到文件
        data = self._load_data()
        data["tasks"].append(self._task_to_dict(task))
        self._save_data(data)
        
        return task
    
    async def get_all_tasks(self) -> List[Task]:
        """获取所有任务"""
        data = self._load_data()
        tasks = []
        
        for task_dict in data["tasks"]:
            try:
                task = self._dict_to_task(task_dict)
                tasks.append(task)
            except Exception as e:
                # 跳过损坏的任务数据
                print(f"跳过损坏的任务数据: {e}")
                continue
        
        # 按开始时间排序，确保datetime对象是naive的
        def get_sort_key(task):
            start_time = task.start
            if start_time.tzinfo is not None:
                start_time = start_time.replace(tzinfo=None)
            return start_time
        
        tasks.sort(key=get_sort_key)
        return tasks
    
    async def get_task_by_id(self, task_id: str) -> Optional[Task]:
        """根据ID获取任务"""
        data = self._load_data()
        
        for task_dict in data["tasks"]:
            if task_dict["id"] == task_id:
                try:
                    return self._dict_to_task(task_dict)
                except Exception as e:
                    print(f"解析任务数据失败: {e}")
                    return None
        
        return None
    
    async def update_task(self, task_id: str, task_update: TaskUpdate) -> Optional[Task]:
        """更新任务"""
        data = self._load_data()
        
        for i, task_dict in enumerate(data["tasks"]):
            if task_dict["id"] == task_id:
                # 更新字段
                if task_update.title is not None:
                    task_dict["title"] = task_update.title
                if task_update.start is not None:
                    task_dict["start"] = task_update.start.isoformat()
                if task_update.end is not None:
                    task_dict["end"] = task_update.end.isoformat()
                if task_update.priority is not None:
                    task_dict["priority"] = task_update.priority.value
                
                # 更新时间戳
                task_dict["updated_at"] = datetime.now().isoformat()
                
                # 保存数据
                data["tasks"][i] = task_dict
                self._save_data(data)
                
                # 返回更新后的任务
                return self._dict_to_task(task_dict)
        
        return None
    
    async def delete_task(self, task_id: str) -> bool:
        """删除任务"""
        data = self._load_data()
        
        for i, task_dict in enumerate(data["tasks"]):
            if task_dict["id"] == task_id:
                # 删除任务
                del data["tasks"][i]
                self._save_data(data)
                return True
        
        return False
    
    async def get_tasks_by_date_range(self, start_date: datetime, end_date: datetime) -> List[Task]:
        """获取指定日期范围内的任务"""
        all_tasks = await self.get_all_tasks()
        
        # 确保所有datetime对象都是naive的（没有时区信息）
        if start_date.tzinfo is not None:
            start_date = start_date.replace(tzinfo=None)
        if end_date.tzinfo is not None:
            end_date = end_date.replace(tzinfo=None)
        
        filtered_tasks = []
        for task in all_tasks:
            # 确保任务的datetime也是naive的
            task_start = task.start.replace(tzinfo=None) if task.start.tzinfo is not None else task.start
            task_end = None
            if task.end:
                task_end = task.end.replace(tzinfo=None) if task.end.tzinfo is not None else task.end
            
            # 检查任务是否在指定日期范围内
            if (task_start >= start_date and task_start <= end_date) or \
               (task_end and task_end >= start_date and task_end <= end_date) or \
               (task_start <= start_date and task_end and task_end >= end_date):
                filtered_tasks.append(task)
        
        return filtered_tasks