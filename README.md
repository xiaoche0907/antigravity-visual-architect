# 🚀 Amazon A9 Visual Architect (AntiGravity)

![License](https://img.shields.io/badge/license-MIT-blue.svg) ![React](https://img.shields.io/badge/React-18-blue) ![TypeScript](https://img.shields.io/badge/TypeScript-5.0-blue) ![Vite](https://img.shields.io/badge/build-Vite-yellow)

> **专为亚马逊跨境电商打造的 AI 视觉与策略生成引擎。**
> 
> **AI-Powered Visual Strategy & Content Generator for Amazon A9 Algorithm.**

## 📖 项目简介 (Introduction)

**AntiGravity (反重力架构)** 是一个基于 AI 智能体协作的电商生产力工具。它模拟了亚马逊 A9 算法的"大脑"，通过 **三阶段智能体流水线** 将简单的产品关键词转化为高转化率的视觉营销方案。

本项目已升级至 **v5.0 架构**，引入了 **视觉技术总监 (Prompt Engineer)** 角色，实现了从策略到提示词再到成图的完整 AI 协作流水线。

## ✨ 核心特性 (Key Features)

### 🧠 三阶段 AI 智能体流水线 (v5.0 New!)
- **首席策略官 (Strategy Director)**: 深度分析产品卖点 (USPs)、目标受众与竞品痛点，生成符合亚马逊 SEO 逻辑的营销策略与视觉简报。
- **视觉技术总监 (Prompt Engineer)**: 将策略官的抽象简报翻译为精确的 Nanobanana Pro 专用提示词，专注于光学物理参数与构图技术。
- **视觉执行官 (Visual Director)**: 接收技术总监的工程级 Prompt，生成高清商业图片。

```
用户输入 → 策略官分析 → 技术总监翻译 → 画师执行
```

### 🔗 实时进度反馈 (v5.0 New!)
- Toast 消息实时显示当前处理阶段：
  - "🧠 策略大脑正在分析 A9 转化要素..."
  - "🔗 视觉技术总监正在翻译为 Nanobanana 提示词..."
  - "✅ 分析完成！"

### 📋 一键复制提示词 (v5.0 New!)
- 副图生成和 A+ 详情页的每个提示词区域都配备了 **📋 复制** 按钮
- 一键复制到剪贴板，方便在 Midjourney/DALL-E 等平台使用

### 🎮 手动生图与画质控制
- **手动触发 (Manual Trigger)**: 策略分析完成后，点击任意图片占位符即可单独生成视觉图。
- **一键批量生成 (Batch Generation)**: 支持按标签页（副图/A+）一键生成所有未完成的图片。
- **画质选择器 (Resolution Selector)**:
  - **1K (Standard)**: 快速生成，适合预览与调试。
  - **2K/4K (HD/Ultra)**: 专为 Jiekou.ai 等高级接口设计，输出海报级超清素材。

### 🎛️ 企业级模型资产管理
- **多模型支持**:
  - ✅ **OpenAI / Anthropic / Google Gemini**: 标准同步流支持。
  - ✅ **DeepSeek R1/V3**: 深度推理模型支持。
  - ✅ **智谱 AI (Zhipu)**: 国产大模型首选。
  - ✅ **ModelScope (阿里魔搭)**: 异步任务轮询机制 (Async Polling)，完美集成 Z-Image。
  - ✅ **Jiekou.ai**: 聚合接口支持，一站式接入 Midjourney, Flux, SDXL。
- **严格连通性测试**: 杜绝"假成功"，通过真实发送探测包验证 API Key 与权限。

### 🖥️ 现代化工作台
- **极简 UI**: 黑色深色模式，沉浸式体验。
- **实时日志**: 可视化展示 AI 的思考路径与 API 交互细节。
- **错误恢复**: 生图失败支持一键重试，错误信息直观展示。

## 🛠️ 技术栈 (Tech Stack)

- **Frontend**: React 18 + TypeScript + Vite
- **Styling**: Tailwind CSS
- **Icons**: Lucide React
- **State Management**: React Hooks + LocalStorage Persistence
- **API Client**: Custom Native Fetch Service (No heavy SDKs)

## 🚀 快速开始 (Getting Started)

### 1. 克隆项目
```bash
git clone https://github.com/xiaoche0907/antigravity-visual-architect.git
cd antigravity-visual-architect
```

### 2. 安装依赖
```bash
npm install
# 或者
yarn install
```

### 3. 启动开发服务器
```bash
npm run dev
```
打开浏览器访问 `http://localhost:3000` 即可使用。

## ⚙️ 配置指南 (Configuration Guide)

### 第一步：添加模型资产
1. 进入左侧 **"模型资产库"** 图标。
2. 点击 **"添加模型"**。
3. 选择预设：
   - **文本模型**: 推荐使用 **DeepSeek-V3** (性价比之王) 或 **GPT-4o**。
   - **图像模型**: 
     - 追求极至画质推荐 **Jiekou.ai** (接入 MJ/Flux)。
     - 追求速度推荐 **ModelScope** (Z-Image Turbo)。
4. 填入 API Key 并点击 **[⚡ 测试连接]**。

### 第二步：组建 AI 团队
1. 进入 **"员工管理"** 界面。
2. 为 **首席策略官** 指派一个强逻辑文本模型（如 GPT-4o, DeepSeek-V3）。
3. 为 **视觉技术总监** 指派一个文本模型（推荐使用同一模型或专门的 Prompt 优化模型）。
4. 为 **视觉执行官** 指派一个绘图模型（如 Jiekou.ai, ModelScope）。

### 第三步：启动引擎
1. 回到 **工作台 (Workspace)**。
2. 输入产品名称与卖点。
3. 点击 **[🚀 启动 A9 架构引擎]**。
4. 观察 Toast 消息，确认两阶段 AI 分析完成。
5. 使用 **"画质选择器"** 设定分辨率，点击 **"一键生成所有"**。
6. 使用 **📋 复制** 按钮一键复制提示词到其他平台。

## 🤝 贡献 (Contributing)
欢迎提交 Issue 和 Pull Request！如果您想添加新的模型厂商预设，请修改 `src/types/models.ts`。

## 📄 开源协议 (License)
MIT License.
