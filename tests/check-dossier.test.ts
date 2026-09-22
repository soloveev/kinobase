// Критерии приёмки версии v10 (specs/v10/spec.md, раздел «`npm run check-dossier`»):
// пять кодов ошибок, которые забирает у механического прохода скрипт. Тесты написаны
// отдельным субагентом по спеке, до имплементации: красные сейчас, зелёные после.
//
// Контракт модуля '@/lib/check-dossier', зафиксированный этими тестами:
//   type DossierProblemCode =
//     | 'rhyme-no-director' | 'latin-in-fields' | 'legal-star-no-footnote'
//     | 'quote-after-heading' | 'title-not-in-spellings';
//   type DossierProblem = {
//     title: string;              // titleRu тайтла, к которому относится нарушение
//     code: DossierProblemCode;
//     where: string;              // место: имя поля карточки, адрес рубрики
//                                 // `<блок>/<ключ>` либо имя блока
//     detail?: string;            // что именно сработало
//   };
//   type DossierInput = {
//     dossiers: unknown[];             // specs/v4/dossier-data.json
//     films: unknown[];                // specs/v1/films-data.json
//     facts: Record<string, string>;   // titleOriginal → текст research/<slug>/facts.md
//   };
//   function checkDossier(input: DossierInput): DossierProblem[] | null;
//
// `null` при успехе, иначе перечень нарушений — так сказано в спеке и такова конвенция
// проекта для валидаторов (CLAUDE.md, «Код»). Перечень, а не первый код, потому что
// скрипт отвечает за весь корпус: владельцу нужен полный список, а не первая находка.
//
// Чтения с диска внутри нет: разобранный JSON приходит массивами, тексты архивов —
// картой. Граница та же, что у `checkData` с предикатом `exists` и у `checkFacts`
// с картой «имя файла → текст». Карта архивов ключуется по `titleOriginal`, а не
// по имени папки: тайтл в этом проекте опознаётся по оригинальному названию (CLAUDE.md,
// «Данные»), а сопоставление папки `research/<slug>` с записью делает `scripts/`.
// Тайтла нет в карте — архива нет, и проверка 5 для него молчит (спека, критерий 5).
//
// Данные приходят из JSON, который пишет агент, поэтому вход объявлен как `unknown[]`:
// на границе типам не верим. Записи с чужими полями чекер обязан пережить.
//
// Корпус здесь синтетический — по тем же основаниям, что у `tests/check-data.test.ts`:
// дымовой прогон по настоящим `specs/*` сделал бы `npm test` красным из-за данных,
// а не из-за кода. Живой корпус проверяет сама команда `npm run check-dossier`.
//
// Где спека допускает два чтения, тест говорит об этом прямо и проверяет то, что
// однозначно. Таких мест два, и оба разобраны ниже по одному правилу: **ложная
// тревога дороже пропуска, потому что скрипту верят на слово** (spec.md, конец
// раздела). Поэтому у каждого кода здесь стоит не только падающий случай, но и
// законный похожий, который падать не должен.

import { describe, it, expect } from 'vitest';
import { checkDossier, type DossierProblem } from '@/lib/check-dossier';
import type { DossierNode } from '@/lib/dossier';

// Формы записей — ровно те, что лежат в `specs/v1/films-data.json`
// и `specs/v4/dossier-data.json`.

type FilmRecord = {
  titleRu: string;
  titleOriginal: string;
  posterPath: string;
  annotation: string;
  director: string | null;
  producer: string | null;
  screenwriter: string | null;
  composer: string | null;
  soundDesigner: string | null;
  cast: string[];
  tags: string[];
  imdbId: string | null;
};

type Fragment = { key: string; body: DossierNode[] };

// Дополнение v15 (specs/v15/spec.md, раздел A): третий блок досье «Важные вещи
// о фильме» лежит в поле `keys`. Поле необязательное — блока может не быть вовсе,
// и это законное состояние.
type DossierRecord = {
  titleRu: string;
  titleOriginal: string;
  searchedAt: string;
  before: Fragment[];
  keys?: Fragment[];
  after: Fragment[];
  sources: { publication: string; title: string; url: string }[];
};

const TITLE_RU = 'Бугония';
const TITLE_ORIGINAL = 'Bugonia';

function film(overrides: Partial<FilmRecord> = {}): FilmRecord {
  const base: FilmRecord = {
    titleRu: TITLE_RU,
    titleOriginal: TITLE_ORIGINAL,
    posterPath: '/posters/bugonia.jpg',
    annotation:
      'Двое одержимых теориями заговора кузенов похищают главу корпорации, уверенные, ' +
      'что она — пришелец. Ремейк корейского фильма Чан Джун-хвана.',
    director: 'Йоргос Лантимос',
    producer: 'Эд Гуини',
    screenwriter: 'Уилл Трейси',
    composer: 'Джерскин Фендрикс',
    soundDesigner: 'Джонни Бёрн',
    cast: ['Эмма Стоун', 'Джесси Племонс'],
    tags: ['film', 'live-action', 'drama'],
    imdbId: 'tt29603959',
  };
  return { ...base, ...overrides };
}

function dossier(overrides: Partial<DossierRecord> = {}): DossierRecord {
  return {
    titleRu: TITLE_RU,
    titleOriginal: TITLE_ORIGINAL,
    searchedAt: '2026-08-20',
    before: [{ key: 'why', body: [{ type: 'p', text: 'Первый ремейк в фильмографии автора.' }] }],
    after: [],
    sources: [{ publication: 'Variety', title: 'Разбор', url: 'https://variety.com/a' }],
    ...overrides,
  };
}

/** Рубрика «Место фильма» с подзаголовком «Рифмы» — так она набрана в живых данных. */
function place(items: string[], heading = 'Рифмы'): Fragment {
  return {
    key: 'place',
    body: [
      { type: 'h', text: 'В фильмографии автора' },
      { type: 'p', text: 'Пятый полнометражный фильм режиссёра и первый его ремейк.' },
      { type: 'h', text: heading },
      { type: 'ul', items },
    ],
  };
}

type Input = {
  dossiers: unknown[];
  films: unknown[];
  facts: Record<string, string>;
};

const check = (input: Partial<Input> = {}): DossierProblem[] =>
  checkDossier({ dossiers: [], films: [], facts: {}, ...input }) ?? [];

const codes = (input: Partial<Input> = {}): string[] =>
  check(input).map((problem) => problem.code);

/** Досье с одной рубрикой блока «После просмотра» и карточкой к нему. */
const withAfter = (fragment: Fragment, facts: Record<string, string> = {}): Partial<Input> => ({
  dossiers: [dossier({ after: [fragment] })],
  films: [film()],
  facts,
});

