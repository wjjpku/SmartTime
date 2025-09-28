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
        self.timeout = 15.0  # 减少超时时间到15秒
        
        # 添加缓存机制
        self._cache = {}
        self._cache_ttl = 600  # 扩展缓存时间到10分钟
        self._cache_timestamps = {}
        
        # 连接池配置
        self._client_limits = httpx.Limits(
            max_keepalive_connections=5,
            max_connections=10,
            keepalive_expiry=30.0
        )
        
        # 重试配置
        self.max_retries = 3
        self.retry_delay = 1.0  # 初始重试延迟1秒
    
    def _get_cache_key(self, text: str, prompt_type: str = "parse") -> str:
        """生成缓存键"""
        import hashlib
        content = f"{prompt_type}:{text}"
        return hashlib.md5(content.encode()).hexdigest()
    
    def _get_cached_result(self, cache_key: str):
        """获取缓存结果"""
        if cache_key not in self._cache:
            return None
        
        # 检查缓存是否过期
        if cache_key in self._cache_timestamps:
            cache_time = self._cache_timestamps[cache_key]
            if (datetime.now() - cache_time).total_seconds() > self._cache_ttl:
                # 缓存过期，删除
                del self._cache[cache_key]
                del self._cache_timestamps[cache_key]
                return None
        
        return self._cache[cache_key]
    
    def _set_cache_result(self, cache_key: str, result):
        """设置缓存结果"""
        self._cache[cache_key] = result
        self._cache_timestamps[cache_key] = datetime.now()
    
    async def _make_api_request_with_retry(self, payload: dict, headers: dict) -> dict:
        """带重试机制的API请求"""
        last_exception = None
        
        for attempt in range(self.max_retries):
            try:
                async with httpx.AsyncClient(
                    timeout=self.timeout,
                    limits=self._client_limits
                ) as client:
                    response = await client.post(
                        self.api_url,
                        headers=headers,
                        json=payload
                    )
                    
                    if response.status_code == 200:
                        return response.json()
                    elif response.status_code == 429:  # 速率限制
                        if attempt < self.max_retries - 1:
                            await asyncio.sleep(self.retry_delay * (2 ** attempt))  # 指数退避
                            continue
                    elif response.status_code >= 500:  # 服务器错误
                        if attempt < self.max_retries - 1:
                            await asyncio.sleep(self.retry_delay)
                            continue
                    
                    raise Exception(f"DeepSeek API 请求失败: {response.status_code} - {response.text}")
                    
            except (httpx.TimeoutException, httpx.ConnectError) as e:
                last_exception = e
                if attempt < self.max_retries - 1:
                    await asyncio.sleep(self.retry_delay)
                    continue
            except Exception as e:
                raise e
        
        # 所有重试都失败了
        raise Exception(f"DeepSeek API 请求失败，已重试 {self.max_retries} 次: {last_exception}")
    
    def _get_system_prompt(self, current_datetime: datetime) -> str:
        """获取系统提示词，包含当前时间信息"""
        current_date_str = current_datetime.strftime("%Y-%m-%d")
        current_time_str = current_datetime.strftime("%H:%M:%S")
        current_weekday_cn = ["星期一", "星期二", "星期三", "星期四", "星期五", "星期六", "星期日"][current_datetime.weekday()]
        
        tomorrow_date = (current_datetime + timedelta(days=1)).strftime("%Y-%m-%d")
        day_after_tomorrow_date = (current_datetime + timedelta(days=2)).strftime("%Y-%m-%d")
        
        # 计算下周各天的日期
        days_until_next_monday = (7 - current_datetime.weekday()) % 7
        if days_until_next_monday == 0:  # 如果今天是周一，下周一是7天后
            days_until_next_monday = 7
        next_monday = (current_datetime + timedelta(days=days_until_next_monday)).strftime("%Y-%m-%d")
        next_tuesday = (current_datetime + timedelta(days=days_until_next_monday + 1)).strftime("%Y-%m-%d")
        next_wednesday = (current_datetime + timedelta(days=days_until_next_monday + 2)).strftime("%Y-%m-%d")
        next_thursday = (current_datetime + timedelta(days=days_until_next_monday + 3)).strftime("%Y-%m-%d")
        next_friday = (current_datetime + timedelta(days=days_until_next_monday + 4)).strftime("%Y-%m-%d")
        next_saturday = (current_datetime + timedelta(days=days_until_next_monday + 5)).strftime("%Y-%m-%d")
        next_sunday = (current_datetime + timedelta(days=days_until_next_monday + 6)).strftime("%Y-%m-%d")
        
        return f"""你是一个智能任务解析助手，专门将自然语言描述转换为结构化的任务信息。

当前时间信息：
- 当前日期：{current_date_str} ({current_weekday_cn})
- 当前时间：{current_time_str}

解析规则：
1. 识别任务标题（动作或事件名称）
2. 解析时间信息，基于当前时间准确理解相对时间：
   - "今天"、"今日" = {current_date_str}
   - "明天"、"明日" = {tomorrow_date}
   - "后天" = {day_after_tomorrow_date}
   - "下周一" = {next_monday}
   - "下周二" = {next_tuesday}
   - "下周三" = {next_wednesday}
   - "下周四" = {next_thursday}
   - "下周五" = {next_friday}
   - "下周六" = {next_saturday}
   - "下周日" = {next_sunday}
   - "这周一"、"本周一" = 本周的星期一
   - "这周五"、"本周五" = 本周的星期五
   - "下个月" = 下个月的同一天
   - "月底" = 本月最后一天
   - "月初" = 下个月第一天
   - "X天后"、"X天之后" = 当前日期+X天
   - "X小时后"、"X小时之后" = 当前时间+X小时
   - "一会儿"、"稍后" = 当前时间+1小时
   - "晚些时候" = 当前时间+3小时
3. 解析具体时间表达：
   - "上午"、"早上" = 09:00
   - "中午" = 12:00
   - "下午" = 14:00
   - "傍晚" = 18:00
   - "晚上" = 20:00
   - "深夜" = 23:00
   - "X点"、"X时" = X:00
   - "X点半" = X:30
   - "X点Y分" = X:Y
   - "X:Y" = X:Y
4. 识别重复模式：
   - "每天"、"每日"、"天天" = daily频率
   - "每周"、"每星期"、"周周" = weekly频率
   - "每月"、"月月" = monthly频率
   - "每年"、"年年" = yearly频率
   - "每周一"、"每周二"等 = weekly频率，指定星期几
   - "每隔X天/周/月/年" = 对应频率，间隔为X
   - "工作日"、"周一到周五" = weekly频率，周一到周五
   - "周末" = weekly频率，周六和周日
5. 估算任务优先级（high/medium/low）：
   - 包含"紧急"、"重要"、"必须"、"会议"、"面试"、"考试" = high
   - 包含"一般"、"普通"、"可以"、"建议" = medium
   - 包含"随便"、"有空"、"闲暇"、"休息" = low
6. 智能持续时间估算：
   - 会议、面试：1-2小时
   - 学习、工作：2-4小时
   - 吃饭：1小时
   - 运动：1-2小时
   - 购物：2-3小时
   - 休息、娱乐：1-2小时

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
    
    async def _parse_work_description(self, description: str) -> WorkInfo:
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
        
        # 使用AI生成简洁的工作标题
        title = await self._generate_task_title(description)
        
        return WorkInfo(
            title=title,
            description=description,
            duration_hours=duration_hours,
            deadline=deadline,
            priority=TaskPriority.MEDIUM,
            preferences=preferences
        )
    
    async def _generate_task_title(self, description: str) -> str:
        """使用AI生成简洁的任务标题"""
        try:
            # 准备 API 请求
            api_key = self.settings.deepseek_api_key
            if not api_key:
                # 如果没有API密钥，使用简单的截取方法
                return description[:20] if len(description) <= 20 else description[:17] + "..."
                
            headers = {
                "Content-Type": "application/json",
                "Authorization": f"Bearer {api_key}"
            }
            
            payload = {
                "model": self.model,
                "messages": [
                    {
                        "role": "system",
                        "content": "你是一个专业的任务管理助手。请根据用户的工作描述，生成一个简洁、专业的任务标题。要求：\n1. 标题长度控制在10-20个字符\n2. 准确概括工作内容的核心\n3. 使用简洁的动词+名词结构\n4. 避免冗余词汇\n5. 只返回标题文本，不要其他内容"
                    },
                    {
                        "role": "user",
                        "content": f"请为以下工作描述生成简洁的任务标题：{description}"
                    }
                ],
                "temperature": 0.1,
                "max_tokens": 50
            }
            
            # 发送 API 请求，优化超时设置
            timeout_config = httpx.Timeout(
                connect=3.0,  # 连接超时3秒
                read=10.0,    # 读取超时10秒
                write=5.0,    # 写入超时5秒
                pool=15.0     # 连接池超时15秒
            )
            async with httpx.AsyncClient(
                timeout=timeout_config,
                limits=httpx.Limits(max_keepalive_connections=5, max_connections=10)
            ) as client:
                response = await client.post(
                    self.api_url,
                    headers=headers,
                    json=payload
                )
                
                if response.status_code == 200:
                    result = response.json()
                    
                    if "choices" in result and result["choices"]:
                        title = result["choices"][0]["message"]["content"].strip()
                        # 确保标题长度合理
                        if len(title) > 30:
                            title = title[:27] + "..."
                        return title
                        
        except Exception as e:
            print(f"AI生成任务标题失败: {e}")
            
        # 如果AI生成失败，使用备用方法
        return description[:20] if len(description) <= 20 else description[:17] + "..."
    
    def _parse_relative_time(self, text: str) -> datetime:
        """解析相对时间表达式（增强实现）"""
        import re
        now = datetime.now()
        
        # 解析数字+时间单位的表达
        days_match = re.search(r'(\d+)天[后之]?后?', text)
        if days_match:
            days = int(days_match.group(1))
            return now + timedelta(days=days)
        
        hours_match = re.search(r'(\d+)小时[后之]?后?', text)
        if hours_match:
            hours = int(hours_match.group(1))
            return now + timedelta(hours=hours)
        
        # 解析相对时间词汇
        if "明天" in text or "明日" in text:
            return now + timedelta(days=1)
        elif "后天" in text:
            return now + timedelta(days=2)
        elif "下周" in text:
            # 如果指定了具体星期几
            if "下周一" in text:
                days_until_next_monday = (7 - now.weekday()) % 7
                if days_until_next_monday == 0:
                    days_until_next_monday = 7
                return now + timedelta(days=days_until_next_monday)
            elif "下周二" in text:
                days_until_next_tuesday = (8 - now.weekday()) % 7
                if days_until_next_tuesday == 0:
                    days_until_next_tuesday = 7
                return now + timedelta(days=days_until_next_tuesday)
            elif "下周三" in text:
                days_until_next_wednesday = (9 - now.weekday()) % 7
                if days_until_next_wednesday == 0:
                    days_until_next_wednesday = 7
                return now + timedelta(days=days_until_next_wednesday)
            elif "下周四" in text:
                days_until_next_thursday = (10 - now.weekday()) % 7
                if days_until_next_thursday == 0:
                    days_until_next_thursday = 7
                return now + timedelta(days=days_until_next_thursday)
            elif "下周五" in text:
                days_until_next_friday = (11 - now.weekday()) % 7
                if days_until_next_friday == 0:
                    days_until_next_friday = 7
                return now + timedelta(days=days_until_next_friday)
            elif "下周六" in text:
                days_until_next_saturday = (12 - now.weekday()) % 7
                if days_until_next_saturday == 0:
                    days_until_next_saturday = 7
                return now + timedelta(days=days_until_next_saturday)
            elif "下周日" in text:
                days_until_next_sunday = (13 - now.weekday()) % 7
                if days_until_next_sunday == 0:
                    days_until_next_sunday = 7
                return now + timedelta(days=days_until_next_sunday)
            else:
                # 默认下周一
                days_until_next_monday = (7 - now.weekday()) % 7
                if days_until_next_monday == 0:
                    days_until_next_monday = 7
                return now + timedelta(days=days_until_next_monday)
        elif "今天" in text or "今日" in text:
            return now
        elif "一会儿" in text or "稍后" in text:
            return now + timedelta(hours=1)
        elif "晚些时候" in text:
            return now + timedelta(hours=3)
        elif "下个月" in text:
            # 简单处理：加30天
            return now + timedelta(days=30)
        elif "月底" in text:
            # 本月最后一天
            next_month = now.replace(day=28) + timedelta(days=4)
            return next_month - timedelta(days=next_month.day)
        elif "月初" in text:
            # 下个月第一天
            if now.month == 12:
                return now.replace(year=now.year + 1, month=1, day=1)
            else:
                return now.replace(month=now.month + 1, day=1)
        else:
            # 默认返回明天
            return now + timedelta(days=1)
    
    async def parse_tasks(self, text: str) -> List[TaskCreate]:
        """解析自然语言文本为任务列表"""
        try:
            # 检查缓存
            cache_key = self._get_cache_key(text, "parse_tasks")
            cached_result = self._get_cached_result(cache_key)
            if cached_result is not None:
                return cached_result
            
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
            
            # 使用重试机制发送 API 请求
            result = await self._make_api_request_with_retry(payload, headers)
            
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
            
            # 缓存结果
            self._set_cache_result(cache_key, tasks)
            return tasks
        
        except Exception as e:
            print(f"DeepSeek API 调用失败: {e}")
            # 如果 API 调用失败，返回基于简单规则的解析结果
            return await self._fallback_parse(text)
    
    async def _fallback_parse(self, text: str) -> List[TaskCreate]:
        """备用解析方法（当 API 调用失败时使用）"""
        try:
            import re
            
            # 解析时间信息
            base_time = self._parse_relative_time(text)
            
            # 解析具体时间
            time_hour = 9  # 默认上午9点
            time_minute = 0
            
            # 解析时间表达
            if "上午" in text or "早上" in text:
                time_hour = 9
            elif "中午" in text:
                time_hour = 12
            elif "下午" in text:
                time_hour = 14
            elif "傍晚" in text:
                time_hour = 18
            elif "晚上" in text:
                time_hour = 20
            elif "深夜" in text:
                time_hour = 23
            
            # 解析具体时间点
            time_match = re.search(r'(\d{1,2})[点时](?:(\d{1,2})分)?', text)
            if time_match:
                time_hour = int(time_match.group(1))
                if time_match.group(2):
                    time_minute = int(time_match.group(2))
            
            # 解析X点半
            half_time_match = re.search(r'(\d{1,2})点半', text)
            if half_time_match:
                time_hour = int(half_time_match.group(1))
                time_minute = 30
            
            # 解析X:Y格式
            colon_time_match = re.search(r'(\d{1,2}):(\d{1,2})', text)
            if colon_time_match:
                time_hour = int(colon_time_match.group(1))
                time_minute = int(colon_time_match.group(2))
            
            # 查找动词 + 名词的模式（扩展）
            task_patterns = [
                r'(开会|会议|面试|讨论)',
                r'(写|编写|完成|提交).*?(报告|文档|作业|方案|计划)',
                r'(学习|复习|预习|研究).*?(课程|知识|资料|内容)',
                r'(购买|买|采购).*?(东西|物品|用品|设备)',
                r'(锻炼|运动|健身|跑步|游泳)',
                r'(吃饭|用餐|午餐|晚餐|早餐|聚餐)',
                r'(休息|放松|娱乐|看电影|听音乐)',
                r'(打电话|联系|沟通|交流)',
                r'(检查|查看|审核|确认)',
                r'(整理|清理|收拾|打扫)',
            ]
            
            tasks = []
            
            # 如果包含"和"、"，"等分隔符，尝试分割多个任务
            task_parts = re.split(r'[，,、和及以及然后接着还有另外]', text)
            
            for i, part in enumerate(task_parts):
                part = part.strip()
                if not part:
                    continue
                
                # 设置开始时间
                if i == 0:
                    start_time = base_time.replace(hour=time_hour, minute=time_minute, second=0, microsecond=0)
                else:
                    # 后续任务间隔2小时
                    start_time = base_time.replace(hour=min(23, time_hour + i * 2), minute=time_minute, second=0, microsecond=0)
                
                # 智能估算持续时间
                duration_hours = 1  # 默认1小时
                if any(word in part for word in ['会议', '面试', '开会']):
                    duration_hours = 1.5
                elif any(word in part for word in ['学习', '工作', '写', '编写']):
                    duration_hours = 2
                elif any(word in part for word in ['购物', '采购']):
                    duration_hours = 2.5
                elif any(word in part for word in ['运动', '锻炼', '健身']):
                    duration_hours = 1.5
                elif any(word in part for word in ['吃饭', '用餐', '聚餐']):
                    duration_hours = 1
                elif any(word in part for word in ['休息', '娱乐', '放松']):
                    duration_hours = 1.5
                
                end_time = start_time + timedelta(hours=duration_hours)
                
                # 智能优先级判断（扩展）
                priority = TaskPriority.MEDIUM
                if any(word in part for word in ['重要', '紧急', '必须', '会议', '开会', '面试', '考试', '截止']):
                    priority = TaskPriority.HIGH
                elif any(word in part for word in ['简单', '容易', '休息', '随便', '有空', '闲暇']):
                    priority = TaskPriority.LOW
                
                # 生成更好的任务标题
                title = part
                # 移除时间相关的词汇，保留核心任务内容
                time_words = ['今天', '明天', '后天', '上午', '下午', '晚上', '中午', '傍晚', '深夜', 
                             '一会儿', '稍后', '晚些时候', '下周', '下个月', '月底', '月初']
                for word in time_words:
                    title = title.replace(word, '').strip()
                
                # 移除数字+时间单位
                title = re.sub(r'\d+[天小时分钟][后之]?后?', '', title).strip()
                title = re.sub(r'\d{1,2}[点时](?:\d{1,2}分)?', '', title).strip()
                title = re.sub(r'\d{1,2}点半', '', title).strip()
                title = re.sub(r'\d{1,2}:\d{1,2}', '', title).strip()
                
                # 如果标题为空或太短，使用原始文本
                if not title or len(title) < 2:
                    title = part
                
                # 限制标题长度
                if len(title) > 50:
                    title = title[:47] + "..."
                
                task = TaskCreate(
                    title=title,
                    start=start_time,
                    end=end_time,
                    priority=priority
                )
                tasks.append(task)
            
            # 如果没有解析出任务，创建一个默认任务
            if not tasks:
                start_time = base_time.replace(hour=time_hour, minute=time_minute, second=0, microsecond=0)
                end_time = start_time + timedelta(hours=1)
                
                # 清理标题
                title = text
                time_words = ['今天', '明天', '后天', '上午', '下午', '晚上', '中午', '傍晚', '深夜', 
                             '一会儿', '稍后', '晚些时候', '下周', '下个月', '月底', '月初']
                for word in time_words:
                    title = title.replace(word, '').strip()
                
                title = re.sub(r'\d+[天小时分钟][后之]?后?', '', title).strip()
                title = re.sub(r'\d{1,2}[点时](?:\d{1,2}分)?', '', title).strip()
                title = re.sub(r'\d{1,2}点半', '', title).strip()
                title = re.sub(r'\d{1,2}:\d{1,2}', '', title).strip()
                
                if not title or len(title) < 2:
                    title = text
                
                if len(title) > 50:
                    title = title[:47] + "..."
                
                task = TaskCreate(
                    title=title,
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
            
            # 清理标题
            import re
            title = text
            time_words = ['今天', '明天', '后天', '上午', '下午', '晚上', '中午', '傍晚', '深夜', 
                         '一会儿', '稍后', '晚些时候', '下周', '下个月', '月底', '月初']
            for word in time_words:
                title = title.replace(word, '').strip()
            
            title = re.sub(r'\d+[天小时分钟][后之]?后?', '', title).strip()
            title = re.sub(r'\d{1,2}[点时](?:\d{1,2}分)?', '', title).strip()
            title = re.sub(r'\d{1,2}点半', '', title).strip()
            title = re.sub(r'\d{1,2}:\d{1,2}', '', title).strip()
            
            if not title or len(title) < 2:
                title = text
            
            if len(title) > 50:
                title = title[:47] + "..."
            
            return [TaskCreate(
                title=title,
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
- 建议任务标题：{work_info.title}

分析要求：
1. 根据工作内容判断最适合的时间段（如：创意工作适合上午，会议适合工作时间，学习适合安静时段）
2. 考虑现有日程，避免时间冲突
3. 尊重用户的时间偏好
4. 考虑截止日期的紧迫性
5. 根据工作时长合理分配时间块
6. 提供3-5个不同的时间选择
7. 使用已生成的简洁任务标题，不要使用用户的原始描述作为任务名称

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
            # 检查缓存
            cache_key = self._get_cache_key(f"{description}:{len(existing_tasks)}", "analyze_schedule")
            cached_result = self._get_cached_result(cache_key)
            if cached_result is not None:
                return cached_result
            
            # 首先解析工作描述，提取工作信息
            work_info = await self._parse_work_description(description)
            
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
                
                # 发送 API 请求，优化超时设置和连接池
                print(f"正在向 DeepSeek API 发送请求: {self.api_url}")
                timeout_config = httpx.Timeout(
                    connect=5.0,  # 连接超时5秒
                    read=15.0,    # 读取超时15秒
                    write=10.0,   # 写入超时10秒
                    pool=30.0     # 连接池超时30秒
                )
                async with httpx.AsyncClient(
                    timeout=timeout_config,
                    limits=httpx.Limits(max_keepalive_connections=10, max_connections=20)
                ) as client:
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
                                # 缓存结果
                                result = (work_info, time_slots)
                                self._set_cache_result(cache_key, result)
                                return result
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
            # 缓存结果
            result = (work_info, time_slots)
            self._set_cache_result(cache_key, result)
            return result
            
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
    
    async def delete_tasks_by_description(self, description: str, user_id: str = None) -> List[Task]:
        """根据自然语言描述删除任务"""
        try:
            from ..services.task_service import TaskService
            from ..utils.database import get_database
            
            # 获取数据库连接
            db = await get_database()
            task_service = TaskService(db)
            
            # 获取用户的所有任务
            if user_id:
                existing_tasks = await task_service.get_tasks_by_user(user_id)
            else:
                # 如果没有用户ID，获取所有任务（用于兼容性）
                existing_tasks = await task_service.get_all_tasks()
            
            if not existing_tasks:
                print("没有找到任何任务")
                return []
            
            # 使用AI匹配要删除的任务
            matched_task_ids = await self.match_tasks_for_deletion(description, existing_tasks)
            
            if not matched_task_ids:
                print(f"根据描述 '{description}' 没有找到匹配的任务")
                return []
            
            # 删除匹配的任务
            deleted_tasks = []
            for task_id in matched_task_ids:
                try:
                    deleted_task = await task_service.delete_task(task_id)
                    if deleted_task:
                        deleted_tasks.append(deleted_task)
                        print(f"成功删除任务: {deleted_task.title}")
                except Exception as e:
                    print(f"删除任务 {task_id} 失败: {e}")
            
            print(f"总共删除了 {len(deleted_tasks)} 个任务")
            return deleted_tasks
            
        except Exception as e:
            print(f"删除任务失败: {e}")
            raise Exception(f"删除任务失败: {str(e)}")