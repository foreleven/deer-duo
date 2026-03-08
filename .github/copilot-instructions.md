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

### 安全规范

- 不得将密钥、Token 等敏感信息提交到代码库
- JWT 密钥通过 `wrangler secret` 管理
- 所有需要认证的 API 必须校验 JWT Cookie

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