/** То же для блока ключей: рубрика в нём одна и называется `keys` (specs/v15/spec.md,
 *  раздел A). Механические проверки к ней те же, что к рубрикам двух соседних блоков, —
 *  правовая рамка, поломанная разметка, русские написания чужих названий. */
const withKeys = (nodes: DossierNode[], facts: Record<string, string> = {}): Partial<Input> => ({
  dossiers: [dossier({ keys: [{ key: 'keys', body: nodes }] })],
  films: [film()],
  facts,
});

describe('checkDossier: корпус без изъянов', () => {
  it('пустой ввод — null: скрипт проверяет то, что есть', () => {
    expect(checkDossier({ dossiers: [], films: [], facts: {} })).toBeNull();
  });

  it('корректные карточка и досье — null', () => {
    expect(
      checkDossier({
        dossiers: [dossier({ after: [place(['**«Мизери»** (Роб Райнер, 1990) — фигурой пленника.'])] })],
        films: [film()],
        facts: {},
      }),
    ).toBeNull();
  });

  it('карточка без досье проверяется всё равно: справочные поля живут отдельно', () => {
    expect(codes({ films: [film()], dossiers: [] })).toEqual([]);
  });

  it('нарушение названо тайтлом', () => {
    const problems = check({ films: [film({ director: 'Yorgos Lanthimos' })] });
    expect(problems).toHaveLength(1);
    expect(problems[0].title).toBe(TITLE_RU);
  });

  it('несколько тайтлов: каждое нарушение при своём', () => {
    const problems = check({
      films: [
        film({ director: 'Yorgos Lanthimos' }),
        film({ titleRu: 'Одиссея', titleOriginal: 'The Odyssey', director: 'Кристофер Нолан' }),
      ],
    });
    expect(problems.map((problem) => problem.title)).toEqual([TITLE_RU]);
  });

  it('чужие поля в записи чекер переживает: вход — граница системы', () => {
    expect(() => check({ films: [{ titleRu: TITLE_RU }], dossiers: [{}] })).not.toThrow();
  });
});

// Критерий 1. В рубрике `place`, под подзаголовком со словом «Рифм», строка называет
// фильм в кавычках-ёлочках, но не несёт следом скобку с именем и годом
// (research/DOSSIER-FORMAT.md, «Рифмы — с режиссёром и годом»).
//
// Первое место с двумя чтениями. Спека говорит «строка называет фильм», но фильм
// в ёлочках в строке бывает назван не один раз: рифма именуется полужирным в начале,
// а дальше по строке то же название может встретиться в косвенном падеже
// («…как в «Новом кошмаре» мастера ужасов Уэса Крэйвена») и рядом могут стоять
// названия, о которых речь идёт мимоходом. Требовать скобку от каждых ёлочек значит
// завалить проверку ложными тревогами — а они дороже пропуска. Поэтому проверяется
// **название, набранное полужирным**: именно так формат велит именовать рифму,
// и именно так набраны все рифмы в живых данных.
describe('checkDossier: rhyme-no-director', () => {
  it('название с режиссёром и годом — рифма в порядке', () => {
    const items = ['**«Дуэль»** (Стивен Спилберг, 1971) — чистым ужасом преследования.'];
    expect(codes(withAfter(place(items)))).not.toContain('rhyme-no-director');
  });

  it('название без скобки — rhyme-no-director', () => {
    const items = ['**«Дуэль»** — чистым ужасом преследования без объяснения причин.'];
    expect(codes(withAfter(place(items)))).toContain('rhyme-no-director');
  });

  it('скобка с одним годом, без имени, — rhyme-no-director', () => {
    const items = ['**«Дуэль»** (1971) — чистым ужасом преследования.'];
    expect(codes(withAfter(place(items)))).toContain('rhyme-no-director');
  });

  it('скобка с одним именем, без года, — rhyme-no-director', () => {
    const items = ['**«Дуэль»** (Стивен Спилберг) — чистым ужасом преследования.'];
    expect(codes(withAfter(place(items)))).toContain('rhyme-no-director');
  });

  it('две картины в одной строке, у каждой своя скобка, — законно', () => {
    // Живой случай из досье «Киберпанка»: две рифмы объединены в один пункт.
    const items = [
      '**«Светлое будущее»** (Джон Ву, 1986) и **«Лицо со шрамом»** (Брайан Де Пальма, 1983) — жанровым каркасом.',
    ];
    expect(codes(withAfter(place(items)))).not.toContain('rhyme-no-director');
  });

  it('вторая картина без скобки — rhyme-no-director', () => {
    const items = [
      '**«Светлое будущее»** (Джон Ву, 1986) и **«Лицо со шрамом»** — жанровым каркасом.',
    ];
    expect(codes(withAfter(place(items)))).toContain('rhyme-no-director');
  });

  it('повторное упоминание того же фильма внутри строки скобки не требует', () => {
    // Живой случай из досье «Миазмы»: рифма названа полужирным со скобкой, а дальше
    // по строке то же название идёт в косвенном падеже. Ложная тревога здесь была бы
    // дороже пропуска.
    const items = [
      '**«Новый кошмар»** (Уэс Крэйвен, 1994) — тем, что франшиза протекает в реальный ' +
        'мир своих создателей. Героиня успевает сказать, что нет, это не рассуждение фильма ' +
        'о самом себе, как в «Новом кошмаре» мастера ужасов Уэса Крэйвена.',
    ];
    expect(codes(withAfter(place(items)))).not.toContain('rhyme-no-director');
  });

  it('строка, не называющая фильма полужирным, не проверяется', () => {
    const items = ['Полезно отметить, что сравнения держатся на частичном сходстве.'];
    expect(codes(withAfter(place(items)))).not.toContain('rhyme-no-director');
  });

  it('абзац после списка рифм, называющий фильм в ёлочках, — законен', () => {
    // Живой случай: замыкающий абзац «все эти сравнения держатся на частичном
    // сходстве… единственная позиция, у которой с «Бугонией» общего больше».
    const fragment: Fragment = {
      key: 'place',
      body: [
        { type: 'h', text: 'Рифмы' },
        { type: 'ul', items: ['**«Мизери»** (Роб Райнер, 1990) — фигурой пленника.'] },
        {
          type: 'p',
          text: 'Честно будет отметить, что все эти сравнения держатся на частичном сходстве: ' +
            'ближе всех «Мизери», и то отчасти.',
        },
      ],
    };
    expect(codes(withAfter(fragment))).not.toContain('rhyme-no-director');
  });

  it('под другим подзаголовком рубрики правило не действует', () => {
    // «В фильмографии автора» перечисляет картины прозой, и скобка там не обязательна.
    const fragment: Fragment = {
      key: 'place',
      body: [
        { type: 'h', text: 'В фильмографии автора' },
        {
          type: 'p',
          text: 'После **«Бедных-несчастных»** режиссёр впервые берётся за чужой сценарий.',
        },
      ],
    };
    expect(codes(withAfter(fragment))).not.toContain('rhyme-no-director');
  });

  it('подзаголовок со словом «Рифм» в другой форме правило включает', () => {
    const items = ['**«Дуэль»** — чистым ужасом преследования.'];
    expect(codes(withAfter(place(items, 'Рифмы и переклички')))).toContain('rhyme-no-director');
  });

  it('в других рубриках досье правило не действует', () => {
    const fragment: Fragment = {
      key: 'themes',
      body: [
        { type: 'h', text: 'Рифмы мотива' },
        { type: 'ul', items: ['**«Мизери»** — тем же мотивом пленника.'] },
      ],
    };
    expect(codes(withAfter(fragment))).not.toContain('rhyme-no-director');
  });

  it('место нарушения называет рубрику', () => {
    const items = ['**«Дуэль»** — чистым ужасом преследования.'];
    const found = check(withAfter(place(items))).find(
      (problem) => problem.code === 'rhyme-no-director',
    );
    expect(found?.where).toContain('place');
  });
});

