#!/bin/sh
# Daemon minimaliste : execute backup.sh immediatement puis toutes les 24h.
# Alternative documentee dans le README : brancher backup.sh sur un vrai cron
# de l'hote a la place de ce conteneur, si prefere.
set -eu

echo "[backup-daemon] demarrage, sauvegarde toutes les 24h (BACKUP_RETENTION_DAYS=${BACKUP_RETENTION_DAYS:-7})"

while true; do
  /app/backup.sh || echo "[backup-daemon] ATTENTION : la sauvegarde a echoue, nouvelle tentative dans 24h"
  sleep 86400
done
