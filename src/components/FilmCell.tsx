import Image from 'next/image';
import Link from 'next/link';
import type { Film } from '@/db/schema';
import type { FilmStatus } from '@/lib/status';
import { formatDayMonthRu, formatInMonthRu, formatRating, yearOf } from '@/lib/format';
import { displayTitle } from '@/lib/titles';
import { awaitedDate, awaitsSeason } from '@/lib/seasons';
import { RatingPlaque, StarIcon, StatusPlaque } from './plaques';

/** Уточнение к плашке «Ждём»: сезон, если он объявлен, плюс дата, если она известна.
 *  Года в плашке нет — он и так стоит в строке фактов и в заголовке месяца. */
function waitingSuffix(film: Film): string | undefined {
  const season = awaitsSeason(film) ? `сезон ${film.nextSeasonNumber}` : null;
  const date = awaitedDate(film);
  const when = date === null ? null : date.length > 7 ? `с ${formatDayMonthRu(date)}` : formatInMonthRu(date);
  const parts = [season, when].filter(Boolean);
  return parts.length > 0 ? parts.join(' ') : undefined;
}

export default function FilmCell({
  film,
  status,
  index,
  ambiguous,
}: {
  film: Film;
  status: FilmStatus;
  index: number;
  /** Названия, которые в базе встречаются больше одного раза. Набор считает
   *  страница — ячейка в базу не ходит. Без пропа ячейка ведёт себя как раньше. */
  ambiguous?: ReadonlySet<string>;
}) {
  const title = displayTitle(film, ambiguous ?? new Set());
  const factLine = [
    yearOf(film.releaseDate),
    film.imdbRating !== null ? `IMDb ${formatRating(film.imdbRating)}` : null,
    film.kinopoiskRating !== null ? `КП ${formatRating(film.kinopoiskRating)}` : null,
  ].filter(Boolean);

  return (
    <li>
      <Link href={`/films/${film.id}`} className="group block">
        <div className="relative aspect-2/3 overflow-hidden bg-hairline transition-shadow duration-300 group-hover:shadow-[0_10px_28px_rgba(23,21,17,0.22)]">
          {film.posterPath ? (
            <Image
              src={film.posterPath}
              alt={`Постер: ${title}`}
              fill
              sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, (max-width: 1536px) 20vw, 17vw"
              className="object-cover motion-safe:transition-transform motion-safe:duration-300 motion-safe:ease-out motion-safe:group-hover:scale-[1.03]"
            />
          ) : (
            <div className="flex h-full items-center justify-center p-4">
              <span className="text-center text-lg font-extrabold uppercase leading-tight text-ink-soft">
                {title}
              </span>
            </div>
          )}
        </div>
        <div className="mt-3 flex flex-col gap-1.5 border-t-2 border-ink pt-2">
          <div className="flex items-start justify-between gap-2">
            <div className="flex min-w-0 items-baseline gap-1.5">
              <span aria-hidden="true" className="text-xs tabular-nums text-ink-soft">
                {String(index + 1).padStart(2, '0')}
              </span>
              <h2 className="hyphens-auto font-extrabold leading-tight group-hover:underline group-hover:underline-offset-4">
                {title}
              </h2>
            </div>
            <span className="flex shrink-0 items-center gap-1.5 pt-0.5">
              {film.tasteStar && <StarIcon filled className="h-4 w-4" />}
              {film.myRating !== null && <RatingPlaque value={film.myRating} />}
            </span>
          </div>
          {factLine.length > 0 && (
            <p className="text-sm tabular-nums text-ink-soft">{factLine.join(' · ')}</p>
          )}
          <StatusPlaque
            status={status}
            suffix={status === 'waiting' ? waitingSuffix(film) : undefined}
            className="self-start"
          />
        </div>
      </Link>
    </li>
  );
}