// Критерий 2. Латиница в справочных полях карточки: `director`, `producer`,
// `screenwriter`, `soundDesigner`, `composer`, `cast`. Латиница в названии, аннотации
// и тегах законна. Правило родом из research/VERIFICATION.md, «Написание без
// прецедента — решение, а не факт»: кириллицу выбирает заход, а не Кинопоиск.
describe('checkDossier: latin-in-fields', () => {
  it.each(['director', 'producer', 'screenwriter', 'soundDesigner', 'composer'] as const)(
    'латиница в поле «%s» — latin-in-fields',
    (field) => {
      expect(codes({ films: [film({ [field]: 'Yorgos Lanthimos' })] })).toContain(
        'latin-in-fields',
      );
    },
  );

  it('латиница в одном имени состава — latin-in-fields', () => {
    expect(codes({ films: [film({ cast: ['Эмма Стоун', 'Jesse Plemons'] })] })).toContain(
      'latin-in-fields',
    );
  });

  it('латинская буква посреди кириллического имени тоже ловится', () => {
    // Опечатка вида «Йоргос Лaнтимос» с латинской «a» — ровно тот случай, ради
    // которого проверка механическая, а не глазами.
    expect(codes({ films: [film({ director: 'Йоргос Лaнтимос' })] })).toContain('latin-in-fields');
  });

  it('кириллические имена во всех полях — законно', () => {
    expect(codes({ films: [film()] })).not.toContain('latin-in-fields');
  });

  it('латиница в оригинальном названии законна', () => {
    expect(codes({ films: [film({ titleOriginal: 'Bugonia' })] })).not.toContain(
      'latin-in-fields',
    );
  });

  it('латиница в аннотации законна', () => {
    const annotation = 'Ремейк корейского фильма Save the Green Planet! о похищении.';
    expect(codes({ films: [film({ annotation })] })).not.toContain('latin-in-fields');
  });

  it('теги латиницей законны: это ключи, а не имена', () => {
    expect(codes({ films: [film({ tags: ['film', 'live-action', 'drama'] })] })).not.toContain(
      'latin-in-fields',
    );
  });

  it('латиница в прочих служебных полях карточки законна', () => {
    // `imdbId` вида `tt29603959` и `posterPath` вида `/posters/bugonia.jpg` — адреса,
    // а не написания имён; ложная тревога на них обесценила бы проверку.
    expect(codes({ films: [film({ imdbId: 'tt29603959' })] })).not.toContain('latin-in-fields');
  });

  it('пустое поле не ловится', () => {
    expect(codes({ films: [film({ composer: null, soundDesigner: null, cast: [] })] })).not.toContain(
      'latin-in-fields',
    );
  });

  it('дефисы, точки и «ё» латиницей не считаются', () => {
    const cast = ['Пон Джун-хо', 'Ким Со-ми', 'Э. Стоун'];
    expect(codes({ films: [film({ cast })] })).not.toContain('latin-in-fields');
  });

  it('место нарушения называет поле', () => {
    const found = check({ films: [film({ composer: 'Jerskin Fendrix' })] }).find(
      (problem) => problem.code === 'latin-in-fields',
    );
    expect(found?.where).toBe('composer');
  });
});

// Критерий 3. В блоке досье стоит звёздочка правовой рамки — одиночная `*`, а не пара
// разметки, — а сноски постоянной формулировки из research/LEGAL.md в том же блоке нет.
// Формулировка сноски постоянная и меняться не должна, поэтому сверяется буквально.
describe('checkDossier: legal-star-no-footnote', () => {
  const FOOTNOTE =
    '* Пометка, которой требует местное право.';

  const starred: DossierNode = {
    type: 'p',
    text: 'Критика читает кибернетическое тело героини как аллегорию телесного перехода*.',
  };

  it('звёздочка и сноска в одной рубрике — законно', () => {
    const fragment: Fragment = { key: 'themes', body: [starred, { type: 'p', text: FOOTNOTE }] };
    expect(codes(withAfter(fragment))).not.toContain('legal-star-no-footnote');
  });

  it('звёздочка без сноски — legal-star-no-footnote', () => {
    const fragment: Fragment = { key: 'themes', body: [starred] };
    expect(codes(withAfter(fragment))).toContain('legal-star-no-footnote');
  });

  it('сноска в соседней рубрике того же блока — законно', () => {
    // LEGAL.md: сноска одна на блок и ставится после первой рубрики, где тема поднята.
    const dossiers = [
      dossier({
        after: [
          { key: 'themes', body: [starred] },
          { key: 'characters', body: [{ type: 'p', text: FOOTNOTE }] },
        ],
      }),
    ];
    expect(codes({ dossiers, films: [film()] })).not.toContain('legal-star-no-footnote');
  });

  it('сноска в другом блоке звёздочку не закрывает', () => {
    // Блоки раскрываются по одному, и читатель «Зачем смотреть» сноски в разборе
    // не увидит (LEGAL.md, «в каждом блоке, где есть звёздочка, — своя сноска»).
    const dossiers = [
      dossier({
        before: [{ key: 'why', body: [starred] }],
        after: [{ key: 'themes', body: [{ type: 'p', text: FOOTNOTE }] }],
      }),
    ];
    expect(codes({ dossiers, films: [film()] })).toContain('legal-star-no-footnote');
  });

  it('полужирная разметка звёздочкой правовой рамки не считается', () => {
    // Ключевой случай ложной тревоги: `**…**` — разметка, а не сноска.
    const fragment: Fragment = {
      key: 'themes',
      body: [
        { type: 'p', text: '**Ремейк** снят по корейскому фильму и **спорит** с ним.' },
        { type: 'ul', items: ['**Первый ремейк** в фильмографии режиссёра.'] },
      ],
    };
    expect(codes(withAfter(fragment))).not.toContain('legal-star-no-footnote');
  });

  it('текст без звёздочек вовсе — законно', () => {
    const fragment: Fragment = {
      key: 'themes',
      body: [{ type: 'p', text: 'Фильм говорит о вере в заговор как о форме горя.' }],
    };
    expect(codes(withAfter(fragment))).not.toContain('legal-star-no-footnote');
  });

  it('звёздочка в пункте списка ловится наравне с абзацем', () => {
    const fragment: Fragment = {
      key: 'why',
      body: [{ type: 'ul', items: ['**Первый фильм** режиссёра о телесном переходе*.'] }],
    };
    expect(codes({ dossiers: [dossier({ before: [fragment] })], films: [film()] })).toContain(
      'legal-star-no-footnote',
    );
  });

  it('звёздочка в пункте списка со сноской в том же блоке — законно', () => {
    const dossiers = [
      dossier({
        before: [
          {
            key: 'why',
            body: [
              { type: 'ul', items: ['**Первый фильм** режиссёра о телесном переходе*.'] },
              { type: 'p', text: FOOTNOTE },
            ],
          },
        ],
      }),
    ];
    expect(codes({ dossiers, films: [film()] })).not.toContain('legal-star-no-footnote');
  });

  it('одна проблема на блок, сколько бы звёздочек в нём ни стояло', () => {
    const dossiers = [
      dossier({
        after: [
          { key: 'themes', body: [starred] },
          { key: 'characters', body: [starred] },
        ],
      }),
    ];
    const found = check({ dossiers, films: [film()] }).filter(
      (problem) => problem.code === 'legal-star-no-footnote',
    );
    expect(found).toHaveLength(1);
  });

  it('место нарушения называет блок', () => {
    const dossiers = [dossier({ before: [{ key: 'why', body: [starred] }] })];
    const found = check({ dossiers, films: [film()] }).find(
      (problem) => problem.code === 'legal-star-no-footnote',
    );
    expect(found?.where).toBe('before');
  });
});

