'use client';

import { usePathname } from 'next/navigation';

/** Переключатель режима «глазами гостя» в подвале.
 *
 *  Клиентский компонент ради одного: текущий путь известен только на клиенте,
 *  а подвал стоит на шести страницах, и таскать путь пропсами через каждую значило бы
 *  шесть одинаковых правок. Путь уезжает параметром `back`, и маршрут возвращает
 *  на него же — режим включается и снимается там, где стоишь.
 *
 *  Обычный `<a>`, а не `Link`: маршрут ставит куку и отвечает редиректом, клиентская
 *  навигация здесь не нужна — так же сделан «Выйти». */
export default function ViewModeLink({
  mode,
  className,
}: {
  mode: 'guest' | 'owner';
  className?: string;
}) {
  const pathname = usePathname();
  const route = mode === 'guest' ? 'guest-view' : 'owner-view';

  return (
    <a href={`/owner/${route}?back=${encodeURIComponent(pathname)}`} className={className}>
      {mode === 'guest' ? 'Посмотреть глазами гостя' : 'Вернуться к своему виду'}
    </a>
  );
}
