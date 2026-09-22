import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { backPath, GUEST_VIEW_COOKIE } from '@/lib/owner';

/** Снятие режима «глазами гостя»: кука снимается, владелец снова видит своё.
 *
 *  Сессия здесь не сверяется — снятие куки никому не вредит, а маршрут не должен
 *  падать на том, у кого режима и не было. */
export async function GET(request: Request) {
  const back = backPath(new URL(request.url).searchParams.get('back'));

  (await cookies()).delete(GUEST_VIEW_COOKIE);

  redirect(back);
}