// Правка от 26.08.2026. Звёздочка правовой рамки, попавшая внутрь пары `**…**`,
// ломает разметку молча: в строке
// «**…и вне гендерного деления*, — и авторы приняли оба.**» звёздочек нечётное число,
// регексп полужирного на ней не срабатывает, `hasLegalStar` видит одиночную `*` —
// и проверка сноски проходит **именно потому, что разметка сломана**. Читателю уехал
// бы сырой markdown. Тот же класс дефекта, ради которого заведён `link-in-bold`:
// поломка, которую видно только в браузере, ловится кодом до выкатки.
//
// Проверка смотрит на разметку, а не на сноску, поэтому включается в обоих блоках
// и независимо от того, есть ли рядом сноска. Фикстуры ниже сноску несут — так
// выглядел живой дефект: без неё нарушение нашла бы и старая проверка.
describe('checkDossier: legal-star-in-bold', () => {
  const FOOTNOTE =
    '* Пометка, которой требует местное право.';

  /** Звёздочка внутри полужирного: пара `**…**` разорвана, разметка не сработает. */
  const BROKEN =
    '**После выхода появились разные прочтения героини — и как женщины, ' +
    'и вне гендерного деления*, — и авторы приняли оба.**';

  /** То же содержание, набранное правильно: полужирное закрыто до звёздочки. */
  const CLEAN =
    '**Авторы приняли оба прочтения.** Одни читают героиню так, другие вне ' +
    'гендерного деления*, и спор продолжается.';

  const inWhy = (...nodes: DossierNode[]): Partial<Input> => ({
    dossiers: [dossier({ before: [{ key: 'why', body: nodes }] })],
    films: [film()],
  });

  it('звёздочка внутри полужирного — legal-star-in-bold', () => {
    expect(codes(inWhy({ type: 'p', text: BROKEN }, { type: 'p', text: FOOTNOTE }))).toContain(
      'legal-star-in-bold',
    );
  });

  it('поломка в пункте списка ловится наравне с абзацем', () => {
    expect(codes(inWhy({ type: 'ul', items: [BROKEN] }, { type: 'p', text: FOOTNOTE }))).toContain(
      'legal-star-in-bold',
    );
  });

  it('сноска поломку не оправдывает: старая проверка на ней молчит', () => {
    // Живой случай: сноска на месте, `legal-star-no-footnote` не срабатывает — и не
    // срабатывает именно потому, что пара `**` не собралась.
    expect(codes(inWhy({ type: 'p', text: BROKEN }, { type: 'p', text: FOOTNOTE }))).not.toContain(
      'legal-star-no-footnote',
    );
  });

  it('место нарушения называет рубрику, а подробность — начало строки', () => {
    const found = check(inWhy({ type: 'p', text: BROKEN }, { type: 'p', text: FOOTNOTE })).find(
      (problem) => problem.code === 'legal-star-in-bold',
    );

    expect(found?.where).toBe('before/why');
    expect(found?.detail).toBeTruthy();
    expect(BROKEN.startsWith(found?.detail ?? ' ')).toBe(true);
  });

  it('звёздочка вне полужирного — законно', () => {
    expect(codes(inWhy({ type: 'p', text: CLEAN }, { type: 'p', text: FOOTNOTE }))).toEqual([]);
  });

  it('сама строка сноски нарушением не считается', () => {
    expect(codes(inWhy({ type: 'p', text: FOOTNOTE }))).toEqual([]);
  });

  it('правильно набранное полужирное без звёздочек — законно', () => {
    expect(
      codes(
        inWhy(
          { type: 'p', text: '**Ремейк** снят по корейскому фильму и **спорит** с ним.' },
          { type: 'ul', items: ['**Первый ремейк** в фильмографии режиссёра.'] },
        ),
      ),
    ).toEqual([]);
  });

  it('звёздочка без сноски по-прежнему legal-star-no-footnote, а не поломка разметки', () => {
    const found = codes(
      inWhy({ type: 'p', text: 'Критика читает героиню вне гендерного деления*.' }),
    );

    expect(found).toContain('legal-star-no-footnote');
    expect(found).not.toContain('legal-star-in-bold');
  });
});

