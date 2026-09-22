import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { OWNER_COOKIE } from '@/lib/owner';

const YEAR_IN_SECONDS = 60 * 60 * 24 * 365;

/** Вход владельца. Пароль здесь не проверяется: до этого маршрута доходят только
 *  те, кого пропустил nginx по паролю HTTP. Задача маршрута — выдать куку
 *  и вернуть человека в базу; подтверждением служит «Выйти» в подвале. */
export async function GET() {
  const secret = process.env.OWNER_TOKEN;

  if (secret) {
    (await cookies()).set({
      name: OWNER_COOKIE,
      value: secret,
      httpOnly: true,
      secure: true,
      sameSite: 'lax',
      path: '/',
      maxAge: YEAR_IN_SECONDS,
    });
  }

  redirect('/');
}
