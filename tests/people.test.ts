// Критерии приёмки 3, 15 и 20 версии v7 на уровне чистой логики персоналий:
// 3 — словарь ролей задаёт порядок показа тегов на странице и групп в указателе;
// 15 — имя, у которого есть персоналия, отделяется от текста поля создателей точным
//      совпадением, а не догадкой; остальные куски поля остаются текстом;
// 20 — валидатор отклоняет запись без ролей, с ролью вне словаря, с пустым тезисом,
//      с незакрытым выделением, с цитатой без автора и с двумя безымянными методами.
//      Проверяется не только факт отказа, но и код: коды перечислены планом поимённо,
//      и перепутанный код означает, что скрипт наполнения сообщит агенту не о том.
//
// Контракт модуля '@/lib/people', зафиксированный этими тестами (plan.md):
//   type PersonRole = { slug: string; label: string };
//   const PERSON_ROLES: readonly PersonRole[];
//   const ROLE_BY_SLUG: ReadonlyMap<string, PersonRole>;
//   function sortRoles(slugs: string[]): PersonRole[];
//   type Method = { title: string | null; theses: MethodThesis[] };
//   type MethodThesis = { title: string; body: DossierNode[] };
//   type WorkNote = { title; year; titleOriginal; method: DossierNode[]; facts: string[] };
//   type PersonLink = { label: string; url: string };
//   type NotableWork = { title: string; year: number | null };
//   type PersonError = 'slug' | 'name' | 'roles' | 'unknown-role' | 'duplicate-role'
//                    | 'date-format' | 'death-before-birth'
//                    | 'method-empty' | 'thesis-title' | 'unnamed-methods'
//                    | 'work-title' | 'link' | DossierError;
//   function validatePerson(person: PersonInput): PersonError | null;
//   type NamePart = { text: string; slug: string | null };
//   function linkNames(field: string, byName: ReadonlyMap<string, string>): NamePart[];
//
// Валидатор устроен по конвенции проекта (`validateTags`, `validateDossierBlock`):
// `null` — запись корректна, иначе код ошибки. Тесты передают ему запись персоналии
// целиком — ту же, что уезжает в базу; `makePerson` из helpers наполняет её пустыми
// значениями, чтобы каждый тест задавал ровно то, что проверяет.
//
// Проверка узлов тела не дублируется: спека требует, чтобы тезис и разбор работы
// проходили те же правила разметки, что и досье. Поэтому здесь проверяется, что
// унаследованные коды доходят наружу из обоих мест, а не что правила скопированы.

import { describe, it, expect } from 'vitest';
import {
  PERSON_ROLES,
  ROLE_BY_SLUG,
  sortRoles,
  validatePerson,
  linkNames,
  type Method,
  type NamePart,
  type PersonLink,
  type WorkNote,
} from '@/lib/people';
import type { Person } from '@/db/schema';
import type { DossierNode, DossierSource } from '@/lib/dossier';
import { makePerson } from './helpers';

/** Ключи в порядке словаря — он же порядок показа. */
const ROLE_KEYS = [
  'director',
  'screenwriter',
  'producer',
  'cinematographer',
  'composer',
  'sound',
  'editor',
  'designer',
  'animator',
  'actor',
  'author',
];

/** Русские подписи заданы спекой дословно. Они не склоняются по роду: «режиссёр» —
 *  обозначение профессии, а не человека. */
const LABELS: Record<string, string> = {
  director: 'режиссёр',
  screenwriter: 'сценарист',
  producer: 'продюсер',
  cinematographer: 'оператор',
  composer: 'композитор',
  sound: 'звукорежиссёр',
  editor: 'монтажёр',
  designer: 'художник',
  animator: 'аниматор',
  actor: 'актёр',
  author: 'автор оригинала',
};

const p = (text: string): DossierNode => ({ type: 'p', text });
const h = (text: string): DossierNode => ({ type: 'h', text });
const ul = (...items: string[]): DossierNode => ({ type: 'ul', items });
const quote = (text: string, author: string): DossierNode => ({ type: 'quote', text, author });

