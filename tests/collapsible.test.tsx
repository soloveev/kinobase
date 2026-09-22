// Критерии приёмки 21, 22, 23 и 24 версии v11 на уровне самой оболочки сворачивания:
// 21, 24 — свёрнутая секция отдаётся `<details>` БЕЗ атрибута `open` и умеет нести
//          подсказку о содержимом («2 работы», «7 источников»);
// 22 — заголовок секции живёт в `<summary>`, поэтому щелчок по нему сворачивает
//      и разворачивает секцию без единой строчки скрипта;
// 23 — обратная сторона: там, где сворачивания не положено, `Collapsible` не ставится
//      вовсе; проверка этого — на страницах, здесь же фиксируется, что сама оболочка
//      никаких кнопок и состояния не заводит.
//
// Контракт компонента (plan.md, работа E):
//   export default function Collapsible({
//     title, hint, level = 2, minor = false, children,
//   }: {
//     title: string; hint?: string; level?: 2 | 3 | 4; minor?: boolean; children: ReactNode;
//   }): ReactElement
// default export из '@/components/Collapsible'. Серверный компонент: ни хуков, ни
// состояния, ни обработчиков — сворачивание нативное и переживает отключённый
// JavaScript. Этим он и отличается от клиентского `DossierSection` в карточке фильма.
//
// Что здесь НЕ проверяется и почему. «Свёрнутое содержимое не видно» — не проверяется:
// в jsdom `<details>` содержимое из DOM не убирает и стилями его не прячет, так что
// такая проверка была бы зелёной при любой реализации и не значила бы ничего.
// Проверяется контракт разметки: есть `<details>`, атрибута `open` нет, заголовок
// нужного уровня стоит в `<summary>`, содержимое лежит внутри `<details>`. Само
// сворачивание даёт браузер, и живой прогон — единственное место, где оно проверяемо.
//
// Классов, шеврона, поворота и приглушения (`minor`) здесь нет: Tailwind в jsdom
// не загружен, вид — работа живого прогона.

import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import Collapsible from '@/components/Collapsible';

afterEach(() => {
  cleanup();
});

const TITLE = 'Основные работы';
const HINT = '8 работ';
const CONTENT = 'Ангельское яйцо, 1985';

function renderSection(props: { hint?: string; level?: 2 | 3 | 4; minor?: boolean } = {}) {
  return render(
    <Collapsible title={TITLE} {...props}>
      <p>{CONTENT}</p>
    </Collapsible>,
  );
}

function details(container: HTMLElement): HTMLDetailsElement {
  const element = container.querySelector('details');
  expect(element, 'секция отдана не через <details>').not.toBeNull();
  return element as HTMLDetailsElement;
}

describe('Collapsible: свёрнут по умолчанию (критерии 21 и 24)', () => {
  it('секция — нативный <details>', () => {
    const { container } = renderSection();

    expect(details(container)).toBeInTheDocument();
  });

  it('атрибута open нет: секция приходит свёрнутой', () => {
    const { container } = renderSection();

    expect(details(container).hasAttribute('open')).toBe(false);
  });

  it('раскрытым его не делает и подсказка', () => {
    const { container } = renderSection({ hint: HINT });

    expect(details(container).hasAttribute('open')).toBe(false);
  });
});

describe('Collapsible: заголовок в <summary> (критерий 22)', () => {
  it('у секции есть <summary>, и он первый внутри <details>', () => {
    const { container } = renderSection();
    const summary = details(container).firstElementChild;

    expect(summary?.tagName).toBe('SUMMARY');
  });

  it('заголовок показан текстом названия', () => {
    const { container } = renderSection();

    expect(container.querySelector('summary')?.textContent).toContain(TITLE);
  });

  it('по умолчанию заголовок второго уровня', () => {
    renderSection();

    expect(screen.getByRole('heading', { level: 2, name: TITLE })).toBeInTheDocument();
  });

  it('уровень заголовка задаётся пропом: третий', () => {
    renderSection({ level: 3 });

    expect(screen.getByRole('heading', { level: 3, name: TITLE })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { level: 2, name: TITLE })).toBeNull();
  });

  it('уровень заголовка задаётся пропом: четвёртый', () => {
    renderSection({ level: 4 });

    expect(screen.getByRole('heading', { level: 4, name: TITLE })).toBeInTheDocument();
  });

  it('заголовок стоит внутри <summary>, а не рядом с ним', () => {
    const { container } = renderSection();
    const summary = container.querySelector('summary');
    const heading = screen.getByRole('heading', { level: 2, name: TITLE });

    expect(summary).toContainElement(heading);
  });
});

describe('Collapsible: подсказка о содержимом (критерий 21)', () => {
  it('подсказка показана вместе с заголовком', () => {
    const { container } = renderSection({ hint: HINT });

    expect(container.querySelector('summary')?.textContent).toContain(HINT);
  });

  it('без подсказки секция всё равно рендерится', () => {
    const { container } = renderSection();

    expect(details(container)).toBeInTheDocument();
    expect(container.textContent).toContain(TITLE);
  });
});

describe('Collapsible: содержимое внутри секции', () => {
  it('дети лежат внутри <details>', () => {
    const { container } = renderSection();

    expect(details(container)).toContainElement(screen.getByText(CONTENT));
  });

  it('содержимое не попало в <summary>: щелчок по заголовку не должен ловить текст', () => {
    const { container } = renderSection();

    expect(container.querySelector('summary')?.textContent).not.toContain(CONTENT);
  });
});

// Сворачивание нативное: если бы здесь появилась кнопка или aria-expanded, это значило
// бы, что механику взял на себя скрипт, — и на странице человека стало бы два разных
// способа сворачивания вместо одного.
describe('Collapsible: механика нативная, скрипта нет', () => {
  // Ищем сам элемент, а не роль: у `<summary>` в разных таблицах соответствия роль
  // разная, и запрос по роли проверял бы таблицу, а не нашу разметку.
  it('кнопок в секции нет', () => {
    const { container } = renderSection({ hint: HINT });

    expect(container.querySelector('button')).toBeNull();
  });

  it('aria-expanded секция не объявляет: состояние держит сам <details>', () => {
    const { container } = renderSection({ hint: HINT });

    expect(container.querySelector('[aria-expanded]')).toBeNull();
  });
});
