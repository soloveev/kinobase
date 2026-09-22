// Критерии приёмки 1, 2, 3, 5, 6, 7, 9, 10, 11 и 12 версии v4 на уровне агентской зоны
// карточки фильма:
// 1 — у вышедшего непросмотренного фильма две секции, раскрыта «Зачем смотреть»;
// 2 — у просмотренного раскрыта «После просмотра», «Зачем смотреть» свёрнута;
// 3 — у невышедшего секции «После просмотра» нет вовсе и заглушкой она не заменяется;
// 5 — свёрнутая секция показывает оглавление своих рубрик через точку-разделитель;
// 6 — рубрики идут в порядке словаря, каждая со своим заголовком;
// 7 — внутри рубрики отображаются подзаголовки, абзацы и списки, а внутри абзаца и
//     пункта списка работают полужирный и ссылка, открывающаяся в новой вкладке;
// 9, 10 — строка о материалах агента показывает предупреждение, только когда материалы
//     устарели: у свежих её нет вовсе. ВНИМАНИЕ: критерий 9 версии v4 в прежней редакции
//     требовал обратного — «строка показывает дату последнего поиска». Он переписан в v5
//     по решению владельца (спека specs/v4/spec.md правится вместе с этими тестами):
//     служебная подпись «Материалы агента · собраны 22 августа 2026» в обычном случае
//     не отвечает ни на один вопрос читателя и только занимает первую строку зоны.
//     Это осознанная замена, а не регрессия;
// 11 — «Источники» свёрнуты, показывают счётчик, ссылки внешние и открываются в новой вкладке;
// 12 — фильм без досье не рендерит агентскую зону вовсе.
//
// Контракт компонента: <DossierZone film={film} today={today} />, default export
// из '@/components/DossierZone'. Обычный серверный компонент без хуков и без обращения
// к базе: статус и свежесть он считает сам из переданных пропов — это шов, по которому
// зона проверяется в jsdom. Дата фиксирована, чтобы результат не зависел от сегодняшнего дня.
//
// Подзаголовок внутри рубрики проверяется по роли заголовка, а не по конкретному тегу:
// спека называет его подзаголовком, а глубина вложенности — дело вёрстки.
//
// v15 «Ключи» (specs/v15/spec.md, раздел C) добавляет третью полосу — «Важные вещи
// о фильме» — между подготовкой и разбором, и меняет правило раскрытия: у просмотренного
// раскрыты ключи и разбор, у всех прочих — только подготовка. Критерии приёмки 4–7.
//
// Заодно v15 убирает из словаря рубрику `theses` («Фильм в пяти тезисах»): её текст
// переезжает в блок ключей (спека, раздел A; план, задача 1, шаг 3). Фикстура блока
// «После просмотра» держала именно её, и здесь она заменена на «Форму» — рубрику,
// которая в словаре остаётся. Это не смена критерия, а следствие: тесты на порядок
// рубрик и на список внутри рубрики проверяют то же самое, но на живой рубрике.

import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import DossierZone from '@/components/DossierZone';
import { makeFilm } from './helpers';
import type { DossierFragment, DossierNode, DossierSource, FilmWithDossier } from './helpers';

afterEach(() => {
  cleanup();
});

const TODAY = '2026-08-22';
const RELEASED = '2001-04-11';
const NOT_RELEASED = '2030-01-01';

// Фрагменты записаны не в порядке словаря — порядок показа задаёт словарь.
const BEFORE: DossierFragment[] = [
  {
    key: 'experience',
    body: [
      { type: 'p', text: 'Медленный и созерцательный, без передышек к финалу.' },
      {
        type: 'ul',
        items: [
          '**Свет.** Открытое пространство становится страшным.',
          'Тишина работает как приём — [короткий разбор](https://example.com/sound).',
        ],
      },
    ],
  },
  {
    key: 'why',
    body: [
      { type: 'p', text: 'Первый фильм **Аронофски** за десять лет.' },
      { type: 'p', text: 'О замысле — [интервью режиссёра](https://example.com/interview).' },
    ],
  },
];

const AFTER: DossierFragment[] = [
  {
    key: 'place',
    body: [
      { type: 'h', text: 'Рифмы' },
      { type: 'p', text: 'Продолжает линию ранних работ автора.' },
    ],
  },
  {
    key: 'themes',
    body: [
      { type: 'h', text: 'Вера возникает там, где заканчивается знание' },
      { type: 'p', text: 'Тема держится на одном кадре и на разговоре о нём.' },
    ],
  },
  {
    key: 'form',
    body: [
      {
        type: 'ul',
        items: ['Фильм о пределе знания.', 'Главный принцип — отказ от объяснения.'],
      },
    ],
  },
];

