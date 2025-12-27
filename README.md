# Antigravity Visual Architect (Amazon A9 Edition)

![License](https://img.shields.io/badge/license-Private-red.svg)
![Version](https://img.shields.io/badge/version-1.0.0-blue.svg)
![Tech Stack](https://img.shields.io/badge/stack-React%20%7C%20Vite%20%7C%20Tailwind-333333.svg)

**Antigravity Visual Architect** 是一款专为亚马逊跨境电商设计的 AI 视觉营销工作站。它基于 **A9 算法逻辑**，通过双引擎架构（Brain Engine + Visual Engine），将原本耗时数周的视觉策划缩短至分钟级。

> **核心能力：** 语义分析卖点、生成 5 张高转化副图策略、构建 7 张 A+ 页面叙事架构、自动生成 Midjourney/Nanobanana 提示词。

---

## 🏗️ 核心架构 (System Architecture)

本项目采用 **双引擎分离 (Dual-Engine Decoupled)** 架构，确保逻辑分析与图像生成的独立性与灵活性。

* **🧠 Brain Engine (大脑中枢)**
    * **职责**：负责 USP 拆解、受众画像分析、A+ 文案架构生成。
    * **核心驱动**：**ModelScope (魔搭/通义千问)** / Gemini Pro。
    * **特性**：支持自定义 System Prompt（智能体指令），可针对不同类目（3C、户外、家居）进行微调。

* **🎨 Visual Engine (视觉工坊)**
    * **职责**：负责将文本策略转化为具体的视觉图像参考。
    * **核心驱动**：**Nanobanana v2 Pro** / Midjourney / Flux。
    * **特性**：支持多模态输入（产品原图 + 风格参考图）。

---

## 🚀 快速开始 (Quick Start)

### 1. 环境准备 (Prerequisites)
* Node.js 18.0 或更高版本
* Git

### 2. 安装与运行 (Installation)

```bash
# 1. 克隆仓库
git clone [https://github.com/xiaoche0907/antigravity-visual-architect.git](https://github.com/xiaoche0907/antigravity-visual-architect.git)

# 2. 进入目录
cd antigravity-visual-architect

# 3. 安装依赖 (使用 npm 或 pnpm)
npm install

# 4. 启动本地开发服务器
npm run dev
启动后，访问 http://localhost:5173 (Vite 默认端口) 即可看到主界面。

⚙️ 配置指南 (Configuration)
本项目采用 客户端直连 (Client-side API Integration) 模式，无需配置复杂的后端代理。

启动项目后，点击侧边栏底部的 设置 (Settings) 图标。

配置大脑引擎 (Brain Engine)：

选择 ModelScope (OpenAI Compatible)。

填入 API Key (sk-...)。

可选：自定义 System Prompt 以调整分析风格。

配置视觉引擎 (Visual Engine)：

选择 Nanobanana v2 Pro。

填入 API Key。

提示：勾选 "Link Keys" 可共用 ModelScope 生态密钥。

安全提示：所有 API Key 仅存储在您浏览器的 localStorage 中，不会上传至任何服务器，确保数据隐私安全。

📖 使用流程 (Workflow)
Context Input (投喂素材)：

在左侧上传 产品多角度原图（建立 3D 认知）。

上传 风格参考图（定义调性）。

输入核心卖点 (USP) 和目标受众。

Strategy Generation (策略生成)：

点击 "Generate" 按钮，AI 将并行处理文本逻辑与视觉构思。

Review & Refine (审阅与交付)：

Tab 1 (Secondary Images)：查看 5 张副图的场景构建与提示词。

Tab 2 (A+ Content)：查看详情页的模块化布局建议。

📦 部署指南 (Deployment)
本项目完全兼容静态部署，推荐使用 Vercel 或 Netlify 进行一键托管。

Vercel 部署 (推荐)
登录 Vercel Dashboard。

点击 "Add New Project" -> "Import from GitHub"。

选择本项目仓库 antigravity-visual-architect。

Build Command 保持默认 (vite build 或 npm run build)。

Output Directory 保持默认 (dist)。

点击 Deploy。

部署完成后，您将获得一个永久的 HTTPS 访问链接，可分享给团队成员使用。

🛠️ 技术栈 (Tech Stack)
Framework: React 18 + TypeScript

Build Tool: Vite

Styling: Tailwind CSS + Lucide Icons

AI Integration: OpenAI SDK (Adapters for ModelScope/Gemini)
