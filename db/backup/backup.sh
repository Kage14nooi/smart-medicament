#!/bin/sh
# ============================================================================
# Sauvegarde quotidienne de la base MySQL "smart_medicament".
#
# Usage manuel (depuis l'hote, avec MySQL accessible sur DB_HOST:DB_PORT) :
#   DB_HOST=localhost DB_PORT=3307 DB_USER=root DB_PASSWORD=root \
#     BACKUP_DIR=./db/backup/dumps BACKUP_RETENTION_DAYS=7 ./db/backup/backup.sh
#
# Usage recommande en production : conteneur dedie du docker-compose.prod.yml
# (service "backup", cf. ce fichier) qui execute ce script en boucle (cron
# minimaliste via `sleep`), ou bien un vrai cron sur l'hote qui declenche :
#   docker compose -f docker-compose.prod.yml exec -T mysql \
#     sh -c 'mysqldump -uroot -p"$MYSQL_ROOT_PASSWORD" smart_medicament' \
#     | gzip > /chemin/vers/dumps/smart_medicament_$(date +%Y%m%d_%H%M%S).sql.gz
#
# Rotation : les dumps de plus de BACKUP_RETENTION_DAYS jours sont supprimes
# a chaque execution (par defaut 7 jours).
# ============================================================================
set -eu

DB_HOST="${DB_HOST:-mysql}"
DB_PORT="${DB_PORT:-3306}"
DB_USER="${DB_USER:-root}"
DB_PASSWORD="${DB_PASSWORD:-root}"
DB_NAME="${DB_NAME:-smart_medicament}"
BACKUP_DIR="${BACKUP_DIR:-/backups}"
BACKUP_RETENTION_DAYS="${BACKUP_RETENTION_DAYS:-7}"

mkdir -p "$BACKUP_DIR"

timestamp=$(date +%Y%m%d_%H%M%S)
dump_file="$BACKUP_DIR/${DB_NAME}_${timestamp}.sql.gz"

echo "[backup] demarrage sauvegarde de $DB_NAME vers $dump_file"

mysqldump \
  --host="$DB_HOST" \
  --port="$DB_PORT" \
  --user="$DB_USER" \
  --password="$DB_PASSWORD" \
  --single-transaction \
  --routines \
  --triggers \
  "$DB_NAME" | gzip > "$dump_file"

echo "[backup] sauvegarde terminee : $dump_file ($(du -h "$dump_file" | cut -f1))"

echo "[backup] purge des sauvegardes de plus de ${BACKUP_RETENTION_DAYS} jours..."
find "$BACKUP_DIR" -name "${DB_NAME}_*.sql.gz" -mtime "+${BACKUP_RETENTION_DAYS}" -print -delete

echo "[backup] termine."
