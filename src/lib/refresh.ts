/** Перенос справочных полей файла данных в уже занесённую запись базы.
 *
 *  `add-films` доливает тайтлы, которых в базе ещё нет, и полей существующих
 *  не трогает — иначе повторный прогон затирал бы то, что правилось руками.
 *  У тегов и сезонов для обновления есть свои скрипты; у остальных справочных
 *  полей не было ничего, и правка в файле до базы просто не доезжала.
 *
 *  Список обновляемых колонок задан явным перечнем, а не правилом «всё, кроме»:
 *  «кроме» молча впустит колонку, которую заведут завтра, и однажды это окажется
 *  личное поле. Личных полей и материалов агента здесь нет, и это проверяет тест. */

export const REFERENCE_FIELDS: readonly string[] = [
  'titleRu',
  'posterPath',
  'releaseDate',
  'imdbRating',
  'imdbId',
  'kinopoiskRating',
  'kinopoiskId',
  'annotation',
  'director',
  'producer',
  'screenwriter',
  'composer',
  'soundDesigner',
  'cast',
];

export type FieldChange = { field: string; from: unknown; to: unknown };
export type FilmRefresh = { titleOriginal: string; changes: FieldChange[] };

/** Состав исполнителей — массив, и разойтись он может и порядком, и содержимым:
 *  порядок в карточке значащий, первым идёт первая роль. */
function same(current: unknown, incoming: unknown): boolean {
  if (Array.isArray(current) && Array.isArray(incoming)) {
    return (
      current.length === incoming.length &&
      current.every((item, index) => item === incoming[index])
    );
  }
  return current === incoming;
}

/** Что изменится, если перенести запись файла в строку базы.
 *
 *  Поля, которого в записи файла нет вовсе, изменением не считается: отсутствие
 *  поля означает «здесь ничего не сказано», а не «сотри значение». Стирают
 *  явным `null` — это осознанное действие, и оно проходит. */
export function changedFields(
  current: Record<string, unknown>,
  incoming: Record<string, unknown>,
): FieldChange[] {
  const changes: FieldChange[] = [];

  for (const field of REFERENCE_FIELDS) {
    if (!(field in incoming)) continue;
    if (same(current[field], incoming[field])) continue;
    changes.push({ field, from: current[field], to: incoming[field] });
  }

  return changes;
}

/** Сводка по корпусу: только тайтлы, у которых есть что менять.
 *
 *  Ключ — оригинальное название, как во всех скриптах наполнения: по русскому
 *  искать нельзя, одноимённые тайтлы в базе норма. Запись файла, которой нет
 *  в базе, пропускается молча — это дело `add-films`, а не этого прохода. */
export function planRefresh(
  rows: Record<string, unknown>[],
  records: Record<string, unknown>[],
): FilmRefresh[] {
  const byKey = new Map<string, Record<string, unknown>>();
  for (const row of rows) {
    const key = row.titleOriginal;
    if (typeof key === 'string' && key !== '') byKey.set(key, row);
  }

  const plan: FilmRefresh[] = [];
  for (const record of records) {
    const key = record.titleOriginal;
    if (typeof key !== 'string' || key === '') continue;

    const row = byKey.get(key);
    if (row === undefined) continue;

    const changes = changedFields(row, record);
    if (changes.length > 0) plan.push({ titleOriginal: key, changes });
  }

  return plan;
}
