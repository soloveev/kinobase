// Критерии приёмки 11, 12, 14, 15, 16 на уровне хранилища (SQLite in-memory):
// 11 — оценка сохраняется в базе и остаётся при повторном чтении, повторный клик снимает её (null);
// 12 — отметки «посмотрел» и звёздочки вкуса не теряются;
// 14 — комментарий сохраняется;
// 15 — попытка записать «посмотрел: да» невышедшему фильму отклоняется сервером;
// 16 — оценка вне 1–10 и нецелая отклоняется, данные в базе при этом не меняются;
// 18–21 — «оценка означает просмотр»: см. отдельный describe в конце файла.
//
// Дополнение v5, критерии приёмки 9, 10, 11 и 20 на уровне хранилища:
// 9 — «хочу посмотреть» сохраняется и читается обратно;
// 10, 11 — галочка ставится и снимается в любом статусе, у вышедшего и невышедшего тайтла;
// 20 — личные данные не страдают: частичный патч не затирает соседние поля.
//
// Правка v5 от 23.08.2026, критерии приёмки 21–24: «Посмотрел» и «Хочу посмотреть»
// взаимоисключающи, и приведение полей делает сервер — см. отдельный describe в конце файла.
// Прежняя редакция обещала обратное («галочки независимы»), поэтому три теста выше
// приведены в соответствие с правкой спеки, а не сохранены как есть.

import { describe, it, expect, beforeEach } from 'vitest';
import { createDb } from '@/db';
import type { Db } from '@/db';
import { films } from '@/db/schema';
import type { Film } from '@/db/schema';
import { listFilms, getFilm, updatePersonal } from '@/lib/films-repo';
import { filmStatus } from '@/lib/status';
import { filmValues } from './helpers';
import type { DossierFragment, DossierSource, FilmWithDossier } from './helpers';

const TODAY = '2026-08-22';
const RELEASED = '2001-04-11';
const NOT_RELEASED = '2030-01-01';

let db: Db;

function insertFilm(values: Parameters<typeof filmValues>[0]): Film {
  const rows = db.insert(films).values(filmValues(values)).returning().all();
  return rows[0];
}

/** Разворачивает успешный результат обновления, иначе валит тест с текстом ошибки. */
function ok(result: ReturnType<typeof updatePersonal>): Film {
  if (!result.ok) throw new Error(`ожидалось успешное сохранение, получена ошибка: ${result.error}`);
  return result.film;
}

beforeEach(() => {
  db = createDb(':memory:');
});

describe('чтение базы', () => {
  it('пустая база — пустой список', () => {
    expect(listFilms(db)).toEqual([]);
  });

  it('listFilms возвращает все занесённые фильмы со справочными полями', () => {
    insertFilm({
      titleRu: 'Одиссея',
      titleOriginal: 'The Odyssey',
      releaseDate: '2026-07-17',
      imdbRating: 8.4,
      kinopoiskRating: 7.9,
      director: 'Кристофер Нолан',
      cast: ['Мэтт Дэймон', 'Том Холланд'],
    });
    insertFilm({ titleRu: 'Второй фильм' });

    const all = listFilms(db);
    expect(all).toHaveLength(2);

    const odyssey = all.find((f) => f.titleRu === 'Одиссея');
    expect(odyssey).toBeDefined();
    expect(odyssey!.titleOriginal).toBe('The Odyssey');
    expect(odyssey!.releaseDate).toBe('2026-07-17');
    expect(odyssey!.imdbRating).toBe(8.4);
    expect(odyssey!.cast).toEqual(['Мэтт Дэймон', 'Том Холланд']);
  });

  it('фильм, у которого заполнено только русское название, читается с пустыми справочными полями', () => {
    const inserted = insertFilm({ titleRu: 'Только название' });
    const film = getFilm(db, inserted.id);
    expect(film).toBeDefined();
    expect(film!.titleRu).toBe('Только название');
    expect(film!.titleOriginal).toBeNull();
    expect(film!.posterPath).toBeNull();
    expect(film!.releaseDate).toBeNull();
  });

  it('личные поля нового фильма по умолчанию пустые', () => {
    const inserted = insertFilm({ titleRu: 'Новичок' });
    const film = getFilm(db, inserted.id)!;
    expect(film.watched).toBe(false);
    expect(film.wantToWatch).toBe(false);
    expect(film.myRating).toBeNull();
    expect(film.tasteStar).toBe(false);
    expect(film.comment).toBeNull();
  });

  it('getFilm для несуществующего id возвращает undefined', () => {
    expect(getFilm(db, 4242)).toBeUndefined();
  });
});

