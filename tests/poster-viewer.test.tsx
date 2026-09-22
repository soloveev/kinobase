// Критерии приёмки 15 и 16 версии v5 на уровне компонента полноэкранного просмотра постера:
// 15 — щелчок по постеру открывает окно; окно закрывается клавишей Esc, щелчком по фону
//      и кнопкой закрытия; после закрытия фокус возвращается на постер;
// 16 — в окне показан полноразмерный файл, а не рабочий.
//
// Контракт из plan.md ('@/components/PosterViewer', клиентский, default export):
//   <PosterViewer src={src} fullSrc={fullSrc} alt={alt}>{children}</PosterViewer>
// Обёртка вокруг постера: children — сам постер страницы, он оборачивается в <button>
// с подписью «Открыть постер во весь экран» для экранного диктора. Окно — нативный
// <dialog>: открытие через showModal(), закрытие — Esc (нативно), щелчок по самому
// dialog (это и есть фон вокруг постера) и кнопка закрытия с доступным именем «Закрыть».
// Изображение внутри — обычный <img> с тем же alt.
//
// ВАЖНО про jsdom: HTMLDialogElement там объявлен, но showModal и close не реализованы —
// их нет вовсе, и вызов падает с «showModal is not a function». Поэтому перед каждым
// тестом ставится маленький полифилл, повторяющий поведение браузера: showModal
// выставляет атрибут open (по таблице стилей jsdom закрытый dialog — display:none,
// значит открытость проверяется через доступность элемента), запоминает элемент,
// на котором был фокус, и вешает обработчик Esc; close снимает open, шлёт событие
// close и возвращает фокус. Полифилл — не предмет проверки: он лишь возвращает
// в jsdom то поведение браузера, на которое компонент опирается.

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, cleanup, fireEvent, within } from '@testing-library/react';
import PosterViewer from '@/components/PosterViewer';

const SRC = '/posters/curse.jpg';
const FULL_SRC = '/posters/original/curse.jpg';
const ALT = 'Постер: Проклятие';

/** Восстанавливаемое состояние полифилла: кому вернуть фокус и что снять с document. */
let focusedBeforeOpen: HTMLElement | null = null;
let escListener: ((event: KeyboardEvent) => void) | null = null;

beforeEach(() => {
  const dialogs = HTMLDialogElement.prototype as unknown as {
    showModal?: () => void;
    close?: (returnValue?: string) => void;
  };

  dialogs.showModal = function showModal(this: HTMLDialogElement) {
    focusedBeforeOpen = document.activeElement as HTMLElement | null;
    this.setAttribute('open', '');
    escListener = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      const cancel = new Event('cancel', { cancelable: true });
      if (this.dispatchEvent(cancel)) this.close();
    };
    document.addEventListener('keydown', escListener);
  };

  dialogs.close = function close(this: HTMLDialogElement) {
    if (escListener) {
      document.removeEventListener('keydown', escListener);
      escListener = null;
    }
    this.removeAttribute('open');
    this.dispatchEvent(new Event('close'));
    focusedBeforeOpen?.focus();
    focusedBeforeOpen = null;
  };
});

afterEach(() => {
  if (escListener) {
    document.removeEventListener('keydown', escListener);
    escListener = null;
  }
  focusedBeforeOpen = null;
  vi.restoreAllMocks();
  cleanup();
});

function renderViewer(props: { src?: string; fullSrc?: string; alt?: string } = {}) {
  render(
    <PosterViewer src={props.src ?? SRC} fullSrc={props.fullSrc ?? FULL_SRC} alt={props.alt ?? ALT}>
      {/* Постер страницы, каким его передаёт карточка. В тесте это простой <img>:
          next/image здесь ничего не проверяет, а вносит собственную разметку. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={props.src ?? SRC} alt={props.alt ?? ALT} />
    </PosterViewer>,
  );
}

const trigger = () => screen.getByRole('button', { name: /открыть постер во весь экран/i });
const dialog = () => screen.queryByRole('dialog');

/** Открывает окно так же, как это делает человек: фокус на триггере, затем щелчок. */
function open(): HTMLElement {
  const button = trigger();
  button.focus();
  fireEvent.click(button);
  const opened = dialog();
  expect(opened, 'окно должно открыться щелчком по постеру').not.toBeNull();
  return opened!;
}

describe('PosterViewer: закрытое состояние', () => {
  it('показывает переданный постер страницы', () => {
    renderViewer();

    expect(screen.getAllByAltText(ALT).length).toBeGreaterThan(0);
  });

  it('постер обёрнут в кнопку с подписью для экранного диктора', () => {
    renderViewer();

    expect(trigger()).toBeInTheDocument();
  });

  it('до щелчка окна нет', () => {
    renderViewer();

    expect(dialog()).toBeNull();
  });
});

describe('PosterViewer: открытие (критерии 15 и 16)', () => {
  it('щелчок по постеру открывает окно', () => {
    renderViewer();

    expect(open()).toBeInTheDocument();
  });

  it('в окне показан полноразмерный файл, а не рабочий (критерий 16)', () => {
    renderViewer();

    const image = within(open()).getByRole('img');

    expect(image).toHaveAttribute('src', FULL_SRC);
  });

  it('когда полноразмерного файла нет, показывается тот же файл, что и на странице', () => {
    renderViewer({ fullSrc: SRC });

    expect(within(open()).getByRole('img')).toHaveAttribute('src', SRC);
  });

  it('у изображения в окне то же описание, что у постера страницы', () => {
    renderViewer();

    expect(within(open()).getByRole('img')).toHaveAttribute('alt', ALT);
  });
});

describe('PosterViewer: закрытие (критерий 15)', () => {
  it('закрывается кнопкой закрытия', () => {
    renderViewer();
    const opened = open();

    fireEvent.click(within(opened).getByRole('button', { name: /закрыть/i }));

    expect(dialog()).toBeNull();
  });

  it('закрывается клавишей Esc', () => {
    renderViewer();
    open();

    fireEvent.keyDown(document, { key: 'Escape' });

    expect(dialog()).toBeNull();
  });

  it('закрывается щелчком по фону вокруг постера', () => {
    renderViewer();
    const opened = open();

    fireEvent.click(opened);

    expect(dialog()).toBeNull();
  });

  it('щелчок по самому постеру окно не закрывает', () => {
    renderViewer();
    const opened = open();

    fireEvent.click(within(opened).getByRole('img'));

    expect(dialog()).not.toBeNull();
  });

  it('после закрытия фокус возвращается на постер', () => {
    renderViewer();
    const opened = open();

    fireEvent.click(within(opened).getByRole('button', { name: /закрыть/i }));

    expect(document.activeElement).toBe(trigger());
  });

  it('окно можно открыть снова', () => {
    renderViewer();
    fireEvent.click(within(open()).getByRole('button', { name: /закрыть/i }));

    expect(dialog()).toBeNull();
    expect(open()).toBeInTheDocument();
  });
});
