// Критерии приёмки 6, 7 и 8 версии v7 на уровне раздела «Творческий метод»:
// 6 — при одном методе раздел называется «Метод»; при двух каждый показан под своим
//     заголовком, и безымянного «Метода» на странице не остаётся;
// 7 — тезис показан формулировкой и телом под ней, а врезка с цитатой внутри тезиса
//     устроена так же, как врезка в досье: та же модель узлов, та же вёрстка;
// 8 — заголовок работы, которая есть в базе, — ссылка на карточку фильма; заголовок
//     работы, которой в базе нет, — обычный текст.
//
// Контракт компонента (plan.md, раздел «Интерфейс»):
//   <MethodZone methods={Method[]} works={(WorkNote & { filmId: number | null })[]} />
// default export из '@/components/MethodZone'. Серверный компонент без хуков и без базы:
// разрешение «работа → фильм в базе» делает страница и передаёт готовые `filmId` — ради
// этого компонент и остаётся чистым, проверяемым без базы.
//
// Формулировка тезиса проверяется как заголовок, а не как полужирный шрифт: начертание —
// CSS-поведение, в jsdom Tailwind не загружен, и такой тест соврал бы. Проверяется то,
// что у формулировки есть роль заголовка и что тело идёт под ней.

import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import MethodZone from '@/components/MethodZone';
import type { Method, WorkNote } from '@/lib/people';
import type { DossierNode } from '@/lib/dossier';

afterEach(() => {
  cleanup();
});

type WorkItem = WorkNote & { filmId: number | null };

const p = (text: string): DossierNode => ({ type: 'p', text });
const h = (text: string): DossierNode => ({ type: 'h', text });
const ul = (...items: string[]): DossierNode => ({ type: 'ul', items });
const quote = (text: string, author: string): DossierNode => ({ type: 'quote', text, author });

const QUOTE_TEXT = 'Я снимаю не про будущее, а про то, чего мы не видим сейчас.';

/** Один метод без заголовка — обычный случай: раздел зовётся просто «Метод». */
const ONE_METHOD: Method[] = [
  {
    title: null,
    theses: [
      {
        title: 'У кино нет реальности',
        body: [
          p('Граница между сном и явью **не проведена** намеренно.'),
          quote(QUOTE_TEXT, 'Мамору Осии'),
        ],
      },
      {
        title: 'Пауза важнее реплики',
        body: [p('То же самое он делает в «Авалоне».')],
      },
    ],
  },
];

/** Роли разошлись принципиально — методов два, у каждого свой заголовок. */
const TWO_METHODS: Method[] = [
  {
    title: 'Режиссёр',
    theses: [{ title: 'Город снят как персонаж', body: [p('Три минуты без единой реплики.')] }],
  },
  {
    title: 'Сценарист для чужой постановки',
    theses: [{ title: 'Диалог держит паузу', body: [p('Реплика приходит позже, чем её ждут.')] }],
  },
];

const IN_BASE: WorkItem = {
  title: 'Призрак в доспехах',
  year: 1995,
  titleOriginal: 'Ghost in the Shell',
  filmId: 7,
  method: [h('Город как персонаж'), p('Три минуты без реплик держат весь фильм.')],
  facts: [
    'Кэндзи Каваи записал свадебный хор на старояпонском.',
    'Титры набирали вручную из-за ограничения плёнки.',
  ],
};

const OUT_OF_BASE: WorkItem = {
  title: 'Ангельское яйцо',
  year: 1985,
  titleOriginal: 'Angel’s Egg',
  filmId: null,
  method: [p('Фильм почти без слов.')],
  facts: [],
};

function renderZone(methods: Method[] = ONE_METHOD, works: WorkItem[] = [IN_BASE]) {
  return render(<MethodZone methods={methods} works={works} />);
}

