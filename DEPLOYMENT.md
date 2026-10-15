# Daily Flow — 生产部署与低内存运维指南 (1C1G 优化版)

本文档针对 **1 核 CPU / 1 GB 内存 (1C1G)** 的 Ubuntu Linux 服务器，提供极简、低内存占用、高可靠性的生产部署方案。

---

## 一、系统架构与资源开销指标

本方案专为个人低并发场景设计，避免了 Vite 开发服务器、TypeScript 运行时 (tsx)、Redis、MySQL、Docker 引擎等额外开销：

| 组件 | 运行方式 | 内存开销预估 | 作用 |
|---|---|---|---|
| **Node.js 单进程** | `node dist/server.js` | **约 25MB ~ 35MB** | 提供 API、处理业务逻辑、托管静态文件 |
| **Nginx** | 官方稳定版 | **约 8MB ~ 12MB** | 80/443 端口反向代理、Gzip 压缩传输、连接复用 |
| **SQLite 数据库** | `sql.js` (WebAssembly) | **约 3MB ~ 6MB** | 零守护进程、数据写入磁盘文件、断电安全 |
| **日志收集** | `systemd-journald` (上限 50MB) | 共享系统内存 | 日志自动轮转，防止小磁盘爆满 |
| **整机总内存占用** | 包含 Ubuntu 系统内核与守护进程 | **< 200MB (空闲内存 > 800MB)** | 极端稳定，杜绝 OOM Kill 崩溃风险 |

---

## 二、标准生产目录规划

采用**程序代码与持久化数据物理分离**原则，应用更新、重新拉取代码时，绝不触碰历史数据库文件：

```text
/
├── opt/daily-flow/                    # [程序目录] 代码与构建产物
│   ├── dist/                          # 前端 HTML/CSS/JS + 编译后 server.js
│   │   ├── assets/
│   │   ├── index.html
│   │   └── server.js                  # esbuild 单文件打包 (仅 64KB)
│   ├── package.json
│   ├── node_modules/                  # 仅生产依赖 (npm install --omit=dev)
│   └── deploy/                        # systemd、Nginx 与运维脚本
│       ├── systemd/daily-flow.service
│       ├── systemd/daily-flow-backup.timer
│       ├── nginx/daily-flow.conf
│       └── scripts/backup.sh
│
├── var/lib/daily-flow/data/           # [核心持久化数据目录]
│   ├── daily_flow.sqlite              # SQLite 数据库主文件 (千万不要删除)
│   ├── daily_flow.sqlite.bak          # 自动保留的上一版本安全副本
│   └── .daily_flow.tmp.*              # 原子写入临时交换区 (自动回收)
│
└── var/backups/daily-flow/            # [自动备份归档目录]
    └── daily_flow_20261014_030000.sqlite.gz   # 每日压缩备份 (保留最近 7 天)
```

---

## 三、Ubuntu 生产环境首次部署步骤

### 步骤 1：本地或 CI 完成打包构建（推荐）
在本地电脑或 CI 构建机上运行：
```bash
# 安装依赖
npm install

# 一键构建前端静态资源 + 服务端单文件生产产物
npm run build
```
构建完成后将生成 `dist/` 目录，里面包含：
- `dist/index.html`
- `dist/assets/*.js`、`dist/assets/*.css`
- `dist/server.js`

### 步骤 2：同步代码到 Ubuntu 服务器
在本地通过 `rsync` 或 `scp` 同步至目标服务器（排除开发文件）：
```bash
rsync -avz --exclude 'node_modules' --exclude '.git' --exclude 'data' \
  ./ root@YOUR_SERVER_IP:/opt/daily-flow/
```

### 步骤 3：在 Ubuntu 服务器上运行一键安装
SSH 登录服务器后，执行项目内置的配置脚本：
```bash
cd /opt/daily-flow
sudo bash deploy/scripts/setup.sh
```

该脚本将全自动完成以下工作：
1. 检查并按需安装 Node.js 22 LTS 与 Nginx；
2. 创建安全的低权限运行用户 `dailyflow`（无 shell 登录权限）；
3. 建立独立持久化目录 `/var/lib/daily-flow/data` 并设置防越权权限；
4. 配置 `journald` 日志最大上限为 50MB；
5. 配置并启用 `daily-flow.service`（自启动 + 失败 3 秒自动重启 + 内存硬限制 250MB）；
6. 配置并启用 `daily-flow-backup.timer`（每日凌晨 03:00 自动冷备并清理 7 天前旧备份）；
7. 配置 Nginx 反向代理，代理 `/ai/rules`、`/ai/manifest.json`、`/api/*` 及根路径。

