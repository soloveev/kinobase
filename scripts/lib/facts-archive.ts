import fs from 'node:fs';
import path from 'node:path';
import { matchesArchiveFolder } from '../../src/lib/archive-slug';

/** Обход архивов `research/`: карта «оригинальное название → текст `facts.md`».
 *
 *  Папка попадает в обход, только если в ней есть `facts.md`: папка без него — это
 *  «архив ещё собирается», сырьё лежит, сводной таблицы нет, и жаловаться не на что.
 *  Сопоставляется папка с тайтлом через `matchesArchiveFolder` — там же, где живёт
 *  сам слаг, потому что это одно суждение с ним.
 *
 *  Папка, не сопоставленная ни с одним ключом либо сопоставленная сразу с двумя,
 *  уходит в `skipped`, а не пропускается молча: двусмысленность — тот же отказ, что
 *  и промах, выбрать за владельца нельзя, а молча взять первый — тем более. Именно
 *  молчание этой проверки трижды прятало дефект `slugArchive` (история — в
 *  tests/archive-slug.test.ts), и до 15.09.2026 обход стоял двумя копиями, из которых
 *  одна, `check-dossier-one`, про `skipped` не знала вовсе. */
export function factsByTitle(
  root: string,
  keys: string[],
): { facts: Map<string, string>; skipped: string[] } {
  const facts = new Map<string, string>();
  const skipped: string[] = [];

  for (const folder of fs.readdirSync(path.join(root, 'research'))) {
    const file = path.join(root, 'research', folder, 'facts.md');
    if (!fs.existsSync(file)) continue;

    const matched = keys.filter((key) => matchesArchiveFolder(key, folder));

    if (matched.length === 1) facts.set(matched[0], fs.readFileSync(file, 'utf8'));
    else skipped.push(`research/${folder}`);
  }

  return { facts, skipped };
}