/** Блок ключей: ровно одна рубрика `keys`, тело — один список из пяти-семи пунктов
 *  (спека v15, раздел A). Пять — нижняя граница, её и берём: форма от числа не зависит. */
const KEY_ITEMS = [
  '**Граница.** Героиня стоит сразу на нескольких границах — расовой, сословной, гендерной.',
  '**Цена пути.** Сюжет держится не на цели мести, а на том, чем за неё платят.',
  '**Ремесло.** Кузница снята как производство, и это единственные спокойные сцены фильма.',
  '**Закрытая страна.** Действие идёт в годы, когда за въезд чужака полагалась смерть.',
  '**Свет.** Ночь освещена одним источником, и темнота вокруг него — расчёт, а не стилизация.',
];

const KEYS: DossierFragment[] = [{ key: 'keys', body: [{ type: 'ul', items: KEY_ITEMS }] }];

/** Кусок первого пункта без разметки — чтобы проверять присутствие содержимого блока
 *  в разметке, не завися от того, как разобран полужирный лид. */
const KEYS_PROBE = 'Героиня стоит сразу на нескольких границах';

const SOURCES: DossierSource[] = [
  { publication: 'Variety', title: 'Рецензия на фильм', url: 'https://variety.com/review' },
  { publication: 'The Guardian', title: 'Интервью с режиссёром', url: 'https://theguardian.com/i' },
];

/** Названия рубрик заданы спекой дословно, порядок — словарём. */
const BEFORE_LABELS = ['Почему это может быть интересно', 'Какого опыта ждать'];
const AFTER_LABELS = ['Смыслы и темы', 'Форма', 'Место фильма'];

/** Колонка `dossierKeys` появляется в схеме задачей 2 версии v15, а фабрика фильма
 *  живёт в общем `tests/helpers.ts`, который правит другой исполнитель. Поэтому поле
 *  дописывается здесь поверх фабрики: тип-пересечение, а не правка общего файла.
 *  Когда `Film` получит колонку, пересечение сойдётся с ним и ничего не изменит. */
type FilmWithKeys = FilmWithDossier & { dossierKeys: DossierFragment[] | null };

function dossierFilm(overrides: Partial<FilmWithKeys> = {}): FilmWithKeys {
  // Блока ключей по умолчанию нет: это законное состояние (досье старой формы,
  // до переноса), и на нём стоят все проверки прежних двух полос.
  const { dossierKeys = null, ...rest } = overrides;

  return {
    ...makeFilm({
      id: 1,
      titleRu: 'Фильм',
      releaseDate: RELEASED,
      watched: false,
      dossierBefore: BEFORE,
      dossierAfter: AFTER,
      dossierSearchedAt: '2026-08-01',
      ...rest,
    }),
    dossierKeys,
  };
}

const keysFilm = (overrides: Partial<FilmWithKeys> = {}): FilmWithKeys =>
  dossierFilm({ dossierKeys: KEYS, ...overrides });

const sectionToggle = (title: RegExp): HTMLElement | null =>
  screen.queryByRole('button', { name: title });

const BEFORE_SECTION = /Зачем смотреть/i;
const AFTER_SECTION = /После просмотра/i;
const KEYS_SECTION = /Важные вещи о фильме/i;
const SOURCES_SECTION = /Источники/i;

/** Русская дата в любом месте разметки — чтобы проверять её отсутствие, не завися
 *  от формулировки строки. */
const RUSSIAN_DATE =
  /\d{1,2} (января|февраля|марта|апреля|мая|июня|июля|августа|сентября|октября|ноября|декабря) \d{4}/;

/** Позиция первого вхождения текста в разметку — чтобы проверять порядок рубрик,
 *  не завися от конкретных тегов вёрстки. */
function positionOf(container: HTMLElement, needle: string): number {
  const found = (container.textContent ?? '').indexOf(needle);
  expect(found, `в разметке нет текста «${needle}»`).toBeGreaterThanOrEqual(0);
  return found;
}

function expectOrder(container: HTMLElement, labels: string[]) {
  for (let i = 1; i < labels.length; i += 1) {
    expect(
      positionOf(container, labels[i - 1]),
      `«${labels[i - 1]}» должна идти до «${labels[i]}»`,
    ).toBeLessThan(positionOf(container, labels[i]));
  }
}