describe('MethodZone: заголовки подразделов (критерий 6)', () => {
  it('раздел называется «Творческий метод»', () => {
    renderZone();

    expect(screen.getByRole('heading', { name: 'Творческий метод' })).toBeInTheDocument();
  });

  it('при одном методе подраздел называется просто «Метод»', () => {
    renderZone(ONE_METHOD);

    expect(screen.getByRole('heading', { name: 'Метод' })).toBeInTheDocument();
  });

  it('при двух методах каждый показан под своим заголовком', () => {
    renderZone(TWO_METHODS);

    expect(screen.getByRole('heading', { name: 'Режиссёр' })).toBeInTheDocument();
    expect(
      screen.getByRole('heading', { name: 'Сценарист для чужой постановки' }),
    ).toBeInTheDocument();
  });

  it('при двух методах безымянного «Метода» не остаётся', () => {
    renderZone(TWO_METHODS);

    expect(screen.queryByRole('heading', { name: 'Метод' })).toBeNull();
  });

  it('тезисы обоих методов показаны', () => {
    const { container } = renderZone(TWO_METHODS);

    expect(container.textContent).toContain('Город снят как персонаж');
    expect(container.textContent).toContain('Диалог держит паузу');
  });

  it('подраздел работ называется «Метод в произведениях»', () => {
    renderZone();

    expect(screen.getByRole('heading', { name: 'Метод в произведениях' })).toBeInTheDocument();
  });

  // Досье в карточке фильма раскрывается по одному блоку, потому что блока два и они
  // отвечают на разные вопросы момента. Здесь раздел один, и прятать его не от чего.
  //
  // Правка v11 от 25.08.2026 (работа E, критерий 22). Прежде проверка звучала как
  // «в разделе нет ни одного `<details>`». С одиннадцатой версии это неверно: каждое
  // произведение в «Методе в произведениях» сворачивается по отдельности. Не сворачивается
  // сам раздел — и это ровно то, что проверка утверждала по смыслу. Поэтому она стала
  // точнее: заголовки раздела и подразделов не лежат внутри свёрнутой секции, а кнопок
  // и состояния в разделе по-прежнему нет — сворачивание нативное.
  it('раздел не сворачивается: его заголовки не спрятаны под кат', () => {
    const { container } = renderZone();

    expect(container.querySelector('[aria-expanded]')).toBeNull();
    expect(screen.getByRole('heading', { name: 'Творческий метод' }).closest('details')).toBeNull();
    expect(screen.getByRole('heading', { name: 'Метод' }).closest('details')).toBeNull();
    expect(
      screen.getByRole('heading', { name: 'Метод в произведениях' }).closest('details'),
    ).toBeNull();
  });
});

