# 🚀 Amazon A9 Visual Architect (AntiGravity)

![License](https://img.shields.io/badge/license-MIT-blue.svg) ![React](https://img.shields.io/badge/React-18-blue) ![TypeScript](https://img.shields.io/badge/TypeScript-5.0-blue) ![Vite](https://img.shields.io/badge/build-Vite-yellow)

> **专为亚马逊跨境电商打造的 AI 视觉与策略生成引擎。**
> 
> **AI-Powered Visual Strategy & Content Generator for Amazon A9 Algorithm.**

## 📖 项目简介 (Introduction)

**AntiGravity (反重力架构)** 是一个基于 AI 智能体协作的电商生产力工具。它不仅仅是一个生图工具，而是模拟了亚马逊 A9 算法的“大脑”，通过 **“策略官 (Strategy Director)”** 与 **“视觉执行官 (Visual Director)”** 的双智能体协作，将简单的产品关键词转化为高转化率的视觉营销方案。

本项目已升级至 **v4.0 架构**，支持多模态模型管理、异构 API 集成（如 OpenAI 同步流与 ModelScope 异步流）以及企业级的资产配置。

## ✨ 核心特性 (Key Features)

### 🧠 A9 智能体双核引擎
- **首席策略官 (Brain)**: 深度分析产品卖点 (USPs)、目标受众与竞品痛点，生成符合亚马逊 SEO 逻辑的营销文案与视觉指导书。
- **视觉执行官 (Artist)**: 接收策略官的“神谕” (Prompt)，自动调用绘图模型生成场景化的高清主图。
- **全链路协同**: 自动提取策略中的视觉描述，无需人工干预即可完成“文生图”闭环。

### 🎛️ 企业级模型资产管理 (v4.0 New!)
- **预设模版系统 (Presets)**: 内置 **OpenAI, DeepSeek, Google Gemini, Anthropic, Aliyun** 等主流厂商配置，一键接入。
- **异构协议支持**:
  - ✅ 支持标准 OpenAI 格式 (同步响应)。
  - ✅ 支持 **ModelScope (阿里魔搭)** 异步轮询机制 (Async Polling)，完美集成 **Z-Image** 等高性能开源模型。
- **严格连通性测试**: 杜绝“假成功”，真实发送探测包验证 API Key 与权限。
- **多类型分类**: 清晰管理 📝 文本模型 / 🎨 图像模型 / 🛠️ 功能插件。

### 🖥️ 现代化工作台
- **极简 UI**: 黑色深色模式，专注于内容的沉浸式体验。
- **实时日志**: 像黑客帝国一样展示 AI 的思考与执行过程。
- **响应式设计**: 适配各种屏幕尺寸。

## 🛠️ 技术栈 (Tech Stack)

- **Frontend framework**: React 18 + TypeScript
- **Build Tool**: Vite
- **Styling**: Tailwind CSS
- **Icons**: Lucide React
- **State Management**: React Hooks + LocalStorage Persistence
- **API Client**: Custom Native Fetch Service (No heavy SDKs)

## 🚀 快速开始 (Getting Started)

### 1. 克隆项目
```bash
git clone [https://github.com/xiaoche0907/antigravity-visual-architect.git](https://github.com/xiaoche0907/antigravity-visual-architect.git)
cd antigravity-visual-architect
2. 安装依赖
Bash

npm install
# 或者
yarn install
3. 启动开发服务器
Bash

npm run dev
打开浏览器访问 http://localhost:3000 即可使用。

⚙️ 配置指南 (Configuration Guide)
第一步：添加模型资产
进入左侧 “模型资产库” 图标。

点击 “添加模型”。

选择预设（如 DeepSeek 或 ModelScope）。

填入你的 API Key。

点击 [⚡ 测试连接] 确保连通性，然后保存。

第二步：组建 AI 团队
进入 “员工管理” 界面。

为 首席策略官 指派一个强逻辑的文本模型（推荐 DeepSeek-V3 或 GPT-4）。

为 视觉执行官 指派一个绘图模型（推荐 Z-Image 或 DALL·E 3）。

点击保存。

第三步：启动引擎
回到 工作台 (Workspace)。

输入产品名称（如“主动降噪蓝牙耳机”）。

填写核心卖点。

点击 [🚀 启动 A9 架构引擎]，观察 AI 如何协同工作。

🤝 贡献 (Contributing)
欢迎提交 Issue 和 Pull Request！ 如果你想添加新的模型厂商预设，请修改 src/constants/modelPresets.ts。

📄 开源协议 (License)
MIT License.
