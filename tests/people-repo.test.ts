// Критерии приёмки 1, 9, 10, 12, 15 и 17 версии v7 на уровне хранилища (SQLite in-memory):
// 1, 9 — галерея страницы персоналии показывает фильмы этого человека из базы;
// 10 — у персоналии без связей список фильмов пуст, и странице нечего рисовать;
// 12 — указатель показывает всех персоналий базы, отсортированных по имени;
// 15 — карту «имя → slug» для карточки фильма даёт связь, а не угадывание;
// 17 — личных полей у персоналии нет на уровне схемы: не «не показываем», а не заводим.
//
// Контракт модуля '@/lib/people-repo' (plan.md) — синхронные функции над better-sqlite3,
// по образцу '@/lib/films-repo':
//   listPeople(db): Person[];                      // порядок — по nameRu, локаль ru
//   getPersonBySlug(db, slug): Person | undefined;
//   filmsOfPerson(db, personId): Film[];           // через film_people, порядок — по дате выхода
//   peopleOfFilm(db, filmId): { person: Person; role: string }[];
//   filmCountsByPerson(db): Map<number, number>;   // для подписи в указателе
//
// Связь `film_people` — тройка (фильм, человек, роль): один человек бывает в одном фильме
// и режиссёром, и сценаристом, и это две разные связи. Отсюда две проверки, ради которых
// таблица связей и заводилась: в галерее такой фильм показан один раз, а в списке людей
// фильма человек назван дважды — по разу на роль.
//
// Направление сортировки фильмографии план словами не задаёт («порядок — по дате выхода»),
// поэтому проверяется упорядоченность, а не выбранное направление: фильмы вставляются
// вперемешку, и любой из двух монотонных порядков засчитывается, а порядок вставки — нет.

import { describe, it, expect, beforeEach } from 'vitest';
import { createDb } from '@/db';
import type { Db } from '@/db';
import { films, filmPeople, people } from '@/db/schema';
import type { Film, Person } from '@/db/schema';
import {
  countPeople,
  filmCountsByPerson,
  filmsOfPerson,
  getPersonBySlug,
  listPeople,
  peopleOfFilm,
} from '@/lib/people-repo';
import { filmValues, personValues } from './helpers';

let db: Db;

function insertFilm(values: Parameters<typeof filmValues>[0]): Film {
  return db.insert(films).values(filmValues(values)).returning().all()[0];
}

function insertPerson(values: Parameters<typeof personValues>[0]): Person {
  return db.insert(people).values(personValues(values)).returning().all()[0];
}

function link(film: Film, person: Person, role: string): void {
  db.insert(filmPeople).values({ filmId: film.id, personId: person.id, role }).run();
}

/** Список упорядочен по дате выхода — в любую из двух сторон, но не как попало. */
function expectOrderedByDate(list: Film[]): void {
  const dates = list.map((film) => film.releaseDate ?? '');
  const ascending = [...dates].sort();
  const descending = [...ascending].reverse();

  expect([ascending.join('|'), descending.join('|')]).toContain(dates.join('|'));
}

beforeEach(() => {
  db = createDb(':memory:');
});