describe('updatePersonal: сохранение личных полей', () => {
  it('сохраняет оценку, и она остаётся в базе при повторном чтении', () => {
    const { id } = insertFilm({ titleRu: 'Фильм', releaseDate: RELEASED });

    expect(ok(updatePersonal(db, id, { myRating: 8 }, TODAY)).myRating).toBe(8);
    expect(getFilm(db, id)!.myRating).toBe(8);
  });

  it('повторное обновление оценки перезаписывает прежнюю', () => {
    const { id } = insertFilm({ titleRu: 'Фильм', releaseDate: RELEASED, myRating: 3 });

    updatePersonal(db, id, { myRating: 6 }, TODAY);
    updatePersonal(db, id, { myRating: 10 }, TODAY);
    expect(getFilm(db, id)!.myRating).toBe(10);
  });

  it('оценка снимается записью null', () => {
    const { id } = insertFilm({ titleRu: 'Фильм', releaseDate: RELEASED, myRating: 7 });

    expect(ok(updatePersonal(db, id, { myRating: null }, TODAY)).myRating).toBeNull();
    expect(getFilm(db, id)!.myRating).toBeNull();
  });

  it('сохраняет отметку «посмотрел» для вышедшего фильма и снимает её обратно', () => {
    const { id } = insertFilm({ titleRu: 'Фильм', releaseDate: RELEASED });

    expect(ok(updatePersonal(db, id, { watched: true }, TODAY)).watched).toBe(true);
    expect(getFilm(db, id)!.watched).toBe(true);

    expect(ok(updatePersonal(db, id, { watched: false }, TODAY)).watched).toBe(false);
    expect(getFilm(db, id)!.watched).toBe(false);
  });

  it('сохраняет отметку «посмотрел» для фильма без даты выхода — он считается вышедшим', () => {
    const { id } = insertFilm({ titleRu: 'Без даты', releaseDate: null });

    expect(ok(updatePersonal(db, id, { watched: true }, TODAY)).watched).toBe(true);
    expect(getFilm(db, id)!.watched).toBe(true);
  });

  it('сохраняет отметку «посмотрел» для фильма, вышедшего сегодня', () => {
    const { id } = insertFilm({ titleRu: 'Премьера сегодня', releaseDate: TODAY });

    expect(ok(updatePersonal(db, id, { watched: true }, TODAY)).watched).toBe(true);
  });

  it('сохраняет отметку «хочу посмотреть» и снимает её обратно (критерий 9)', () => {
    const { id } = insertFilm({ titleRu: 'Фильм', releaseDate: RELEASED });

    expect(ok(updatePersonal(db, id, { wantToWatch: true }, TODAY)).wantToWatch).toBe(true);
    expect(getFilm(db, id)!.wantToWatch).toBe(true);

    expect(ok(updatePersonal(db, id, { wantToWatch: false }, TODAY)).wantToWatch).toBe(false);
    expect(getFilm(db, id)!.wantToWatch).toBe(false);
  });

  it('«хочу посмотреть» ставится и невышедшему тайтлу — правил у галочки нет (критерий 10)', () => {
    const { id } = insertFilm({ titleRu: 'Ждём', releaseDate: NOT_RELEASED });

    expect(ok(updatePersonal(db, id, { wantToWatch: true }, TODAY)).wantToWatch).toBe(true);

    const film = getFilm(db, id)!;
    expect(film.wantToWatch).toBe(true);
    expect(film.watched).toBe(false);
    expect(filmStatus(film, TODAY)).toBe('waiting');
  });

  it('снятая галочка уводит непросмотренный тайтл в «Другие» (критерии 10 и 11)', () => {
    const released = insertFilm({
      titleRu: 'Вышедший',
      releaseDate: RELEASED,
      wantToWatch: true,
    });
    const upcoming = insertFilm({
      titleRu: 'Невышедший',
      releaseDate: NOT_RELEASED,
      wantToWatch: true,
    });

    ok(updatePersonal(db, released.id, { wantToWatch: false }, TODAY));
    ok(updatePersonal(db, upcoming.id, { wantToWatch: false }, TODAY));

    expect(filmStatus(getFilm(db, released.id)!, TODAY)).toBe('other');
    expect(filmStatus(getFilm(db, upcoming.id)!, TODAY)).toBe('other');
  });

  // Правка от 23.08.2026, критерий 21: прежняя редакция теста требовала обратного —
  // что «хочу посмотреть» оставляет отметку о просмотре на месте. Галочки стали
  // взаимоисключающими, и тест приведён в соответствие со спекой.
  it('«хочу посмотреть» снимает отметку о просмотре (критерий 21)', () => {
    const { id } = insertFilm({
      titleRu: 'Сериал',
      releaseDate: RELEASED,
      watched: true,
      wantToWatch: false,
    });

    ok(updatePersonal(db, id, { wantToWatch: true }, TODAY));

    const film = getFilm(db, id)!;
    expect(film.wantToWatch).toBe(true);
    expect(film.watched).toBe(false);
    expect(filmStatus(film, TODAY)).toBe('will-watch');
  });

  it('«хочу посмотреть» отметки о просмотре сама не ставит', () => {
    const { id } = insertFilm({ titleRu: 'Фильм', releaseDate: RELEASED, watched: false });

    ok(updatePersonal(db, id, { wantToWatch: true }, TODAY));

    const film = getFilm(db, id)!;
    expect(film.watched).toBe(false);
    expect(filmStatus(film, TODAY)).toBe('will-watch');
  });

  it('сохраняет звёздочку вкуса', () => {
    const { id } = insertFilm({ titleRu: 'Фильм', releaseDate: RELEASED });

    expect(ok(updatePersonal(db, id, { tasteStar: true }, TODAY)).tasteStar).toBe(true);
    expect(getFilm(db, id)!.tasteStar).toBe(true);
  });

  // Правка 31.08.2026 по критерию приёмки 6 версии v14. Прежняя редакция теста:
  // ~~«сохраняет комментарий, в том числе пустой» — после `updatePersonal(db, id,
  // { comment: '' })` в базе ожидалась пустая строка.~~ Пока комментарий видел один
  // владелец, разницы между `null` и `''` не было: оба означали «пусто», и различать
  // их было незачем. С четырнадцатой версии комментарий стал частью карточки, и от этой
  // разницы зависит, видит читатель блок или нет; два неотличимых состояния «пусто»
  // дали бы две ветки показа там, где нужна одна. Тест отменён спекой, а не сломан кодом.
  //
  // Приведение делает валидатор на границе (`validatePersonalPatch`, tests/validate.test.ts),
  // но проверяется оно и здесь — на настоящей базе: требование сформулировано как
  // «в базе лежит `null`», а не как «валидатор вернул `null`».
  it('сохраняет непустой комментарий как есть (критерий 6 версии v14)', () => {
    const { id } = insertFilm({ titleRu: 'Фильм', releaseDate: RELEASED });

    expect(ok(updatePersonal(db, id, { comment: 'Пересмотреть' }, TODAY)).comment).toBe(
      'Пересмотреть',
    );
    expect(getFilm(db, id)!.comment).toBe('Пересмотреть');
  });

  it('пустой комментарий доезжает до базы как null (критерий 6 версии v14)', () => {
    const { id } = insertFilm({ titleRu: 'Фильм', releaseDate: RELEASED });

    ok(updatePersonal(db, id, { comment: 'Пересмотреть' }, TODAY));
    ok(updatePersonal(db, id, { comment: '' }, TODAY));

    expect(getFilm(db, id)!.comment).toBeNull();
  });

  it('комментарий из одних пробелов — тоже null (критерий 6 версии v14)', () => {
    const { id } = insertFilm({ titleRu: 'Фильм', releaseDate: RELEASED });

    ok(updatePersonal(db, id, { comment: 'Пересмотреть' }, TODAY));
    ok(updatePersonal(db, id, { comment: '   \n ' }, TODAY));

    expect(getFilm(db, id)!.comment).toBeNull();
  });

  // Обрезка краёв заодно чинит хвост из переносов, который остаётся, когда абзац
  // стирают не до конца: без неё «пусто на вид» лежало бы в базе непустой строкой.
  it('края у непустого комментария обрезаются (критерий 6 версии v14)', () => {
    const { id } = insertFilm({ titleRu: 'Фильм', releaseDate: RELEASED });

    ok(updatePersonal(db, id, { comment: '  Пересмотреть\n\n' }, TODAY));

    expect(getFilm(db, id)!.comment).toBe('Пересмотреть');
  });

  it('снятый комментарий возвращается ответом действия, а не только базой', () => {
    const { id } = insertFilm({ titleRu: 'Фильм', releaseDate: RELEASED, comment: 'было' });

    expect(ok(updatePersonal(db, id, { comment: '' }, TODAY)).comment).toBeNull();
  });

  // Фильм в фикстуре просмотрен и потому без галочки «хочу посмотреть»: с правкой
  // от 23.08.2026 обе отметки разом — состояние, которого не бывает.
  it('частичный патч не затирает остальные личные поля (критерий 20)', () => {
    const { id } = insertFilm({
      titleRu: 'Фильм',
      releaseDate: RELEASED,
      watched: true,
      wantToWatch: false,
      myRating: 9,
      tasteStar: true,
      comment: 'заметка',
    });

    ok(updatePersonal(db, id, { myRating: 4 }, TODAY));

    const film = getFilm(db, id)!;
    expect(film.myRating).toBe(4);
    expect(film.watched).toBe(true);
    expect(film.wantToWatch).toBe(false);
    expect(film.tasteStar).toBe(true);
    expect(film.comment).toBe('заметка');
  });

  // Оценку «хочу посмотреть» с правкой от 23.08.2026 как раз трогает — это критерий 21,
  // и он проверяется отдельно. Здесь предмет прежний: соседние поля патч не задевает.
  it('патч с «хочу посмотреть» не трогает звёздочку и комментарий (критерий 20)', () => {
    const { id } = insertFilm({
      titleRu: 'Фильм',
      releaseDate: RELEASED,
      watched: false,
      tasteStar: true,
      comment: 'заметка',
    });

    ok(updatePersonal(db, id, { wantToWatch: true }, TODAY));

    const film = getFilm(db, id)!;
    expect(film.wantToWatch).toBe(true);
    expect(film.tasteStar).toBe(true);
    expect(film.comment).toBe('заметка');
  });

  it('не трогает дату заведения тайтла', () => {
    const { id } = insertFilm({
      titleRu: 'Фильм',
      releaseDate: RELEASED,
      createdAt: '2025-03-14',
    });

    ok(updatePersonal(db, id, { myRating: 8, tasteStar: true, comment: 'заметка' }, TODAY));

    // Дата заведения — лог базы: сохранение личных полей её не переписывает.
    expect(getFilm(db, id)!.createdAt).toBe('2025-03-14');
  });

  it('обновление одного фильма не задевает другие', () => {
    const first = insertFilm({ titleRu: 'Первый', releaseDate: RELEASED });
    const second = insertFilm({ titleRu: 'Второй', releaseDate: RELEASED, myRating: 5 });

    ok(updatePersonal(db, first.id, { myRating: 1 }, TODAY));

    expect(getFilm(db, second.id)!.myRating).toBe(5);
  });
});

