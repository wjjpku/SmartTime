#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
DeepSeek API 服务

负责调用 DeepSeek-v3 API 进行自然语言任务解析
"""

from datetime import datetime, timedelta
from typing import List, Dict, Any, Optional
import json
import asyncio
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
- 偏好时间：{work_info.preferences or '无特殊偏好'}

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
            
            # 首先尝试使用DeepSeek API
            try:
                print("开始调用 DeepSeek API 进行智能日程分析...")
                # 获取当前时间
                current_datetime = datetime.now()
                
                # 准备 API 请求
                api_key = self.settings.deepseek_api_key
                if not api_key:
                    raise Exception("DeepSeek API 密钥未配置")
                    
                headers = {
                    "Content-Type": "application/json",
                    "Authorization": f"Bearer {api_key}"
                }
                
                print(f"DeepSeek API 密钥已配置，准备发送请求...")
                
                payload = {
                    "model": self.model,
                    "messages": [
                        {
                            "role": "system",
                            "content": self._get_schedule_analysis_prompt(work_info, existing_tasks, current_datetime)
                        },
                        {
                            "role": "user",
                            "content": f"请为以下工作安排推荐最佳时间段：{description}"
                        }
                    ],
                    "temperature": 0.3,
                    "max_tokens": 1500
                }
                
                # 发送 API 请求，设置合理的超时时间
                print(f"正在向 DeepSeek API 发送请求: {self.api_url}")
                async with httpx.AsyncClient(timeout=60.0) as client:
                    response = await client.post(
                        self.api_url,
                        headers=headers,
                        json=payload
                    )
                    
                    print(f"DeepSeek API 响应状态码: {response.status_code}")
                    if response.status_code == 200:
                        result = response.json()
                        
                        # 提取 AI 回复内容
                        if "choices" in result and result["choices"]:
                            content = result["choices"][0]["message"]["content"].strip()
                            
                            # 解析 JSON 响应
                            try:
                                slots_data = json.loads(content)
                            except json.JSONDecodeError:
                                # 如果 JSON 解析失败，尝试提取 JSON 部分
                                import re
                                json_match = re.search(r'\[.*\]', content, re.DOTALL)
                                if json_match:
                                    slots_data = json.loads(json_match.group())
                                else:
                                    raise Exception(f"无法解析 AI 返回的 JSON: {content}")
                            
                            # 转换为 TimeSlot 对象
                            time_slots = []
                            for slot_data in slots_data:
                                try:
                                    start_time = datetime.fromisoformat(slot_data["start"])
                                    end_time = datetime.fromisoformat(slot_data["end"])
                                    
                                    time_slot = TimeSlot(
                                        start=start_time,
                                        end=end_time,
                                        reason=slot_data.get("reason", ""),
                                        score=slot_data.get("score", 5)
                                    )
                                    time_slots.append(time_slot)
                                
                                except Exception as e:
                                    print(f"解析时间段失败: {e}, 数据: {slot_data}")
                                    continue
                            
                            # 按分数排序
                            time_slots.sort(key=lambda x: x.score, reverse=True)
                            
                            if time_slots:
                                print(f"✅ DeepSeek API 分析成功！返回 {len(time_slots)} 个智能推荐时间段")
                                return work_info, time_slots
                            else:
                                print("⚠️ DeepSeek API 返回了空的时间段列表")
                    else:
                        print(f"❌ DeepSeek API 请求失败，状态码: {response.status_code}")
                        print(f"错误响应: {response.text}")
                
                # 如果API调用失败或没有返回有效结果，使用备用方法
                print("⚠️ DeepSeek API 调用失败或返回无效结果，切换到本地备用算法")
                
            except Exception as e:
                print(f"❌ DeepSeek API 调用异常: {type(e).__name__}: {str(e)}")
                import traceback
                print(f"详细错误信息: {traceback.format_exc()}")
                print("🔄 自动切换到本地备用算法")
            
            # 使用备用分析方法
            print("🤖 使用本地智能算法进行日程分析...")
            time_slots = await self._fallback_schedule_analysis(work_info, existing_tasks)
            print(f"✅ 本地算法分析完成，返回 {len(time_slots)} 个推荐时间段")
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
    
    async def match_tasks_for_deletion(self, description: str, existing_tasks: List[Task]) -> List[str]:
        """根据自然语言描述匹配要删除的任务"""
        try:
            print(f"开始任务删除匹配，描述: {description}")
            print(f"现有任务数量: {len(existing_tasks)}")
            
            # 获取当前时间
            current_datetime = datetime.now()
            
            # 准备 API 请求
            api_key = self.settings.deepseek_api_key
            headers = {
                "Content-Type": "application/json",
                "Authorization": f"Bearer {api_key}"
            }
            
            # 构建任务列表信息
            tasks_info = []
            for task in existing_tasks:
                task_info = {
                    "id": task.id,
                    "title": task.title,
                    "start": task.start.isoformat() if task.start else "",
                    "end": task.end.isoformat() if task.end else "",
                    "priority": task.priority.value if task.priority else "medium"
                }
                tasks_info.append(task_info)
            
            system_prompt = f"""你是一个智能任务匹配助手，专门根据用户的自然语言描述匹配要删除的任务。你需要深度理解自然语言的各种表达方式。

