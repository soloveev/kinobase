// Рефакторинг 15.09.2026, находка 4 (specs/refactor-2026-09-15/audit-code.md).
//
// Обход архивов `research/` стоял двумя копиями — в `scripts/check-dossier.ts` и
// в `scripts/check-dossier-one.ts`, — и копии разошлись ровно там, где это опаснее
// всего: полная версия печатала строку о несопоставленной папке, а версия для одной
// записи сопоставление молча пропускала. Именно это молчание трижды прятало дефект
// `slugArchive` (история — в tests/archive-slug.test.ts). Обход переезжает в общий
// модуль, и `skipped` становится частью его контракта, а не привычкой одного скрипта.
//
// Контракт:
//   export function factsByTitle(root: string, keys: string[]):
//     { facts: Map<string, string>; skipped: string[] }
//   из 'scripts/lib/facts-archive'.
//
// `root` — корень проекта: обходится `<root>/research`, ровно как это делает
// `scripts/check-dossier.ts` сейчас. Папка попадает в обход, только если в ней есть
// `facts.md`; сопоставляется она с ключом через `matchesArchiveFolder`. Ключ здесь —
// оригинальное название тайтла, то же, что даёт `filmKey`.
//
// Тест работает на временной папке (`fs.mkdtempSync`), а не на живом `research/`:
// живой архив растёт от захода к заходу, и тест по нему проверял бы состояние базы,
// а не поведение кода. Сети и базы здесь нет — правило раздела «Тесты» в CLAUDE.md.

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { factsByTitle } from '../scripts/lib/facts-archive';

let root: string;

/** Папка архива с таблицей фактов внутри. */
function archive(folder: string, facts: string): void {
  const dir = path.join(root, 'research', folder);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'facts.md'), facts, 'utf8');
}

/** Папка архива без таблицы фактов: сырьё есть, сводной таблицы ещё нет. */
function archiveWithoutFacts(folder: string): void {
  const dir = path.join(root, 'research', folder);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'ctx-a.md'), 'Сырьё без сводной таблицы.', 'utf8');
}

beforeEach(() => {
  root = fs.mkdtempSync(path.join(os.tmpdir(), 'kinobaza-facts-'));
  fs.mkdirSync(path.join(root, 'research'));
});

afterEach(() => {
  fs.rmSync(root, { recursive: true, force: true });
});

describe('factsByTitle: обход архивов research/', () => {
  it('сопоставленная папка даёт текст под ключом тайтла, несопоставленная — строку в skipped', () => {
    archive('weapons', '# «Оружие» — сводная таблица фактов');
    archive('nepokoy', '# «Непокой» — сводная таблица фактов');
    archiveWithoutFacts('odyssey');

    const { facts, skipped } = factsByTitle(root, ['Weapons']);

    expect(facts.get('Weapons')).toBe('# «Оружие» — сводная таблица фактов');
    expect(facts.size).toBe(1);
    expect(skipped).toEqual(['research/nepokoy']);
  });

  // Ключ в карте — оригинальное название тайтла, а не имя папки: дальше по нему
  // тексты ищет `checkDossier`, у которого имени папки нет вовсе.
  it('текст лежит под ключом тайтла, а не под именем папки', () => {
    archive('odyssey', 'Таблица «Одиссеи».');

    const { facts } = factsByTitle(root, ['The Odyssey']);

    expect(facts.get('The Odyssey')).toBe('Таблица «Одиссеи».');
    expect(facts.has('odyssey')).toBe(false);
  });

  // Короткое имя папки при длинном названии — норма архива (`research/camp-miasma`
  // при «Teenage Sex and Death at Camp Miasma»): сопоставление идёт по хвосту слага.
  it('короткое имя папки сопоставляется с длинным названием', () => {
    archive('camp-miasma', 'Таблица лагеря.');

    const { facts, skipped } = factsByTitle(root, ['Teenage Sex and Death at Camp Miasma']);

    expect(facts.get('Teenage Sex and Death at Camp Miasma')).toBe('Таблица лагеря.');
    expect(skipped).toEqual([]);
  });

  // Папка без `facts.md` — не пропуск, а «архив ещё собирается»: сырьё лежит,
  // сводной таблицы нет. Жаловаться тут не на что.
  it('папка без facts.md в skipped не попадает', () => {
    archiveWithoutFacts('sirat');

    const { facts, skipped } = factsByTitle(root, ['Sirât']);

    expect(facts.size).toBe(0);
    expect(skipped).toEqual([]);
  });

  // Двусмысленность — тот же отказ, что и промах: если папка подошла двум тайтлам,
  // выбрать за владельца нельзя, и молча взять первый нельзя тем более.
  it('папка, подошедшая двум ключам сразу, уходит в skipped', () => {
    archive('hole', 'Таблица.');

    const { facts, skipped } = factsByTitle(root, ["Jo Nesbø's Detective Hole", 'The Hole']);

    expect(facts.size).toBe(0);
    expect(skipped).toEqual(['research/hole']);
  });

  it('ни одного архива — пустая карта и пустой перечень пропущенных', () => {
    const { facts, skipped } = factsByTitle(root, ['Weapons']);

    expect(facts.size).toBe(0);
    expect(skipped).toEqual([]);
  });

  // Главный случай, ради которого правило «несопоставленная папка не молчит»
  // и заведено: кириллический оригинал, папка `research/nepokoy`. Пока слаг был
  // пустым, она попадала в skipped — и строка о ней была единственным следом отказа.
  it('кириллический тайтл сопоставляется с латинской папкой', () => {
    archive('nepokoy', 'Таблица «Непокоя».');

    const { facts, skipped } = factsByTitle(root, ['Непокой']);

    expect(facts.get('Непокой')).toBe('Таблица «Непокоя».');
    expect(skipped).toEqual([]);
  });

  it('несколько несопоставленных папок перечисляются все', () => {
    archive('weapons', 'a');
    archive('sirat', 'b');
    archive('nepokoy', 'c');

    const { skipped } = factsByTitle(root, ['Sirât']);

    expect([...skipped].sort()).toEqual(['research/nepokoy', 'research/weapons']);
  });
});