/** Один метод без заголовка — обычный случай: раздел на странице зовётся «Метод». */
const METHOD: Method[] = [
  {
    title: null,
    theses: [
      {
        title: 'У кино нет реальности',
        body: [
          p('Граница между сном и явью у него **не проведена** намеренно.'),
          quote('Я снимаю не про будущее, а про то, чего мы не видим сейчас.', 'Мамору Осии'),
        ],
      },
      {
        title: 'Пауза важнее реплики',
        body: [p('То же самое он делает в «Авалоне».')],
      },
    ],
  },
];

const WORKS: WorkNote[] = [
  {
    title: 'Призрак в доспехах',
    year: 1995,
    titleOriginal: 'Ghost in the Shell',
    method: [h('Город как персонаж'), p('Три минуты без реплик — [разбор](https://example.com/a).')],
    facts: ['Кэндзи Каваи записал хор на японском народном языке.'],
  },
];

const LINKS: PersonLink[] = [{ label: 'Интервью', url: 'https://example.com/interview' }];

const SOURCES: DossierSource[] = [
  { publication: 'Sight & Sound', title: 'Разговор с Осии', url: 'https://example.com/ss' },
];

/** Корректная персоналия целиком; тесты меняют в ней одно поле. */
function person(overrides: Partial<Person> = {}): Person {
  return makePerson({
    id: 1,
    slug: 'mamoru-oshii',
    nameRu: 'Мамору Осии',
    nameOriginal: 'Mamoru Oshii',
    birthDate: '1951-08-08',
    birthPlace: 'Токио, Япония',
    roles: ['director', 'screenwriter'],
    annotation: 'Тридцать лет снимает про то, что у кино нет реальности.',
    method: METHOD,
    workNotes: WORKS,
    links: LINKS,
    sources: SOURCES,
    searchedAt: '2026-08-23',
    ...overrides,
  });
}

/** Метод с единственным тезисом, тело которого задаёт тест. */
const withThesisBody = (body: DossierNode[]): Method[] => [
  { title: null, theses: [{ title: 'Формулировка', body }] },
];

/** Работа с единственным разбором, тело которого задаёт тест. */
const withWorkBody = (method: DossierNode[]): WorkNote[] => [
  { title: 'Авалон', year: 2001, titleOriginal: null, method, facts: [] },
];

describe('Словарь ролей: состав и порядок (критерий 3)', () => {
  it('в словаре одиннадцать ролей в порядке спеки', () => {
    expect(PERSON_ROLES.map((role) => role.slug)).toEqual(ROLE_KEYS);
  });

  it('у каждой роли русская подпись из спеки', () => {
    for (const role of PERSON_ROLES) {
      expect(role.label, `подпись роли «${role.slug}»`).toBe(LABELS[role.slug]);
    }
  });

  it('ключи ролей — строчная латиница', () => {
    for (const role of PERSON_ROLES) {
      expect(role.slug, `ключ «${role.slug}»`).toMatch(/^[a-z]+$/);
    }
  });

  it('ROLE_BY_SLUG находит каждую роль словаря', () => {
    for (const key of ROLE_KEYS) {
      expect(ROLE_BY_SLUG.get(key)?.slug, `роль «${key}»`).toBe(key);
    }
  });

  it('роли вне словаря в ROLE_BY_SLUG нет', () => {
    expect(ROLE_BY_SLUG.get('гримёр')).toBeUndefined();
    expect(ROLE_BY_SLUG.get('DIRECTOR')).toBeUndefined();
    expect(ROLE_BY_SLUG.get('')).toBeUndefined();
  });

  it('роль «автор оригинала» в словаре есть — она нужна обоим тайтлам версии', () => {
    expect(ROLE_BY_SLUG.get('author')?.label).toBe('автор оригинала');
  });
});

