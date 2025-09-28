# SmartTime - 智能任务管理系统

<div align="center">
  <img src="https://trae-api-sg.mchost.guru/api/ide/v1/text_to_image?prompt=modern%20minimalist%20calendar%20app%20logo%20with%20AI%20brain%20icon%2C%20blue%20gradient%20background%2C%20clean%20design%2C%20professional%20tech%20style&image_size=square" alt="SmartTime Logo" width="200" height="200">
  
  <p><strong>基于AI的智能任务管理和日程安排系统</strong></p>
  
  [![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
  [![React](https://img.shields.io/badge/React-18.3.1-blue.svg)](https://reactjs.org/)
  [![TypeScript](https://img.shields.io/badge/TypeScript-5.8.3-blue.svg)](https://www.typescriptlang.org/)
  [![Supabase](https://img.shields.io/badge/Supabase-2.58.0-green.svg)](https://supabase.com/)
  [![Vercel](https://img.shields.io/badge/Deployed%20on-Vercel-black.svg)](https://vercel.com/)
</div>

## 📖 项目简介

SmartTime 是一个基于自然语言处理的智能任务管理系统，让用户通过自然语言描述快速创建和管理任务。系统集成了 AI 技术，能够自动解析用户输入的自然语言，提取时间、优先级等结构化信息，并在日历中智能展示。

### 🎯 核心价值

- **🤖 AI 驱动**: 集成 DeepSeek-v3 API，支持自然语言任务解析
- **📅 智能日历**: 基于 FullCalendar 的现代化日历界面
- **⚡ 实时同步**: 基于 Supabase 的实时数据同步
- **🔐 安全认证**: 完整的用户认证和权限管理系统
- **📱 响应式设计**: 支持桌面端和移动端的完美体验
- **🎨 现代化UI**: 基于 Tailwind CSS 的精美界面设计

## ✨ 功能特性

### 🔑 用户认证
- 邮箱注册/登录
- 密码重置功能
- 游客模式体验
- 安全的会话管理

### 📝 任务管理
- 自然语言任务创建（如："明天上午9点开会，下午写报告"）
- AI 智能解析任务信息
- 任务的增删改查操作
- 优先级和状态管理
- 任务搜索和筛选

### 📅 日历功能
- 日视图/周视图/月视图切换
- 拖拽调整任务时间
- 任务冲突检测
- 实时数据同步

### 🧠 智能日程安排
- 工作描述自然语言输入
- AI 分析最佳工作时机
- 多个时间段推荐
- 智能冲突避免

### ⚙️ 个人设置
- 个人信息管理
- 密码安全设置
- 系统偏好配置
- 数据导出功能

## 🚀 快速开始

### 📋 环境要求

- Node.js 18.0 或更高版本
- npm 或 yarn 包管理器
- 现代浏览器（Chrome、Firefox、Safari、Edge）

### 🛠️ 安装步骤

1. **克隆项目**
   ```bash
   git clone https://github.com/your-username/smarttime.git
   cd smarttime
   ```

2. **安装依赖**
   ```bash
   npm install
   ```

3. **配置环境变量**
   ```bash
   cp .env.example .env
   ```
   
   📖 **详细配置指南**: 请查看 [API 配置指南](./API_SETUP_GUIDE.md) 获取完整的 API 密钥配置教程
   
   编辑 `.env` 文件，填入你的配置信息：
   ```env
   # Supabase 配置
   VITE_SUPABASE_URL=your_supabase_project_url
   VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
   
   # DeepSeek API 配置（可选，用于AI功能）
   VITE_DEEPSEEK_API_KEY=your_deepseek_api_key
   ```

4. **启动开发服务器**
   ```bash
   npm run dev
   ```

5. **访问应用**
   
   打开浏览器访问 `http://localhost:5173`

### 🔧 配置指南

### 📋 完整配置教程

我们为你准备了详细的 API 配置指南，包含所有必要的步骤和截图说明：

👉 **[查看完整 API 配置指南](./API_SETUP_GUIDE.md)**

### 快速配置概览

#### Supabase 配置
- 创建 Supabase 项目并获取 API 密钥
- 配置数据库表和安全策略
- 设置用户认证

#### DeepSeek API 配置
- 注册 DeepSeek 账号并获取 API 密钥
- 配置自然语言处理服务
- 设置使用限制和监控

#### 环境变量配置
- 复制 `.env.example` 为 `.env`
- 填入获取的 API 密钥
- 验证配置是否正确

> **注意**: 如果不配置 DeepSeek API，系统将使用基础的任务解析功能

## 📚 技术栈

### 前端技术
- **React 18.3.1** - 现代化前端框架
- **TypeScript 5.8.3** - 类型安全的 JavaScript
- **Vite 6.3.5** - 快速的构建工具
- **Tailwind CSS 3.4.17** - 实用优先的 CSS 框架
- **React Router 7.3.0** - 客户端路由
- **Zustand 5.0.3** - 轻量级状态管理

### UI 组件
- **FullCalendar 6.1.15** - 专业日历组件
- **Lucide React** - 现代化图标库
- **Radix UI** - 无障碍 UI 组件
- **Sonner** - 优雅的通知组件

### 后端服务
- **Supabase** - 后端即服务（BaaS）
  - PostgreSQL 数据库
  - 实时订阅
  - 用户认证
  - 行级安全（RLS）

### 外部服务
- **DeepSeek-v3 API** - AI 自然语言处理
- **Vercel** - 部署和托管平台

## 🏗️ 项目结构

```
smartime/
├── src/
│   ├── components/          # 可复用组件
│   │   ├── ui/             # 基础 UI 组件
│   │   ├── Calendar/       # 日历相关组件
│   │   └── TaskForm/       # 任务表单组件
│   ├── pages/              # 页面组件
│   │   ├── Login.tsx       # 登录页面
│   │   ├── Register.tsx    # 注册页面
│   │   ├── Dashboard.tsx   # 主页面
│   │   └── Settings.tsx    # 设置页面
│   ├── contexts/           # React Context
│   │   └── AuthContext.tsx # 认证上下文
│   ├── hooks/              # 自定义 Hooks
│   │   ├── useAuth.ts      # 认证相关
│   │   └── useTasks.ts     # 任务管理
│   ├── store/              # Zustand 状态管理
│   │   └── taskStore.ts    # 任务状态
│   ├── utils/              # 工具函数
│   │   ├── api.ts          # API 调用
│   │   └── helpers.ts      # 辅助函数
│   └── lib/                # 第三方库配置
│       └── supabase.ts     # Supabase 客户端
├── public/                 # 静态资源
├── supabase/              # 数据库迁移文件
│   └── migrations/
├── .env.example           # 环境变量模板
├── package.json           # 项目依赖
├── tailwind.config.js     # Tailwind 配置
├── vite.config.ts         # Vite 配置
└── README.md              # 项目文档
```

## 🚀 部署指南

### Vercel 部署（推荐）

1. **连接 GitHub**
   - 将代码推送到 GitHub 仓库
   - 在 [Vercel](https://vercel.com/) 中导入项目

2. **配置环境变量**
   
   在 Vercel 项目设置中添加环境变量：
   ```
   VITE_SUPABASE_URL=your_supabase_url
   VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
   VITE_DEEPSEEK_API_KEY=your_deepseek_api_key
   ```

3. **自动部署**
   
   Vercel 会自动构建和部署你的应用

### 手动部署

1. **构建项目**
   ```bash
   npm run build
   ```

2. **部署 dist 目录**
   
   将 `dist` 目录上传到你的静态文件服务器

### Docker 部署

```dockerfile
FROM node:18-alpine as builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM nginx:alpine
COPY --from=builder /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/nginx.conf
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
```

## 🧪 测试

```bash
# 运行单元测试
npm run test

# 运行测试并生成覆盖率报告
npm run test:coverage

# 运行测试 UI
npm run test:ui
```

## 🤝 贡献指南

我们欢迎所有形式的贡献！请查看 [DEVELOPER_GUIDE.md](./DEVELOPER_GUIDE.md) 了解详细的开发指南。

### 贡献流程

1. Fork 本仓库
2. 创建特性分支 (`git checkout -b feature/AmazingFeature`)
3. 提交更改 (`git commit -m 'Add some AmazingFeature'`)
4. 推送到分支 (`git push origin feature/AmazingFeature`)
5. 开启 Pull Request

### 代码规范

- 使用 TypeScript 进行类型安全开发
- 遵循 ESLint 配置的代码规范
- 编写有意义的提交信息
- 为新功能添加相应的测试

## 📄 许可证

本项目基于 MIT 许可证开源 - 查看 [LICENSE](LICENSE) 文件了解详情。

## 🙏 致谢

- [React](https://reactjs.org/) - 优秀的前端框架
- [Supabase](https://supabase.com/) - 强大的后端服务
- [Tailwind CSS](https://tailwindcss.com/) - 实用的 CSS 框架
- [FullCalendar](https://fullcalendar.io/) - 专业的日历组件
- [DeepSeek](https://www.deepseek.com/) - 先进的 AI 服务

## 📞 联系我们

如果你有任何问题或建议，请通过以下方式联系我们：

- 📧 Email: your-email@example.com
- 🐛 Issues: [GitHub Issues](https://github.com/your-username/smarttime/issues)
- 💬 Discussions: [GitHub Discussions](https://github.com/your-username/smarttime/discussions)

---

<div align="center">
  <p>⭐ 如果这个项目对你有帮助，请给我们一个 Star！</p>
  <p>Made with ❤️ by SmartTime Team</p>
</div>
