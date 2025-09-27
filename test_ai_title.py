#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
测试AI生成任务标题功能
"""

import asyncio
import sys
import os

# 添加项目路径
sys.path.append(os.path.join(os.path.dirname(__file__), 'backend'))
sys.path.append(os.path.join(os.path.dirname(__file__), 'backend', 'app'))

try:
    from app.services.deepseek_service import DeepSeekService
    from app.core.config import Settings
except ImportError:
    # 如果导入失败，尝试直接导入
    import sys
    sys.path.insert(0, os.path.join(os.path.dirname(__file__), 'backend', 'app'))
    from services.deepseek_service import DeepSeekService
    from core.config import Settings

async def test_ai_title_generation():
    """测试AI生成任务标题功能"""
    settings = Settings()
    service = DeepSeekService(settings)
    
    # 测试用例
    test_descriptions = [
        "明天上午需要准备一个重要的项目演示文稿，大概需要3小时时间，希望能在安静的环境下专心工作",
        "下周要开会讨论新产品的市场策略，需要提前做一些调研和准备工作，预计2小时",
        "这个月底要完成年度报告的撰写，包括数据分析和总结，大概需要4小时专注时间",
        "需要学习新的编程技术栈，包括React和TypeScript，计划每天晚上学习1小时"
    ]
    
    print("=== 测试AI生成任务标题功能 ===")
    print()
    
    for i, description in enumerate(test_descriptions, 1):
        print(f"测试用例 {i}:")
        print(f"原始描述: {description}")
        
        try:
            # 解析工作描述
            work_info = await service._parse_work_description(description)
            print(f"AI生成标题: {work_info.title}")
            print(f"预估时长: {work_info.duration_hours}小时")
            print(f"优先级: {work_info.priority}")
            if work_info.preferences:
                print(f"偏好: {', '.join(work_info.preferences)}")
            print("-" * 50)
            
        except Exception as e:
            print(f"错误: {str(e)}")
            print("-" * 50)
        
        print()

if __name__ == "__main__":
    asyncio.run(test_ai_title_generation())