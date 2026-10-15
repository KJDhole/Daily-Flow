/**
 * AI Rules and Manifest specifications for Daily Flow.
 * Exposes GET /ai/rules and GET /ai/manifest.json
 */

export const AI_RULES_MARKDOWN = `# Daily Flow — AI 自动化操作协议与规则规范

## 1. 核心定位与原则
Daily Flow 是一个面向个人用户的 AI Native 每日计划管理系统。
核心哲学：**「计划可以跨天，任务生命周期必须完整，AI 可以直接操作网站。」**

当人类用户对 AI 智能体发出类似指令时：
> 「打开我的 Daily Flow 网站，读取操作规则，帮我制定明天的计划，直接保存到网站中。」

AI 智能体应遵循本协议定义的标准流程与规范。

---

## 2. AI 智能体推荐操作流程（Standard SOP）
1. **查询既有计划**：首先调用 \`GET /api/tasks?date=YYYY-MM-DD\`，查看目标日期是否已有计划，避免重复创建。
2. **理解延续任务**：检查是否有从前几天延续过来的未完成任务（\`carry_over_days > 0\`），未完成任务会自动在今天延续，**切勿重新创建一条同名任务**。
3. **分析用户意图**：根据用户自然语言需求（例如拆解目标、添加新计划、调整日程、打勾完成）。
4. **执行任务创建/变更**：
   - 创建新任务：调用 \`POST /api/tasks\`（必须传入 \`source: "ai"\`）。
   - 调整已有任务：调用 \`PATCH /api/tasks/:id\`。
   - 标记完成任务：调用 \`POST /api/tasks/:id/complete\`。
   - 归档/软删除：调用 \`POST /api/tasks/:id/archive\`。
5. **确认并汇报**：检查返回的 HTTP 响应，向用户汇报已保存的新增或更新项。用户刷新网页即可立即看到。

---

## 3. 任务数据结构与字段规范
任务对象包含以下核心字段：
- \`id\` (string, UUID): 任务唯一且稳定的永久主键，跨天延续后 ID 保持不变。
- \`title\` (string, 必填): 任务简明标题。
- \`description\` (string, 可选): 详细说明、子要点或执行提示。
- \`status\` (string): 状态取值：
  - \`pending\`: 待完成
  - \`completed\`: 已完成
  - \`archived\`: 已软删除/归档（在历史记录可见，从今日视图隐去）
- \`created_at\` (string, ISO 8601): 首次创建的准确时间戳（只读，永不修改）。
- \`initial_planned_date\` (string, YYYY-MM-DD): 最初规划日期（只读，永不修改）。
- \`planned_date\` (string, YYYY-MM-DD): 当前计划执行日期（可通过编辑调整）。
- \`completed_at\` (string | null): 实际完成时间戳。
- \`archived_at\` (string | null): 软删除归档时间戳。
- \`source\` (string): 任务来源，取值为 \`"manual"\` 或 \`"ai"\`。
- \`carry_over_days\` (number): 跨天延续天数（由当前日期与最初日期计算得出）。
- \`lifecycle_days\` (number): 任务完整生命周期自然日跨度（包括首尾日期）。

---

## 4. 关键业务规则与红线

### 规则一：跨天延续（Carry Over）
- 未完成的任务（\`status = "pending"\`）不会在午夜被丢弃，第二天访问系统时会自动显示在「今日计划」中。
- 延续的任务**保持原有的任务 ID**，绝对不会为了跨天而新增一条新 ID 任务。
- 系统会在事件表记录 \`carried_over\` 事件，该事件具有**幂等性**（同一任务同一天仅记录一次）。

### 规则二：禁止重复创建（Anti-Duplication）
- 在同一日期（\`planned_date\`）下，禁止创建同名未归档任务。如果 AI 尝试创建同名任务，API 默认将返回 409 Conflict 错误并提示对应已有 ID。
- 若确实需要同名创建，必须显式传递 \`"allow_duplicate": true\`。

### 规则三：事件不可篡改与完整生命周期（Event Audit Trail）
- 每一个任务都拥有独立的时间线事件流（\`task_events\`）。
- 包含事件类型：\`created\`, \`edited\`, \`rescheduled\`, \`carried_over\`, \`completed\`, \`reopened\`, \`archived\`, \`restored\`。
- 任何更新操作均追加记录事件，严禁覆盖历史时间戳。

### 规则四：删除机制为软删除（Soft Delete）
- 调用 \`POST /api/tasks/:id/archive\` 只会标记 \`status = "archived"\`，不会物理删除数据行。
- 归档任务完整保留在 \`GET /api/history\` 中，并支持随时调用 \`POST /api/tasks/:id/restore\` 恢复。

### 规则五：时区标准
- 日期格式统一为 \`YYYY-MM-DD\`。
- 系统默认时区为 \`Asia/Shanghai\`（中国标准时间 UTC+8）。

---

## 5. HTTP REST API 接口定义

### 1) 查询任务列表
\`\`\`http
GET /api/tasks?date=2026-10-13&status=all
\`\`\`
- 参数：
  - \`date\`: 可选，YYYY-MM-DD，默认今天
  - \`status\`: 可选，\`pending\` | \`completed\` | \`all\`
- 响应：
\`\`\`json
{
  "success": true,
  "date": "2026-10-13",
  "data": [
    {
      "id": "c1f7b82e-...",
      "title": "学习 Python OpenCV",
      "description": "掌握图像处理基础核心算法",
      "status": "pending",
      "initial_planned_date": "2026-10-13",
      "planned_date": "2026-10-13",
      "carry_over_days": 0,
      "source": "ai",
      "created_at": "2026-10-13T09:00:00.000Z"
    }
  ]
}
\`\`\`

### 2) 创建新任务
\`\`\`http
POST /api/tasks
Content-Type: application/json

{
  "title": "完成季度项目交付清单",
  "description": "整理技术文档与演示 Demo",
  "planned_date": "2026-10-14",
  "source": "ai"
}
\`\`\`

### 3) 修改任务
\`\`\`http
PATCH /api/tasks/:id
Content-Type: application/json

{
  "title": "完成季度项目交付清单 (已更新)",
  "planned_date": "2026-10-15"
}
\`\`\`

### 4) 完成 / 取消完成任务
\`\`\`http
POST /api/tasks/:id/complete
Content-Type: application/json

{
  "completed": true
}
\`\`\`
*(传递 \`completed: false\` 时可重新打开任务)*

### 5) 归档 / 软删除任务
\`\`\`http
POST /api/tasks/:id/archive
\`\`\`

### 6) 恢复已归档任务
\`\`\`http
POST /api/tasks/:id/restore
\`\`\`

### 7) 查询历史全景
\`\`\`http
GET /api/history?search=OpenCV&status=all
\`\`\`

### 8) 查询任务完整生命周期事件流
\`\`\`http
GET /api/tasks/:id/events
\`\`\`

---

## 6. 浏览器智能体（Browser Agent）操作指南
若 AI 拥有浏览器图形界面操作能力（例如 Computer Use, Playwright, Puppeteer），可通过以下语义选择器直接操作：
- **新增任务输入框**：\`#task-title-input\` 或 \`[data-testid="add-task-input"]\`
- **任务描述输入框**：\`#task-desc-input\` 或 \`[data-testid="add-task-desc"]\`
- **提交新增按钮**：\`#add-task-submit\` 或 \`[data-testid="add-task-submit"]\`
- **完成复选框**：\`[data-testid="task-checkbox-{task-id}"]\`
- **编辑任务按钮**：\`[data-testid="task-edit-{task-id}"]\`
- **归档删除按钮**：\`[data-testid="task-archive-{task-id}"]\`
- **切换导航选项卡**：\`[data-testid="nav-today"]\` 与 \`[data-testid="nav-history"]\`

---

## 7. AI 常用提示词指令模板
用户可直接复制给任意智能体：
\`\`\`text
你现在具有访问 Daily Flow 网页和 HTTP 接口的能力。
请访问我的 Daily Flow 网站：https://<YOUR_APP_URL>
1. 先读取 /ai/rules 理解计划规则。
2. 调用 GET /api/tasks 查询我今天的既有计划。
3. 帮我合理拆解并创建明天（2026-10-14）的 3 项核心工作任务，标明 source 为 ai。
4. 调用 POST /api/tasks 保存，并向我汇报。
\`\`\`
`;

