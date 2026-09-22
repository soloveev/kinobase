import type { Metadata } from 'next';
import FiltersDisclosure from '@/components/FiltersDisclosure';
import PersonCell from '@/components/PersonCell';
import RoleFilters from '@/components/RoleFilters';
import SiteFooter from '@/components/SiteFooter';
import StatusTabs from '@/components/StatusTabs';
import { getDb } from '@/db';
import { listFilms } from '@/lib/films-repo';
import { countPeople, filmCountsByPerson, listPeople } from '@/lib/people-repo';
import { guestViewOn, viewerIsOwner } from '@/lib/session';
import { statusCounts, todayIso } from '@/lib/status';
import { parseRoles, type StatusFilter } from '@/lib/url-state';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = { title: 'Персоналии — Кино База' };

export default async function PeoplePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const roles = parseRoles(params.role);

  const db = getDb();
  const owner = await viewerIsOwner();
  const guestView = await guestViewOn();
  const all = listPeople(db);
  const filmCounts = filmCountsByPerson(db);

  // Внутри группы ролей — «любая из выбранных», как у жанров в `applyFilters`.
  const shown =
    roles.length === 0
      ? all
      : all.filter((person) => roles.some((role) => (person.roles ?? []).includes(role)));

  // Приглушение считается по всей базе, а не по отфильтрованной выборке: иначе выбор
  // одной роли гасил бы все остальные и выйти из фильтра было бы некуда.
  const roleCounts = new Map<string, number>();
  for (const person of all) {
    for (const role of person.roles ?? []) {
      roleCounts.set(role, (roleCounts.get(role) ?? 0) + 1);
    }
  }

  const counts: Record<StatusFilter, number> = statusCounts(listFilms(db), todayIso());

  return (
    <>
      {/* Отбор ролей живёт там же, где отбор фильмов на главной: та же кнопка на том же
          месте, та же полоса под шапкой. Два места для одного действия хуже, чем одно
          неудобное, поэтому из тела страницы отбор убран. */}
      <FiltersDisclosure
        section="people"
        peopleCount={countPeople(db)}
        nav={<StatusTabs active={null} sort="date" counts={counts} />}
        panel={<RoleFilters selected={roles} counts={roleCounts} />}
        appliedCount={roles.length}
      />

      <main className="mx-auto w-full max-w-[1600px] flex-1 px-5 pb-20 sm:px-8">
        <div className="mt-8 lg:mt-12">
          <h1 className="text-[clamp(1.75rem,3.5vw,3rem)] font-extrabold leading-[1.04] tracking-[-0.02em]">
            Персоналии
          </h1>
        </div>

        {shown.length === 0 ? (
          <p className="mt-12 max-w-[46ch] leading-relaxed text-ink-soft">
            Под этот отбор в базе никто не подошёл.
          </p>
        ) : (
          <ul className="mt-8 grid grid-cols-2 gap-x-5 gap-y-10 sm:grid-cols-3 lg:grid-cols-5 2xl:grid-cols-6">
            {shown.map((person, index) => (
              <PersonCell
                key={person.id}
                person={person}
                filmCount={filmCounts.get(person.id) ?? 0}
                index={index}
              />
            ))}
          </ul>
        )}

        <SiteFooter owner={owner} guestView={guestView} />
      </main>
    </>
  );
}
