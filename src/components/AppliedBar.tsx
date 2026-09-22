import Link from 'next/link';
import { appliedChips, countFilters, EMPTY_FILTERS, type Filters } from '@/lib/filters';
import type { SortMode } from '@/lib/sort';
import { gridHref, type StatusFilter } from '@/lib/url-state';
import { CloseIcon, StarIcon } from './plaques';

/** Строка применённого: что отобрано, видно и при свёрнутой панели. Раньше это
 *  пересказывал хвост на кнопке «Фильтры» — он рос с каждым фильтром, переносил шапку
 *  на вторую строку и не давал снять ни один фильтр по отдельности.
 *
 *  Плашка — контурная форма мира, та же, что у статуса «буду смотреть». Подложка
 *  строки — тёплая бумага справки: строка принадлежит хромировке, но с шапкой не спорит. */
export default function AppliedBar({
  status,
  sort,
  filters,
  shown,
  total,
}: {
  status: StatusFilter;
  sort: SortMode;
  filters: Filters;
  /** Сколько тайтлов осталось после отбора и сколько их в текущем табе. */
  shown: number;
  total: number;
}) {
  if (countFilters(filters) === 0) return null;

  return (
    <div className="border-t border-hairline bg-sand">
      <div className="mx-auto flex w-full max-w-[1600px] items-center gap-2 overflow-x-auto px-5 py-2 sm:px-8">
        <span className="shrink-0 text-[0.6875rem] font-extrabold uppercase tracking-widest tabular-nums text-ink-soft">
          Отобрано <b className="text-ink">{shown}</b> из {total}
        </span>

        <span className="flex items-center gap-1.5">
          {appliedChips(filters).map((chip) => (
            <span
              key={`${chip.kind}-${chip.label}`}
              className="flex shrink-0 items-stretch whitespace-nowrap bg-paper shadow-[inset_0_0_0_1px_var(--ink)]"
            >
              <span className="inline-flex items-center gap-1.5 px-2 py-1 text-xs font-extrabold uppercase tracking-wide tabular-nums">
                {chip.kind === 'taste' && <StarIcon filled className="h-3 w-3" />}
                {chip.label}
              </span>
              <Link
                href={gridHref(status, sort, chip.without)}
                aria-label={`Снять: ${chip.label}`}
                className="inline-flex items-center border-l border-hairline px-1.5 text-ink-soft transition-colors duration-150 hover:border-ink hover:bg-ink hover:text-paper"
              >
                <CloseIcon className="h-2.5 w-2.5" />
              </Link>
            </span>
          ))}
        </span>

        <Link
          href={gridHref(status, sort, EMPTY_FILTERS)}
          className="ml-auto shrink-0 pl-4 text-xs font-extrabold uppercase tracking-wide underline decoration-2 underline-offset-4 hover:text-vermilion"
        >
          Сбросить всё
        </Link>
      </div>
    </div>
  );
}
