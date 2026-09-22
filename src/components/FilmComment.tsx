import type { ReactNode } from 'react';
import { AUTHOR_LINK, SITE_AUTHOR } from '@/lib/site';

/** Готовый вид комментария владельца — тот самый, который видит читатель.
 *
 *  Состояния у компонента нет: его же рендерит страница гостю, и лишнего
 *  JavaScript читателю доставаться не должно. Кнопка правки приходит слотом
 *  `action`; гостю слот не передаётся, и кнопки в разметке нет вовсе.
 *
 *  Курсив здесь — не украшение, а единственное место, где он в этом мире
 *  разрешён: прямым набраны факт и агентский текст, курсивом — голос живого
 *  человека (DESIGN.md, «Типографика»). Подпись реплике не принадлежит
 *  и потому набрана прямым. */
export default function FilmComment({
  comment,
  action,
}: {
  comment: string;
  action?: ReactNode;
}) {
  return (
    <section className="border-t border-hairline pt-4">
      {/* `whitespace-pre-line` — разметка смысла, а не оформление: без него
          абзацы, набранные владельцем, схлопнулись бы в один. */}
      <p className="max-w-[65ch] whitespace-pre-line italic leading-relaxed">{comment}</p>
      <div className="mt-3 flex items-baseline justify-between gap-4">
        <p className="text-sm text-ink-soft">
          {/* Подпись под мнением называет автора. Имя и адрес — из `src/site.config.ts`;
              ссылка внешняя, значит новая вкладка — то же правило, что в подвале. */}
          {AUTHOR_LINK !== null && SITE_AUTHOR !== '' ? (
            <a
              href={AUTHOR_LINK}
              target="_blank"
              rel="noopener noreferrer"
              className="underline decoration-ink-soft underline-offset-4 transition-colors duration-150 hover:text-vermilion"
            >
              {SITE_AUTHOR}
            </a>
          ) : (
            SITE_AUTHOR || 'Владелец базы'
          )}
        </p>
        {action}
      </div>
    </section>
  );
}
