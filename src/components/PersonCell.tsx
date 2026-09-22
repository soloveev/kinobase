import Image from 'next/image';
import Link from 'next/link';
import type { Person } from '@/db/schema';
import { pluralFilms } from '@/lib/format';
import { sortRoles } from '@/lib/people';

/** Ячейка указателя. Упрощённый `FilmCell`: у человека нет ни статуса, ни оценки,
 *  и плашкам под именем взяться неоткуда. */
export default function PersonCell({
  person,
  filmCount,
  index,
}: {
  person: Person;
  filmCount: number;
  index: number;
}) {
  const roles = sortRoles(person.roles ?? []);

  return (
    <li>
      <Link href={`/people/${person.slug}`} className="group block">
        <div className="relative aspect-3/4 overflow-hidden bg-hairline transition-shadow duration-300 group-hover:shadow-[0_10px_28px_rgba(23,21,17,0.22)]">
          {person.photoPath ? (
            <Image
              src={person.photoPath}
              alt={`Фотография: ${person.nameRu}`}
              fill
              sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, (max-width: 1536px) 20vw, 17vw"
              className="object-cover motion-safe:transition-transform motion-safe:duration-300 motion-safe:ease-out motion-safe:group-hover:scale-[1.03]"
            />
          ) : (
            // Фотографии может не быть по уважительной причине: у современного
            // аниматора часто нет ни одного снимка со свободной лицензией, и чужое
            // пресс-фото на сайт не кладут.
            <div className="flex h-full items-center justify-center p-4">
              <span className="text-center text-lg font-extrabold uppercase leading-tight text-ink-soft">
                {person.nameRu}
              </span>
            </div>
          )}
        </div>

        <div className="mt-3 flex flex-col gap-1.5 border-t-2 border-ink pt-2">
          <div className="flex items-baseline gap-1.5">
            <span aria-hidden="true" className="text-xs tabular-nums text-ink-soft">
              {String(index + 1).padStart(2, '0')}
            </span>
            <h2 className="font-extrabold leading-tight group-hover:underline group-hover:underline-offset-4">
              {person.nameRu}
            </h2>
          </div>

          {roles.length > 0 && (
            <p className="text-sm text-ink-soft">{roles.map((role) => role.label).join(' · ')}</p>
          )}
          {filmCount > 0 && (
            <p className="text-sm tabular-nums text-ink-soft">{pluralFilms(filmCount)}</p>
          )}
        </div>
      </Link>
    </li>
  );
}
