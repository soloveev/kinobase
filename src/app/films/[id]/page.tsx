import type { Metadata } from 'next';
import Image from 'next/image';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import DossierZone from '@/components/DossierZone';
import FilmComment from '@/components/FilmComment';
import FilmFacts from '@/components/FilmFacts';
import PersonalFields from '@/components/PersonalFields';
import SiteFooter from '@/components/SiteFooter';
import SiteHeader from '@/components/SiteHeader';
import StatusTabs from '@/components/StatusTabs';
import TagList from '@/components/TagList';
import PosterViewer from '@/components/PosterViewer';
import { AgentNotice, RatingPlaque, StarIcon, StatusPlaque } from '@/components/plaques';
import { getDb } from '@/db';
import type { Film } from '@/db/schema';
import { hasComment } from '@/lib/comment';
import { hasDossier } from '@/lib/dossier';
import { getFilm, listFilms } from '@/lib/films-repo';
import { linkNames } from '@/lib/people';
import { countPeople, peopleOfFilm } from '@/lib/people-repo';
import { ambiguousTitles, displayTitle } from '@/lib/titles';
import { guestViewOn, viewerIsOwner } from '@/lib/session';
import { fullPosterPath } from '@/lib/posters';
import { pageMetadata, SITE_TITLE } from '@/lib/site';
import { filmStatus, statusCounts, todayIso } from '@/lib/status';
import type { StatusFilter } from '@/lib/url-state';

export const dynamic = 'force-dynamic';

function findFilm(id: string): Film | undefined {
  const numericId = Number(id);
  return Number.isInteger(numericId) ? getFilm(getDb(), numericId) : undefined;
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const film = findFilm(id);
  if (!film) return { title: SITE_TITLE };

  // Заголовок несёт год по тому же правилу, что и заголовок самой страницы:
  // ссылка на «Призрака в доспехах», посланная в чат, должна говорить, на какого.
  const shown = displayTitle(film, ambiguousTitles(listFilms(getDb())));
  return pageMetadata({
    title: shown,
    description: film.annotation,
    image: film.posterPath,
    path: `/films/${film.id}`,
  });
}

