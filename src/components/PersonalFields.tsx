'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { updatePersonalAction } from '@/app/actions';
import type { Film } from '@/db/schema';
import { isReleased } from '@/lib/status';
import type { PersonalPatch } from '@/lib/validate';
import { formatDateRu } from '@/lib/format';
import CommentEditor from './CommentEditor';
import { ratingPickStyle, StarIcon } from './plaques';

type Notice = { kind: 'saved' | 'error'; text: string; seq: number };

const SCALE = Array.from({ length: 10 }, (_, i) => i + 1);

/** `today` приходит пропом: секция объявлена `'use client'`, и считать «сегодня»
 *  здесь значило бы получить расхождение гидратации около полуночи. То же правило,
 *  что у `DossierSection` и `DossierZone`; страница фильма считает дату один раз
 *  и отдаёт обоим одно значение. */
export default function PersonalFields({ film: initial, today }: { film: Film; today: string }) {
  const router = useRouter();
  const [film, setFilm] = useState(initial);
  const [notice, setNotice] = useState<Notice | null>(null);

  // Отметка о просмотре и оценка запрещены не «ждущему», а невышедшему: с v5
  // невышедший тайтл без галочки «хочу посмотреть» имеет статус «Другое», и
  // привязка к статусу сняла бы запрет там, где сервер его всё равно применит.
  const unreleased = !isReleased(film.releaseDate, today);

  async function save(patch: PersonalPatch): Promise<boolean> {
    const result = await updatePersonalAction(film.id, patch);
    if (result.ok) {
      setFilm(result.film);
      setNotice((prev) => ({ kind: 'saved', text: 'Сохранено', seq: (prev?.seq ?? 0) + 1 }));
      router.refresh();
      return true;
    }
    setNotice((prev) => ({ kind: 'error', text: result.error, seq: (prev?.seq ?? 0) + 1 }));
    return false;
  }

  return (
    <section className="border-t-2 border-ink pt-5">
      <div className="flex items-baseline justify-between gap-4">
        <h2 className="text-sm font-extrabold uppercase tracking-wide">Моё</h2>
        <span role="status" className="text-sm">
          {notice?.kind === 'saved' && (
            <span key={notice.seq} className="stamp inline-block border border-ink px-2 py-0.5 text-xs font-extrabold uppercase tracking-wide">
              {notice.text}
            </span>
          )}
          {notice?.kind === 'error' && (
            <span className="font-extrabold text-vermilion-deep">{notice.text}</span>
          )}
        </span>
      </div>

      <div className="mt-5 flex flex-col gap-6">
        <div className="flex flex-col gap-1.5">
          <div className="flex flex-wrap items-center gap-x-7 gap-y-2.5">
            <label className="flex w-fit items-center gap-2.5 font-extrabold">
              <input
                type="checkbox"
                className="h-4.5 w-4.5"
                checked={film.watched}
                disabled={unreleased}
                onChange={(event) => save({ watched: event.target.checked })}
              />
              Посмотрел
            </label>
            {/* Намерение независимо от просмотра и не запрещено невышедшему:
                заявить его заранее — ровно то, зачем галочка и нужна. */}
            <label className="flex w-fit items-center gap-2.5 font-extrabold">
              <input
                type="checkbox"
                className="h-4.5 w-4.5"
                checked={film.wantToWatch}
                onChange={(event) => save({ wantToWatch: event.target.checked })}
              />
              Хочу посмотреть
            </label>
          </div>
          {unreleased && film.releaseDate && (
            <p className="text-sm text-ink-soft">
              Выйдет {formatDateRu(film.releaseDate)} — отметить и оценить можно после премьеры.
              Звёздочку вкуса можно поставить уже сейчас
            </p>
          )}
        </div>

        <fieldset>
          <legend className="mb-2 text-sm text-ink-soft">Моя оценка</legend>
          <div className="grid max-w-md grid-cols-10 gap-1">
            {SCALE.map((value) => {
              const selected = film.myRating === value;
              return (
                <button
                  key={value}
                  type="button"
                  aria-label={`Оценка ${value}`}
                  aria-pressed={selected}
                  disabled={unreleased}
                  onClick={() => save({ myRating: selected ? null : value })}
                  style={selected ? ratingPickStyle(value) : undefined}
                  className={`h-9 w-full text-sm font-extrabold tabular-nums transition-colors ${
                    selected
                      ? ''
                      : 'shadow-[inset_0_0_0_1px_var(--hairline)] text-ink enabled:hover:shadow-[inset_0_0_0_1px_var(--ink)]'
                  } disabled:cursor-not-allowed disabled:text-ink-soft/50`}
                >
                  {value}
                </button>
              );
            })}
          </div>
        </fieldset>

        <button
          type="button"
          role="switch"
          aria-checked={film.tasteStar}
          onClick={() => save({ tasteStar: !film.tasteStar })}
          className="flex w-fit items-center gap-2.5 font-extrabold"
        >
          <StarIcon filled={film.tasteStar} className="h-5 w-5" />
          Звёздочка вкуса
        </button>

        {/* Комментарий владельца виден читателю, поэтому правится он не полем
            с автосохранением, а блоком с двумя видами: готовым и правкой. Путь
            записи при этом прежний и единственный — тот же `save`. */}
        <CommentEditor
          comment={film.comment}
          onSave={(text) => save({ comment: text })}
        />
      </div>
    </section>
  );
}
