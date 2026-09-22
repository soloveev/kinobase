// Критерии приёмки 12 и 13 версии v8 (specs/v8/spec.md, раздел «4. Проверка данных»):
// 12 — `npm run check-data` находит все роды проблем в файлах данных;
// 13 — эти тесты написаны отдельным субагентом по спеке, красные до имплементации
//      и зелёные после.
//
// Контракт модуля '@/lib/check-data', зафиксированный этими тестами:
//   type DataProblemCode =
//     | 'unreadable' | 'no-title-ru' | 'no-title-original' | 'duplicate-title-original'
//     | 'orphan-title' | 'tags-mismatch' | 'missing-tags-record'
//     | 'seasons-mismatch' | 'missing-seasons-record' | 'seasons-on-non-series'
//     | 'bad-searched-at' | 'link-not-in-sources'
//     | 'no-created-at' | 'bad-created-at'
//     | 'duplicate-slug' | 'name-not-in-field' | 'unknown-work-title'
//     | 'poster-missing' | 'photo-missing'
//     | 'invalid-tags' | 'invalid-seasons' | 'invalid-dossier' | 'invalid-sources'
//     | 'invalid-person';
//   type DataProblem = { file: string; record: string; code: DataProblemCode; detail?: string };
//   type DataFiles = { films; tags; seasons; dossiers; people: unknown[] };
//   function checkData(files: DataFiles, exists: (path: string) => boolean): DataProblem[];
//
// Чекер отвечает за весь корпус, а не за одну запись, поэтому возвращает список
// проблем, а не код ошибки: владельцу нужен полный перечень, а не первая попавшаяся
// (plan.md, «`check-data` возвращает список, а не код ошибки»). Пустой список = порядок.
//
// Корпус здесь синтетический. Дымового теста «прогнать чекер по настоящим `specs/*`
// и потребовать пустоты» проект не заводит намеренно: он сделал бы `npm test` красным
// из-за данных, а не из-за кода. Живой корпус проверяет сама команда `npm run check-data`
// в предвыкаточном чек-листе (plan.md).
//
// Существование файлов на диске приходит предикатом снаружи — иначе тесты перестали бы
// быть детерминированными (spec.md, раздел 4). Предикат в тестах сверяет хвост пути,
// поэтому чекеру безразлично, передаёт он `/posters/x.jpg`, `public/posters/x.jpg`
// или абсолютный путь; различие рабочего и полноразмерного постера держится на
// `posters/original/` в середине пути.
//
// Дополнение: дата заведения тайтла. Каждая запись `films-data.json` обязана нести
// `createdAt` — ISO-дату 'ГГГГ-ММ-ДД'. Дата принадлежит тайтлу, а не конкретной базе:
// локальная копия и боевая обязаны нести одну и ту же дату, даже если долив на сервер
// случился позже. Поэтому она живёт в файле данных, а не проставляется днём прогона, —
// и поэтому её наличие и форму сторожит `check-data`, как и `searchedAt` у досье.
// Отсюда же и фикстура `film()` ниже несёт корректный `createdAt`: тест, который ломает
// одно поле, иначе ломал бы два сразу.
//
// Два теста ниже помечены как «дефект живой базы»: оба взяты из настоящих поломок,
// которые версия v8 и чинит, — оборванная скобкой инлайн-ссылка в досье «Призрака
// в доспехах» 2026 года и имя композитора, разошедшееся с карточкой на одну букву.
//
// Где спека допускает два чтения, тест это называет прямо и проверяет то, что спека
// задаёт однозначно: факт ровно одной проблемы и её код. Таких мест два — `file`
// у расхождения тегов и у расхождения сезонов: расхождение живёт между двумя файлами,
// и спека не говорит, какой из них назвать виноватым.

import { describe, it, expect } from 'vitest';
import { checkData, type DataFiles, type DataProblem } from '@/lib/check-data';
import type { DossierFragment, DossierSource } from '@/lib/dossier';
import type { Method, WorkNote } from '@/lib/people';

// Формы записей файлов данных — ровно те, что лежат в `specs/*`.

type FilmRecord = {
  titleRu: string;
  titleOriginal: string;
  posterPath: string;
  releaseDate: string | null;
  seasonsReleased: number | null;
  nextSeasonNumber: number | null;
  nextSeasonDate: string | null;
  annotation: string;
  director: string | null;
  producer: string | null;
  screenwriter: string | null;
  composer: string | null;
  soundDesigner: string | null;
  cast: string[];
  tags: string[];
  /** Дата заведения тайтла в базу, ISO 'ГГГГ-ММ-ДД'. Обязательна у каждой записи. */
  createdAt: string;
};

type TagsRecord = { titleRu: string; titleOriginal?: string; tags: string[] };

type SeasonsRecord = {
  titleRu: string;
  titleOriginal?: string;
  seasonsReleased: number | null;
  nextSeasonNumber: number | null;
  nextSeasonDate: string | null;
};

// Дополнение v15 (specs/v15/spec.md, раздел A): у записи досье появилось поле `keys`
// — третий блок, «Важные вещи о фильме». Поле необязательное: отсутствие блока целиком
// — законное состояние (невышедший фильм, досье старой формы до переноса), а вот пустой
// массив рубрик законным не становится ни у одного блока.
type DossierRecord = {
  titleRu: string;
  titleOriginal?: string;
  searchedAt: string;
  before: DossierFragment[];
  keys?: DossierFragment[];
  after: DossierFragment[];
  sources: DossierSource[];
};

type PersonFilmLink = { titleOriginal: string; role: string };

type PhotoCreditRecord = {
  author: string;
  licence: string;
  licenceUrl: string;
  fileUrl: string;
  modified: boolean;
};

type PersonRecord = {
  slug: string;
  nameRu: string;
  photoPath: string | null;
  photoCredit: PhotoCreditRecord | null;
  roles: string[];
  method: Method[];
  workNotes: WorkNote[];
  sources: DossierSource[];
  searchedAt: string;
  films: PersonFilmLink[];
};

// Фабрики корректных записей: каждый тест ломает ровно одно поле. Приём тот же,
// что у `makeFilm` и `makePerson` в tests/helpers.ts.

const GHOST = 'Ghost in the Shell';
const CURSE = 'The Curse';

