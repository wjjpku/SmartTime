# SmartTime后端

基于 FastAPI 的后端服务，提供任务管理和 AI 解析功能。

## 功能特性

- 🤖 **AI 任务解析**: 集成 DeepSeek-v3 API，支持自然语言任务解析
- 📅 **任务管理**: 完整的 CRUD 操作，支持任务的创建、查询、更新和删除
- 🔄 **RESTful API**: 标准的 REST API 设计，易于前端集成
- 📊 **数据持久化**: 基于 JSON 文件的轻量级数据存储
- 🌐 **CORS 支持**: 支持跨域请求，便于前后端分离开发

## 技术栈

- **FastAPI**: 现代、快速的 Web 框架
- **Pydantic**: 数据验证和序列化
- **HTTPX**: 异步 HTTP 客户端
- **Python 3.8+**: 现代 Python 特性支持

## 项目结构

```
backend/
├── app/
│   ├── models/          # 数据模型
│   │   ├── __init__.py
│   │   └── task.py
│   ├── routes/          # API 路由
│   │   ├── __init__.py
│   │   └── tasks.py
│   ├── services/        # 业务逻辑服务
│   │   ├── __init__.py
│   │   ├── task_service.py
│   │   └── deepseek_service.py
│   ├── utils/           # 工具函数
│   │   ├── __init__.py
│   │   └── config.py
│   └── __init__.py
├── data/                # 数据存储目录
├── main.py              # 应用入口
├── requirements.txt     # 依赖包列表
├── .env.example         # 环境配置模板
└── README.md           # 项目文档
```

## 快速开始

### 1. 安装依赖

```bash
cd backend
pip install -r requirements.txt
```

### 2. 配置环境

复制环境配置模板并填写必要的配置：

```bash
cp .env.example .env
```

编辑 `.env` 文件，特别是 DeepSeek API Key：

```env
DEEPSEEK_API_KEY=your_actual_api_key_here
```

### 3. 启动服务

```bash
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

服务启动后，可以访问：

- API 文档: http://localhost:8000/docs
- 健康检查: http://localhost:8000/health

## API 接口

### 任务管理

- `POST /api/tasks/parse` - 自然语言任务解析
- `GET /api/tasks` - 获取所有任务
- `GET /api/tasks/{task_id}` - 获取单个任务
- `POST /api/tasks` - 创建任务
- `PUT /api/tasks/{task_id}` - 更新任务
- `DELETE /api/tasks/{task_id}` - 删除任务

### 系统接口

- `GET /` - 根路径
- `GET /health` - 健康检查

## 开发说明

### 环境要求

- Python 3.8+
- pip 或 poetry

### 开发模式启动

```bash
uvicorn main:app --reload
```

### 代码规范

- 使用 Type Hints
- 遵循 PEP 8 代码风格
- 添加适当的文档字符串
- 使用异步编程模式

## 配置说明

主要配置项说明：

- `DEEPSEEK_API_KEY`: DeepSeek API 密钥（必填）
- `API_PORT`: API 服务端口（默认 8000）
- `CORS_ORIGINS`: 允许的跨域来源
- `DATA_DIR`: 数据存储目录
- `LOG_LEVEL`: 日志级别

## 部署

### 生产环境部署

```bash
# 安装依赖
pip install -r requirements.txt

# 启动服务
uvicorn main:app --host 0.0.0.0 --port 8000
```

### Docker 部署

```dockerfile
# Dockerfile 示例
FROM python:3.9-slim

WORKDIR /app
COPY requirements.txt .
RUN pip install -r requirements.txt

COPY . .
EXPOSE 8000

CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
```

## 许可证

MIT License