// Критерий приёмки 5 версии v2 на уровне полосы фильтров: в табе «Ждём» переключателя
// сортировки нет, и полоса не показывает пустую панель — кнопки «Фильтры» просто нет.
// Страница передаёт для «Ждём» panel = null; здесь проверяется поведение самого
// FiltersDisclosure на такой панели, а также что с непустой панелью всё работает как в v1.
//
// Дополнение v13 (31.08.2026), критерии приёмки 18, 23 и 24:
// 18 — строка применённого видна и при свёрнутой панели, и при раскрытой;
// 23 — при пустом отборе на кнопке только слово «Фильтры»;
// 24 — при отборе кнопка несёт число применённых фильтров.
//
// Контракт (spec.md, разделы E и F; plan.md, раздел 6): проп `appliedHint?: string`
// заменяется на `applied?: ReactNode` и `appliedCount?: number`. Строка уходит в `below`
// следом за панелью — под панелью и над сеткой.

import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import type { ReactNode } from 'react';
import FiltersDisclosure from '@/components/FiltersDisclosure';

afterEach(() => {
  cleanup();
});

const filtersButton = () => screen.queryByRole('button', { name: /фильтры/i });

describe('FiltersDisclosure без панели', () => {
  it('кнопка «Фильтры» не рендерится вовсе', () => {
    render(<FiltersDisclosure nav={<span>Табы</span>} panel={null} />);

    expect(filtersButton()).toBeNull();
  });

  it('навигация при этом на месте', () => {
    render(<FiltersDisclosure nav={<span>Табы</span>} panel={null} />);

    expect(screen.getByText('Табы')).toBeInTheDocument();
  });

  // Правка v13 от 31.08.2026. Прежняя редакция: ~~«подсказка о применённом фильтре
  // без панели тоже не показывается», проп appliedHint~~. Отменена спекой v13, раздел F
  // (критерии 23 и 24): хвост из названий с кнопки уходит, его работу делает строка
  // применённого, а кнопка несёт число. Смысл проверки прежний: без панели у полосы нет
  // ни кнопки, ни того, что на ней написано.
  it('без панели нет ни кнопки, ни числа на ней', () => {
    render(<FiltersDisclosure nav={<span>Табы</span>} panel={null} appliedCount={3} />);

    expect(filtersButton()).toBeNull();
    expect(screen.queryByText('3')).toBeNull();
  });
});

describe('FiltersDisclosure с панелью', () => {
  it('кнопка «Фильтры» рендерится и по клику раскрывает панель', () => {
    render(
      <FiltersDisclosure nav={<span>Табы</span>} panel={<span>Содержимое панели</span>} />,
    );

    const button = filtersButton();
    expect(button).not.toBeNull();
    expect(screen.queryByText('Содержимое панели')).toBeNull();

    fireEvent.click(button!);

    expect(screen.getByText('Содержимое панели')).toBeInTheDocument();
    expect(button).toHaveAttribute('aria-expanded', 'true');
  });

  it('повторный клик сворачивает панель', () => {
    render(
      <FiltersDisclosure nav={<span>Табы</span>} panel={<span>Содержимое панели</span>} />,
    );

    const button = filtersButton()!;
    fireEvent.click(button);
    fireEvent.click(button);

    expect(screen.queryByText('Содержимое панели')).toBeNull();
    expect(button).toHaveAttribute('aria-expanded', 'false');
  });

  // Правка v13 от 31.08.2026. Прежняя редакция: ~~«подсказка о применённом фильтре
  // показывается на кнопке»: кнопка несла хвост из названий выбранного~~. Отменена спекой
  // v13, раздел F: хвост рос с каждым фильтром, при пяти переносил шапку на вторую строку,
  // и снять из него один фильтр было нельзя. Теперь кнопка несёт число, а названия — строка
  // применённого, где у каждого свой крестик.
  it('число применённых фильтров показывается на кнопке (критерий 24)', () => {
    render(
      <FiltersDisclosure
        nav={<span>Табы</span>}
        panel={<span>Содержимое панели</span>}
        appliedCount={4}
      />,
    );

    expect(filtersButton()).toHaveTextContent('4');
  });
});

describe('FiltersDisclosure: число на кнопке (критерии 23 и 24)', () => {
  const withCount = (appliedCount?: number) =>
    render(
      <FiltersDisclosure
        nav={<span>Табы</span>}
        panel={<span>Содержимое панели</span>}
        appliedCount={appliedCount}
      />,
    );

  it('при пустом отборе на кнопке только слово «Фильтры» (критерий 23)', () => {
    withCount(0);

    expect((filtersButton()!.textContent ?? '').replace(/\s+/g, ' ').trim()).toBe('Фильтры');
  });

  it('без переданного счёта — тоже только слово «Фильтры» (критерий 23)', () => {
    withCount(undefined);

    expect((filtersButton()!.textContent ?? '').replace(/\s+/g, ' ').trim()).toBe('Фильтры');
  });

  it('хвоста из названий выбранного на кнопке больше нет (критерий 23)', () => {
    withCount(2);

    const text = filtersButton()!.textContent ?? '';

    expect(text).toContain('2');
    expect(text).not.toMatch(/ужасы|сериалы|по вкусу|оценка/i);
  });

  it('число на кнопке — то, что передали (критерий 24)', () => {
    for (const count of [1, 3, 7]) {
      const { unmount } = withCount(count);

      expect(filtersButton()).toHaveTextContent(String(count));
      unmount();
    }
  });
});

describe('FiltersDisclosure: строка применённого (критерий 18)', () => {
  const renderWithApplied = (applied?: ReactNode) =>
    render(
      <FiltersDisclosure
        nav={<span>Табы</span>}
        panel={<span>Содержимое панели</span>}
        applied={applied}
        appliedCount={1}
      />,
    );

  it('видна при свёрнутой панели', () => {
    renderWithApplied(<span>Отобрано 3 из 42</span>);

    expect(screen.queryByText('Содержимое панели')).toBeNull();
    expect(screen.getByText('Отобрано 3 из 42')).toBeInTheDocument();
  });

  it('остаётся видна при раскрытой панели', () => {
    renderWithApplied(<span>Отобрано 3 из 42</span>);

    fireEvent.click(filtersButton()!);

    expect(screen.getByText('Содержимое панели')).toBeInTheDocument();
    expect(screen.getByText('Отобрано 3 из 42')).toBeInTheDocument();
  });

  it('после повторного сворачивания панели строка никуда не девается', () => {
    renderWithApplied(<span>Отобрано 3 из 42</span>);

    fireEvent.click(filtersButton()!);
    fireEvent.click(filtersButton()!);

    expect(screen.queryByText('Содержимое панели')).toBeNull();
    expect(screen.getByText('Отобрано 3 из 42')).toBeInTheDocument();
  });

  it('стоит под панелью, а не над ней', () => {
    renderWithApplied(<span>Отобрано 3 из 42</span>);
    fireEvent.click(filtersButton()!);

    const panel = screen.getByText('Содержимое панели');
    const applied = screen.getByText('Отобрано 3 из 42');

    expect(
      panel.compareDocumentPosition(applied) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
  });

  it('без строки применённого полоса ничего лишнего не рисует (критерий 17)', () => {
    renderWithApplied(undefined);

    expect(screen.queryByText(/отобрано/i)).toBeNull();
  });
});