describe('Вышедший непросмотренный фильм (критерий 1)', () => {
  it('показаны обе агентские секции', () => {
    render(<DossierZone film={dossierFilm()} today={TODAY} />);

    expect(sectionToggle(BEFORE_SECTION)).not.toBeNull();
    expect(sectionToggle(AFTER_SECTION)).not.toBeNull();
  });

  it('раскрыта «Зачем смотреть», «После просмотра» свёрнута', () => {
    render(<DossierZone film={dossierFilm()} today={TODAY} />);

    expect(sectionToggle(BEFORE_SECTION)).toHaveAttribute('aria-expanded', 'true');
    expect(sectionToggle(AFTER_SECTION)).toHaveAttribute('aria-expanded', 'false');
  });

  it('содержимое раскрытого блока «Зачем смотреть» видно сразу', () => {
    render(<DossierZone film={dossierFilm()} today={TODAY} />);

    expect(screen.getByRole('heading', { name: BEFORE_LABELS[0] })).toBeInTheDocument();
    expect(screen.getByText('Медленный и созерцательный, без передышек к финалу.')).toBeInTheDocument();
  });

  it('без источников секции «Источники» нет', () => {
    render(<DossierZone film={dossierFilm({ dossierSources: null })} today={TODAY} />);

    expect(sectionToggle(SOURCES_SECTION)).toBeNull();
  });

  it('блока, которого нет в базе, секцией не подменяют', () => {
    render(<DossierZone film={dossierFilm({ dossierAfter: null })} today={TODAY} />);

    expect(sectionToggle(BEFORE_SECTION)).not.toBeNull();
    expect(sectionToggle(AFTER_SECTION)).toBeNull();
  });
});

describe('Просмотренный фильм (критерий 2)', () => {
  const watched = () => dossierFilm({ watched: true });

  it('раскрыта «После просмотра», «Зачем смотреть» свёрнута', () => {
    render(<DossierZone film={watched()} today={TODAY} />);

    expect(sectionToggle(AFTER_SECTION)).toHaveAttribute('aria-expanded', 'true');
    expect(sectionToggle(BEFORE_SECTION)).toHaveAttribute('aria-expanded', 'false');
  });

  it('содержимое раскрытого блока «После просмотра» видно сразу', () => {
    render(<DossierZone film={watched()} today={TODAY} />);

    expect(screen.getByRole('heading', { name: 'Смыслы и темы' })).toBeInTheDocument();
    expect(screen.getByText('Тема держится на одном кадре и на разговоре о нём.')).toBeInTheDocument();
  });
});

describe('Невышедший фильм (критерий 3)', () => {
  const waiting = () => dossierFilm({ releaseDate: NOT_RELEASED, watched: false });

  it('секции «После просмотра» нет вовсе, даже если блок в базе есть', () => {
    render(<DossierZone film={waiting()} today={TODAY} />);

    expect(sectionToggle(AFTER_SECTION)).toBeNull();
  });

  it('заглушкой секция не заменяется — ни оглавления, ни содержимого блока на странице нет', () => {
    const { container } = render(<DossierZone film={waiting()} today={TODAY} />);

    for (const label of AFTER_LABELS) {
      expect(container.textContent, `рубрики «${label}» быть не должно`).not.toContain(label);
    }
    expect(container.textContent).not.toContain('Вера возникает там, где заканчивается знание');
  });

  it('«Зачем смотреть» на месте и раскрыта', () => {
    render(<DossierZone film={waiting()} today={TODAY} />);

    expect(sectionToggle(BEFORE_SECTION)).toHaveAttribute('aria-expanded', 'true');
  });
});

describe('Рубрики внутри блока (критерий 6)', () => {
  it('каждая рубрика показана своим заголовком', () => {
    render(<DossierZone film={dossierFilm()} today={TODAY} />);

    for (const label of BEFORE_LABELS) {
      expect(screen.getByRole('heading', { name: label })).toBeInTheDocument();
    }
  });

  it('рубрики «Зачем смотреть» идут в порядке словаря, а не в порядке записи в базе', () => {
    const { container } = render(<DossierZone film={dossierFilm()} today={TODAY} />);

    expectOrder(container, BEFORE_LABELS);
  });

  it('рубрики «После просмотра» тоже идут в порядке словаря', () => {
    const { container } = render(<DossierZone film={dossierFilm({ watched: true })} today={TODAY} />);

    for (const label of AFTER_LABELS) {
      expect(screen.getByRole('heading', { name: label })).toBeInTheDocument();
    }
    expectOrder(container, AFTER_LABELS);
  });
});

