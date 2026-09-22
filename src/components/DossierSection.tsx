'use client';

import { useState, type ReactNode } from 'react';
import { ChevronIcon } from './plaques';

/** Оболочка сворачиваемой секции досье. Содержимое приходит детьми и рендерится
 *  на сервере: клиентским остаётся только переключатель — тот же приём, что
 *  у `FiltersDisclosure`.
 *
 *  `defaultOpen` считается на сервере и приходит пропом: вычислить «сегодня»
 *  здесь значило бы получить расхождение гидратации около полуночи.
 *
 *  `minor` — для приложений вроде списка источников: их открывает hairline,
 *  а не чернильная линейка крупной секции.
 *
 *  `accent` — пастельная плашка блока ключей: он выделен фоном, а не яркостью.
 *  Плашка охватывает и заголовок, и содержимое, а линейка полосы остаётся сверху,
 *  как у соседей.
 *
 *  Отступ по бокам плашка получает отрицательным полем, а не внутренним: текст
 *  обязан стоять на той же вертикали, что у соседних полос — левый край листа
 *  в этом мире держит всю страницу. Шестнадцать пикселей выбраны по замеру:
 *  поле листа ровно столько и позволяет, не выпуская фон за край. Тон живёт
 *  в палитре. */
export default function DossierSection({
  title,
  hint,
  defaultOpen,
  minor = false,
  tone = 'plain',
  children,
}: {
  title: string;
  hint?: string;
  defaultOpen: boolean;
  minor?: boolean;
  tone?: 'plain' | 'accent';
  children: ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);

  const frame = minor ? 'border-t border-hairline pt-4' : 'border-t-2 border-ink pt-5';
  const plaque = tone === 'accent' ? ' bg-sand -mx-4 px-4 pb-6' : '';

  return (
    <section className={frame + plaque}>
      <h2>
        <button
          type="button"
          aria-expanded={open}
          onClick={() => setOpen(!open)}
          className="group flex w-full items-baseline justify-between gap-6 text-left transition-colors duration-150 hover:text-vermilion"
        >
          <span className="flex min-w-0 flex-col gap-1">
            <span className="text-sm font-extrabold uppercase tracking-wide">{title}</span>
            {/* Свёрнутая секция не прячет содержимое вслепую: видно, что внутри. */}
            {!open && hint && <span className="text-sm font-normal text-ink-soft">{hint}</span>}
          </span>
          <ChevronIcon
            className={`h-5 w-5 shrink-0 translate-y-1 ${open ? 'rotate-180' : ''}`}
          />
        </button>
      </h2>

      {open && <div className="mt-6 flex flex-col gap-8">{children}</div>}
    </section>
  );
}
