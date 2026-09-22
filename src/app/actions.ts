'use server';

import { getDb } from '@/db';
import { updatePersonal, type UpdateResult } from '@/lib/films-repo';
import { viewerIsOwner } from '@/lib/session';
import { todayIso } from '@/lib/status';

const DENIED = 'Сессия истекла, войдите заново, чтобы менять личные поля';

export async function updatePersonalAction(id: number, input: unknown): Promise<UpdateResult> {
  // Проверка стоит до разбора данных и до поиска фильма: гость не должен по виду
  // ответа узнавать даже того, существует ли такой фильм в базе.
  if (!(await viewerIsOwner())) return { ok: false, error: DENIED };

  return updatePersonal(getDb(), id, input, todayIso());
}