function film(overrides: Partial<FilmRecord> = {}): FilmRecord {
  return {
    titleRu: 'Призрак в доспехах',
    titleOriginal: GHOST,
    posterPath: '/posters/ghost-in-the-shell.jpg',
    releaseDate: '1995-11-18',
    seasonsReleased: null,
    nextSeasonNumber: null,
    nextSeasonDate: null,
    annotation: 'Майор Кусанаги ведёт охоту на хакера, взламывающего чужие кибермозги.',
    director: 'Мамору Осии',
    producer: 'Ясухиро Такэда',
    screenwriter: 'Кадзунори Ито',
    composer: 'Кэндзи Каваи',
    soundDesigner: null,
    cast: ['Атсуко Танака', 'Акио Оцука'],
    tags: ['film', 'animation', 'sci-fi', 'auteur'],
    createdAt: '2026-08-22',
    ...overrides,
  };
}

/** Запись без даты заведения: в файле данных поля может не быть вовсе. */
function withoutCreatedAt(source: FilmRecord): FilmRecord {
  const copy: Partial<FilmRecord> = { ...source };
  delete copy.createdAt;
  return copy as FilmRecord;
}

/** Сериал: тег `series`, вышедшие сезоны и запись в seasons-data.json. */
function series(overrides: Partial<FilmRecord> = {}): FilmRecord {
  return film({
    titleRu: 'Проклятие',
    titleOriginal: CURSE,
    posterPath: '/posters/the-curse.jpg',
    releaseDate: '2023-11-10',
    composer: null,
    tags: ['series', 'live-action', 'drama'],
    seasonsReleased: 1,
    ...overrides,
  });
}

function tagsRecord(source: FilmRecord, overrides: Partial<TagsRecord> = {}): TagsRecord {
  return {
    titleRu: source.titleRu,
    titleOriginal: source.titleOriginal,
    tags: [...source.tags],
    ...overrides,
  };
}

function seasonsRecord(source: FilmRecord, overrides: Partial<SeasonsRecord> = {}): SeasonsRecord {
  return {
    titleRu: source.titleRu,
    titleOriginal: source.titleOriginal,
    seasonsReleased: source.seasonsReleased,
    nextSeasonNumber: source.nextSeasonNumber,
    nextSeasonDate: source.nextSeasonDate,
    ...overrides,
  };
}

/** Единственный адрес, на который опирается досье-образец: он же лежит в источниках. */
const DOSSIER_LINK = 'https://www.midnighteye.com/interviews/mamoru-oshii';

function dossierSource(overrides: Partial<DossierSource> = {}): DossierSource {
  return {
    publication: 'Midnight Eye',
    title: 'Интервью с Мамору Осии',
    url: DOSSIER_LINK,
    ...overrides,
  };
}

function dossier(overrides: Partial<DossierRecord> = {}): DossierRecord {
  return {
    titleRu: 'Призрак в доспехах',
    titleOriginal: GHOST,
    searchedAt: '2026-08-22',
    before: [
      {
        key: 'why',
        body: [
          {
            type: 'ul',
            items: [
              `**Аниме, задавшее словарь киберпанка на двадцать лет вперёд** — о чём Осии говорит в [интервью Midnight Eye](${DOSSIER_LINK}).`,
            ],
          },
        ],
      },
    ],
    after: [
      {
        key: 'themes',
        body: [{ type: 'p', text: 'Фильм спрашивает, что остаётся от человека, когда тело сменное.' }],
      },
    ],
    sources: [dossierSource()],
    ...overrides,
  };
}

/** Блок ключей: ровно одна рубрика `keys`, тело — один список ровно из семи пунктов
 *  (правка 15.09.2026; прежде вилка была «пять—семь»). Фикстура по умолчанию
 *  корректна, тест ломает ровно то, что проверяет. */
function keysBlock(count = 7): DossierFragment[] {
  return [
    {
      key: 'keys',
      body: [
        {
          type: 'ul',
          items: Array.from(
            { length: count },
            (_, index) => `**Ключ номер ${index + 1}.** Раскрытие мысли в двух предложениях.`,
          ),
        },
      ],
    },
  ];
}

/** Блок ключей заданного объёма: семь пунктов, сумма видимых знаков — ровно `total`.
 *  Видимые знаки — знаки пунктов с пробелами, без разметки полужирного. */
function keysOfLength(total: number): DossierFragment[] {
  const rest = total - 3 * 7; // «Л. » в каждом пункте — три видимых знака
  const each = Math.floor(rest / 7);
  const extra = rest % 7;

  return [
    {
      key: 'keys',
      body: [
        {
          type: 'ul',
          items: Array.from(
            { length: 7 },
            (_, index) => `**Л.** ${'а'.repeat(each + (index === 0 ? extra : 0))}`,
          ),
        },
      ],
    },
  ];
}

const METHOD_LINK = 'https://www.animenewsnetwork.com/interview/kenji-kawai';

function method(overrides: Partial<Method> = {}): Method {
  return {
    title: null,
    theses: [
      {
        title: 'Музыка ставится раньше монтажа',
        body: [
          {
            type: 'p',
            text: `Каваи пишет тему до сборки эпизода — он сам объясняет это в [интервью ANN](${METHOD_LINK}).`,
          },
        ],
      },
    ],
    ...overrides,
  };
}

function workNote(overrides: Partial<WorkNote> = {}): WorkNote {
  return {
    title: 'Призрак в доспехах',
    year: 1995,
    titleOriginal: GHOST,
    method: [{ type: 'p', text: 'Свадебная песня на старояпонском вместо симфонической темы.' }],
    facts: [],
    ...overrides,
  };
}

function person(overrides: Partial<PersonRecord> = {}): PersonRecord {
  return {
    slug: 'kenji-kawai',
    nameRu: 'Кэндзи Каваи',
    // Правка v11 от 25.08.2026. Снимок и указание автора существуют только вместе:
    // валидатор персоналии не пропускает ни фотографию без кредита, ни кредит без
    // фотографии. Фикстура корректна по умолчанию, поэтому кредит здесь есть — тест,
    // который ломает одно поле, иначе ломал бы два сразу.
    photoPath: '/people/kenji-kawai.jpg',
    photoCredit: {
      author: 'Niccolò Caranti',
      licence: 'CC BY-SA 4.0',
      licenceUrl: 'https://creativecommons.org/licenses/by-sa/4.0/',
      fileUrl: 'https://commons.wikimedia.org/wiki/File:Kenji_Kawai.jpg',
      modified: true,
    },
    roles: ['composer'],
    method: [method()],
    workNotes: [workNote()],
    sources: [
      dossierSource({ publication: 'Anime News Network', title: 'Интервью с Кэндзи Каваи', url: METHOD_LINK }),
    ],
    searchedAt: '2026-08-22',
    films: [{ titleOriginal: GHOST, role: 'composer' }],
    ...overrides,
  };
}

