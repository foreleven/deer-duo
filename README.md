# 🦌 Deer Duo

基于 **Hono + React + Tailwind CSS v4** 构建的前后端同构 Cloudflare 项目。

## 技术栈

| 层级 | 技术 |
|------|------|
| 后端 | [Hono](https://hono.dev/) v4 on Cloudflare Workers |
| 前端 | [React](https://react.dev/) 19 + [Vite](https://vite.dev/) 6 |
| 样式 | [Tailwind CSS v4](https://tailwindcss.com/) |
| 数据库 | [Cloudflare D1](https://developers.cloudflare.com/d1/) (SQLite) |
| 认证 | JWT（httpOnly Cookie） |
| 部署 | [Cloudflare Workers](https://workers.cloudflare.com/) |

## 功能

- ✅ 前后端同构 Cloudflare Worker 项目
- ✅ D1 数据库绑定（`deer-duo`），包含用户表
- ✅ 用户登录（JWT Cookie 认证）
- ✅ 内置 `admin` 管理员账号（无需注册）
- ✅ GitHub Actions CI/CD：PR 自动 preview 部署，`main` 分支自动部署到 Cloudflare Workers
- ✅ 自定义域名：https://duo.process.tech

## 本地开发

### 前置条件

- Node.js >= 18
- [Cloudflare 账号](https://dash.cloudflare.com/)
- `wrangler` CLI（项目依赖中已包含）

### 安装依赖

```bash
npm install
```

### 创建 D1 数据库

```bash
# 创建 D1 数据库
npx wrangler d1 create deer-duo

# 执行迁移（本地）
npx wrangler d1 execute deer-duo --local --file=./migrations/0001_create_users.sql

# 执行迁移（生产环境）
npx wrangler d1 execute deer-duo --remote --file=./migrations/0001_create_users.sql
```

### 启动开发服务器

```bash
npm run dev
```

访问 http://localhost:5173

### 构建

```bash
npm run build
```

### 部署

```bash
# 首先设置 JWT 密钥（必须，不要提交到代码库）
npx wrangler secret put JWT_SECRET

# 然后构建并部署
npm run deploy
```

## 管理员账号

| 字段 | 说明 |
|------|----|
| 用户名 | 默认管理员用户名为 `admin`（可在数据库中修改） |

> ⚠️ 默认管理员密码仅用于本地开发环境。生产环境请通过 D1 控制台或迁移脚本重新生成 PBKDF2 密码哈希并更新 `password_hash` 和 `salt` 字段，具体参考 `migrations/0001_create_users.sql` 中的注释。

## CI/CD 配置

在 GitHub 仓库的 **Settings → Secrets and variables → Actions** 中添加以下 Secrets：

| Secret | 说明 |
|--------|------|
| `CLOUDFLARE_API_TOKEN` | Cloudflare API Token（需有 Workers 权限） |
| `CLOUDFLARE_ACCOUNT_ID` | Cloudflare 账号 ID |

每次推送到 `main` 分支时，GitHub Actions 会自动构建并部署到 Cloudflare Workers。Pull Request 会自动触发 `wrangler versions upload` 生成 preview 版本用于验证。

## 自定义域名

在 Cloudflare Dashboard 中，为 Worker 绑定自定义域名 `duo.process.tech`：

1. 进入 Workers & Pages → deer-duo
2. 点击 **Settings → Domains & Routes**
3. 添加自定义域名 `duo.process.tech`

## 项目结构

```
deer-duo/
├── .github/
│   └── workflows/
│       └── deploy.yml         # CI/CD 工作流
├── migrations/
│   └── 0001_create_users.sql  # D1 数据库迁移
├── public/
│   └── favicon.svg
├── src/
│   ├── index.ts               # Hono Worker 入口（API 路由）
│   ├── client.tsx             # React 客户端入口
│   ├── App.tsx                # 根组件（路由控制）
│   ├── index.css              # Tailwind v4 样式入口
│   └── pages/
│       ├── Login.tsx          # 登录页
│       └── Dashboard.tsx      # 仪表盘页
├── index.html                 # HTML 模板
├── vite.config.ts             # Vite 配置
├── wrangler.toml              # Cloudflare Worker 配置
└── tsconfig.json
```

## API 接口

| 方法 | 路径 | 说明 |
|------|------|------|
| `POST` | `/api/login` | 登录，返回 JWT Cookie |
| `GET` | `/api/me` | 获取当前用户信息 |
| `POST` | `/api/logout` | 退出登录，清除 Cookie |

### 登录示例

```bash
curl -X POST https://duo.process.tech/api/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"<your-password>"}'
```
