#!/usr/bin/env bash
# ==============================================================================
# Daily Flow - SQLite Database Backup & Pruning Script
# Designed for lightweight automated execution via systemd timer or cron
# ==============================================================================

set -euo pipefail

DATA_DIR="${DAILY_FLOW_DATA_DIR:-/var/lib/daily-flow/data}"
DB_FILE="${DATA_DIR}/daily_flow.sqlite"
BACKUP_DIR="${DAILY_FLOW_BACKUP_DIR:-/var/backups/daily-flow}"
RETENTION_DAYS=7

TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
BACKUP_NAME="daily_flow_${TIMESTAMP}.sqlite.gz"

# Ensure backup destination directory exists
mkdir -p "${BACKUP_DIR}"

if [ ! -f "${DB_FILE}" ]; then
    echo "[$(date -Iseconds)] [WARN] Database file ${DB_FILE} not found. Skipping backup."
    exit 0
fi

# Create compressed snapshot
gzip -c "${DB_FILE}" > "${BACKUP_DIR}/${BACKUP_NAME}.tmp"
mv "${BACKUP_DIR}/${BACKUP_NAME}.tmp" "${BACKUP_DIR}/${BACKUP_NAME}"

BACKUP_SIZE=$(ls -lh "${BACKUP_DIR}/${BACKUP_NAME}" | awk '{print $5}')
echo "[$(date -Iseconds)] [INFO] Successfully created backup: ${BACKUP_DIR}/${BACKUP_NAME} (${BACKUP_SIZE})"

# Prune backups older than RETENTION_DAYS
DELETED_COUNT=$(find "${BACKUP_DIR}" -name "daily_flow_*.sqlite.gz" -type f -mtime +"${RETENTION_DAYS}" -print -delete | wc -l)
if [ "${DELETED_COUNT}" -gt 0 ]; then
    echo "[$(date -Iseconds)] [INFO] Pruned ${DELETED_COUNT} backup archives older than ${RETENTION_DAYS} days."
fi
