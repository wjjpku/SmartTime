#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
DeepSeek API 服务

负责调用 DeepSeek-v3 API 进行自然语言任务解析
"""

import json
import httpx
from datetime import datetime, timedelta
from typing import List, Dict, Any
from app.models import TaskCreate, TaskPriority
from app.utils.config import get_settings, Settings

class DeepSeekService:
    """DeepSeek API 服务类"""
    
    def __init__(self, settings: Settings):
        self.settings = settings
        self.api_url = settings.deepseek_api_url
        self.model = settings.deepseek_model
        self.timeout = 30.0
    
    def _get_system_prompt(self, current_datetime: datetime) -> str:
        """获取系统提示词，包含当前时间信息"""
        current_date_str = current_datetime.strftime("%Y-%m-%d")
        current_time_str = current_datetime.strftime("%H:%M:%S")
        current_weekday_cn = ["星期一", "星期二", "星期三", "星期四", "星期五", "星期六", "星期日"][current_datetime.weekday()]
        
        tomorrow_date = (current_datetime + timedelta(days=1)).strftime("%Y-%m-%d")
        day_after_tomorrow_date = (current_datetime + timedelta(days=2)).strftime("%Y-%m-%d")
        
        return f"""你是一个智能任务解析助手，专门将自然语言描述转换为结构化的任务信息。

当前时间信息：
- 当前日期：{current_date_str} ({current_weekday_cn})
- 当前时间：{current_time_str}

解析规则：
1. 识别任务标题（动作或事件名称）
2. 解析时间信息，基于当前时间准确理解相对时间：
   - "今天" = {current_date_str}
   - "明天" = {tomorrow_date}
   - "后天" = {day_after_tomorrow_date}
   - "下周一" = 下一个星期一的日期
   - "下周" = 从下周一开始的一周
3. 识别重复模式：
   - "每天"、"每日" = daily频率
   - "每周"、"每星期" = weekly频率
   - "每月" = monthly频率
   - "每年" = yearly频率
   - "每周一"、"每周二"等 = weekly频率，指定星期几
   - "每隔X天/周/月" = 对应频率，间隔为X
4. 估算任务优先级（high/medium/low）
5. 如果没有明确的结束时间，根据任务类型估算合理的持续时间

返回格式要求：
- 必须返回有效的 JSON 数组格式
- 每个任务包含：title（字符串）、start（ISO 8601格式）、end（ISO 8601格式，可选）、priority（high/medium/low）
- 对于重复任务，额外包含：is_recurring（布尔值）、recurrence_rule（重复规则对象）
- 重复规则对象包含：frequency（daily/weekly/monthly/yearly）、interval（间隔数）、days_of_week（星期几数组，0=周一）、end_date（结束日期，可选）
- 时间格式示例："2024-01-15T09:00:00"
- 如果用户描述包含多个任务，返回多个任务对象

示例输入1："明天上午9点开会，下午写报告"
示例输出1：
[
  {{
    "title": "开会",
    "start": "{tomorrow_date}T09:00:00",
    "end": "{tomorrow_date}T10:00:00",
    "priority": "high",
    "is_recurring": false
  }},
  {{
    "title": "写报告",
    "start": "{tomorrow_date}T14:00:00",
    "end": "{tomorrow_date}T17:00:00",
    "priority": "medium",
    "is_recurring": false
  }}
]

示例输入2："每周二晚8点开组会"
示例输出2：
[
  {{
    "title": "开组会",
    "start": "2024-01-16T20:00:00",
    "end": "2024-01-16T21:00:00",
    "priority": "high",
    "is_recurring": true,
    "recurrence_rule": {{
      "frequency": "weekly",
      "interval": 1,
      "days_of_week": [1]
    }}
  }}
]