describe('sortRoles: порядок показа задаёт словарь (критерий 3)', () => {
  it('роли выстраиваются в порядок словаря независимо от порядка в записи', () => {
    expect(sortRoles(['author', 'director', 'composer']).map((role) => role.slug)).toEqual([
      'director',
      'composer',
      'author',
    ]);
  });

  it('порядок записи не влияет на результат', () => {
    const forward = sortRoles(['director', 'screenwriter']).map((role) => role.slug);
    const backward = sortRoles(['screenwriter', 'director']).map((role) => role.slug);

    expect(forward).toEqual(backward);
  });

  it('возвращаются роли словаря целиком, с подписями', () => {
    expect(sortRoles(['composer'])).toEqual([{ slug: 'composer', label: 'композитор' }]);
  });

  it('пустой список даёт пустой результат', () => {
    expect(sortRoles([])).toEqual([]);
  });

  // Валидатор — единственный вход в базу, показ на нём не держится: страница
  // с испорченными данными обязана нарисоваться без этой роли, а не упасть.
  it('неизвестный ключ отбрасывается, известные остаются', () => {
    expect(sortRoles(['гримёр', 'director']).map((role) => role.slug)).toEqual(['director']);
    expect(sortRoles(['гримёр'])).toEqual([]);
  });
});

describe('validatePerson: корректная запись (критерий 20)', () => {
  it('полностью заполненная персоналия проходит', () => {
    expect(validatePerson(person())).toBeNull();
  });

  it('персоналия без материалов проходит: пусты они законно', () => {
    expect(
      validatePerson(
        person({ annotation: null, method: null, workNotes: null, links: null, sources: null }),
      ),
    ).toBeNull();
  });

  it('пустые списки методов и работ — не ошибка', () => {
    expect(validatePerson(person({ method: [], workNotes: [] }))).toBeNull();
  });

  it('единственный метод без заголовка — норма', () => {
    expect(validatePerson(person({ method: [{ title: null, theses: METHOD[0].theses }] }))).toBeNull();
    expect(validatePerson(person({ method: [{ title: '', theses: METHOD[0].theses }] }))).toBeNull();
  });

  it('два метода со своими заголовками проходят', () => {
    expect(
      validatePerson(
        person({
          method: [
            { title: 'Режиссёр', theses: METHOD[0].theses },
            { title: 'Сценарист', theses: METHOD[0].theses },
          ],
        }),
      ),
    ).toBeNull();
  });
});

describe('validatePerson: slug и имя', () => {
  it('пустой slug отклоняется', () => {
    expect(validatePerson(person({ slug: '' }))).toBe('slug');
    expect(validatePerson(person({ slug: '   ' }))).toBe('slug');
  });

  it('slug из строчной латиницы, цифр и дефисов проходит', () => {
    for (const slug of ['mamoru-oshii', 'moko-chan', 'x', 'blade-runner-2049', 'a1']) {
      expect(validatePerson(person({ slug })), `slug «${slug}»`).toBeNull();
    }
  });

  it('кириллица, заглавные буквы, пробелы и подчёркивания в slug отклоняются', () => {
    for (const slug of ['мамору-осии', 'Mamoru-Oshii', 'mamoru oshii', 'mamoru_oshii', 'mamoru.oshii']) {
      expect(validatePerson(person({ slug })), `slug «${slug}»`).toBe('slug');
    }
  });

  it('пустое имя отклоняется', () => {
    expect(validatePerson(person({ nameRu: '' }))).toBe('name');
    expect(validatePerson(person({ nameRu: '   ' }))).toBe('name');
  });
});