describe('listPeople: указатель читает всех (критерий 12)', () => {
  it('пустая база — пустой список', () => {
    expect(listPeople(db)).toEqual([]);
  });

  it('персоналии возвращаются со всеми справочными полями', () => {
    insertPerson({
      slug: 'mamoru-oshii',
      nameRu: 'Мамору Осии',
      nameOriginal: 'Mamoru Oshii',
      photoPath: '/people/mamoru-oshii.jpg',
      birthDate: '1951-08-08',
      birthPlace: 'Токио, Япония',
      roles: ['director', 'screenwriter'],
      imdbId: 'nm0651900',
      kinopoiskId: 32168,
      annotation: 'Тридцать лет снимает про то, что у кино нет реальности.',
      searchedAt: '2026-08-23',
    });

    const [person] = listPeople(db);

    expect(person.slug).toBe('mamoru-oshii');
    expect(person.nameRu).toBe('Мамору Осии');
    expect(person.nameOriginal).toBe('Mamoru Oshii');
    expect(person.photoPath).toBe('/people/mamoru-oshii.jpg');
    expect(person.birthDate).toBe('1951-08-08');
    expect(person.birthPlace).toBe('Токио, Япония');
    expect(person.roles).toEqual(['director', 'screenwriter']);
    expect(person.imdbId).toBe('nm0651900');
    expect(person.kinopoiskId).toBe(32168);
    expect(person.searchedAt).toBe('2026-08-23');
  });

  it('персоналия без материалов читается с пустыми полями', () => {
    insertPerson({ slug: 'moko-chan', nameRu: 'Моко-тян', roles: ['designer'] });

    const [person] = listPeople(db);

    expect(person.nameOriginal).toBeNull();
    expect(person.birthDate).toBeNull();
    expect(person.annotation).toBeNull();
    expect(person.method).toBeNull();
    expect(person.workNotes).toBeNull();
    expect(person.sources).toBeNull();
  });

  it('порядок — по имени, кириллица по алфавиту', () => {
    insertPerson({ slug: 'yasujiro-ozu', nameRu: 'Ясудзиро Одзу', roles: ['director'] });
    insertPerson({ slug: 'yoshiaki-kawajiri', nameRu: 'Ёсиаки Кавадзири', roles: ['director'] });
    insertPerson({ slug: 'akira-kurosawa', nameRu: 'Акира Куросава', roles: ['director'] });
    insertPerson({ slug: 'evgeny-yufit', nameRu: 'Евгений Юфит', roles: ['director'] });

    expect(listPeople(db).map((person) => person.nameRu)).toEqual([
      'Акира Куросава',
      'Евгений Юфит',
      // «Ё» стоит между «Е» и «Ж» только при сравнении с русской локалью:
      // по кодам символов она уехала бы в начало списка, впереди «А».
      'Ёсиаки Кавадзири',
      'Ясудзиро Одзу',
    ]);
  });
});

describe('getPersonBySlug: страница персоналии (критерии 1 и 2)', () => {
  it('находит персоналию по slug', () => {
    insertPerson({ slug: 'mamoru-oshii', nameRu: 'Мамору Осии', roles: ['director'] });

    expect(getPersonBySlug(db, 'mamoru-oshii')?.nameRu).toBe('Мамору Осии');
  });

  it('для несуществующего slug возвращает undefined — странице неоткуда взяться', () => {
    insertPerson({ slug: 'mamoru-oshii', nameRu: 'Мамору Осии', roles: ['director'] });

    expect(getPersonBySlug(db, 'kenji-kawai')).toBeUndefined();
    expect(getPersonBySlug(db, '')).toBeUndefined();
  });

  it('материалы возвращаются такими же, какими записаны', () => {
    insertPerson({
      slug: 'mamoru-oshii',
      nameRu: 'Мамору Осии',
      roles: ['director'],
      notableWorks: [{ title: 'Призрак в доспехах', year: 1995 }],
      links: [{ label: 'Интервью', url: 'https://example.com/i' }],
      method: [
        {
          title: null,
          theses: [{ title: 'У кино нет реальности', body: [{ type: 'p', text: 'Тело тезиса.' }] }],
        },
      ],
      workNotes: [
        {
          title: 'Авалон',
          year: 2001,
          titleOriginal: 'Avalon',
          method: [{ type: 'p', text: 'Разбор.' }],
          facts: ['Снят в Польше.'],
        },
      ],
      sources: [{ publication: 'Sight & Sound', title: 'Разговор', url: 'https://example.com/s' }],
    });

    const person = getPersonBySlug(db, 'mamoru-oshii')!;

    expect(person.notableWorks).toEqual([{ title: 'Призрак в доспехах', year: 1995 }]);
    expect(person.links).toEqual([{ label: 'Интервью', url: 'https://example.com/i' }]);
    expect(person.method?.[0].theses[0].title).toBe('У кино нет реальности');
    expect(person.workNotes?.[0].facts).toEqual(['Снят в Польше.']);
    expect(person.sources?.[0].publication).toBe('Sight & Sound');
  });
});

