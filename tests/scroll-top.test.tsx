// Критерии приёмки 4, 5, 6, 7 и 8 версии v11 — кнопка возврата в начало страницы:
// 4 — при прокрутке не больше 600 пикселей кнопки нет в разметке вовсе;
// 5 — ниже порога кнопка видна всегда, в какую бы сторону ни шло последнее движение,
//     а выше порога её нет в разметке (правка спеки от 27.08.2026, см. врезку в spec.md);
// 6 — нажатие возвращает страницу в начало;
// 7 — доступное имя «Наверх», и это настоящая кнопка, а не ссылка или div с onClick;
// 8 — при `prefers-reduced-motion: reduce` возврат мгновенный, без плавной прокрутки.
//
// Контракт компонента (plan.md, работа B):
//   export default function ScrollTop(): ReactElement | null
// клиентский компонент из '@/components/ScrollTop', пропов нет, к базе не ходит.
// Правило показа:
//   y = window.scrollY;  показывать = y > 600
//
// Правка 27.08.2026 по критерию приёмки 5 версии v11. Прежняя редакция правила
// добавляла к порогу направление: `y > 600 && y < предыдущее` — кнопка появлялась
// только после движения вверх. Владелец пользовался этим вживую и принял за поломку,
// правило направления отменено спекой. Проверки ниже переписаны под новое правило,
// а не удалены: это решение владельца, а не регрессия.
//
// Как это проверяется. В jsdom `window.scrollY` сам не двигается и `scroll` сам
// не приходит: положение подменяется геттером, событие диспатчится вручную внутри
// `act`, потому что от него зависит состояние React. `window.scrollTo` и
// `window.matchMedia` подменяются слежкой — в jsdom первого нет вовсе, а второго
// нет как функции.
//
// Скрытая кнопка проверяется как «нет в разметке», а не «не видно»: спека требует
// именно этого — скрытый элемент не должен ловить нажатия и стоять в порядке обхода
// клавиатурой. Проверка «не видно» в jsdom без Tailwind ничего не значила бы.
//
// Про критерий 7 и клавиатуру. Фокус и срабатывание от Enter и пробела — поведение
// самого элемента `<button>`, а не нашего кода: браузер даёт их даром, jsdom их
// не воспроизводит, и тест на нажатие Enter проверял бы jsdom, а не проект. Поэтому
// здесь проверяется причина, а не следствие: элемент — настоящая `<button type="button">`
// с доступным именем и без `tabindex="-1"`, то есть ровно то, из чего клавиатурное
// поведение и вытекает.
//
// Ни размеров, ни угла, ни рамки, ни поворота стрелки здесь нет: в jsdom Tailwind
// не загружен, вид кнопки — работа живого прогона в браузере.

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, cleanup, fireEvent, act } from '@testing-library/react';
import ScrollTop from '@/components/ScrollTop';

const NAME = 'Наверх';
const REDUCED = '(prefers-reduced-motion: reduce)';

/** Текущее положение прокрутки: `window.scrollY` читает его через геттер. */
let position = 0;
/** Что отвечает медиазапрос о сокращении движения прямо сейчас. */
let reduceMotion = false;

const scrollToSpy = vi.fn();

function stubMatchMedia(): void {
  const matchMedia = (query: string): MediaQueryList => ({
    matches: reduceMotion && query.includes('prefers-reduced-motion'),
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => false,
  });

  Object.defineProperty(window, 'matchMedia', {
    configurable: true,
    writable: true,
    value: matchMedia,
  });
}

/** Прокрутка страницы до заданного положения — с событием, как в браузере. */
function scrollTo(y: number): void {
  position = y;
  act(() => {
    window.dispatchEvent(new Event('scroll'));
  });
}

/** Кнопка возврата, если она сейчас в разметке. */
function button(): HTMLElement | null {
  return screen.queryByRole('button', { name: NAME });
}

/** Настройки последнего вызова `window.scrollTo`. */
function lastScrollTo(): ScrollToOptions {
  const calls = scrollToSpy.mock.calls;
  expect(calls.length, 'window.scrollTo не вызван').toBeGreaterThan(0);
  return calls[calls.length - 1][0] as ScrollToOptions;
}

