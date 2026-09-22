import Link from 'next/link';
import type { ReactNode } from 'react';
import type { Filters } from '@/lib/filters';
import type { SortMode } from '@/lib/sort';
import { tagsOfCategory, type Tag, type TagCategory } from '@/lib/tags';
import { gridHref, type StatusFilter } from '@/lib/url-state';
import RatingRamp from './RatingRamp';

type Props = {
  status: StatusFilter;
  sort: SortMode;
  filters: Filters;
  genreCounts: Map<string, number>;
  /** В табе «Ждём» порядок задаёт таймлайн, поэтому сортировку там не показываем. */
  showSort?: boolean;
};

// Подпись выключена по правому краю: значения всех семи групп начинают одну вертикаль.
// Это тот же приём, которым в карточке фильма набрана таблица создателей.
const GROUP_LABEL =
  'text-right text-[0.5625rem] font-extrabold uppercase tracking-[0.04em] text-ink-soft md:text-xs md:tracking-widest';
const ACTIVE = 'font-extrabold underline decoration-2 underline-offset-4';
const IDLE = 'text-ink-soft hover:text-ink hover:underline hover:underline-offset-4';

/** Строка таблицы: подпись слева, значения справа. Со второй строки — hairline-линейка
 *  во всю ширину; она принадлежит строке, а не колонке, поэтому подсетка обязательна. */
function Row({
  id,
  title,
  first = false,
  children,
}: {
  id: string;
  title: string;
  first?: boolean;
  children: ReactNode;
}) {
  return (
    <div
      className={`col-span-2 grid grid-cols-subgrid items-baseline py-1.5 ${
        first ? '' : 'border-t border-hairline'
      }`}
    >
      <span id={id} className={GROUP_LABEL}>
        {title}
      </span>
      <nav
        aria-labelledby={id}
        className="flex flex-wrap items-baseline gap-x-4 gap-y-2 text-sm md:gap-x-5"
      >
        {children}
      </nav>
    </div>
  );
}

function Option({
  href,
  active,
  children,
}: {
  href: string;
  active: boolean;
  children: ReactNode;
}) {
  return (
    <Link href={href} aria-current={active ? 'true' : undefined} className={active ? ACTIVE : IDLE}>
      {children}
    </Link>
  );
}

/** Переключатель с одним выбранным значением: «все» плюс теги категории. */
function singleChoice(
  { status, sort, filters }: Props,
  category: TagCategory,
  field: 'form' | 'kind',
) {
  const options: { slug: string | null; label: string }[] = [
    { slug: null, label: 'все' },
    ...tagsOfCategory(category).map((tag) => ({
      slug: tag.slug,
      label: category === 'form' ? `${tag.label}ы` : tag.label,
    })),
  ];

  return options.map((option) => (
    <Option
      key={option.slug ?? 'all'}
      href={gridHref(status, sort, { ...filters, [field]: option.slug })}
      active={filters[field] === option.slug}
    >
      {option.label}
    </Option>
  ));
}

/** Жанры, под которые в этом табе ничего нет, уходят в хвост списка: живое читается
 *  подряд, а пустое не рвёт строку посередине. Внутри каждой половины порядок
 *  словарный, и внутри таба он не меняется — счётчики считаются по составу таба. */
function genresRanked(counts: Map<string, number>): Tag[] {
  const genres = tagsOfCategory('genre');
  const live = genres.filter((tag) => (counts.get(tag.slug) ?? 0) > 0);
  const empty = genres.filter((tag) => (counts.get(tag.slug) ?? 0) === 0);
  return [...live, ...empty];
}

export default function FiltersPanel(props: Props) {
  const { status, sort, filters, genreCounts, showSort = true } = props;

  return (
    <div className="grid grid-cols-[5rem_minmax(0,1fr)] gap-x-3 md:grid-cols-[max-content_minmax(0,1fr)] md:gap-x-8">
      <Row id="genres-label" title="Жанры" first>
        {genresRanked(genreCounts).map((tag) => {
          const count = genreCounts.get(tag.slug) ?? 0;
          const isActive = filters.genres.includes(tag.slug);

          if (count === 0) {
            return (
              <span key={tag.slug} aria-disabled="true" className="text-hairline">
                {tag.label}
              </span>
            );
          }

          const genres = isActive
            ? filters.genres.filter((slug) => slug !== tag.slug)
            : [...filters.genres, tag.slug];

          return (
            <Option
              key={tag.slug}
              href={gridHref(status, sort, { ...filters, genres })}
              active={isActive}
            >
              {tag.label} <span className="text-xs tabular-nums text-ink-soft">{count}</span>
            </Option>
          );
        })}
      </Row>

      <Row id="form-label" title="Форма">
        {singleChoice(props, 'form', 'form')}
      </Row>

      <Row id="kind-label" title="Вид">
        {singleChoice(props, 'kind', 'kind')}
      </Row>

      {/* Вкус — не тег, а личное поле, поэтому у него свои две ссылки, а не словарь. */}
      <Row id="taste-label" title="Вкус">
        <Option href={gridHref(status, sort, { ...filters, taste: false })} active={!filters.taste}>
          все
        </Option>
        <Option href={gridHref(status, sort, { ...filters, taste: true })} active={filters.taste}>
          по моему вкусу
        </Option>
      </Row>

      <Row id="rating-label" title="Оценка">
        <RatingRamp status={status} sort={sort} filters={filters} />
        <span className="text-xs text-ink-soft">и выше</span>
        <Option
          href={gridHref(status, sort, {
            ...filters,
            rating: filters.rating === 'none' ? null : 'none',
          })}
          active={filters.rating === 'none'}
        >
          без оценки
        </Option>
      </Row>

      <Row id="dossier-label" title="Разбор">
        {(
          [
            [null, 'все'],
            ['yes', 'есть'],
            ['no', 'нет'],
          ] as const
        ).map(([value, label]) => (
          <Option
            key={label}
            href={gridHref(status, sort, { ...filters, dossier: value })}
            active={filters.dossier === value}
          >
            {label}
          </Option>
        ))}
      </Row>

      {showSort && (
        <Row id="sort-label" title="Сортировка">
          {(
            [
              ['date', 'по дате выхода'],
              ['rating', 'по моей оценке'],
            ] as const
          ).map(([mode, label]) => (
            <Option key={mode} href={gridHref(status, mode, filters)} active={sort === mode}>
              {label}
            </Option>
          ))}
        </Row>
      )}
    </div>
  );
}
