'use client';

import { useRef, type ReactNode } from 'react';
import { CloseIcon } from './plaques';

/** Полноэкранный просмотр постера — единственное место в проекте, где содержимое
 *  накрывается, а не сдвигается (исключение записано в DESIGN.md).
 *
 *  Окно — нативный <dialog>: запирание фокуса, закрытие по Esc, инертность фона
 *  и стилизуемая подложка ::backdrop достаются от платформы, ручная реализация
 *  того же на <div> вышла бы длиннее и хуже. Клиентским становится только эта
 *  обёртка; сам постер приходит children и рендерится на сервере.
 *
 *  Изображение внутри — обычный <img>, а не next/image: оптимизатор пережал бы
 *  ровно тот файл, ради которого окно и открывают. */
export default function PosterViewer({
  src,
  fullSrc,
  alt,
  children,
}: {
  /** Рабочий постер страницы. Он же запасной вариант для окна. */
  src: string;
  /** Полноразмерный файл; когда его нет, окно показывает рабочий. */
  fullSrc?: string | null;
  alt: string;
  children: ReactNode;
}) {
  const dialog = useRef<HTMLDialogElement>(null);

  return (
    <>
      <button
        type="button"
        aria-label="Открыть постер во весь экран"
        onClick={() => dialog.current?.showModal()}
        className="block w-full cursor-zoom-in"
      >
        {children}
      </button>

      <dialog
        ref={dialog}
        // Окно занимает весь экран, чтобы фоном вокруг постера был сам dialog:
        // тогда щелчок мимо постера приходит на него и закрывает окно.
        onClick={(event) => {
          if (event.target === dialog.current) dialog.current?.close();
        }}
        // `hidden open:flex`, а не просто `flex`: авторский `display` перебил бы
        // браузерное `display: none` у закрытого <dialog>, и невидимое окно во весь
        // экран перехватывало бы все щелчки по странице.
        className="fixed inset-0 m-0 hidden h-full max-h-none w-full max-w-none items-center justify-center bg-transparent p-0 open:flex"
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={fullSrc ?? src}
          alt={alt}
          // Ни ширины, ни высоты: постер показывается в своём размере, пока тот
          // помещается в экран, и никогда не растягивается сверх него.
          className="max-h-[90vh] max-w-[92vw]"
        />
        <button
          type="button"
          aria-label="Закрыть"
          onClick={() => dialog.current?.close()}
          className="fixed right-5 top-5 p-2 text-paper transition-colors duration-150 hover:text-vermilion sm:right-8 sm:top-8"
        >
          <CloseIcon className="h-6 w-6" />
        </button>
      </dialog>
    </>
  );
}