describe('updatePersonal: отказы, база при этом не меняется', () => {
  it('«посмотрел: да» для невышедшего фильма отклоняется', () => {
    const { id } = insertFilm({ titleRu: 'Ждём', releaseDate: NOT_RELEASED });
    const before = getFilm(db, id)!;

    const result = updatePersonal(db, id, { watched: true }, TODAY);

    expect(result.ok).toBe(false);
    expect(getFilm(db, id)).toEqual(before);
    expect(getFilm(db, id)!.watched).toBe(false);
  });

  it('«посмотрел: нет» для невышедшего фильма проходит — это не запись отметки', () => {
    const { id } = insertFilm({ titleRu: 'Ждём', releaseDate: NOT_RELEASED });

    expect(ok(updatePersonal(db, id, { watched: false }, TODAY)).watched).toBe(false);
  });

  // Исправлено по спеке (раздел «Валидация на границе», критерий 21): прежняя редакция теста
  // требовала обратного — что оценку невышедшему фильму ставить можно. Правило «оценка означает
  // просмотр» это запретило, поэтому тест приведён в соответствие со спекой.
  it('оценка невышедшему фильму отклоняется, прежняя оценка остаётся в базе', () => {
    const { id } = insertFilm({ titleRu: 'Ждём', releaseDate: NOT_RELEASED, myRating: 6 });
    const before = getFilm(db, id)!;

    expect(updatePersonal(db, id, { myRating: 9 }, TODAY).ok).toBe(false);
    expect(getFilm(db, id)).toEqual(before);
  });

  it('оценка вне диапазона 1–10 отклоняется, прежняя остаётся в базе', () => {
    const { id } = insertFilm({ titleRu: 'Фильм', releaseDate: RELEASED, myRating: 5 });
    const before = getFilm(db, id)!;

    expect(updatePersonal(db, id, { myRating: 0 }, TODAY).ok).toBe(false);
    expect(updatePersonal(db, id, { myRating: 11 }, TODAY).ok).toBe(false);
    expect(getFilm(db, id)).toEqual(before);
    expect(getFilm(db, id)!.myRating).toBe(5);
  });

  it('нецелая и нечисловая оценка отклоняются, база не меняется', () => {
    const { id } = insertFilm({ titleRu: 'Фильм', releaseDate: RELEASED, myRating: 5 });
    const before = getFilm(db, id)!;

    expect(updatePersonal(db, id, { myRating: 7.5 }, TODAY).ok).toBe(false);
    expect(updatePersonal(db, id, { myRating: '8' }, TODAY).ok).toBe(false);
    expect(getFilm(db, id)).toEqual(before);
  });

  it('нелогическое значение переключателей отклоняется, база не меняется', () => {
    const { id } = insertFilm({ titleRu: 'Фильм', releaseDate: RELEASED });
    const before = getFilm(db, id)!;

    expect(updatePersonal(db, id, { watched: 'да' }, TODAY).ok).toBe(false);
    expect(updatePersonal(db, id, { tasteStar: 1 }, TODAY).ok).toBe(false);
    expect(updatePersonal(db, id, { wantToWatch: 'да' }, TODAY).ok).toBe(false);
    expect(getFilm(db, id)).toEqual(before);
  });

  it('патч, который вообще не объект, отклоняется', () => {
    const { id } = insertFilm({ titleRu: 'Фильм', releaseDate: RELEASED });
    const before = getFilm(db, id)!;

    expect(updatePersonal(db, id, 'watched', TODAY).ok).toBe(false);
    expect(updatePersonal(db, id, null, TODAY).ok).toBe(false);
    expect(getFilm(db, id)).toEqual(before);
  });

  it('обновление несуществующего фильма отклоняется с сообщением об ошибке', () => {
    const result = updatePersonal(db, 4242, { myRating: 5 }, TODAY);

    expect(result.ok).toBe(false);
    if (result.ok) throw new Error('ожидался отказ');
    expect(result.error.length).toBeGreaterThan(0);
    expect(listFilms(db)).toEqual([]);
  });

  it('при отказе одно верное поле не сохраняется вместе с неверным', () => {
    const { id } = insertFilm({ titleRu: 'Фильм', releaseDate: RELEASED });
    const before = getFilm(db, id)!;

    expect(updatePersonal(db, id, { tasteStar: true, myRating: 99 }, TODAY).ok).toBe(false);
    expect(getFilm(db, id)).toEqual(before);
  });
});

