import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { backPath, GUEST_VIEW_COOKIE } from '@/lib/owner';
import { ownerSession } from '@/lib/session';

/** Включение режима «глазами гостя».
 *
 *  Куку получает только тот, у кого есть сессия владельца: гостю режим не нужен,
 *  он и так гость. Возврат — на страницу, с которой пришли; путь принимается только
 *  внутренний. */
export async function GET(request: Request) {
  const back = backPath(new URL(request.url).searchParams.get('back'));

  if (!(await ownerSession())) redirect('/');

  (await cookies()).set({
    name: GUEST_VIEW_COOKIE,
    value: '1',
    httpOnly: true,
    // Локально сайт открыт по http, и вечно secure кука там бы не поставилась —
    // а режим нужен именно там, где сайт собирают.
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    // Срока жизни нет намеренно: режим гостя — заход на минуту, а не состояние базы.
    // Кука живёт до закрытия вкладки.
  });

  redirect(back);
}
