// Критерий приёмки 25 версии v8 (specs/v8/spec.md, раздел «`npm run refresh-films`»):
// команда переносит в базу справочные поля уже занесённых тайтлов, а список
// обновляемых колонок не содержит ни одного личного поля — и это закреплено тестом.
//
// Зачем модуль появился. `scripts/add-films.ts` доливает в базу тайтлы, которых там
// ещё нет, и никогда не трогает поля существующих записей. У тегов и сезонов свои
// скрипты обновления (`tag-films`, `fill-seasons`), у остальных справочных полей
// карточки — нет, поэтому дозаполненный в `specs/v1/films-data.json` композитор
// в базу не попадает вовсе. Дыра тихая: файл и база расходятся, а `check-data`
// этого не видит — он сверяет файлы между собой, а не файлы с базой.
//
// Контракт модуля '@/lib/refresh', зафиксированный этими тестами:
//   const REFERENCE_FIELDS: readonly string[];
//   type FieldChange = { field: string; from: unknown; to: unknown };
//   type FilmRefresh = { titleOriginal: string; changes: FieldChange[] };
//   function changedFields(current: Record<string, unknown>, incoming: Record<string, unknown>): FieldChange[];
//   function planRefresh(rows: Record<string, unknown>[], records: Record<string, unknown>[]): FilmRefresh[];
//
// Главное, что здесь охраняется, — состав `REFERENCE_FIELDS`. Личные поля (оценка,
// звёздочка вкуса, комментарий, обе отметки) самое ценное в базе, и попадание любого
// из них в список стоило бы дороже всего в проекте. Поэтому перечень личных полей
// и материалов агента выписан в теле теста явно, а не выведен из `REFERENCE_FIELDS`:
// выведенный перечень согласился бы с любым расширением списка, явный — сработает,
// если кто-то расширит его неаккуратно.
//
// Список задан перечислением, а не правилом «всё, кроме»: «кроме» молча впустит
// новую колонку, добавленную будущей миграцией.
//
// Функции чистые, база не нужна: и `changedFields`, и `planRefresh` получают обычные
// объекты. Ключ сопоставления — `titleOriginal`, как во всех скриптах наполнения
// (`add-films`, `tag-films`, `fill-seasons`, `fill-dossiers`, `fill-people`):
// «Призрак в доспехах» 1995 года и одноимённый сериал 2026-го — разные тайтлы
// с одним русским именем, и сопоставление по `titleRu` оставило бы от двух записей одну.
//
// Про `titleOriginal` в самом `REFERENCE_FIELDS` спека не высказывается: это ключ
// сопоставления, и тесты ниже его наличия ни требуют, ни запрещают.

import { describe, it, expect } from 'vitest';
import { REFERENCE_FIELDS, changedFields, planRefresh } from '@/lib/refresh';

// Личные поля владельца — по `src/db/schema.ts`, таблица `films`. Перечень
// намеренно выписан руками: он и есть предмет проверки.
const PERSONAL_FIELDS = ['watched', 'wantToWatch', 'myRating', 'tasteStar', 'comment'];

// Материалы агента: их пишет `fill-dossiers`, и в справочном файле тайтлов их нет.
const DOSSIER_FIELDS = [
  'dossierBefore',
  'dossierKeys',
  'dossierAfter',
  'dossierSources',
  'dossierSearchedAt',
];

// У этих полей свои команды обновления. Два владельца одного значения разошлись бы.
const OWNED_ELSEWHERE = ['tags', 'seasonsReleased', 'nextSeasonNumber', 'nextSeasonDate'];

const SHELL = 'Ghost in the Shell';
const SHELL_SERIES = 'Ghost in the Shell: Kokaku Kidotai';

/** Строка базы: полностью заполненный тайтл с пустыми значениями по умолчанию —
 *  тот же приём, что у `makeFilm` в tests/helpers.ts. Тест задаёт только то,
 *  что действительно проверяет. */
function row(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id: 1,
    titleRu: 'Призрак в доспехах',
    titleOriginal: SHELL,
    posterPath: '/posters/ghost-in-the-shell.jpg',
    releaseDate: '1995-11-18',
    seasonsReleased: null,
    nextSeasonNumber: null,
    nextSeasonDate: null,
    imdbRating: 8,
    kinopoiskRating: 7.9,
    imdbId: 'tt0113568',
    kinopoiskId: 397,
    annotation: 'Майор Кусанаги ведёт охоту на хакера, взламывающего чужие кибермозги.',
    director: 'Мамору Осии',
    producer: 'Ясухиро Такэда',
    screenwriter: 'Кадзунори Ито',
    composer: null,
    soundDesigner: null,
    cast: ['Атсуко Танака', 'Акио Оцука'],
    tags: ['film', 'animation', 'sci-fi'],
    dossierBefore: null,
    dossierKeys: null,
    dossierAfter: null,
    dossierSources: null,
    dossierSearchedAt: null,
    watched: false,
    wantToWatch: false,
    myRating: null,
    tasteStar: false,
    comment: null,
    ...overrides,
  };
}

