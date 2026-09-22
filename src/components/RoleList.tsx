import Link from 'next/link';
import { sortRoles } from '@/lib/people';
import { peopleHref } from '@/lib/url-state';

const CHIP = 'inline-block px-2 py-1 text-xs font-extrabold uppercase tracking-wide';

/** Теги ролей персоналии. В отличие от тегов фильма, ведут все: у каждой роли
 *  словаря есть свой отбор в указателе. */
export default function RoleList({ roles }: { roles: string[] }) {
  const sorted = sortRoles(roles);
  if (sorted.length === 0) return null;

  return (
    <ul className="flex flex-wrap gap-1.5">
      {sorted.map((role) => (
        <li key={role.slug}>
          <Link
            href={peopleHref([role.slug])}
            className={`${CHIP} no-underline shadow-[inset_0_0_0_1px_var(--ink)] transition-colors duration-150 hover:bg-ink hover:text-paper`}
          >
            {role.label}
          </Link>
        </li>
      ))}
    </ul>
  );
}