describe('Устройство текста рубрики (критерий 7)', () => {
  it('подзаголовок внутри рубрики — заголовок', () => {
    render(<DossierZone film={dossierFilm({ watched: true })} today={TODAY} />);

    expect(
      screen.getByRole('heading', { name: 'Вера возникает там, где заканчивается знание' }),
    ).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Рифмы' })).toBeInTheDocument();
  });

  it('абзац рендерится абзацем', () => {
    render(<DossierZone film={dossierFilm()} today={TODAY} />);

    const text = screen.getByText('Медленный и созерцательный, без передышек к финалу.');

    expect(text.closest('p'), 'абзац должен лежать в <p>').not.toBeNull();
  });

  it('список рендерится списком, каждый пункт — пунктом', () => {
    render(<DossierZone film={dossierFilm({ watched: true })} today={TODAY} />);

    const item = screen.getByText('Фильм о пределе знания.').closest('li');

    expect(item, 'пункт должен лежать в <li>').not.toBeNull();
    expect(item!.closest('ul'), 'пункты должны лежать в <ul>').not.toBeNull();
    expect(screen.getByText('Главный принцип — отказ от объяснения.').closest('li')).not.toBeNull();
  });

  it('полужирный внутри абзаца — <strong>', () => {
    render(<DossierZone film={dossierFilm()} today={TODAY} />);

    expect(screen.getByText('Аронофски').tagName).toBe('STRONG');
  });

  it('полужирный внутри пункта списка — <strong>', () => {
    render(<DossierZone film={dossierFilm()} today={TODAY} />);

    expect(screen.getByText('Свет.').tagName).toBe('STRONG');
  });

  it('служебные символы разметки в текст не попадают', () => {
    const { container } = render(<DossierZone film={dossierFilm()} today={TODAY} />);

    expect(container.textContent).not.toContain('**');
    expect(container.textContent).not.toContain('](https://');
  });

  it('ссылка внутри абзаца ведёт на внешний адрес и открывается в новой вкладке', () => {
    render(<DossierZone film={dossierFilm()} today={TODAY} />);

    const link = screen.getByRole('link', { name: 'интервью режиссёра' });

    expect(link).toHaveAttribute('href', 'https://example.com/interview');
    expect(link).toHaveAttribute('target', '_blank');
    expect(link.getAttribute('rel') ?? '').toContain('noopener');
  });

  it('ссылка внутри пункта списка ведёт на внешний адрес и открывается в новой вкладке', () => {
    render(<DossierZone film={dossierFilm()} today={TODAY} />);

    const link = screen.getByRole('link', { name: 'короткий разбор' });

    expect(link).toHaveAttribute('href', 'https://example.com/sound');
    expect(link).toHaveAttribute('target', '_blank');
    expect(link.getAttribute('rel') ?? '').toContain('noopener');
  });
});

// Врезка — голос создателя фильма (режиссёр, актёр, оператор, монтажёр, постановщик
// трюков). Разметка внутри строки в ней не разбирается, как и в подзаголовке. Фикстуры
// у врезки свои: текст со звёздочками нужен только здесь и не должен попадать в общие
// проверки о служебных символах.
describe('Врезка-цитата внутри рубрики', () => {
  const QUOTE_TEXT = 'Мы искали не красоту, а неудобство.';
  const QUOTE_AUTHOR = 'Мэттью Либатик, оператор';

  const withQuote = (
    node: DossierNode = { type: 'quote', text: QUOTE_TEXT, author: QUOTE_AUTHOR },
  ) =>
    dossierFilm({
      dossierBefore: [
        { key: 'why', body: [{ type: 'p', text: 'Абзац перед врезкой.' }, node] },
      ],
      dossierAfter: null,
    });

  it('текст цитаты и имя автора видны', () => {
    render(<DossierZone film={withQuote()} today={TODAY} />);

    expect(screen.getByText(QUOTE_TEXT)).toBeInTheDocument();
    expect(screen.getByText(QUOTE_AUTHOR)).toBeInTheDocument();
  });

  it('врезка — отдельный узел <blockquote>, а не обычный абзац', () => {
    const { container } = render(<DossierZone film={withQuote()} today={TODAY} />);

    const blockquote = container.querySelector('blockquote');

    expect(blockquote, 'врезка должна лежать в <blockquote>').not.toBeNull();
    expect(blockquote!.textContent).toContain(QUOTE_TEXT);
    expect(blockquote!.textContent).toContain(QUOTE_AUTHOR);
  });

  it('соседний абзац во врезку не затягивается', () => {
    const { container } = render(<DossierZone film={withQuote()} today={TODAY} />);

    expect(container.querySelector('blockquote')!.textContent).not.toContain(
      'Абзац перед врезкой.',
    );
  });

  it('разметка внутри врезки не разбирается — звёздочки выводятся буквально', () => {
    const literal = '**Свет** и [ссылка](https://example.com/x) остаются текстом.';
    const film = withQuote({ type: 'quote', text: literal, author: QUOTE_AUTHOR });

    const { container } = render(<DossierZone film={film} today={TODAY} />);

    expect(screen.getByText(literal)).toBeInTheDocument();
    expect(container.querySelector('blockquote')!.querySelector('strong')).toBeNull();
    expect(container.querySelector('blockquote')!.querySelector('a')).toBeNull();
  });
});

