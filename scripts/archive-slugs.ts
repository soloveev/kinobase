import { slugArchive } from '../src/lib/archive-slug';
import { readDataFile } from './lib/db';
import { DATA_FILES } from './lib/data-files';

/** Печатает в stdout JSON «оригинальное название → имя папки архива» по всем записям
 *  `content/dossier-data.json`.
 *
 *  Нужен питоновским скриптам порции (скрипты порций): им требуется
 *  имя папки, а вторая копия правила слага, написанная на Python, по определению
 *  расходится с этой молча — и расходилась уже наполовину. Теперь слаг считает один
 *  код, а Python его читает.
 *
 *  Скрипт печатает и ничего не пишет: чинить данные он не вправе.
 *
 *      npm run archive-slugs
 */

/** Папки, имя которых из оригинального названия не выводится. Карта живёт здесь, а не
 *  в `slugArchive`, потому что это не правило перевода названия в слаг, а список решений,
 *  принятых при заведении конкретных папок:
 *
 *   • два «Призрака в доспехах» — фильм 1995 года и сериал 2026-го — различаются годом
 *     в имени папки, а не названием: оригинальные названия у них отличаются одним
 *     регистром, и папки `ghost-in-the-shell` хватило бы ровно на один из двух тайтлов;
 *   • у длинного названия папка бывает короткой (`research/odyssey` при «The Odyssey»,
 *     `research/camp-miasma` при «Teenage Sex and Death at Camp Miasma»). Проверкам это
 *     не мешает — `matchesArchiveFolder` сходится по хвосту слага, — но скрипту, которому
 *     имя папки нужно заранее, выводить его не из чего.
 *
 *  `slugArchive` этого не умеет и уметь не должен: он отвечает на вопрос «какой слаг
 *  у названия», а здесь записано «как названа папка». Новая папка с неочевидным именем
 *  дописывается сюда одной строкой. */
const FOLDER_EXCEPTIONS: Record<string, string> = {
  'Ghost in the Shell': 'ghost-in-the-shell-1995',
  'THE GHOST IN THE SHELL': 'ghost-in-the-shell-2026',
  'Teenage Sex and Death at Camp Miasma': 'camp-miasma',
  'The Odyssey': 'odyssey',
};

const records = readDataFile<{ titleOriginal: string }[]>(DATA_FILES.dossiers);

const slugs: Record<string, string> = {};
for (const record of records) {
  slugs[record.titleOriginal] =
    FOLDER_EXCEPTIONS[record.titleOriginal] ?? slugArchive(record.titleOriginal);
}

console.log(JSON.stringify(slugs, null, 2));