---

## 四、服务管理常用命令

| 需求 | 执行命令 |
|---|---|
| **查看服务运行状态** | `systemctl status daily-flow` |
| **实时查看运行日志** | `journalctl -u daily-flow -f` |
| **查看最近 100 行日志** | `journalctl -u daily-flow -n 100 --no-pager` |
| **重启主服务** | `systemctl restart daily-flow` |
| **停止主服务** | `systemctl stop daily-flow` |
| **测试健康与内存占用** | `curl http://127.0.0.1:3000/health` |
| **立即触发一次数据库备份** | `sudo bash /opt/daily-flow/deploy/scripts/backup.sh` |
| **查看备份文件列表** | `ls -lh /var/backups/daily-flow/` |

---

## 五、无损平滑更新步骤 (Zero-Loss Update)

后续如果对代码进行了功能调整或界面修改，更新流程如下：

### 1. 本地构建并同步产物
```bash
# 本地构建
npm run build

# 同步 dist、package.json 和 deploy 目录至服务器
rsync -avz dist package.json deploy root@YOUR_SERVER_IP:/opt/daily-flow/
```

### 2. 服务器上运行更新脚本
```bash
ssh root@YOUR_SERVER_IP "sudo bash /opt/daily-flow/deploy/scripts/update.sh"
```
更新脚本会自动：
- 在覆盖前强制为现有 SQLite 数据库创建一份带有时间戳的物理快照；
- 刷新生产依赖；
- 重启 systemd 服务；
- 请求 `/health` 自动验证重启状态。

由于数据库文件保存在 `/var/lib/daily-flow/data`，任何代码部署均绝对不会覆盖或丢失历史计划与任务事件！

---

## 六、SQLite 数据持久化与断电安全性技术说明

针对 `sql.js`（WebAssembly SQLite）在单用户、低并发场景下的可靠性，系统在 `server/db.ts` 中实现了 **POSIX 原子重命名（Atomic Rename）安全写入模型**：

1. **写入防损坏（Crash-Safe Atomic Write）**：
   - 每次数据变更时，系统先将内存数据库字节流写入临时文件 `.daily_flow.tmp.<PID>.<Timestamp>`；
   - 调用系统调用 `fs.fsyncSync` 强制将缓冲区数据刷入物理磁盘介质；
   - 自动生成一份上一版本的 `.bak` 镜像文件；
   - 通过 POSIX 系统的 `rename` 系统调用，原子替换主文件 `daily_flow.sqlite`。
   - **效果**：无论进程中途被 `SIGKILL` 杀死还是服务器突遭断电，主数据库文件要么是“变更前完整状态”，要么是“变更后完整状态”，绝对不会出现 0 字节损坏或文件截断。
2. **崩溃自动自愈（Auto-Recovery）**：
   - 如果主文件意外遇到不可读错误，系统初始化时会自动寻找 `daily_flow.sqlite.bak` 进行无损恢复。
3. **进程信号优雅退出（Graceful Shutdown）**：
   - 监听 `SIGINT` 和 `SIGTERM` 信号，在进程终止前完成内存数据库的终态落盘。

---

## 七、AI 接口与外网访问校验

部署完成后，无论是网页端用户，还是 ChatGPT、Gemini、Claude 等外部 AI 智能体，均可通过配置的域名或公网 IP 访问：

```bash
# 1. 验证 AI 操作规则接口
curl -i http://YOUR_SERVER_IP/ai/rules

# 2. 验证 OpenAPI 3.0 机器清单
curl -i http://YOUR_SERVER_IP/ai/manifest.json

# 3. 验证任务查询接口
curl -i http://YOUR_SERVER_IP/api/tasks

# 4. 验证服务运行状态与物理内存指标
curl -s http://YOUR_SERVER_IP/health
```

返回示例：
```json
{
  "status": "ok",
  "service": "daily-flow",
  "uptime_seconds": 1824,
  "memory_rss_mb": 31,
  "memory_heap_used_mb": 9
}
```
整个 Node.js 运行时仅占 31MB 物理常驻内存，在 1C1G 云服务器上可维持常年免维护平稳运行。