describe('validatePerson: роли (критерий 20)', () => {
  it('запись без ролей отклоняется', () => {
    expect(validatePerson(person({ roles: [] }))).toBe('roles');
  });

  it('роль вне словаря отклоняется', () => {
    expect(validatePerson(person({ roles: ['director', 'гримёр'] }))).toBe('unknown-role');
    expect(validatePerson(person({ roles: ['гримёр'] }))).toBe('unknown-role');
    expect(validatePerson(person({ roles: ['Director'] }))).toBe('unknown-role');
  });

  it('повторённая роль отклоняется', () => {
    expect(validatePerson(person({ roles: ['director', 'director'] }))).toBe('duplicate-role');
    expect(validatePerson(person({ roles: ['director', 'composer', 'director'] }))).toBe(
      'duplicate-role',
    );
  });

  it('одной роли достаточно', () => {
    expect(validatePerson(person({ roles: ['actor'] }))).toBeNull();
  });
});

describe('validatePerson: даты переменной точности', () => {
  it('все три точности принимаются', () => {
    for (const date of ['1951', '1951-08', '1951-08-08']) {
      expect(validatePerson(person({ birthDate: date })), `дата «${date}»`).toBeNull();
    }
  });

  it('пустые даты — нормальное состояние', () => {
    expect(validatePerson(person({ birthDate: null, deathDate: null }))).toBeNull();
  });

  it('дата не того вида отклоняется', () => {
    for (const date of ['08.08.1951', '1951-8', '51', '1951-08-08T00:00', '1951/08', 'вчера', '']) {
      expect(validatePerson(person({ birthDate: date })), `дата «${date}»`).toBe('date-format');
    }
  });

  it('дата смерти проверяется тем же правилом', () => {
    expect(validatePerson(person({ deathDate: '08.08.2001' }))).toBe('date-format');
    expect(validatePerson(person({ deathDate: '2001' }))).toBeNull();
  });

  it('смерть раньше рождения отклоняется', () => {
    expect(validatePerson(person({ birthDate: '1951', deathDate: '1949' }))).toBe(
      'death-before-birth',
    );
    expect(validatePerson(person({ birthDate: '1951-08-08', deathDate: '1951-08-07' }))).toBe(
      'death-before-birth',
    );
  });

  it('смерть в год рождения не отклоняется: точность разная, противоречия нет', () => {
    expect(validatePerson(person({ birthDate: '1951', deathDate: '1951' }))).toBeNull();
    expect(validatePerson(person({ birthDate: '1951', deathDate: '1951-08' }))).toBeNull();
    expect(validatePerson(person({ birthDate: '1951-08-08', deathDate: '1951-08-08' }))).toBeNull();
  });

  it('смерть без даты рождения сравнивать не с чем', () => {
    expect(validatePerson(person({ birthDate: null, deathDate: '2001' }))).toBeNull();
  });
});

describe('validatePerson: методы и тезисы (критерий 20)', () => {
  it('метод без тезисов отклоняется', () => {
    expect(validatePerson(person({ method: [{ title: null, theses: [] }] }))).toBe('method-empty');
  });

  it('тезис без формулировки отклоняется', () => {
    expect(
      validatePerson(person({ method: [{ title: null, theses: [{ title: '', body: [p('Текст')] }] }] })),
    ).toBe('thesis-title');
    expect(
      validatePerson(
        person({ method: [{ title: null, theses: [{ title: '   ', body: [p('Текст')] }] }] }),
      ),
    ).toBe('thesis-title');
  });

  it('тезис с пустым телом отклоняется', () => {
    expect(validatePerson(person({ method: withThesisBody([]) }))).toBe('no-body');
  });

  it('два метода, у которых не заполнен заголовок, отклоняются: на странице они неразличимы', () => {
    const theses = METHOD[0].theses;

    expect(
      validatePerson(person({ method: [{ title: null, theses }, { title: null, theses }] })),
    ).toBe('unnamed-methods');
    expect(
      validatePerson(person({ method: [{ title: 'Режиссёр', theses }, { title: null, theses }] })),
    ).toBe('unnamed-methods');
    expect(
      validatePerson(person({ method: [{ title: 'Режиссёр', theses }, { title: '  ', theses }] })),
    ).toBe('unnamed-methods');
  });
});