**重要：你必须严格按照JSON数组格式返回结果，不要返回任何解释或对话内容！**

当前时间信息：
- 当前日期：{current_datetime.strftime('%Y-%m-%d')} ({['星期一', '星期二', '星期三', '星期四', '星期五', '星期六', '星期日'][current_datetime.weekday()]})
- 当前时间：{current_datetime.strftime('%H:%M:%S')}

现有任务列表：
{json.dumps(tasks_info, ensure_ascii=False, indent=2)}

智能匹配规则：

1. **时间范围删除**：
   - "删除今天所有日程/任务" → 删除今天的所有任务
   - "清空明天的安排" → 删除明天的所有任务
   - "取消今天全部计划" → 删除今天的所有任务

2. **模糊表达删除**：
   - "今天不想睡觉" → 删除今天包含"睡觉"、"休息"、"午休"等相关的任务
   - "不想开会" → 删除包含"会议"、"开会"等的任务
   - "取消运动" → 删除包含"运动"、"健身"、"跑步"等的任务

3. **时间表达理解**：
   - "今天" = 当前日期 ({current_datetime.strftime('%Y-%m-%d')})
   - "明天" = {(current_datetime + timedelta(days=1)).strftime('%Y-%m-%d')}
   - "后天" = {(current_datetime + timedelta(days=2)).strftime('%Y-%m-%d')}
   - "昨天" = {(current_datetime - timedelta(days=1)).strftime('%Y-%m-%d')}
   - "这周"、"本周" = 本周内的任务
   - "下周" = 下周的任务
   - "上午" = 6:00-12:00
   - "下午" = 12:00-18:00
   - "晚上"、"夜里" = 18:00-23:59
   - "早上"、"早晨" = 6:00-10:00

4. **范围表达理解**：
   - "所有"、"全部"、"全部的"、"所有的" = 匹配所有相关任务
   - "这些"、"那些" = 匹配多个任务
   - "每个"、"每一个" = 匹配所有符合条件的任务

5. **否定和取消表达理解**：
   - "不想"、"不要"、"不需要" = 表示删除意图
   - "取消"、"删除"、"删掉"、"去掉"、"移除" = 明确的删除动作
   - "算了"、"不做了"、"放弃" = 表示取消任务

6. **模糊和同义词理解**：
   - "睡觉" = 休息、午休、小憩、睡眠、打盹
   - "吃饭" = 用餐、午餐、晚餐、早餐、就餐
   - "开会" = 会议、讨论、沟通、交流
   - "学习" = 复习、看书、读书、培训
   - "工作" = 办公、处理、完成、执行
   - "运动" = 锻炼、健身、跑步、游泳
   - "购物" = 买东西、采购、shopping

7. **优先级理解**：
   - "重要"、"紧急"、"关键" = high优先级
   - "普通"、"一般"、"正常" = medium优先级
   - "不重要"、"不紧急"、"可选" = low优先级

8. **智能推理**：
   - 理解上下文和隐含意思
   - 支持部分匹配和模糊匹配
   - 优先匹配最相关的任务
   - 考虑任务的时间、内容、优先级综合匹配