请只返回 JSON 数组，不要包含其他文字说明。
"""
    
    def _parse_relative_time(self, text: str) -> datetime:
        """解析相对时间表达式（简单实现）"""
        now = datetime.now()
        
        # 简单的时间解析逻辑
        if "明天" in text:
            return now + timedelta(days=1)
        elif "后天" in text:
            return now + timedelta(days=2)
        elif "下周" in text:
            return now + timedelta(days=7)
        elif "今天" in text or "今日" in text:
            return now
        else:
            # 默认返回明天
            return now + timedelta(days=1)
    
    async def parse_tasks(self, text: str) -> List[TaskCreate]:
        """解析自然语言文本为任务列表"""
        try:
            # 获取当前时间
            current_datetime = datetime.now()
            
            # 准备 API 请求
            api_key = self.settings.deepseek_api_key
            headers = {
                "Content-Type": "application/json",
                "Authorization": f"Bearer {api_key}"
            }
            
            payload = {
                "model": self.model,
                "messages": [
                    {
                        "role": "system",
                        "content": self._get_system_prompt(current_datetime)
                    },
                    {
                        "role": "user",
                        "content": f"当前时间：{current_datetime.strftime('%Y-%m-%d %H:%M:%S')}\n\n请解析以下任务描述：{text}"
                    }
                ],
                "temperature": 0.1,
                "max_tokens": 1000
            }
            
            # 发送 API 请求
            async with httpx.AsyncClient(timeout=self.timeout) as client:
                response = await client.post(
                    self.api_url,
                    headers=headers,
                    json=payload
                )
                
                if response.status_code != 200:
                    raise Exception(f"DeepSeek API 请求失败: {response.status_code} - {response.text}")
                
                result = response.json()
                
                # 提取 AI 回复内容
                if "choices" not in result or not result["choices"]:
                    raise Exception("DeepSeek API 返回格式错误")
                
                content = result["choices"][0]["message"]["content"].strip()
                
                # 解析 JSON 响应
                try:
                    tasks_data = json.loads(content)
                except json.JSONDecodeError:
                    # 如果 JSON 解析失败，尝试提取 JSON 部分
                    import re
                    json_match = re.search(r'\[.*\]', content, re.DOTALL)
                    if json_match:
                        tasks_data = json.loads(json_match.group())
                    else:
                        raise Exception(f"无法解析 AI 返回的 JSON: {content}")
                
                # 转换为 TaskCreate 对象
                tasks = []
                for task_data in tasks_data:
                    try:
                        # 解析时间
                        start_time = datetime.fromisoformat(task_data["start"])
                        end_time = None
                        if task_data.get("end"):
                            end_time = datetime.fromisoformat(task_data["end"])
                        
                        # 解析优先级
                        priority_str = task_data.get("priority", "medium").lower()
                        if priority_str in ["high", "medium", "low"]:
                            priority = TaskPriority(priority_str)
                        else:
                            priority = TaskPriority.MEDIUM
                        
                        # 处理重复规则
                        is_recurring = task_data.get("is_recurring", False)
                        recurrence_rule = None
                        
                        if is_recurring and "recurrence_rule" in task_data:
                            rule_data = task_data["recurrence_rule"]
                            from app.models.task import RecurrenceRule, RecurrenceFrequency
                            
                            # 解析频率
                            frequency_str = rule_data.get("frequency", "weekly").lower()
                            frequency = RecurrenceFrequency.WEEKLY  # 默认值
                            if frequency_str == "daily":
                                frequency = RecurrenceFrequency.DAILY
                            elif frequency_str == "weekly":
                                frequency = RecurrenceFrequency.WEEKLY
                            elif frequency_str == "monthly":
                                frequency = RecurrenceFrequency.MONTHLY
                            elif frequency_str == "yearly":
                                frequency = RecurrenceFrequency.YEARLY
                            
                            recurrence_rule = RecurrenceRule(
                                frequency=frequency,
                                interval=rule_data.get("interval", 1),
                                days_of_week=rule_data.get("days_of_week", []),
                                end_date=None  # 暂时不处理结束日期
                            )
                        
                        task = TaskCreate(
                            title=task_data["title"],
                            start=start_time,
                            end=end_time,
                            priority=priority,
                            is_recurring=is_recurring,
                            recurrence_rule=recurrence_rule
                        )
                        tasks.append(task)
                    
                    except Exception as e:
                        print(f"解析单个任务失败: {e}, 任务数据: {task_data}")
                        continue
                
                return tasks
        
        except Exception as e:
            print(f"DeepSeek API 调用失败: {e}")
            # 如果 API 调用失败，返回基于简单规则的解析结果
            return await self._fallback_parse(text)
    
    async def _fallback_parse(self, text: str) -> List[TaskCreate]:
        """备用解析方法（当 API 调用失败时使用）"""
        try:
            # 简单的关键词匹配和时间解析
            base_time = self._parse_relative_time(text)
            
            # 提取可能的任务标题
            import re
            
            # 查找动词 + 名词的模式
            task_patterns = [
                r'(开会|会议)',
                r'(写|编写|完成).*?(报告|文档|作业)',
                r'(学习|复习).*?(课程|知识)',
                r'(购买|买).*?(东西|物品)',
                r'(锻炼|运动|健身)',
                r'(吃饭|用餐|午餐|晚餐)',
            ]
            
            tasks = []
            
            # 如果包含"和"、"，"等分隔符，尝试分割多个任务
            task_parts = re.split(r'[，,、和及以及然后接着]', text)
            
            for i, part in enumerate(task_parts):
                part = part.strip()
                if not part:
                    continue
                
                # 设置开始时间（每个任务间隔2小时）
                start_time = base_time.replace(hour=9 + i * 2, minute=0, second=0, microsecond=0)
                end_time = start_time + timedelta(hours=1)  # 默认1小时持续时间
                
                # 简单的优先级判断
                priority = TaskPriority.MEDIUM
                if any(word in part for word in ['重要', '紧急', '会议', '开会']):
                    priority = TaskPriority.HIGH
                elif any(word in part for word in ['简单', '容易', '休息']):
                    priority = TaskPriority.LOW
                
                task = TaskCreate(
                    title=part[:50],  # 限制标题长度
                    start=start_time,
                    end=end_time,
                    priority=priority
                )
                tasks.append(task)
            
            # 如果没有解析出任务，创建一个默认任务
            if not tasks:
                start_time = base_time.replace(hour=9, minute=0, second=0, microsecond=0)
                end_time = start_time + timedelta(hours=1)
                
                task = TaskCreate(
                    title=text[:50] if len(text) <= 50 else text[:47] + "...",
                    start=start_time,
                    end=end_time,
                    priority=TaskPriority.MEDIUM
                )
                tasks.append(task)
            
            return tasks
        
        except Exception as e:
            print(f"备用解析也失败了: {e}")
            # 最后的备用方案：创建一个基本任务
            now = datetime.now()
            tomorrow = now + timedelta(days=1)
            start_time = tomorrow.replace(hour=9, minute=0, second=0, microsecond=0)
            end_time = start_time + timedelta(hours=1)
            
            return [TaskCreate(
                title=text[:50] if len(text) <= 50 else text[:47] + "...",
                start=start_time,
                end=end_time,
                priority=TaskPriority.MEDIUM
            )]