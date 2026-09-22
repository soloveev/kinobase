#!/usr/bin/env python3
"""Проверка формы блока ключей по файлу агента — до слияния в общий файл.

    python3 scripts/keys-check.py <файл-с-блоком-ключей.json>

Проверяет то, что проверяется кодом: ровно семь пунктов, объём блока,
полужирный лид, отсутствие ссылок и слов про приём. Правило блока — раздел
«Блок „Важные вещи о фильме“» в research/DOSSIER-FORMAT.md (редакция 15.09.2026).
Смысловые правила — стиль, отсутствие пересказа и атрибуций — кодом не
проверяются; их держит пишущий.

Объём считается так, как его видит читатель: сумма знаков всех пунктов
с пробелами, без разметки полужирного.
"""
import io, json, re, sys

ITEMS = 7
BLOCK_NORM, BLOCK_MAX = 6000, 6059
RECEPTION = ['рецензент', 'критики единодушны', 'процент', 'рейтинг', 'Rotten', 'Metacritic',
             'IMDb', 'Кинопоиск', 'сходятся', 'сборы', 'кассов', 'номинаци', '«Эмми»', 'Оскар']
ATTRIBUTION = ['по словам', 'по мнению', 'критики отмеча', 'критик пишет', 'как пишет', 'как замеча']


def visible(item: str) -> str:
    return re.sub(r'\*\*', '', item)


bad_total = 0
for path in sys.argv[1:]:
    d = json.load(io.open(path, encoding='utf-8'))
    body = [n for fr in d['keys'] for n in fr['body']]
    types = [n['type'] for n in body]
    items = [i for n in body if n['type'] == 'ul' for i in n['items']]
    problems = []   # нарушения: правило нарушено точно
    doubts = []     # подсказки: смотреть глазами, скрипт тут ошибается
    if types.count('ul') != 1:
        problems.append(f'списков в теле: {types.count("ul")}, должен быть один')
    if 'h' in types or 'h3' in types or 'h4' in types:
        problems.append('подзаголовок в блоке ключей запрещён')
    if 'quote' in types:
        problems.append('врезка-цитата в блоке ключей запрещена')
    if len(items) != ITEMS:
        problems.append(f'пунктов {len(items)}, должно быть ровно {ITEMS}')
    total = sum(len(visible(i)) for i in items)
    for n, i in enumerate(items, 1):
        if 'http' in i or '](' in i:
            problems.append(f'пункт {n}: ссылка — в блоке ключей их не бывает')
        if not re.match(r'^\*\*(.+?)\*\*\s*\S', i, re.S):
            problems.append(f'пункт {n}: нет полужирного лида или нет раскрытия после него')
        low = i.lower()
        for w in RECEPTION:
            if w.lower() in low:
                doubts.append(f'пункт {n}: слово «{w}» — проверь, не про приём ли пункт. '
                              'Цифра о мире фильма законна, цифра о том, как фильм приняли, — нет')
        for w in ATTRIBUTION:
            if w in low:
                doubts.append(f'пункт {n}: «{w}» — атрибуция; мысль подаётся прямо, как факт')
    if total > BLOCK_MAX:
        problems.append(f'блок {total} знаков — выше потолка {BLOCK_MAX}; сожми пункт-два без потери смысла')
    elif total > BLOCK_NORM:
        doubts.append(f'блок {total} знаков — выше нормы {BLOCK_NORM}, в допуске до {BLOCK_MAX}')
    print(f'== {path}\n   пунктов {len(items)}, знаков {total}, длины: {[len(visible(i)) for i in items]}')
    for p in problems:
        print('   ! нарушение:', p)
    for d_ in doubts:
        print('   ? проверить:', d_)
    if not problems and not doubts:
        print('   нарушений формы нет')
    bad_total += len(problems)
sys.exit(1 if bad_total else 0)
