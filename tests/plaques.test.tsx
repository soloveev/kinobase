// Критерии приёмки 1, 2, 3, 10 и 18 версии v5 на уровне общих плашек:
// 1, 2, 3 — ряд сезонных плашек: по одной на сезон, вышедшие одной формой, ожидаемый
//      другой, у сериала без объявленного продолжения ожидаемой плашки нет;
// 10 — четвёртый статус «Другое» имеет собственную форму, отличную от «Буду смотреть»,
//      и подпись «Другое» — плашка описывает один тайтл, а не перечисляет их;
// 18 — у тайтла без досье читательская зона показывает плашку «информация не собрана»
//      с заданным спекой текстом, в рамке, с отступами и текстом по центру.
//
// Контракт ('@/components/plaques'):
//   const STATUS_STYLES: Record<FilmStatus, string>;              // четвёртая форма — other
//   const SEASON_STYLES: Record<'released' | 'awaited', string>;
//   function SeasonPlaques({ released, next }): ReactNode;
//   function AgentNotice(): ReactNode;
// portable 22.09.2026: пропс telegramUrl снят вместе с плашкой на разбор в телеграм-канале —
// личная поверхность, которой в отчуждаемой копии нет.
// Условие показа плашки «информация не собрана» живёт на странице фильма
// (`!hasDossier(film)` в конце читательской зоны) — это серверный компонент с обращением
// к базе, поэтому здесь проверяется сам компонент и его текст, а не место вызова.
//
// Дополнение v13 (31.08.2026), критерии приёмки 26–29 — рампа оценки «С разгоном»:
// 26 — ratingStyle(1) даёт заливку в 0 % чернил, ratingStyle(10) — 44 %;
// 27 — цифра чернильная на всех десяти ступенях;
// 28 — заливка растёт строго монотонно от единицы к десятке;
// 29 — каждая ступень несёт контур в 10 % чернил.
//
// Формула (spec.md, раздел G): доля чернил = 44 · ((N − 1) / 9)^1,7. Прежняя рампа была
// почти чёрной на верхнем краю и переворачивала цифру в бумажную на шестёрке; новая целиком
// лежит в светло-сером, и разрыва в середине шкалы больше нет.
//
// Здесь тесты смотрят на вычисленный стиль — и это не исключение из правила «не проверяем
// вёрстку», а его прямое применение: ratingStyle возвращает объект CSSProperties, то есть
// значение, а не разметку, и предмет проверки — именно оно.
//
// Контракт (plan.md, раздел 7):
//   function ratingStyle(value: number): CSSProperties;      // background, color, boxShadow
//   function ratingPickStyle(value: number): CSSProperties;  // то же плюс чернильный контур

import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import {
  AgentNotice,
  ratingPickStyle,
  ratingStyle,
  RatingPlaque,
  SeasonPlaques,
  SEASON_STYLES,
  StatusPlaque,
  STATUS_STYLES,
} from '@/components/plaques';

afterEach(() => {
  cleanup();
});

// Текст выписан из спеки дословно: он виден пользователю продукта, и любая правка
// формулировки — отдельное решение, а не побочный эффект правки вёрстки.
const NOTICE =
  'Агенты ещё не собрали информацию о фильме, потому что трудятся над другими задачами. ' +
  'Возможно, она появится в будущем. Вы можете поискать инфо о нём самостоятельно.';

/** Текст разметки без оглядки на то, как он разбит по элементам и строкам. */
const textOf = (container: HTMLElement): string =>
  (container.textContent ?? '').replace(/\s+/g, ' ').trim();

/** Односторонняя рамка Tailwind: border-t, border-y, border-s-2 и подобные. */
const SIDE_BORDER = /^border-(t|b|l|r|x|y|s|e)(-|$)/;

describe('AgentNotice: плашка «информация не собрана» (критерий 18)', () => {
  it('показывает текст спеки дословно', () => {
    const { container } = render(<AgentNotice />);

    expect(textOf(container)).toBe(NOTICE);
  });

  it('называет причину, надежду и что делать самому — все три предложения на месте', () => {
    const { container } = render(<AgentNotice />);
    const text = textOf(container);

    expect(text).toContain('потому что трудятся над другими задачами');
    expect(text).toContain('Возможно, она появится в будущем');
    expect(text).toContain('Вы можете поискать инфо о нём самостоятельно');
  });

  it('это текстовая плашка, а не кнопка и не ссылка: жать в ней нечего', () => {
    render(<AgentNotice />);

    expect(screen.queryAllByRole('button')).toHaveLength(0);
    expect(screen.queryAllByRole('link')).toHaveLength(0);
  });

  it('текст лежит в одном контейнере-плашке, а не рассыпан по корню', () => {
    const { container } = render(<AgentNotice />);
    const root = container.firstElementChild;

    expect(root, 'у плашки должен быть один корневой элемент').not.toBeNull();
    expect(textOf(root as HTMLElement)).toBe(NOTICE);
  });
});

