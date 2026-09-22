import Link from 'next/link';
import { EMPTY_FILTERS } from '@/lib/filters';
import { sortTags, type Tag } from '@/lib/tags';
import { gridHref } from '@/lib/url-state';

const CHIP = 'inline-block px-2 py-1 text-xs font-extrabold uppercase tracking-wide';

/** Куда ведёт тег: форма, вид и жанр фильтруют сетку, настроение пока нет —
 *  фильтра по настроению в v3 не предусмотрено. */
function hrefOf(tag: Tag): string | null {
  switch (tag.category) {
    case 'form':
      return gridHref('all', 'date', { ...EMPTY_FILTERS, form: tag.slug });
    case 'kind':
      return gridHref('all', 'date', { ...EMPTY_FILTERS, kind: tag.slug });
    case 'genre':
      return gridHref('all', 'date', { ...EMPTY_FILTERS, genres: [tag.slug] });
    default:
      return null;
  }
}

export default function TagList({ tags }: { tags: string[] }) {
  const sorted = sortTags(tags);
  if (sorted.length === 0) return null;

  return (
    <ul className="flex flex-wrap gap-1.5">
      {sorted.map((tag) => {
        const href = hrefOf(tag);
        return (
          <li key={tag.slug}>
            {href ? (
              <Link
                href={href}
                className={`${CHIP} no-underline shadow-[inset_0_0_0_1px_var(--ink)] transition-colors duration-150 hover:bg-ink hover:text-paper`}
              >
                {tag.label}
              </Link>
            ) : (
              <span className={`${CHIP} bg-hairline text-ink-soft`}>{tag.label}</span>
            )}
          </li>
        );
      })}
    </ul>
  );
}