// Критерий 4. Узел `quote` сразу после узла `h`. Правило уже держит валидатор
// `src/lib/dossier.ts`; скрипт лишь переносит отчёт о нём в общий вывод, чтобы
// проход не искал его отдельно.
describe('checkDossier: quote-after-heading', () => {
  const quote: DossierNode = {
    type: 'quote',
    text: 'Я хотел, чтобы зритель сам не знал, кому верить.',
    author: 'Йоргос Лантимос, режиссёр',
  };

  it('врезка сразу под заголовком темы — quote-after-heading', () => {
    const fragment: Fragment = { key: 'themes', body: [{ type: 'h', text: 'Вера' }, quote] };
    expect(codes(withAfter(fragment))).toContain('quote-after-heading');
  });

  it('врезка после абзаца — законно', () => {
    const fragment: Fragment = {
      key: 'themes',
      body: [{ type: 'h', text: 'Вера' }, { type: 'p', text: 'Фильм говорит о вере.' }, quote],
    };
    expect(codes(withAfter(fragment))).not.toContain('quote-after-heading');
  });

  it('врезка первым узлом тела — законно: заголовка перед ней нет', () => {
    const fragment: Fragment = { key: 'themes', body: [quote, { type: 'p', text: 'Так и вышло.' }] };
    expect(codes(withAfter(fragment))).not.toContain('quote-after-heading');
  });

  it('врезка после списка — законно', () => {
    const fragment: Fragment = {
      key: 'themes',
      body: [{ type: 'h', text: 'Вера' }, { type: 'ul', items: ['Первое.', 'Второе.'] }, quote],
    };
    expect(codes(withAfter(fragment))).not.toContain('quote-after-heading');
  });

  it('заголовок без врезки — законно', () => {
    const fragment: Fragment = {
      key: 'themes',
      body: [{ type: 'h', text: 'Вера' }, { type: 'p', text: 'Фильм говорит о вере.' }],
    };
    expect(codes(withAfter(fragment))).not.toContain('quote-after-heading');
  });

  it('в блоке «Зачем смотреть» ловится так же', () => {
    const fragment: Fragment = { key: 'why', body: [{ type: 'h', text: 'Замысел' }, quote] };
    expect(codes({ dossiers: [dossier({ before: [fragment] })], films: [film()] })).toContain(
      'quote-after-heading',
    );
  });

  it('место нарушения называет рубрику', () => {
    const fragment: Fragment = { key: 'themes', body: [{ type: 'h', text: 'Вера' }, quote] };
    const found = check(withAfter(fragment)).find(
      (problem) => problem.code === 'quote-after-heading',
    );
    expect(found?.where).toContain('themes');
  });

  it('прочие изъяны разметки досье — не забота этого скрипта', () => {
    // Оборванная ссылка и пустой абзац — работа `check-data` (`invalid-dossier`).
    // Здесь у них нет своего кода, и подменять чужой они не должны.
    const fragment: Fragment = {
      key: 'themes',
      body: [{ type: 'p', text: 'Разбор [Variety](оборвано' }],
    };
    expect(codes(withAfter(fragment))).toEqual([]);
  });
});

// Критерий 5. Русское название чужого фильма, названное в тексте с режиссёром и годом,
// не имеет строки в разделе написаний `research/<slug>/facts.md`. Проверяется только
// там, где архив есть. Правило родом из research/VERIFICATION.md: в досье «Бугонии»
// корейский первоисточник восемь раз назван «Спасти планету!» вместо «Спасти зелёную
// планету!», и не заметил этого никто.
//
// Второе место с двумя чтениями, и разбирается оно тем же правилом: ложная тревога
// дороже пропуска.
//
// Первое: «названное в тексте» читается как **названное полужирным** — той формой,
// которой формат велит именовать картину. Название, помянутое прозой, стоит в косвенном
// падеже («…после «Прометея» (Ридли Скотт, 2012)»), а строка таблицы держит именительный,
// и сверка строк дала бы тревогу на каждом втором упоминании. Стеммера в проекте нет,
// и заводить его ради этой проверки — та самая эвристика, которой спека велит избегать.
//
// Второе: «раздел написаний» опознаётся по строке таблицы, а не по заголовку раздела.
// Ключ рубрики `написание` вводится этой же версией, и ни в одном существующем архиве
// его пока нет: там написания стоят под заголовком «Русские написания имён» с рубрикой
// `справка`. Требовать нового ключа от старых архивов значит требовать переписывания
// девяти папок, чего десятая версия делать отказалась (spec.md, «Задним числом ничего
// не применяется»). Поэтому строка есть — значит написание заведено.
describe('checkDossier: title-not-in-spellings', () => {
  const HEAD = '| Утверждение | Статус | Оговорка | Источники | Спойлер | Рубрики | Цитата |';
  const RULE = '|---|---|---|---|---|---|---|';

  /** Таблица написаний архива: русское название первоисточника заведено строкой. */
  const spelling = (claim: string, rubric = 'написание'): string =>
    [
      '# «Бугония» — сводная таблица фактов',
      '',
      '## Русские написания',
      '',
      HEAD,
      RULE,
      `| ${claim} | сообщается | написание | \`ctx-a.md\` | нет | ${rubric} | — |`,
      '',
    ].join('\n');

  const KOREAN = 'Save the Green Planet! — «Спасти зелёную планету!» (Чан Джун-хван, 2003)';

  const rhyme = (title: string): Fragment =>
    place([`**«${title}»** (Чан Джун-хван, 2003) — первоисточник ремейка.`]);

  it('название со строкой в архиве — законно', () => {
    const facts = { [TITLE_ORIGINAL]: spelling(KOREAN) };
    expect(codes(withAfter(rhyme('Спасти зелёную планету!'), facts))).not.toContain(
      'title-not-in-spellings',
    );
  });

  it('название без строки в архиве — title-not-in-spellings', () => {
    const facts = { [TITLE_ORIGINAL]: spelling(KOREAN) };
    expect(codes(withAfter(rhyme('Спасти планету!'), facts))).toContain('title-not-in-spellings');
  });

  it('строка под старым ключом «справка» тоже засчитывается', () => {
    const facts = { [TITLE_ORIGINAL]: spelling(KOREAN, 'справка') };
    expect(codes(withAfter(rhyme('Спасти зелёную планету!'), facts))).not.toContain(
      'title-not-in-spellings',
    );
  });

  it('архива у тайтла нет — проверка молчит', () => {
    expect(codes(withAfter(rhyme('Спасти планету!'), {}))).not.toContain('title-not-in-spellings');
  });

  it('архив чужого тайтла своим не считается', () => {
    const facts = { 'The Odyssey': spelling(KOREAN) };
    expect(codes(withAfter(rhyme('Спасти планету!'), facts))).not.toContain(
      'title-not-in-spellings',
    );
  });

  it('собственное название тайтла строки не требует', () => {
    const facts = { [TITLE_ORIGINAL]: spelling(KOREAN) };
    const items = [`**«${TITLE_RU}»** (Йоргос Лантимос, 2025) — та же фигура пленника.`];
    expect(codes(withAfter(place(items), facts))).not.toContain('title-not-in-spellings');
  });

  it('упоминание без режиссёра и года не проверяется', () => {
    // Скобки нет — проверять нечего: это упоминание, а не именование картины.
    const fragment: Fragment = {
      key: 'themes',
      body: [{ type: 'p', text: 'Корейский первоисточник назывался иначе.' }],
    };
    const facts = { [TITLE_ORIGINAL]: spelling(KOREAN) };
    expect(codes(withAfter(fragment, facts))).not.toContain('title-not-in-spellings');
  });

  it('название прозой, в косвенном падеже, не проверяется', () => {
    // Живой случай из досье «Чужого: Земля»: «…после «Прометея» (Ридли Скотт, 2012)».
    // Строка таблицы держит именительный падеж, и сверка дала бы ложную тревогу.
    const fragment: Fragment = {
      key: 'place',
      body: [
        { type: 'h', text: 'В истории жанра' },
        { type: 'p', text: 'Сериал продолжает линию «Прометея» (Ридли Скотт, 2012).' },
      ],
    };
    const facts = { [TITLE_ORIGINAL]: spelling(KOREAN) };
    expect(codes(withAfter(fragment, facts))).not.toContain('title-not-in-spellings');
  });

  it('латинское название строки написания не требует', () => {
    // Правило про русское написание; латиницу переводить не требуется.
    const items = ['**«Ghost in the Shell 2.0»** (Мамору Осии, 2008) — той же сценой.'];
    const facts = { [TITLE_ORIGINAL]: spelling(KOREAN) };
    expect(codes(withAfter(place(items), facts))).not.toContain('title-not-in-spellings');
  });

  it('правило действует и вне рубрики «Место фильма»', () => {
    const fragment: Fragment = {
      key: 'themes',
      body: [
        {
          type: 'p',
          text: 'Тот же ход был у **«Спасти планету!»** (Чан Джун-хван, 2003) двадцатью годами раньше.',
        },
      ],
    };
    const facts = { [TITLE_ORIGINAL]: spelling(KOREAN) };
    expect(codes(withAfter(fragment, facts))).toContain('title-not-in-spellings');
  });

  it('нарушение несёт название, которого не хватило', () => {
    const facts = { [TITLE_ORIGINAL]: spelling(KOREAN) };
    const found = check(withAfter(rhyme('Спасти планету!'), facts)).find(
      (problem) => problem.code === 'title-not-in-spellings',
    );
    expect(found?.detail).toContain('Спасти планету!');
  });
});