describe('filmsOfPerson: галерея страницы персоналии (критерии 9 и 10)', () => {
  it('у персоналии без связей фильмов нет', () => {
    const person = insertPerson({ slug: 'moko-chan', nameRu: 'Моко-тян', roles: ['designer'] });
    insertFilm({ titleRu: 'Чужой фильм', releaseDate: '1999-03-31' });

    expect(filmsOfPerson(db, person.id)).toEqual([]);
  });

  it('возвращает только связанные фильмы', () => {
    const oshii = insertPerson({ slug: 'mamoru-oshii', nameRu: 'Мамору Осии', roles: ['director'] });
    const gits = insertFilm({ titleRu: 'Призрак в доспехах', releaseDate: '1995-11-18' });
    const avalon = insertFilm({ titleRu: 'Авалон', releaseDate: '2001-01-20' });
    insertFilm({ titleRu: 'Матрица', releaseDate: '1999-03-31' });

    link(gits, oshii, 'director');
    link(avalon, oshii, 'director');

    expect(filmsOfPerson(db, oshii.id).map((film) => film.titleRu).sort()).toEqual([
      'Авалон',
      'Призрак в доспехах',
    ]);
  });

  it('фильмы упорядочены по дате выхода, а не по порядку связей', () => {
    const oshii = insertPerson({ slug: 'mamoru-oshii', nameRu: 'Мамору Осии', roles: ['director'] });
    const gits = insertFilm({ titleRu: 'Призрак в доспехах', releaseDate: '1995-11-18' });
    const innocence = insertFilm({ titleRu: 'Невинность', releaseDate: '2004-03-06' });
    const avalon = insertFilm({ titleRu: 'Авалон', releaseDate: '2001-01-20' });

    link(gits, oshii, 'director');
    link(innocence, oshii, 'director');
    link(avalon, oshii, 'director');

    const list = filmsOfPerson(db, oshii.id);

    expect(list).toHaveLength(3);
    expectOrderedByDate(list);
  });

  it('фильм, где человек и режиссёр, и сценарист, показан один раз', () => {
    const oshii = insertPerson({ slug: 'mamoru-oshii', nameRu: 'Мамору Осии', roles: ['director'] });
    const gits = insertFilm({ titleRu: 'Призрак в доспехах', releaseDate: '1995-11-18' });

    link(gits, oshii, 'director');
    link(gits, oshii, 'screenwriter');

    expect(filmsOfPerson(db, oshii.id).map((film) => film.titleRu)).toEqual(['Призрак в доспехах']);
  });

  it('фильмы возвращаются целиком — галерее нужен постер, дата и личные отметки фильма', () => {
    const oshii = insertPerson({ slug: 'mamoru-oshii', nameRu: 'Мамору Осии', roles: ['director'] });
    const gits = insertFilm({
      titleRu: 'Призрак в доспехах',
      posterPath: '/posters/gits.jpg',
      releaseDate: '1995-11-18',
      watched: true,
      myRating: 10,
    });

    link(gits, oshii, 'director');

    const [film] = filmsOfPerson(db, oshii.id);

    expect(film.posterPath).toBe('/posters/gits.jpg');
    expect(film.releaseDate).toBe('1995-11-18');
    expect(film.watched).toBe(true);
    expect(film.myRating).toBe(10);
  });

  it('для несуществующего человека список пуст, а не ошибка', () => {
    expect(filmsOfPerson(db, 4242)).toEqual([]);
  });
});

describe('peopleOfFilm: имена-ссылки в карточке фильма (критерий 15)', () => {
  it('у фильма без связей список пуст', () => {
    const gits = insertFilm({ titleRu: 'Призрак в доспехах' });
    insertPerson({ slug: 'mamoru-oshii', nameRu: 'Мамору Осии', roles: ['director'] });

    expect(peopleOfFilm(db, gits.id)).toEqual([]);
  });

  it('возвращает связанных людей вместе с ролью связи', () => {
    const gits = insertFilm({ titleRu: 'Призрак в доспехах' });
    const oshii = insertPerson({ slug: 'mamoru-oshii', nameRu: 'Мамору Осии', roles: ['director'] });

    link(gits, oshii, 'director');

    const linked = peopleOfFilm(db, gits.id);

    expect(linked).toHaveLength(1);
    expect(linked[0].role).toBe('director');
    expect(linked[0].person.slug).toBe('mamoru-oshii');
    expect(linked[0].person.nameRu).toBe('Мамору Осии');
  });

  it('человек в двух ролях назван дважды — по разу на роль', () => {
    const gits = insertFilm({ titleRu: 'Призрак в доспехах' });
    const oshii = insertPerson({ slug: 'mamoru-oshii', nameRu: 'Мамору Осии', roles: ['director'] });

    link(gits, oshii, 'director');
    link(gits, oshii, 'screenwriter');

    const roles = peopleOfFilm(db, gits.id).map((entry) => entry.role);

    expect([...roles].sort()).toEqual(['director', 'screenwriter']);
  });

  it('люди чужого фильма не попадают', () => {
    const gits = insertFilm({ titleRu: 'Призрак в доспехах' });
    const matrix = insertFilm({ titleRu: 'Матрица' });
    const oshii = insertPerson({ slug: 'mamoru-oshii', nameRu: 'Мамору Осии', roles: ['director'] });
    const kawai = insertPerson({ slug: 'kenji-kawai', nameRu: 'Кэндзи Каваи', roles: ['composer'] });

    link(gits, oshii, 'director');
    link(matrix, kawai, 'composer');

    expect(peopleOfFilm(db, gits.id).map((entry) => entry.person.slug)).toEqual(['mamoru-oshii']);
  });

  it('для несуществующего фильма список пуст, а не ошибка', () => {
    expect(peopleOfFilm(db, 4242)).toEqual([]);
  });
});