// Справка-врезка вводит неискушённого читателя в предмет: что за место, кто этот
// режиссёр. Она не пункт списка и не абзац — отдельный блок, который видно глазом,
// поэтому у неё свой узел. Разметка внутри строки ей нужна: справка ссылается.
describe('Справка-врезка внутри рубрики', () => {
  const NOTE_TEXT = 'Город-крепость Коулун снесли в 1994 году.';

  const withNote = (text = NOTE_TEXT) =>
    dossierFilm({
      dossierBefore: [{ key: 'why', body: [{ type: 'note', text }] }],
      dossierAfter: null,
    });

  it('текст справки виден', () => {
    render(<DossierZone film={withNote()} today={TODAY} />);

    expect(screen.getByText(NOTE_TEXT)).toBeInTheDocument();
  });

  it('справка — не врезка-цитата: <blockquote> не появляется', () => {
    const { container } = render(<DossierZone film={withNote()} today={TODAY} />);

    expect(container.querySelector('blockquote')).toBeNull();
  });

  it('справка отделена от обычного абзаца — у неё свой блок в разметке', () => {
    const { container } = render(<DossierZone film={withNote()} today={TODAY} />);

    const note = container.querySelector('[data-note]');
    expect(note, 'справку должно быть видно глазом, а не только по смыслу').not.toBeNull();
    expect(note!.textContent).toContain(NOTE_TEXT);
  });

  it('разметка внутри справки разбирается — ссылка становится ссылкой', () => {
    const film = withNote('Крепость снесли, [хроника сноса](https://example.com/kwc).');

    const { container } = render(<DossierZone film={film} today={TODAY} />);

    const link = container.querySelector('a[href="https://example.com/kwc"]');
    expect(link, 'справка обязана уметь ссылаться').not.toBeNull();
    expect(link!.textContent).toBe('хроника сноса');
  });
});

describe('Оглавление свёрнутых секций (критерий 5)', () => {
  it('свёрнутая секция перечисляет свои рубрики через точку-разделитель', () => {
    render(<DossierZone film={dossierFilm()} today={TODAY} />);

    expect(sectionToggle(AFTER_SECTION)).toHaveTextContent(AFTER_LABELS.join(' · '));
  });

  it('оглавление перечисляет только те рубрики, что есть в блоке', () => {
    render(<DossierZone film={dossierFilm()} today={TODAY} />);

    expect(sectionToggle(AFTER_SECTION)).not.toHaveTextContent('Критика');
  });

  it('у раскрытой секции оглавления нет', () => {
    render(<DossierZone film={dossierFilm()} today={TODAY} />);

    expect(sectionToggle(BEFORE_SECTION)).not.toHaveTextContent('Какого опыта ждать');
  });
});

// Критерий 9 переписан в v5 (см. шапку файла): строка о материалах агента живёт
// в зоне только как предупреждение. Три случая, из которых меняется ровно один —
// свежие материалы перестают показывать дату:
//   свежие          — строки нет, зона начинается сразу с секции «Зачем смотреть»;
//   устарели        — строка есть: дата последнего похода и что пора обновить;
//   даты поиска нет — строки нет, как и было.
describe('Строка о материалах агента — только предупреждение (критерии 9 и 10)', () => {
  it('у свежих материалов даты последнего поиска в зоне нет', () => {
    const { container } = render(<DossierZone film={dossierFilm()} today={TODAY} />);

    expect(container.textContent).not.toContain('1 августа 2026');
    expect(container.textContent).not.toMatch(RUSSIAN_DATE);
  });

  it('служебной подписи «собраны …» у свежих материалов тоже нет', () => {
    const { container } = render(<DossierZone film={dossierFilm()} today={TODAY} />);

    expect(container.textContent).not.toMatch(/собран/i);
  });

  it('зона свежих материалов начинается сразу с секции «Зачем смотреть»', () => {
    const { container } = render(<DossierZone film={dossierFilm()} today={TODAY} />);

    expect((container.textContent ?? '').trimStart()).toMatch(/^Зачем смотреть/);
  });

  it('у свежих материалов об устаревании не сообщается', () => {
    const { container } = render(<DossierZone film={dossierFilm()} today={TODAY} />);

    expect(container.textContent).not.toMatch(/устарел/i);
  });

  it('если фильм вышел позже последнего поиска, строка сообщает об устаревании', () => {
    const stale = dossierFilm({ releaseDate: '2026-01-15', dossierSearchedAt: '2025-11-01' });
    const { container } = render(<DossierZone film={stale} today={TODAY} />);

    expect(container.textContent).toContain('1 ноября 2025');
    expect(container.textContent).toMatch(/обновить/i);
  });

  it('предупреждение объясняет, почему материалы устарели: поход был до выхода фильма', () => {
    const stale = dossierFilm({ releaseDate: '2026-01-15', dossierSearchedAt: '2025-11-01' });
    const { container } = render(<DossierZone film={stale} today={TODAY} />);

    expect(container.textContent).toMatch(/до выхода фильма/i);
  });

  it('без даты поиска строки с датой нет, а секции остаются на месте', () => {
    const { container } = render(
      <DossierZone film={dossierFilm({ dossierSearchedAt: null })} today={TODAY} />,
    );

    expect(container.textContent).not.toMatch(RUSSIAN_DATE);
    expect(sectionToggle(BEFORE_SECTION)).not.toBeNull();
  });
});

