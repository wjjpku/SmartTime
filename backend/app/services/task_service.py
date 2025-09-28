#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
任务服务层

负责任务的业务逻辑处理和数据持久化
"""

import json
import uuid
from datetime import datetime, timedelta
from typing import List, Optional, Dict, Any
from pathlib import Path
from app.models import Task, TaskCreate, TaskUpdate, TaskPriority, RecurrenceRule, RecurrenceFrequency

class TaskService:
    """任务服务类"""
    
    def __init__(self, data_file: str = "backend/data/tasks.json"):
        """初始化任务服务"""
        self.data_file = Path(data_file)
        self.data_file.parent.mkdir(parents=True, exist_ok=True)
        
        # 添加缓存机制 - 按用户ID缓存
        self._cache = {}
        self._cache_timestamp = {}
        self._cache_ttl = 60  # 扩展缓存时间到60秒
        
        # 查询结果缓存
        self._query_cache = {}
        self._query_cache_timestamp = {}
        self._query_cache_ttl = 30  # 查询缓存30秒
        
        # 文件数据缓存：避免频繁文件I/O
        self._file_data_cache = None
        self._file_cache_timestamp = None
        self._file_cache_ttl = 10  # 文件缓存10秒
        
        # 如果数据文件不存在，创建初始结构
        if not self.data_file.exists():
            self._init_data_file()
    
    def _init_data_file(self):
        """初始化数据文件"""
        initial_data = {
            "users": {},  # 按用户ID存储任务数据
            "metadata": {
                "version": "2.0",  # 升级版本以支持多用户
                "last_updated": datetime.now().isoformat()
            }
        }
        self._save_data(initial_data)
    
    def _load_data(self) -> Dict[str, Any]:
        """从文件加载数据（带缓存优化）"""
        # 检查文件缓存是否有效
        if (self._file_data_cache is not None and 
            self._file_cache_timestamp is not None and
            (datetime.now() - self._file_cache_timestamp).total_seconds() < self._file_cache_ttl):
            return self._file_data_cache
        
        try:
            with open(self.data_file, 'r', encoding='utf-8') as f:
                data = json.load(f)
                # 更新文件缓存
                self._file_data_cache = data
                self._file_cache_timestamp = datetime.now()
                return data
        except (FileNotFoundError, json.JSONDecodeError):
            # 如果文件损坏或不存在，重新初始化
            self._init_data_file()
            return self._load_data()
    
    def _save_data(self, data: Dict[str, Any]):
        """保存数据到文件"""
        try:
            # 确保metadata结构存在
            if "metadata" not in data:
                data["metadata"] = {
                    "version": "2.0",
                    "last_updated": datetime.now().isoformat()
                }
            else:
                # 更新元数据
                data["metadata"]["last_updated"] = datetime.now().isoformat()
            
            with open(self.data_file, 'w', encoding='utf-8') as f:
                json.dump(data, f, ensure_ascii=False, indent=2)
            
            # 清除所有缓存，因为数据已更改
            self._cache = {}
            self._cache_timestamp = {}
            self._query_cache = {}
            self._query_cache_timestamp = {}
            self._file_data_cache = None
            self._file_cache_timestamp = None
        except Exception as e:
            print(f"保存数据失败: {e}")
            print(f"数据结构: {data}")
            raise
    
    def _get_query_cache_key(self, method_name: str, user_id: str, **kwargs) -> str:
        """生成查询缓存键"""
        import hashlib
        key_data = f"{method_name}:{user_id}:{str(sorted(kwargs.items()))}"
        return hashlib.md5(key_data.encode()).hexdigest()
    
    def _get_query_cache(self, cache_key: str):
        """获取查询缓存"""
        if cache_key not in self._query_cache:
            return None
        
        # 检查缓存是否过期
        if cache_key in self._query_cache_timestamp:
            cache_time = self._query_cache_timestamp[cache_key]
            if (datetime.now() - cache_time).total_seconds() > self._query_cache_ttl:
                # 缓存过期，删除
                del self._query_cache[cache_key]
                del self._query_cache_timestamp[cache_key]
                return None
        
        return self._query_cache[cache_key]
    
    def _set_query_cache(self, cache_key: str, result):
        """设置查询缓存"""
        self._query_cache[cache_key] = result
        self._query_cache_timestamp[cache_key] = datetime.now()
    
    def _generate_task_id(self) -> str:
        """生成唯一的任务ID"""
        return f"task_{uuid.uuid4().hex[:8]}"
    
    def _dict_to_task(self, task_dict: Dict[str, Any]) -> Task:
        """将字典转换为Task对象"""
        # 解析重复规则
        recurrence_rule = None
        if task_dict.get("recurrence_rule"):
            rule_dict = task_dict["recurrence_rule"]
            recurrence_rule = RecurrenceRule(
                frequency=RecurrenceFrequency(rule_dict["frequency"]),
                interval=rule_dict.get("interval", 1),
                days_of_week=rule_dict.get("days_of_week"),
                day_of_month=rule_dict.get("day_of_month"),
                end_date=datetime.fromisoformat(rule_dict["end_date"]) if rule_dict.get("end_date") else None,
                count=rule_dict.get("count")
            )
        
        return Task(
            id=task_dict["id"],
            title=task_dict["title"],
            start=datetime.fromisoformat(task_dict["start"]),
            end=datetime.fromisoformat(task_dict["end"]) if task_dict.get("end") else None,
            priority=TaskPriority(task_dict.get("priority", "medium")),
            recurrence_rule=recurrence_rule,
            is_recurring=task_dict.get("is_recurring", False),
            parent_task_id=task_dict.get("parent_task_id"),
            reminder_type=task_dict.get("reminder_type", "none"),
            is_important=task_dict.get("is_important", False),
            reminder_sent=task_dict.get("reminder_sent", False),
            created_at=datetime.fromisoformat(task_dict["created_at"]),
            updated_at=datetime.fromisoformat(task_dict["updated_at"])
        )
    
    def _task_to_dict(self, task: Task) -> Dict[str, Any]:
        """将Task对象转换为字典"""
        task_dict = {
            "id": task.id,
            "title": task.title,
            "start": task.start.isoformat(),
            "end": task.end.isoformat() if task.end else None,
            "priority": task.priority.value,
            "is_recurring": task.is_recurring,
            "parent_task_id": task.parent_task_id,
            "reminder_type": task.reminder_type,
            "is_important": task.is_important,
            "reminder_sent": task.reminder_sent,
            "created_at": task.created_at.isoformat(),
            "updated_at": task.updated_at.isoformat()
        }
        
        # 序列化重复规则
        if task.recurrence_rule:
            rule_dict = {
                "frequency": task.recurrence_rule.frequency.value,
                "interval": task.recurrence_rule.interval
            }
            if task.recurrence_rule.days_of_week:
                rule_dict["days_of_week"] = task.recurrence_rule.days_of_week
            if task.recurrence_rule.day_of_month:
                rule_dict["day_of_month"] = task.recurrence_rule.day_of_month
            if task.recurrence_rule.end_date:
                rule_dict["end_date"] = task.recurrence_rule.end_date.isoformat()
            if task.recurrence_rule.count:
                rule_dict["count"] = task.recurrence_rule.count
            task_dict["recurrence_rule"] = rule_dict
        
        return task_dict
    
    def _generate_recurring_tasks(self, parent_task: Task, max_instances: int = 52) -> List[Task]:
        """生成重复任务实例"""
        if not parent_task.recurrence_rule:
            return []
        
        recurring_tasks = []
        rule = parent_task.recurrence_rule
        current_start = parent_task.start
        current_end = parent_task.end
        
        # 计算任务持续时间
        duration = None
        if current_end:
            duration = current_end - current_start
        
        # 生成重复实例
        for i in range(1, max_instances + 1):
            # 计算下一个实例的开始时间
            next_start = self._calculate_next_occurrence(current_start, rule, i)
            
            # 检查是否超过结束日期
            if rule.end_date and next_start > rule.end_date:
                break
            
            # 检查是否达到重复次数限制
            if rule.count and i >= rule.count:
                break
            
            # 计算结束时间
            next_end = None
            if duration:
                next_end = next_start + duration
            
            # 创建重复任务实例
            recurring_task = Task(
                id=self._generate_task_id(),
                title=parent_task.title,
                start=next_start,
                end=next_end,
                priority=parent_task.priority,
                recurrence_rule=None,  # 实例不包含重复规则
                is_recurring=False,    # 实例不是重复任务
                parent_task_id=parent_task.id,  # 关联父任务
                created_at=parent_task.created_at,
                updated_at=parent_task.updated_at
            )
            
            recurring_tasks.append(recurring_task)
        
        return recurring_tasks
    
    def _calculate_next_occurrence(self, start_time: datetime, rule: RecurrenceRule, occurrence_number: int) -> datetime:
        """计算下一个重复实例的时间"""
        if rule.frequency == RecurrenceFrequency.DAILY:
            return start_time + timedelta(days=rule.interval * occurrence_number)
        
        elif rule.frequency == RecurrenceFrequency.WEEKLY:
            if rule.days_of_week:
                # 如果指定了星期几，计算下一个匹配的日期
                days_ahead = 0
                current_weekday = start_time.weekday()
                target_weekday = rule.days_of_week[0]  # 取第一个指定的星期几
                
                if occurrence_number == 1:
                    # 第一次重复，找到下一个匹配的星期几
                    days_ahead = (target_weekday - current_weekday) % 7
                    if days_ahead == 0:  # 如果是同一天，则是下周
                        days_ahead = 7
                else:
                    # 后续重复，按周间隔计算
                    days_ahead = (target_weekday - current_weekday) % 7
                    if days_ahead == 0 and occurrence_number > 1:
                        days_ahead = 7
                    days_ahead += 7 * rule.interval * (occurrence_number - 1)
                
                return start_time + timedelta(days=days_ahead)
            else:
                return start_time + timedelta(weeks=rule.interval * occurrence_number)
        
        elif rule.frequency == RecurrenceFrequency.MONTHLY:
            # 简化的月度重复计算
            months_to_add = rule.interval * occurrence_number
            year = start_time.year
            month = start_time.month + months_to_add
            
            # 处理年份溢出
            while month > 12:
                year += 1
                month -= 12
            
            try:
                return start_time.replace(year=year, month=month)
            except ValueError:
                # 处理日期不存在的情况（如2月30日）
                # 使用该月的最后一天
                import calendar
                last_day = calendar.monthrange(year, month)[1]
                day = min(start_time.day, last_day)
                return start_time.replace(year=year, month=month, day=day)
        
        elif rule.frequency == RecurrenceFrequency.YEARLY:
            try:
                return start_time.replace(year=start_time.year + rule.interval * occurrence_number)
            except ValueError:
                # 处理闰年2月29日的情况
                return start_time.replace(year=start_time.year + rule.interval * occurrence_number, day=28)
        
        return start_time
    
    async def create_task(self, task_create: TaskCreate, user_id: str) -> Task:
        """创建新任务"""
        now = datetime.now()
        
        # 创建任务对象
        task = Task(
            id=self._generate_task_id(),
            title=task_create.title,
            start=task_create.start,
            end=task_create.end,
            priority=task_create.priority or TaskPriority.MEDIUM,
            recurrence_rule=task_create.recurrence_rule,
            is_recurring=task_create.is_recurring,
            parent_task_id=task_create.parent_task_id,
            reminder_type=task_create.reminder_type,
            is_important=task_create.is_important,
            reminder_sent=False,
            created_at=now,
            updated_at=now
        )
        
        # 保存到文件
        data = self._load_data()
        
        # 确保用户数据结构存在
        if user_id not in data["users"]:
            data["users"][user_id] = {"tasks": []}
        
        data["users"][user_id]["tasks"].append(self._task_to_dict(task))
        
        # 如果是重复任务，生成未来的实例
        if task.is_recurring and task.recurrence_rule:
            recurring_tasks = self._generate_recurring_tasks(task)
            for recurring_task in recurring_tasks:
                data["users"][user_id]["tasks"].append(self._task_to_dict(recurring_task))
        
        self._save_data(data)
        
        return task
    
    async def get_all_tasks(self, user_id: str) -> List[Task]:
        """获取指定用户的所有任务（带缓存优化）"""
        # 检查查询缓存
        cache_key = self._get_query_cache_key("get_all_tasks", user_id)
        cached_result = self._get_query_cache(cache_key)
        if cached_result is not None:
            return cached_result
        
        # 检查缓存是否有效
        current_time = datetime.now()
        if (user_id in self._cache and 
            user_id in self._cache_timestamp and 
            (current_time - self._cache_timestamp[user_id]).total_seconds() < self._cache_ttl):
            # 设置查询缓存
            self._set_query_cache(cache_key, self._cache[user_id])
            return self._cache[user_id]
        
        # 缓存失效，重新加载数据
        data = self._load_data()
        tasks = []
        
        # 检查用户是否存在
        if user_id in data["users"] and "tasks" in data["users"][user_id]:
            for task_dict in data["users"][user_id]["tasks"]:
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
        
        # 更新缓存
        self._cache[user_id] = tasks
        self._cache_timestamp[user_id] = current_time
        
        # 设置查询缓存
        self._set_query_cache(cache_key, tasks)
        
        return tasks
    
    async def get_task_by_id(self, task_id: str, user_id: str) -> Optional[Task]:
        """根据ID获取指定用户的任务"""
        data = self._load_data()
        
        # 检查用户是否存在
        if user_id not in data["users"] or "tasks" not in data["users"][user_id]:
            return None
        
        for task_dict in data["users"][user_id]["tasks"]:
            if task_dict["id"] == task_id:
                try:
                    return self._dict_to_task(task_dict)
                except Exception as e:
                    print(f"解析任务数据失败: {e}")
                    return None
        
        return None
    
    async def update_task(self, task_id: str, task_update: TaskUpdate, user_id: str) -> Optional[Task]:
        """更新指定用户的任务"""
        data = self._load_data()
        
        # 检查用户是否存在
        if user_id not in data["users"] or "tasks" not in data["users"][user_id]:
            return None
        
        for i, task_dict in enumerate(data["users"][user_id]["tasks"]):
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
                if task_update.reminder_type is not None:
                    task_dict["reminder_type"] = task_update.reminder_type
                if task_update.is_important is not None:
                    task_dict["is_important"] = task_update.is_important
                
                # 更新时间戳
                task_dict["updated_at"] = datetime.now().isoformat()
                
                # 保存数据
                data["users"][user_id]["tasks"][i] = task_dict
                self._save_data(data)
                
                # 返回更新后的任务
                return self._dict_to_task(task_dict)
        
        return None
    
    async def delete_task(self, task_id: str, user_id: str) -> bool:
        """删除指定用户的任务"""
        data = self._load_data()
        
        # 检查用户是否存在
        if user_id not in data["users"] or "tasks" not in data["users"][user_id]:
            return False
        
        for i, task_dict in enumerate(data["users"][user_id]["tasks"]):
            if task_dict["id"] == task_id:
                # 删除任务
                del data["users"][user_id]["tasks"][i]
                self._save_data(data)
                return True
        
        return False
    
    async def get_tasks_by_date_range(self, start_date: datetime, end_date: datetime, user_id: str) -> List[Task]:
        """获取指定用户在指定日期范围内的任务"""
        all_tasks = await self.get_all_tasks(user_id)
        
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
    
    async def delete_tasks_by_day(self, target_date: datetime, user_id: str) -> List[Task]:
        """删除指定用户在指定日期的所有任务"""
        print(f"[DEBUG] delete_tasks_by_day 接收到的日期: {target_date}")
        print(f"[DEBUG] target_date.date(): {target_date.date()}")
        
        # 计算当天的开始和结束时间
        start_of_day = target_date.replace(hour=0, minute=0, second=0, microsecond=0)
        end_of_day = target_date.replace(hour=23, minute=59, second=59, microsecond=999999)
        
        print(f"[DEBUG] 删除日期范围: {start_of_day} 到 {end_of_day}")
        
        # 获取当天的任务
        tasks_to_delete = await self.get_tasks_by_date_range(start_of_day, end_of_day, user_id)
        
        # 删除任务
        deleted_tasks = []
        for task in tasks_to_delete:
            success = await self.delete_task(task.id, user_id)
            if success:
                deleted_tasks.append(task)
        
        return deleted_tasks
    
    async def batch_create_tasks(self, tasks_create: List[TaskCreate], user_id: str) -> List[Task]:
        """批量创建任务，优化数据库保存性能"""
        now = datetime.now()
        created_tasks = []
        
        # 加载数据一次
        data = self._load_data()
        
        # 确保用户数据结构存在
        if user_id not in data["users"]:
            data["users"][user_id] = {"tasks": []}
        
        # 批量创建任务
        for task_create in tasks_create:
            task = Task(
                id=self._generate_task_id(),
                title=task_create.title,
                start=task_create.start,
                end=task_create.end,
                priority=task_create.priority or TaskPriority.MEDIUM,
                recurrence_rule=task_create.recurrence_rule,
                is_recurring=task_create.is_recurring,
                parent_task_id=task_create.parent_task_id,
                reminder_type=task_create.reminder_type,
                is_important=task_create.is_important,
                reminder_sent=False,
                created_at=now,
                updated_at=now
            )
            
            data["users"][user_id]["tasks"].append(self._task_to_dict(task))
            created_tasks.append(task)
            
            # 如果是重复任务，生成未来的实例
            if task.is_recurring and task.recurrence_rule:
                recurring_tasks = self._generate_recurring_tasks(task)
                for recurring_task in recurring_tasks:
                    data["users"][user_id]["tasks"].append(self._task_to_dict(recurring_task))
        
        # 只保存一次数据
        self._save_data(data)
        
        return created_tasks
    
    async def batch_delete_tasks(self, task_ids: List[str], user_id: str) -> List[str]:
        """批量删除任务，优化数据库保存性能"""
        data = self._load_data()
        
        # 检查用户是否存在
        if user_id not in data["users"] or "tasks" not in data["users"][user_id]:
            return []
        
        deleted_ids = []
        tasks_to_keep = []
        
        # 筛选要保留的任务
        for task_dict in data["users"][user_id]["tasks"]:
            if task_dict["id"] in task_ids:
                deleted_ids.append(task_dict["id"])
            else:
                tasks_to_keep.append(task_dict)
        
        # 更新任务列表
        data["users"][user_id]["tasks"] = tasks_to_keep
        
        # 只保存一次数据
        self._save_data(data)
        
        return deleted_ids
    
    async def batch_update_tasks(self, updates: List[tuple[str, TaskUpdate]], user_id: str) -> List[Task]:
        """批量更新任务，优化数据库保存性能"""
        data = self._load_data()
        
        # 检查用户是否存在
        if user_id not in data["users"] or "tasks" not in data["users"][user_id]:
            return []
        
        updated_tasks = []
        now = datetime.now()
        
        # 创建更新映射
        update_map = {task_id: task_update for task_id, task_update in updates}
        
        # 批量更新任务
        for i, task_dict in enumerate(data["users"][user_id]["tasks"]):
            if task_dict["id"] in update_map:
                task_update = update_map[task_dict["id"]]
                
                # 更新字段
                if task_update.title is not None:
                    task_dict["title"] = task_update.title
                if task_update.start is not None:
                    task_dict["start"] = task_update.start.isoformat()
                if task_update.end is not None:
                    task_dict["end"] = task_update.end.isoformat()
                if task_update.priority is not None:
                    task_dict["priority"] = task_update.priority.value
                if task_update.reminder_type is not None:
                    task_dict["reminder_type"] = task_update.reminder_type
                if task_update.is_important is not None:
                    task_dict["is_important"] = task_update.is_important
                
                # 更新时间戳
                task_dict["updated_at"] = now.isoformat()
                
                # 更新数据
                data["users"][user_id]["tasks"][i] = task_dict
                updated_tasks.append(self._dict_to_task(task_dict))
        
        # 只保存一次数据
        self._save_data(data)
        
        return updated_tasks
    
    async def delete_tasks_by_week(self, target_date: datetime, user_id: str) -> List[Task]:
        """删除指定用户在指定日期所在周的所有任务"""
        print(f"[DEBUG] delete_tasks_by_week 接收到的日期: {target_date}")
        print(f"[DEBUG] target_date.date(): {target_date.date()}")
        print(f"[DEBUG] target_date.weekday(): {target_date.weekday()} (0=周一, 6=周日)")
        
        # 计算本周的开始（周一）和结束（周日）
        days_since_monday = target_date.weekday()
        start_of_week = target_date - timedelta(days=days_since_monday)
        start_of_week = start_of_week.replace(hour=0, minute=0, second=0, microsecond=0)
        end_of_week = start_of_week + timedelta(days=6, hours=23, minutes=59, seconds=59, microseconds=999999)
        
        print(f"[DEBUG] 删除周范围: {start_of_week.date()} 到 {end_of_week.date()}")
        
        # 获取本周的任务
        tasks_to_delete = await self.get_tasks_by_date_range(start_of_week, end_of_week, user_id)
        
        # 删除任务
        deleted_tasks = []
        for task in tasks_to_delete:
            success = await self.delete_task(task.id, user_id)
            if success:
                deleted_tasks.append(task)
        
        return deleted_tasks
    
    async def delete_tasks_by_month(self, target_date: datetime, user_id: str) -> List[Task]:
        """删除指定用户在指定日期所在月的所有任务"""
        print(f"[DEBUG] delete_tasks_by_month 接收到的日期: {target_date}")
        print(f"[DEBUG] target_date.date(): {target_date.date()}")
        print(f"[DEBUG] target_date年月: {target_date.year}-{target_date.month}")
        
        # 计算本月的开始和结束
        start_of_month = target_date.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
        
        # 计算下个月的第一天，然后减去一天得到本月最后一天
        if target_date.month == 12:
            next_month = target_date.replace(year=target_date.year + 1, month=1, day=1)
        else:
            next_month = target_date.replace(month=target_date.month + 1, day=1)
        
        end_of_month = next_month - timedelta(microseconds=1)
        
        print(f"[DEBUG] 删除月份范围: {start_of_month.date()} 到 {end_of_month.date()}")
        
        # 获取本月的任务
        tasks_to_delete = await self.get_tasks_by_date_range(start_of_month, end_of_month, user_id)
        
        # 删除任务
        deleted_tasks = []
        for task in tasks_to_delete:
            success = await self.delete_task(task.id, user_id)
            if success:
                deleted_tasks.append(task)
        
        return deleted_tasks
    
    async def get_upcoming_tasks(self, user_id: str, days: int = 7) -> List[Task]:
        """获取即将到来的任务"""
        try:
            # 检查查询缓存
            cache_key = self._get_query_cache_key("get_upcoming_tasks", user_id, days=days)
            cached_result = self._get_query_cache(cache_key)
            if cached_result is not None:
                return cached_result
            
            all_tasks = await self.get_all_tasks(user_id)
            now = datetime.now()
            upcoming_date = now + timedelta(days=days)
            
            upcoming_tasks = []
            for task in all_tasks:
                # 检查任务的开始时间
                if task.start and task.start <= upcoming_date and task.start >= now:
                    upcoming_tasks.append(task)
                # 检查任务的结束时间
                elif task.end and task.end <= upcoming_date and task.end >= now:
                    upcoming_tasks.append(task)
            
            # 按时间排序
            upcoming_tasks.sort(key=lambda x: x.start or x.end or now)
            
            # 设置查询缓存
            self._set_query_cache(cache_key, upcoming_tasks)
            
            return upcoming_tasks
        except Exception as e:
            print(f"获取即将到来的任务失败: {e}")
            return []