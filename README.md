# 🚀 Amazon A9 Visual Architect (AntiGravity)

![License](https://img.shields.io/badge/license-MIT-blue.svg) ![React](https://img.shields.io/badge/React-18-blue) ![TypeScript](https://img.shields.io/badge/TypeScript-5.0-blue) ![Version](https://img.shields.io/badge/version-7.2-green)

> **专为亚马逊跨境电商打造的 AI 视觉与策略生成引擎。**
>
> **AI-Powered Visual Strategy & Content Generator for Amazon A9 Algorithm.**

## 📖 项目简介 (Introduction)

**AntiGravity (反重力架构)** 是一个基于 AI 智能体协作的电商生产力工具。它模拟了亚马逊 A9 算法的"大脑"，通过 **的双智能体 (Dual-Agent) 流水线** 将简单的产品关键词转化为高转化率的视觉营销方案。

本项目已升级至 **v7.1 架构 (Quantum Leap)**，实现了**中文策略分析 + 英文执行指令**的完美分工。

## ✨ 核心特性 (Key Features)

### 🧠 双智能体 JSON 流水线 (v7.1 New!)

我们重构了核心管线，确保"思考"与"执行"的分离：

- **Agent A (Strategy Director)**:
  - **职责**: 深度分析 Visual DNA (品牌调性、光影策略) 和 Listing 布局。
  - **输出**: **强制中文 (CN)** 的策略理由 (`rationale`) 和视觉描述，确保用户秒懂。
  - **格式**: Strict JSON Schema，杜绝废话。
- **Agent B (Visual Director)**:
  - **职责**: 将中文策略翻译为专业的 Midjourney/Stable Diffusion 提示词。
  - **输出**: **强制英文 (EN)** 的执行指令 (`positive_prompt`)，包含 `[Layout]`, `[Lighting]` 等工程标签。

### 🎨 动态画幅控制 (Nanobanana Adaptive)

针对 **Grsai (Nanobanana)** 模型进行了底层优化：

- **Listing 主图/副图**: 自动锁定 **3:4 竖向画幅 (896x1152)**，完美适配移动端浏览体验。
- **A+ / 品牌故事**: 自动锁定 **21:9 / 16:9 超宽画幅 (1464x600)**，打造电影级视觉冲击力。

### 🎛️ 企业级模型资产管理

- **多模型支持**:
  - ✅ **Grsai (Nanobanana)**: **v7.1 首选推荐**。支持极速出图与 Pro 级画质。
  - ✅ **DeepSeek R1/V3**: 深度推理模型支持 (作为策略大脑)。
  - ✅ **Jiekou.ai**: 聚合接口支持 (MJ/Flux)。
  - ✅ **ModelScope / Aliyun**: 国内合规模型支持。
- **严格连通性测试**: 杜绝"假成功"，通过真实发送探测包验证 API Key 与权限。

### 🖥️ 现代化工作台

- **极简 UI**: 黑色深色模式，沉浸式体验。
- **Visual DNA 面板**: 可视化展示品牌色 (Hex Swatches) 与光影策略。
- **Code Block 预览**: 实时的 Agent B 提示词预览，支持一键复制。

### 💾 岗位指令预设管理 (v7.2 New!)

为"首席策略官"和"视觉技术总监"添加了**预设管理系统**：

- **保存预设**: 将当前岗位指令保存为自定义预设，支持自定义名称
- **切换预设**: 从下拉框快速切换不同的指令风格
- **删除预设**: 一键删除不需要的自定义预设
- **持久化存储**: 预设数据自动保存到本地，刷新不丢失

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
2. 添加 **Grsai** (用于生图) 和 **DeepSeek/OpenAI** (用于策略)。
3. 填入 API Key 并点击 **[⚡ 测试连接]**。

### 第二步：启动引擎

1. 回到 **工作台 (Workspace)**。
2. 输入产品名称与卖点 (e.g., "Sony WH-1000XM5, Noise Cancelling").
3. 点击 **[🚀 启动 A9 架构引擎]**。
4. 观察 Analysis Tab 中的 **中文策略分析**。
5. 切换到 Visual Generation Tab，查看 **3:4 竖向** 的副图方案。

## 🤝 贡献 (Contributing)

欢迎提交 Issue 和 Pull Request！

## 📄 开源协议 (License)

MIT License.