describe('validatePerson: работы', () => {
  it('работа без названия отклоняется', () => {
    expect(
      validatePerson(
        person({
          workNotes: [{ title: '', year: 2001, titleOriginal: null, method: [p('Разбор')], facts: [] }],
        }),
      ),
    ).toBe('work-title');
    expect(
      validatePerson(
        person({
          workNotes: [{ title: '  ', year: null, titleOriginal: null, method: [p('Разбор')], facts: [] }],
        }),
      ),
    ).toBe('work-title');
  });

  it('работа с пустым разбором отклоняется', () => {
    expect(validatePerson(person({ workNotes: withWorkBody([]) }))).toBe('no-body');
  });

  it('работа без года и без оригинального названия — норма', () => {
    expect(
      validatePerson(
        person({
          workNotes: [
            { title: 'Авалон', year: null, titleOriginal: null, method: [p('Разбор')], facts: [] },
          ],
        }),
      ),
    ).toBeNull();
  });
});

describe('validatePerson: ссылки', () => {
  it('ссылка без подписи отклоняется', () => {
    expect(validatePerson(person({ links: [{ label: '', url: 'https://example.com' }] }))).toBe('link');
    expect(validatePerson(person({ links: [{ label: '  ', url: 'https://example.com' }] }))).toBe(
      'link',
    );
  });

  it('адрес не на http отклоняется', () => {
    for (const url of ['example.com', 'ftp://example.com', '/people/oshii', '']) {
      expect(validatePerson(person({ links: [{ label: 'Интервью', url }] })), `адрес «${url}»`).toBe(
        'link',
      );
    }
  });

  it('http и https принимаются', () => {
    expect(validatePerson(person({ links: [{ label: 'Интервью', url: 'http://example.com' }] }))).toBeNull();
    expect(
      validatePerson(person({ links: [{ label: 'Интервью', url: 'https://example.com/a' }] })),
    ).toBeNull();
  });
});

// Правила разметки живут в одном месте — валидаторе узлов досье. Здесь проверяется,
// что персоналия действительно его зовёт и что коды доходят наружу неизменными.
describe('validatePerson: унаследованные коды узлов (критерий 20)', () => {
  const BROKEN: [string, DossierNode[], string][] = [
    ['абзац из пробелов', [p('   ')], 'blank-text'],
    ['подзаголовок из пробелов', [h('   ')], 'blank-text'],
    ['список без пунктов', [ul()], 'blank-item'],
    ['пустой пункт списка', [ul('Первый', '  ')], 'blank-item'],
    ['цитата без автора', [quote('Реплика', '')], 'no-author'],
    ['незакрытое выделение', [p('Он снимает **иначе')], 'markup'],
    ['ссылка не на http', [p('Смотри [разбор](не-адрес).')], 'link'],
  ];

  it.each(BROKEN)('в теле тезиса: %s даёт код «%s»', (_name, body, code) => {
    expect(validatePerson(person({ method: withThesisBody(body) }))).toBe(code);
  });

  it.each(BROKEN)('в разборе работы: %s даёт код «%s»', (_name, body, code) => {
    expect(validatePerson(person({ workNotes: withWorkBody(body) }))).toBe(code);
  });

  it('целый текст с полужирным и ссылкой проходит', () => {
    expect(
      validatePerson(
        person({
          method: withThesisBody([
            p('Он снимает **иначе** — [интервью](https://example.com/i).'),
            ul('Пункт с **выделением**', 'Пункт со [ссылкой](https://example.com/b)'),
            quote('Реплика', 'Мамору Осии'),
          ]),
        }),
      ),
    ).toBeNull();
  });
});

