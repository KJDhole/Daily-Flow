# Daily Flow — AI Native 个人每日计划管理系统

> **核心哲学**：计划可以跨天，任务生命周期必须完整，AI 可以直接操作网站。

Daily Flow 是一个极简、优雅、具有 AI 自主操作能力的个人每日计划管理系统。专为个人单用户打造，免除繁琐的用户系统，对外提供开放透明、高可用、高确定性的 REST API 与语义化网页端，支持各类具备工具调用能力的 AI（ChatGPT, Gemini, Claude, AutoGPT 等）或浏览器智能体（Browser Agents, Computer Use）直接制定、追踪与完成任务。

---

## 🌟 核心特性

1. **AI 通过网址自主操作**
   - `GET /ai/rules`：提供人机两用标准协议规范（支持 HTML 渲染与 Raw Markdown 文本）。
   - `GET /ai/manifest.json`：提供机器可读的 OpenAPI 3.0 Manifest 清单。
   - 包含反重复创建规则（Anti-Duplication）、自动幂等校验与生命周期规范。
2. **跨天延续机制（Carry Over）**
   - 计划无需当天必须完成。昨日或历史未完成任务次日自动在今日计划中延续显示。
   - 跨天任务**永久保留同一 ID**，严禁每天重新生成同名新记录。
   - 幂等记录 `carried_over` 事件，计算准确延续天数（如「延续 1 天」）。
3. **完整任务生命周期审计（Event Audit Trail）**
   - 所有任务状态流转（创建、修改、重新排期、延续、打勾完成、重新开启、软删除归档、恢复）全部记录到 `task_events` 事件流。
   - 支持计算完整生命周期自然日跨度（包括首尾日期）。
4. **软删除与即时撤销**
   - 删除操作默认执行软删除（归档），支持即时撤销（Undo）。
   - 历史记录保留完整时间线，不丢失任何事件。
5. **Google 风格极简设计 (Minimal / Clean / Calm)**
   - 浅灰背景 `#F8F9FA`、白色卡片、Google 蓝 `#1A73E8` 交互强调。
   - 严格执行 Zero-Pill 无药丸标签设计规范，采用清晰的中英混排与等宽数字对齐 (`tabular-nums`)。
6. **SQLite 真实持久化存储**
   - 数据保存在服务端 SQLite 数据库中（`./data/daily_flow.sqlite`），服务重启数据永不丢失。

---

## 📂 项目结构

```text
├── Dockerfile                  # 生产环境容器化构建配置
├── docker-compose.yml          # 单机一键部署与持久卷配置
├── package.json
├── tsconfig.json
├── vite.config.ts
├── index.html                  # 页面入口
├── server.ts                   # 全栈 Express + Vite 中间件开发与生产服务
├── server/
│   ├── time.ts                 # 统一时区（Asia/Shanghai）与自然日/延续日计算
│   ├── db.ts                   # SQLite 数据库模型、生命周期管理与事件存储
│   └── ai_rules.ts             # AI 协议规范文本、OpenAPI 清单与 HTML 渲染器
└── src/
    ├── main.tsx
    ├── index.css               # Tailwind CSS 与字体定义
    ├── types.ts                # 前端数据类型定义
    ├── api.ts                  # REST API 客户端方法
    ├── App.tsx                 # 主应用逻辑（今日工作台、任务流转、状态计算）
    └── components/
        ├── Header.tsx          # 顶部 3 区导航栏
        ├── ProgressBar.tsx     # 日期标题与完成进度条
        ├── TaskInput.tsx       # 语义化任务新增表单（AI 友好）
        ├── TaskItem.tsx        # 任务行（复选框、延续标签、编辑、归档）
        ├── TaskEditModal.tsx   # 任务修改对话框
        ├── HistoryView.tsx     # 历史记录检索、多维度筛选与统计
        ├── TimelineModal.tsx   # 任务全生命周期时间线弹窗
        ├── AiGuideModal.tsx    # AI 操作指南、Prompt 模板与实时沙盒
        └── Toast.tsx           # 操作反馈与撤销提示条
```

---

## 🚀 本地快速启动

### 依赖环境
- Node.js >= 20.x

### 启动命令
```bash
# 1. 安装依赖
npm install

# 2. 启动全栈开发服务（支持端口 3000）
npm run dev

# 浏览器访问：http://localhost:3000
```

---

## 🐳 Docker 生产部署

使用 Docker Compose 可以一键部署并自动映射 SQLite 数据卷：

```bash
# 启动容器
docker compose up -d --build

# 查看运行状态
docker compose ps

# 查看日志
docker compose logs -f
```

数据文件将自动保存在宿主机 `./data/daily_flow.sqlite` 目录中，即使容器销毁重建，数据也绝对不会丢失。

---

## 🤖 AI 智能体接入操作指南

### 1. 常用 Prompt 提示词指令
将以下内容直接提供给 ChatGPT、Gemini、Claude 等具有网络浏览或 HTTP 调用能力的智能体：

```text
你现在具有访问 Daily Flow 网站和 HTTP 接口的能力。
网站地址：http://<YOUR_HOST>:3000

操作流程：
1. 首先访问 GET /ai/rules，了解计划管理规则与任务规范。
2. 调用 GET /api/tasks?date=2026-10-13 查看我今天的已有计划。
3. 检查是否有历史未完成的延续任务，请勿重复新增同名任务。
4. 根据我的要求，帮我规划明天的任务，调用 POST /api/tasks 保存（source 标明为 "ai"）。
5. 向我汇报保存结果。
```

### 2. 核心 REST API 清单

| 方法 | 路径 | 描述 |
|---|---|---|
| `GET` | `/ai/rules` | 获取 AI 操作规则（HTML 或 Markdown） |
| `GET` | `/ai/manifest.json` | 获取 OpenAPI 3.0 机器清单 |
| `GET` | `/api/tasks` | 查询指定日期任务（默认今天） |
| `POST` | `/api/tasks` | 创建新任务（支持 title, description, planned_date, source） |
| `PATCH` | `/api/tasks/:id` | 修改任务标题、描述或重新排期 |
| `POST` | `/api/tasks/:id/complete` | 完成或重新开启任务 |
| `POST` | `/api/tasks/:id/archive` | 软删除归档任务 |
| `POST` | `/api/tasks/:id/restore` | 恢复已归档任务 |
| `GET` | `/api/history` | 检索历史任务列表（支持关键词与状态筛选） |
| `GET` | `/api/tasks/:id/events` | 查询单项任务的完整审计事件流 |
| `GET` | `/api/stats/today` | 获取今日进度统计比率与数据 |

---

## 🧪 核心业务规则与测试场景验证

- **场景 1：手动创建任务**：输入标题添加任务，页面实时更新，刷新后数据从 SQLite 加载仍然存在。
- **场景 2：跨天延续**：昨日未完成任务在今天自动显示，并标注「延续 1 天」；任务 ID 保持不变，同一任务同一天仅幂等生成一条 `carried_over` 事件。
- **场景 3：生命周期追踪**：点击任务「查看时间线」，完整展示从创建到延续、排期调整、打勾完成的所有事件与时间戳。
- **场景 4：防重复创建**：同一日期创建同名任务时，API 自动拦截并返回友好提示。
- **场景 5：软删除归档与撤销**：删除任务后弹出撤销通知，在历史记录中仍可查看并一键恢复。