// Критерии приёмки 18–21 — «Оценка означает просмотр» на уровне хранилища:
// 18 — оценка вышедшему непросмотренному фильму сама ставит отметку «посмотрел»;
// 19 — снятие оценки отметку «посмотрел» не трогает, фильм остаётся просмотренным;
// 20 — звёздочка вкуса статуса не меняет и разрешена любому фильму, включая невышедший;
// 21 — оценка фильму со статусом «ждём» отклоняется, база при этом не меняется.
describe('updatePersonal: оценка означает просмотр', () => {
  it('оценка вышедшему непросмотренному фильму заодно ставит отметку «посмотрел»', () => {
    const { id } = insertFilm({ titleRu: 'Фильм', releaseDate: RELEASED, watched: false });

    const result = updatePersonal(db, id, { myRating: 7 }, TODAY);
    expect(result.ok).toBe(true);

    const film = getFilm(db, id)!;
    expect(film.myRating).toBe(7);
    expect(film.watched).toBe(true);
    expect(filmStatus(film, TODAY)).toBe('watched');
  });

  it('оценка уже просмотренному фильму оставляет отметку «посмотрел» на месте', () => {
    const { id } = insertFilm({ titleRu: 'Фильм', releaseDate: RELEASED, watched: true });

    ok(updatePersonal(db, id, { myRating: 5 }, TODAY));

    const film = getFilm(db, id)!;
    expect(film.myRating).toBe(5);
    expect(film.watched).toBe(true);
  });

  it('оценка фильму без даты выхода тоже ставит отметку «посмотрел» — такой фильм считается вышедшим', () => {
    const { id } = insertFilm({ titleRu: 'Без даты', releaseDate: null, watched: false });

    ok(updatePersonal(db, id, { myRating: 4 }, TODAY));

    expect(getFilm(db, id)!.watched).toBe(true);
  });

  it('снятие оценки не снимает отметку «посмотрел»', () => {
    const { id } = insertFilm({
      titleRu: 'Фильм',
      releaseDate: RELEASED,
      watched: true,
      myRating: 8,
    });

    ok(updatePersonal(db, id, { myRating: null }, TODAY));

    const film = getFilm(db, id)!;
    expect(film.myRating).toBeNull();
    expect(film.watched).toBe(true);
    expect(filmStatus(film, TODAY)).toBe('watched');
  });

  it('оценка фильму со статусом «ждём» отклоняется, в базе ничего не меняется', () => {
    // Галочка «хочу посмотреть» здесь не предмет теста, но без неё тайтл с v5
    // попадает в «Другие», а проверяется именно статус «ждём».
    const { id } = insertFilm({
      titleRu: 'Ждём',
      releaseDate: NOT_RELEASED,
      watched: false,
      wantToWatch: true,
    });
    const before = getFilm(db, id)!;

    const result = updatePersonal(db, id, { myRating: 9 }, TODAY);
    expect(result.ok).toBe(false);

    const film = getFilm(db, id)!;
    expect(film).toEqual(before);
    expect(film.myRating).toBeNull();
    expect(film.watched).toBe(false);
    expect(filmStatus(film, TODAY)).toBe('waiting');
  });

  it('снятие оценки у невышедшего фильма допустимо', () => {
    const { id } = insertFilm({ titleRu: 'Ждём', releaseDate: NOT_RELEASED, myRating: 6 });

    const result = updatePersonal(db, id, { myRating: null }, TODAY);
    expect(result.ok).toBe(true);
    expect(getFilm(db, id)!.myRating).toBeNull();
  });

  it('звёздочка вкуса невышедшему фильму принимается и оставляет его в «ждём»', () => {
    const { id } = insertFilm({
      titleRu: 'Ждём',
      releaseDate: NOT_RELEASED,
      watched: false,
      wantToWatch: true,
    });

    const result = updatePersonal(db, id, { tasteStar: true }, TODAY);
    expect(result.ok).toBe(true);

    const film = getFilm(db, id)!;
    expect(film.tasteStar).toBe(true);
    expect(film.watched).toBe(false);
    expect(filmStatus(film, TODAY)).toBe('waiting');
  });

  it('звёздочка вкуса вышедшему непросмотренному фильму не ставит отметку «посмотрел»', () => {
    const { id } = insertFilm({
      titleRu: 'Фильм',
      releaseDate: RELEASED,
      watched: false,
      wantToWatch: true,
    });

    ok(updatePersonal(db, id, { tasteStar: true }, TODAY));

    const film = getFilm(db, id)!;
    expect(film.tasteStar).toBe(true);
    expect(film.watched).toBe(false);
    expect(filmStatus(film, TODAY)).toBe('will-watch');
  });

  it('«хочу посмотреть» в патче невышедшего фильма не пропускает вместе с собой оценку', () => {
    const { id } = insertFilm({ titleRu: 'Ждём', releaseDate: NOT_RELEASED, watched: false });
    const before = getFilm(db, id)!;

    expect(updatePersonal(db, id, { wantToWatch: true, myRating: 9 }, TODAY).ok).toBe(false);
    expect(getFilm(db, id)).toEqual(before);
    expect(getFilm(db, id)!.wantToWatch).toBe(false);
  });

  it('«хочу посмотреть» в патче невышедшего фильма не пропускает и отметку о просмотре', () => {
    const { id } = insertFilm({ titleRu: 'Ждём', releaseDate: NOT_RELEASED });
    const before = getFilm(db, id)!;

    expect(updatePersonal(db, id, { wantToWatch: true, watched: true }, TODAY).ok).toBe(false);
    expect(getFilm(db, id)).toEqual(before);
  });

  it('патч с оценкой и звёздочкой сразу сохраняет оба поля и ставит отметку «посмотрел»', () => {
    const { id } = insertFilm({ titleRu: 'Фильм', releaseDate: RELEASED, watched: false });

    ok(updatePersonal(db, id, { myRating: 8, tasteStar: true }, TODAY));

    const film = getFilm(db, id)!;
    expect(film.myRating).toBe(8);
    expect(film.tasteStar).toBe(true);
    expect(film.watched).toBe(true);
  });
});