// Источники у персоналии той же формы, что у досье, и проверяются тем же валидатором.
// Коды `validateSources` планом в `PersonError` не перечислены, поэтому здесь
// проверяется факт отказа, а не его имя.
describe('validatePerson: источники', () => {
  it('корректные источники проходят, пустое поле — тоже', () => {
    expect(validatePerson(person({ sources: SOURCES }))).toBeNull();
    expect(validatePerson(person({ sources: null }))).toBeNull();
  });

  it('источник без издания, заголовка или внешнего адреса отклоняется', () => {
    expect(
      validatePerson(person({ sources: [{ publication: '', title: 'Разговор', url: 'https://a.io' }] })),
    ).not.toBeNull();
    expect(
      validatePerson(person({ sources: [{ publication: 'Sight', title: '', url: 'https://a.io' }] })),
    ).not.toBeNull();
    expect(
      validatePerson(person({ sources: [{ publication: 'Sight', title: 'Разговор', url: 'a.io' }] })),
    ).not.toBeNull();
  });
});

// Сопоставление «имя в тексте поля → ссылка» (критерий 15). Поле разбирается по запятой —
// так же, как оно и печатается; совпадение точное, нечёткое сравнение здесь опаснее,
// чем отсутствие ссылки.
describe('linkNames: имена в тексте поля создателей (критерий 15)', () => {
  const BY_NAME: ReadonlyMap<string, string> = new Map([
    ['Мамору Осии', 'mamoru-oshii'],
    ['Ацуко Танака', 'atsuko-tanaka'],
  ]);

  /** Склейка всех кусков обязана вернуть исходное поле: разделители не теряются. */
  const joined = (parts: NamePart[]): string => parts.map((part) => part.text).join('');

  /** Кусок, который стал ссылкой на персоналию. */
  const linked = (parts: NamePart[]): NamePart[] => parts.filter((part) => part.slug !== null);

  it('имя из карты получает slug', () => {
    const parts = linkNames('Мамору Осии', BY_NAME);

    expect(linked(parts)).toHaveLength(1);
    expect(linked(parts)[0].slug).toBe('mamoru-oshii');
    expect(linked(parts)[0].text.trim()).toBe('Мамору Осии');
  });

  it('имя не из карты остаётся текстом', () => {
    const parts = linkNames('Кэндзи Каваи', BY_NAME);

    expect(linked(parts)).toHaveLength(0);
    expect(joined(parts)).toBe('Кэндзи Каваи');
  });

  it('поле склеивается обратно в исходную строку — разделители сохранены', () => {
    for (const field of [
      'Мамору Осии, Кадзунори Ито',
      'Кадзунори Ито, Мамору Осии, Ацуко Танака',
      'Ацуко Танака,Акио Оцука',
      'Мамору Осии',
      'Кэндзи Каваи',
      '',
    ]) {
      expect(joined(linkNames(field, BY_NAME)), `поле «${field}»`).toBe(field);
    }
  });

  it('в поле из нескольких имён ссылками становятся только знакомые', () => {
    const parts = linkNames('Кадзунори Ито, Мамору Осии, Ацуко Танака', BY_NAME);

    expect(linked(parts).map((part) => part.slug)).toEqual(['mamoru-oshii', 'atsuko-tanaka']);
  });

  it('порядок кусков — исходный порядок поля', () => {
    const parts = linkNames('Мамору Осии, Кадзунори Ито', BY_NAME);
    const texts = parts.map((part) => part.text.trim()).filter((text) => text !== '' && text !== ',');

    expect(texts[0]).toBe('Мамору Осии');
    expect(texts[texts.length - 1]).toBe('Кадзунори Ито');
  });

  it('пробелы вокруг имени совпадению не мешают', () => {
    const parts = linkNames('Кадзунори Ито,   Мамору Осии  ', BY_NAME);

    expect(linked(parts)).toHaveLength(1);
    expect(linked(parts)[0].slug).toBe('mamoru-oshii');
  });

  it('совпадение точное: переставленное имя ссылкой не становится', () => {
    expect(linked(linkNames('Осии Мамору', BY_NAME))).toHaveLength(0);
  });

  it('совпадение целиком: имя внутри более длинного куска ссылкой не становится', () => {
    expect(linked(linkNames('Мамору Осии-младший', BY_NAME))).toHaveLength(0);
    expect(linked(linkNames('режиссёр Мамору Осии', BY_NAME))).toHaveLength(0);
  });

  it('пустая карта: ни одного куска со slug, поле не изменилось', () => {
    const field = 'Мамору Осии, Ацуко Танака';
    const parts = linkNames(field, new Map());

    expect(linked(parts)).toHaveLength(0);
    expect(joined(parts)).toBe(field);
  });

  it('пустое поле даёт пустую склейку и ни одной ссылки', () => {
    const parts = linkNames('', BY_NAME);

    expect(joined(parts)).toBe('');
    expect(linked(parts)).toHaveLength(0);
  });
});

