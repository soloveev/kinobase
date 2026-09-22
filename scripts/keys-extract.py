#!/usr/bin/env python3
"""Разбор тайтла («После просмотра») сплошным текстом — материал для пишущего.

    npm run keys-extract -- <slug> [<slug> ...] --out <папка>

Читать `content/dossier-data.json` целиком пишущему незачем: там все разборы
базы разом. Скрипт достаёт из него один и кладёт markdown-файлом.
Слаг тайтла печатает `npm run archive-slugs`.
"""
import argparse, io, json, os, sys
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), 'lib'))
from keys_common import load_data, slug_of


def flat(nodes):
    out = []
    for n in nodes or []:
        t = n.get('type')
        if t in ('ul', 'ol'):
            out += ['- ' + i for i in n['items']]
        elif t == 'p':
            out.append(n.get('text', ''))
        elif t in ('h', 'h3', 'h4'):
            out.append('#### ' + n.get('text', ''))
        elif t == 'quote':
            out.append('> ' + n.get('text', ''))
        else:
            out.append(json.dumps(n, ensure_ascii=False))
    return out


ap = argparse.ArgumentParser()
ap.add_argument('slugs', nargs='+')
ap.add_argument('--out', required=True, help='куда класть файлы')
a = ap.parse_args()
os.makedirs(a.out, exist_ok=True)

by_slug = {slug_of(r): r for r in load_data()}
for slug in a.slugs:
    r = by_slug.get(slug)
    if r is None:
        sys.exit(f'нет записи досье для слага {slug}; известные: {", ".join(sorted(by_slug))}')
    s = f"# {r['titleRu']} — разбор\n\n"
    for fr in r.get('after') or []:
        s += f"## [{fr['key']}] {fr.get('title', '')}\n" + '\n'.join(flat(fr['body'])) + '\n\n'
    path = os.path.join(a.out, f'after-{slug}.md')
    io.open(path, 'w', encoding='utf-8').write(s)
    print(f'{path}: {len(s)} знаков')