describe('Источники (критерий 11)', () => {
  const withSources = () => dossierFilm({ dossierSources: SOURCES });

  it('секция свёрнута по умолчанию и показывает счётчик источников', () => {
    render(<DossierZone film={withSources()} today={TODAY} />);

    const toggle = sectionToggle(SOURCES_SECTION);
    expect(toggle).not.toBeNull();
    expect(toggle).toHaveAttribute('aria-expanded', 'false');
    expect(toggle).toHaveTextContent(/2 источник/i);
  });

  it('пока секция свёрнута, ссылок на источники нет', () => {
    render(<DossierZone film={withSources()} today={TODAY} />);

    for (const source of SOURCES) {
      expect(screen.queryByRole('link', { name: new RegExp(source.title, 'i') })).toBeNull();
    }
  });

  it('после раскрытия каждая ссылка ведёт на внешний адрес и открывается в новой вкладке', () => {
    render(<DossierZone film={withSources()} today={TODAY} />);

    fireEvent.click(sectionToggle(SOURCES_SECTION)!);

    for (const source of SOURCES) {
      const link = screen.getByRole('link', { name: new RegExp(source.title, 'i') });

      expect(link).toHaveAttribute('href', source.url);
      expect(link).toHaveAttribute('target', '_blank');
      expect(link.getAttribute('rel') ?? '').toContain('noopener');
    }
  });

  it('раскрытая секция называет издание и заголовок каждого источника', () => {
    const { container } = render(<DossierZone film={withSources()} today={TODAY} />);

    fireEvent.click(sectionToggle(SOURCES_SECTION)!);

    for (const source of SOURCES) {
      expect(container.textContent).toContain(source.publication);
      expect(container.textContent).toContain(source.title);
    }
  });
});

describe('Фильм без досье (критерий 12)', () => {
  const bare = () => makeFilm({ id: 7, titleRu: 'Без досье', releaseDate: RELEASED });

  it('агентская зона не рендерит ничего', () => {
    const { container } = render(<DossierZone film={bare()} today={TODAY} />);

    expect(container.textContent?.trim()).toBe('');
    expect(screen.queryAllByRole('button')).toHaveLength(0);
  });

  it('строки с датой поиска у такого фильма тоже нет', () => {
    const { container } = render(<DossierZone film={bare()} today={TODAY} />);

    expect(container.textContent).not.toMatch(RUSSIAN_DATE);
  });
});

// Дополнение v5, критерий приёмки 18: плашку «агенты ещё не собрали информацию»
// рендерит страница фильма в конце читательской зоны при `!hasDossier(film)`, а не
// сама агентская зона. Здесь проверяется только граница ответственности: у тайтла
// с досье текста плашки в зоне нет, а у тайтла без досье зона по-прежнему пуста —
// значит плашке есть где встать и она не задвоится. Сам компонент и его текст
// проверяются в plaques.test.tsx.
describe('Плашка «информация не собрана» — не дело агентской зоны (критерий 18)', () => {
  const NOTICE_START = 'Агенты ещё не собрали информацию о фильме';

  it('у тайтла с досье зона плашку не показывает', () => {
    const { container } = render(<DossierZone film={dossierFilm()} today={TODAY} />);

    expect(container.textContent).not.toContain(NOTICE_START);
  });

  it('у тайтла с одним только блоком «Зачем смотреть» плашки тоже нет', () => {
    const { container } = render(
      <DossierZone film={dossierFilm({ dossierAfter: null })} today={TODAY} />,
    );

    expect(container.textContent).not.toContain(NOTICE_START);
  });

  it('у тайтла без досье зона остаётся пустой — место для плашки освобождает страница', () => {
    const bare = makeFilm({ id: 8, titleRu: 'Без досье', releaseDate: RELEASED });
    const { container } = render(<DossierZone film={bare} today={TODAY} />);

    expect(container.textContent?.trim()).toBe('');
  });
});

// ————————————————————————————————————————————————————————————————————————
// Версия 15 «Ключи», спека раздел C, критерии приёмки 4–7.
//
// Третья полоса «Важные вещи о фильме» встаёт между подготовкой и разбором, стоит
// на пастельной плашке (тон проверяется в dossier-section.test.tsx, цвет — живым
// прогоном, не тестом) и раскрывается по новому правилу: у просмотренного раскрыты
// ключи и разбор, у всех прочих — только подготовка.

