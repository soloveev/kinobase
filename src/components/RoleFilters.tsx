import Link from 'next/link';
import { PERSON_ROLES } from '@/lib/people';
import { peopleHref } from '@/lib/url-state';

// Та же грамматика, что у панели фильтров на главной: подпись группы прописными
// вторичным, значения — ряд текстовых ссылок, выбранное подчёркнуто, пустое
// приглушено до hairline. Плашек здесь нет намеренно: в этом мире квадрат
// с числом означает состояние, а не выбор.
const GROUP_LABEL = 'text-xs font-extrabold uppercase tracking-widest text-ink-soft';
const ACTIVE = 'font-extrabold underline decoration-2 underline-offset-4';
const IDLE = 'text-ink-soft hover:text-ink hover:underline hover:underline-offset-4';

export default function RoleFilters({
  selected,
  counts,
}: {
  selected: string[];
  counts: Map<string, number>;
}) {
  const chosen = new Set(selected);

  return (
    <div className="flex flex-col gap-4">
      <nav
        aria-labelledby="roles-label"
        className="flex flex-wrap items-baseline gap-x-5 gap-y-2 text-sm"
      >
        <span id="roles-label" className={GROUP_LABEL}>
          Роли
        </span>

        {PERSON_ROLES.map((role) => {
          const count = counts.get(role.slug) ?? 0;
          const isChosen = chosen.has(role.slug);

          // Роль, под которую в базе никого нет, показана, но не нажимается:
          // приглушение честнее исчезновения — видно, что рубрика существует.
          if (count === 0 && !isChosen) {
            return (
              <span key={role.slug} aria-disabled="true" className="text-hairline">
                {role.label}
              </span>
            );
          }

          // Нажатие на выбранную роль снимает её: набор — это то, что выбрано,
          // и снятие должно быть тем же движением, что выбор.
          const next = isChosen
            ? selected.filter((slug) => slug !== role.slug)
            : [...selected, role.slug];

          return (
            <Link
              key={role.slug}
              href={peopleHref(next)}
              aria-current={isChosen ? 'true' : undefined}
              className={isChosen ? ACTIVE : IDLE}
            >
              {role.label}{' '}
              <span className="text-xs tabular-nums text-ink-soft">{count}</span>
            </Link>
          );
        })}
      </nav>

      {selected.length > 0 && (
        <Link
          href={peopleHref([])}
          className="self-start text-sm underline decoration-2 underline-offset-4"
        >
          Сбросить всё
        </Link>
      )}
    </div>
  );
}