返回格式要求：
- 必须返回有效的 JSON 数组格式
- 数组包含匹配任务的 ID 字符串
- 如果没有匹配的任务，返回空数组 []
- **只返回 JSON 数组，不要包含其他文字说明**

示例输入和输出：

输入："删除今天所有日程"
输出：["task1", "task2", "task3"]

输入："今天不想睡觉"
输出：["task4"]

输入："取消明天的会议"
输出：["task5", "task6"]

输入："删除所有不重要的任务"
输出：["task7", "task8"]

输入："不要下午的安排"
输出：["task9"]

输入："算了，不学习了"
输出：["task10"]

输入："删除这周的运动计划"
输出：["task11", "task12"]

**记住：只返回JSON数组，不要返回任何解释文字！**
"""
            
            payload = {
                "model": self.model,
                "messages": [
                    {
                        "role": "system",
                        "content": system_prompt
                    },
                    {
                        "role": "user",
                        "content": f"请匹配要删除的任务：{description}"
                    }
                ],
                "temperature": 0.1,
                "max_tokens": 500
            }
            
            # 发送 API 请求
            async with httpx.AsyncClient(timeout=self.timeout) as client:
                response = await client.post(
                    self.api_url,
                    headers=headers,
                    json=payload
                )
                
                if response.status_code != 200:
                    print(f"DeepSeek API 请求失败: {response.status_code} - {response.text}")
                    return await self._fallback_task_matching(description, existing_tasks)
                
                result = response.json()
                
                # 提取 AI 回复内容
                if "choices" not in result or not result["choices"]:
                    print("DeepSeek API 返回格式错误")
                    return await self._fallback_task_matching(description, existing_tasks)
                
                content = result["choices"][0]["message"]["content"].strip()
                
                # 解析 JSON 响应
                try:
                    print(f"DeepSeek API 原始响应: {content}")
                    matched_ids = json.loads(content)
                    if isinstance(matched_ids, dict) and 'task_ids' in matched_ids:
                        task_ids = matched_ids['task_ids']
                        print(f"DeepSeek API 返回任务ID: {task_ids}")
                        if task_ids:
                            return task_ids
                        else:
                            print("DeepSeek API 返回空数组，使用备用匹配")
                            return await self._fallback_task_matching(description, existing_tasks)
                    elif isinstance(matched_ids, list):
                        print(f"DeepSeek API 返回任务ID列表: {matched_ids}")
                        if matched_ids:
                            return matched_ids
                        else:
                            print("DeepSeek API 返回空数组，使用备用匹配")
                            return await self._fallback_task_matching(description, existing_tasks)
                    else:
                        print(f"返回格式不正确: {content}")
                        return await self._fallback_task_matching(description, existing_tasks)
                except json.JSONDecodeError:
                    # 如果 JSON 解析失败，尝试提取 JSON 部分
                    import re
                    json_match = re.search(r'\[.*\]', content, re.DOTALL)
                    if json_match:
                        try:
                            matched_ids = json.loads(json_match.group())
                            return matched_ids
                        except json.JSONDecodeError:
                            pass
                    
                    print(f"DeepSeek API 返回非JSON格式，使用备用匹配: {content[:100]}...")
                    return await self._fallback_task_matching(description, existing_tasks)
        
        except Exception as e:
            print(f"任务匹配失败: {e}")
            return await self._fallback_task_matching(description, existing_tasks)
    
    async def _fallback_task_matching(self, description: str, existing_tasks: List[Task]) -> List[str]:
        """备用任务匹配方法（当 API 调用失败时使用）"""
        try:
            print(f"开始备用匹配，描述: {description}")
            print(f"现有任务数量: {len(existing_tasks)}")
            
            # 处理编码问题，尝试解码描述
            try:
                if isinstance(description, bytes):
                    description = description.decode('utf-8')
                print(f"处理后的描述: {description}")
            except Exception as e:
                print(f"描述解码失败: {e}")
                
            # 如果描述包含乱码或为空，尝试一些常见的删除模式
            if not description or len(description.strip()) == 0 or '?' in description:
                print("检测到描述为空或包含乱码，尝试常见删除模式")
                # 检查是否有今天的任务可以删除
                current_date = datetime.now().date()
                today_tasks = []
                for task in existing_tasks:
                    if task.start:
                        task_date = task.start.date()
                        if task_date == current_date:
                            today_tasks.append(task.id)
                
                if today_tasks:
                    print(f"找到今天的任务: {len(today_tasks)}个")
                    return today_tasks[:5]  # 限制最多删除5个任务，避免误删太多
            
            matched_ids = []
            description_lower = description.lower()
            
            # 扩展的时间关键词映射
            time_keywords = {
                '今天': 0, '今日': 0,
                '明天': 1, '明日': 1,
                '后天': 2,
                '昨天': -1, '昨日': -1,
                '上午': 'morning', '早上': 'morning', '早晨': 'morning',
                '下午': 'afternoon',
                '晚上': 'evening', '夜里': 'evening', '夜晚': 'evening',
                '这周': 'this_week',
                '本周': 'this_week',
                '下周': 'next_week',
                '上周': 'last_week',
                '这个月': 'this_month',
                '本月': 'this_month',
                '下个月': 'next_month',
                '上个月': 'last_month',
                '现在': 0,
                '当前': 0
            }
            
            # 扩展的优先级关键词
            priority_keywords = {
                '重要': 'high', '紧急': 'high', '关键': 'high',
                '普通': 'medium', '一般': 'medium', '正常': 'medium',
                '低': 'low', '不重要': 'low', '不紧急': 'low', '可选': 'low'
            }
            
            # 范围表达关键词
            scope_keywords = ['全部', '所有', '全部的', '所有的', '这些', '那些', '每个', '每一个']
            
            # 否定和取消表达关键词
            cancel_keywords = ['不想', '不要', '不需要', '取消', '删除', '删掉', '去掉', '移除', '算了', '不做了', '放弃']
            
            # 模糊匹配同义词词典
            synonym_dict = {
                '睡觉': ['休息', '午休', '小憩', '睡眠', '打盹', '睡觉'],
                '吃饭': ['用餐', '午餐', '晚餐', '早餐', '就餐', '吃饭'],
                '开会': ['会议', '讨论', '沟通', '交流', '开会'],
                '学习': ['复习', '看书', '读书', '培训', '学习'],
                '工作': ['办公', '处理', '完成', '执行', '工作'],
                '运动': ['锻炼', '健身', '跑步', '游泳', '运动'],
                '购物': ['买东西', '采购', 'shopping', '购物']
            }
            
            current_time = datetime.now()
            current_date = current_time.date()
            
            # 检查是否包含取消意图
            has_cancel_intent = any(keyword in description_lower for keyword in cancel_keywords)
            
            # 检查是否是范围删除
            has_scope_intent = any(keyword in description_lower for keyword in scope_keywords)
            
            for task in existing_tasks:
                should_match = False
                match_reasons = []
                
                # 1. 增强的标题关键词匹配
                task_title_lower = task.title.lower()
                
                # 直接关键词匹配
                import re
                words = re.findall(r'[\u4e00-\u9fa5]+', description_lower)
                for word in words:
                    if len(word) >= 2 and word in task_title_lower:
                        should_match = True
                        match_reasons.append(f"标题匹配: {word}")
                        break
                
                # 同义词匹配
                for key_word, synonyms in synonym_dict.items():
                    if key_word in description_lower:
                        for synonym in synonyms:
                            if synonym in task_title_lower:
                                should_match = True
                                match_reasons.append(f"同义词匹配: {key_word} -> {synonym}")
                                break
                
                # 2. 增强的时间匹配
                if task.start:
                    task_date = task.start.date()
                    
                    # 日期匹配
                    for time_word, offset in time_keywords.items():
                        if time_word in description_lower and isinstance(offset, int):
                            target_date = current_date + timedelta(days=offset)
                            if task_date == target_date:
                                should_match = True
                                match_reasons.append(f"日期匹配: {time_word}")
                                break
                    
                    # 周匹配
                    if any(word in description_lower for word in ['这周', '本周']):
                        # 计算本周的开始和结束日期
                        week_start = current_date - timedelta(days=current_date.weekday())
                        week_end = week_start + timedelta(days=6)
                        if week_start <= task_date <= week_end:
                            should_match = True
                            match_reasons.append("本周匹配")
                    
                    if '下周' in description_lower:
                        # 计算下周的开始和结束日期
                        next_week_start = current_date + timedelta(days=7-current_date.weekday())
                        next_week_end = next_week_start + timedelta(days=6)
                        if next_week_start <= task_date <= next_week_end:
                            should_match = True
                            match_reasons.append("下周匹配")
                    
                    # 时段匹配
                    hour = task.start.hour
                    for time_word, time_period in time_keywords.items():
                        if time_word in description_lower and isinstance(time_period, str):
                            if time_period == 'morning' and 6 <= hour <= 12:
                                should_match = True
                                match_reasons.append(f"时段匹配: {time_word}")
                            elif time_period == 'afternoon' and 12 <= hour <= 18:
                                should_match = True
                                match_reasons.append(f"时段匹配: {time_word}")
                            elif time_period == 'evening' and 18 <= hour <= 23:
                                should_match = True
                                match_reasons.append(f"时段匹配: {time_word}")
                
                # 3. 优先级匹配
                if task.priority:
                    for priority_word, priority_level in priority_keywords.items():
                        if priority_word in description_lower and task.priority.value == priority_level:
                            should_match = True
                            match_reasons.append(f"优先级匹配: {priority_word}")
                            break
                
                # 4. 范围删除匹配
                if has_scope_intent:
                    # 如果有范围意图，且有其他匹配条件，则匹配
                    if match_reasons or not description_lower.replace('全部', '').replace('所有', '').strip():
                        should_match = True
                        match_reasons.append("范围删除")
                
                # 5. 增强的范围删除匹配（如"删除今天所有任务"、"清空明天的日程"）
                if task.start:
                    task_date = task.start.date()
                    range_patterns = [
                        (r'删除.*?今天.*?(所有|全部)', current_date),
                        (r'删除.*?明天.*?(所有|全部)', current_date + timedelta(days=1)),
                        (r'清空.*?今天', current_date),
                        (r'清空.*?明天', current_date + timedelta(days=1)),
                        (r'取消.*?今天.*?(全部|所有)', current_date),
                        (r'取消.*?明天.*?(全部|所有)', current_date + timedelta(days=1)),
                        (r'今天.*?(所有|全部).*?(删除|取消|清空)', current_date),
                        (r'明天.*?(所有|全部).*?(删除|取消|清空)', current_date + timedelta(days=1)),
                        (r'(所有|全部).*?今天.*?(删除|取消|清空)', current_date),
                        (r'(所有|全部).*?明天.*?(删除|取消|清空)', current_date + timedelta(days=1))
                    ]
                    
                    for pattern, target_date in range_patterns:
                        if re.search(pattern, description_lower) and task_date == target_date:
                            should_match = True
                            match_reasons.append(f"范围删除匹配: {pattern}")
                            break
                
                # 6. 特殊情况："今天不想睡觉" 类型的表达
                if has_cancel_intent and not should_match:
                    # 检查是否是今天的任务且包含相关关键词
                    if task.start and task.start.date() == current_date:
                        for key_word, synonyms in synonym_dict.items():
                            if key_word in description_lower:
                                for synonym in synonyms:
                                    if synonym in task_title_lower:
                                        should_match = True
                                        match_reasons.append(f"否定意图匹配: {key_word}")
                                        break
                
                # 7. 模糊匹配增强
                if not should_match and len(words) > 0:
                    # 如果没有精确匹配，尝试模糊匹配
                    for word in words:
                        if len(word) >= 1 and word in task_title_lower:
                            # 降低匹配阈值，但需要有取消意图
                            if has_cancel_intent:
                                should_match = True
                                match_reasons.append(f"模糊匹配: {word}")
                                break
                
                if should_match:
                    matched_ids.append(task.id)
                    print(f"匹配任务: {task.title}, 原因: {', '.join(match_reasons)}")
            
            return matched_ids
        
        except Exception as e:
            print(f"备用任务匹配失败: {e}")
            return []