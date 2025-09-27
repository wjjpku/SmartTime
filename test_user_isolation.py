#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
测试多用户数据隔离功能

这个脚本将验证：
1. 不同用户的任务数据完全隔离
2. 用户只能访问自己的任务
3. JWT认证正常工作
"""

import requests
import requests
import jwt
import time
from datetime import datetime, timedelta

# 测试配置
BASE_URL = "http://localhost:8000/api"
JWT_SECRET_KEY = "your-secret-key-here"  # 与后端配置一致
JWT_ALGORITHM = "HS256"

def create_test_token(user_id):
    """创建测试用的JWT token"""
    payload = {
        "sub": user_id,
        "iat": datetime.utcnow(),
        "exp": datetime.utcnow() + timedelta(hours=1)
    }
    return jwt.encode(payload, JWT_SECRET_KEY, algorithm=JWT_ALGORITHM)

def create_task(user_id, title, start, end, priority):
    """创建任务"""
    token = create_test_token(user_id)
    
    task_data = {
        "title": title,
        "start": start,
        "end": end,
        "priority": priority
    }
    
    url = f"{BASE_URL}/tasks"
    headers = {
        "Authorization": f"Bearer {token}",
        "Content-Type": "application/json"
    }
    
    response = requests.post(url, headers=headers, json=task_data)
    return response

def get_tasks(access_token):
    """获取任务列表"""
    url = f"{BASE_URL}/tasks"
    headers = {
        "Authorization": f"Bearer {access_token}"
    }
    
    response = requests.get(url, headers=headers)
    return response

def test_user_isolation():
    """测试用户数据隔离"""
    print("开始测试多用户数据隔离功能...\n")
    
    # 创建两个测试用户的JWT token
    user1_id = "test-user-1"
    user2_id = "test-user-2"
    
    user1_token = create_test_token(user1_id)
    user2_token = create_test_token(user2_id)
    
    print(f"用户1 ID: {user1_id}")
    print(f"用户2 ID: {user2_id}")
    print()
    
    # 用户1创建任务
    print("用户1创建任务...")
    user1_tasks = [
        {
            "title": "用户1的任务1",
            "start": (datetime.now() + timedelta(hours=1)).isoformat(),
            "end": (datetime.now() + timedelta(hours=2)).isoformat(),
            "priority": "high"
        },
        {
            "title": "用户1的任务2", 
            "start": (datetime.now() + timedelta(hours=3)).isoformat(),
            "end": (datetime.now() + timedelta(hours=4)).isoformat(),
            "priority": "medium"
        }
    ]
    
    for task in user1_tasks:
        response = create_task(user1_id, task['title'], task['start'], task['end'], task['priority'])
        if response.status_code == 200 or response.status_code == 201:
            print(f"✓ 创建任务成功: {task['title']}")
        else:
            print(f"✗ 创建任务失败: {task['title']} - {response.status_code} {response.text}")
    
    time.sleep(1)
    
    # 用户2创建任务
    print("\n用户2创建任务...")
    user2_tasks = [
        {
            "title": "用户2的任务1",
            "start": (datetime.now() + timedelta(hours=5)).isoformat(),
            "end": (datetime.now() + timedelta(hours=6)).isoformat(),
            "priority": "low"
        }
    ]
    
    for task in user2_tasks:
        response = create_task(user2_id, task['title'], task['start'], task['end'], task['priority'])
        if response.status_code == 200 or response.status_code == 201:
            print(f"✓ 创建任务成功: {task['title']}")
        else:
            print(f"✗ 创建任务失败: {task['title']} - {response.status_code} {response.text}")
    
    # 验证数据隔离
    print("\n=== 验证数据隔离 ===")
    
    # 获取用户1的任务列表
    user1_headers = {"Authorization": f"Bearer {user1_token}"}
    user1_response = requests.get(f"{BASE_URL}/tasks", headers=user1_headers)
    print(f"用户1获取任务列表: {user1_response.status_code}")
    
    if user1_response.status_code == 200:
        user1_data = user1_response.json()
        user1_task_list = user1_data.get('tasks', [])
        print(f"用户1任务数量: {len(user1_task_list)}")
        for task in user1_task_list:
            print(f"  - {task.get('title', 'Unknown')}: {task.get('start', 'Unknown')}")
    else:
        print(f"用户1获取任务失败: {user1_response.text}")
        user1_task_list = []
    
    # 获取用户2的任务列表
    user2_headers = {"Authorization": f"Bearer {user2_token}"}
    user2_response = requests.get(f"{BASE_URL}/tasks", headers=user2_headers)
    print(f"用户2获取任务列表: {user2_response.status_code}")
    
    if user2_response.status_code == 200:
        user2_data = user2_response.json()
        user2_task_list = user2_data.get('tasks', [])
        print(f"用户2任务数量: {len(user2_task_list)}")
        for task in user2_task_list:
            print(f"  - {task.get('title', 'Unknown')}: {task.get('start', 'Unknown')}")
    else:
        print(f"用户2获取任务失败: {user2_response.text}")
        user2_task_list = []
    
    # 验证隔离效果
    print("\n数据隔离验证结果:")
    if user1_task_list and user2_task_list:
        user1_titles = [task.get('title', '') for task in user1_task_list]
        user2_titles = [task.get('title', '') for task in user2_task_list]
        
        # 检查用户1是否只能看到自己的任务
        user1_has_own_tasks = any('用户1' in title for title in user1_titles)
        user1_has_other_tasks = any('用户2' in title for title in user1_titles)
        
        # 检查用户2是否只能看到自己的任务
        user2_has_own_tasks = any('用户2' in title for title in user2_titles)
        user2_has_other_tasks = any('用户1' in title for title in user2_titles)
        
        print(f"✓ 用户1能看到自己的任务: {user1_has_own_tasks}")
        print(f"✓ 用户1看不到用户2的任务: {not user1_has_other_tasks}")
        print(f"✓ 用户2能看到自己的任务: {user2_has_own_tasks}")
        print(f"✓ 用户2看不到用户1的任务: {not user2_has_other_tasks}")
        
        if (user1_has_own_tasks and not user1_has_other_tasks and 
            user2_has_own_tasks and not user2_has_other_tasks):
            print("\n🎉 多用户数据隔离测试通过！")
            return True
        else:
            print("\n❌ 多用户数据隔离测试失败！")
            return False
    else:
        print("❌ 无法获取任务列表，测试失败")
        return False

if __name__ == "__main__":
    try:
        success = test_user_isolation()
        exit(0 if success else 1)
    except Exception as e:
        print(f"测试过程中发生错误: {e}")
        exit(1)