export const AI_MANIFEST_JSON = {
  openapi: "3.0.3",
  info: {
    title: "Daily Flow AI Native Task Planning API",
    version: "1.0.0",
    description: "Daily Flow is an AI-Native daily task management system supporting cross-day carryover, complete lifecycle audit timeline, and autonomous AI agents.",
    contact: {
      name: "Daily Flow Engineering",
      url: "/ai/rules"
    }
  },
  servers: [
    {
      url: "/",
      description: "Current Daily Flow Server"
    }
  ],
  paths: {
    "/ai/rules": {
      get: {
        summary: "Get AI Operational Rules and Guidelines",
        description: "Returns complete operating guidelines in Markdown or HTML for human and AI agents.",
        responses: {
          "200": {
            description: "AI Operational Rules Document",
            content: {
              "text/markdown": { schema: { type: "string" } },
              "text/html": { schema: { type: "string" } }
            }
          }
        }
      }
    },
    "/ai/manifest.json": {
      get: {
        summary: "Get OpenAPI Machine Manifest",
        description: "Returns this OpenAPI schema document.",
        responses: {
          "200": {
            description: "OpenAPI JSON Specification",
            content: { "application/json": {} }
          }
        }
      }
    },
    "/api/tasks": {
      get: {
        summary: "Query Daily Tasks",
        description: "Returns tasks planned for a specific date (defaults to today in Asia/Shanghai). Automatically carries over unfinished tasks from previous days without changing their unique IDs.",
        parameters: [
          {
            name: "date",
            in: "query",
            required: false,
            description: "Target planned date in YYYY-MM-DD format. Defaults to today.",
            schema: { type: "string", example: "2026-10-13" }
          },
          {
            name: "status",
            in: "query",
            required: false,
            description: "Filter by status: pending | completed | all",
            schema: { type: "string", enum: ["pending", "completed", "all"], default: "all" }
          }
        ],
        responses: {
          "200": {
            description: "List of tasks for the target date",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    success: { type: "boolean" },
                    date: { type: "string" },
                    data: {
                      type: "array",
                      items: { $ref: "#/components/schemas/Task" }
                    }
                  }
                }
              }
            }
          }
        }
      },
      post: {
        summary: "Create a New Task",
        description: "Creates a new task. Checks against duplicate active tasks on the same planned date to protect AI agents from unintentional spam.",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["title"],
                properties: {
                  title: { type: "string", description: "Task title" },
                  description: { type: "string", description: "Optional description", default: "" },
                  planned_date: { type: "string", description: "YYYY-MM-DD date. Defaults to today.", example: "2026-10-13" },
                  source: { type: "string", enum: ["manual", "ai"], default: "ai" },
                  allow_duplicate: { type: "boolean", default: false }
                }
              }
            }
          }
        },
        responses: {
          "201": {
            description: "Task created successfully",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    success: { type: "boolean" },
                    task: { $ref: "#/components/schemas/Task" }
                  }
                }
              }
            }
          },
          "400": { description: "Invalid parameters" },
          "409": { description: "Duplicate task already exists on that date" }
        }
      }
    },
    "/api/tasks/{id}": {
      patch: {
        summary: "Update Task",
        description: "Updates title, description, or planned date. Automatically logs 'edited' or 'rescheduled' event.",
        parameters: [
          { name: "id", in: "path", required: true, schema: { type: "string" } }
        ],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  title: { type: "string" },
                  description: { type: "string" },
                  planned_date: { type: "string", example: "2026-10-14" }
                }
              }
            }
          }
        },
        responses: {
          "200": {
            description: "Task updated",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    success: { type: "boolean" },
                    task: { $ref: "#/components/schemas/Task" }
                  }
                }
              }
            }
          }
        }
      }
    },
    "/api/tasks/{id}/complete": {
      post: {
        summary: "Complete or Reopen Task",
        description: "Sets task status to completed (or pending if completed: false). Logs 'completed' or 'reopened' event.",
        parameters: [
          { name: "id", in: "path", required: true, schema: { type: "string" } }
        ],
        requestBody: {
          required: false,
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  completed: { type: "boolean", default: true }
                }
              }
            }
          }
        },
        responses: {
          "200": {
            description: "Task completion toggled",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    success: { type: "boolean" },
                    task: { $ref: "#/components/schemas/Task" }
                  }
                }
              }
            }
          }
        }
      }
    },
    "/api/tasks/{id}/archive": {
      post: {
        summary: "Soft Delete (Archive) Task",
        description: "Archives task while preserving full historical events. Soft deletion ensures no data loss.",
        parameters: [
          { name: "id", in: "path", required: true, schema: { type: "string" } }
        ],
        responses: {
          "200": {
            description: "Task archived",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    success: { type: "boolean" },
                    task: { $ref: "#/components/schemas/Task" }
                  }
                }
              }
            }
          }
        }
      }
    },
    "/api/tasks/{id}/restore": {
      post: {
        summary: "Restore Archived Task",
        description: "Restores a soft-deleted task back to active pending or completed state.",
        parameters: [
          { name: "id", in: "path", required: true, schema: { type: "string" } }
        ],
        responses: {
          "200": {
            description: "Task restored",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    success: { type: "boolean" },
                    task: { $ref: "#/components/schemas/Task" }
                  }
                }
              }
            }
          }
        }
      }
    },
    "/api/history": {
      get: {
        summary: "Query Task History",
        description: "Returns all historical tasks including completed, carried over, and archived tasks with keyword search and status filters.",
        parameters: [
          { name: "search", in: "query", schema: { type: "string" } },
          { name: "status", in: "query", schema: { type: "string", enum: ["all", "completed", "pending", "carried_over", "archived"] } },
          { name: "from_date", in: "query", schema: { type: "string" } },
          { name: "to_date", in: "query", schema: { type: "string" } }
        ],
        responses: {
          "200": {
            description: "Historical tasks with lifecycle durations",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    success: { type: "boolean" },
                    data: {
                      type: "array",
                      items: { $ref: "#/components/schemas/Task" }
                    }
                  }
                }
              }
            }
          }
        }
      }
    },
    "/api/tasks/{id}/events": {
      get: {
        summary: "Get Task Lifecycle Audit Events",
        description: "Returns the complete timestamped timeline of events for a task in chronological order.",
        parameters: [
          { name: "id", in: "path", required: true, schema: { type: "string" } }
        ],
        responses: {
          "200": {
            description: "Chronological event list",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    success: { type: "boolean" },
                    task_id: { type: "string" },
                    data: {
                      type: "array",
                      items: { $ref: "#/components/schemas/TaskEvent" }
                    }
                  }
                }
              }
            }
          }
        }
      }
    }
  },
  components: {
    schemas: {
      Task: {
        type: "object",
        properties: {
          id: { type: "string", example: "45c8be0a-9d7a-4284-8840-7f28bc64b9b9" },
          title: { type: "string", example: "学习 Python OpenCV" },
          description: { type: "string", example: "掌握图像处理基础核心算法" },
          status: { type: "string", enum: ["pending", "completed", "archived"] },
          created_at: { type: "string", example: "2026-10-13T09:00:00.000Z" },
          initial_planned_date: { type: "string", example: "2026-10-13" },
          planned_date: { type: "string", example: "2026-10-13" },
          completed_at: { type: "string", nullable: true },
          archived_at: { type: "string", nullable: true },
          updated_at: { type: "string" },
          source: { type: "string", enum: ["manual", "ai"] },
          carry_over_days: { type: "integer", example: 0 },
          lifecycle_days: { type: "integer", example: 1 }
        }
      },
      TaskEvent: {
        type: "object",
        properties: {
          id: { type: "string" },
          task_id: { type: "string" },
          event_type: {
            type: "string",
            enum: ["created", "edited", "rescheduled", "carried_over", "completed", "reopened", "archived", "restored"]
          },
          event_date: { type: "string", example: "2026-10-13" },
          created_at: { type: "string", example: "2026-10-13T09:00:00.000Z" },
          details: { type: "string", example: "由 AI 智能体通过规则接口创建" }
        }
      }
    }
  }
};

