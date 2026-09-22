// Критерии приёмки 4 и 5 версии v4 на уровне самой оболочки аккордеона:
// 4 — клик по заголовку секции раскрывает и сворачивает её;
// 5 — свёрнутая секция показывает оглавление своих рубрик, раскрытая — не показывает.
//
// Контракт компонента, зафиксированный этими тестами (план описывает его словами,
// имена пропов не называет):
//   <DossierSection title="Зачем смотреть" defaultOpen hint="Почему это может быть интересно · Какого опыта ждать">
//     …содержимое…
//   </DossierSection>
// default export из '@/components/DossierSection'; клиентская оболочка, содержимое
// приходит детьми и рендерится на сервере. Начальное состояние приходит пропом
// `defaultOpen` — считать «сегодня» на клиенте нельзя, это расхождение гидратации.
// Заголовок секции — доступная кнопка внутри заголовка второго уровня.

import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import DossierSection from '@/components/DossierSection';

afterEach(() => {
  cleanup();
});

const TITLE = 'Зачем смотреть';
const HINT = 'Почему это может быть интересно · Какого опыта ждать';
const CONTENT = 'Текст блока досье';

const toggle = (): HTMLElement => screen.getByRole('button', { name: new RegExp(TITLE, 'i') });

function renderSection(defaultOpen: boolean) {
  return render(
    <DossierSection title={TITLE} defaultOpen={defaultOpen} hint={HINT}>
      <p>{CONTENT}</p>
    </DossierSection>,
  );
}

describe('DossierSection: начальное состояние из пропа', () => {
  it('при defaultOpen содержимое видно, а кнопка помечена раскрытой', () => {
    renderSection(true);

    expect(screen.getByText(CONTENT)).toBeInTheDocument();
    expect(toggle()).toHaveAttribute('aria-expanded', 'true');
  });

  it('без defaultOpen содержимого нет, а кнопка помечена свёрнутой', () => {
    renderSection(false);

    expect(screen.queryByText(CONTENT)).toBeNull();
    expect(toggle()).toHaveAttribute('aria-expanded', 'false');
  });

  it('название секции показано в обоих состояниях', () => {
    renderSection(false);

    expect(toggle()).toHaveTextContent(TITLE);
  });
});

describe('DossierSection: раскрытие и сворачивание по клику (критерий 4)', () => {
  it('клик по свёрнутой секции раскрывает её', () => {
    renderSection(false);

    fireEvent.click(toggle());

    expect(screen.getByText(CONTENT)).toBeInTheDocument();
    expect(toggle()).toHaveAttribute('aria-expanded', 'true');
  });

  it('клик по раскрытой секции сворачивает её', () => {
    renderSection(true);

    fireEvent.click(toggle());

    expect(screen.queryByText(CONTENT)).toBeNull();
    expect(toggle()).toHaveAttribute('aria-expanded', 'false');
  });

  it('состояние переключается сколько угодно раз', () => {
    renderSection(false);

    fireEvent.click(toggle());
    fireEvent.click(toggle());
    expect(screen.queryByText(CONTENT)).toBeNull();

    fireEvent.click(toggle());
    expect(screen.getByText(CONTENT)).toBeInTheDocument();
    expect(toggle()).toHaveAttribute('aria-expanded', 'true');
  });
});

describe('DossierSection: оглавление свёрнутой секции (критерий 5)', () => {
  it('в свёрнутом состоянии оглавление видно', () => {
    const { container } = renderSection(false);

    expect(container.textContent).toContain(HINT);
  });

  it('в раскрытом состоянии оглавления нет', () => {
    const { container } = renderSection(true);

    expect(container.textContent).not.toContain(HINT);
  });

  it('оглавление появляется и исчезает вместе со сворачиванием', () => {
    const { container } = renderSection(false);

    fireEvent.click(toggle());
    expect(container.textContent).not.toContain(HINT);

    fireEvent.click(toggle());
    expect(container.textContent).toContain(HINT);
  });

  it('без оглавления секция всё равно раскрывается и сворачивается', () => {
    render(
      <DossierSection title={TITLE} defaultOpen={false}>
        <p>{CONTENT}</p>
      </DossierSection>,
    );

    fireEvent.click(toggle());

    expect(screen.getByText(CONTENT)).toBeInTheDocument();
  });
});

