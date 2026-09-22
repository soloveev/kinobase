import Link from 'next/link';
import type { ReactNode } from 'react';

/** Разделы сайта, живущие рядом с табами статусов, а не внутри них: табы — про отбор
 *  фильмов, а это другие страницы целиком. */
export type Section = 'people';

const ITEM = 'px-2.5 py-1.5 text-sm font-extrabold uppercase tracking-wide';
const ACTIVE = 'bg-ink text-paper';
const IDLE = 'text-ink hover:underline hover:underline-offset-4';

// Универсальный компонент: страница фильма рендерит его на сервере,
// FiltersDisclosure — на клиенте. Поэтому здесь только разметка.
export default function SiteHeader({
  nav,
  actions,
  below,
  section,
  peopleCount,
}: {
  nav: ReactNode;
  actions?: ReactNode;
  below?: ReactNode;
  /** Какой раздел сайта открыт. Табы статусов — про фильмы, поэтому «Персоналии»
   *  живут рядом с ними, а не внутри. */
  section?: Section;
  /** Сколько персоналий в базе. Шапка уже отвечает на вопрос «сколько там всего»
   *  для каждой секции фильмов, и единственный пункт без числа читался бы пунктом
   *  другого рода. Число — по всей базе: выбор роли его не меняет, ровно как выбор
   *  жанра не меняет чисел в табах статусов. */
  peopleCount?: number;
}) {
  const isPeople = section === 'people';

  return (
    <header className="border-b border-hairline">
      <div className="mx-auto flex w-full max-w-[1600px] flex-wrap items-center gap-x-6 gap-y-2 px-5 py-3 sm:px-8">
        <Link
          href="/"
          className="text-base font-extrabold uppercase tracking-[-0.01em] sm:text-lg"
        >
          Кино База<span className="text-vermilion">.</span>
        </Link>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">{nav}</div>
        {/* Растяжка живёт на обёртке, а не на пункте: пункт не должен отъезжать
            к правому краю, к кнопке фильтров. */}
        <div className="mr-auto flex flex-wrap items-center gap-x-1 gap-y-2">
          <Link
            href="/people"
            aria-current={isPeople ? 'page' : undefined}
            className={`${ITEM} ${isPeople ? ACTIVE : IDLE}`}
          >
            Персоналии
            {peopleCount !== undefined && (
              <span
                className={`ml-1.5 tabular-nums ${isPeople ? 'opacity-70' : 'text-ink-soft'}`}
              >
                {peopleCount}
              </span>
            )}
          </Link>
        </div>
        {actions}
      </div>
      {below}
    </header>
  );
}
