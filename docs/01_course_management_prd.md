# PRD：K2 核心课程管理

> 文档版本：v1.0  
> 创建日期：2026-03-09  
> 状态：草稿

---

## 1. 背景与目标

Deer Duo 是面向 K2（小学低年级，约 6–8 岁）学生的辅助学习平台。核心课程管理模块涵盖：

- **管理端**：教师 / 管理员录入各学科教学内容（课时、知识点、素材）
- **用户端**：学生（或家长代操作）将课程内容绑定到当天学习计划，设置学习任务，并通过 AI 对话获得即时辅导

目标：让 K2 学生在语文、数学、英语三门核心学科上形成"内容 → 计划 → 任务 → 辅导"的完整学习闭环。

---

## 2. 用户角色

| 角色 | 说明 |
|------|------|
| `admin` | 管理员 / 教师，拥有内容录入权限 |
| `user` | 学生 / 家长，使用学习端功能 |

---

## 3. 学科范围

目前支持三门学科：

| 学科代码 | 学科名称 |
|----------|----------|
| `chinese` | 语文 |
| `math` | 数学 |
| `english` | 英语 |

---

## 4. 功能用例

### Case 1 · 管理员录入学科内容

**Actor**：admin  
**路径**：管理后台 → 课程管理 → 选择学科 → 新建 / 编辑课时

**主流程**：

1. 管理员登录后进入"课程管理"页。
2. 选择学科（语文 / 数学 / 英语）。
3. 在该学科下新建"章节（Chapter）"，填写章节名称、排序序号。
4. 在章节下新建"课时（Lesson）"，填写：
   - 课时标题（`title`）
   - 正文内容（`content`，富文本 / Markdown）
   - 附加标签（可选，如"第一单元"、"识字"）
5. 保存后课时进入"已发布"状态，可被用户端绑定。
6. 管理员可编辑 / 停用已有课时。

**验收标准**：

- 同一学科下课时列表按章节 + 序号排序显示。
- 内容保存后立即对用户端可见（`status = 'active'`）。
- 停用课时后用户端不可新增绑定，已绑定的历史记录保留。

---

### Case 2 · 用户将课时绑定到今天

**Actor**：user  
**路径**：学习首页 → 今日学习 → 添加课时

**主流程**：

1. 用户进入"今日学习"页面（日期默认为当天）。
2. 点击"添加课时"，弹出课程选择器。
3. 按学科筛选，浏览课时列表，选择一个或多个课时。
4. 确认后，所选课时被绑定到当天（`study_date = today`），生成"学习记录（StudyRecord）"。
5. 今日学习页面展示当天所有已绑定课时，并显示进度状态（未开始 / 进行中 / 完成）。

**验收标准**：

- 同一课时同一天只能绑定一次（唯一约束）。
- 支持绑定多个不同学科的课时到同一天。
- 历史日期的绑定记录可查看但不可修改（只读）。

---

### Case 3 · 为绑定的课时设置学习任务

**Actor**：user  
**路径**：今日学习 → 点击某课时 → 任务列表 → 新增任务

**主流程**：

1. 用户在当天学习记录中点击某课时。
2. 进入该课时的详情页，右侧展示任务列表。
3. 用户点击"添加任务"，选择任务类型：

   | 任务类型代码 | 展示名称 |
   |--------------|----------|
   | `homework`   | 作业 |
   | `recitation` | 背诵 |
   | `preview`    | 预习 |
   | `review`     | 复习 |

4. 填写任务备注（可选），保存。
5. 任务默认状态为"未完成（`pending`）"。
6. 用户可将任务标记为"已完成（`done`）"，并记录完成时间。
7. 用户可删除任务。

**验收标准**：

- 同一课时学习记录下可添加多个同类型任务（如两个"作业"）。
- 任务完成状态变更实时同步，页面无需刷新。
- 当天所有任务完成后，学习记录状态自动更新为"完成"。

---

### Case 4 · AI 对话辅导

**Actor**：user  
**路径**：今日学习 → 点击某课时 → AI 辅导 Tab

**主流程**：

1. 用户在课时详情页切换到"AI 辅导"标签。
2. 系统将当天该课时的标题、正文内容摘要及未完成任务列表作为上下文注入 AI 系统提示（System Prompt）。
3. 用户以自然语言输入问题或请求（如"帮我出 5 道加减法练习题"、"给我讲解这个生字"）。
4. AI 返回针对该课时的内容生成或问题解答。
5. 对话历史在当次会话内保留；刷新页面后重新开始新会话（不持久化到数据库）。

**AI System Prompt 模板**（伪代码）：

```
你是一名专业的小学低年级辅导老师，当前辅导的科目是【{subject}】。
今天的学习课时是：【{lesson.title}】
课时内容摘要：{lesson.content_summary}
今日待完成任务：{task_list}
请根据以上内容，用简单易懂的语言回答学生的问题，或按需生成练习题。
```

**验收标准**：

