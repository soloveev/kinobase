// Рефакторинг 15.09.2026, находка 1 (specs/refactor-2026-09-15/audit-code.md).
//
// Главный инвариант наполнения — «фильм ищется по оригинальному названию, а не по
// русскому» (CLAUDE.md, «Данные») — до этой правки стоял шестью дословными копиями
// в скриптах: `add-films`, `tag-films`, `fill-seasons`, `fill-dossiers`,
// `refresh-films`, `fill-people`, `check-db`. Две копии одного суждения расходятся
// молча, поэтому инвариант переезжает в одно место и впервые получает тест.
//
// Контракт:
//   export function filmKey(film: { titleRu: string; titleOriginal?: string | null }): string
//   из '@/lib/film-key'; возвращает `titleOriginal ?? titleRu`.
//
// Функция живёт в `src/lib`, а не в `scripts`: её читает и `check-db`, и по README
// словари, от которых зависит запись в базу, лежат в `src/lib`.

import { describe, it, expect } from 'vitest';
import { filmKey } from '@/lib/film-key';

describe('filmKey: ключ тайтла — оригинальное название', () => {
  // Тот самый случай, ради которого правило и записано: «Призрак в доспехах» 1995 года
  // и одноимённый сериал 2026-го — разные тайтлы с одним русским названием. Map по
  // `titleRu` молча оставил бы от двух записей одну.
  it('два тайтла с одним русским названием дают разные ключи', () => {
    const film = { titleRu: 'Призрак в доспехах', titleOriginal: 'Ghost in the Shell' };
    const series = { titleRu: 'Призрак в доспехах', titleOriginal: 'THE GHOST IN THE SHELL' };

    expect(filmKey(film)).toBe('Ghost in the Shell');
    expect(filmKey(series)).toBe('THE GHOST IN THE SHELL');
    expect(filmKey(film)).not.toBe(filmKey(series));
  });

  // Регистр — часть ключа: оригинальные названия этих двух тайтлов отличаются только им,
  // и приведение к нижнему регистру снова свело бы их в одну запись.
  it('регистр оригинального названия сохраняется', () => {
    expect(filmKey({ titleRu: 'Что-то', titleOriginal: 'THE GHOST IN THE SHELL' })).toBe(
      'THE GHOST IN THE SHELL',
    );
  });

  // Русский фильм может не иметь отдельного оригинального названия: поле в данных
  // необязательно, и тогда ключом становится русское название.
  it('запись без оригинального названия ключуется русским', () => {
    expect(filmKey({ titleRu: 'Непокой', titleOriginal: null })).toBe('Непокой');
    expect(filmKey({ titleRu: 'Непокой', titleOriginal: undefined })).toBe('Непокой');
    expect(filmKey({ titleRu: 'Непокой' })).toBe('Непокой');
  });

  // Пустая строка — не «названия нет», а «название пустое»: в данных её быть не должно,
  // и подменять её русским значило бы прятать дефект файла от `check-data`.
  it('пустое оригинальное название русским не подменяется', () => {
    expect(filmKey({ titleRu: 'Непокой', titleOriginal: '' })).toBe('');
  });
});
