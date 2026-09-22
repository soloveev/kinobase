import Link from 'next/link';
import AppliedBar from '@/components/AppliedBar';
import FilmCell from '@/components/FilmCell';
import FiltersDisclosure from '@/components/FiltersDisclosure';
import FiltersPanel from '@/components/FiltersPanel';
import SiteFooter from '@/components/SiteFooter';
import StatusTabs from '@/components/StatusTabs';
import Timeline from '@/components/Timeline';
import { getDb } from '@/db';
import {
  appliedChips,
  applyFilters,
  countFilters,
  EMPTY_FILTERS,
  genreCounts,
  isEmpty,
} from '@/lib/filters';
import { listFilms } from '@/lib/films-repo';
import { countPeople } from '@/lib/people-repo';
import { ambiguousTitles } from '@/lib/titles';
import { guestViewOn, viewerIsOwner } from '@/lib/session';
import { sortFilms } from '@/lib/sort';
import { filmStatus, isAwaited, STATUS_LABELS, statusCounts, todayIso } from '@/lib/status';
import { gridHref, parseFilters, parseSort, parseStatus, type StatusFilter } from '@/lib/url-state';

export const dynamic = 'force-dynamic';

export default async function Home({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const status = parseStatus(params.status);
  const sort = parseSort(params.sort);
  const filters = parseFilters(params);

  const owner = await viewerIsOwner();

  const guestView = await guestViewOn();
  const all = listFilms(getDb());
  // Считается по всей базе, а не по отобранному: одноимённый тайтл, не попавший
  // в текущий таб, всё равно делает название неоднозначным.
  const ambiguous = ambiguousTitles(all);
  const today = todayIso();
  const statuses = new Map(all.map((film) => [film.id, filmStatus(film, today)]));

  const counts: Record<StatusFilter, number> = statusCounts(all, today);

  // «Ждём» — единственный таб, чей состав шире своего статуса: туда же попадает
  // сериал, ждущий нового сезона, в том числе уже просмотренный.
  const inTab =
    status === 'all'
      ? all
      : status === 'waiting'
        ? all.filter((film) => isAwaited(film, today))
        : all.filter((film) => statuses.get(film.id) === status);
  const filtered = applyFilters(inTab, filters);
  // В «Ждём» порядок задаёт таймлайн (группировка по месяцам), сортировка не участвует.
  const visible = status === 'waiting' ? filtered : sortFilms(filtered, sort);

  // Подписи выбранного собраны в одном месте: их читают и строка применённого,
  // и пустое состояние ниже, и разойтись они не должны.
  const applied = appliedChips(filters).map((chip) => chip.label);

  return (
    <>
      <FiltersDisclosure
        peopleCount={countPeople(getDb())}
        nav={<StatusTabs active={status} sort={sort} counts={counts} />}
        panel={
          <FiltersPanel
            status={status}
            sort={sort}
            filters={filters}
            genreCounts={genreCounts(inTab)}
            showSort={status !== 'waiting'}
          />
        }
        applied={
          <AppliedBar
            status={status}
            sort={sort}
            filters={filters}
            shown={visible.length}
            total={inTab.length}
          />
        }
        appliedCount={countFilters(filters)}
      />

      <main className="mx-auto flex w-full max-w-[1600px] flex-1 flex-col px-5 pb-12 sm:px-8">
        <h1 className="sr-only">
          Кино База — {status === 'all' ? 'все фильмы' : STATUS_LABELS[status].toLowerCase()}
        </h1>

        {all.length === 0 ? (
          <div className="mt-12 max-w-md border-t-2 border-ink pt-5">
            <p className="text-2xl font-extrabold uppercase">В базе пока нет фильмов</p>
            <p className="mt-3 border-t border-hairline pt-3 text-sm text-ink-soft">
              Наполнение — командой <code className="font-extrabold">npm run seed</code>
            </p>
          </div>
        ) : visible.length === 0 ? (
          <div className="mt-12 max-w-md border-t-2 border-ink pt-5">
            <p className="text-2xl font-extrabold uppercase">
              {isEmpty(filters) ? 'Здесь пока пусто' : 'Под фильтры ничего не подошло'}
            </p>
            {isEmpty(filters) ? (
              <p className="mt-3 border-t border-hairline pt-3 text-sm tabular-nums text-ink-soft">
                {status !== 'all'
                  ? `В секции «${STATUS_LABELS[status as Exclude<StatusFilter, 'all'>]}» ни одного фильма — все ${counts.all} во вкладке «Все»`
                  : 'Ни одного фильма'}
              </p>
            ) : (
              <p className="mt-3 border-t border-hairline pt-3 text-sm text-ink-soft">
                Выбрано: {applied.join(', ')}.{' '}
                <Link
                  href={gridHref(status, sort, EMPTY_FILTERS)}
                  className="font-extrabold text-ink underline decoration-2 underline-offset-4"
                >
                  Сбросить фильтры
                </Link>
              </p>
            )}
          </div>
        ) : status === 'waiting' ? (
          <Timeline films={visible} ambiguous={ambiguous} />
        ) : (
          <ul className="mt-8 grid grid-cols-2 gap-x-5 gap-y-10 sm:grid-cols-3 lg:grid-cols-5 2xl:grid-cols-6">
            {visible.map((film, index) => (
              <FilmCell
                key={film.id}
                film={film}
                status={statuses.get(film.id)!}
                index={index}
                ambiguous={ambiguous}
              />
            ))}
          </ul>
        )}

        <SiteFooter owner={owner} guestView={guestView} />
      </main>
    </>
  );
}