// Правка v5 от 23.08.2026 — «Посмотрел» и «Хочу посмотреть» взаимоисключающи.
// Критерии приёмки:
// 21 — «хочу посмотреть» просмотренному фильму снимает отметку о просмотре и обнуляет
//      оценку; фильм переходит в «Буду смотреть» (вышел) или «Ждём» (не вышел);
// 22 — отметка о просмотре снимает «хочу посмотреть»; оценка делает то же самое,
//      потому что сама ставит отметку о просмотре;
// 23 — снятие любой из галочек вторую не ставит: фильм без обеих уходит в «Другие»;
// 24 — сервер отклоняет патч с «watched: да» и «wantToWatch: да» разом, а также патч
//      с «wantToWatch: да» и числовой оценкой; база при этом не меняется;
// 25 — снятая вручную отметка о просмотре обнуляет оценку тем же правилом, что и
//      снятие через «хочу посмотреть»; обратное неверно — снятие оценки отметку не трогает.
// Отказ проверяется на updatePersonal, а не на валидаторе: спека требует, чтобы
// противоречие не доехало до базы, а слой, где стоит проверка, — дело имплементации.
describe('updatePersonal: взаимоисключающие отметки', () => {
  it('«хочу посмотреть» просмотренному фильму с оценкой снимает и просмотр, и оценку (критерий 21)', () => {
    const { id } = insertFilm({
      titleRu: 'Фильм',
      releaseDate: RELEASED,
      watched: true,
      wantToWatch: false,
      myRating: 7,
    });

    ok(updatePersonal(db, id, { wantToWatch: true }, TODAY));

    const film = getFilm(db, id)!;
    expect(film.wantToWatch).toBe(true);
    expect(film.watched).toBe(false);
    expect(film.myRating).toBeNull();
  });

  it('вышедший фильм уходит из «Посмотрел» в «Буду смотреть» (критерий 21)', () => {
    const { id } = insertFilm({
      titleRu: 'Вышедший',
      releaseDate: RELEASED,
      watched: true,
      myRating: 9,
    });

    ok(updatePersonal(db, id, { wantToWatch: true }, TODAY));

    expect(filmStatus(getFilm(db, id)!, TODAY)).toBe('will-watch');
  });

  // Просмотренный тайтл с будущей датой выхода в базе возможен: дату могли уточнить
  // после просмотра. Отметку о просмотре патч не ставит, поэтому запрет v1 не при чём.
  it('невышедший фильм уходит из «Посмотрел» в «Ждём» (критерий 21)', () => {
    const { id } = insertFilm({
      titleRu: 'Невышедший',
      releaseDate: NOT_RELEASED,
      watched: true,
      myRating: 9,
    });

    ok(updatePersonal(db, id, { wantToWatch: true }, TODAY));

    const film = getFilm(db, id)!;
    expect(film.watched).toBe(false);
    expect(film.myRating).toBeNull();
    expect(filmStatus(film, TODAY)).toBe('waiting');
  });

  it('отметка о просмотре снимает «хочу посмотреть» (критерий 22)', () => {
    const { id } = insertFilm({
      titleRu: 'Фильм',
      releaseDate: RELEASED,
      watched: false,
      wantToWatch: true,
    });

    ok(updatePersonal(db, id, { watched: true }, TODAY));

    const film = getFilm(db, id)!;
    expect(film.watched).toBe(true);
    expect(film.wantToWatch).toBe(false);
    expect(filmStatus(film, TODAY)).toBe('watched');
  });

  it('оценка снимает «хочу посмотреть» вместе с постановкой отметки о просмотре (критерий 22)', () => {
    const { id } = insertFilm({
      titleRu: 'Фильм',
      releaseDate: RELEASED,
      watched: false,
      wantToWatch: true,
    });

    ok(updatePersonal(db, id, { myRating: 6 }, TODAY));

    const film = getFilm(db, id)!;
    expect(film.myRating).toBe(6);
    expect(film.watched).toBe(true);
    expect(film.wantToWatch).toBe(false);
    expect(filmStatus(film, TODAY)).toBe('watched');
  });

  it('снятая отметка о просмотре не ставит «хочу посмотреть»: фильм уходит в «Другие» (критерий 23)', () => {
    const { id } = insertFilm({
      titleRu: 'Фильм',
      releaseDate: RELEASED,
      watched: true,
      wantToWatch: false,
    });

    ok(updatePersonal(db, id, { watched: false }, TODAY));

    const film = getFilm(db, id)!;
    expect(film.watched).toBe(false);
    expect(film.wantToWatch).toBe(false);
    expect(filmStatus(film, TODAY)).toBe('other');
  });

  // Критерий 25: правило одно на оба пути — как только фильм перестаёт быть
  // просмотренным, оценка уходит. Иначе состояние «не смотрел, но оценил на 9»
  // было бы запрещено через «хочу посмотреть» и разрешено прямым снятием отметки.
  it('снятая вручную отметка о просмотре обнуляет оценку (критерий 25)', () => {
    const { id } = insertFilm({
      titleRu: 'Фильм',
      releaseDate: RELEASED,
      watched: true,
      wantToWatch: false,
      myRating: 9,
    });

    ok(updatePersonal(db, id, { watched: false }, TODAY));

    const film = getFilm(db, id)!;
    expect(film.watched).toBe(false);
    expect(film.myRating).toBeNull();
  });

  it('снятая вручную отметка о просмотре оценку убирает, но «хочу посмотреть» не ставит (критерии 23 и 25)', () => {
    const { id } = insertFilm({
      titleRu: 'Фильм',
      releaseDate: RELEASED,
      watched: true,
      wantToWatch: false,
      myRating: 4,
    });

    ok(updatePersonal(db, id, { watched: false }, TODAY));

    const film = getFilm(db, id)!;
    expect(film.wantToWatch).toBe(false);
    expect(film.myRating).toBeNull();
    expect(filmStatus(film, TODAY)).toBe('other');
  });

  it('снятая отметка о просмотре у фильма без оценки не задевает остальные поля (критерий 25)', () => {
    const { id } = insertFilm({
      titleRu: 'Фильм',
      releaseDate: RELEASED,
      watched: true,
      wantToWatch: false,
      myRating: null,
      tasteStar: true,
      comment: 'заметка',
    });

    ok(updatePersonal(db, id, { watched: false }, TODAY));

    const film = getFilm(db, id)!;
    expect(film.watched).toBe(false);
    expect(film.myRating).toBeNull();
    expect(film.tasteStar).toBe(true);
    expect(film.comment).toBe('заметка');
  });

  // Обратной силы у правила нет: снятие оценки отметку о просмотре не трогает —
  // это вторая половина критерия 25, и она уже проверена тестом «снятие оценки
  // отметку о просмотре не трогает (критерий 19 версии v1)» ниже в этом describe.

  it('снятая галочка «хочу посмотреть» не ставит отметку о просмотре (критерий 23)', () => {
    const { id } = insertFilm({
      titleRu: 'Фильм',
      releaseDate: RELEASED,
      watched: false,
      wantToWatch: true,
    });

    ok(updatePersonal(db, id, { wantToWatch: false }, TODAY));

    const film = getFilm(db, id)!;
    expect(film.watched).toBe(false);
    expect(film.wantToWatch).toBe(false);
    expect(filmStatus(film, TODAY)).toBe('other');
  });

  // Вторая половина критерия 25: обратной силы у правила нет — оценка следует
  // за просмотром, а не просмотр за оценкой.
  it('снятие оценки отметку о просмотре не трогает (критерий 19 версии v1, критерий 25)', () => {
    const { id } = insertFilm({
      titleRu: 'Фильм',
      releaseDate: RELEASED,
      watched: true,
      wantToWatch: false,
      myRating: 8,
    });

    ok(updatePersonal(db, id, { myRating: null }, TODAY));

    const film = getFilm(db, id)!;
    expect(film.myRating).toBeNull();
    expect(film.watched).toBe(true);
    expect(film.wantToWatch).toBe(false);
    expect(filmStatus(film, TODAY)).toBe('watched');
  });

  it('снятие оценки не трогает и галочку «хочу посмотреть»', () => {
    const { id } = insertFilm({
      titleRu: 'Фильм',
      releaseDate: RELEASED,
      watched: false,
      wantToWatch: true,
      myRating: null,
    });

    ok(updatePersonal(db, id, { myRating: null }, TODAY));

    const film = getFilm(db, id)!;
    expect(film.watched).toBe(false);
    expect(film.wantToWatch).toBe(true);
    expect(filmStatus(film, TODAY)).toBe('will-watch');
  });

  it('патч с обеими отметками разом отклоняется, база не меняется (критерий 24)', () => {
    const { id } = insertFilm({
      titleRu: 'Фильм',
      releaseDate: RELEASED,
      watched: false,
      wantToWatch: false,
    });
    const before = getFilm(db, id)!;

    const result = updatePersonal(db, id, { watched: true, wantToWatch: true }, TODAY);

    expect(result.ok).toBe(false);
    if (result.ok) throw new Error('ожидался отказ');
    expect(result.error.length).toBeGreaterThan(0);
    expect(getFilm(db, id)).toEqual(before);
  });

  it('патч с «хочу посмотреть» и числовой оценкой отклоняется, база не меняется (критерий 24)', () => {
    const { id } = insertFilm({
      titleRu: 'Фильм',
      releaseDate: RELEASED,
      watched: false,
      wantToWatch: false,
      myRating: null,
    });
    const before = getFilm(db, id)!;

    const result = updatePersonal(db, id, { wantToWatch: true, myRating: 7 }, TODAY);

    expect(result.ok).toBe(false);
    if (result.ok) throw new Error('ожидался отказ');
    expect(result.error.length).toBeGreaterThan(0);
    expect(getFilm(db, id)).toEqual(before);
    expect(getFilm(db, id)!.wantToWatch).toBe(false);
  });

  it('не всякая пара полей противоречива: «посмотрел: да» со снятой галочкой проходит', () => {
    const { id } = insertFilm({
      titleRu: 'Фильм',
      releaseDate: RELEASED,
      watched: false,
      wantToWatch: true,
    });

    ok(updatePersonal(db, id, { watched: true, wantToWatch: false }, TODAY));

    const film = getFilm(db, id)!;
    expect(film.watched).toBe(true);
    expect(film.wantToWatch).toBe(false);
  });

  // Отклоняется именно числовая оценка: снятие оценки — не утверждение о просмотре,
  // и вместе с намерением оно непротиворечиво.
  it('«хочу посмотреть» вместе со снятием оценки проходит', () => {
    const { id } = insertFilm({
      titleRu: 'Фильм',
      releaseDate: RELEASED,
      watched: true,
      wantToWatch: false,
      myRating: 8,
    });

    ok(updatePersonal(db, id, { wantToWatch: true, myRating: null }, TODAY));

    const film = getFilm(db, id)!;
    expect(film.wantToWatch).toBe(true);
    expect(film.watched).toBe(false);
    expect(film.myRating).toBeNull();
  });

  it('невышедшему тайтлу «хочу посмотреть» ставится как обычно, а «посмотрел» по-прежнему отклоняется', () => {
    const { id } = insertFilm({ titleRu: 'Ждём', releaseDate: NOT_RELEASED });

    ok(updatePersonal(db, id, { wantToWatch: true }, TODAY));
    const after = getFilm(db, id)!;
    expect(after.wantToWatch).toBe(true);
    expect(filmStatus(after, TODAY)).toBe('waiting');

    expect(updatePersonal(db, id, { watched: true }, TODAY).ok).toBe(false);
    expect(getFilm(db, id)).toEqual(after);
  });
});