describe('DossierSection: доступность заголовка', () => {
  it('переключатель — кнопка внутри заголовка второго уровня', () => {
    renderSection(true);

    const heading = screen.getByRole('heading', { level: 2 });

    expect(heading).toContainElement(toggle());
  });
});

// ————————————————————————————————————————————————————————————————————————
// Версия 15 «Ключи», спека раздел C: средняя полоса стоит на пастельной плашке.
// Оболочка получает тон — `tone="accent"` против прежнего `tone="plain"` по умолчанию.
//
// Проверяется ФАКТ применения тона, а не цвет: Tailwind в jsdom не загружен, вычисленных
// стилей здесь нет, и тест на цвет был бы ложью (CLAUDE.md, «CSS-поведение тестами
// не проверяется»). Точный тон подбирается живым прогоном с `npm run measure-layout`.
//
// Плашка обязана охватывать и заголовок, и содержимое (план v15, задача 4, шаг 3),
// поэтому тон ищется не по имени класса, а по устройству: элемент, у которого появился
// класс, не встречающийся в обычной полосе, должен содержать в себе и переключатель,
// и текст блока.

const renderTone = (tone?: 'plain' | 'accent') =>
  render(
    <DossierSection title={TITLE} defaultOpen hint={HINT} tone={tone}>
      <p>{CONTENT}</p>
    </DossierSection>,
  );

/** Все классы разметки одной кучей — чтобы отличать новые от прежних. */
function classTokens(container: HTMLElement): Set<string> {
  const tokens = new Set<string>();
  for (const element of container.querySelectorAll<HTMLElement>('*')) {
    for (const token of element.classList) tokens.add(token);
  }
  return tokens;
}

/** Самый внешний элемент, которому достался класс, отсутствующий в обычной полосе. */
function toneCarrier(container: HTMLElement, plain: Set<string>): HTMLElement | null {
  const elements = Array.from(container.querySelectorAll<HTMLElement>('*'));
  return (
    elements.find((element) =>
      Array.from(element.classList).some((token) => !plain.has(token)),
    ) ?? null
  );
}

describe('DossierSection: тон полосы (v15, спека раздел C)', () => {
  it('по умолчанию полоса выглядит как прежде — как при явном plain', () => {
    const { container: byDefault } = renderTone();
    const { container: plain } = renderTone('plain');

    expect(byDefault.innerHTML).toBe(plain.innerHTML);
  });

  it('accent оформляет полосу иначе: в разметке появляется свой класс', () => {
    const { container: plain } = renderTone('plain');
    const { container: accent } = renderTone('accent');

    expect(
      toneCarrier(accent, classTokens(plain)),
      'у пастельной плашки должен быть свой класс',
    ).not.toBeNull();
  });

  it('плашка охватывает и заголовок полосы, и её содержимое', () => {
    const { container: plain } = renderTone('plain');
    const { container: accent } = renderTone('accent');

    const carrier = toneCarrier(accent, classTokens(plain))!;

    expect(carrier.querySelector('button'), 'заголовок должен лежать внутри плашки').not.toBeNull();
    expect(carrier.textContent).toContain(TITLE);
    expect(carrier.textContent).toContain(CONTENT);
  });

  it('accent не меняет поведения: раскрытие, сворачивание и подсказка на месте', () => {
    const { container } = render(
      <DossierSection title={TITLE} defaultOpen={false} hint={HINT} tone="accent">
        <p>{CONTENT}</p>
      </DossierSection>,
    );

    expect(container.textContent).toContain(HINT);
    expect(screen.queryByText(CONTENT)).toBeNull();

    fireEvent.click(toggle());

    expect(screen.getByText(CONTENT)).toBeInTheDocument();
    expect(toggle()).toHaveAttribute('aria-expanded', 'true');
    expect(container.textContent).not.toContain(HINT);
  });

  it('accent не ломает доступность: переключатель остаётся кнопкой в заголовке второго уровня', () => {
    renderTone('accent');

    expect(screen.getByRole('heading', { level: 2 })).toContainElement(toggle());
  });
});
