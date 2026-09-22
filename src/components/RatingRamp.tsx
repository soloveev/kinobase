import Link from 'next/link';
import type { Filters } from '@/lib/filters';
import type { SortMode } from '@/lib/sort';
import { gridHref, type StatusFilter } from '@/lib/url-state';
import { ratingPickStyle, ratingStyle } from './plaques';

const SCALE = Array.from({ length: 10 }, (_, index) => index + 1);

/** Рампа-фильтр: те же десять квадратов, которыми оценка показана в сетке.
 *  Щелчок по ступени значит «эта оценка и выше», щелчок по уже выбранной снимает.
 *
 *  Подпись «и выше» и значение «без оценки» стоят рядом, но принадлежат группе
 *  «Оценка» в панели, а не рампе: рампа — это шкала и только шкала. */
export default function RatingRamp({
  status,
  sort,
  filters,
}: {
  status: StatusFilter;
  sort: SortMode;
  filters: Filters;
}) {
  // Порог задаёт только число: «без оценки» — другой вопрос, и помечать в шкале ему нечего.
  const from = typeof filters.rating === 'number' ? filters.rating : null;

  return (
    <span className="inline-flex gap-px">
      {SCALE.map((value) => {
        const picked = from !== null && value >= from;
        return (
          <Link
            key={value}
            href={gridHref(status, sort, {
              ...filters,
              rating: filters.rating === value ? null : value,
            })}
            aria-label={`Оценка ${value} и выше`}
            aria-current={picked ? 'true' : undefined}
            style={{
              ...(picked ? ratingPickStyle(value) : ratingStyle(value)),
              // Приглушается то, что осталось ниже порога: шкала должна читаться
              // диапазоном, а не десятью одинаково громкими квадратами.
              opacity: from !== null && value < from ? 0.22 : 1,
            }}
            className="inline-flex h-5.5 w-5.5 items-center justify-center text-[0.6875rem] font-extrabold tabular-nums transition-opacity duration-150"
          >
            {value}
          </Link>
        );
      })}
    </span>
  );
}
