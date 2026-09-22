import type { Film } from '@/db/schema';
import { formatMonthYearRu } from '@/lib/format';
import { awaitedDate } from '@/lib/seasons';
import { groupByMonth } from '@/lib/timeline';
import FilmCell from './FilmCell';

/** Таймлайн таба «Ждём»: тайтлы секциями по месяцам, нумерация ячеек сквозная
 *  через секции. Сериал встаёт по дате следующего сезона, фильм — по дате выхода;
 *  всё, у чего даты нет, собирается в последнюю секцию. */
export default function Timeline({
  films,
  ambiguous,
}: {
  films: Film[];
  ambiguous?: ReadonlySet<string>;
}) {
  const groups = groupByMonth(films, awaitedDate);
  const starts = groups.map((_, i) =>
    groups.slice(0, i).reduce((sum, g) => sum + g.films.length, 0)
  );

  return (
    <>
      {groups.map((group, groupIndex) => {
        const start = starts[groupIndex];
        return (
          <section key={group.month ?? 'unknown'} className="mt-8">
            <h2 className="border-t-2 border-ink pt-2 text-xl font-extrabold uppercase tracking-wide">
              {group.month === null
                ? 'Дата выхода неизвестна'
                : formatMonthYearRu(`${group.month}-01`)}
            </h2>
            <ul className="mt-6 grid grid-cols-2 gap-x-5 gap-y-10 sm:grid-cols-3 lg:grid-cols-5 2xl:grid-cols-6">
              {group.films.map((film, i) => (
                <FilmCell
                  key={film.id}
                  film={film}
                  status="waiting"
                  index={start + i}
                  ambiguous={ambiguous}
                />
              ))}
            </ul>
          </section>
        );
      })}
    </>
  );
}
