import { yearOf } from './format';
import { TAGS } from './tags';

/** Слово берётся из словаря тегов, а не пишется здесь второй раз: форма тайтла
 *  названа один раз, в `tags.ts`, и переименование доедет сюда само. */
const SERIES = TAGS.find((tag) => tag.slug === 'series')!.label;

/** Русские названия, которые в базе встречаются больше одного раза.
 *
 *  Неоднозначность — свойство базы целиком, а не отдельной выборки: одноимённый
 *  тайтл, не попавший в текущий отбор, всё равно делает название неоднозначным.
 *  Поэтому набор считается по всей базе, а не по тому, что показано на экране. */
export function ambiguousTitles(films: { titleRu: string }[]): Set<string> {
  const seen = new Set<string>();
  const twice = new Set<string>();

  for (const film of films) {
    if (seen.has(film.titleRu)) twice.add(film.titleRu);
    seen.add(film.titleRu);
  }

  return twice;
}

/** Название для показа. Год приписывается только там, где без него две записи
 *  неразличимы: «Призрак в доспехах (1995)». Уникальные названия не трогаем —
 *  год к ним ничего не добавляет, а строка растёт.
 *
 *  В данные год не пишется никогда: `titleRu` остаётся настоящим названием тайтла,
 *  иначе скрипты наполнения перестали бы находить фильм по нему. */
export function displayTitle(
  film: { titleRu: string; releaseDate: string | null; tags?: readonly string[] },
  ambiguous: ReadonlySet<string>,
): string {
  if (!ambiguous.has(film.titleRu)) return film.titleRu;

  const year = yearOf(film.releaseDate);
  // Пометка различает и без года: у одноимённых фильма и сериала читатель видит
  // форму сразу, а год помнить не обязан. Слово «фильм» не пишется — помечается
  // то, что отличается от общего случая.
  const series = film.tags?.includes('series') === true;

  const marks = [series ? SERIES : null, year === null ? null : String(year)].filter(
    (mark): mark is string => mark !== null,
  );

  // Приписать нечего — ни пометки, ни года у тайтла нет.
  return marks.length === 0 ? film.titleRu : `${film.titleRu} (${marks.join(', ')})`;
}