/** Запись файла данных: те же справочные поля, но без `id`, личных полей
 *  и материалов агента — в `specs/v1/films-data.json` их и нет. */
function record(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    titleRu: 'Призрак в доспехах',
    titleOriginal: SHELL,
    posterPath: '/posters/ghost-in-the-shell.jpg',
    releaseDate: '1995-11-18',
    imdbRating: 8,
    kinopoiskRating: 7.9,
    imdbId: 'tt0113568',
    kinopoiskId: 397,
    annotation: 'Майор Кусанаги ведёт охоту на хакера, взламывающего чужие кибермозги.',
    director: 'Мамору Осии',
    producer: 'Ясухиро Такэда',
    screenwriter: 'Кадзунори Ито',
    composer: null,
    soundDesigner: null,
    cast: ['Атсуко Танака', 'Акио Оцука'],
    ...overrides,
  };
}

/** Сводка по одному тайтлу или `undefined`, если его в сводке нет. */
function refreshOf(titleOriginal: string, plan: ReturnType<typeof planRefresh>) {
  return plan.find((item) => item.titleOriginal === titleOriginal);
}

describe('REFERENCE_FIELDS', () => {
  it('не содержит ни одного личного поля владельца', () => {
    for (const field of PERSONAL_FIELDS) {
      expect(REFERENCE_FIELDS).not.toContain(field);
    }
  });

  it('не содержит материалов агента', () => {
    for (const field of DOSSIER_FIELDS) {
      expect(REFERENCE_FIELDS).not.toContain(field);
    }
  });

  it('не содержит `id`', () => {
    expect(REFERENCE_FIELDS).not.toContain('id');
  });

  it('не содержит тегов и сезонов: у них свои скрипты обновления', () => {
    for (const field of OWNED_ELSEWHERE) {
      expect(REFERENCE_FIELDS).not.toContain(field);
    }
  });

  it('не пересекается ни с личными полями, ни с материалами агента', () => {
    const forbidden = new Set([...PERSONAL_FIELDS, ...DOSSIER_FIELDS]);
    const intersection = REFERENCE_FIELDS.filter((field) => forbidden.has(field));
    expect(intersection).toEqual([]);
  });

  it('содержит справочные поля карточки', () => {
    const expected = [
      'titleRu',
      'posterPath',
      'releaseDate',
      'imdbRating',
      'imdbId',
      'kinopoiskRating',
      'kinopoiskId',
      'annotation',
      'director',
      'producer',
      'screenwriter',
      'composer',
      'soundDesigner',
      'cast',
    ];
    for (const field of expected) {
      expect(REFERENCE_FIELDS).toContain(field);
    }
  });

  it('не содержит даты заведения тайтла', () => {
    // `createdAt` — лог базы, а не справочное поле фильма: он говорит, когда тайтл
    // попал сюда, и задним числом не меняется. Перенос его из файла означал бы,
    // что историю заведения задаёт файл данных.
    expect(REFERENCE_FIELDS).not.toContain('createdAt');
  });

  it('не содержит повторов', () => {
    expect(new Set(REFERENCE_FIELDS).size).toBe(REFERENCE_FIELDS.length);
  });
});

