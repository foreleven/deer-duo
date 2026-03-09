# GitHub Copilot Instructions

## 项目概述

本项目是基于 **Hono + React + Tailwind CSS v4** 构建的前后端同构 Cloudflare Worker 应用，使用 D1 数据库和 JWT Cookie 认证。

## 技术栈

- **后端**：Hono v4（Cloudflare Workers）
- **前端**：React 19 + Vite 6
- **样式**：Tailwind CSS v4
- **数据库**：Cloudflare D1（SQLite）
- **认证**：JWT（httpOnly Cookie）
- **部署**：Cloudflare Pages + Workers

## 开发规范

### 代码风格

- 使用 TypeScript 编写所有代码，保持严格类型检查
- React 组件使用函数式组件和 Hooks
- 样式统一使用 Tailwind CSS v4 工具类，避免内联样式
- API 路由统一放在 `src/index.ts` 中，以 `/api/` 前缀区分

### 文件结构

- 页面组件放在 `src/pages/` 目录下
- 公共资源放在 `public/` 目录下
- 数据库迁移文件放在 `migrations/` 目录下
- 产品需求文档（PRD）放在 `docs/` 目录下，文件命名格式为 `01_xxx.md`（两位数字序号 + 下划线 + 描述性名称）

### 安全规范

- 不得将密钥、Token 等敏感信息提交到代码库
- JWT 密钥通过 `wrangler secret` 管理
- 所有需要认证的 API 必须校验 JWT Cookie

## UX 设计规范

### 交互原则

- **避免弹窗（Modal）打断用户流**：优先使用内联编辑（Inline Edit）或侧边抽屉（Drawer）替代全屏遮罩弹窗。只有确认删除等破坏性操作可使用浏览器原生 `confirm`，其他编辑/创建表单应就地展开。
- **双栏布局（Master-Detail）**：管理类页面采用左侧列表 + 右侧详情/操作区的分栏结构，减少页面跳转，提高操作效率。左侧列表宽度建议 `w-64`–`w-80`，右侧区域 `flex-1`。
- **即时反馈**：所有异步操作（保存、删除、导入）在提交按钮上显示加载状态（`disabled` + 文字变化），操作完成后立即刷新本地状态，无需整页刷新。
- **键盘友好**：内联输入框支持 `Enter` 确认、`Escape` 取消，减少鼠标操作。

### 视觉风格

- **色彩体系**：主操作色使用 `indigo-600`（`#4f46e5`），成功/激活状态使用 `emerald-400/600`，警告/导入操作使用 `amber-600`，危险操作使用 `red-400/600`，中性信息使用 `gray-400/500`。
- **圆角**：卡片、输入框、按钮统一使用 `rounded-xl`（12 px）；小型标签、徽章使用 `rounded-full`。
- **阴影层级**：静止卡片使用 `shadow-sm`，悬浮/激活卡片使用 `shadow-md`，避免过重阴影。
- **间距节奏**：页面内容区 padding 为 `p-6`；卡片内部 padding 为 `p-4`；列表项间距为 `gap-1`–`gap-3`；表单字段间距为 `space-y-3`–`space-y-4`。
- **状态指示**：使用小圆点（`w-2 h-2 rounded-full`）而非文字徽章来指示激活/停用状态，节省空间；悬浮时再显示操作按钮（`opacity-0 group-hover:opacity-100`）。

### 布局规范

- **管理页面结构**：顶部固定 Header（含返回按钮、页面标题）→ 主体分栏区域（左侧导航列表 + 右侧内容面板），整体高度撑满 viewport（`flex flex-col h-full`）。
- **左侧面板**：背景色 `bg-gray-50/60`，右侧 `border-r border-gray-100`；包含筛选器（Subject Tabs）、操作按钮区、可滚动列表。
- **右侧面板**：背景色 `bg-white`，内容区 `p-6`；空状态居中展示图标 + 提示文字；数据区使用响应式卡片网格（`grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3`）。
- **卡片设计**：白色背景 + 细边框 `border border-gray-100`；底部操作栏背景 `bg-gray-50/80`，操作按钮默认隐藏，悬浮时淡入。

### 表单规范

- **内联新建表单**：新建操作默认折叠（仅显示「+ 新建」按钮），点击后就地展开表单，带明显的视觉区分（浅色背景 + 边框）。
- **内联编辑**：点击「编辑」后，卡片/列表项切换为编辑态（`border-2 border-indigo-300`），表单与视图使用相同宽度，避免布局抖动。
- **批量导入**：提供 JSON 粘贴区域，附带格式说明和示例；导入结果内联展示，不弹窗。
- **输入框样式**：`px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400`，Markdown 内容区增加 `font-mono resize-y`。

## PR 提交要求

**完成开发后，若 PR 涉及 UI 变更，提交 Pull Request 时必须在 PR 描述中附上相关页面的截图。**

截图要求：
- 包含所有新增或修改的页面/功能的截图
- 截图需清晰展示功能效果
- 若涉及多个状态（如登录前/后、成功/失败等），需分别截图说明
- 截图可直接粘贴到 PR 描述中，或以 Markdown 图片格式插入
- 若本次改动不涉及任何 UI 变更，请在 PR 描述中的「截图」小节标注 `N/A`。

示例格式：

```markdown
## 截图

### 登录页
![登录页截图](https://...)

### 仪表盘
![仪表盘截图](https://...)
```
