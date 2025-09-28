# 🔑 API 配置指南

<div align="center">
  <img src="https://trae-api-sg.mchost.guru/api/ide/v1/text_to_image?prompt=API%20keys%20configuration%20dashboard%2C%20security%20settings%2C%20developer%20tools%2C%20modern%20interface%2C%20blue%20and%20green%20theme&image_size=landscape_16_9" alt="API Setup Guide" width="600" height="300">
  
  <p><strong>SmartTime 项目 API 密钥配置完整指南</strong></p>
</div>

## 📋 目录

- [概述](#概述)
- [Supabase 配置](#supabase-配置)
- [DeepSeek API 配置](#deepseek-api-配置)
- [环境变量设置](#环境变量设置)
- [配置验证](#配置验证)
- [常见问题](#常见问题)
- [安全最佳实践](#安全最佳实践)

## 🎯 概述

SmartTime 项目需要配置以下 API 服务：

- **Supabase**: 提供数据库、认证和实时功能
- **DeepSeek**: 提供 AI 自然语言处理能力

本指南将详细介绍如何获取和配置这些 API 密钥。

## 🗄️ Supabase 配置

### 1. 创建 Supabase 项目

#### 步骤 1：注册账号

1. 访问 [Supabase 官网](https://supabase.com/)
2. 点击 "Start your project" 按钮
3. 使用 GitHub、Google 或邮箱注册账号

#### 步骤 2：创建新项目

1. 登录后，点击 "New Project" 按钮
2. 选择或创建一个组织（Organization）
3. 填写项目信息：
   - **Name**: `smarttime-app`（或你喜欢的名称）
   - **Database Password**: 设置一个强密码（请记住这个密码）
   - **Region**: 选择离你最近的区域（推荐 `Southeast Asia (Singapore)`）
   - **Pricing Plan**: 选择 "Free" 计划

4. 点击 "Create new project" 按钮
5. 等待项目创建完成（通常需要 1-2 分钟）

### 2. 获取 API 密钥

#### 步骤 1：进入项目设置

1. 项目创建完成后，进入项目仪表板
2. 点击左侧菜单的 "Settings" 图标
3. 选择 "API" 选项

#### 步骤 2：复制 API 信息

在 API 设置页面，你会看到以下信息：

```
Project URL: https://your-project-id.supabase.co
API Keys:
  anon public: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
  service_role: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

**重要**：
- 复制 **Project URL**
- 复制 **anon public** 密钥（不要复制 service_role 密钥）

### 3. 配置数据库表

#### 步骤 1：进入 SQL 编辑器

1. 在 Supabase 仪表板中，点击左侧菜单的 "SQL Editor"
2. 点击 "New query" 创建新查询

#### 步骤 2：创建数据表

复制并执行以下 SQL 代码：

```sql
-- 创建用户扩展信息表
CREATE TABLE public.profiles (
  id UUID REFERENCES auth.users(id) PRIMARY KEY,
  username VARCHAR(50) UNIQUE NOT NULL,
  full_name VARCHAR(100),
  avatar_url TEXT,
  bio TEXT,
  preferences JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 创建任务表
CREATE TABLE public.tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  title VARCHAR(200) NOT NULL,
  description TEXT,
  start_time TIMESTAMPTZ NOT NULL,
  end_time TIMESTAMPTZ NOT NULL,
  priority VARCHAR(20) DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high')),
  status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'completed', 'cancelled')),
  tags TEXT[] DEFAULT '{}',
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 创建任务分类表
CREATE TABLE public.task_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  name VARCHAR(50) NOT NULL,
  color VARCHAR(7) DEFAULT '#3B82F6',
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, name)
);

-- 创建索引
CREATE INDEX idx_profiles_username ON public.profiles(username);
CREATE INDEX idx_tasks_user_id ON public.tasks(user_id);
CREATE INDEX idx_tasks_start_time ON public.tasks(start_time);
CREATE INDEX idx_task_categories_user_id ON public.task_categories(user_id);

-- 启用行级安全策略 (RLS)
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.task_categories ENABLE ROW LEVEL SECURITY;

-- 创建安全策略
-- 用户只能查看和修改自己的数据
CREATE POLICY "Users can view own profile" ON public.profiles
  FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Users can update own profile" ON public.profiles
  FOR UPDATE USING (auth.uid() = id);

CREATE POLICY "Users can manage own tasks" ON public.tasks
  FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "Users can manage own categories" ON public.task_categories
  FOR ALL USING (auth.uid() = user_id);

-- 创建更新时间触发器函数
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

-- 为表创建触发器
CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_tasks_updated_at
  BEFORE UPDATE ON public.tasks
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_task_categories_updated_at
  BEFORE UPDATE ON public.task_categories
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
```

#### 步骤 3：配置认证设置

1. 在 Supabase 仪表板中，点击 "Authentication"
2. 点击 "Settings" 选项卡
3. 在 "Site URL" 中填入：`http://localhost:5173`（开发环境）
4. 在 "Redirect URLs" 中添加：
   - `http://localhost:5173`
   - `http://localhost:5173/auth/callback`
   - 你的生产环境域名（如果有）

## 🤖 DeepSeek API 配置

### 1. 注册 DeepSeek 账号

#### 步骤 1：访问官网

1. 访问 [DeepSeek 平台](https://platform.deepseek.com/)
2. 点击 "Sign Up" 注册账号
3. 可以使用邮箱或手机号注册

#### 步骤 2：验证账号

1. 完成邮箱或手机验证
2. 设置账号密码
3. 完成实名认证（如果需要）

### 2. 获取 API 密钥

#### 步骤 1：进入 API 管理

1. 登录 DeepSeek 平台
2. 点击右上角的用户头像
3. 选择 "API Keys" 或 "API 管理"

#### 步骤 2：创建 API 密钥

1. 点击 "Create API Key" 或 "创建密钥" 按钮
2. 填写密钥信息：
   - **Name**: `SmartTime App`
   - **Description**: `用于 SmartTime 任务管理应用`
   - **Permissions**: 选择 "Chat Completion" 权限

3. 点击 "Create" 创建密钥
4. **重要**：立即复制生成的 API 密钥，它只会显示一次

#### 步骤 3：充值账户（如果需要）

1. DeepSeek API 采用按使用量计费
2. 新用户通常有免费额度
3. 如需更多使用量，可以在 "Billing" 页面充值

### 3. API 使用限制

- **免费额度**: 新用户通常有一定的免费调用次数
- **速率限制**: 每分钟最多 60 次请求
- **模型选择**: 推荐使用 `deepseek-chat` 模型

## ⚙️ 环境变量设置

### 1. 复制配置文件

```bash
# 在项目根目录下执行
cp .env.example .env
```

### 2. 编辑 .env 文件

使用文本编辑器打开 `.env` 文件，填入你获取的 API 信息：

```env
# Supabase 配置
VITE_SUPABASE_URL=https://your-project-id.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...

# 后端配置
SUPABASE_URL=https://your-project-id.supabase.co
SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...

# DeepSeek API 配置
VITE_DEEPSEEK_API_KEY=sk-1234567890abcdef...

# 应用配置
VITE_APP_ENV=development
VITE_API_BASE_URL=http://localhost:5173
VITE_APP_NAME=SmartTime
VITE_APP_VERSION=1.0.0
```

### 3. 验证配置

保存文件后，重启开发服务器：

```bash
npm run dev
```

## ✅ 配置验证

### 1. 测试 Supabase 连接

在浏览器中打开应用，尝试以下操作：

1. **注册新用户**：
   - 访问注册页面
   - 填写邮箱和密码
   - 检查是否收到验证邮件

2. **登录测试**：
   - 使用注册的账号登录
   - 检查是否能成功进入主页面

3. **数据库操作**：
   - 尝试创建一个任务
   - 检查任务是否保存成功

### 2. 测试 DeepSeek API

1. **自然语言解析**：
   - 在任务创建页面输入自然语言
   - 例如："明天上午9点开会，下午2点写报告"
   - 检查是否能正确解析为结构化任务

2. **检查控制台**：
   - 打开浏览器开发者工具
   - 查看 Console 面板是否有错误信息
   - 查看 Network 面板检查 API 请求状态

### 3. 常见验证问题

#### Supabase 连接失败

**错误信息**: `Invalid API key` 或 `Project not found`

**解决方案**:
1. 检查 `VITE_SUPABASE_URL` 是否正确
2. 确认 `VITE_SUPABASE_ANON_KEY` 是 anon public 密钥
3. 确保项目状态为 "Active"

#### DeepSeek API 调用失败

**错误信息**: `Unauthorized` 或 `Invalid API key`

**解决方案**:
1. 检查 `VITE_DEEPSEEK_API_KEY` 格式是否正确
2. 确认 API 密钥是否有效且未过期
3. 检查账户余额是否充足

## ❓ 常见问题

### Q1: 如何重置 Supabase 数据库密码？

**A**: 
1. 进入 Supabase 项目仪表板
2. 点击 Settings > Database
3. 点击 "Reset database password"
4. 设置新密码并确认

### Q2: DeepSeek API 密钥丢失了怎么办？

**A**: 
1. 登录 DeepSeek 平台
2. 进入 API Keys 管理页面
3. 删除旧的密钥
4. 创建新的 API 密钥
5. 更新 `.env` 文件中的配置

### Q3: 如何查看 API 使用量？

**A**: 
- **Supabase**: 在项目仪表板的 "Usage" 页面查看
- **DeepSeek**: 在平台的 "Billing" 或 "Usage" 页面查看

### Q4: 可以在多个项目中使用同一个 API 密钥吗？

**A**: 
- **Supabase**: 每个项目有独立的 API 密钥
- **DeepSeek**: 可以在多个项目中使用同一个 API 密钥，但要注意使用量限制

### Q5: 如何配置生产环境？

**A**: 
1. 为生产环境创建独立的 Supabase 项目
2. 使用环境变量而不是 `.env` 文件
3. 在部署平台（如 Vercel）中配置环境变量
4. 确保生产环境的 API 密钥与开发环境分离

## 🔒 安全最佳实践

### 1. API 密钥管理

- ✅ **永远不要**将 API 密钥提交到代码仓库
- ✅ 使用 `.env` 文件存储敏感信息
- ✅ 确保 `.env` 文件已添加到 `.gitignore`
- ✅ 为不同环境使用不同的 API 密钥
- ✅ 定期轮换 API 密钥

### 2. 权限控制

- ✅ 只使用必要的 API 权限
- ✅ 在 Supabase 中启用行级安全策略 (RLS)
- ✅ 定期审查 API 访问日志
- ✅ 设置合理的使用量限制

### 3. 监控和告警

- ✅ 监控 API 使用量和费用
- ✅ 设置异常使用告警
- ✅ 定期检查安全日志
- ✅ 及时更新依赖包

### 4. 备份和恢复

- ✅ 定期备份 Supabase 数据库
- ✅ 测试数据恢复流程
- ✅ 保存 API 配置的备份
- ✅ 准备应急响应计划

## 📞 获取帮助

如果在配置过程中遇到问题，可以通过以下方式获取帮助：

### 官方文档

- [Supabase 文档](https://supabase.com/docs)
- [DeepSeek API 文档](https://platform.deepseek.com/docs)

### 社区支持

- [Supabase Discord](https://discord.supabase.com/)
- [Supabase GitHub](https://github.com/supabase/supabase)

### 项目支持

- 📖 查看 [项目文档](./README.md)
- 🐛 提交 [Issue](https://github.com/your-username/smarttime/issues)
- 💬 参与 [Discussions](https://github.com/your-username/smarttime/discussions)

---

<div align="center">
  <p>🎉 配置完成后，你就可以开始使用 SmartTime 的所有功能了！</p>
  <p>祝你使用愉快！ 🚀</p>
</div>