// portable 22.09.2026: блок `AgentNotice: тайтл с разбором в телеграм-канале` снят целиком —
// плашка со ссылкой на телеграм-канал владельца — личная поверхность, изъятая из
// отчуждаемой копии; у `AgentNotice` больше нет пропса `telegramUrl`.

// Вёрстку целиком тестами не проверить: jsdom не грузит Tailwind, вычисленных стилей
// у классов нет. Поэтому здесь фиксируется ровно то, что отличает плашку от прежнего
// абзаца на линейках, — рамка идёт по всему контуру, а не по двум сторонам, и текст
// выровнен по центру. Это единственное место, где тесты смотрят на классы; если
// имплементация захочет другой способ выразить то же, поправим здесь осознанно.
describe('AgentNotice: это плашка, а не абзац (критерий 18)', () => {
  const rootClasses = (): string[] => {
    const { container } = render(<AgentNotice />);
    const root = container.firstElementChild;
    expect(root, 'у плашки должен быть один корневой элемент').not.toBeNull();
    return (root!.getAttribute('class') ?? '').split(/\s+/).filter(Boolean);
  };

  it('рамка идёт по всему контуру', () => {
    expect(rootClasses()).toContain('border');
  });

  it('рамки только сверху и снизу — как было у абзаца на линейках — больше нет', () => {
    expect(rootClasses().filter((name) => SIDE_BORDER.test(name))).toEqual([]);
  });

  it('текст выровнен по центру', () => {
    expect(rootClasses()).toContain('text-center');
  });
});

describe('STATUS_STYLES: четвёртая форма (критерий 10)', () => {
  it('у статуса «другое» есть своя форма', () => {
    expect(typeof STATUS_STYLES.other).toBe('string');
    expect(STATUS_STYLES.other.length).toBeGreaterThan(0);
  });

  it('форма «другого» отличается от контурной формы «буду смотреть»', () => {
    expect(STATUS_STYLES.other).not.toBe(STATUS_STYLES['will-watch']);
  });

  it('прежние три формы на месте и по-прежнему различаются', () => {
    const forms = [
      STATUS_STYLES.watched,
      STATUS_STYLES['will-watch'],
      STATUS_STYLES.waiting,
      STATUS_STYLES.other,
    ];

    for (const form of forms) {
      expect(typeof form).toBe('string');
      expect(form.length).toBeGreaterThan(0);
    }
    expect(new Set(forms).size).toBe(4);
  });
});

describe('StatusPlaque со статусом «другое» (критерий 10)', () => {
  it('подпись плашки — «Другое», в единственном числе', () => {
    const { container } = render(<StatusPlaque status="other" />);

    expect(textOf(container)).toBe('Другое');
  });

  it('множественного «Другие» — подписи таба — в плашке нет', () => {
    const { container } = render(<StatusPlaque status="other" />);

    expect(textOf(container)).not.toContain('Другие');
  });

  it('суффикс к плашке «другого» прикрепляется тем же способом, что у остальных', () => {
    const { container } = render(<StatusPlaque status="other" suffix="с 12 марта" />);

    expect(textOf(container)).toBe('Другое с 12 марта');
  });
});

