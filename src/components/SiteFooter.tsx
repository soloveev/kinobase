import { AUTHOR_LINK, SITE_AUTHOR } from '@/lib/site';
import ViewModeLink from './ViewModeLink';

const LINK =
  'no-underline transition-colors duration-150 hover:text-vermilion focus-visible:text-vermilion';

/** Подвал сайта.
 *
 *  `owner` — признак эффективный: в режиме «глазами гостя» он `false`, и весь ряд
 *  ссылок разбирается прежним кодом сам — подвал показывает ровно то, что видит гость,
 *  включая «Войти». Сверх этого при `guestView` встаёт вторая строка: пометка режима
 *  и возврат. Без неё владелец, ушедший посмотреть чужими глазами, остался бы там. */
export default function SiteFooter({ owner, guestView }: { owner: boolean; guestView: boolean }) {
  return (
    <footer className="mt-16 border-t-2 border-ink pt-3 pb-2">
      <p className="flex flex-wrap items-baseline gap-x-4 gap-y-1 text-xs font-extrabold uppercase tracking-widest text-ink-soft">
        {/* Имя владельца — из `src/site.config.ts`, после тире и в именительном
            падеже: склонений не заводим. Ссылкой имя становится только когда
            владелец дал адрес блога или канала. */}
        <span className="text-ink">
          Каталог фильмов
          {SITE_AUTHOR !== '' && (
            <>
              {' — '}
              {AUTHOR_LINK !== null ? (
                <a href={AUTHOR_LINK} target="_blank" rel="noopener noreferrer" className={LINK}>
                  {SITE_AUTHOR}
                </a>
              ) : (
                SITE_AUTHOR
              )}
            </>
          )}
        </span>
        {/* Гостю ссылка не прячется вёрсткой, а не отправляется вовсе — то же
            решение, что у секции «Моё» в карточке. */}
        {owner && <ViewModeLink mode="guest" className={LINK} />}
        {/* Внутренний переход, а не внешний сервис: без target="_blank". */}
        <a href={owner ? '/owner/logout' : '/owner/login'} className={LINK}>
          {owner ? 'Выйти' : 'Войти'}
        </a>
      </p>

      {/* Отдельной строкой, а не в ряду ссылок: это не действие сайта, а пометка
          о том, чьими глазами на него смотрят. Киноварь по правилу палитры метит
          временное состояние — то, чего по умолчанию нет и что кончится. */}
      {guestView && (
        <p className="mt-2 flex flex-wrap items-baseline gap-x-3 gap-y-1 text-xs font-extrabold uppercase tracking-widest text-ink-soft">
          <span>Глазами гостя</span>
          <ViewModeLink mode="owner" className={`${LINK} text-vermilion`} />
        </p>
      )}
    </footer>
  );
}
