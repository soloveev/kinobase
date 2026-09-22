'use client';

import { useState, type ReactNode } from 'react';
import SiteHeader, { type Section } from './SiteHeader';

export default function FiltersDisclosure({
  nav,
  panel,
  applied,
  appliedCount = 0,
  section,
  peopleCount,
}: {
  nav: ReactNode;
  panel: ReactNode;
  /** Строка применённого. Стоит под панелью и видна независимо от того, раскрыта та
   *  или свёрнута: ради этого версия и затевалась. */
  applied?: ReactNode;
  /** Сколько фильтров применено — числом на кнопке. Хвоста из названий на ней больше
   *  нет: он рос с каждым фильтром и не давал снять ни один по отдельности. */
  appliedCount?: number;
  section?: Section;
  peopleCount?: number;
}) {
  const [open, setOpen] = useState(false);

  if (panel == null) {
    return <SiteHeader nav={nav} section={section} peopleCount={peopleCount} below={applied} />;
  }

  return (
    <SiteHeader
      nav={nav}
      section={section}
      peopleCount={peopleCount}
      actions={
        <button
          type="button"
          aria-expanded={open}
          onClick={() => setOpen(!open)}
          className={`flex items-center gap-2 px-2.5 py-1.5 text-sm font-extrabold uppercase tracking-wide transition-colors duration-150 ${
            open
              ? 'bg-ink text-paper'
              : 'text-ink shadow-[inset_0_0_0_1px_var(--ink)] hover:bg-ink hover:text-paper'
          }`}
        >
          Фильтры
          {appliedCount > 0 && (
            <span
              className={`min-w-[1.125rem] px-1 text-center tabular-nums ${
                open ? 'bg-paper text-ink' : 'bg-vermilion text-paper'
              }`}
            >
              {appliedCount}
            </span>
          )}
        </button>
      }
      below={
        <>
          {open && (
            <div className="border-t border-hairline">
              <div className="mx-auto w-full max-w-[1600px] px-5 py-4 sm:px-8">{panel}</div>
            </div>
          )}
          {applied}
        </>
      }
    />
  );
}
