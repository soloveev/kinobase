#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# Выкатка Кино Базы на свой VPS (systemd + nginx, см. docs/server.md)
#
# Переносит исходный код, собирает приложение НА СЕРВЕРЕ и перезапускает службу.
# Сборка на сервере, а не здесь: better-sqlite3 — нативный модуль, и бинарник,
# собранный под macOS, на Linux не запустится.
#
# База НЕ переносится: она живёт в /var/lib/kinobase/ и является источником
# правды. Перед каждым перезапуском с неё снимается копия.
#
# Использование:
#   ./deploy.sh              # DRY-RUN: показывает, что изменится, ничего не трогает
#   ./deploy.sh --go         # реальная выкатка, спросит подтверждение с клавиатуры
#   ./deploy.sh --go --yes   # без вопроса — для агента, у которого нет клавиатуры;
#                            #   роль подтверждения там играет разрешение в Claude Code
# ─────────────────────────────────────────────────────────────────────────────
set -euo pipefail
cd "$(dirname "$0")"

# Адрес сервера и пути на нём — в deploy.env (в гит не едет; образец — deploy.env.example).
if [ ! -f deploy.env ]; then
  echo "Нет deploy.env: скопируйте deploy.env.example в deploy.env и заполните." >&2
  exit 1
fi
# shellcheck disable=SC1091
source deploy.env
DEPLOY_USER="${DEPLOY_USER:-kinobase}"
APP_PORT="${APP_PORT:-3001}"
for var in SSH_HOST REMOTE_DIR REMOTE_DB BACKUPS SERVICE DOMAIN SERVER_IP; do
  if [ -z "${!var:-}" ]; then
    echo "В deploy.env не задана переменная $var." >&2
    exit 1
  fi
done

MODE="dry"
CONFIRMED="no"
for arg in "$@"; do
  case "$arg" in
    --go)  MODE="go" ;;
    --yes) CONFIRMED="yes" ;;
    *) echo "Неизвестный аргумент: $arg"; exit 1 ;;
  esac
done

EXCLUDES=(
  --exclude '.git'            --exclude 'node_modules'  --exclude '.next'
  # Секрет владельца не едет с кодом: служба берёт OWNER_TOKEN из своего окружения.
  --exclude '.env*'
  --exclude 'data'            --exclude 'research/*/'   --exclude 'deploy.env'
  --exclude '*.tsbuildinfo'   --exclude '.DS_Store'     --exclude '.claude'
  --exclude '.agents'         --exclude 'coverage'      --exclude '__pycache__'
  # Файлы-близнецы с суффиксом « 2» — артефакт синхронизации облачных папок, а не работа.
  # rsync везёт рабочее дерево, а не то, что в гите, и незакоммиченное для него неотличимо от нужного.
  --exclude '* 2.*'           --exclude '* 2'
)
RSYNC_OPTS=(-az --delete --human-readable "${EXCLUDES[@]}")

echo "Цель:   $SSH_HOST:$REMOTE_DIR"
echo "Режим:  $([ "$MODE" = go ] && echo 'РЕАЛЬНАЯ ВЫКАТКА' || echo 'dry-run')"
echo

if [ "$MODE" = "dry" ]; then
  # -v обязателен: без него rsync в dry-run молча печатает пустоту,
  # и «ничего не изменится» неотличимо от «список не показан».
  echo "→ Что изменится на сервере (rsync --dry-run):"
  # Без фильтров через sed/grep: они спотыкаются о кириллицу в именах файлов.
  rsync "${RSYNC_OPTS[@]}" -v --dry-run "./" "$SSH_HOST:$REMOTE_DIR/"
  echo
  echo "Дальше были бы: копия базы → npm ci → npm run build → перезапуск службы."
  echo "Выкатить по-настоящему: ./deploy.sh --go"
  exit 0
fi

if [ "$CONFIRMED" != "yes" ]; then
  read -r -p "Выкатить на $DOMAIN? (введите yes): " ans
  [ "$ans" = "yes" ] || { echo "Отменено."; exit 1; }
fi

# Проверки идут до переноса: сборка на сервере типизирует и тесты, и красный тест
# уронил бы выкатку уже после того, как код уехал. Флага «пропустить» здесь нет
# намеренно — он превратил бы правило в предложение.
echo "→ 0/5 Проверки перед выкаткой (тесты, типы, линтер, файлы данных, база)…"
# Тесты — последовательно и со сверкой счёта: параллельный прогон под нагрузкой
# выходит с нулевым кодом, не собрав часть файлов, и «зелёный» неотличим от неполного.
EXPECTED_FILES=$(find tests -name '*.test.*' | wc -l | tr -d ' ')
TEST_OUT=$(npx vitest run --no-file-parallelism 2>&1) || { echo "$TEST_OUT" | tail -20; echo "   тесты красные — выкатка остановлена"; exit 1; }
GOT_FILES=$(echo "$TEST_OUT" | sed -n 's/.*Test Files *\([0-9]*\) passed (\([0-9]*\)).*/\2/p' | tail -1)
echo "$TEST_OUT" | grep -E "Test Files|Tests " | sed 's/^/   /'
[ "$GOT_FILES" = "$EXPECTED_FILES" ] || { echo "   собрано файлов: ${GOT_FILES:-0} из $EXPECTED_FILES — прогон неполный, выкатка остановлена"; exit 1; }
npx tsc --noEmit || { echo "   типы не сходятся — выкатка остановлена"; exit 1; }
npm run lint --silent || { echo "   линтер ругается — выкатка остановлена"; exit 1; }
npm run check-data --silent || { echo "   файлы данных не сходятся — выкатка остановлена"; exit 1; }
npm run check-db --silent || { echo "   в базе есть запрещённые состояния — выкатка остановлена"; exit 1; }
echo "   всё зелено"

echo "→ 1/5 Перенос кода…"
rsync "${RSYNC_OPTS[@]}" "./" "$SSH_HOST:$REMOTE_DIR/"

echo "→ 2/5 Копия базы перед миграциями…"
ssh "$SSH_HOST" "test -f $REMOTE_DB && sqlite3 $REMOTE_DB \".backup '$BACKUPS/before-deploy-\$(date +%F-%H%M).db'\" && echo '   копия снята' || echo '   базы пока нет — пропускаю'"

echo "→ 3/5 Зависимости и сборка…"
ssh "$SSH_HOST" "cd $REMOTE_DIR && npm ci --no-audit --no-fund && npm run build && chown -R $DEPLOY_USER:$DEPLOY_USER $REMOTE_DIR"

echo "→ 4/5 Перезапуск службы…"
ssh "$SSH_HOST" "systemctl restart $SERVICE && sleep 2 && systemctl is-active $SERVICE"

echo "→ 5/5 Проверка…"
APP=$(ssh "$SSH_HOST" "curl -s -o /dev/null -w '%{http_code}' http://127.0.0.1:$APP_PORT/")
PUB=$(curl -s -o /dev/null -w '%{http_code}' --resolve "$DOMAIN:443:$SERVER_IP" "https://$DOMAIN/")
echo "   приложение (127.0.0.1:$APP_PORT): $APP"
echo "   снаружи (https://$DOMAIN):   $PUB"

if [ "$APP" != "200" ]; then
  echo "✗ Приложение не отвечает. Логи: ssh $SSH_HOST 'journalctl -u $SERVICE -n 50 --no-pager'"
  exit 1
fi
case "$PUB" in
  200|401) echo "✓ Готово: https://$DOMAIN" ;;
  *) echo "✗ Снаружи отвечает $PUB — проверь nginx"; exit 1 ;;
esac
