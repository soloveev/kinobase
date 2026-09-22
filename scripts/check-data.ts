import fs from 'node:fs';
import path from 'node:path';
import { checkData, type DataFiles, type DataProblem } from '../src/lib/check-data';
import { readDataFile } from './lib/db';
import { DATA_FILES } from './lib/data-files';

/** Сухая проверка файлов наполнения: базу не открывает, в сеть не ходит, ничего
 *  не чинит. Вся логика — в `src/lib/check-data.ts`; здесь только чтение файлов
 *  и печать найденного. */

const root = process.cwd();

const PATHS = {
  films: DATA_FILES.films,
  tags: DATA_FILES.tags,
  seasons: DATA_FILES.seasons,
  dossiers: DATA_FILES.dossiers,
  people: DATA_FILES.people,
} as const;

const NAMES: Record<keyof typeof PATHS, string> = {
  films: 'films-data.json',
  tags: 'tags-data.json',
  seasons: 'seasons-data.json',
  dossiers: 'dossier-data.json',
  people: 'people-data.json',
};

const unreadable: DataProblem[] = [];

function read(key: keyof typeof PATHS): unknown[] {
  try {
    return readDataFile<unknown[]>(PATHS[key]);
  } catch (error) {
    unreadable.push({
      file: NAMES[key],
      record: NAMES[key],
      code: 'unreadable',
      detail: error instanceof Error ? error.message : String(error),
    });
    return [];
  }
}

const files: DataFiles = {
  films: read('films'),
  tags: read('tags'),
  seasons: read('seasons'),
  dossiers: read('dossiers'),
  people: read('people'),
};

const exists = (relative: string): boolean => fs.existsSync(path.join(root, relative));

const problems = [...unreadable, ...checkData(files, exists)];

if (problems.length === 0) {
  const counts = Object.entries(files).map(([key, rows]) => `${key}: ${rows.length}`);
  console.log(`Файлы данных сходятся (${counts.join(', ')})`);
  process.exit(0);
}

const byFile = new Map<string, DataProblem[]>();
for (const problem of problems) {
  const bucket = byFile.get(problem.file) ?? [];
  bucket.push(problem);
  byFile.set(problem.file, bucket);
}

console.error(`Найдено проблем: ${problems.length}\n`);
for (const [file, found] of byFile) {
  console.error(`${file}:`);
  for (const problem of found) {
    const detail = problem.detail === undefined ? '' : ` — ${problem.detail}`;
    console.error(`  ${problem.code}: «${problem.record}»${detail}`);
  }
  console.error('');
}
process.exit(1);