type CorpusInput = {
  films?: FilmRecord[];
  tags?: TagsRecord[];
  seasons?: SeasonsRecord[];
  dossiers?: DossierRecord[];
  people?: PersonRecord[];
};

/** Корпус, у которого по умолчанию всё сходится: записи тегов и сезонов выводятся
 *  из самих тайтлов, поэтому расхождение может появиться только там, где тест его
 *  задал руками. */
function corpus(input: CorpusInput = {}): DataFiles {
  const films = input.films ?? [film()];
  return {
    films,
    tags: input.tags ?? films.map((item) => tagsRecord(item)),
    seasons: input.seasons ?? films.filter((item) => item.tags.includes('series')).map((item) => seasonsRecord(item)),
    dossiers: input.dossiers ?? [],
    people: input.people ?? [],
  };
}

/** Всё на месте: постеры, фотографии — любой путь. */
const anything = (): boolean => true;

/** Предикат по хвосту пути: `'posters/ghost-in-the-shell.jpg'` совпадёт
 *  и с `public/posters/ghost-in-the-shell.jpg`, и с абсолютным путём, но не
 *  с `public/posters/original/ghost-in-the-shell.jpg`. */
function onlyThese(present: string[]): (path: string) => boolean {
  return (path) => {
    const normal = path.replace(/\\/g, '/');
    return present.some((tail) => normal.endsWith(tail));
  };
}

const BOTH_POSTERS = ['posters/ghost-in-the-shell.jpg', 'posters/original/ghost-in-the-shell.jpg'];

/** Ровно одна проблема — иначе тест валится с полным перечнем найденного. */
function only(problems: DataProblem[]): DataProblem {
  if (problems.length !== 1) {
    throw new Error(
      `ожидалась ровно одна проблема, получено ${problems.length}: ${JSON.stringify(problems)}`,
    );
  }
  return problems[0];
}

/** Ровно одна проблема в названном файле. Нужна там, где сломанное поле — само
 *  оригинальное название: ключ перестаёт разрешаться, и последствия в других файлах
 *  неизбежны, а спека их не описывает. */
function onlyFrom(problems: DataProblem[], file: string): DataProblem {
  const found = problems.filter((problem) => problem.file === file);
  if (found.length !== 1) {
    throw new Error(
      `в «${file}» ожидалась ровно одна проблема, получено ${found.length}: ${JSON.stringify(problems)}`,
    );
  }
  return found[0];
}

describe('checkData: чистый корпус', () => {
  it('на корпусе без изъянов возвращает пустой список', () => {
    expect(checkData(corpus(), anything)).toEqual([]);
  });

  it('пустой корпус — тоже порядок: проверять нечего', () => {
    expect(
      checkData({ films: [], tags: [], seasons: [], dossiers: [], people: [] }, anything),
    ).toEqual([]);
  });

  it('корпус со всеми пятью файлами — фильм, сериал, досье и персоналия — молчит', () => {
    const files = corpus({
      films: [film(), series()],
      dossiers: [dossier()],
      people: [person()],
    });
    expect(checkData(files, anything)).toEqual([]);
  });
});

describe('checkData: файлы', () => {
  // Спека: «файлы — все пять читаются и содержат массив». Не-массив приходит
  // с границы системы, поэтому его форму приходится подделывать приведением
  // через `unknown` — сам тип `DataFiles` такого значения не допускает.
  it('называет файл, в котором лежит не массив', () => {
    const broken = { ...corpus(), dossiers: 'не массив' as unknown as unknown[] };
    const problem = only(checkData(broken, anything));
    expect(problem.file).toBe('dossier-data.json');
    expect(problem.code).toBe('unreadable');
  });
});

describe('checkData: тайтлы', () => {
  it('пустое русское название — no-title-ru', () => {
    const problem = only(checkData(corpus({ films: [film({ titleRu: '   ' })] }), anything));
    expect(problem.file).toBe('films-data.json');
    expect(problem.code).toBe('no-title-ru');
  });

  it('пустое оригинальное название — no-title-original', () => {
    const broken = film({ titleOriginal: '' });
    const problems = checkData(
      { films: [broken], tags: [tagsRecord(broken)], seasons: [], dossiers: [], people: [] },
      anything,
    );
    expect(onlyFrom(problems, 'films-data.json').code).toBe('no-title-original');
  });

  it('два тайтла с одним оригинальным названием — duplicate-title-original, названный один раз', () => {
    const first = film({ titleRu: 'Призрак в доспехах' });
    const second = film({ titleRu: 'Призрак в доспехах: Сингулярность' });
    const files: DataFiles = {
      films: [first, second],
      tags: [tagsRecord(first)],
      seasons: [],
      dossiers: [],
      people: [],
    };
    const problem = only(checkData(files, anything));
    expect(problem.file).toBe('films-data.json');
    expect(problem.code).toBe('duplicate-title-original');
    expect(problem.record).toBe(GHOST);
  });

  it('одинаковые русские названия при разных оригинальных — норма', () => {
    // Правило проекта: «Призрак в доспехах» 1995 года и одноимённый сериал 2026-го
    // существуют оба, и ключ у них оригинальное название, а не русское.
    const movie = film();
    const show = series({ titleRu: 'Призрак в доспехах', titleOriginal: 'Ghost in the Shell 2026' });
    expect(checkData(corpus({ films: [movie, show] }), anything)).toEqual([]);
  });

  it('тег вне словаря — invalid-tags', () => {
    const broken = film({ tags: ['film', 'animation', 'sci-fi', 'cyberpunk-noir'] });
    const problem = only(checkData(corpus({ films: [broken] }), anything));
    expect(problem.file).toBe('films-data.json');
    expect(problem.code).toBe('invalid-tags');
    expect(problem.record).toBe(GHOST);
  });

  it('поля сезонов у тайтла без тега series — invalid-seasons', () => {
    // `validateSeasons` отвечает на это кодом 'not-series'; здесь важно, что чекер
    // прогоняет валидатор по каждому тайтлу и сообщает ровно об одной проблеме.
    const broken = film({ seasonsReleased: 2 });
    const files: DataFiles = {
      films: [broken],
      tags: [tagsRecord(broken)],
      seasons: [],
      dossiers: [],
      people: [],
    };
    const problem = only(checkData(files, anything));
    expect(problem.file).toBe('films-data.json');
    expect(problem.code).toBe('invalid-seasons');
  });

  it('объявленный сезон не следующий по счёту — invalid-seasons', () => {
    const broken = series({ seasonsReleased: 1, nextSeasonNumber: 3, nextSeasonDate: '2027-01' });
    const problem = only(checkData(corpus({ films: [broken] }), anything));
    expect(problem.file).toBe('films-data.json');
    expect(problem.code).toBe('invalid-seasons');
  });
});