// Форма блока «После просмотра», введённая заходом 26 августа 2026 года
// (research/DOSSIER-FORMAT.md, разделы «Читатель дочитывает то, что может пропустить»,
// «Важные статьи» открывают блок», «Форма» разбита на категории», «Контекст»
// открывается справкой», «Критика» собирает главное»).
//
// Все эти проверки включаются **только у досье нового формата**, и признак один:
// в блоке «После просмотра» есть рубрика `reading`. Девятнадцать досье, собранных
// раньше, по новым правилам не переписаны, и красный прогон на них был бы хуже
// отсутствующей проверки — его перестают читать. Тот же приём, что у правила
// «зоны не собирают справку»: задним числом оно к архивам не применяется.

const reading = (count = 3): Fragment => ({
  key: 'reading',
  body: [
    {
      type: 'ul',
      items: Array.from(
        { length: count },
        (_, i) => `**Мысль номер ${i + 1}** — [Variety](https://variety.com/${i}). Раскрытие.`,
      ),
    },
  ],
});

/** Досье нового формата: блок открывается «Важными статьями». */
const modern = (...fragments: Fragment[]): Partial<Input> => ({
  dossiers: [dossier({ after: [reading(), ...fragments] })],
  films: [film()],
  facts: {},
});

describe('checkDossier: форма блока «После просмотра» (заход 26.08.2026)', () => {
  it('старое досье без «Важных статей» новыми проверками не трогается', () => {
    const old: Fragment = {
      key: 'critique',
      body: [{ type: 'p', text: 'Абзац прозой, каких в старом формате много.' }],
    };

    expect(codes(withAfter(old))).toEqual([]);
  });

  it('«Важные статьи» стоят первыми в блоке', () => {
    const input: Partial<Input> = {
      dossiers: [dossier({ after: [{ key: 'theses', body: [{ type: 'ul', items: ['**Раз.** Два.'] }] }, reading()] })],
      films: [film()],
      facts: {},
    };

    expect(codes(input)).toContain('reading-not-first');
  });

  it('важных статей ровно три: две — мало, четыре — много', () => {
    const two: Partial<Input> = { dossiers: [dossier({ after: [reading(2)] })], films: [film()], facts: {} };
    const four: Partial<Input> = { dossiers: [dossier({ after: [reading(4)] })], films: [film()], facts: {} };

    expect(codes(two)).toContain('reading-count');
    expect(codes(four)).toContain('reading-count');
    expect(codes(modern())).not.toContain('reading-count');
  });

  it('«Контекст» открывается справкой-врезкой', () => {
    const withoutNote: Fragment = {
      key: 'context',
      body: [{ type: 'ul', items: ['**Мысль.** Раскрытие.'] }],
    };
    const withNote: Fragment = {
      key: 'context',
      body: [
        { type: 'note', text: 'Ввод в предмет для того, кто о нём ничего не знает.' },
        { type: 'ul', items: ['**Мысль.** Раскрытие.'] },
      ],
    };

    expect(codes(modern(withoutNote))).toContain('context-no-note');
    expect(codes(modern(withNote))).not.toContain('context-no-note');
  });

  it('«Форма» разбита на категории подзаголовками', () => {
    const flat: Fragment = { key: 'form', body: [{ type: 'ul', items: ['**Мысль.** Раскрытие.'] }] };
    const split: Fragment = {
      key: 'form',
      body: [
        { type: 'h', text: 'Декорация' },
        { type: 'ul', items: ['**Мысль.** Раскрытие.'] },
        { type: 'h', text: 'Звук' },
        { type: 'ul', items: ['**Вторая мысль.** Раскрытие.'] },
      ],
    };

    expect(codes(modern(flat))).toContain('form-no-categories');
    expect(codes(modern(split))).not.toContain('form-no-categories');
  });

  it('в «Критике» не больше восьми пунктов', () => {
    const items = (n: number): string[] =>
      Array.from({ length: n }, (_, i) => `**Претензия ${i + 1}.** Раскрытие.`);
    const eight: Fragment = { key: 'critique', body: [{ type: 'ul', items: items(8) }] };
    const nine: Fragment = { key: 'critique', body: [{ type: 'ul', items: items(9) }] };

    expect(codes(modern(eight))).not.toContain('critique-too-long');
    expect(codes(modern(nine))).toContain('critique-too-long');
  });

  it('пункты «Критики» считаются через подзаголовки: разбивка по сезонам не обнуляет счёт', () => {
    const split: Fragment = {
      key: 'critique',
      body: [
        { type: 'h', text: 'Первый сезон' },
        { type: 'ul', items: Array.from({ length: 5 }, (_, i) => `**Раз ${i}.** Два.`) },
        { type: 'h', text: 'Второй сезон' },
        { type: 'ul', items: Array.from({ length: 5 }, (_, i) => `**Три ${i}.** Четыре.`) },
      ],
    };

    expect(codes(modern(split))).toContain('critique-too-long');
  });

  it('концепций не больше пяти', () => {
    const themes = (n: number): Fragment => ({
      key: 'themes',
      body: [
        { type: 'ul', items: ['**Тема.** Раскрытие.'] },
        { type: 'h', text: 'Концепции' },
        { type: 'ul', items: Array.from({ length: n }, (_, i) => `**Понятие ${i + 1}.** Раскрытие.`) },
      ],
    });

    expect(codes(modern(themes(5)))).not.toContain('concepts-too-many');
    expect(codes(modern(themes(6)))).toContain('concepts-too-many');
  });

  it('абзац законен вводкой — в начале рубрики и сразу под подзаголовком', () => {
    const legal: Fragment = {
      key: 'form',
      body: [
        { type: 'p', text: 'Вводка, ставящая рамку для всех пунктов сразу.' },
        { type: 'h', text: 'Декорация' },
        { type: 'p', text: 'Вводка категории.' },
        { type: 'ul', items: ['**Мысль.** Раскрытие.'] },
        { type: 'h', text: 'Звук' },
        { type: 'ul', items: ['**Вторая.** Раскрытие.'] },
      ],
    };

    expect(codes(modern(legal))).not.toContain('prose-in-list');
  });

  it('абзац после списка — проза там, где положен пункт', () => {
    const prose: Fragment = {
      key: 'themes',
      body: [
        { type: 'ul', items: ['**Тема.** Раскрытие.'] },
        { type: 'p', text: 'А это уже абзац посреди списка, и он лишний.' },
      ],
    };

    expect(codes(modern(prose))).toContain('prose-in-list');
  });

  it('справка стоит только в «Контексте» и только первой', () => {
    const late: Fragment = {
      key: 'context',
      body: [
        { type: 'ul', items: ['**Мысль.** Раскрытие.'] },
        { type: 'note', text: 'Справка, съехавшая вниз.' },
      ],
    };
    const alien: Fragment = {
      key: 'form',
      body: [
        { type: 'note', text: 'Справка не в своей рубрике.' },
        { type: 'h', text: 'Декорация' },
        { type: 'ul', items: ['**Мысль.** Раскрытие.'] },
        { type: 'h', text: 'Звук' },
        { type: 'ul', items: ['**Вторая.** Раскрытие.'] },
      ],
    };

    expect(codes(modern(late))).toContain('note-misplaced');
    expect(codes(modern(alien))).toContain('note-misplaced');
  });
});

