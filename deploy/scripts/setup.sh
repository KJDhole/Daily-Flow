#!/usr/bin/env bash
# ==============================================================================
# Daily Flow - Ubuntu Server Initial Setup Script
# Optimized for 1 Core CPU / 1GB RAM Ubuntu 20.04/22.04/24.04 LTS
# ==============================================================================

set -euo pipefail

echo "================================================================="
echo " Daily Flow - Ubuntu 生产环境一键初始化安装"
echo "================================================================="

if [ "$EUID" -ne 0 ]; then
  echo "[ERROR] 请使用 root 权限运行此脚本 (例如: sudo bash setup.sh)"
  exit 1
fi

# 1. 检查 Node.js 环境
if ! command -v node >/dev/null 2>&1; then
    echo "[INFO] 未检测到 Node.js，正在添加 NodeSource Node.js 22 LTS 源并安装..."
    apt-get update
    apt-get install -y ca-certificates curl gnupg
    curl -fsSL https://deb.nodesource.com/setup_22.x | bash -
    apt-get install -y nodejs
fi

NODE_VERSION=$(node -v)
echo "[INFO] 当前 Node.js 版本: ${NODE_VERSION}"

# 2. 安装 Nginx
if ! command -v nginx >/dev/null 2>&1; then
    echo "[INFO] 正在安装 Nginx..."
    apt-get update
    apt-get install -y nginx
fi

# 3. 创建独立运行用户 dailyflow (不赋予登录 shell，保障主机安全)
if ! id -u dailyflow >/dev/null 2>&1; then
    echo "[INFO] 创建系统用户 dailyflow..."
    useradd -r -s /usr/sbin/nologin -d /opt/daily-flow -M dailyflow
fi

# 4. 创建持久化数据与备份目录
APP_DIR="/opt/daily-flow"
DATA_DIR="/var/lib/daily-flow/data"
BACKUP_DIR="/var/backups/daily-flow"

echo "[INFO] 规划持久化目录结构..."
mkdir -p "${APP_DIR}"
mkdir -p "${DATA_DIR}"
mkdir -p "${BACKUP_DIR}"

# 赋予 dailyflow 权限
chown -R dailyflow:dailyflow "${DATA_DIR}"
chown -R dailyflow:dailyflow "${BACKUP_DIR}"
chmod 750 "${DATA_DIR}"
chmod 750 "${BACKUP_DIR}"

# 5. 设置 systemd 日志容量上限 (避免日志占满 1C1G 小型云服务器磁盘)
echo "[INFO] 配置 systemd 日志容量上限为 50MB..."
mkdir -p /etc/systemd/journald.conf.d
cat > /etc/systemd/journald.conf.d/daily-flow.conf << 'EOF'
[Journal]
SystemMaxUse=50M
RuntimeMaxUse=20M
EOF
systemctl restart systemd-journald

# 6. 配置备份脚本权限
if [ -f "${APP_DIR}/deploy/scripts/backup.sh" ]; then
    chmod +x "${APP_DIR}/deploy/scripts/backup.sh"
fi

# 7. 配置 systemd 服务与定时备份
echo "[INFO] 安装 systemd 服务单元..."
cp "${APP_DIR}/deploy/systemd/daily-flow.service" /etc/systemd/system/
cp "${APP_DIR}/deploy/systemd/daily-flow-backup.service" /etc/systemd/system/
cp "${APP_DIR}/deploy/systemd/daily-flow-backup.timer" /etc/systemd/system/

systemctl daemon-reload
systemctl enable daily-flow
systemctl enable daily-flow-backup.timer
systemctl start daily-flow-backup.timer

# 8. 配置 Nginx 反向代理
echo "[INFO] 配置 Nginx 反向代理站点..."
cp "${APP_DIR}/deploy/nginx/daily-flow.conf" /etc/nginx/sites-available/daily-flow.conf
ln -sf /etc/nginx/sites-available/daily-flow.conf /etc/nginx/sites-enabled/daily-flow.conf

# 如果存在默认 default 站点，安全移除其链接避免冲突
if [ -f /etc/nginx/sites-enabled/default ]; then
    rm -f /etc/nginx/sites-enabled/default
fi

nginx -t
systemctl reload nginx

# 9. 启动服务
echo "[INFO] 启动 Daily Flow 生产服务..."
systemctl restart daily-flow

sleep 2
echo "================================================================="
echo " 服务状态检查："
systemctl status daily-flow --no-pager || true
echo "-----------------------------------------------------------------"
echo " 健康检查响应："
curl -s http://127.0.0.1:3000/health || true
echo ""
echo "================================================================="
echo " 部署完成！"
echo " 访问地址: http://$(curl -s ifconfig.me 2>/dev/null || echo 'YOUR_SERVER_IP')"
echo " 数据目录: ${DATA_DIR} (持久保存，后续更新不受影响)"
echo " 备份目录: ${BACKUP_DIR}"
echo "================================================================="
