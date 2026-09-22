import type { ReactNode } from 'react';
import type { Film } from '@/db/schema';
import { formatDateRu, formatRating } from '@/lib/format';
import { SeasonPlaques } from './plaques';

type Fact = {
  label: string;
  /** Текстовое значение строки. Игнорируется, если задан `node`. */
  value: string;
  /** Значение-разметка: ряд сезонных плашек рисуется, а не пишется словами. */
  node?: ReactNode;
  href?: string;
};

function factsOf(film: Film): Fact[] {
  const facts: Fact[] = [];

  if (film.releaseDate) {
    facts.push({ label: 'Дата выхода', value: formatDateRu(film.releaseDate) });
  }
  // Сезоны — тот же вопрос момента, что и дата выхода, поэтому стоят рядом с ней,
  // до внешних оценок. Одной строкой: ряд плашек читается быстрее двух строк текста,
  // а на вопрос «когда» отвечает таймлайн, а не карточка.
  if (film.seasonsReleased !== null) {
    facts.push({
      label: 'Сезоны',
      value: '',
      node: <SeasonPlaques released={film.seasonsReleased} next={film.nextSeasonNumber} />,
    });
  }
  if (film.imdbRating !== null || film.imdbId) {
    facts.push({
      label: 'IMDb',
      value: film.imdbRating !== null ? formatRating(film.imdbRating) : '—',
      href: film.imdbId ? `https://www.imdb.com/title/${film.imdbId}/` : undefined,
    });
  }
  if (film.kinopoiskRating !== null || film.kinopoiskId !== null) {
    facts.push({
      label: 'Кинопоиск',
      value: film.kinopoiskRating !== null ? formatRating(film.kinopoiskRating) : '—',
      href:
        film.kinopoiskId !== null
          ? `https://www.kinopoisk.ru/film/${film.kinopoiskId}/`
          : undefined,
    });
  }

  return facts;
}

function Row({ label, value, node }: { label: string; value: string; node?: ReactNode }) {
  return (
    <>
      <dt className="text-xs uppercase tracking-wide text-ink-soft">{label}</dt>
      <dd className="text-right font-extrabold tabular-nums">{node ?? value}</dd>
    </>
  );
}

const ROW = 'flex items-baseline justify-between gap-4 border-b border-hairline py-2.5 first:border-t';

/** Выходные данные фильма. Строки с внешними оценками кликабельны целиком —
 *  ведут на страницу-источник; подчёркивания нет, кликабельность показывает
 *  курсор и смена цвета. */
export default function FilmFacts({ film }: { film: Film }) {
  const facts = factsOf(film);
  if (facts.length === 0) return null;

  return (
    <dl>
      {facts.map((fact): ReactNode =>
        fact.href ? (
          <a
            key={fact.label}
            href={fact.href}
            target="_blank"
            rel="noopener noreferrer"
            className={`${ROW} no-underline transition-colors duration-150 hover:text-vermilion`}
          >
            <Row label={fact.label} value={fact.value} node={fact.node} />
          </a>
        ) : (
          <div key={fact.label} className={ROW}>
            <Row label={fact.label} value={fact.value} node={fact.node} />
          </div>
        )
      )}
    </dl>
  );
}