describe('Три полосы досье (v15, критерий C)', () => {
  it('полосы идут в порядке чтения: подготовка, ключи, разбор', () => {
    render(<DossierZone film={keysFilm()} today={TODAY} />);

    const titles = screen.getAllByRole('button').map((button) => button.textContent ?? '');

    expect(titles).toHaveLength(3);
    expect(titles[0]).toContain('Зачем смотреть');
    expect(titles[1]).toContain('Важные вещи о фильме');
    expect(titles[2]).toContain('После просмотра');
  });

  it('в разметке ключи стоят между подготовкой и разбором', () => {
    const { container } = render(<DossierZone film={keysFilm({ watched: true })} today={TODAY} />);

    expectOrder(container, ['Зачем смотреть', 'Важные вещи о фильме', 'После просмотра']);
  });

  it('«Источники» остаются последними, ниже всех трёх полос', () => {
    render(<DossierZone film={keysFilm({ dossierSources: SOURCES })} today={TODAY} />);

    const titles = screen.getAllByRole('button').map((button) => button.textContent ?? '');

    expect(titles).toHaveLength(4);
    expect(titles[3]).toContain('Источники');
  });

  it('содержимое раскрытой полосы ключей видно', () => {
    const { container } = render(<DossierZone film={keysFilm({ watched: true })} today={TODAY} />);

    expect(container.textContent).toContain(KEYS_PROBE);
  });

  it('пункты ключей — список, каждый пункт в своём <li>', () => {
    render(<DossierZone film={keysFilm({ watched: true })} today={TODAY} />);

    const item = screen.getByText(KEYS_PROBE, { exact: false }).closest('li');

    expect(item, 'пункт ключей должен лежать в <li>').not.toBeNull();
    expect(item!.closest('ul'), 'пункты ключей должны лежать в <ul>').not.toBeNull();
  });
});

// Критерий 7: в блоке ровно одна рубрика, и её заголовок совпадает с заголовком полосы.
// Печатать его внутри — задваивать. Проверяется на просмотренном фильме: там полоса
// раскрыта, и лишний рубричный заголовок был бы виден.
describe('Заголовок рубрики ключей не печатается (v15, критерий 7)', () => {
  it('в раскрытой полосе заголовок «Важные вещи о фильме» ровно один', () => {
    render(<DossierZone film={keysFilm({ watched: true })} today={TODAY} />);

    expect(screen.getAllByText('Важные вещи о фильме')).toHaveLength(1);
  });

  it('в свёрнутой полосе он тоже один — подсказка его не повторяет', () => {
    render(<DossierZone film={keysFilm()} today={TODAY} />);

    expect(screen.getAllByText('Важные вещи о фильме')).toHaveLength(1);
  });

  it('заголовок полосы назван дословно', () => {
    render(<DossierZone film={keysFilm()} today={TODAY} />);

    expect(sectionToggle(KEYS_SECTION)).not.toBeNull();
  });
});

// Критерий 4. Прежнее правило «раскрыт ровно один блок» отменено: у просмотренного
// раскрыты два. Довод у второй строки таблицы — спойлеры: выбирающий не должен
// получить финал первым же экраном.
describe('Правило раскрытия полос (v15, критерий 4)', () => {
  it('у просмотренного раскрыты ключи и разбор, подготовка свёрнута', () => {
    render(<DossierZone film={keysFilm({ watched: true })} today={TODAY} />);

    expect(sectionToggle(BEFORE_SECTION)).toHaveAttribute('aria-expanded', 'false');
    expect(sectionToggle(KEYS_SECTION)).toHaveAttribute('aria-expanded', 'true');
    expect(sectionToggle(AFTER_SECTION)).toHaveAttribute('aria-expanded', 'true');
  });

  it('у вышедшего непросмотренного раскрыта только подготовка', () => {
    render(<DossierZone film={keysFilm()} today={TODAY} />);

    expect(sectionToggle(BEFORE_SECTION)).toHaveAttribute('aria-expanded', 'true');
    expect(sectionToggle(KEYS_SECTION)).toHaveAttribute('aria-expanded', 'false');
    expect(sectionToggle(AFTER_SECTION)).toHaveAttribute('aria-expanded', 'false');
  });

  it('у отмеченного «хочу посмотреть» раскрыта только подготовка', () => {
    render(<DossierZone film={keysFilm({ wantToWatch: true })} today={TODAY} />);

    expect(sectionToggle(BEFORE_SECTION)).toHaveAttribute('aria-expanded', 'true');
    expect(sectionToggle(KEYS_SECTION)).toHaveAttribute('aria-expanded', 'false');
  });

  it('содержимое свёрнутой полосы ключей на странице не лежит', () => {
    const { container } = render(<DossierZone film={keysFilm()} today={TODAY} />);

    expect(container.textContent).not.toContain(KEYS_PROBE);
  });

  it('полоса ключей раскрывается щелчком, как соседние', () => {
    const { container } = render(<DossierZone film={keysFilm()} today={TODAY} />);

    fireEvent.click(sectionToggle(KEYS_SECTION)!);

    expect(sectionToggle(KEYS_SECTION)).toHaveAttribute('aria-expanded', 'true');
    expect(container.textContent).toContain(KEYS_PROBE);
  });
});