beforeEach(() => {
  position = 0;
  reduceMotion = false;
  scrollToSpy.mockClear();
  Object.defineProperty(window, 'scrollY', { configurable: true, get: () => position });
  Object.defineProperty(window, 'scrollTo', {
    configurable: true,
    writable: true,
    value: scrollToSpy,
  });
  stubMatchMedia();
});

afterEach(() => {
  cleanup();
});

describe('ScrollTop: пока прокрутили немного, кнопки нет (критерий 4)', () => {
  it('на нетронутой странице кнопки нет', () => {
    render(<ScrollTop />);

    expect(button()).toBeNull();
  });

  it('на трёхстах пикселях кнопки нет', () => {
    render(<ScrollTop />);

    scrollTo(300);

    expect(button()).toBeNull();
  });

  it('ровно на пороге кнопки ещё нет: порог — «больше 600», а не «600 и больше»', () => {
    render(<ScrollTop />);

    scrollTo(600);

    expect(button()).toBeNull();
  });

  // Правка 27.08.2026 по критерию 5: направление больше ничего не решает, и тест
  // остаётся здесь ради другого — порог сильнее любого движения. Ниже шестисот
  // пикселей кнопки нет, куда бы ни шла прокрутка.
  it('ниже порога кнопки нет и после движения вверх', () => {
    render(<ScrollTop />);

    scrollTo(500);
    scrollTo(200);

    expect(button()).toBeNull();
  });
});

// Правка 27.08.2026 по критерию приёмки 5 версии v11. Блок назывался «показ по
// направлению прокрутки» и требовал ровно обратного: при движении вниз кнопки быть
// не должно. Направление отменено, порог остался — проверки переписаны под новое
// правило и оставлены на месте, чтобы отменённое требование читалось вместе с тем,
// что пришло ему на смену.
describe('ScrollTop: за порогом кнопка видна независимо от направления (критерий 5)', () => {
  it('прокрутка вниз далеко за порог кнопку показывает', () => {
    render(<ScrollTop />);

    scrollTo(400);
    scrollTo(1000);
    scrollTo(2000);

    expect(button()).not.toBeNull();
  });

  // Главный довод правки: узнать, есть ли кнопка, не должно требовать движения вверх —
  // иначе, чтобы воспользоваться средством возврата, надо сперва вернуться вручную.
  it('первое же событие прокрутки за порог показывает кнопку', () => {
    render(<ScrollTop />);

    scrollTo(2000);

    expect(button()).not.toBeNull();
  });

  it('движение вверх ниже порога показывает кнопку', () => {
    render(<ScrollTop />);

    scrollTo(2000);
    scrollTo(1800);

    expect(button()).not.toBeNull();
  });

  it('следующее движение вниз кнопку не убирает', () => {
    render(<ScrollTop />);

    scrollTo(2000);
    scrollTo(1800);
    expect(button()).not.toBeNull();

    scrollTo(1900);

    expect(button()).not.toBeNull();
  });

  // Прежняя редакция называлась «кнопка появляется и исчезает сколько угодно раз»
  // и стерегла мерцание как норму. Мерцание при мелких движениях колеса и было тем,
  // что владелец принял за поломку.
  it('кнопка не мигает от мелких движений колеса', () => {
    render(<ScrollTop />);

    scrollTo(2000);
    scrollTo(1800);
    expect(button()).not.toBeNull();

    scrollTo(2400);
    expect(button()).not.toBeNull();

    scrollTo(2100);
    expect(button()).not.toBeNull();
  });

  // Порядок событий больше ни на что не влияет: значение имеет только последнее
  // положение. Две дороги в одну точку дают одно и то же состояние.
  it('вниз-вниз-вниз показывает то же, что вниз-вверх', () => {
    const down = render(<ScrollTop />);

    scrollTo(700);
    scrollTo(1400);
    scrollTo(1800);
    const afterDown = button() !== null;
    down.unmount();

    render(<ScrollTop />);

    scrollTo(2000);
    scrollTo(1800);
    const afterUp = button() !== null;

    expect(afterDown).toBe(afterUp);
    expect(afterDown).toBe(true);
  });

  it('движение вверх, ушедшее выше порога, кнопку убирает: возвращаться уже некуда', () => {
    render(<ScrollTop />);

    scrollTo(2000);
    scrollTo(1800);
    expect(button()).not.toBeNull();

    scrollTo(400);

    expect(button()).toBeNull();
  });

  it('возврат выше порога убирает кнопку и после одной только прокрутки вниз', () => {
    render(<ScrollTop />);

    scrollTo(2000);
    expect(button()).not.toBeNull();

    scrollTo(300);

    expect(button()).toBeNull();
  });

  it('возврат ровно на порог кнопку убирает: показ — «больше 600»', () => {
    render(<ScrollTop />);

    scrollTo(2000);
    expect(button()).not.toBeNull();

    scrollTo(600);

    expect(button()).toBeNull();
  });
});

