#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
DeepSeek API 服务

负责调用 DeepSeek-v3 API 进行自然语言任务解析
"""

from datetime import datetime, timedelta
from typing import List, Dict, Any, Optional
import json
import httpx
from ..models.task import Task, TaskPriority, WorkInfo, TimeSlot, TaskCreate
from ..utils.config import Settings

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
    
    def _parse_work_description(self, description: str) -> WorkInfo:
        """解析工作描述，提取工作信息"""
        import re
        from datetime import datetime, timedelta
        
        # 提取时长信息
        duration_hours = 2.0  # 默认2小时
        duration_patterns = [
            r'(\d+(?:\.\d+)?)\s*小时',
            r'(\d+(?:\.\d+)?)\s*h',
            r'(\d+(?:\.\d+)?)\s*hour',
        ]
        for pattern in duration_patterns:
            match = re.search(pattern, description, re.IGNORECASE)
            if match:
                duration_hours = float(match.group(1))
                break
        
        # 提取截止日期
        deadline = None
        current_time = datetime.now()
        
        # 查找相对时间表达
        if '明天' in description:
            deadline = current_time + timedelta(days=1)
            if '下午' in description:
                deadline = deadline.replace(hour=18, minute=0, second=0, microsecond=0)
            elif '晚上' in description:
                deadline = deadline.replace(hour=20, minute=0, second=0, microsecond=0)
            else:
                deadline = deadline.replace(hour=23, minute=59, second=59, microsecond=0)
        elif '今天' in description:
            deadline = current_time.replace(hour=23, minute=59, second=59, microsecond=0)
        elif '后天' in description:
            deadline = current_time + timedelta(days=2)
            deadline = deadline.replace(hour=23, minute=59, second=59, microsecond=0)
        
        # 提取偏好时间
        preferences = []
        if '上午' in description or '早上' in description:
            preferences.append('上午')
        if '下午' in description:
            preferences.append('下午')
        if '晚上' in description or '夜晚' in description:
            preferences.append('晚上')
        if '安静' in description:
            preferences.append('安静环境')
        
        # 生成工作标题（取描述的前50个字符）
        title = description[:50] if len(description) <= 50 else description[:47] + "..."
        
        return WorkInfo(
            title=title,
            description=description,
            duration_hours=duration_hours,
            deadline=deadline,
            priority=TaskPriority.MEDIUM,
            preferences=preferences
        )
    
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
    
    def _get_schedule_analysis_prompt(self, work_info: WorkInfo, existing_tasks: List[Dict[str, Any]], current_datetime: datetime) -> str:
        """获取智能日程分析的系统提示词"""
        current_date_str = current_datetime.strftime("%Y-%m-%d")
        current_time_str = current_datetime.strftime("%H:%M:%S")
        current_weekday_cn = ["星期一", "星期二", "星期三", "星期四", "星期五", "星期六", "星期日"][current_datetime.weekday()]
        
        # 格式化现有任务信息
        existing_tasks_str = ""
        if existing_tasks:
            existing_tasks_str = "\n现有日程安排：\n"
            for task in existing_tasks:
                start_time = task.get('start', '')
                end_time = task.get('end', '')
                title = task.get('title', '')
                existing_tasks_str += f"- {title}: {start_time} 到 {end_time}\n"
        else:
            existing_tasks_str = "\n当前没有已安排的日程。\n"
        
        return f"""你是一个智能日程规划助手，专门分析工作描述并推荐最佳的时间安排。

当前时间信息：
- 当前日期：{current_date_str} ({current_weekday_cn})
- 当前时间：{current_time_str}
{existing_tasks_str}
工作信息分析：
- 工作内容：{work_info.description}
- 预计时长：{work_info.duration_hours}小时
- 截止日期：{work_info.deadline.strftime('%Y-%m-%d %H:%M:%S') if work_info.deadline else '无明确截止日期'}
- 优先级：{work_info.priority}
- 偏好时间：{work_info.preferred_time or '无特殊偏好'}