// Критерий 6. У соседних полос на месте подсказки стоит перечень рубрик; у ключей
// рубрика одна, и перечислять нечего — там предупреждение о спойлерах. Оно объясняет,
// почему полоса закрыта, когда соседняя открыта.
describe('Пометка о спойлерах на свёрнутой полосе ключей (v15, критерий 6)', () => {
  const SPOILERS = 'есть спойлеры';

  it('свёрнутая полоса ключей несёт пометку', () => {
    render(<DossierZone film={keysFilm()} today={TODAY} />);

    expect(screen.getByText(SPOILERS)).toBeInTheDocument();
    expect(sectionToggle(KEYS_SECTION)).toHaveTextContent(SPOILERS);
  });

  it('раскрытая полоса подсказки не показывает вовсе', () => {
    const { container } = render(<DossierZone film={keysFilm({ watched: true })} today={TODAY} />);

    expect(screen.queryByText(SPOILERS)).toBeNull();
    expect(container.textContent).not.toMatch(/спойлер/i);
  });

  it('пометка исчезает и возвращается вместе со сворачиванием', () => {
    render(<DossierZone film={keysFilm()} today={TODAY} />);

    fireEvent.click(sectionToggle(KEYS_SECTION)!);
    expect(screen.queryByText(SPOILERS)).toBeNull();

    fireEvent.click(sectionToggle(KEYS_SECTION)!);
    expect(screen.getByText(SPOILERS)).toBeInTheDocument();
  });

  it('у соседних полос пометки о спойлерах нет — там перечень рубрик', () => {
    render(<DossierZone film={keysFilm()} today={TODAY} />);

    expect(sectionToggle(AFTER_SECTION)).not.toHaveTextContent(SPOILERS);
    expect(sectionToggle(AFTER_SECTION)).toHaveTextContent(AFTER_LABELS.join(' · '));
  });
});

// Критерий 5. Ключи собираются из разбора, разбора у невышедшего фильма нет —
// и заглушкой блок не заменяется, ровно как «После просмотра».
describe('Невышедший фильм: блока ключей нет (v15, критерий 5)', () => {
  const waiting = () => keysFilm({ releaseDate: NOT_RELEASED, watched: false });

  it('полосы ключей нет, даже если блок в базе есть', () => {
    render(<DossierZone film={waiting()} today={TODAY} />);

    expect(sectionToggle(KEYS_SECTION)).toBeNull();
  });

  it('ни заголовка, ни содержимого блока на странице нет', () => {
    const { container } = render(<DossierZone film={waiting()} today={TODAY} />);

    expect(container.textContent).not.toContain('Важные вещи о фильме');
    expect(container.textContent).not.toContain(KEYS_PROBE);
  });

  it('разбора у невышедшего тоже нет, а подготовка на месте и раскрыта', () => {
    render(<DossierZone film={waiting()} today={TODAY} />);

    expect(sectionToggle(AFTER_SECTION)).toBeNull();
    expect(sectionToggle(BEFORE_SECTION)).toHaveAttribute('aria-expanded', 'true');
  });
});

// Отсутствие блока целиком — законное состояние, а не ошибка: досье старой формы,
// до переноса (спека v15, критерий приёмки 3).
describe('Досье без блока ключей (v15)', () => {
  it('при dossierKeys === null полосы ключей нет', () => {
    render(<DossierZone film={dossierFilm({ dossierKeys: null })} today={TODAY} />);

    expect(sectionToggle(KEYS_SECTION)).toBeNull();
  });

  it('остальные полосы при этом на месте и раскрываются по правилу', () => {
    render(<DossierZone film={dossierFilm({ dossierKeys: null, watched: true })} today={TODAY} />);

    expect(sectionToggle(BEFORE_SECTION)).toHaveAttribute('aria-expanded', 'false');
    expect(sectionToggle(AFTER_SECTION)).toHaveAttribute('aria-expanded', 'true');
  });

  it('пустой массив фрагментов полосой тоже не становится', () => {
    render(<DossierZone film={dossierFilm({ dossierKeys: [] })} today={TODAY} />);

    expect(sectionToggle(KEYS_SECTION)).toBeNull();
  });
});
