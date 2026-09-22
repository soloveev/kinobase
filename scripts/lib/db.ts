import fs from 'node:fs';
import path from 'node:path';
import { createDb } from '../../src/db';

/** Общая обвязка скриптов наполнения: открыть базу и прочитать файл данных.
 *
 *  До 15.09.2026 строка открытия базы стояла восемью копиями, а чтение файла данных —
 *  восемнадцатью. Обе копии безобидны поодиночке и опасны вместе: путь к базе решает,
 *  в какую базу поедет долив, и разойтись восьми копиям этого решения нельзя. */

/** База скриптов: `DB_PATH` из окружения, иначе локальная копия для разработки.
 *
 *  Переменная нужна не только серверу: живые проверки в браузере пишут в рабочую базу,
 *  и гонять их полагается на отдельной (`DB_PATH=/tmp/kinobaza-test.db`). */
export function openScriptDb(): ReturnType<typeof createDb> {
  return createDb(process.env.DB_PATH ?? path.join('data', 'kinobaza.db'));
}

/** Файл данных проекта по пути от корня: `content/films-data.json` и прочие (`data-files.ts`).
 *
 *  Ошибку чтения наружу не заворачивает — скрипты наполнения падают на ней намеренно:
 *  сломанный файл данных не должен доехать до базы наполовину. */
export function readDataFile<T>(relativePath: string): T {
  return JSON.parse(fs.readFileSync(path.join(process.cwd(), relativePath), 'utf8')) as T;
}