describe('checkData: дата заведения тайтла', () => {
  // Дата принадлежит тайтлу, а не базе: она едет из файла данных одинаково
  // и в локальную копию, и в боевую. Поэтому её отсутствие или кривая форма —
  // дефект файла, и ловить его должен `check-data`, а не глаз владельца.
  // Прецедент рядом — `bad-searched-at` у досье.

  it('корректная дата вида ГГГГ-ММ-ДД проблем не даёт', () => {
    expect(checkData(corpus({ films: [film({ createdAt: '2025-01-09' })] }), anything)).toEqual([]);
  });

  it('поля даты нет вовсе — no-created-at', () => {
    const problem = only(checkData(corpus({ films: [withoutCreatedAt(film())] }), anything));
    expect(problem.file).toBe('films-data.json');
    expect(problem.code).toBe('no-created-at');
    expect(problem.record).toBe(GHOST);
  });

  it('дата null — no-created-at', () => {
    // Данные приходят из JSON, который пишет агент: на этой границе типам верить
    // нельзя, поэтому чужое значение подделывается приведением через `unknown`.
    const broken = film({ createdAt: null as unknown as string });
    expect(only(checkData(corpus({ films: [broken] }), anything)).code).toBe('no-created-at');
  });

  it('пустая строка вместо даты — no-created-at', () => {
    const broken = film({ createdAt: '' });
    expect(only(checkData(corpus({ films: [broken] }), anything)).code).toBe('no-created-at');
  });

  it('не строка вместо даты — no-created-at', () => {
    const broken = film({ createdAt: 20260822 as unknown as string });
    expect(only(checkData(corpus({ films: [broken] }), anything)).code).toBe('no-created-at');
  });

  it('дата в русской записи «24.08.2026» — bad-created-at', () => {
    const broken = film({ createdAt: '24.08.2026' });
    const problem = only(checkData(corpus({ films: [broken] }), anything));
    expect(problem.file).toBe('films-data.json');
    expect(problem.code).toBe('bad-created-at');
    expect(problem.record).toBe(GHOST);
    // Как и у `bad-searched-at`, подробность — само отвергнутое значение:
    // владельцу нужно увидеть, что именно лежит в файле.
    expect(problem.detail).toBe('24.08.2026');
  });

  it('дата без ведущих нулей «2026-8-4» — bad-created-at', () => {
    const broken = film({ createdAt: '2026-8-4' });
    expect(only(checkData(corpus({ films: [broken] }), anything)).code).toBe('bad-created-at');
  });

  it('дата до месяца «2026-08» — bad-created-at: у даты заведения точность до дня', () => {
    const broken = film({ createdAt: '2026-08' });
    expect(only(checkData(corpus({ films: [broken] }), anything)).code).toBe('bad-created-at');
  });

  it('называет ту запись, в которой дата испорчена, а не соседнюю', () => {
    const healthy = film();
    const broken = series({ createdAt: '2026-08' });
    const problem = only(checkData(corpus({ films: [healthy, broken] }), anything));
    expect(problem.code).toBe('bad-created-at');
    expect(problem.record).toBe(CURSE);
  });
});

describe('checkData: постеры', () => {
  it('нет рабочего файла постера — poster-missing', () => {
    const exists = onlyThese(['posters/original/ghost-in-the-shell.jpg']);
    const problem = only(checkData(corpus(), exists));
    expect(problem.file).toBe('films-data.json');
    expect(problem.code).toBe('poster-missing');
    expect(problem.record).toBe(GHOST);
  });

  it('нет полноразмерного файла постера — тоже poster-missing', () => {
    const exists = onlyThese(['posters/ghost-in-the-shell.jpg']);
    const problem = only(checkData(corpus(), exists));
    expect(problem.file).toBe('films-data.json');
    expect(problem.code).toBe('poster-missing');
  });

  it('оба файла на месте — молчит', () => {
    expect(checkData(corpus(), onlyThese(BOTH_POSTERS))).toEqual([]);
  });
});

describe('checkData: ключи сходятся', () => {
  it('запись тегов на тайтл, которого нет среди фильмов, — orphan-title', () => {
    const known = film();
    const files: DataFiles = {
      films: [known],
      tags: [tagsRecord(known), tagsRecord(known, { titleRu: 'Небывальщина', titleOriginal: 'Nowhere Film', tags: ['film', 'live-action'] })],
      seasons: [],
      dossiers: [],
      people: [],
    };
    const problem = only(checkData(files, anything));
    expect(problem.file).toBe('tags-data.json');
    expect(problem.code).toBe('orphan-title');
    expect(problem.record).toBe('Nowhere Film');
  });

  it('запись тегов без оригинального названия — orphan-title', () => {
    const known = film();
    const nameless: TagsRecord = { titleRu: 'Небывальщина', tags: ['film', 'live-action'] };
    const files: DataFiles = {
      films: [known],
      tags: [tagsRecord(known), nameless],
      seasons: [],
      dossiers: [],
      people: [],
    };
    const problem = only(checkData(files, anything));
    expect(problem.file).toBe('tags-data.json');
    expect(problem.code).toBe('orphan-title');
  });

  it('запись о сезонах на неизвестный тайтл — orphan-title', () => {
    const show = series();
    const files: DataFiles = {
      films: [show],
      tags: [tagsRecord(show)],
      seasons: [
        seasonsRecord(show),
        { titleRu: 'Небывальщина', titleOriginal: 'Nowhere Show', seasonsReleased: 1, nextSeasonNumber: null, nextSeasonDate: null },
      ],
      dossiers: [],
      people: [],
    };
    const problem = only(checkData(files, anything));
    expect(problem.file).toBe('seasons-data.json');
    expect(problem.code).toBe('orphan-title');
    expect(problem.record).toBe('Nowhere Show');
  });

  it('досье на неизвестный тайтл — orphan-title', () => {
    const files = corpus({
      dossiers: [dossier({ titleRu: 'Небывальщина', titleOriginal: 'Nowhere Film' })],
    });
    const problem = only(checkData(files, anything));
    expect(problem.file).toBe('dossier-data.json');
    expect(problem.code).toBe('orphan-title');
    expect(problem.record).toBe('Nowhere Film');
  });

  it('персоналия, связанная с неизвестным тайтлом, — orphan-title', () => {
    const files = corpus({
      people: [person({ films: [{ titleOriginal: 'Nowhere Film', role: 'composer' }] })],
    });
    const problem = only(checkData(files, anything));
    expect(problem.file).toBe('people-data.json');
    expect(problem.code).toBe('orphan-title');
    expect(problem.record).toBe('kenji-kawai');
  });
});

