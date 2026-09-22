import type { Film } from '@/db/schema';

export type MonthGroup = {
  month: string | null; // 'YYYY-MM'; null — хвостовая группа «Дата выхода неизвестна»
  films: Film[];
};

/** Группирует тайтлы таба «Ждём» по месяцу. Дата приходит извне: у сериала это
 *  дата следующего сезона, у фильма — дата выхода. Месяцы — по возрастанию,
 *  внутри месяца — по дате, при равной дате — по алфавиту русского названия.
 *  Дата допускает точность до месяца ('2027-03'): такой тайтл сравнивается
 *  лексикографически и потому встаёт в начале своего месяца — это верно, а не
 *  случайно: «где-то в марте» раньше, чем «двенадцатого марта».
 *  Тайтлы, у которых даты нет, собираются в хвостовую группу — она идёт после
 *  всех месяцев, как бы далеко в будущее ни уходил последний из них. */
export function groupByMonth(films: Film[], dateOf: (film: Film) => string | null): MonthGroup[] {
  const byTitle = (a: Film, b: Film) => a.titleRu.localeCompare(b.titleRu, 'ru');

  const dated = films
    .filter((film) => dateOf(film) !== null)
    .sort((a, b) => {
      const left = dateOf(a)!;
      const right = dateOf(b)!;
      if (left === right) return byTitle(a, b);
      return left < right ? -1 : 1;
    });

  const groups: MonthGroup[] = [];
  for (const film of dated) {
    const month = dateOf(film)!.slice(0, 7);
    const last = groups[groups.length - 1];
    if (last && last.month === month) {
      last.films.push(film);
    } else {
      groups.push({ month, films: [film] });
    }
  }

  const undated = films.filter((film) => dateOf(film) === null).sort(byTitle);
  if (undated.length > 0) groups.push({ month: null, films: undated });

  return groups;
}
