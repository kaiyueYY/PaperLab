# PaperLab 开发文档

## 1. 项目定位
PaperLab 是一个面向学术写作场景的前端应用，目标是通过「多阶段智能体流程」帮助用户从研究主题出发，完成：

1. 文献检索与筛选
2. 文献元数据展示
3. 文献综述自动生成（APA 7th 风格）

当前项目处于 MVP 阶段，重点是打通核心交互流程与可视化体验。

## 2. 技术栈
- 框架：React 19 + TypeScript
- 构建：Vite 6
- 样式：Tailwind CSS v4（`@import "tailwindcss"` + `@theme`）
- 动画：Motion (`motion/react`)
- 图标：Lucide React
- Markdown 渲染：react-markdown
- LLM SDK：`@google/genai`

## 3. 目录结构

```text
.
├── src/
│   ├── components/
│   │   └── LiteratureReview.tsx      # 核心业务界面
│   ├── services/
│   │   └── geminiService.ts          # 大模型调用与内容生成
│   ├── lib/
│   │   └── utils.ts                  # 工具函数
│   ├── App.tsx                       # 应用壳层、导航与主布局
│   ├── main.tsx                      # 应用入口
│   ├── types.ts                      # 业务类型定义
│   └── index.css                     # 全局样式与主题变量
├── docs/
│   └── DEVELOPMENT.md                # 本文档
├── index.html
├── package.json
└── vite.config.ts
```

## 4. 本地开发

### 4.1 环境要求
- Node.js 18+
- npm 9+

### 4.2 安装与启动
```bash
npm install
npm run dev
```

默认开发端口：`3000`

### 4.3 类型检查与构建
```bash
npm run lint
npm run build
npm run preview
```

## 5. 环境变量约定
当前服务层使用 `import.meta.env.VITE_GEMINI_API_KEY` 获取 API Key。

约定：
- `.env.local` 中使用 `VITE_GEMINI_API_KEY=...`
- 代码中通过 `import.meta.env.VITE_GEMINI_API_KEY` 读取

## 6. 核心流程说明
### 6.1 交互主流程（`LiteratureReview`）
1. 用户输入研究主题。
2. 点击「开启深度研究」。
3. 前端依次模拟/触发 4 个阶段：
   - 多源文献检索
   - 质量评估与筛选（调用 `performPaperLab`）
   - 核心观点提取（当前以流程日志模拟）
   - APA 综述撰写（调用 `generateApaReview`）
4. 右侧展示 Markdown 综述内容。
5. 左侧展示筛选后的文献卡片，可打开详情弹窗。

### 6.2 文件上传流程
1. 用户上传文档（`pdf/doc/docx/txt`）。
2. 当前实现以模拟文本作为输入。
3. 调用 `extractPaperMetadata` 生成元数据并插入文献列表。

> 说明：上传文件的真实解析（PDF 抽取、DOCX 解析）尚未接入。

## 7. 数据模型
定义位于 `src/types.ts`：
- `ViewType`: 当前仅 `literature`
- `Paper`: 文献元数据（标题、作者、分区、DOI、摘要、标签等）
- `ResearchStep`: 多阶段流程状态（pending/running/completed/error）
- `LiteratureReviewResult`: 综述结果（内容 + 引文）

## 8. 开发规范
- 所有业务实体先在 `src/types.ts` 定义，再进入组件与服务层。
- 服务层（`src/services`）只做模型调用与数据转换，不处理复杂 UI 状态。
- 组件状态遵循最小化原则：
  - 输入态：`topic`
  - 结果态：`papers`、`review`
  - 过程态：`loading`、`steps`、`logs`
- 新增模块优先保持可组合与可替换，避免把新能力全部堆到 `LiteratureReview.tsx`。

## 9. 已知问题与技术债
1. API Key 读取方式需迁移到 `import.meta.env`。
2. `geminiService.ts` 返回数据缺少运行时校验，模型输出异常时可能导致 `JSON.parse` 失败。
3. 上传解析仍为模拟逻辑，未做真实文档抽取与分块处理。
4. 错误处理主要以日志展示，缺少分级错误提示与重试策略。
5. 当前仅单页面单模块，后续扩展模块时需要引入路由与更清晰的状态边界。

## 10. 推荐迭代路线

### 阶段 A：稳定性
1. 为模型返回增加 schema 校验（如 Zod）。
2. 增加统一错误模型和用户可见错误提示。

### 阶段 B：真实性
1. 接入真实文献检索源（可先从一个数据源做 PoC）。
2. 打通上传文件内容抽取与引用信息识别。
3. 支持文献去重与相似文献聚类。

### 阶段 C：可用性
1. 增加综述版本历史与对比。
2. 支持导出 Word/PDF（目前按钮为占位）。
3. 引入用户配置页（引用风格、输出长度、领域偏好）。

## 11. 本次文档基线对应版本
- 日期：2026-03-29
- 分支状态：本地开发中（未发布）
- 范围：基于当前仓库代码的开发说明，不含后端服务与生产部署细节