// ── Дополнение v11: кредит фотографии ────────────────────────────────────────
// Номера критериев в этом блоке — версии v11, а не версии v7, которой пронумерована
// шапка файла.
//
// 10 — снимок и указание автора существуют только вместе. Валидатор возвращает
//      `photo-credit` на фотографию без кредита и `photo-orphan` на кредит без
//      фотографии. Первое — главный запрет версии: оба отобранных портрета идут
//      под CC BY-SA 4.0, которая требует назвать автора, и валидатор — единственное
//      место, где снимок без указания можно остановить до базы.
// 11 — форма кредита: непустой автор, непустое название лицензии, оба адреса
//      начинаются с `http://` или `https://`. Всё прочее — `photo-credit-field`.
//
// Контракт версии, добавляемый к модулю '@/lib/people':
//   type PhotoCredit = { author: string; licence: string; licenceUrl: string;
//                        fileUrl: string; modified: boolean };
//   PersonInput получает photoPath?: string | null и photoCredit?: PhotoCredit | null;
//   PersonError получает 'photo-credit' | 'photo-orphan' | 'photo-credit-field'.
//
// Каждое нарушение проверяется отдельным ожиданием на записи, корректной во всём
// остальном: порядок проверок внутри валидатора — деталь реализации, и тест от него
// не зависит.

/** Путь к снимку — такой же, как у портрета Осии в public. */
const PHOTO = '/people/mamoru-oshii.jpg';

/** Кредит портрета Осии: данные проверены через программный интерфейс Викисклада.
 *  Имя автора не переводится и не транслитерируется — это указание авторства,
 *  а не текст о человеке. */
const CREDIT = {
  author: 'Niccolò Caranti',
  licence: 'CC BY-SA 4.0',
  licenceUrl: 'https://creativecommons.org/licenses/by-sa/4.0/',
  fileUrl: 'https://commons.wikimedia.org/wiki/File:Mamoru_Oshii.jpg',
  modified: true,
};

describe('validatePerson: снимок и кредит существуют только вместе (критерий 10 версии v11)', () => {
  it('снимок без кредита отклоняется — это и есть запрет, ради которого версия делается', () => {
    expect(validatePerson(person({ photoPath: PHOTO, photoCredit: null }))).toBe('photo-credit');
  });

  it('снимок при отсутствующем поле кредита отклоняется так же', () => {
    expect(validatePerson(person({ photoPath: PHOTO, photoCredit: undefined }))).toBe('photo-credit');
  });

  it('кредит без снимка отклоняется: описывать ему нечего', () => {
    expect(validatePerson(person({ photoPath: null, photoCredit: CREDIT }))).toBe('photo-orphan');
  });

  it('кредит при отсутствующем поле снимка отклоняется так же', () => {
    expect(validatePerson(person({ photoPath: undefined, photoCredit: CREDIT }))).toBe('photo-orphan');
  });

  it('ни снимка, ни кредита — законное состояние: у Моко-тян фотографии нет', () => {
    expect(validatePerson(person({ photoPath: null, photoCredit: null }))).toBeNull();
    expect(validatePerson(person({ photoPath: undefined, photoCredit: undefined }))).toBeNull();
  });

  it('снимок с полным кредитом проходит', () => {
    expect(validatePerson(person({ photoPath: PHOTO, photoCredit: CREDIT }))).toBeNull();
  });

  it('неизменённый снимок — не ошибка: modified: false законное значение', () => {
    expect(
      validatePerson(person({ photoPath: PHOTO, photoCredit: { ...CREDIT, modified: false } })),
    ).toBeNull();
  });
});

