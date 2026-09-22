/** Файлы данных базы — единственное место, где записано, откуда скрипты читают.
 *
 *  Справка едет из этих файлов в базу скриптами наполнения; правка прямо в базе
 *  откатится следующим прогоном. Теги и сезоны продублированы между `films-data.json`
 *  и своими файлами — менять оба и гонять `npm run check-data`. */
export const DATA_FILES = {
  films: 'content/films-data.json',
  tags: 'content/tags-data.json',
  seasons: 'content/seasons-data.json',
  dossiers: 'content/dossier-data.json',
  people: 'content/people-data.json',
} as const;