// Критерии приёмки 1, 2 и 3: ряд сезонных плашек — по одной на сезон, состояние
// читается формой. Форма (заливка, цвет цифры) — дело вёрстки; тесты смотрят на
// data-state, потому что именно он и говорит, какая плашка какая.
describe('SeasonPlaques: ряд плашек (критерии 1 и 2)', () => {
  const plaquesOf = (released: number, next: number | null) => {
    const { container } = render(<SeasonPlaques released={released} next={next} />);
    const group = screen.getByRole('group');
    return {
      container,
      group,
      items: [...group.querySelectorAll('[data-state]')].map((node) => ({
        text: (node.textContent ?? '').trim(),
        state: node.getAttribute('data-state') ?? '',
      })),
    };
  };

  it('по плашке на каждый вышедший сезон, номера по порядку с первого', () => {
    expect(plaquesOf(3, null).items.map((item) => item.text)).toEqual(['1', '2', '3']);
  });

  it('вышедшие сезоны помечены состоянием released', () => {
    expect(plaquesOf(3, null).items.every((item) => item.state === 'released')).toBe(true);
  });

  it('объявленный сезон добавляет последнюю плашку в состоянии awaited', () => {
    expect(plaquesOf(2, 3).items).toEqual([
      { text: '1', state: 'released' },
      { text: '2', state: 'released' },
      { text: '3', state: 'awaited' },
    ]);
  });

  it('без объявленного сезона ожидаемой плашки нет вовсе (критерий 3)', () => {
    const { items } = plaquesOf(3, null);

    expect(items).toHaveLength(3);
    expect(items.some((item) => item.state === 'awaited')).toBe(false);
  });

  it('один вышедший сезон — одна плашка', () => {
    expect(plaquesOf(1, null).items).toEqual([{ text: '1', state: 'released' }]);
  });

  it('в ряду нет ничего, кроме номеров: ни подписей, ни дат', () => {
    const { group } = plaquesOf(2, 3);

    expect((group.textContent ?? '').replace(/\s+/g, '')).toBe('123');
  });
});

describe('SeasonPlaques: ряд для экранного диктора (критерий 1)', () => {
  it('с ожидаемым сезоном — «Сезоны: вышло 2, ждём 3-й»', () => {
    render(<SeasonPlaques released={2} next={3} />);

    expect(screen.getByRole('group')).toHaveAccessibleName('Сезоны: вышло 2, ждём 3-й');
  });

  it('без ожидаемого сезона — «Сезоны: вышло 2»', () => {
    render(<SeasonPlaques released={2} next={null} />);

    expect(screen.getByRole('group')).toHaveAccessibleName('Сезоны: вышло 2');
  });

  it('числа в имени настоящие, а не образец из спеки', () => {
    render(<SeasonPlaques released={7} next={8} />);

    expect(screen.getByRole('group')).toHaveAccessibleName('Сезоны: вышло 7, ждём 8-й');
  });
});

describe('SEASON_STYLES: две формы сезонной плашки (критерий 2)', () => {
  it('у вышедшего и ожидаемого сезона есть свои непустые формы', () => {
    for (const state of ['released', 'awaited'] as const) {
      expect(typeof SEASON_STYLES[state], `форма «${state}» должна быть строкой`).toBe('string');
      expect(SEASON_STYLES[state].length).toBeGreaterThan(0);
    }
  });

  it('формы различаются — иначе состояние сезона не прочитать', () => {
    expect(SEASON_STYLES.released).not.toBe(SEASON_STYLES.awaited);
  });
});

// ─── v13 «Отбор»: рампа оценки «С разгоном» (критерии 26–29) ────────────────────

/** Доля чернил в заливке ступени: из `color-mix(in oklab, var(--ink) 12.3%, var(--paper))`. */
function inkShare(style: { background?: string | number }): number {
  const value = String(style.background ?? '');
  const match = value.match(/var\(--ink\)\s+(\d+(?:\.\d+)?)%/);

  expect(match, `в заливке «${value}» не видно доли чернил`).not.toBeNull();
  return Number(match![1]);
}

/** Доля чернил в контуре ступени: из `inset 0 0 0 1px color-mix(… var(--ink) 10%, …)`. */
function outlineShare(style: { boxShadow?: string | number }): number {
  const value = String(style.boxShadow ?? '');
  const match = value.match(/var\(--ink\)\s+(\d+(?:\.\d+)?)%/);

  expect(match, `в контуре «${value}» не видно доли чернил`).not.toBeNull();
  return Number(match![1]);
}

const SCALE = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];

describe('ratingStyle: концы шкалы (критерий 26)', () => {
  it('единица — чистая бумага, 0 % чернил', () => {
    expect(inkShare(ratingStyle(1))).toBe(0);
  });

  it('десятка — 44 % чернил', () => {
    expect(inkShare(ratingStyle(10))).toBe(44);
  });

  it('вся шкала лежит между этими краями: чернил нигде не больше 44 %', () => {
    for (const value of SCALE) {
      expect(inkShare(ratingStyle(value)), `ступень ${value}`).toBeLessThanOrEqual(44);
      expect(inkShare(ratingStyle(value)), `ступень ${value}`).toBeGreaterThanOrEqual(0);
    }
  });

  it('заливка собрана из чернил и бумаги, а не из посторонних цветов', () => {
    for (const value of SCALE) {
      const background = String(ratingStyle(value).background);

      expect(background, `ступень ${value}`).toContain('var(--ink)');
      expect(background, `ступень ${value}`).toContain('var(--paper)');
    }
  });
});