describe('validatePerson: форма кредита (критерий 11 версии v11)', () => {
  /** Запись со снимком и кредитом, у которого испорчено ровно одно поле. */
  const withCredit = (patch: Partial<typeof CREDIT>) =>
    validatePerson(person({ photoPath: PHOTO, photoCredit: { ...CREDIT, ...patch } }));

  it('пустой автор отклоняется', () => {
    expect(withCredit({ author: '' })).toBe('photo-credit-field');
  });

  it('автор из одних пробелов отклоняется — как nameRu и подпись ссылки рядом', () => {
    expect(withCredit({ author: '   ' })).toBe('photo-credit-field');
  });

  it('пустое название лицензии отклоняется', () => {
    expect(withCredit({ licence: '' })).toBe('photo-credit-field');
    expect(withCredit({ licence: '  ' })).toBe('photo-credit-field');
  });

  it('адрес лицензии без схемы отклоняется', () => {
    for (const licenceUrl of [
      '',
      '   ',
      'creativecommons.org/licenses/by-sa/4.0/',
      '//creativecommons.org/licenses/by-sa/4.0/',
      '/licenses/by-sa/4.0/',
      'ftp://creativecommons.org/',
      'javascript:alert(1)',
    ]) {
      expect(withCredit({ licenceUrl }), `адрес лицензии «${licenceUrl}»`).toBe('photo-credit-field');
    }
  });

  it('адрес страницы описания файла без схемы отклоняется', () => {
    for (const fileUrl of [
      '',
      '   ',
      'commons.wikimedia.org/wiki/File:Mamoru_Oshii.jpg',
      '//commons.wikimedia.org/wiki/File:Mamoru_Oshii.jpg',
      '/wiki/File:Mamoru_Oshii.jpg',
      'ftp://commons.wikimedia.org/',
    ]) {
      expect(withCredit({ fileUrl }), `адрес файла «${fileUrl}»`).toBe('photo-credit-field');
    }
  });

  it('обе схемы, http и https, принимаются в обоих адресах', () => {
    expect(withCredit({ licenceUrl: 'http://creativecommons.org/licenses/by-sa/4.0/' })).toBeNull();
    expect(withCredit({ fileUrl: 'http://commons.wikimedia.org/wiki/File:X.jpg' })).toBeNull();
    expect(
      withCredit({
        licenceUrl: 'https://creativecommons.org/licenses/by-sa/4.0/',
        fileUrl: 'https://commons.wikimedia.org/wiki/File:X.jpg',
      }),
    ).toBeNull();
  });

  it('испорченное поле у заданного снимка — ошибка формы, а не отсутствия кредита', () => {
    expect(withCredit({ author: '' })).not.toBe('photo-credit');
    expect(withCredit({ licenceUrl: 'нет' })).not.toBe('photo-credit');
  });

  it('кредит второго портрета — Лантимоса — проходит целиком', () => {
    expect(
      validatePerson(
        person({
          slug: 'yorgos-lanthimos',
          nameRu: 'Йоргос Лантимос',
          photoPath: '/people/yorgos-lanthimos.jpg',
          photoCredit: {
            author: 'Harald Krichel',
            licence: 'CC BY-SA 4.0',
            licenceUrl: 'https://creativecommons.org/licenses/by-sa/4.0/',
            fileUrl: 'https://commons.wikimedia.org/wiki/File:Yorgos_Lanthimos.jpg',
            modified: true,
          },
        }),
      ),
    ).toBeNull();
  });
});