describe('checkData: теги', () => {
  // Расхождение живёт между двумя файлами, и спека не называет виноватого:
  // проверяется факт ровно одной проблемы, её код и запись, а `file` — что это
  // один из двух участников.
  it('набор тегов разошёлся с films-data — tags-mismatch', () => {
    const known = film();
    const files: DataFiles = {
      films: [known],
      tags: [tagsRecord(known, { tags: ['film', 'animation', 'sci-fi'] })],
      seasons: [],
      dossiers: [],
      people: [],
    };
    const problem = only(checkData(files, anything));
    expect(problem.code).toBe('tags-mismatch');
    expect(problem.record).toBe(GHOST);
    expect(['films-data.json', 'tags-data.json']).toContain(problem.file);
    expect(problem.detail).toContain('auteur');
  });

  it('теги сравниваются как множества, а не как списки: порядок не важен', () => {
    const known = film();
    const files: DataFiles = {
      films: [known],
      tags: [tagsRecord(known, { tags: ['auteur', 'sci-fi', 'animation', 'film'] })],
      seasons: [],
      dossiers: [],
      people: [],
    };
    expect(checkData(files, anything)).toEqual([]);
  });

  it('у тайтла нет записи в tags-data — missing-tags-record', () => {
    const files: DataFiles = {
      films: [film()],
      tags: [],
      seasons: [],
      dossiers: [],
      people: [],
    };
    const problem = only(checkData(files, anything));
    expect(problem.file).toBe('tags-data.json');
    expect(problem.code).toBe('missing-tags-record');
    expect(problem.record).toBe(GHOST);
  });
});

describe('checkData: сезоны', () => {
  it('число вышедших сезонов разошлось с films-data — seasons-mismatch', () => {
    const show = series({ seasonsReleased: 2 });
    const files: DataFiles = {
      films: [show],
      tags: [tagsRecord(show)],
      seasons: [seasonsRecord(show, { seasonsReleased: 1 })],
      dossiers: [],
      people: [],
    };
    const problem = only(checkData(files, anything));
    expect(problem.code).toBe('seasons-mismatch');
    expect(problem.record).toBe(CURSE);
    expect(['films-data.json', 'seasons-data.json']).toContain(problem.file);
  });

  it('дата следующего сезона разошлась с films-data — seasons-mismatch', () => {
    const show = series({ seasonsReleased: 1, nextSeasonNumber: 2, nextSeasonDate: '2027-01' });
    const files: DataFiles = {
      films: [show],
      tags: [tagsRecord(show)],
      seasons: [seasonsRecord(show, { nextSeasonDate: '2027-03' })],
      dossiers: [],
      people: [],
    };
    const problem = only(checkData(files, anything));
    expect(problem.code).toBe('seasons-mismatch');
    expect(problem.record).toBe(CURSE);
  });

  it('у сериала нет записи в seasons-data — missing-seasons-record', () => {
    const show = series();
    const files: DataFiles = {
      films: [show],
      tags: [tagsRecord(show)],
      seasons: [],
      dossiers: [],
      people: [],
    };
    const problem = only(checkData(files, anything));
    expect(problem.file).toBe('seasons-data.json');
    expect(problem.code).toBe('missing-seasons-record');
    expect(problem.record).toBe(CURSE);
  });

  it('запись о сезонах у тайтла без тега series — seasons-on-non-series', () => {
    // Поля записи совпадают с полями тайтла, поэтому расхождения тут нет:
    // дефект в самом существовании записи у не-сериала.
    const movie = film();
    const files: DataFiles = {
      films: [movie],
      tags: [tagsRecord(movie)],
      seasons: [seasonsRecord(movie)],
      dossiers: [],
      people: [],
    };
    const problem = only(checkData(files, anything));
    expect(problem.file).toBe('seasons-data.json');
    expect(problem.code).toBe('seasons-on-non-series');
    expect(problem.record).toBe(GHOST);
  });

  it('у фильма без тега series записи нет — и это норма', () => {
    expect(checkData(corpus({ films: [film()] }), anything)).toEqual([]);
  });
});