describe('MethodZone: тезис — формулировка и тело (критерий 7)', () => {
  it('формулировка тезиса показана заголовком', () => {
    renderZone();

    expect(screen.getByRole('heading', { name: 'У кино нет реальности' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Пауза важнее реплики' })).toBeInTheDocument();
  });

  it('тело тезиса показано под формулировкой', () => {
    const { container } = renderZone();

    expect(container.textContent).toContain('Граница между сном и явью');
    expect(container.textContent).toContain('То же самое он делает в «Авалоне»');
  });

  it('разметка внутри строки работает: полужирный отдан тегом, а не звёздочками', () => {
    const { container } = renderZone();

    expect(container.textContent).toContain('не проведена');
    expect(container.textContent).not.toContain('**');
    expect(container.querySelector('strong')?.textContent).toBe('не проведена');
  });

  it('ссылка в теле тезиса открывается в новой вкладке', () => {
    renderZone([
      {
        title: null,
        theses: [
          {
            title: 'Формулировка',
            body: [p('Подробнее — [интервью](https://example.com/i).')],
          },
        ],
      },
    ]);

    const link = screen.getByRole('link', { name: 'интервью' });

    expect(link).toHaveAttribute('href', 'https://example.com/i');
    expect(link).toHaveAttribute('target', '_blank');
  });

  it('врезка с цитатой внутри тезиса устроена так же, как врезка в досье', () => {
    const { container } = renderZone();

    const blockquote = container.querySelector('blockquote');

    expect(blockquote).not.toBeNull();
    expect(blockquote!.textContent).toContain(QUOTE_TEXT);
    expect(blockquote!.textContent).toContain('Мамору Осии');
  });
});

describe('MethodZone: работы (критерии 8 и 7)', () => {
  // Правка v11 от 25.08.2026 (работа E, критерий 22). Прежде ссылкой на карточку был сам
  // заголовок работы. Теперь работа свёрнута, её заголовок живёт в `<summary>`, а ссылка
  // внутри `<summary>` конфликтует со сворачиванием: щелчок по ней и раскрывал бы секцию,
  // и уводил со страницы. Ссылка уехала внутрь раскрытого содержимого отдельной строкой.
  // Критерий 8 версии v7 не отменён, а переехал: работа, которая есть в базе, по-прежнему
  // связана со своей карточкой — меняется только то, что кликается.
  it('у работы, которая есть в базе, есть ссылка на карточку фильма', () => {
    renderZone(ONE_METHOD, [IN_BASE]);

    const link = screen.getByRole('link', { name: /Смотреть карточку в базе/i });

    expect(link).toHaveAttribute('href', '/films/7');
  });

  it('заголовок работы, которой в базе нет, ссылкой не является', () => {
    const { container } = renderZone(ONE_METHOD, [OUT_OF_BASE]);

    expect(container.textContent).toContain('Ангельское яйцо');
    expect(screen.queryByRole('link', { name: /Ангельское яйцо/ })).toBeNull();
  });

  it('обе работы показаны рядом, и ссылку на карточку получила только одна', () => {
    const { container } = renderZone(ONE_METHOD, [IN_BASE, OUT_OF_BASE]);

    expect(screen.getByRole('link', { name: /Смотреть карточку в базе/i })).toHaveAttribute(
      'href',
      '/films/7',
    );
    expect(container.querySelectorAll('a[href^="/films/"]')).toHaveLength(1);
    expect(screen.getByRole('heading', { name: /Ангельское яйцо/ })).toBeInTheDocument();
  });

  it('в заголовке работы стоит год', () => {
    renderZone(ONE_METHOD, [IN_BASE]);

    expect(screen.getByRole('heading', { name: /Призрак в доспехах/ })).toHaveTextContent('1995');
  });

  it('работа без года показывается без него и не ломается', () => {
    const noYear: WorkItem = { ...OUT_OF_BASE, year: null };
    const { container } = renderZone(ONE_METHOD, [noYear]);

    expect(container.textContent).toContain('Ангельское яйцо');
    expect(container.textContent).not.toContain('null');
  });

  it('разбор работы показан', () => {
    const { container } = renderZone(ONE_METHOD, [IN_BASE]);

    expect(container.textContent).toContain('Город как персонаж');
    expect(container.textContent).toContain('Три минуты без реплик держат весь фильм');
  });

  it('факты отрисованы списком', () => {
    renderZone(ONE_METHOD, [IN_BASE]);

    const items = screen.getAllByRole('listitem').map((item) => item.textContent ?? '');

    for (const fact of IN_BASE.facts) {
      expect(items.some((text) => text.includes(fact)), `факт «${fact}» не найден списком`).toBe(true);
    }
  });

  // Рубрики «а знаете ли вы» на странице нет; такой заголовок и такой тон запрещены —
  // факты идут списком и говорят сами за себя.
  it('над списком фактов нет рубрики «а знаете ли вы»', () => {
    const { container } = renderZone(ONE_METHOD, [IN_BASE]);

    expect(container.textContent).not.toMatch(/знаете ли вы/i);
  });

  it('работа без фактов показывается без пустого списка', () => {
    const { container } = renderZone(ONE_METHOD, [OUT_OF_BASE]);

    expect(container.querySelector('ul:empty')).toBeNull();
  });

  it('разметка внутри строки работает и в разборе работы', () => {
    const marked: WorkItem = {
      ...OUT_OF_BASE,
      method: [ul('Пункт с **выделением**')],
    };
    const { container } = renderZone(ONE_METHOD, [marked]);

    expect(container.textContent).toContain('Пункт с выделением');
    expect(container.textContent).not.toContain('**');
  });
});

// ---------------------------------------------------------------------------
// Дополнение v11, критерии приёмки 22 и 23 — сворачивание работ в «Методе в произведениях»:
// 22 — каждое произведение сворачивается по отдельности, `<details>` без атрибута `open`;
//      заголовок раздела «Метод в произведениях» виден всегда;
// 23 — методы и их тезисы не сворачиваются и элемента управления не имеют.
//
// Заголовком свёрнутой работы служит её название с годом — то самое, что читатель ищет
// глазами; отдельной подсказки ему не нужно, и спека её не требует. Ссылка на карточку
// фильма уезжает внутрь раскрытого содержимого: ссылка в `<summary>` конфликтует со
// сворачиванием — щелчок по ней и раскрывал бы секцию, и уводил со страницы.
//
// Сворачивание нативное (`<details>` без скриптов), и в jsdom оно содержимое не прячет.
// Поэтому здесь проверяется контракт разметки, а не видимость: тест «содержимого не
// видно» был бы зелёным при любой реализации. Само сворачивание смотрится живым прогоном.

describe('MethodZone: каждая работа свёрнута (критерий 22 версии v11)', () => {
  /** Свёрнутая секция, чей заголовок содержит заданный текст. */
  function work(container: HTMLElement, text: string): HTMLDetailsElement | undefined {
    return Array.from(container.querySelectorAll('details')).find((node) =>
      (node.querySelector('summary')?.textContent ?? '').includes(text),
    );
  }

  it('работа отдана нативным <details>', () => {
    const { container } = renderZone(ONE_METHOD, [IN_BASE]);

    expect(work(container, 'Призрак в доспехах')).toBeDefined();
  });

  it('атрибута open у работы нет: она приходит свёрнутой', () => {
    const { container } = renderZone(ONE_METHOD, [IN_BASE]);

    expect(work(container, 'Призрак в доспехах')!.hasAttribute('open')).toBe(false);
  });

  it('каждая из двух работ свёрнута отдельно', () => {
    const { container } = renderZone(ONE_METHOD, [IN_BASE, OUT_OF_BASE]);

    expect(container.querySelectorAll('details')).toHaveLength(2);
    expect(work(container, 'Ангельское яйцо')!.hasAttribute('open')).toBe(false);
  });

  it('заголовок работы стоит в <summary> и несёт название с годом', () => {
    const { container } = renderZone(ONE_METHOD, [IN_BASE]);
    const summary = work(container, 'Призрак в доспехах')!.querySelector('summary');

    expect(summary?.textContent).toContain('Призрак в доспехах');
    expect(summary?.textContent).toContain('1995');
    expect(summary).toContainElement(screen.getByRole('heading', { name: /Призрак в доспехах/ }));
  });

  it('разбор работы лежит внутри её секции, а не рядом', () => {
    const { container } = renderZone(ONE_METHOD, [IN_BASE]);

    expect(work(container, 'Призрак в доспехах')).toContainElement(
      screen.getByText(/Три минуты без реплик держат весь фильм/),
    );
  });

  it('ссылка на карточку лежит в содержимом, а не в заголовке', () => {
    const { container } = renderZone(ONE_METHOD, [IN_BASE]);
    const link = screen.getByRole('link', { name: /Смотреть карточку в базе/i });

    expect(link.closest('summary')).toBeNull();
    expect(link.closest('details')).toBe(work(container, 'Призрак в доспехах'));
  });

  it('у работы вне базы ссылки на карточку нет', () => {
    renderZone(ONE_METHOD, [OUT_OF_BASE]);

    expect(screen.queryByRole('link', { name: /Смотреть карточку в базе/i })).toBeNull();
  });

  it('сворачивание нативное: кнопок и aria-expanded в разделе нет', () => {
    const { container } = renderZone(ONE_METHOD, [IN_BASE, OUT_OF_BASE]);

    expect(container.querySelector('button')).toBeNull();
    expect(container.querySelector('[aria-expanded]')).toBeNull();
  });
});

describe('MethodZone: методы не сворачиваются (критерий 23 версии v11)', () => {
  it('метод целиком не спрятан под кат', () => {
    renderZone(ONE_METHOD, [IN_BASE]);

    expect(screen.getByRole('heading', { name: 'Метод' }).closest('details')).toBeNull();
  });

  it('и каждый тезис вместе с ним', () => {
    renderZone(ONE_METHOD, [IN_BASE]);

    for (const title of ['У кино нет реальности', 'Пауза важнее реплики']) {
      expect(screen.getByRole('heading', { name: title }).closest('details')).toBeNull();
    }
  });

  it('два метода с собственными заголовками тоже остаются раскрытыми', () => {
    renderZone(TWO_METHODS, []);

    expect(screen.getByRole('heading', { name: 'Режиссёр' }).closest('details')).toBeNull();
    expect(
      screen.getByRole('heading', { name: 'Сценарист для чужой постановки' }).closest('details'),
    ).toBeNull();
  });
});