describe('filmCountsByPerson: число фильмов в подписи указателя', () => {
  it('на пустой базе счётчиков нет', () => {
    expect(filmCountsByPerson(db).size).toBe(0);
  });

  it('считает фильмы каждого человека', () => {
    const oshii = insertPerson({ slug: 'mamoru-oshii', nameRu: 'Мамору Осии', roles: ['director'] });
    const kawai = insertPerson({ slug: 'kenji-kawai', nameRu: 'Кэндзи Каваи', roles: ['composer'] });
    const gits = insertFilm({ titleRu: 'Призрак в доспехах' });
    const avalon = insertFilm({ titleRu: 'Авалон' });

    link(gits, oshii, 'director');
    link(avalon, oshii, 'director');
    link(gits, kawai, 'composer');

    const counts = filmCountsByPerson(db);

    expect(counts.get(oshii.id)).toBe(2);
    expect(counts.get(kawai.id)).toBe(1);
  });

  it('фильм, где человек в двух ролях, считается один раз', () => {
    const oshii = insertPerson({ slug: 'mamoru-oshii', nameRu: 'Мамору Осии', roles: ['director'] });
    const gits = insertFilm({ titleRu: 'Призрак в доспехах' });

    link(gits, oshii, 'director');
    link(gits, oshii, 'screenwriter');

    expect(filmCountsByPerson(db).get(oshii.id)).toBe(1);
  });

  it('у персоналии без фильмов счётчик нулевой', () => {
    const moko = insertPerson({ slug: 'moko-chan', nameRu: 'Моко-тян', roles: ['designer'] });

    expect(filmCountsByPerson(db).get(moko.id) ?? 0).toBe(0);
  });
});

// Спека v7, раздел 7 и критерий приёмки 17: персоналию нельзя оценить, и держится это
// схемой, а не вёрсткой. Колонок личных полей у таблицы нет — обойти запрет правкой
// разметки нельзя, потому что обходить нечего.
describe('у персоналии нет личных полей (критерий 17)', () => {
  it('в прочитанной записи нет ни оценки, ни звёздочки, ни комментария, ни отметок', () => {
    insertPerson({ slug: 'mamoru-oshii', nameRu: 'Мамору Осии', roles: ['director'] });

    const person = getPersonBySlug(db, 'mamoru-oshii')!;

    for (const field of ['myRating', 'tasteStar', 'comment', 'watched', 'wantToWatch']) {
      expect(Object.keys(person), `личное поле «${field}» у персоналии`).not.toContain(field);
    }
  });
});

// Критерий приёмки 20а версии v11 — счётчик у пункта «Персоналии» в шапке.
// На уровне хранилища это одна функция: сколько персоналий в базе. Число нужно
// на каждой странице сайта, включая «О проекте», и брать его через listPeople(db).length
// значило бы вычитывать все записи целиком ради одного числа.
//
// Отбор ролей на счётчик не влияет и потому здесь не участвует вовсе: он живёт
// в адресе страницы указателя, а шапка про него не знает — ровно как счётчики
// табов статусов не знают о выбранных жанрах.
describe('счётчик персоналий для шапки (критерий 20а v11)', () => {
  it('пустая база даёт ноль', () => {
    expect(countPeople(db)).toBe(0);
  });

  it('считает всех персоналий базы', () => {
    insertPerson({ slug: 'mamoru-oshii', nameRu: 'Мамору Осии', roles: ['director'] });
    insertPerson({ slug: 'moko-chan', nameRu: 'Моко-тян', roles: ['designer'] });
    insertPerson({ slug: 'yorgos-lanthimos', nameRu: 'Йоргос Лантимос', roles: ['director'] });

    expect(countPeople(db)).toBe(3);
  });

  it('совпадает с длиной списка указателя', () => {
    insertPerson({ slug: 'mamoru-oshii', nameRu: 'Мамору Осии', roles: ['director'] });
    insertPerson({ slug: 'moko-chan', nameRu: 'Моко-тян', roles: ['designer'] });

    expect(countPeople(db)).toBe(listPeople(db).length);
  });
});
