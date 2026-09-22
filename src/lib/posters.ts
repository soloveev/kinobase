import fs from 'node:fs';
import path from 'node:path';

/** Путь к полноразмерному постеру, если файл лежит рядом с рабочим, иначе null.
 *  Соглашение об имени вместо колонки в базе: полноразмерный файл — тот же slug
 *  в `public/posters/original/`. Колонка хранила бы то, что и так выводится из
 *  имени, и требовала бы синхронизации при каждой замене постера.
 *
 *  Только для серверных компонентов: читает файловую систему. */
export function fullPosterPath(posterPath: string): string | null {
  const file = path.basename(posterPath);
  const candidate = path.join('posters', 'original', file);
  return fs.existsSync(path.join(process.cwd(), 'public', candidate)) ? `/${candidate}` : null;
}