分析要求：
1. 根据工作内容判断最适合的时间段（如：创意工作适合上午，会议适合工作时间，学习适合安静时段）
2. 考虑现有日程，避免时间冲突
3. 尊重用户的时间偏好
4. 考虑截止日期的紧迫性
5. 根据工作时长合理分配时间块
6. 提供3-5个不同的时间选择

返回格式要求：
- 必须返回有效的 JSON 数组格式
- 每个时间段包含：start（ISO 8601格式）、end（ISO 8601格式）、reason（推荐理由，字符串）、score（推荐分数，1-10）
- 时间格式示例："2024-01-15T09:00:00"
- 按推荐分数从高到低排序

示例输出：
[
  {{
    "start": "2024-01-16T09:00:00",
    "end": "2024-01-16T11:00:00",
    "reason": "上午时段精力充沛，适合创意性工作，且与现有日程无冲突",
    "score": 9
  }},
  {{
    "start": "2024-01-16T14:00:00",
    "end": "2024-01-16T16:00:00",
    "reason": "下午时段相对安静，适合专注性工作",
    "score": 7
  }}
]

请只返回 JSON 数组，不要包含其他文字说明。
"""
    
    async def analyze_schedule(self, description: str, existing_tasks: List[Dict[str, Any]]) -> tuple[WorkInfo, List[TimeSlot]]:
        """分析工作描述并推荐时间段，返回解析的工作信息和推荐时间段"""
        try:
            # 首先解析工作描述，提取工作信息
            work_info = self._parse_work_description(description)
            
            # 直接使用备用分析方法，避免API调用超时
            time_slots = await self._fallback_schedule_analysis(work_info, existing_tasks)
            return work_info, time_slots
            
            # 以下是原来的API调用代码，暂时注释掉
            # # 获取当前时间
            # current_datetime = datetime.now()
            # 
            # # 准备 API 请求
            # api_key = self.settings.deepseek_api_key
            # headers = {
            #     "Content-Type": "application/json",
            #     "Authorization": f"Bearer {api_key}"
            # }
            # 
            # payload = {
            #     "model": self.model,
            #     "messages": [
            #         {
            #             "role": "system",
            #             "content": self._get_schedule_analysis_prompt(work_info, existing_tasks, current_datetime)
            #         },
            #         {
            #             "role": "user",
            #             "content": f"请为以下工作安排推荐最佳时间段：{description}"
            #         }
            #     ],
            #     "temperature": 0.3,
            #     "max_tokens": 1500
            # }
            # 
            # # 发送 API 请求
            # async with httpx.AsyncClient(timeout=self.timeout) as client:
            #     response = await client.post(
            #         self.api_url,
            #         headers=headers,
            #         json=payload
            #     )
            #     
            #     if response.status_code != 200:
            #         raise Exception(f"DeepSeek API 请求失败: {response.status_code} - {response.text}")
            #     
            #     result = response.json()
            #     
            #     # 提取 AI 回复内容
            #     if "choices" not in result or not result["choices"]:
            #         raise Exception("DeepSeek API 返回格式错误")
            #     
            #     content = result["choices"][0]["message"]["content"].strip()
            #     
            #     # 解析 JSON 响应
            #     try:
            #         slots_data = json.loads(content)
            #     except json.JSONDecodeError:
            #         # 如果 JSON 解析失败，尝试提取 JSON 部分
            #         import re
            #         json_match = re.search(r'\[.*\]', content, re.DOTALL)
            #         if json_match:
            #             slots_data = json.loads(json_match.group())
            #         else:
            #             raise Exception(f"无法解析 AI 返回的 JSON: {content}")
            #     
            #     # 转换为 TimeSlot 对象
            #     time_slots = []
            #     for slot_data in slots_data:
            #         try:
            #             start_time = datetime.fromisoformat(slot_data["start"])
            #             end_time = datetime.fromisoformat(slot_data["end"])
            #             
            #             time_slot = TimeSlot(
            #                 start=start_time,
            #                 end=end_time,
            #                 reason=slot_data.get("reason", ""),
            #                 score=slot_data.get("score", 5)
            #             )
            #             time_slots.append(time_slot)
            #         
            #         except Exception as e:
            #             print(f"解析时间段失败: {e}, 数据: {slot_data}")
            #             continue
            #     
            #     # 按分数排序
            #     time_slots.sort(key=lambda x: x.score, reverse=True)
            #     
            #     return work_info, time_slots
        
        except Exception as e:
            print(f"智能日程分析失败: {e}")
            # 如果 API 调用失败，返回基于规则的推荐
            work_info = self._parse_work_description(description)
            time_slots = await self._fallback_schedule_analysis(work_info, existing_tasks)
            return work_info, time_slots
    
    async def _fallback_schedule_analysis(self, work_info: WorkInfo, existing_tasks: List[Dict[str, Any]]) -> List[TimeSlot]:
        """备用日程分析方法（当 API 调用失败时使用）"""
        try:
            current_time = datetime.now()
            time_slots = []
            
            # 基于工作类型推荐时间段
            work_desc = work_info.description.lower()
            duration_hours = work_info.duration_hours
            
            # 获取未来7天的时间范围
            for day_offset in range(7):
                target_date = current_time + timedelta(days=day_offset)
                
                # 跳过已过去的时间
                if day_offset == 0 and target_date.hour >= 18:
                    continue
                
                # 根据工作类型推荐不同时间段
                recommended_hours = []
                
                if any(word in work_desc for word in ['创意', '设计', '写作', '思考']):
                    # 创意工作：上午时段
                    recommended_hours = [9, 10]
                elif any(word in work_desc for word in ['会议', '讨论', '沟通', '汇报']):
                    # 会议类：工作时间
                    recommended_hours = [10, 14, 15]
                elif any(word in work_desc for word in ['学习', '阅读', '研究']):
                    # 学习类：安静时段
                    recommended_hours = [9, 19, 20]
                else:
                    # 默认工作时间
                    recommended_hours = [9, 14, 16]
                
                for hour in recommended_hours:
                    start_time = target_date.replace(hour=hour, minute=0, second=0, microsecond=0)
                    end_time = start_time + timedelta(hours=duration_hours)
                    
                    # 检查是否与现有任务冲突
                    has_conflict = False
                    for task in existing_tasks:
                        task_start = datetime.fromisoformat(task['start'])
                        task_end = datetime.fromisoformat(task['end'])
                        
                        if (start_time < task_end and end_time > task_start):
                            has_conflict = True
                            break
                    
                    if not has_conflict:
                        # 计算推荐分数
                        score = 5
                        
                        # 根据时间段调整分数
                        if 9 <= hour <= 11:
                            score += 2  # 上午加分
                        elif 14 <= hour <= 16:
                            score += 1  # 下午加分
                        
                        # 根据截止日期紧迫性调整分数
                        if work_info.deadline:
                            days_until_deadline = (work_info.deadline - start_time).days
                            if days_until_deadline <= 1:
                                score += 3  # 紧急任务加分
                            elif days_until_deadline <= 3:
                                score += 1
                        
                        # 根据优先级调整分数
                        if work_info.priority == 'high':
                            score += 1
                        elif work_info.priority == 'low':
                            score -= 1
                        
                        reason = f"推荐在{start_time.strftime('%m月%d日 %H:%M')}进行，预计{duration_hours}小时完成"
                        
                        time_slot = TimeSlot(
                            start=start_time,
                            end=end_time,
                            reason=reason,
                            score=min(10, max(1, score))  # 限制分数在1-10之间
                        )
                        time_slots.append(time_slot)
            
            # 按分数排序并返回前5个
            time_slots.sort(key=lambda x: x.score, reverse=True)
            return time_slots[:5]
        
        except Exception as e:
            print(f"备用日程分析失败: {e}")
            # 最后的备用方案：返回明天上午的时间段
            tomorrow = current_time + timedelta(days=1)
            start_time = tomorrow.replace(hour=9, minute=0, second=0, microsecond=0)
            end_time = start_time + timedelta(hours=work_info.duration_hours)
            
            return [TimeSlot(
                start=start_time,
                end=end_time,
                reason="默认推荐时间段",
                score=5
            )]