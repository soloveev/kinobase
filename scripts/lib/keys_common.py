"""Общее для скриптов блока ключей: чтение данных и слаг архива.

Слаг тайтла — имя папки в `research/`. Сопоставление идёт по оригинальному
названию (правило проекта: фильм ищется по `titleOriginal`, а не по русскому).

Считает слаг не этот модуль, а `scripts/archive-slugs.ts` — то есть тот же код,
которым пользуются проверки досье (`src/lib/archive-slug.ts`). Вторая копия
одного суждения расходится молча, а молчаливый отказ слага обнаруживается не
проверкой, а следующим тайтлом.
"""
import io, json, os, subprocess, sys

DATA = 'content/dossier-data.json'

_SLUGS = None


def load_data():
    return json.loads(io.open(DATA, encoding='utf-8').read())


def _slugs():
    """Карта «оригинальное название → слаг», один раз за прогон.

    Падаем с понятным сообщением, а не молча: пустая или неполная карта означала бы,
    что слаг не нашёлся, — и скрипт порции сказал бы «нет такой записи» вместо
    «слаг посчитать не удалось».
    """
    global _SLUGS
    if _SLUGS is None:
        root = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
        try:
            out = subprocess.run(
                ['npx', 'tsx', 'scripts/archive-slugs.ts'],
                cwd=root, capture_output=True, text=True, check=True).stdout
        except FileNotFoundError:
            sys.exit('не найден npx: слаг архива считает scripts/archive-slugs.ts, '
                     'и без Node его получить неоткуда')
        except subprocess.CalledProcessError as e:
            sys.exit('не удалось посчитать слаги (npx tsx scripts/archive-slugs.ts):\n'
                     + (e.stderr or e.stdout or '').strip())
        try:
            _SLUGS = json.loads(out)
        except json.JSONDecodeError:
            sys.exit('scripts/archive-slugs.ts вернул не JSON:\n' + out[:500])
        if not _SLUGS:
            sys.exit('scripts/archive-slugs.ts вернул пустую карту слагов')
    return _SLUGS


def slug_of(record):
    orig = record['titleOriginal']
    slugs = _slugs()
    if orig not in slugs:
        sys.exit(f'нет слага для «{orig}»: записи нет в {DATA}, '
                 'либо карту не собрали — проверь npm run archive-slugs')
    return slugs[orig]