// Критерии приёмки 12 и 13 версии v4 на уровне хранилища:
// 12 — фильм без досье читается с пустыми колонками, они отличимы от заполненных;
// 13 — наполнение досье не трогает личные поля, а сохранение личных полей не трогает досье.
// Четыре новые колонки хранятся как JSON (`text(..., { mode: 'json' })`), поэтому читаются
// обратно разобранными структурами, а не строками, — вместе со всем деревом узлов внутри
// рубрики. Дата поиска — ISO-текст, лексикографически сравнимый с датой выхода.

const DOSSIER_BEFORE: DossierFragment[] = [
  {
    key: 'why',
    body: [
      { type: 'p', text: 'Первый фильм автора за десять лет.' },
      { type: 'p', text: 'Жанр скрещён с фестивальным кино.' },
    ],
  },
  {
    key: 'experience',
    body: [{ type: 'ul', items: ['Медленный ритм.', 'Финал без объяснений.'] }],
  },
];
const DOSSIER_AFTER: DossierFragment[] = [
  {
    key: 'themes',
    body: [
      { type: 'h', text: 'Вера возникает там, где заканчивается знание' },
      { type: 'p', text: 'Тема держится на **одном кадре**.' },
    ],
  },
];
// Дополнение v15 (specs/v15/spec.md, раздел A, «Схема и наполнение»): у досье
// появился третий блок «Важные вещи о фильме», и лежит он в своей колонке
// `dossier_keys` — такой же JSON и такой же обнуляемый, как два соседних. Форма
// тела блока — ровно один список из пяти-семи пунктов; сторожит её валидатор,
// а хранилищу довольно того, что дерево узлов доезжает обратно целиком.
const DOSSIER_KEYS: DossierFragment[] = [
  {
    key: 'keys',
    body: [
      {
        type: 'ul',
        items: [
          '**Героиня стоит сразу на нескольких границах.** Расовой, гендерной и сословной разом.',
          '**Месть у неё не личная, а устроительная.** Она метит в порядок, а не в человека.',
          '**Маска здесь — не приём, а условие жизни.** Снять её значит перестать существовать.',
          '**Форма спорит с жанром.** Самурайская история рассказана языком трагедии мести.',
          '**Финал не закрывает счёт.** Он показывает цену, а не итог.',
        ],
      },
    ],
  },
];
const DOSSIER_SOURCES: DossierSource[] = [
  { publication: 'Variety', title: 'Рецензия', url: 'https://variety.com/review' },
];
const SEARCHED_AT = '2026-08-01';

