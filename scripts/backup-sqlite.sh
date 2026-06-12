#!/bin/bash

# Configuration
DB_FILE="/var/lib/la-polla-2026/prod.db"
BACKUP_DIR="/home/gumorenos/backups/la-polla-2026"
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
BACKUP_FILE="${BACKUP_DIR}/backup_${TIMESTAMP}.sqlite"

# Create backup directory if it doesn't exist
mkdir -p "${BACKUP_DIR}"

# Run backup using sqlite3 online backup api
echo "Starting database backup for La Polla 2026..."
if [ -f "${DB_FILE}" ]; then
  sqlite3 "${DB_FILE}" ".backup '${BACKUP_FILE}'"
  if [ $? -eq 0 ]; then
    echo "Backup completed successfully: ${BACKUP_FILE}"
    # Change permissions of backup to be read-only by user
    chmod 600 "${BACKUP_FILE}"
  else
    echo "ERROR: sqlite3 backup command failed!" >&2
    exit 1
  fi
else
  echo "ERROR: Database file not found at ${DB_FILE}!" >&2
  exit 1
fi

# Clean up backups older than 30 days
echo "Cleaning up backups older than 30 days in ${BACKUP_DIR}..."
find "${BACKUP_DIR}" -name "backup_*.sqlite" -type f -mtime +30 -delete
echo "Cleanup done."
