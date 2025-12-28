# 🚀 Amazon A9 Visual Architect & Agent Lab (RC-3.0)

> **专为跨境电商设计师打造的 AI 视觉策略与智能体工作台。**
> 集成了 Amazon A9 算法分析流与高度自由的个人智能体实验室。

![License](https://img.shields.io/badge/license-MIT-blue.svg)
![Version](https://img.shields.io/badge/version-3.0.0-green)
![Tech](https://img.shields.io/badge/tech-React%20%7C%20Vite%20%7C%20Tailwind-purple)

## 🌟 核心功能 (Key Features)

### 1. 🧠 Amazon A9 标准作业流 (SOP Workspace)
专为亚马逊运营与美工设计的标准化工作流：
- **首席策略官 (Strategy Director)**: 基于 A9 算法拆解产品核心卖点 (USPS)、消费者心理与竞品差异化。
- **视觉执行官 (Visual Director)**: 自动生成主图、副图、A+ 页面的详细拍摄需求与构图方案。
- **人设固化**: 支持自定义并自动保存“专家人设”，打造你的专属运营参谋。

### 2. 🧪 智能体实验室 (Agent Lab) [NEW]
一个全功能的个人 AI 创造中心：
- **专业级编辑器**: 支持 Markdown 语法高亮、专家提示词模板插入、变量管理。
- **永久记忆 (Session Persistence)**: 即使关闭浏览器，对话记录与上下文依然保留，随时继续工作。
- **沉浸式交互**: "配置"与"对话"模式无缝切换，支持多智能体管理与快速清理。

### 3. 🗄️ 模型资产管理 (Model Assets)
企业级的多模型统一管理中心：
- **万能兼容**: 原生支持 **Google Gemini**, **OpenAI**, **Anthropic Claude**。
- **国产大模型支持**: 完美适配 **火山引擎 (豆包/Volcengine)**, **DeepSeek**, **阿里通义千问** 等 OpenAI 兼容接口。
- **隐私安全**: 所有 API Key 与配置仅存储在本地浏览器 (LocalStorage)，绝不上传至第三方服务器。

---

## 🛠️ 技术栈 (Tech Stack)

本项目采用纯前端架构，零后端成本，部署极简：

- **Framework**: React 18 + Vite
- **Language**: TypeScript
- **Styling**: Tailwind CSS
- **Icons**: Lucide React
- **Storage**: Browser LocalStorage (No Database needed)
- **Deployment**: Vercel / GitHub Pages

---

## 🚀 快速开始 (Getting Started)

### 1. 安装依赖
```bash
npm install
2. 启动开发服务器
Bash

npm run dev
打开浏览器访问 http://localhost:5173 即可使用。

⚙️ 配置指南 (Configuration)
添加 API 模型
点击左侧侧边栏的 “数据库图标” (模型资产)。

点击 “添加模型”。

选择提供商：

Google Gemini: 填入 API Key 即可。

OpenAI / Custom: 支持所有兼容 OpenAI 协议的中转站。

火山引擎 (Volcengine): 系统会自动填充 api/v3 路径，仅需填入 Key 和 Endpoint ID。

创建智能体
点击左侧 “星星图标” (智能体实验室)。

点击 “创建智能体”，使用左侧编辑器编写 System Prompt（支持插入模板）。

点击 “保存并开始对话” 即可进入沉浸式聊天。

🔒 隐私声明 (Privacy)
本项目为 纯客户端应用 (Client-Side Only)。

您的 API Key、聊天记录、智能体配置 全部存储在您自己的浏览器缓存 (LocalStorage) 中。

没有任何数据会被发送到我们的服务器（因为根本没有服务器）。

请勿在公共电脑上使用，或在使用后及时清理浏览器缓存。

📝 License
MIT License © 2025 Amazon A9 Visual Architect
