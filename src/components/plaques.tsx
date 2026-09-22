import type { CSSProperties } from 'react';
import { pluralForm } from '@/lib/format';
import { STATUS_LABELS, type FilmStatus } from '@/lib/status';

// Единственный источник правды по формам статусных плашек: табы, сетка
// и карточка используют эти же классы.
export const STATUS_STYLES: Record<FilmStatus, string> = {
  watched: 'bg-ink text-paper',
  'will-watch': 'shadow-[inset_0_0_0_1px_var(--ink)] text-ink',
  waiting: 'bg-vermilion text-paper',
  // Та же контурная грамматика, что у «буду смотреть», но тише: контур на hairline,
  // текст вторичным цветом. «Другое» — фон базы, а не рабочий статус.
  other: 'shadow-[inset_0_0_0_1px_var(--hairline)] text-ink-soft',
};

export function StatusPlaque({
  status,
  suffix,
  className = '',
}: {
  status: FilmStatus;
  suffix?: string;
  className?: string;
}) {
  return (
    <span
      className={`inline-block px-2 py-1 text-xs font-extrabold uppercase tracking-wide tabular-nums ${STATUS_STYLES[status]} ${className}`}
    >
      {STATUS_LABELS[status]}
      {suffix && ` ${suffix}`}
    </span>
  );
}

// Две формы сезонной плашки — та же грамматика, что у статусов и оценки:
// квадрат с числом означает состояние, а не подпись.
export const SEASON_STYLES: Record<'released' | 'awaited', string> = {
  released: 'bg-ink text-paper',
  awaited: 'bg-hairline text-ink-soft',
};

/** Ряд сезонов: вышедшие сплошной чернильной плашкой, объявленный — тихой.
 *  Подписей и дат нет, состояние читается формой. Экранному диктору форма
 *  недоступна, поэтому у ряда есть имя словами. */
export function SeasonPlaques({ released, next }: { released: number; next: number | null }) {
  const numbers: { value: number; state: 'released' | 'awaited' }[] = Array.from(
    { length: released },
    (_, i) => ({ value: i + 1, state: 'released' as const })
  );
  if (next !== null) numbers.push({ value: next, state: 'awaited' });

  // «вышел 1», но «вышло 2». Согласование берётся из общего правила модуля
  // форматирования: до 15.09.2026 арифметика стояла здесь четвёртой копией.
  // Форма без числа, потому что глагол здесь стоит перед ним, а не после.
  const verb = pluralForm(released, ['вышел', 'вышло', 'вышло']);
  const label =
    next !== null
      ? `Сезоны: ${verb} ${released}, ждём ${next}-й`
      : `Сезоны: ${verb} ${released}`;

  return (
    <span role="group" aria-label={label} className="flex flex-wrap justify-end gap-1">
      {numbers.map((season) => (
        <span
          key={season.value}
          data-state={season.state}
          aria-hidden="true"
          className={`inline-flex h-6 w-6 items-center justify-center text-xs font-extrabold tabular-nums ${SEASON_STYLES[season.state]}`}
        >
          {season.value}
        </span>
      ))}
    </span>
  );
}

/** Плашка для тайтла, до которого агент ещё не дошёл. Стоит в конце читательской
 *  зоны, на месте, где было бы досье: пустая страница не должна выглядеть поломкой,
 *  а молчание — объясняться само. Рамка по контуру и отступы делают её плашкой,
 *  а не абзацем: взгляд останавливается, но с содержимым карточки она не спорит. */
export function AgentNotice() {
  return (
    <div className="border border-hairline px-8 py-10 text-center text-ink-soft">
      <p className="mx-auto max-w-[46ch] leading-relaxed">
        Агенты ещё не собрали информацию о фильме, потому что трудятся над другими
        задачами. Возможно, она появится в будущем. Вы можете поискать инфо о нём
        самостоятельно.
      </p>
    </div>
  );
}

// Без контура светлый край шкалы растворяется в листе и перестаёт быть квадратом.
// На тёмных ступенях контур не виден вовсе.
const RATING_OUTLINE = 'inset 0 0 0 1px color-mix(in oklab, var(--ink) 10%, transparent)';

// Фиксированная 10-ступенчатая рампа: заливка чернил монотонно растёт со значением.
// Показатель 1,7 разводит верх шкалы, где стоит большинство оценок, и слепляет низ,
// где различать нечего. Потолок в 44 % — не вкус: выше 50 % чернильная цифра ушла бы
// под порог контраста, и пришлось бы возвращать переворот в бумажную, то есть разрыв
// посреди шкалы. Правило и довод — в DESIGN.md, правка 31.08.2026.
export function ratingStyle(value: number): CSSProperties {
  const inkShare = 44 * Math.pow((value - 1) / 9, 1.7);
  return {
    background: `color-mix(in oklab, var(--ink) ${inkShare.toFixed(1)}%, var(--paper))`,
    color: 'var(--ink)',
    boxShadow: RATING_OUTLINE,
  };
}

/** Та же ступень, помеченная выбранной. Знак выбора отделён от заливки: на светлой
 *  рампе выбранная единица залита бумагой и от невыбранной неотличима, поэтому
 *  выбор показывает контур — чернильный вместо hairline. */
export function ratingPickStyle(value: number): CSSProperties {
  return { ...ratingStyle(value), boxShadow: 'inset 0 0 0 1px var(--ink)' };
}

export function RatingPlaque({ value, className = '' }: { value: number; className?: string }) {
  return (
    <span
      style={ratingStyle(value)}
      className={`inline-flex h-6 w-6 items-center justify-center text-xs font-extrabold tabular-nums ${className}`}
      aria-label={`Моя оценка ${value}`}
    >
      {value}
    </span>
  );
}

// Шеврон секций досье. Тот же вес штриха, что у звезды: иконки в проекте —
// только авторские SVG, юникод-глифов и эмодзи нет.
export function ChevronIcon({ className = '' }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      aria-hidden="true"
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
    >
      <path d="M6 9.5l6 6 6-6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

// Крест закрытия полноэкранного постера. Тот же вес штриха, что у шеврона и звезды.
export function CloseIcon({ className = '' }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      aria-hidden="true"
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
    >
      <path d="M6 6l12 12M18 6L6 18" strokeLinecap="round" />
    </svg>
  );
}

export function StarIcon({ filled, className = '' }: { filled: boolean; className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      aria-hidden="true"
      className={className}
      fill={filled ? 'var(--gold)' : 'none'}
      stroke={filled ? 'var(--gold)' : 'currentColor'}
      strokeWidth="1.8"
    >
      <path
        d="M12 2.6l2.9 6 6.6.9-4.8 4.6 1.2 6.5L12 17.5l-5.9 3.1 1.2-6.5L2.5 9.5l6.6-.9z"
        strokeLinejoin="round"
      />
    </svg>
  );
}
