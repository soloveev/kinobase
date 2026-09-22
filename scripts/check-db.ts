import { films } from '../src/db/schema';
import { filmKey } from '../src/lib/film-key';
import { openScriptDb } from './lib/db';

/** Проверка живой базы: ищет состояния, которые правила запрещают, а данные всё-таки
 *  содержат. Ничего не чинит — только называет записи.
 *
 *  Нужна потому, что валидаторы стоят на границе записи и видят только то, что
 *  пишется сейчас. Правило, введённое позже уже занесённых данных, границу не
 *  переходит: старые строки просто остаются такими, какими были. */

type Finding = { rule: string; title: string; detail: string };

const db = openScriptDb();
const all = db.select().from(films).all();

const findings: Finding[] = [];

for (const film of all) {
  const title = filmKey(film);
  const isSeries = film.tags.includes('series');

  if (film.watched && film.wantToWatch) {
    findings.push({
      rule: 'обе отметки подняты',
      title,
      detail: '«Посмотрел» и «Хочу посмотреть» вместе не бывают: план и свершившийся факт',
    });
  }

  if (!film.watched && film.myRating !== null) {
    findings.push({
      rule: 'оценка у непросмотренного',
      title,
      detail: `оценка ${film.myRating} стоит при снятой отметке «Посмотрел»`,
    });
  }

  const seasonFields = [film.seasonsReleased, film.nextSeasonNumber, film.nextSeasonDate];
  if (!isSeries && seasonFields.some((value) => value !== null)) {
    findings.push({
      rule: 'сезоны у не-сериала',
      title,
      detail: 'поля сезонов заполнены у тайтла без тега series',
    });
  }

  if (film.nextSeasonNumber !== null && film.nextSeasonNumber !== (film.seasonsReleased ?? 0) + 1) {
    findings.push({
      rule: 'номер следующего сезона не по счёту',
      title,
      detail: `вышло ${film.seasonsReleased}, а ждём ${film.nextSeasonNumber}: ждать можно только следующий`,
    });
  }

  if (film.nextSeasonDate !== null && film.nextSeasonNumber === null) {
    findings.push({ rule: 'дата сезона без номера', title, detail: film.nextSeasonDate });
  }
}

if (findings.length === 0) {
  console.log(`База чиста: ${all.length} тайтлов, запрещённых состояний нет`);
  process.exit(0);
}

console.error(`В базе ${findings.length} запрещённых состояний:\n`);
for (const finding of findings) {
  console.error(`  ${finding.rule} — «${finding.title}»`);
  console.error(`    ${finding.detail}`);
}
console.error('\nЛичные поля скрипт не трогает: чинить их только по решению владельца.');
process.exit(1);
