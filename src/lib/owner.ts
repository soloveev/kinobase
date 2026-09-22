import { timingSafeEqual } from 'node:crypto';

/** Имя куки с признаком владельца. Ставит её `/owner/login`, снимает `/owner/logout`;
 *  nginx проверяет только её наличие, значение сверяет приложение. */
export const OWNER_COOKIE = 'kinobase_owner';

/** Владелец ли это. Оба значения приходят снаружи, чтобы функция оставалась
 *  чистой: секрет читает вызывающий, а не модуль.
 *
 *  Пустой или отсутствующий секрет означает «не владелец» всегда — опечатка
 *  в конфигурации сервера должна закрывать дверь, а не открывать её. */
export function isOwner(cookieValue: string | undefined, secret: string | undefined): boolean {
  if (!cookieValue || !secret) return false;

  const given = Buffer.from(cookieValue, 'utf8');
  const expected = Buffer.from(secret, 'utf8');
  // timingSafeEqual бросает на буферах разной длины, поэтому длина сверяется до него.
  if (given.length !== expected.length) return false;

  return timingSafeEqual(given, expected);
}

/** Имя куки режима «глазами гостя». Пока она стоит, владелец видит сайт таким,
 *  каким его видит читатель, — и запрет на правку держит сервер, а не вёрстка. */
export const GUEST_VIEW_COOKIE = 'kinobase_guest_view';

/** Куда вернуть после переключения режима. Принимается только путь внутри сайта:
 *  подделанная ссылка из подвала не должна уводить наружу.
 *
 *  Пробелы и управляющие знаки в пути — признак подделки, а не адреса. */
export function backPath(raw: string | null): string {
  if (raw === null || !raw.startsWith('/')) return '/';
  if (raw.startsWith('//') || raw.startsWith('/\\')) return '/';
  if (/[\s\u0000-\u001f]/.test(raw)) return '/';
  return raw;
}