describe('ScrollTop: сама кнопка (критерий 7)', () => {
  beforeEach(() => {
    render(<ScrollTop />);
    scrollTo(2000);
    scrollTo(1800);
  });

  it('доступное имя — «Наверх»', () => {
    expect(screen.getByRole('button', { name: NAME })).toBeInTheDocument();
  });

  it('это настоящая кнопка, а не ссылка и не div с обработчиком', () => {
    const element = button();

    expect(element?.tagName).toBe('BUTTON');
    expect(element).toHaveAttribute('type', 'button');
  });

  it('кнопка не выведена из порядка обхода клавиатурой', () => {
    expect(button()?.getAttribute('tabindex')).toBeNull();
  });
});

describe('ScrollTop: нажатие возвращает в начало (критерий 6)', () => {
  beforeEach(() => {
    render(<ScrollTop />);
    scrollTo(2000);
    scrollTo(1800);
  });

  it('нажатие зовёт window.scrollTo', () => {
    fireEvent.click(button()!);

    expect(scrollToSpy).toHaveBeenCalledTimes(1);
  });

  it('возврат идёт в самое начало', () => {
    fireEvent.click(button()!);

    expect(lastScrollTo().top).toBe(0);
  });
});

describe('ScrollTop: сокращённое движение (критерий 8)', () => {
  function show(): void {
    render(<ScrollTop />);
    scrollTo(2000);
    scrollTo(1800);
  }

  it('обычная настройка — прокрутка плавная', () => {
    reduceMotion = false;
    show();

    fireEvent.click(button()!);

    expect(lastScrollTo().behavior).toBe('smooth');
  });

  it('при «reduce» возврат мгновенный', () => {
    reduceMotion = true;
    show();

    fireEvent.click(button()!);

    expect(lastScrollTo().behavior).toBe('auto');
  });

  it('спрашивается именно про сокращение движения', () => {
    const asked = vi.fn(stubQuery);
    Object.defineProperty(window, 'matchMedia', {
      configurable: true,
      writable: true,
      value: asked,
    });
    show();

    fireEvent.click(button()!);

    expect(asked).toHaveBeenCalledWith(REDUCED);
  });

  // Настройка сокращённого движения меняется в системе без перезагрузки страницы:
  // читатель включил её, пока страница открыта. Поэтому медиазапрос спрашивается
  // в момент нажатия, а не запоминается при монтировании.
  it('настройка, включённая после монтирования, действует', () => {
    reduceMotion = false;
    show();

    reduceMotion = true;
    fireEvent.click(button()!);

    expect(lastScrollTo().behavior).toBe('auto');
  });

  it('настройка, выключенная после монтирования, тоже действует', () => {
    reduceMotion = true;
    show();

    reduceMotion = false;
    fireEvent.click(button()!);

    expect(lastScrollTo().behavior).toBe('smooth');
  });
});

/** Тот же ответ медиазапроса, что и в подстановке beforeEach: нужен слежке отдельно,
 *  чтобы проверить, о чём именно спрашивают. */
function stubQuery(query: string): MediaQueryList {
  return {
    matches: reduceMotion && query.includes('prefers-reduced-motion'),
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => false,
  };
}
