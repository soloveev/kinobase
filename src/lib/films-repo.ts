import { eq } from 'drizzle-orm';
import type { Db } from '@/db';
import { films, type Film } from '@/db/schema';
import { isReleased } from './status';
import { validatePersonalPatch } from './validate';

export type UpdateResult = { ok: true; film: Film } | { ok: false; error: string };

export function listFilms(db: Db): Film[] {
  return db.select().from(films).all();
}

export function getFilm(db: Db, id: number): Film | undefined {
  return db.select().from(films).where(eq(films.id, id)).get();
}

export function updatePersonal(db: Db, id: number, input: unknown, today: string): UpdateResult {
  const validated = validatePersonalPatch(input);
  if (!validated.ok) return validated;

  const film = getFilm(db, id);
  if (!film) {
    return { ok: false, error: `Фильм с id ${id} не найден` };
  }

  const released = isReleased(film.releaseDate, today);
  const patch = { ...validated.patch };

  // «Хочу посмотреть» — план, «посмотрел» — факт; одновременно они не бывают.
  // Одной операцией противоречие не записывается: интерфейс такого патча
  // не формирует, но правило нужно, чтобы оно не пролезло мимо него.
  if (patch.watched === true && patch.wantToWatch === true) {
    return { ok: false, error: 'Отметки «посмотрел» и «хочу посмотреть» исключают друг друга' };
  }
  if (patch.wantToWatch === true && typeof patch.myRating === 'number') {
    return { ok: false, error: 'Оценка означает просмотр и с «хочу посмотреть» не сочетается' };
  }

  if (patch.watched === true && !released) {
    return { ok: false, error: 'Нельзя отметить просмотренным фильм, который ещё не вышел' };
  }
  if (typeof patch.myRating === 'number') {
    if (!released) {
      return { ok: false, error: 'Нельзя оценить фильм, который ещё не вышел' };
    }
    // Оценить фильм, не посмотрев его, невозможно.
    patch.watched = true;
  }

  // Поставленная отметка сама снимает вторую. Снятая не ставит ничего: «неправда»
  // не означает «правда противоположного», и тайтл без обеих уходит в «Другие».
  if (patch.watched === true) {
    patch.wantToWatch = false;
  }
  if (patch.wantToWatch === true) {
    patch.watched = false;
  }

  // Оценка следует за просмотром: как только фильм перестаёт быть просмотренным,
  // она уходит вместе с отметкой — неважно, сняли её галочкой «посмотрел» или
  // галочкой «хочу посмотреть». Иначе «не смотрел, но оценил на 7» одним путём
  // было бы запрещено, а другим разрешено. Обратной силы у правила нет: снятие
  // самой оценки отметку не трогает, и ветка `myRating: null` сюда не попадает.
  if (patch.watched === false) {
    patch.myRating = null;
  }

  if (Object.keys(patch).length === 0) {
    return { ok: true, film };
  }

  const updated = db.update(films).set(patch).where(eq(films.id, id)).returning().get();
  if (!updated) {
    return { ok: false, error: `Фильм с id ${id} не найден` };
  }
  return { ok: true, film: updated };
}
