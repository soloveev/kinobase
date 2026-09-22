import type { Metadata } from 'next';
import Image from 'next/image';
import { notFound } from 'next/navigation';
import Collapsible from '@/components/Collapsible';
import FilmCell from '@/components/FilmCell';
import MethodZone, { type MethodWork } from '@/components/MethodZone';
import PhotoCredit from '@/components/PhotoCredit';
import RoleList from '@/components/RoleList';
import SiteFooter from '@/components/SiteFooter';
import SiteHeader from '@/components/SiteHeader';
import SourceList from '@/components/SourceList';
import StatusTabs from '@/components/StatusTabs';
import { AgentNotice } from '@/components/plaques';
import { getDb } from '@/db';
import type { Person } from '@/db/schema';
import { listFilms } from '@/lib/films-repo';
import { formatPartialDateRu, pluralSources, pluralWorks } from '@/lib/format';
import { countPeople, filmsOfPerson, getPersonBySlug } from '@/lib/people-repo';
import { guestViewOn, viewerIsOwner } from '@/lib/session';
import { pageMetadata, SITE_TITLE } from '@/lib/site';
import { filmStatus, statusCounts, todayIso } from '@/lib/status';
import { ambiguousTitles } from '@/lib/titles';
import type { StatusFilter } from '@/lib/url-state';

export const dynamic = 'force-dynamic';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const person = getPersonBySlug(getDb(), slug);
  if (!person) return { title: SITE_TITLE };

  return pageMetadata({
    title: person.nameRu,
    description: person.annotation,
    image: person.photoPath,
    path: `/people/${slug}`,
  });
}

/** Есть ли о человеке хоть что-то, кроме справки. Пусто — страница честно говорит,
 *  почему молчит, ровно как карточка фильма без досье. */
function hasMaterials(person: Person): boolean {
  return (
    (person.method !== null && person.method.length > 0) ||
    (person.workNotes !== null && person.workNotes.length > 0) ||
    person.annotation !== null
  );
}