// Правовая сноска — абзац, и в списочной рубрике тоже. Решение владельца 26.08.2026
// (research/LEGAL.md, «Первое: сноска»; research/DOSSIER-FORMAT.md, «Правовая сноска —
// абзац, а не пункт списка»). До него абзац после списка всегда давал `prose-in-list`,
// и сноску физически некуда было поставить: двое пишущих подряд поставили её пунктом
// списка — не по небрежности, а потому что валидатор не оставлял другого выхода.
// Сноска не часть разбора, она служебная строка, и маркер перед ней читается как
// ещё один довод.
//
// Послабление получает **только эта формулировка и только целиком**: постоянство
// формулировки здесь требование закона, а не редакторский вкус, и `check-dossier`
// сверяет её посимвольно. Абзац, в котором к ней что-то приписано, сноской не
// считается — иначе через послабление проходила бы любая проза, начинающаяся со
// служебной строки.
describe('checkDossier: правовая сноска — абзац, а не пункт списка', () => {
  const FOOTNOTE =
    '* Пометка, которой требует местное право.';

  const STARRED_ITEM = '**Мысль.** Критика читает героиню вне гендерного деления*.';

  it('сноска абзацем после списка — не проза на месте пункта', () => {
    const fragment: Fragment = {
      key: 'themes',
      body: [{ type: 'ul', items: [STARRED_ITEM] }, { type: 'p', text: FOOTNOTE }],
    };

    expect(codes(modern(fragment))).not.toContain('prose-in-list');
  });

  it('сноска абзацем после врезки — не проза на месте пункта', () => {
    const fragment: Fragment = {
      key: 'themes',
      body: [
        { type: 'ul', items: [STARRED_ITEM] },
        { type: 'quote', text: 'Героиня не японка и не белая.', author: 'Аманда Ноидзуми' },
        { type: 'p', text: FOOTNOTE },
      ],
    };

    expect(codes(modern(fragment))).not.toContain('prose-in-list');
  });

  it('сноска абзацем в конце рубрики, открытой справкой, — не проза на месте пункта', () => {
    const fragment: Fragment = {
      key: 'context',
      body: [
        { type: 'note', text: 'Ввод в предмет для того, кто о нём ничего не знает.' },
        { type: 'ul', items: [STARRED_ITEM] },
        { type: 'p', text: FOOTNOTE },
      ],
    };

    expect(codes(modern(fragment))).not.toContain('prose-in-list');
  });

  it('рубрика со сноской на её месте чиста целиком — вместе с вводками', () => {
    // Сноска стоит там, где велит LEGAL.md: перед следующим подзаголовком, замыкая
    // ту часть, где тема поднята. Абзацы-вводки при этом остаются законными — в начале
    // рубрики и сразу под подзаголовком, как и были.
    const fragment: Fragment = {
      key: 'form',
      body: [
        { type: 'p', text: 'Вводка, ставящая рамку для всех пунктов сразу.' },
        { type: 'h', text: 'Декорация' },
        { type: 'p', text: 'Вводка категории.' },
        { type: 'ul', items: [STARRED_ITEM] },
        { type: 'p', text: FOOTNOTE },
        { type: 'h', text: 'Звук' },
        { type: 'ul', items: ['**Вторая мысль.** Раскрытие.'] },
      ],
    };

    expect(codes(modern(fragment))).toEqual([]);
  });

  it('любой другой абзац после списка по-прежнему prose-in-list', () => {
    const prose: Fragment = {
      key: 'themes',
      body: [
        { type: 'ul', items: ['**Тема.** Раскрытие.'] },
        { type: 'p', text: 'А это уже абзац посреди списка, и он лишний.' },
      ],
    };

    expect(codes(modern(prose))).toContain('prose-in-list');
  });

  it('типографская правка сноски послабления не даёт: сверка посимвольная', () => {
    // На заходе 25 августа 2026 года сноска «Орудий» разошлась с эталоном неразрывным
    // пробелом после звёздочки — на глаз строка неотличима. Такой абзац сноской
    // не считается.
    const almost: Fragment = {
      key: 'themes',
      body: [
        { type: 'ul', items: ['**Тема.** Раскрытие.'] },
        { type: 'p', text: FOOTNOTE.replace('* ', '*\u00A0') },
      ],
    };

    expect(codes(modern(almost))).toContain('prose-in-list');
  });

  // portable 22.09.2026: кейс снят — правило теперь общее (сноска — любой абзац,
  // начинающийся с «* »), буквальная сверка с припиской к формулировке не входит в контракт.

  it('без звёздочки в рубрике сноска ведёт себя так же: послабление про форму, а не про повод', () => {
    const fragment: Fragment = {
      key: 'themes',
      body: [{ type: 'ul', items: ['**Тема.** Раскрытие.'] }, { type: 'p', text: FOOTNOTE }],
    };

    expect(codes(modern(fragment))).not.toContain('prose-in-list');
  });
});