- AI 对话入口仅对已绑定的课时开放。
- System Prompt 中注入的内容摘要不超过 500 字，以防超出 Token 限制。
- 若 AI 服务不可用，给出友好错误提示，不阻断其他功能。

---

## 5. 信息架构

```
subjects（学科）
  └── chapters（章节）
        └── lessons（课时）
              ↓ 被用户绑定
study_records（学习记录 = 用户 × 课时 × 日期）
  └── tasks（学习任务）
```

---

## 6. 数据库设计

> 数据库引擎：Cloudflare D1（SQLite 兼容）

### 6.1 `subjects` — 学科表

| 列名 | 类型 | 说明 |
|------|------|------|
| `id` | INTEGER PK AUTOINCREMENT | 主键 |
| `code` | TEXT NOT NULL UNIQUE | 学科代码，如 `chinese` |
| `name` | TEXT NOT NULL | 学科名称，如 `语文` |
| `sort_order` | INTEGER NOT NULL DEFAULT 0 | 排序序号（升序） |

预置数据：

```sql
INSERT INTO subjects (code, name, sort_order) VALUES
  ('chinese', '语文', 1),
  ('math',    '数学', 2),
  ('english', '英语', 3);
```

---

### 6.2 `chapters` — 章节表

| 列名 | 类型 | 说明 |
|------|------|------|
| `id` | INTEGER PK AUTOINCREMENT | 主键 |
| `subject_id` | INTEGER NOT NULL FK → subjects.id | 所属学科 |
| `title` | TEXT NOT NULL | 章节名称 |
| `sort_order` | INTEGER NOT NULL DEFAULT 0 | 同学科内排序序号 |
| `created_at` | DATETIME DEFAULT CURRENT_TIMESTAMP | 创建时间 |

---

### 6.3 `lessons` — 课时表

| 列名 | 类型 | 说明 |
|------|------|------|
| `id` | INTEGER PK AUTOINCREMENT | 主键 |
| `chapter_id` | INTEGER NOT NULL FK → chapters.id | 所属章节 |
| `title` | TEXT NOT NULL | 课时标题 |
| `content` | TEXT | 课时正文（Markdown） |
| `tags` | TEXT | 逗号分隔标签（可选） |
| `sort_order` | INTEGER NOT NULL DEFAULT 0 | 同章节内排序序号 |
| `status` | TEXT NOT NULL DEFAULT 'active' | `active` / `inactive` |
| `created_by` | INTEGER FK → users.id | 创建管理员 ID |
| `created_at` | DATETIME DEFAULT CURRENT_TIMESTAMP | 创建时间 |
| `updated_at` | DATETIME DEFAULT CURRENT_TIMESTAMP | 最后更新时间 |

---

### 6.4 `study_records` — 学习记录表（用户 × 课时 × 日期）

| 列名 | 类型 | 说明 |
|------|------|------|
| `id` | INTEGER PK AUTOINCREMENT | 主键 |
| `user_id` | INTEGER NOT NULL FK → users.id | 学习用户 |
| `lesson_id` | INTEGER NOT NULL FK → lessons.id | 绑定课时 |
| `study_date` | TEXT NOT NULL | 学习日期，格式 `YYYY-MM-DD` |
| `status` | TEXT NOT NULL DEFAULT 'pending' | `pending` / `in_progress` / `done` |
| `created_at` | DATETIME DEFAULT CURRENT_TIMESTAMP | 绑定时间 |

**唯一约束**：`(user_id, lesson_id, study_date)` — 同一用户同一课时同一天只能绑定一次。

---

### 6.5 `tasks` — 学习任务表

| 列名 | 类型 | 说明 |
|------|------|------|
| `id` | INTEGER PK AUTOINCREMENT | 主键 |
| `study_record_id` | INTEGER NOT NULL FK → study_records.id | 所属学习记录 |
| `task_type` | TEXT NOT NULL | `homework` / `recitation` / `preview` / `review` |
| `note` | TEXT | 任务备注（可选） |
| `status` | TEXT NOT NULL DEFAULT 'pending' | `pending` / `done` |
| `completed_at` | DATETIME | 完成时间（完成后更新） |
| `created_at` | DATETIME DEFAULT CURRENT_TIMESTAMP | 创建时间 |

---

### 6.6 完整建表 SQL