describe('checkData: досье', () => {
  it('дата поиска не вида ГГГГ-ММ-ДД — bad-searched-at', () => {
    const files = corpus({ dossiers: [dossier({ searchedAt: '22.08.2026' })] });
    const problem = only(checkData(files, anything));
    expect(problem.file).toBe('dossier-data.json');
    expect(problem.code).toBe('bad-searched-at');
    expect(problem.record).toBe(GHOST);
  });

  it('дата поиска без ведущего нуля — bad-searched-at', () => {
    const files = corpus({ dossiers: [dossier({ searchedAt: '2026-8-22' })] });
    expect(only(checkData(files, anything)).code).toBe('bad-searched-at');
  });

  it('дата поиска до месяца — bad-searched-at: у досье точность до дня', () => {
    const files = corpus({ dossiers: [dossier({ searchedAt: '2026-08' })] });
    expect(only(checkData(files, anything)).code).toBe('bad-searched-at');
  });

  it('рубрика с пустым телом в блоке «Зачем смотреть» — invalid-dossier', () => {
    const files = corpus({ dossiers: [dossier({ before: [{ key: 'why', body: [] }] })] });
    const problem = only(checkData(files, anything));
    expect(problem.file).toBe('dossier-data.json');
    expect(problem.code).toBe('invalid-dossier');
    expect(problem.record).toBe(GHOST);
  });

  it('рубрика чужого блока в «После просмотра» — invalid-dossier', () => {
    const files = corpus({
      dossiers: [
        dossier({
          after: [{ key: 'why', body: [{ type: 'p', text: 'Рубрика из другого блока.' }] }],
        }),
      ],
    });
    expect(only(checkData(files, anything)).code).toBe('invalid-dossier');
  });

  it('незакрытое выделение в абзаце — invalid-dossier', () => {
    const files = corpus({
      dossiers: [
        dossier({
          after: [{ key: 'themes', body: [{ type: 'p', text: 'Тело **без закрывающей пары.' }] }],
        }),
      ],
    });
    expect(only(checkData(files, anything)).code).toBe('invalid-dossier');
  });

  // v15, блок ключей. Проверяется он тем же путём, что два соседних: чекер зовёт
  // `validateDossierBlock('keys', …)` и пересказывает его код в подробности вида
  // `keys: <код>`. Своей логики формы у чекера нет и быть не должно — правило одно
  // и живёт в валидаторе (specs/v15/spec.md, раздел A).
  it('корректный блок ключей проблемой не считается', () => {
    const files = corpus({ dossiers: [dossier({ keys: keysBlock() })] });
    expect(checkData(files, anything)).toEqual([]);
  });

  it('блока ключей в записи нет вовсе — это законное состояние', () => {
    expect(checkData(corpus({ dossiers: [dossier()] }), anything)).toEqual([]);
  });

  it('тело блока ключей не из одного списка — invalid-dossier с кодом keys-shape', () => {
    const files = corpus({
      dossiers: [dossier({ keys: [{ key: 'keys', body: [{ type: 'p', text: 'Проза.' }] }] })],
    });
    const problem = only(checkData(files, anything));
    expect(problem.file).toBe('dossier-data.json');
    expect(problem.code).toBe('invalid-dossier');
    expect(problem.record).toBe(GHOST);
    expect(problem.detail).toBe('keys: keys-shape');
  });

  // Правка спеки 07.09.2026: вводка перед списком законна — на переносе строгая
  // форма отвергла оговорку «разбор написан по семи вышедшим сериям».
  it('абзац-вводка рядом со списком ключей проблемой не считается', () => {
    const [fragment] = keysBlock();
    const files = corpus({
      dossiers: [
        dossier({
          keys: [{ key: 'keys', body: [{ type: 'p', text: 'Вводка.' }, ...fragment.body] }],
        }),
      ],
    });
    expect(checkData(files, anything)).toEqual([]);
  });

  it('подзаголовок в блоке ключей — keys-shape: делить в блоке нечего', () => {
    const [fragment] = keysBlock();
    const files = corpus({
      dossiers: [
        dossier({
          keys: [{ key: 'keys', body: [{ type: 'h', text: 'Подзаголовок' }, ...fragment.body] }],
        }),
      ],
    });
    expect(only(checkData(files, anything)).detail).toBe('keys: keys-shape');
  });

  // Правка 15.09.2026 (рефакторинг, находка 6): вилка «пять—семь» сведена к точному
  // числу. Правило письма — «ровно семь вещей» — стояло только в скрипте порции,
  // а на пути в базу его ничто не сторожило; теперь стоит на всех пяти путях
  // наполнения, потому что чекер зовёт тот же валидатор.
  it.each([4, 5, 6, 8])('%i пунктов в блоке ключей — invalid-dossier с кодом keys-count', (count) => {
    const files = corpus({ dossiers: [dossier({ keys: keysBlock(count) })] });
    expect(only(checkData(files, anything)).detail).toBe('keys: keys-count');
  });

  it('семь пунктов в блоке ключей — норма', () => {
    const files = corpus({ dossiers: [dossier({ keys: keysBlock(7) })] });
    expect(checkData(files, anything)).toEqual([]);
  });

  // Потолок объёма — вторая половина той же правки. Проверяет его чекер не своей
  // логикой, а тем же `validateDossierBlock`: правило одно и живёт в валидаторе.
  // Объём — сумма видимых знаков всех пунктов, без разметки полужирного.
  it('блок ключей длиннее потолка — invalid-dossier с кодом keys-length', () => {
    const files = corpus({ dossiers: [dossier({ keys: keysOfLength(6100) })] });
    expect(only(checkData(files, anything)).detail).toBe('keys: keys-length');
  });

  it('блок ключей ровно на потолке проблемой не считается', () => {
    const files = corpus({ dossiers: [dossier({ keys: keysOfLength(6059) })] });
    expect(checkData(files, anything)).toEqual([]);
  });

  it('пустой список рубрик в блоке ключей — invalid-dossier', () => {
    // Отсутствие блока законно, пустой блок — нет: иначе появилось бы третье
    // неотличимое состояние (specs/v15/spec.md, критерий приёмки 3).
    const files = corpus({ dossiers: [dossier({ keys: [] })] });
    const problem = only(checkData(files, anything));
    expect(problem.code).toBe('invalid-dossier');
    expect(problem.detail).toBe('keys: empty');
  });

  it('чужая рубрика на месте ключей — invalid-dossier', () => {
    const files = corpus({
      dossiers: [dossier({ keys: [{ key: 'themes', body: keysBlock()[0].body }] })],
    });
    const problem = only(checkData(files, anything));
    expect(problem.code).toBe('invalid-dossier');
    expect(problem.detail).toBe('keys: foreign');
  });

  it('источник без издания — invalid-sources', () => {
    const files = corpus({
      dossiers: [dossier({ sources: [dossierSource({ publication: '  ' })] })],
    });
    const problem = only(checkData(files, anything));
    expect(problem.file).toBe('dossier-data.json');
    expect(problem.code).toBe('invalid-sources');
    expect(problem.record).toBe(GHOST);
  });

  it('источник с адресом не на http — invalid-sources', () => {
    const files = corpus({
      dossiers: [
        dossier({
          before: [
            { key: 'why', body: [{ type: 'p', text: 'Абзац без единой ссылки.' }] },
          ],
          sources: [dossierSource({ url: 'www.midnighteye.com/interviews' })],
        }),
      ],
    });
    expect(only(checkData(files, anything)).code).toBe('invalid-sources');
  });
});

