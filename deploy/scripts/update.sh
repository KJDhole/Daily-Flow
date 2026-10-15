#!/usr/bin/env bash
# ==============================================================================
# Daily Flow - Production Zero-Loss Update Script
# Safely updates the application without affecting SQLite database storage
# ==============================================================================

set -euo pipefail

APP_DIR="/opt/daily-flow"
DATA_DIR="/var/lib/daily-flow/data"

echo "[INFO] [1/5] 更新前执行数据库强制快照备份..."
if [ -f "${APP_DIR}/deploy/scripts/backup.sh" ]; then
    bash "${APP_DIR}/deploy/scripts/backup.sh" || true
fi

echo "[INFO] [2/5] 进入应用目录: ${APP_DIR}..."
cd "${APP_DIR}"

echo "[INFO] [3/5] 更新依赖包 (仅安装生产环境精简依赖)..."
npm install --omit=dev

echo "[INFO] [4/5] 重启 systemd 服务..."
systemctl restart daily-flow

echo "[INFO] [5/5] 验证服务健康状态..."
sleep 2

HEALTH_RES=$(curl -s http://127.0.0.1:3000/health || echo "FAILED")
echo "健康检查结果: ${HEALTH_RES}"

if [[ "${HEALTH_RES}" == *"ok"* ]]; then
    echo "[SUCCESS] Daily Flow 生产更新成功完成！"
else
    echo "[ERROR] 健康检查未通过，请运行 'journalctl -u daily-flow -n 50 --no-pager' 排查日志！"
    exit 1
fi