```sql
-- Migration: 0002_course_management

CREATE TABLE IF NOT EXISTS subjects (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  code       TEXT NOT NULL UNIQUE,
  name       TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0
);

INSERT OR IGNORE INTO subjects (code, name, sort_order) VALUES
  ('chinese', '语文', 1),
  ('math',    '数学', 2),
  ('english', '英语', 3);

CREATE TABLE IF NOT EXISTS chapters (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  subject_id INTEGER NOT NULL REFERENCES subjects(id) ON DELETE CASCADE,
  title      TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS lessons (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  chapter_id INTEGER NOT NULL REFERENCES chapters(id) ON DELETE CASCADE,
  title      TEXT NOT NULL,
  content    TEXT,
  tags       TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  status     TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
  created_by INTEGER REFERENCES users(id),
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS study_records (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  lesson_id  INTEGER NOT NULL REFERENCES lessons(id) ON DELETE CASCADE,
  study_date TEXT NOT NULL,
  status     TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'done')),
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (user_id, lesson_id, study_date)
);

CREATE TABLE IF NOT EXISTS tasks (
  id               INTEGER PRIMARY KEY AUTOINCREMENT,
  study_record_id  INTEGER NOT NULL REFERENCES study_records(id) ON DELETE CASCADE,
  task_type        TEXT NOT NULL CHECK (task_type IN ('homework', 'recitation', 'preview', 'review')),
  note             TEXT,
  status           TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'done')),
  completed_at     DATETIME,
  created_at       DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

---

## 7. API 设计概览

所有路由以 `/api/` 为前缀，需携带 JWT Cookie（`token`）。管理员接口额外校验 `role === 'admin'`。

### 7.1 学科

| 方法 | 路径 | 说明 | 权限 |
|------|------|------|------|
| GET | `/api/subjects` | 获取所有学科列表 | 所有已登录用户 |

### 7.2 章节

| 方法 | 路径 | 说明 | 权限 |
|------|------|------|------|
| GET | `/api/subjects/:subjectId/chapters` | 获取某学科下所有章节 | 所有已登录用户 |
| POST | `/api/subjects/:subjectId/chapters` | 新建章节 | admin |
| PUT | `/api/chapters/:id` | 修改章节 | admin |
| DELETE | `/api/chapters/:id` | 删除章节（级联删除课时） | admin |

### 7.3 课时

| 方法 | 路径 | 说明 | 权限 |
|------|------|------|------|
| GET | `/api/chapters/:chapterId/lessons` | 获取章节下所有课时 | 所有已登录用户 |
| GET | `/api/lessons/:id` | 获取单个课时详情 | 所有已登录用户 |
| POST | `/api/chapters/:chapterId/lessons` | 新建课时 | admin |
| PUT | `/api/lessons/:id` | 修改课时 | admin |
| DELETE | `/api/lessons/:id` | 删除课时 | admin |

### 7.4 学习记录（绑定课时到日期）

| 方法 | 路径 | 说明 | 权限 |
|------|------|------|------|
| GET | `/api/study-records?date=YYYY-MM-DD` | 获取当前用户某天的学习记录 | user |
| POST | `/api/study-records` | 绑定课时到某天 | user |
| DELETE | `/api/study-records/:id` | 取消绑定（仅限当天） | user |

### 7.5 学习任务

| 方法 | 路径 | 说明 | 权限 |
|------|------|------|------|
| GET | `/api/study-records/:recordId/tasks` | 获取某学习记录下所有任务 | user |
| POST | `/api/study-records/:recordId/tasks` | 新增任务 | user |
| PATCH | `/api/tasks/:id` | 更新任务状态 / 备注 | user |
| DELETE | `/api/tasks/:id` | 删除任务 | user |

### 7.6 AI 辅导

| 方法 | 路径 | 说明 | 权限 |
|------|------|------|------|
| POST | `/api/study-records/:recordId/ai-chat` | 发起 AI 对话（流式响应） | user |

请求体：

```json
{
  "message": "帮我出 5 道加减法练习题"
}
```

---

## 8. 页面结构

### 管理端

| 路由 | 页面 | 功能 |
|------|------|------|
| `/admin/courses` | 课程管理列表 | 按学科展示章节 + 课时树形结构 |
| `/admin/courses/chapters/new` | 新建章节 | 填写章节信息 |
| `/admin/courses/lessons/new` | 新建课时 | 填写课时内容（Markdown 编辑器） |
| `/admin/courses/lessons/:id/edit` | 编辑课时 | 修改 / 停用课时 |

### 用户端

| 路由 | 页面 | 功能 |
|------|------|------|
| `/` 或 `/today` | 今日学习 | 显示今天绑定的所有课时和任务进度 |
| `/today/add` | 添加课时 | 浏览课时库，按学科筛选后绑定 |
| `/today/records/:id` | 课时详情 | 查看课时内容、管理任务、AI 辅导对话 |

---

## 9. 非功能需求

| 类别 | 要求 |
|------|------|
| 性能 | 课时列表接口 P99 响应 < 300 ms |
| 安全 | 所有 API 校验 JWT Cookie；AI 对话注入的内容不包含敏感信息 |
| 兼容性 | 用户端支持移动端浏览器（iOS Safari / Android Chrome） |
| 可扩展性 | 学科 / 任务类型通过数据库配置，无需改代码即可新增 |

---

## 10. 里程碑

| 阶段 | 内容 | 预计完成 |
|------|------|----------|
| M1 | 数据库迁移 + 管理端课时 CRUD API | — |
| M2 | 管理端页面（章节 + 课时管理） | — |
| M3 | 用户端今日学习 + 绑定课时 + 任务管理 | — |
| M4 | AI 辅导对话集成 | — |