describe('checkData: адреса инлайн-ссылок досье', () => {
  it('адрес из тела досье, которого нет в источниках, — link-not-in-sources', () => {
    const orphanLink = 'https://variety.com/1996/film/reviews/ghost-in-the-shell';
    const files = corpus({
      dossiers: [
        dossier({
          after: [
            {
              key: 'reception',
              body: [
                { type: 'p', text: `Обзор [Variety](${orphanLink}) вышел в год американского проката.` },
              ],
            },
          ],
        }),
      ],
    });
    const problem = only(checkData(files, anything));
    expect(problem.file).toBe('dossier-data.json');
    expect(problem.code).toBe('link-not-in-sources');
    expect(problem.record).toBe(GHOST);
    expect(problem.detail).toContain(orphanLink);
  });

  it('адрес из пункта списка проверяется наравне с адресом из абзаца', () => {
    const orphanLink = 'https://www.imdb.com/title/tt0113568/awards';
    const files = corpus({
      dossiers: [
        dossier({
          before: [
            {
              key: 'why',
              body: [{ type: 'ul', items: [`Список наград — [на IMDb](${orphanLink}).`] }],
            },
          ],
        }),
      ],
    });
    expect(only(checkData(files, anything)).code).toBe('link-not-in-sources');
  });

  // Дефект живой базы (spec.md, раздел 7): в досье «Призрака в доспехах» 2026 года
  // инлайн-ссылка оборвана скобкой. Грамматика `parseInline` останавливает адрес
  // на первой закрывающей скобке, поэтому из текста извлекается обрубок
  // «…Some_Review_(2026», которого в списке источников нет, — а сам список выглядит
  // безупречно. Ни `validateDossierBlock`, ни `validateSources` этого не видят:
  // ловит только сверка адресов тела со списком.
  it('адрес со скобкой внутри обрывается грамматикой и не находится в источниках', () => {
    const wholeLink = 'https://www.uk-anime.net/articles/Some_Review_(2026)';
    const files = corpus({
      dossiers: [
        dossier({
          after: [
            {
              key: 'critique',
              body: [
                { type: 'p', text: `Разбор [UK Anime Network](${wholeLink}) читает финал иначе.` },
              ],
            },
          ],
          sources: [
            dossierSource(),
            dossierSource({ publication: 'UK Anime Network', title: 'Разбор финала', url: wholeLink }),
          ],
        }),
      ],
    });
    const problem = only(checkData(files, anything));
    expect(problem.file).toBe('dossier-data.json');
    expect(problem.code).toBe('link-not-in-sources');
    expect(problem.record).toBe(GHOST);
  });

  // v15. Ссылки блока ключей собираются наравне с прочими: список источников один
  // на всё досье, и адрес, которого в нём нет, — тот же дефект, где бы он ни стоял.
  it('адрес из блока ключей, которого нет в источниках, — link-not-in-sources', () => {
    const orphanLink = 'https://www.newyorker.com/magazine/blue-eye-samurai';
    const files = corpus({
      dossiers: [
        dossier({
          keys: [
            {
              key: 'keys',
              body: [
                {
                  type: 'ul',
                  items: [
                    `**Первый ключ.** О нём пишет [The New Yorker](${orphanLink}).`,
                    '**Второй ключ.** Раскрытие мысли.',
                    '**Третий ключ.** Раскрытие мысли.',
                    '**Четвёртый ключ.** Раскрытие мысли.',
                    '**Пятый ключ.** Раскрытие мысли.',
                    '**Шестой ключ.** Раскрытие мысли.',
                    '**Седьмой ключ.** Раскрытие мысли.',
                  ],
                },
              ],
            },
          ],
        }),
      ],
    });
    const problem = only(checkData(files, anything));
    expect(problem.file).toBe('dossier-data.json');
    expect(problem.code).toBe('link-not-in-sources');
    expect(problem.record).toBe(GHOST);
    expect(problem.detail).toContain(orphanLink);
  });

  it('адрес из блока ключей, стоящий в источниках, проблемой не считается', () => {
    const files = corpus({
      dossiers: [
        dossier({
          keys: [
            {
              key: 'keys',
              body: [
                {
                  type: 'ul',
                  items: [
                    `**Первый ключ.** Об этом [интервью Midnight Eye](${DOSSIER_LINK}).`,
                    '**Второй ключ.** Раскрытие мысли.',
                    '**Третий ключ.** Раскрытие мысли.',
                    '**Четвёртый ключ.** Раскрытие мысли.',
                    '**Пятый ключ.** Раскрытие мысли.',
                    '**Шестой ключ.** Раскрытие мысли.',
                    '**Седьмой ключ.** Раскрытие мысли.',
                  ],
                },
              ],
            },
          ],
        }),
      ],
    });
    expect(checkData(files, anything)).toEqual([]);
  });

  it('адрес, присутствующий в источниках, проблемой не считается', () => {
    expect(checkData(corpus({ dossiers: [dossier()] }), anything)).toEqual([]);
  });
});

