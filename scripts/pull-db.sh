#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# Забрать свежую копию боевой базы с сервера.
#
# После переезда источник правды — база на сервере. Локальная data/kinobaza.db
# нужна только для разработки, поэтому скрипт НЕ перезаписывает её молча:
# он кладёт копию во временный файл и печатает путь и команду для замены.
# ─────────────────────────────────────────────────────────────────────────────
set -euo pipefail

# Адрес сервера и путь к базе — из deploy.env (образец — deploy.env.example).
cd "$(dirname "$0")/.."
if [ ! -f deploy.env ]; then
  echo "Нет deploy.env: скопируйте deploy.env.example в deploy.env и заполните." >&2
  exit 1
fi
# shellcheck disable=SC1091
source deploy.env
: "${SSH_HOST:?В deploy.env не задан SSH_HOST}" "${REMOTE_DB:?В deploy.env не задан REMOTE_DB}"
OUT="/tmp/kinobaza-$(date +%F-%H%M).db"

echo "→ Снимаю согласованный снимок на сервере…"
ssh "$SSH_HOST" "sqlite3 $REMOTE_DB \".backup '/tmp/kinobaza-pull.db'\""

echo "→ Забираю…"
scp -q "$SSH_HOST:/tmp/kinobaza-pull.db" "$OUT"
ssh "$SSH_HOST" "rm -f /tmp/kinobaza-pull.db"

echo
echo "Копия: $OUT"
sqlite3 "$OUT" "select '  тайтлов: '||count(*) from films;
select '  с оценкой: '||count(*) from films where my_rating is not null;
select '  со звёздочкой: '||count(*) from films where taste_star=1;
select '  с комментарием: '||count(*) from films where comment is not null and comment<>'';"
echo
echo "Заменить локальную базу этой копией (перезапишет data/kinobaza.db):"
echo "  cp $OUT data/kinobaza.db"