export default async function PersonPage({ params }: { params: Promise<{ slug: string }> }) {
  const db = getDb();
  const person = getPersonBySlug(db, (await params).slug);
  if (!person) notFound();

  const today = todayIso();
  const all = listFilms(db);
  const films = filmsOfPerson(db, person.id);
  const counts: Record<StatusFilter, number> = statusCounts(all, today);
  const ambiguous = ambiguousTitles(all);

  // Признак владельца спрашивается ради одной ссылки в подвале — «Войти» или «Выйти».
  // Правки на этой странице по-прежнему не существует: персоналию нельзя оценить,
  // и ни оценки, ни звёздочки, ни комментария здесь нет ни при каких условиях.
  // До одиннадцатой версии признак не спрашивался вовсе, потому что подвала здесь
  // не было; запрет с тех пор не ослаб — он просто перестал держаться на том,
  // что вопрос не задан.
  const owner = await viewerIsOwner();
  const guestView = await guestViewOn();

  // Работа связывается с карточкой по оригинальному названию — тому же ключу,
  // по которому фильм ищут скрипты наполнения. Ищется по всей базе, а не среди
  // связанных: разбор работы — не галерея, и фильм может лежать в базе, не будучи
  // связан с этим человеком.
  const byOriginal = new Map(
    all.filter((film) => film.titleOriginal).map((film) => [film.titleOriginal!, film.id]),
  );
  const works: MethodWork[] = (person.workNotes ?? []).map((work) => ({
    ...work,
    filmId: work.titleOriginal === null ? null : byOriginal.get(work.titleOriginal) ?? null,
  }));

  const facts: [string, string][] = [];
  if (person.deathDate) {
    // У умершего две строки схлопываются в одну: годы жизни читаются как единое целое,
    // а «Родился» и «Умер» врозь заставляют складывать их глазами.
    const born = person.birthDate ? formatPartialDateRu(person.birthDate) : '?';
    facts.push(['Годы жизни', `${born} — ${formatPartialDateRu(person.deathDate)}`]);
  } else if (person.birthDate) {
    facts.push(['Родился', formatPartialDateRu(person.birthDate)]);
  }
  if (person.birthPlace) facts.push(['Место рождения', person.birthPlace]);

  const links = [
    ...(person.links ?? []),
    ...(person.imdbId ? [{ label: 'IMDb', url: `https://www.imdb.com/name/${person.imdbId}/` }] : []),
    ...(person.kinopoiskId
      ? [{ label: 'Кинопоиск', url: `https://www.kinopoisk.ru/name/${person.kinopoiskId}/` }]
      : []),
  ];

  const sources = person.sources ?? [];
  const notableWorks = person.notableWorks ?? [];

  return (
    <>
      <SiteHeader
        section="people"
        peopleCount={countPeople(db)}
        nav={<StatusTabs active={null} sort="date" counts={counts} />}
      />

      <main className="mx-auto w-full max-w-[1600px] flex-1 px-5 pb-20 sm:px-8">
        <div className="max-w-5xl">
          <div className="mt-8 grid gap-8 lg:mt-12 lg:grid-cols-[17.5rem_minmax(0,1fr)] lg:gap-12">
            <div className="self-start lg:sticky lg:top-6">
              <div className="relative aspect-3/4 max-w-[200px] bg-hairline lg:max-w-none">
                {person.photoPath ? (
                  <Image
                    src={person.photoPath}
                    alt={`Фотография: ${person.nameRu}`}
                    fill
                    priority
                    sizes="(max-width: 1024px) 100vw, 280px"
                    className="object-cover"
                  />
                ) : (
                  <div className="flex h-full items-center justify-center p-4">
                    <span className="text-center text-lg font-extrabold uppercase leading-tight text-ink-soft">
                      {person.nameRu}
                    </span>
                  </div>
                )}
              </div>
            </div>

            <article className="flex min-w-0 max-w-[40rem] flex-col gap-7">
              <header>
                <h1 className="text-[clamp(1.75rem,3.5vw,3rem)] font-extrabold leading-[1.04] tracking-[-0.02em]">
                  {person.nameRu}
                </h1>
                {person.nameOriginal && (
                  <p className="mt-2 text-lg text-ink-soft">{person.nameOriginal}</p>
                )}
              </header>

              <RoleList roles={person.roles ?? []} />

              {(facts.length > 0 || links.length > 0) && (
                <dl>
                  {facts.map(([label, value]) => (
                    <div
                      key={label}
                      className="flex items-baseline justify-between gap-6 border-b border-hairline py-2.5"
                    >
                      <dt className="shrink-0 text-xs uppercase tracking-wide text-ink-soft">
                        {label}
                      </dt>
                      <dd className="text-right font-extrabold tabular-nums">{value}</dd>
                    </div>
                  ))}

                  {/* Ссылки — такая же строка справки, а не отдельный блок: карточка
                      фильма держит IMDb и Кинопоиск в этой же таблице. */}
                  {links.length > 0 && (
                    <div className="flex items-baseline justify-between gap-6 border-b border-hairline py-2.5">
                      <dt className="shrink-0 text-xs uppercase tracking-wide text-ink-soft">
                        Ссылки
                      </dt>
                      <dd className="flex flex-wrap justify-end gap-x-3 gap-y-1 text-right font-extrabold">
                        {links.map((link) => (
                          <a
                            key={link.url}
                            href={link.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="underline decoration-ink-soft underline-offset-4 transition-colors duration-150 hover:text-vermilion"
                          >
                            {link.label}
                          </a>
                        ))}
                      </dd>
                    </div>
                  )}
                </dl>
              )}

            </article>
          </div>

          <div className="mt-16 border-t-2 border-ink pt-8">
            <div className="flex max-w-[70ch] flex-col gap-12">
              {/* «О человеке» не сворачивается и элемента управления не имеет: это ответ
                  на вопрос «кто это», ради которого страницу и открыли. Правило —
                  в `research/CREATOR-FORMAT.md». */}
              {person.annotation && (
                <section>
                  <h2 className="text-sm font-extrabold uppercase tracking-wide">О человеке</h2>
                  <p className="mt-3 leading-relaxed">{person.annotation}</p>
                </section>
              )}

              {/* Список, а не чтение: нужен тем, кто сверяется, и мешает тем, кто читает
                  подряд. Поэтому свёрнут — но говорит, сколько внутри. */}
              {notableWorks.length > 0 && (
                <Collapsible title="Основные работы" hint={pluralWorks(notableWorks.length)}>
                  <dl>
                    {notableWorks.map((work) => (
                      <div
                        key={`${work.title}-${work.year ?? ''}`}
                        className="flex items-baseline justify-between gap-6 border-b border-hairline py-2.5"
                      >
                        <dt className="shrink-0 text-xs uppercase tracking-wide tabular-nums text-ink-soft">
                          {work.year ?? '—'}
                        </dt>
                        <dd className="text-right font-extrabold">{work.title}</dd>
                      </div>
                    ))}
                  </dl>
                </Collapsible>
              )}

              <MethodZone methods={person.method ?? []} works={works} />

              {sources.length > 0 && (
                <Collapsible title="Источники" hint={pluralSources(sources.length)} minor>
                  <SourceList sources={sources} />
                </Collapsible>
              )}

              {/* Указание автора снимка. Стоит последним и не сворачивается: лицензия
                  требует, чтобы оно было видно, а не лежало под катом рядом с источниками.
                  Требование — в `research/LEGAL.md`. */}
              {person.photoCredit && <PhotoCredit credit={person.photoCredit} />}

              {!hasMaterials(person) && <AgentNotice />}
            </div>
          </div>

          {films.length > 0 && (
            <section className="mt-16 border-t-2 border-ink pt-8">
              <h2 className="text-sm font-extrabold uppercase tracking-wide">В базе</h2>
              {/* Сетка мельче главной на две ячейки: здесь фильмография — приложение
                  к человеку, а не витрина, и ей незачем занимать весь экран. */}
              <ul className="mt-6 grid grid-cols-3 gap-x-4 gap-y-8 sm:grid-cols-4 lg:grid-cols-7 2xl:grid-cols-8">
                {films.map((film, index) => (
                  <FilmCell
                    key={film.id}
                    film={film}
                    status={filmStatus(film, today)}
                    index={index}
                    ambiguous={ambiguous}
                  />
                ))}
              </ul>
            </section>
          )}
        </div>

        <SiteFooter owner={owner} guestView={guestView} />
      </main>
    </>
  );
}
