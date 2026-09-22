#!/usr/bin/env python3
"""Копия нынешних блоков ключей в архив — делается ДО старта порции.

    npm run keys-archive -- <slug> [<slug> ...] --date 2026-09-09 --out <папка>

Кладёт `<папка>/keys-<slug>-<дата>-current.json`. Из общего файла запись
исчезнет после слияния, а сверять потом будет не с чем — правило работы
порцией в `AGENTS.md`. Слаг тайтла печатает `npm run archive-slugs`.
"""
import argparse, io, json, os, sys
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), 'lib'))
from keys_common import load_data, slug_of

ap = argparse.ArgumentParser()
ap.add_argument('slugs', nargs='+')
ap.add_argument('--date', required=True, help='дата захода, ГГГГ-ММ-ДД')
ap.add_argument('--out', required=True, help='папка архива порции')
a = ap.parse_args()
os.makedirs(a.out, exist_ok=True)

by_slug = {slug_of(r): r for r in load_data() if r.get('keys')}
for slug in a.slugs:
    r = by_slug.get(slug)
    if r is None:
        sys.exit(f'нет записи с блоком ключей для слага {slug}; известные: {", ".join(sorted(by_slug))}')
    out = os.path.join(a.out, f'keys-{slug}-{a.date}-current.json')
    io.open(out, 'w', encoding='utf-8').write(json.dumps(
        {'titleRu': r['titleRu'], 'titleOriginal': r['titleOriginal'], 'keys': r['keys']},
        ensure_ascii=False, indent=2) + '\n')
    print('архив:', out)