describe('ratingStyle: цифра всегда чернильная (критерий 27)', () => {
  it('на всех десяти ступенях цвет цифры — чернила', () => {
    for (const value of SCALE) {
      expect(ratingStyle(value).color, `ступень ${value}`).toBe('var(--ink)');
    }
  });

  it('переворота цифры в бумажную на середине шкалы больше нет', () => {
    for (const value of SCALE) {
      expect(String(ratingStyle(value).color), `ступень ${value}`).not.toContain('--paper');
    }
  });
});

describe('ratingStyle: заливка растёт монотонно (критерий 28)', () => {
  it('каждая следующая ступень темнее предыдущей', () => {
    for (let value = 1; value < 10; value += 1) {
      expect(
        inkShare(ratingStyle(value + 1)),
        `ступень ${value + 1} должна быть темнее ступени ${value}`,
      ).toBeGreaterThan(inkShare(ratingStyle(value)));
    }
  });

  it('разрыва в середине шкалы нет: ни один шаг не превышает четверти диапазона', () => {
    for (let value = 1; value < 10; value += 1) {
      const step = inkShare(ratingStyle(value + 1)) - inkShare(ratingStyle(value));

      expect(step, `шаг с ${value} на ${value + 1}`).toBeLessThan(11);
    }
  });

  // Показатель 1,7 разводит верх шкалы, где стоит большинство оценок владельца,
  // и слепляет низ, где различать нечего (spec.md, раздел G).
  it('верх шкалы разведён сильнее низа', () => {
    const low = inkShare(ratingStyle(2)) - inkShare(ratingStyle(1));
    const high = inkShare(ratingStyle(10)) - inkShare(ratingStyle(9));

    expect(high).toBeGreaterThan(low);
  });
});

describe('ratingStyle: контур ступени (критерий 29)', () => {
  it('каждая ступень несёт контур в 10 % чернил', () => {
    for (const value of SCALE) {
      expect(outlineShare(ratingStyle(value)), `ступень ${value}`).toBe(10);
    }
  });

  it('контур внутренний и в один пиксель — иначе светлый край шкалы теряет форму', () => {
    for (const value of SCALE) {
      const shadow = String(ratingStyle(value).boxShadow);

      expect(shadow, `ступень ${value}`).toContain('inset');
      expect(shadow, `ступень ${value}`).toContain('1px');
    }
  });
});

// Критерий 30 на уровне самой рампы: знак выбора отделён от заливки. Как им пользуются
// секция «Моё» и строка админки — в tests/personal-fields.test.tsx и tests/admin-row.test.tsx.
describe('ratingPickStyle: выбранная ступень (критерий 30)', () => {
  it('заливка выбранной ступени та же, что у невыбранной', () => {
    for (const value of SCALE) {
      expect(ratingPickStyle(value).background, `ступень ${value}`).toBe(
        ratingStyle(value).background,
      );
    }
  });

  it('цифра остаётся чернильной', () => {
    for (const value of SCALE) {
      expect(ratingPickStyle(value).color, `ступень ${value}`).toBe('var(--ink)');
    }
  });

  it('контур становится чернильным, а не на hairline', () => {
    for (const value of SCALE) {
      expect(ratingPickStyle(value).boxShadow, `ступень ${value}`).toBe(
        'inset 0 0 0 1px var(--ink)',
      );
    }
  });

  it('знак выбора отличается от невыбранной ступени на всей шкале, от единицы до десятки', () => {
    for (const value of SCALE) {
      expect(ratingPickStyle(value).boxShadow, `ступень ${value}`).not.toBe(
        ratingStyle(value).boxShadow,
      );
    }
  });
});

describe('RatingPlaque: плашка берёт ту же рампу (критерии 26–29)', () => {
  it('заливка и цвет цифры плашки — ровно ratingStyle', () => {
    for (const value of [1, 6, 10]) {
      const { unmount } = render(<RatingPlaque value={value} />);
      const plaque = screen.getByLabelText(`Моя оценка ${value}`);

      expect(plaque.style.background, `ступень ${value}`).toBe(
        String(ratingStyle(value).background),
      );
      expect(plaque.style.color, `ступень ${value}`).toBe(String(ratingStyle(value).color));
      unmount();
    }
  });
});