export default async function FilmPage({ params }: { params: Promise<{ id: string }> }) {
  const film = findFilm((await params).id);
  if (!film) notFound();

  const today = todayIso();
  const status = filmStatus(film, today);
  // Гостю секция «Моё» не рендерится вовсе, а не прячется стилями: отметки и оценка
  // не должны быть в ответе сервера. Комментарий с v14 — исключение, объявленное
  // спекой: он и написан для читателя.
  const owner = await viewerIsOwner();
  const guestView = await guestViewOn();

  const all = listFilms(getDb());
  const counts: Record<StatusFilter, number> = statusCounts(all, today);
  // Заголовок несёт год, только если в базе есть другой тайтл с тем же названием.
  const title = displayTitle(film, ambiguousTitles(all));

  const creators: [string, string][] = [];
  if (film.director) creators.push(['Режиссёр', film.director]);
  if (film.producer) creators.push(['Продюсер', film.producer]);
  if (film.screenwriter) creators.push(['Сценарист', film.screenwriter]);
  if (film.composer) creators.push(['Композитор', film.composer]);
  if (film.soundDesigner) creators.push(['Звукорежиссёр', film.soundDesigner]);
  if (film.cast && film.cast.length > 0) creators.push(['В ролях', film.cast.join(', ')]);

  // Ссылкой становится только имя, у которого есть персоналия, и узнаём мы это
  // из связи, а не из совпадения по догадке. Остальные имена — обычный текст:
  // у большинства названных здесь людей страницы нет и не будет.
  const personBySlug = new Map(
    peopleOfFilm(getDb(), film.id).map(({ person }) => [person.nameRu, person.slug]),
  );

  return (
    <>
      <SiteHeader
        peopleCount={countPeople(getDb())}
        nav={<StatusTabs active={null} sort="date" counts={counts} />}
      />

      <main className="mx-auto w-full max-w-[1600px] flex-1 px-5 pb-20 sm:px-8">
        <div className="max-w-5xl">
          <div className="mt-8 grid gap-8 lg:mt-12 lg:grid-cols-[17.5rem_minmax(0,1fr)] lg:gap-12">
            <div className="self-start lg:sticky lg:top-6">
              {film.posterPath ? (
                <PosterViewer
                  src={film.posterPath}
                  fullSrc={fullPosterPath(film.posterPath)}
                  alt={`Постер: ${film.titleRu}`}
                >
                  <div className="relative aspect-2/3 max-w-[200px] bg-hairline lg:max-w-none">
                    <Image
                      src={film.posterPath}
                      alt={`Постер: ${film.titleRu}`}
                      fill
                      priority
                      sizes="(max-width: 1024px) 100vw, 280px"
                      className="object-cover"
                    />
                  </div>
                </PosterViewer>
              ) : (
                <div className="relative aspect-2/3 max-w-[200px] bg-hairline lg:max-w-none">
                  <div className="flex h-full items-center justify-center p-4">
                    <span className="text-center text-lg font-extrabold uppercase leading-tight text-ink-soft">
                      {film.titleRu}
                    </span>
                  </div>
                </div>
              )}
            </div>

            <article className="flex min-w-0 max-w-[40rem] flex-col gap-7">
              <header>
                <div className="flex items-center gap-2">
                  <StatusPlaque status={status} />
                  {film.myRating !== null && <RatingPlaque value={film.myRating} />}
                  {film.tasteStar && <StarIcon filled className="h-5 w-5" />}
                </div>
                <h1 className="mt-4 text-[clamp(1.75rem,3.5vw,3rem)] font-extrabold leading-[1.04] tracking-[-0.02em]">
                  {title}
                </h1>
                {film.titleOriginal && (
                  <p className="mt-2 text-lg text-ink-soft">{film.titleOriginal}</p>
                )}
              </header>

              <TagList tags={film.tags ?? []} />

              <FilmFacts film={film} />

              {/* Блок комментария стоит последним в личной зоне и у того, и у другого.
                  У владельца эта зона — вся секция «Моё», и блок замыкает её; у гостя
                  секции нет вовсе, статус, оценка и звёздочка показаны плашками в шапке,
                  и комментарий продолжает их сразу за выходными данными. */}
              {owner ? (
                <PersonalFields film={film} today={today} />
              ) : (
                hasComment(film.comment) && <FilmComment comment={film.comment} />
              )}
            </article>
          </div>

          {/* Зона рендерится всегда: у тайтла без единого материала она несёт плашку,
              которая объясняет молчание. Пустая страница выглядела бы поломкой. */}
          <div className="mt-16 border-t-2 border-ink pt-8">
            <div className="flex max-w-[70ch] flex-col gap-12">
              {film.annotation && (
                <section>
                  <h2 className="text-sm font-extrabold uppercase tracking-wide">О фильме</h2>
                  <p className="mt-3 leading-relaxed">{film.annotation}</p>
                </section>
              )}

              {creators.length > 0 && (
                <section>
                  <h2 className="text-sm font-extrabold uppercase tracking-wide">Создатели</h2>
                  <dl className="mt-3">
                    {creators.map(([role, name]) => (
                      <div
                        key={role}
                        className="flex items-baseline justify-between gap-6 border-b border-hairline py-2.5"
                      >
                        <dt className="shrink-0 text-xs uppercase tracking-wide text-ink-soft">
                          {role}
                        </dt>
                        <dd className="text-right font-extrabold">
                          {linkNames(name, personBySlug).map((part, index) =>
                            part.slug === null ? (
                              <span key={index}>{part.text}</span>
                            ) : (
                              <Link
                                key={index}
                                href={`/people/${part.slug}`}
                                className="underline decoration-ink-soft underline-offset-4 transition-colors duration-150 hover:text-vermilion"
                              >
                                {part.text}
                              </Link>
                            ),
                          )}
                        </dd>
                      </div>
                    ))}
                  </dl>
                </section>
              )}

              <DossierZone film={film} today={today} />
              {!hasDossier(film) && <AgentNotice />}
            </div>
          </div>
        </div>

        <SiteFooter owner={owner} guestView={guestView} />
      </main>
    </>
  );
}
