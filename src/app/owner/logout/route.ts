import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { OWNER_COOKIE } from '@/lib/owner';

/** Выход владельца: кука снимается, посетитель снова гость. */
export async function GET() {
  (await cookies()).delete(OWNER_COOKIE);
  redirect('/');
}