// Версия 15. Досье стало тройкой блоков, и `keys` разбирается наравне с `before`
// и `after`: те же механические проверки по тем же основаниям. Блок читают либо после
// просмотра, либо сознательно раскрыв полосу, — то есть читатель у него такой же живой,
// как у двух соседних, и правовая рамка, поломанная разметка и русские написания чужих
// названий действуют в нём ровно так же (specs/v15/spec.md, разделы A и B).
//
// Формы тела блока эти проверки не касаются: «ровно один список из пяти-семи пунктов»
// сторожит `validateDossierBlock` кодами `keys-shape` и `keys-count`, а здесь — то, что
// живёт внутри строк. Правила формы блока «После просмотра» (`reading` первой, справка
// в «Контексте», категории в «Форме») на ключи не переносятся: они про состав рубрик
// того блока, а в этом рубрика одна.
describe('checkDossier: блок ключей разбирается наравне с соседями', () => {
  const FOOTNOTE =
    '* Пометка, которой требует местное право.';

  /** Пять пунктов правильной формы: полужирный лид и раскрытие. */
  const items = (...extra: string[]): string[] => [
    '**Героиня стоит сразу на нескольких границах.** Расовой, гендерной и сословной разом.',
    '**Месть у неё устроительная, а не личная.** Она метит в порядок, а не в человека.',
    '**Маска — условие жизни, а не приём.** Снять её значит перестать существовать.',
    '**Форма спорит с жанром.** Самурайская история рассказана языком трагедии мести.',
    ...extra,
    '**Финал не закрывает счёт.** Он показывает цену, а не итог.',
  ];

  const KEYS: DossierNode[] = [{ type: 'ul', items: items() }];

  it('корректный блок ключей нарушений не даёт', () => {
    expect(codes(withKeys(KEYS))).toEqual([]);
  });

  it('блока ключей в записи нет вовсе — чекер это переживает', () => {
    expect(() => check({ dossiers: [dossier()], films: [film()] })).not.toThrow();
  });

  it('звёздочка правовой рамки без сноски в блоке ключей — legal-star-no-footnote', () => {
    const starred = items('**Прочтение героини спорное.** Критика читает её вне гендерного деления*.');
    expect(codes(withKeys([{ type: 'ul', items: starred }]))).toContain('legal-star-no-footnote');
  });

  it('сноска в самом блоке ключей звёздочку закрывает', () => {
    const starred = items('**Прочтение героини спорное.** Критика читает её вне гендерного деления*.');
    const nodes: DossierNode[] = [
      { type: 'ul', items: starred },
      { type: 'p', text: FOOTNOTE },
    ];
    expect(codes(withKeys(nodes))).not.toContain('legal-star-no-footnote');
  });

  it('сноска в разборе звёздочку ключей не закрывает: блоки раскрываются порознь', () => {
    const starred = items('**Прочтение героини спорное.** Критика читает её вне гендерного деления*.');
    const dossiers = [
      dossier({
        keys: [{ key: 'keys', body: [{ type: 'ul', items: starred }] }],
        after: [{ key: 'themes', body: [{ type: 'p', text: FOOTNOTE }] }],
      }),
    ];
    expect(codes({ dossiers, films: [film()] })).toContain('legal-star-no-footnote');
  });

  it('место нарушения правовой рамки называет блок ключей', () => {
    const starred = items('**Прочтение героини спорное.** Критика читает её вне гендерного деления*.');
    const found = check(withKeys([{ type: 'ul', items: starred }])).find(
      (problem) => problem.code === 'legal-star-no-footnote',
    );
    expect(found?.where).toBe('keys');
  });

  it('звёздочка внутри полужирного в блоке ключей — legal-star-in-bold', () => {
    const broken =
      '**Героиню читают и как женщину, и вне гендерного деления*, — авторы приняли оба.**';
    const nodes: DossierNode[] = [
      { type: 'ul', items: items(broken) },
      { type: 'p', text: FOOTNOTE },
    ];
    const problems = check(withKeys(nodes));
    expect(problems.map((problem) => problem.code)).toContain('legal-star-in-bold');
    expect(problems.find((problem) => problem.code === 'legal-star-in-bold')?.where).toBe(
      'keys/keys',
    );
  });

  it('русское название без строки написаний в блоке ключей — title-not-in-spellings', () => {
    const HEAD = '| Утверждение | Статус | Оговорка | Источники | Спойлер | Рубрики | Цитата |';
    const facts = {
      [TITLE_ORIGINAL]: [
        '# «Бугония» — сводная таблица фактов',
        '',
        HEAD,
        '|---|---|---|---|---|---|---|',
        '| Save the Green Planet! — «Спасти зелёную планету!» (Чан Джун-хван, 2003) | ' +
          'сообщается | написание | `ctx-a.md` | нет | написание | — |',
        '',
      ].join('\n'),
    };
    const named = items(
      '**«Спасти планету!»** (Чан Джун-хван, 2003) — первоисточник, без которого фильм не читается.',
    );
    expect(codes(withKeys([{ type: 'ul', items: named }], facts))).toContain(
      'title-not-in-spellings',
    );
  });

  it('форма блока «После просмотра» на ключи не переносится', () => {
    // В блоке одна рубрика, и требований «`reading` первой», «справка в «Контексте»»,
    // «категории в «Форме»» к нему нет. Абзац рядом со списком здесь ловит валидатор
    // кодом `keys-shape`, а не механический разбор кодом `prose-in-list`.
    const nodes: DossierNode[] = [
      { type: 'ul', items: items() },
      { type: 'p', text: 'Абзац, который в блоке ключей лишний.' },
    ];
    const found = codes(withKeys(nodes));
    expect(found).not.toContain('prose-in-list');
    expect(found).not.toContain('reading-not-first');
  });
});

// Тесты `slugArchive` и `matchesArchiveFolder` переехали в tests/archive-slug.test.ts
// вместе с самим знанием: рефакторинг 15.09.2026, находка 14 — слаг папки архива
// живёт в `src/lib/archive-slug.ts`, а не в файле проверок формы досье.
