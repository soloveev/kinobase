import Link from 'next/link';
import { STATUS_STYLES } from '@/components/plaques';
import type { SortMode } from '@/lib/sort';
import { gridHref, type StatusFilter } from '@/lib/url-state';

const TABS: { key: StatusFilter; label: string; activeClass: string }[] = [
  { key: 'all', label: 'Все', activeClass: 'bg-ink text-paper' },
  { key: 'watched', label: 'Посмотрел', activeClass: STATUS_STYLES.watched },
  { key: 'will-watch', label: 'Буду смотреть', activeClass: STATUS_STYLES['will-watch'] },
  { key: 'waiting', label: 'Ждём', activeClass: STATUS_STYLES.waiting },
  // Последний: «Другие» — фон базы, а не рабочий список.
  { key: 'other', label: 'Другие', activeClass: STATUS_STYLES.other },
];

export default function StatusTabs({
  active,
  sort,
  counts,
}: {
  active: StatusFilter | null;
  sort: SortMode;
  counts: Record<StatusFilter, number>;
}) {
  return (
    <nav aria-label="Статусы" className="flex flex-wrap gap-x-1 gap-y-1">
      {TABS.map((tab) => {
        const isActive = tab.key === active;
        return (
          <Link
            key={tab.key}
            href={gridHref(tab.key, sort)}
            aria-current={isActive ? 'page' : undefined}
            className={`px-2.5 py-1.5 text-sm font-extrabold uppercase tracking-wide ${
              isActive ? tab.activeClass : 'text-ink hover:underline hover:underline-offset-4'
            }`}
          >
            {tab.label}
            <span className={`ml-1.5 tabular-nums ${isActive ? 'opacity-70' : 'text-ink-soft'}`}>
              {counts[tab.key]}
            </span>
          </Link>
        );
      })}
    </nav>
  );
}
