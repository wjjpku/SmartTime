# 智能任务管理系统部署指南

本文档提供了智能任务管理系统的多种部署方式，包括 Vercel、Docker 和传统服务器部署。

## 🚀 快速部署选项

### 1. Vercel 部署（推荐）

Vercel 是最简单的部署方式，支持前后端一体化部署。

#### 准备工作

1. 确保你有 Vercel 账号
2. 安装 Vercel CLI：
   ```bash
   npm i -g vercel
   ```

#### 部署步骤

1. **设置环境变量**
   在 Vercel 项目设置中添加环境变量：
   - `DEEPSEEK_API_KEY`: 你的 DeepSeek API 密钥

2. **部署项目**
   ```bash
   # 在项目根目录执行
   vercel
   
   # 或者直接部署到生产环境
   vercel --prod
   ```

3. **配置说明**
   - 项目已配置 `vercel.json`，支持前后端路由
   - 前端构建产物会自动部署到 CDN
   - 后端 API 会部署为 Serverless 函数

### 2. Docker 部署

使用 Docker Compose 可以快速启动完整的应用栈。

#### 准备工作

1. 安装 Docker 和 Docker Compose
2. 创建环境变量文件：
   ```bash
   # 在项目根目录创建 .env 文件
   echo "DEEPSEEK_API_KEY=your_api_key_here" > .env
   ```

#### 部署步骤

1. **构建并启动服务**
   ```bash
   # 构建镜像并启动服务
   docker-compose up -d --build
   ```

2. **访问应用**
   - 前端：http://localhost:3000
   - 后端 API：http://localhost:8000
   - API 文档：http://localhost:8000/docs

3. **停止服务**
   ```bash
   docker-compose down
   ```

### 3. 传统服务器部署

适用于 VPS、云服务器等传统部署环境。

#### 前端部署

1. **构建前端**
   ```bash
   npm install
   npm run build
   ```

2. **部署到 Web 服务器**
   将 `dist` 目录的内容部署到 Nginx、Apache 等 Web 服务器。

   **Nginx 配置示例**：
   ```nginx
   server {
       listen 80;
       server_name your-domain.com;
       root /path/to/dist;
       index index.html;

       location / {
           try_files $uri $uri/ /index.html;
       }

       location /api/ {
           proxy_pass http://localhost:8000;
           proxy_set_header Host $host;
           proxy_set_header X-Real-IP $remote_addr;
       }
   }
   ```

#### 后端部署

1. **安装 Python 依赖**
   ```bash
   cd backend
   pip install -r requirements.txt
   ```

2. **配置环境变量**
   ```bash
   # 创建 .env 文件
   echo "DEEPSEEK_API_KEY=your_api_key_here" > .env
   ```

3. **启动后端服务**
   ```bash
   # 开发模式
   uvicorn main:app --reload --host 0.0.0.0 --port 8000
   
   # 生产模式
   uvicorn main:app --host 0.0.0.0 --port 8000 --workers 4
   ```

4. **使用 PM2 管理进程（推荐）**
   ```bash
   # 安装 PM2
   npm install -g pm2
   
   # 启动应用
   pm2 start "uvicorn main:app --host 0.0.0.0 --port 8000" --name task-manager-api
   
   # 设置开机自启
   pm2 startup
   pm2 save
   ```

## 🔧 环境变量配置

### 必需的环境变量

- `DEEPSEEK_API_KEY`: DeepSeek API 密钥（必填）

### 可选的环境变量

- `API_PORT`: 后端服务端口（默认 8000）
- `CORS_ORIGINS`: 允许的跨域来源
- `DATA_DIR`: 数据存储目录
- `LOG_LEVEL`: 日志级别

## 📊 性能优化建议

### 前端优化

1. **启用 Gzip 压缩**
2. **配置 CDN**
3. **设置静态资源缓存**
4. **使用 HTTP/2**

### 后端优化

1. **使用多个 Worker 进程**
   ```bash
   uvicorn main:app --workers 4
   ```

2. **配置反向代理**
   使用 Nginx 作为反向代理，提高性能和安全性。

3. **数据库优化**
   考虑使用 PostgreSQL 或 MongoDB 替代 JSON 文件存储。

## 🔒 安全建议

1. **HTTPS 配置**
   - 使用 SSL/TLS 证书
   - 配置 HSTS 头

2. **API 安全**
   - 实施 API 限流
   - 添加身份验证
   - 输入验证和清理

3. **环境变量安全**
   - 不要在代码中硬编码敏感信息
   - 使用安全的密钥管理服务

## 🐛 故障排除

### 常见问题

1. **API 连接失败**
   - 检查后端服务是否正常运行
   - 验证 CORS 配置
   - 确认防火墙设置

2. **DeepSeek API 错误**
   - 验证 API 密钥是否正确
   - 检查 API 配额和限制
   - 查看后端日志

3. **前端路由问题**
   - 确保 Web 服务器配置了 SPA 路由
   - 检查 `try_files` 配置

### 日志查看

```bash
# Docker 部署
docker-compose logs -f

# PM2 部署
pm2 logs task-manager-api

# 直接运行
# 查看控制台输出
```

## 📞 支持

如果在部署过程中遇到问题，请：

1. 检查日志文件
2. 验证环境变量配置
3. 确认网络连接
4. 查看项目文档

---

**注意**: 请确保在生产环境中使用 HTTPS，并定期更新依赖包以保持安全性。