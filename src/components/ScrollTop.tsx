'use client';

import { useEffect, useState } from 'react';
import { ChevronIcon } from './plaques';

/** Ниже этого кнопки нет: возвращаться ещё некуда. Примерно экран телефона. */
const THRESHOLD = 600;

/** Возврат в начало длинной страницы. Общая для всего сайта, поэтому живёт в корневом
 *  layout: данных не читает, к базе не ходит.
 *
 *  Правило показа простое: прокручено дальше порога — кнопка есть, независимо от
 *  направления последнего движения.
 *
 *  Прежде она показывалась только при движении вверх — ответ на требование не мешать
 *  чтению с телефона. Правило отменено 27.08.2026 после живого пользования (врезка
 *  в спеке одиннадцатой версии проекта автора, критерий 5): узнать, есть ли кнопка, было нельзя, не начав
 *  возвращаться вручную, а на мелких движениях колеса она мерцала. Требование остаётся
 *  в силе и держится порогом, размером кнопки и углом, где текста нет.
 *
 *  Скрытая кнопка не рендерится вовсе, а не прячется прозрачностью: невидимый элемент
 *  не должен ловить нажатия и стоять в порядке обхода клавиатурой. Этот же урок
 *  проект уже получал на полноэкранном постере. */
export default function ScrollTop() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    function onScroll(): void {
      setVisible(window.scrollY > THRESHOLD);
    }

    // Первый замер сразу: страница может открыться уже прокрученной — браузер
    // восстановил положение или переход был по якорю, — и ждать события прокрутки
    // значило бы прятать кнопку там, где она уже нужна.
    onScroll();

    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  if (!visible) return null;

  function toTop(): void {
    // Медиазапрос читается в момент нажатия, а не при монтировании: настройку
    // сокращённого движения меняют без перезагрузки страницы.
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    window.scrollTo({ top: 0, behavior: reduce ? 'auto' : 'smooth' });
  }

  return (
    <button
      type="button"
      aria-label="Наверх"
      onClick={toTop}
      className="fixed bottom-4 right-4 flex h-11 w-11 items-center justify-center bg-paper text-ink shadow-[inset_0_0_0_1px_var(--ink)] transition-colors duration-150 hover:bg-ink hover:text-paper sm:bottom-6 sm:right-6"
    >
      {/* Второй стрелки в проекте нет и заводить незачем: шеврон досье смотрит вниз,
          этот — тот же самый, повёрнутый. */}
      <ChevronIcon className="h-5 w-5 rotate-180" />
    </button>
  );
}