describe('changedFields', () => {
  it('у совпадающих записей не находит изменений', () => {
    expect(changedFields(row(), record())).toEqual([]);
  });

  it('называет изменившееся поле, прежнее и новое значение', () => {
    const current = row({ composer: null });
    const incoming = record({ composer: 'Кэндзи Каваи' });

    expect(changedFields(current, incoming)).toEqual([
      { field: 'composer', from: null, to: 'Кэндзи Каваи' },
    ]);
  });

  it('находит несколько изменившихся полей сразу', () => {
    const current = row({ composer: null, imdbRating: 8 });
    const incoming = record({ composer: 'Кэндзи Каваи', imdbRating: 8.1 });

    const changes = changedFields(current, incoming);

    expect(changes).toHaveLength(2);
    expect(changes).toContainEqual({ field: 'composer', from: null, to: 'Кэндзи Каваи' });
    expect(changes).toContainEqual({ field: 'imdbRating', from: 8, to: 8.1 });
  });

  it('не считает изменением поле, которого во входящей записи нет', () => {
    const current = row({ composer: 'Кэндзи Каваи' });
    const incoming = record();
    delete incoming.composer;

    // Отсутствие поля в файле не означает «стереть значение в базе».
    expect(changedFields(current, incoming)).toEqual([]);
  });

  it('считает изменением явный null при непустом значении в базе', () => {
    const current = row({ composer: 'Кэндзи Каваи' });
    const incoming = record({ composer: null });

    // Так стирают значение осознанно — в отличие от отсутствующего поля.
    expect(changedFields(current, incoming)).toEqual([
      { field: 'composer', from: 'Кэндзи Каваи', to: null },
    ]);
  });

  it('не считает изменением одинаковый по содержимому список актёров', () => {
    const current = row({ cast: ['Атсуко Танака', 'Акио Оцука'] });
    const incoming = record({ cast: ['Атсуко Танака', 'Акио Оцука'] });

    // Массивы сравниваются по содержимому, а не по ссылке.
    expect(changedFields(current, incoming)).toEqual([]);
  });

  it('считает изменением другой порядок в списке актёров', () => {
    const current = row({ cast: ['Атсуко Танака', 'Акио Оцука'] });
    const incoming = record({ cast: ['Акио Оцука', 'Атсуко Танака'] });

    expect(changedFields(current, incoming)).toEqual([
      {
        field: 'cast',
        from: ['Атсуко Танака', 'Акио Оцука'],
        to: ['Акио Оцука', 'Атсуко Танака'],
      },
    ]);
  });

  it('считает изменением другой состав списка актёров', () => {
    const current = row({ cast: ['Атсуко Танака'] });
    const incoming = record({ cast: ['Атсуко Танака', 'Акио Оцука'] });

    expect(changedFields(current, incoming)).toEqual([
      { field: 'cast', from: ['Атсуко Танака'], to: ['Атсуко Танака', 'Акио Оцука'] },
    ]);
  });

  it('считает изменением появившийся список актёров при пустом в базе', () => {
    const current = row({ cast: null });
    const incoming = record({ cast: ['Атсуко Танака'] });

    expect(changedFields(current, incoming)).toEqual([
      { field: 'cast', from: null, to: ['Атсуко Танака'] },
    ]);
  });

  it('не замечает расхождения в личном поле', () => {
    const current = row({ myRating: 9, tasteStar: true, comment: 'Пересматривал трижды' });
    const incoming = record({ myRating: 3, tasteStar: false, comment: null, watched: true });

    // Личные поля вне `REFERENCE_FIELDS`, и `refresh-films` их не видит вовсе.
    expect(changedFields(current, incoming)).toEqual([]);
  });

  it('не замечает расхождения в тегах и сезонах', () => {
    const current = row({ tags: ['film', 'animation'], seasonsReleased: null });
    const incoming = record({ tags: ['series', 'live-action'], seasonsReleased: 4, nextSeasonNumber: 5 });

    // У тегов и сезонов свои команды: `tag-films` и `fill-seasons`.
    expect(changedFields(current, incoming)).toEqual([]);
  });

  it('не замечает расхождения в дате заведения тайтла', () => {
    const current = row({ createdAt: '2025-03-14' });
    const incoming = record({ createdAt: '2026-08-27' });

    // Дата заведения не меняется задним числом, даже если запись файла её несёт.
    expect(changedFields(current, incoming)).toEqual([]);
  });

  it('не замечает расхождения в материалах агента', () => {
    const current = row({ dossierSearchedAt: '2026-08-22' });
    const incoming = record({ dossierSearchedAt: '2020-01-01', dossierBefore: [] });

    expect(changedFields(current, incoming)).toEqual([]);
  });
});

