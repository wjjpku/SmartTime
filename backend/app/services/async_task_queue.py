import asyncio
import uuid
from datetime import datetime, timedelta
from typing import Dict, Any, Optional, Callable, Awaitable
from enum import Enum
import logging

logger = logging.getLogger(__name__)

class TaskStatus(Enum):
    PENDING = "pending"
    PROCESSING = "processing"
    COMPLETED = "completed"
    FAILED = "failed"

class AsyncTask:
    def __init__(self, task_id: str, func: Callable, args: tuple = (), kwargs: dict = None):
        self.task_id = task_id
        self.func = func
        self.args = args
        self.kwargs = kwargs or {}
        self.status = TaskStatus.PENDING
        self.result = None
        self.error = None
        self.created_at = datetime.now()
        self.started_at = None
        self.completed_at = None

class AsyncTaskQueue:
    def __init__(self, max_concurrent_tasks: int = 3):
        self.max_concurrent_tasks = max_concurrent_tasks
        self.tasks: Dict[str, AsyncTask] = {}
        self.queue = asyncio.Queue()
        self.running_tasks = set()
        self.workers = []
        self._running = False
    
    async def start(self):
        """启动任务队列处理器"""
        if self._running:
            return
        
        self._running = True
        # 创建工作协程
        for i in range(self.max_concurrent_tasks):
            worker = asyncio.create_task(self._worker(f"worker-{i}"))
            self.workers.append(worker)
        
        logger.info(f"异步任务队列已启动，最大并发数: {self.max_concurrent_tasks}")
    
    async def stop(self):
        """停止任务队列处理器"""
        self._running = False
        
        # 取消所有工作协程
        for worker in self.workers:
            worker.cancel()
        
        # 等待所有工作协程完成
        await asyncio.gather(*self.workers, return_exceptions=True)
        self.workers.clear()
        
        logger.info("异步任务队列已停止")
    
    async def _worker(self, worker_name: str):
        """工作协程，处理队列中的任务"""
        logger.info(f"工作协程 {worker_name} 已启动")
        
        while self._running:
            try:
                # 从队列中获取任务
                task = await asyncio.wait_for(self.queue.get(), timeout=1.0)
                
                # 处理任务
                await self._process_task(task, worker_name)
                
                # 标记任务完成
                self.queue.task_done()
                
            except asyncio.TimeoutError:
                # 超时是正常的，继续循环
                continue
            except Exception as e:
                logger.error(f"工作协程 {worker_name} 发生错误: {e}")
        
        logger.info(f"工作协程 {worker_name} 已停止")
    
    async def _process_task(self, task: AsyncTask, worker_name: str):
        """处理单个任务"""
        task.status = TaskStatus.PROCESSING
        task.started_at = datetime.now()
        self.running_tasks.add(task.task_id)
        
        logger.info(f"工作协程 {worker_name} 开始处理任务 {task.task_id}")
        
        try:
            # 执行任务函数
            if asyncio.iscoroutinefunction(task.func):
                result = await task.func(*task.args, **task.kwargs)
            else:
                result = task.func(*task.args, **task.kwargs)
            
            task.result = result
            task.status = TaskStatus.COMPLETED
            logger.info(f"任务 {task.task_id} 处理完成")
            
        except Exception as e:
            task.error = str(e)
            task.status = TaskStatus.FAILED
            logger.error(f"任务 {task.task_id} 处理失败: {e}")
        
        finally:
            task.completed_at = datetime.now()
            self.running_tasks.discard(task.task_id)
    
    def submit_task(self, func: Callable, *args, **kwargs) -> str:
        """提交任务到队列"""
        task_id = str(uuid.uuid4())
        task = AsyncTask(task_id, func, args, kwargs)
        self.tasks[task_id] = task
        
        # 将任务添加到队列
        asyncio.create_task(self.queue.put(task))
        
        logger.info(f"任务 {task_id} 已提交到队列")
        return task_id
    
    def get_task_status(self, task_id: str) -> Optional[Dict[str, Any]]:
        """获取任务状态"""
        task = self.tasks.get(task_id)
        if not task:
            return None
        
        return {
            "task_id": task.task_id,
            "status": task.status.value,
            "result": task.result,
            "error": task.error,
            "created_at": task.created_at.isoformat(),
            "started_at": task.started_at.isoformat() if task.started_at else None,
            "completed_at": task.completed_at.isoformat() if task.completed_at else None
        }
    
    def get_queue_info(self) -> Dict[str, Any]:
        """获取队列信息"""
        return {
            "queue_size": self.queue.qsize(),
            "running_tasks": len(self.running_tasks),
            "max_concurrent_tasks": self.max_concurrent_tasks,
            "total_tasks": len(self.tasks),
            "is_running": self._running
        }
    
    def cleanup_completed_tasks(self, max_age_hours: int = 24):
        """清理已完成的旧任务"""
        cutoff_time = datetime.now() - timedelta(hours=max_age_hours)
        
        tasks_to_remove = []
        for task_id, task in self.tasks.items():
            if (task.status in [TaskStatus.COMPLETED, TaskStatus.FAILED] and 
                task.completed_at and task.completed_at < cutoff_time):
                tasks_to_remove.append(task_id)
        
        for task_id in tasks_to_remove:
            del self.tasks[task_id]
        
        logger.info(f"清理了 {len(tasks_to_remove)} 个已完成的旧任务")

# 全局任务队列实例
task_queue = AsyncTaskQueue(max_concurrent_tasks=2)