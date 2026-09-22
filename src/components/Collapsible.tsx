import type { ReactNode } from 'react';
import { ChevronIcon } from './plaques';

/** Сворачиваемая секция на нативном `<details>`: без скрипта, работает от клавиатуры
 *  и переживает отключённый JavaScript.
 *
 *  Этим она и отличается от `DossierSection` в карточке фильма — та клиентская, со
 *  своим состоянием. Два разных способа сворачивания в проекте существуют осознанно:
 *  карточка фильма считает `defaultOpen` на сервере от «сегодня» и потому не может
 *  обойтись разметкой, а странице человека такого не нужно.
 *
 *  Уровень заголовка приходит пропом, потому что секция встаёт на разные глубины:
 *  «Основные работы» — второй уровень, произведение внутри «Метода в произведениях» —
 *  четвёртый. Разметка, которая ломает порядок заголовков, ломает и навигацию
 *  по странице с экранным диктором.
 *
 *  `minor` — для приложений вроде списка источников: их открывает hairline, а не
 *  чернильная линейка крупной секции. Та же грамматика, что у `DossierSection`. */
export default function Collapsible({
  title,
  hint,
  level = 2,
  minor = false,
  children,
}: {
  title: string;
  hint?: string;
  level?: 2 | 3 | 4;
  minor?: boolean;
  children: ReactNode;
}) {
  const Heading = `h${level}` as 'h2' | 'h3' | 'h4';
  const titleClass =
    level === 2
      ? 'text-sm font-extrabold uppercase tracking-wide'
      : 'text-lg font-extrabold leading-snug';

  return (
    <details className={`group ${minor ? 'border-t border-hairline pt-4' : 'border-t-2 border-ink pt-5'}`}>
      {/* Стандартный треугольник браузера убран: рядом с ним шеврон читался бы
          двумя разными указателями на одно и то же. */}
      <summary className="flex cursor-pointer list-none items-baseline justify-between gap-6 transition-colors duration-150 hover:text-vermilion [&::-webkit-details-marker]:hidden">
        <span className="flex min-w-0 flex-col gap-1">
          <Heading className={titleClass}>{title}</Heading>
          {/* Свёрнутая секция не прячет содержимое вслепую: видно, что внутри.
              В раскрытой подсказка не нужна — содержимое уже перед глазами.
              Прячется классом, а не условием: состояние `<details>` серверу неизвестно. */}
          {hint && (
            <span className="text-sm font-normal text-ink-soft group-open:hidden">{hint}</span>
          )}
        </span>
        <ChevronIcon className="h-5 w-5 shrink-0 translate-y-1 group-open:rotate-180" />
      </summary>

      <div className="mt-6 flex flex-col gap-8">{children}</div>
    </details>
  );
}