describe('planRefresh', () => {
  it('молча пропускает тайтл из файла, которого нет в базе', () => {
    const rows = [row()];
    const records = [record({ titleRu: 'Акира', titleOriginal: 'Akira', composer: 'Сёдзи Ямасиро' })];

    // Занести новый тайтл — дело `add-films`.
    expect(planRefresh(rows, records)).toEqual([]);
  });

  it('молча пропускает тайтл из базы, которого нет в файле', () => {
    const rows = [row(), row({ id: 2, titleRu: 'Акира', titleOriginal: 'Akira', composer: null })];
    const records = [record()];

    expect(planRefresh(rows, records)).toEqual([]);
  });

  it('не включает в сводку тайтл, у которого нечего менять', () => {
    expect(planRefresh([row()], [record()])).toEqual([]);
  });

  it('включает в сводку тайтл с изменившимся справочным полем', () => {
    const rows = [row({ composer: null })];
    const records = [record({ composer: 'Кэндзи Каваи' })];

    expect(planRefresh(rows, records)).toEqual([
      {
        titleOriginal: SHELL,
        changes: [{ field: 'composer', from: null, to: 'Кэндзи Каваи' }],
      },
    ]);
  });

  it('не включает в сводку тайтл, у которого разошлось только личное поле', () => {
    const rows = [row({ myRating: 9, tasteStar: true })];
    const records = [record({ myRating: 1, tasteStar: false })];

    expect(planRefresh(rows, records)).toEqual([]);
  });

  it('не включает в сводку тайтл, у которого разошлась только дата заведения', () => {
    const rows = [row({ createdAt: '2025-03-14' })];
    const records = [record({ createdAt: '2026-08-27' })];

    expect(planRefresh(rows, records)).toEqual([]);
  });

  it('сопоставляет по оригинальному названию, а не по русскому', () => {
    // «Призрак в доспехах» 1995 года и одноимённый сериал 2026-го — разные тайтлы
    // с одним русским названием: правило проекта, CLAUDE.md, раздел «Данные».
    const rows = [
      row({ id: 1, titleOriginal: SHELL, composer: null, releaseDate: '1995-11-18' }),
      row({ id: 2, titleOriginal: SHELL_SERIES, composer: null, releaseDate: '2026-01-01' }),
    ];
    const records = [
      record({ titleOriginal: SHELL, composer: 'Кэндзи Каваи' }),
      record({ titleOriginal: SHELL_SERIES, composer: 'Ёсихиро Икэда', releaseDate: '2026-01-01' }),
    ];

    const plan = planRefresh(rows, records);

    expect(plan).toHaveLength(2);
    expect(refreshOf(SHELL, plan)?.changes).toEqual([
      { field: 'composer', from: null, to: 'Кэндзи Каваи' },
    ]);
    expect(refreshOf(SHELL_SERIES, plan)?.changes).toEqual([
      { field: 'composer', from: null, to: 'Ёсихиро Икэда' },
    ]);
  });

  it('не переносит запись одноимённого тайтла на соседа', () => {
    const rows = [
      row({ id: 1, titleOriginal: SHELL, composer: null }),
      row({ id: 2, titleOriginal: SHELL_SERIES, composer: null, releaseDate: '2026-01-01' }),
    ];
    // В файле есть запись только для фильма 1995 года.
    const records = [record({ titleOriginal: SHELL, composer: 'Кэндзи Каваи' })];

    expect(planRefresh(rows, records)).toEqual([
      {
        titleOriginal: SHELL,
        changes: [{ field: 'composer', from: null, to: 'Кэндзи Каваи' }],
      },
    ]);
  });

  it('даёт по записи сводки на каждый изменившийся тайтл', () => {
    const rows = [
      row({ id: 1, titleOriginal: SHELL, composer: null }),
      row({ id: 2, titleRu: 'Акира', titleOriginal: 'Akira', composer: null, imdbId: null }),
      row({ id: 3, titleRu: 'Патлейбор', titleOriginal: 'Patlabor', composer: 'Кэндзи Каваи' }),
    ];
    const records = [
      record({ titleOriginal: SHELL, composer: 'Кэндзи Каваи' }),
      record({
        titleRu: 'Акира',
        titleOriginal: 'Akira',
        composer: 'Сёдзи Ямасиро',
        imdbId: 'tt0094625',
      }),
      // Третий тайтл сходится с базой и в сводку попасть не должен.
      record({ titleRu: 'Патлейбор', titleOriginal: 'Patlabor', composer: 'Кэндзи Каваи' }),
    ];

    const plan = planRefresh(rows, records);

    expect(plan).toHaveLength(2);
    expect(refreshOf(SHELL, plan)?.changes).toEqual([
      { field: 'composer', from: null, to: 'Кэндзи Каваи' },
    ]);
    expect(refreshOf('Akira', plan)?.changes).toHaveLength(2);
    expect(refreshOf('Patlabor', plan)).toBeUndefined();
  });

  it('на пустом корпусе возвращает пустую сводку', () => {
    expect(planRefresh([], [])).toEqual([]);
  });
});