/**
 * Clean HTML renderer for /ai/rules when requested via browser
 */
export function renderRulesHtml(): string {
  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Daily Flow — AI 自动化操作协议与规则</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700&family=Noto+Sans+SC:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap" rel="stylesheet">
  <style>
    :root {
      --bg: #F8F9FA;
      --card-bg: #FFFFFF;
      --text: #202124;
      --text-muted: #5F6368;
      --border: #E8EAED;
      --primary: #1A73E8;
      --primary-hover: #1557B0;
      --code-bg: #F1F3F4;
    }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: 'Plus Jakarta Sans', 'Noto Sans SC', system-ui, sans-serif;
      background-color: var(--bg);
      color: var(--text);
      line-height: 1.65;
      padding: 32px 16px 80px;
    }
    .container {
      max-width: 860px;
      margin: 0 auto;
    }
    header {
      background: var(--card-bg);
      border: 1px solid var(--border);
      border-radius: 12px;
      padding: 28px 32px;
      margin-bottom: 24px;
    }
    .badge {
      display: inline-block;
      font-size: 12px;
      font-weight: 600;
      color: var(--primary);
      background: #E8F0FE;
      padding: 4px 10px;
      border-radius: 6px;
      margin-bottom: 12px;
    }
    h1 {
      font-size: 26px;
      font-weight: 700;
      color: var(--text);
      letter-spacing: -0.02em;
      margin-bottom: 8px;
    }
    .subtitle {
      color: var(--text-muted);
      font-size: 15px;
    }
    .nav-actions {
      display: flex;
      gap: 12px;
      margin-top: 18px;
    }
    .btn {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      padding: 8px 16px;
      font-size: 13px;
      font-weight: 600;
      border-radius: 8px;
      text-decoration: none;
      transition: all 0.15s ease;
    }
    .btn-primary {
      background: var(--primary);
      color: #fff;
    }
    .btn-primary:hover { background: var(--primary-hover); }
    .btn-outline {
      background: #fff;
      color: var(--text);
      border: 1px solid var(--border);
    }
    .btn-outline:hover { background: var(--code-bg); }
    .card {
      background: var(--card-bg);
      border: 1px solid var(--border);
      border-radius: 12px;
      padding: 28px 32px;
      margin-bottom: 20px;
    }
    h2 {
      font-size: 19px;
      font-weight: 600;
      color: var(--text);
      margin-bottom: 16px;
      padding-bottom: 8px;
      border-bottom: 1px solid var(--border);
    }
    h3 {
      font-size: 16px;
      font-weight: 600;
      color: var(--text);
      margin: 18px 0 8px;
    }
    p, li {
      font-size: 15px;
      color: #3C4043;
      margin-bottom: 10px;
    }
    ul, ol {
      padding-left: 22px;
      margin-bottom: 14px;
    }
    li { margin-bottom: 6px; }
    code {
      font-family: 'JetBrains Mono', monospace;
      font-size: 13px;
      background: var(--code-bg);
      padding: 2px 6px;
      border-radius: 4px;
      color: #1A73E8;
    }
    pre {
      background: #202124;
      color: #F8F9FA;
      padding: 16px 20px;
      border-radius: 8px;
      overflow-x: auto;
      font-family: 'JetBrains Mono', monospace;
      font-size: 13px;
      line-height: 1.5;
      margin: 12px 0 18px;
    }
    pre code {
      background: transparent;
      color: inherit;
      padding: 0;
    }
    .tag-row {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
      margin-top: 10px;
    }
    .api-pill {
      font-family: 'JetBrains Mono', monospace;
      font-size: 12px;
      padding: 3px 8px;
      border-radius: 4px;
      border: 1px solid var(--border);
      background: #FAFAFA;
    }
    .method-get { color: #1E8E3E; font-weight: 600; }
    .method-post { color: #1A73E8; font-weight: 600; }
    .method-patch { color: #E37400; font-weight: 600; }
  </style>
</head>
<body>
  <div class="container">
    <header>
      <span class="badge">AI-NATIVE PROTOCOL</span>
      <h1>Daily Flow — AI 自动化操作协议与规则</h1>
      <p class="subtitle">供用户、ChatGPT、Gemini、Claude 及各类自主智能体调用的标准化任务管理操作规则。</p>
      <div class="nav-actions">
        <a href="/" class="btn btn-primary">返回今日工作台</a>
        <a href="/ai/manifest.json" class="btn btn-outline" target="_blank">查看 OpenAPI Manifest.json</a>
        <a href="/ai/rules?format=raw" class="btn btn-outline">获取 Raw Markdown</a>
      </div>
    </header>

    <div class="card">
      <h2>一、核心哲学与理念</h2>
      <p><strong>计划可以跨天，任务生命周期必须完整，AI 可以直接操作网站。</strong></p>
      <p>Daily Flow 为个人专属打造，免除登录验证，对外开放透明、确定性的 REST 接口与清晰的语义页面。任何支持 HTTP 工具调用或网页浏览操作的 AI 智能体，均可直接读取本规则并自主执行规划。</p>
    </div>

    <div class="card">
      <h2>二、AI 智能体标准执行步骤 (SOP)</h2>
      <ol>
        <li><strong>查询既有任务</strong>：调用 <code>GET /api/tasks?date=YYYY-MM-DD</code>，确认今日或目标日期的现有任务，<strong>严禁无故重复创建同名任务</strong>。</li>
        <li><strong>识别跨天延续任务</strong>：检查是否有前几日遗留未完成任务（系统已自动打上 <code>carry_over_days</code> 标记）。延续任务具有永久唯一 ID，切勿将其重复新增。</li>
        <li><strong>拆解并创建新任务</strong>：通过 <code>POST /api/tasks</code> 写入新计划，并附带 <code>"source": "ai"</code> 标记。</li>
        <li><strong>标记或归档</strong>：根据用户指令调用 <code>POST /api/tasks/:id/complete</code> 或 <code>POST /api/tasks/:id/archive</code>。</li>
        <li><strong>向用户汇报</strong>：告知新增或变更的任务项。用户刷新网页即见成果。</li>
      </ol>
    </div>

    <div class="card">
      <h2>三、核心 REST 接口清单</h2>
      <div class="tag-row" style="margin-bottom: 18px;">
        <span class="api-pill"><span class="method-get">GET</span> /api/tasks</span>
        <span class="api-pill"><span class="method-post">POST</span> /api/tasks</span>
        <span class="api-pill"><span class="method-patch">PATCH</span> /api/tasks/:id</span>
        <span class="api-pill"><span class="method-post">POST</span> /api/tasks/:id/complete</span>
        <span class="api-pill"><span class="method-post">POST</span> /api/tasks/:id/archive</span>
        <span class="api-pill"><span class="method-get">GET</span> /api/history</span>
        <span class="api-pill"><span class="method-get">GET</span> /api/tasks/:id/events</span>
      </div>

      <h3>1. 创建任务示例</h3>
      <pre><code>POST /api/tasks
Content-Type: application/json

{
  "title": "完成 Daily Flow 跨天机制实测",
  "description": "验证昨日未完成任务延续到今日的生命周期事件",
  "planned_date": "2026-10-13",
  "source": "ai"
}</code></pre>

      <h3>2. 查询任务列表示例</h3>
      <pre><code>GET /api/tasks?date=2026-10-13&status=all</code></pre>

      <h3>3. 标记任务完成示例</h3>
      <pre><code>POST /api/tasks/YOUR_TASK_ID/complete
Content-Type: application/json

{
  "completed": true
}</code></pre>
    </div>

    <div class="card">
      <h2>四、浏览器智能体（Browser Agent）网页操作属性</h2>
      <p>若 AI 使用浏览器点击与填写模式，网页已配置完整的语义标签与 <code>data-testid</code>：</p>
      <ul>
        <li>输入框标题：<code>#task-title-input</code> 或 <code>[data-testid="add-task-input"]</code></li>
        <li>输入框描述：<code>#task-desc-input</code> 或 <code>[data-testid="add-task-desc"]</code></li>
        <li>提交保存按钮：<code>#add-task-submit</code> 或 <code>[data-testid="add-task-submit"]</code></li>
        <li>任务勾选框：<code>[data-testid="task-checkbox-{id}"]</code></li>
        <li>软删除归档按钮：<code>[data-testid="task-archive-{id}"]</code></li>
      </ul>
    </div>
  </div>
</body>
</html>`;
}
