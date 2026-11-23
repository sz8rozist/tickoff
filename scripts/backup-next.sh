#!/usr/bin/env bash
# Mentés az éles stackről: adatbázis-dump + a feltöltött képernyőképek.
# Használat:  scripts/backup.sh [célkönyvtár]        (alapértelmezett: ./backups)
# Időzítve (cron):  0 3 * * *  cd /opt/tickoff && scripts/backup.sh /var/backups/tickoff
# A mentéseket érdemes a szerveren kívülre is másolni, és a visszaállítást időnként kipróbálni (lásd README).
set -euo pipefail

cd "$(dirname "$0")/.."
OUT="${1:-backups}"
STAMP="$(date +%Y%m%d-%H%M%S)"
COMPOSE=(docker compose -f docker-compose.next.yml --env-file .env.next)

mkdir -p "$OUT"
DB_FILE="$OUT/db-$STAMP.sql.gz"
SHOTS_FILE="$OUT/screenshots-$STAMP.tar.gz"

# Hiba esetén ne maradjon töredék-mentés, ami épnek látszik
cleanup() { rm -f "$DB_FILE.partial" "$SHOTS_FILE.partial"; }
trap cleanup EXIT

# Konzisztens pillanatkép leállítás nélkül (InnoDB, --single-transaction). A jelszót a konténer saját
# környezetéből olvassa, így nem kerül se a parancssorba, se a hoszt folyamatlistájára.
"${COMPOSE[@]}" exec -T mysql sh -c 'MYSQL_PWD="$MYSQL_ROOT_PASSWORD" mysqldump --single-transaction --routines --no-tablespaces -uroot tickoff' \
  | gzip > "$DB_FILE.partial"

# A parancs sh -c-ben van, hogy a /data útvonalat egy Windowsos shell se írja át
"${COMPOSE[@]}" exec -T app sh -c 'tar -C /data -czf - screenshots' > "$SHOTS_FILE.partial"

# Csak épnek bizonyult mentés kerül a végleges helyére
gzip -t "$DB_FILE.partial"
gzip -t "$SHOTS_FILE.partial"
mv "$DB_FILE.partial" "$DB_FILE"
mv "$SHOTS_FILE.partial" "$SHOTS_FILE"

echo "Kész: $DB_FILE, $SHOTS_FILE"