function readDossier(id: number): FilmWithDossier {
  const film = getFilm(db, id);
  expect(film, `фильм ${id} не найден`).toBeDefined();
  return film!;
}

describe('досье в базе', () => {
  it('фильм без досье читается с пустыми колонками', () => {
    const { id } = insertFilm({ titleRu: 'Без досье', releaseDate: RELEASED });
    const film = readDossier(id);

    expect(film.dossierBefore).toBeNull();
    expect(film.dossierAfter).toBeNull();
    expect(film.dossierSources).toBeNull();
    expect(film.dossierSearchedAt).toBeNull();
  });

  it('блоки досье записываются и читаются обратно разобранным JSON, а не строкой', () => {
    const { id } = insertFilm({
      titleRu: 'С досье',
      releaseDate: RELEASED,
      dossierBefore: DOSSIER_BEFORE,
      dossierAfter: DOSSIER_AFTER,
    });

    const film = readDossier(id);
    expect(film.dossierBefore).toEqual(DOSSIER_BEFORE);
    expect(film.dossierAfter).toEqual(DOSSIER_AFTER);
  });

  // v15. Третий блок хранится наравне с двумя прежними: своя колонка, тот же JSON,
  // то же «пусто значит не собран». Отсутствие блока — законное состояние (у невышедшего
  // фильма и у досье старой формы до переноса), поэтому пустая колонка ошибкой не считается.
  it('блок ключей записывается и читается третьей колонкой', () => {
    const { id } = insertFilm({
      titleRu: 'С ключами',
      releaseDate: RELEASED,
      dossierBefore: DOSSIER_BEFORE,
      dossierKeys: DOSSIER_KEYS,
      dossierAfter: DOSSIER_AFTER,
    });

    const film = readDossier(id);
    expect(film.dossierKeys).toEqual(DOSSIER_KEYS);
    expect(film.dossierBefore).toEqual(DOSSIER_BEFORE);
    expect(film.dossierAfter).toEqual(DOSSIER_AFTER);
  });

  it('пункты блока ключей читаются разобранным JSON, а не строкой', () => {
    const { id } = insertFilm({
      titleRu: 'С ключами',
      releaseDate: RELEASED,
      dossierKeys: DOSSIER_KEYS,
    });

    const fragments = readDossier(id).dossierKeys;
    expect(fragments).toHaveLength(1);

    const [keys] = fragments!;
    expect(keys.key).toBe('keys');
    expect(keys.body).toHaveLength(1);

    const [node] = keys.body;
    if (node.type !== 'ul') throw new Error(`ожидался список пунктов, пришло «${node.type}»`);
    expect(node.items).toHaveLength(5);
    expect(node.items[0]).toContain('**Героиня стоит сразу на нескольких границах.**');
  });

  it('фильм без досье читается с пустой колонкой ключей', () => {
    const { id } = insertFilm({ titleRu: 'Без досье', releaseDate: RELEASED });
    expect(readDossier(id).dossierKeys).toBeNull();
  });

  it('ключи одного фильма не попадают в другой', () => {
    const withKeys = insertFilm({
      titleRu: 'С ключами',
      releaseDate: RELEASED,
      dossierKeys: DOSSIER_KEYS,
    });
    const without = insertFilm({ titleRu: 'Без ключей', releaseDate: RELEASED });

    expect(readDossier(withKeys.id).dossierKeys).toEqual(DOSSIER_KEYS);
    expect(readDossier(without.id).dossierKeys).toBeNull();
  });

  it('дерево узлов внутри рубрики переживает запись и чтение целиком', () => {
    const { id } = insertFilm({
      titleRu: 'С досье',
      releaseDate: RELEASED,
      dossierBefore: DOSSIER_BEFORE,
      dossierAfter: DOSSIER_AFTER,
    });

    const film = readDossier(id);
    const [why, experience] = film.dossierBefore!;

    expect(why.body).toHaveLength(2);
    expect(why.body[0]).toEqual({ type: 'p', text: 'Первый фильм автора за десять лет.' });
    expect(experience.body[0]).toEqual({
      type: 'ul',
      items: ['Медленный ритм.', 'Финал без объяснений.'],
    });
    expect(film.dossierAfter![0].body[0]).toEqual({
      type: 'h',
      text: 'Вера возникает там, где заканчивается знание',
    });
  });

  it('источники и дата поиска тоже сохраняются', () => {
    const { id } = insertFilm({
      titleRu: 'С источниками',
      releaseDate: RELEASED,
      dossierSources: DOSSIER_SOURCES,
      dossierSearchedAt: SEARCHED_AT,
    });

    const film = readDossier(id);
    expect(film.dossierSources).toEqual(DOSSIER_SOURCES);
    expect(film.dossierSearchedAt).toBe(SEARCHED_AT);
  });

  it('listFilms отдаёт досье вместе с остальными полями', () => {
    insertFilm({
      titleRu: 'С досье',
      releaseDate: RELEASED,
      dossierBefore: DOSSIER_BEFORE,
      dossierSearchedAt: SEARCHED_AT,
    });

    const [film] = listFilms(db);
    expect(film.dossierBefore).toEqual(DOSSIER_BEFORE);
    expect(film.dossierSearchedAt).toBe(SEARCHED_AT);
  });

  it('досье одного фильма не попадает в другой', () => {
    const withDossier = insertFilm({
      titleRu: 'С досье',
      releaseDate: RELEASED,
      dossierBefore: DOSSIER_BEFORE,
    });
    const without = insertFilm({ titleRu: 'Без досье', releaseDate: RELEASED });

    expect(readDossier(withDossier.id).dossierBefore).toEqual(DOSSIER_BEFORE);
    expect(readDossier(without.id).dossierBefore).toBeNull();
  });

  it('updatePersonal не затирает досье (критерий 13)', () => {
    const { id } = insertFilm({
      titleRu: 'С досье',
      releaseDate: RELEASED,
      dossierBefore: DOSSIER_BEFORE,
      dossierKeys: DOSSIER_KEYS,
      dossierAfter: DOSSIER_AFTER,
      dossierSources: DOSSIER_SOURCES,
      dossierSearchedAt: SEARCHED_AT,
    });

    ok(updatePersonal(db, id, { myRating: 9, tasteStar: true, comment: 'заметка' }, TODAY));

    const film = readDossier(id);
    expect(film.myRating).toBe(9);
    expect(film.tasteStar).toBe(true);
    expect(film.comment).toBe('заметка');
    expect(film.dossierBefore).toEqual(DOSSIER_BEFORE);
    expect(film.dossierKeys).toEqual(DOSSIER_KEYS);
    expect(film.dossierAfter).toEqual(DOSSIER_AFTER);
    expect(film.dossierSources).toEqual(DOSSIER_SOURCES);
    expect(film.dossierSearchedAt).toBe(SEARCHED_AT);
  });

  it('отказ updatePersonal тоже оставляет досье нетронутым', () => {
    const { id } = insertFilm({
      titleRu: 'С досье',
      releaseDate: RELEASED,
      dossierBefore: DOSSIER_BEFORE,
      dossierSearchedAt: SEARCHED_AT,
    });

    expect(updatePersonal(db, id, { myRating: 42 }, TODAY).ok).toBe(false);

    const film = readDossier(id);
    expect(film.dossierBefore).toEqual(DOSSIER_BEFORE);
    expect(film.dossierSearchedAt).toBe(SEARCHED_AT);
  });
});