describe('checkData: персоналии', () => {
  it('запись, отклонённая валидатором персоны, — invalid-person', () => {
    const files = corpus({ people: [person({ roles: [], films: [] })] });
    const problem = only(checkData(files, anything));
    expect(problem.file).toBe('people-data.json');
    expect(problem.code).toBe('invalid-person');
    expect(problem.record).toBe('kenji-kawai');
  });

  it('slug не машинного вида — invalid-person', () => {
    const files = corpus({ people: [person({ slug: 'Кэндзи Каваи', films: [] })] });
    expect(only(checkData(files, anything)).code).toBe('invalid-person');
  });

  it('два человека с одним slug — duplicate-slug, названный один раз', () => {
    const files = corpus({ people: [person(), person()] });
    const problem = only(checkData(files, anything));
    expect(problem.file).toBe('people-data.json');
    expect(problem.code).toBe('duplicate-slug');
    expect(problem.record).toBe('kenji-kawai');
  });

  it('разные slug при одинаковом имени — норма', () => {
    const files = corpus({
      films: [film()],
      people: [person(), person({ slug: 'kenji-kawai-jr', films: [] })],
    });
    expect(checkData(files, anything)).toEqual([]);
  });

  // Дефект живой базы: правило проекта требует точного совпадения имени
  // («Кэндзи Каваи» и «Кэндзи Кавай» — вопрос, на который машина ответит
  // неправильно молча, и лучше не дать ссылку, чем дать не ту). Связь, которая
  // никуда не ведёт, хуже отсутствующей: имя в карточке останется текстом,
  // а база будет уверена, что ссылка есть.
  it('имя, разошедшееся с полем фильма на одну букву, — name-not-in-field', () => {
    const files = corpus({
      films: [film({ composer: 'Кэндзи Кавай' })],
      people: [person({ nameRu: 'Кэндзи Каваи' })],
    });
    const problem = only(checkData(files, anything));
    expect(problem.file).toBe('people-data.json');
    expect(problem.code).toBe('name-not-in-field');
    expect(problem.record).toBe('kenji-kawai');
  });

  it('роль режиссёра сверяется с полем director', () => {
    const files = corpus({
      films: [film({ director: 'Мамору Осии' })],
      people: [
        person({
          slug: 'mamoru-oshii',
          nameRu: 'Хаяо Миядзаки',
          roles: ['director'],
          films: [{ titleOriginal: GHOST, role: 'director' }],
          workNotes: [],
        }),
      ],
    });
    expect(only(checkData(files, anything)).code).toBe('name-not-in-field');
  });

  it('роль актёра сверяется со списком ролей, а не с текстовым полем', () => {
    const clean = corpus({
      films: [film({ cast: ['Атсуко Танака', 'Акио Оцука'] })],
      people: [
        person({
          slug: 'atsuko-tanaka',
          nameRu: 'Атсуко Танака',
          roles: ['actor'],
          films: [{ titleOriginal: GHOST, role: 'actor' }],
          workNotes: [],
        }),
      ],
    });
    expect(checkData(clean, anything)).toEqual([]);

    const broken = corpus({
      films: [film({ cast: ['Акио Оцука'] })],
      people: [
        person({
          slug: 'atsuko-tanaka',
          nameRu: 'Атсуко Танака',
          roles: ['actor'],
          films: [{ titleOriginal: GHOST, role: 'actor' }],
          workNotes: [],
        }),
      ],
    });
    expect(only(checkData(broken, anything)).code).toBe('name-not-in-field');
  });

  it('роль звукорежиссёра сверяется с полем soundDesigner', () => {
    const files = corpus({
      films: [film({ soundDesigner: 'Кадзухиро Вакабаяси' })],
      people: [
        person({
          slug: 'kazuhiro-wakabayashi',
          nameRu: 'Кадзухиро Вакабаяси',
          roles: ['sound'],
          films: [{ titleOriginal: GHOST, role: 'sound' }],
          workNotes: [],
        }),
      ],
    });
    expect(checkData(files, anything)).toEqual([]);
  });

  it('у роли без отдельного поля карточки имя не сверяется', () => {
    // Оператор, монтажёр, художник, аниматор и автор оригинала в карточке
    // отдельной строкой не записаны — проверять не по чему.
    const files = corpus({
      films: [film()],
      people: [
        person({
          slug: 'masamune-shirow',
          nameRu: 'Масамунэ Сиро',
          roles: ['author'],
          films: [{ titleOriginal: GHOST, role: 'author' }],
          workNotes: [],
        }),
      ],
    });
    expect(checkData(files, anything)).toEqual([]);
  });

  it('пустое поле фильма при заявленной роли — name-not-in-field', () => {
    const files = corpus({
      films: [film({ composer: null })],
      people: [person()],
    });
    expect(only(checkData(files, anything)).code).toBe('name-not-in-field');
  });

  it('разбор работы с оригинальным названием вне базы — unknown-work-title', () => {
    const files = corpus({
      people: [person({ workNotes: [workNote({ title: 'Оборотни', titleOriginal: 'Jin-Roh' })] })],
    });
    const problem = only(checkData(files, anything));
    expect(problem.file).toBe('people-data.json');
    expect(problem.code).toBe('unknown-work-title');
    expect(problem.record).toBe('kenji-kawai');
  });

  it('разбор работы без оригинального названия — норма: работы вне базы это большинство', () => {
    const files = corpus({
      people: [person({ workNotes: [workNote({ title: 'Оборотни', year: 1999, titleOriginal: null })] })],
    });
    expect(checkData(files, anything)).toEqual([]);
  });

  it('фотографии нет на диске — photo-missing', () => {
    const exists = onlyThese(BOTH_POSTERS);
    const files = corpus({ people: [person()] });
    const problem = only(checkData(files, exists));
    expect(problem.file).toBe('people-data.json');
    expect(problem.code).toBe('photo-missing');
    expect(problem.record).toBe('kenji-kawai');
  });

  it('фотография не задана — проверять нечего', () => {
    const exists = onlyThese(BOTH_POSTERS);
    const files = corpus({ people: [person({ photoPath: null, photoCredit: null })] });
    expect(checkData(files, exists)).toEqual([]);
  });

  // Критерий приёмки 10 версии v11. Само правило живёт в валидаторе персоналии
  // и покрыто tests/people.test.ts; здесь проверяется, что проверка файлов данных
  // о нём знает — то есть что снимок без указания автора не доедет до базы через
  // `npm run check-data`, а не только через тесты.
  it('снимок без указания автора — invalid-person с кодом photo-credit', () => {
    const exists = anything;
    const files = corpus({ people: [person({ photoCredit: null })] });
    const problem = only(checkData(files, exists));
    expect(problem.file).toBe('people-data.json');
    expect(problem.code).toBe('invalid-person');
    expect(problem.detail).toBe('photo-credit');
  });

  it('адрес из тезиса метода, которого нет в источниках, — link-not-in-sources', () => {
    const files = corpus({
      people: [person({ sources: [dossierSource()] })],
    });
    const problem = only(checkData(files, anything));
    expect(problem.file).toBe('people-data.json');
    expect(problem.code).toBe('link-not-in-sources');
    expect(problem.record).toBe('kenji-kawai');
    expect(problem.detail).toContain(METHOD_LINK);
  });

  it('адрес из разбора работы, которого нет в источниках, — link-not-in-sources', () => {
    const orphanLink = 'https://www.animenewsnetwork.com/review/innocence';
    const files = corpus({
      people: [
        person({
          workNotes: [
            workNote({
              method: [{ type: 'p', text: `Разбор темы — [в рецензии ANN](${orphanLink}).` }],
            }),
          ],
        }),
      ],
    });
    const problem = only(checkData(files, anything));
    expect(problem.file).toBe('people-data.json');
    expect(problem.code).toBe('link-not-in-sources');
    expect(problem.detail).toContain(orphanLink);
  });
});

describe('checkData: список проблем', () => {
  it('называет каждую сломанную запись отдельно, а не останавливается на первой', () => {
    const first = film({ titleRu: '  ' });
    const second = series({ titleRu: '  ' });
    const problems = checkData(corpus({ films: [first, second] }), anything);
    expect(problems).toHaveLength(2);
    expect(problems.every((problem: DataProblem) => problem.code === 'no-title-ru')).toBe(true);
  });

  it('собирает проблемы из разных файлов в один список', () => {
    const known = film();
    const files: DataFiles = {
      films: [known],
      tags: [],
      seasons: [],
      dossiers: [dossier({ searchedAt: 'вчера' })],
      people: [],
    };
    const problems = checkData(files, anything);
    expect(problems.map((problem: DataProblem) => problem.code).sort()).toEqual(
      ['bad-searched-at', 'missing-tags-record'].sort(),
    );
  });
});
