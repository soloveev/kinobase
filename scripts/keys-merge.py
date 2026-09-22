#!/usr/bin/env python3
"""Слияние файлов агентов в общий `content/dossier-data.json`.

    npm run keys-merge -- <папка-порции>/keys-*.json

Меняет только поле `keys` и проверяет после записи, что `before`, `after`,
`sources` и `searchedAt` у всех записей совпали с прежними знак в знак —
правило координатора из `AGENTS.md`, раздел «Работа порцией». Форматирование
файла (`indent=2`, `ensure_ascii=False`) совпадает с тем, что лежит в
репозитории, поэтому в диф попадают только переписанные блоки.
"""
import io, json, sys

SRC = 'content/dossier-data.json'

if len(sys.argv) < 2:
    sys.exit('Нужны файлы порции: npm run keys-merge -- <папка>/keys-*.json')

data = json.load(io.open(SRC, encoding='utf-8'))
frozen = {r['titleOriginal']: json.dumps(
    [r.get('before'), r.get('after'), r.get('sources'), r.get('searchedAt')], ensure_ascii=False) for r in data}

incoming = {}
for path in sys.argv[1:]:
    d = json.load(io.open(path, encoding='utf-8'))
    incoming[d['titleOriginal']] = (d['titleRu'], d['keys'], path)

merged = 0
for r in data:
    if r['titleOriginal'] in incoming:
        title, keys, path = incoming[r['titleOriginal']]
        if r['titleRu'] != title:
            sys.exit(f'{path}: titleRu «{title}» не совпадает с базой «{r["titleRu"]}»')
        r['keys'] = keys
        merged += 1
        print('влито:', r['titleRu'])
if merged != len(incoming):
    sys.exit(f'слито {merged} из {len(incoming)} — тайтл ищется по titleOriginal, проверь написание')

io.open(SRC, 'w', encoding='utf-8').write(json.dumps(data, ensure_ascii=False, indent=2) + '\n')
for r in json.load(io.open(SRC, encoding='utf-8')):
    now = json.dumps([r.get('before'), r.get('after'), r.get('sources'), r.get('searchedAt')], ensure_ascii=False)
    if now != frozen[r['titleOriginal']]:
        sys.exit(f'ОСТАНОВКА: у записи «{r["titleRu"]}» изменились неизменные поля')
print(f'готово: {merged} записей, неизменные поля всех {len(data)} совпадают')
