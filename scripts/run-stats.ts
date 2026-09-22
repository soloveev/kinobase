import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { readDataFile } from './lib/db';
import { DATA_FILES } from './lib/data-files';

/** Считает заходы по архивам и записям досье: страницы, факты, объём текста, врезки,
 *  источники. Нужен затем же, зачем `check-facts`, — чтобы замер захода не был словом
 *  агента. Сравнивать заходы между собой можно только так. */

type Row = {
  slug: string;
  pages: number;
  empty: number;
  zonalRows: number;
  mergedRows: number;
  beforeChars: number;
  afterChars: number;
  units: number;
  quotes: number;
  inline: number;
  sources: number;
};

const isPage = (name: string) =>
  name.endsWith('.md') && !/^(facts|findings|sources|SOURCES|review|task|revision)/.test(name);

const countRows = (text: string): number =>
  text
    .split('\n')
    .filter(
      (line) =>
        line.startsWith('|') &&
        !/^\|[\s:|-]+\|\s*$/.test(line) &&
        !line.split('|')[1]?.trim().startsWith('Утверждение'),
    ).length;

type Node = { type?: string; text?: string; items?: string[]; body?: Node[] };

function measure(body: Node[]): { chars: number; units: number; quotes: number } {
  let chars = 0;
  let units = 0;
  let quotes = 0;
  const walk = (nodes: Node[]) => {
    for (const node of nodes) {
      if (node.type === 'ul') {
        for (const item of node.items ?? []) {
          chars += item.length;
          units += 1;
        }
        continue;
      }
      if (node.type === 'quote') quotes += 1;
      if (node.type === 'p' || node.type === 'quote') units += 1;
      chars += node.text?.length ?? 0;
      if (node.body) walk(node.body);
    }
  };
  walk(body);
  return { chars, units, quotes };
}

const dossiers = readDataFile<
  { titleRu: string; before: { body: Node[] }[]; after?: { body: Node[] }[]; sources: unknown[] }[]
>(DATA_FILES.dossiers);

/** Слаг тайтла выводится из пути постера, а не хранится отдельно: это единственное
 *  место данных, где он записан. Раньше список заходов стоял здесь руками — и молча
 *  отстал на восемнадцать заходов из двадцати восьми, то есть команда замера почти
 *  ничего не мерила и об этом не сообщала. */
const films = readDataFile<{ titleRu: string; posterPath: string }[]>(
  DATA_FILES.films,
);

const slugToTitle: Record<string, string> = Object.fromEntries(
  films.map((film) => [film.posterPath.replace(/^.*\//, '').replace(/\.jpg$/, ''), film.titleRu]),
);

const rows: Row[] = [];

for (const [slug, title] of Object.entries(slugToTitle)) {
  const dir = join('research', slug);
  if (!statSync(dir, { throwIfNoEntry: false })?.isDirectory()) continue;
  const names = readdirSync(dir);
  const pages = names.filter(isPage);

  let zonalRows = 0;
  let mergedRows = 0;
  for (const name of names) {
    if (!/^facts(-[a-z0-9-]+)?\.md$/.test(name)) continue;
    const rowCount = countRows(readFileSync(join(dir, name), 'utf8'));
    if (name === 'facts.md') mergedRows = rowCount;
    else zonalRows += rowCount;
  }

  const record = dossiers.find((entry) => entry.titleRu === title);
  // У невышедшего тайтла разбора нет вовсе — `after` в записи опущен.
  const before = record ? measure(record.before.flatMap((fragment) => fragment.body)) : null;
  const after = record?.after ? measure(record.after.flatMap((fragment) => fragment.body)) : null;
  const inline = record ? (JSON.stringify(record).match(/\]\(http/g) ?? []).length : 0;

  rows.push({
    slug,
    pages: pages.length,
    empty: pages.filter((name) => /EMPTY|PARTIAL/i.test(name)).length,
    zonalRows,
    mergedRows,
    beforeChars: before?.chars ?? 0,
    afterChars: after?.chars ?? 0,
    units: (before?.units ?? 0) + (after?.units ?? 0),
    quotes: (before?.quotes ?? 0) + (after?.quotes ?? 0),
    inline,
    sources: record?.sources.length ?? 0,
  });
}

const label: Record<keyof Omit<Row, 'slug'>, string> = {
  pages: 'Страниц в архиве',
  empty: 'из них пустых',
  zonalRows: 'Строк в зональных таблицах',
  mergedRows: 'Строк в сводной',
  beforeChars: 'Знаков в блоке подготовки',
  afterChars: 'Знаков в разборе',
  units: 'Абзацных единиц',
  quotes: 'Врезок',
  inline: 'Инлайн-адресов',
  sources: 'Источников в записи',
};

const width = 30;
console.log('Замеры заходов\n');
console.log('Показатель'.padEnd(width) + rows.map((row) => row.slug.slice(0, 14).padStart(16)).join(''));
for (const key of Object.keys(label) as (keyof typeof label)[]) {
  console.log(label[key].padEnd(width) + rows.map((row) => String(row[key]).padStart(16)).join(''));
}
console.log(
  '\nДоля блока подготовки'.padEnd(width + 1) +
    rows
      .map((row) => {
        const total = row.beforeChars + row.afterChars;
        return (total ? ((row.beforeChars / total) * 100).toFixed(1) + ' %' : '—').padStart(16);
      })
      .join(''),
);
