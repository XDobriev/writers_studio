export type ChapterStatus = 'draft' | 'progress' | 'done';

export interface SampleChapter {
  num: number;
  title: string;
  words: number;
  status: ChapterStatus;
}

export interface SampleCharacter {
  initials: string;
  name: string;
  role: 'protagonist' | 'secondary' | 'minor';
  sub: string;
}

export interface SampleLocation {
  name: string;
  type: 'city' | 'village' | 'forest' | 'sea' | 'castle' | 'other';
  note: string;
}

export interface SampleTimelineEntry {
  era: string;
  title: string;
  type: 'world' | 'plot' | 'character' | 'other';
}

export interface SampleMargin {
  id: number;
  kind: 'idea' | 'question' | 'todo' | 'important';
  time: string;
  text: string;
  quote: string;
}

export interface SampleVersion {
  date: string;
  words: number;
  label: string;
  active?: boolean;
}

export interface SampleNovel {
  title: string;
  author: string;
  genre: string;
  description: string;
  chapters: SampleChapter[];
  characters: SampleCharacter[];
  locations: SampleLocation[];
  timeline: SampleTimelineEntry[];
  margins: SampleMargin[];
  versions: SampleVersion[];
}

export const NOVEL: SampleNovel = {
  title: 'Северный архив',
  author: 'Анна Корвин',
  genre: 'Тёмное фэнтези',
  description:
    'Картограф ордена Тереи получает приказ восстановить карту города, которого больше нет.',
  chapters: [
    { num: 1, title: 'Город, которого нет', words: 4720, status: 'done' },
    { num: 2, title: 'Письмо из Корны', words: 3812, status: 'done' },
    { num: 3, title: 'Трактир «Серая Цапля»', words: 5104, status: 'done' },
    { num: 4, title: 'Дорога вдоль Тихой', words: 2998, status: 'progress' },
    { num: 5, title: 'Карты, которые лгут', words: 3320, status: 'progress' },
    { num: 6, title: 'Снег и колокол', words: 1604, status: 'progress' },
    { num: 7, title: 'Архив старой Тереи', words: 0, status: 'draft' },
    { num: 8, title: 'Двенадцатый картограф', words: 0, status: 'draft' },
    { num: 9, title: 'Под башней', words: 0, status: 'draft' },
    { num: 10, title: 'Тишина в Корне', words: 0, status: 'draft' },
  ],
  characters: [
    { initials: 'ИВ', name: 'Иней Ворон', role: 'protagonist', sub: 'Картограф Тереи · 31' },
    { initials: 'СК', name: 'Стен Кальм', role: 'secondary', sub: 'Хранитель архива · 64' },
    { initials: 'ЛМ', name: 'Лето Маркис', role: 'secondary', sub: 'Наёмник · 38' },
    { initials: 'АР', name: 'Аделия Рейн', role: 'secondary', sub: 'Сестра пропавшего · 27' },
    { initials: 'ПН', name: 'Полковник Нич', role: 'minor', sub: 'Гарнизон Сольвы' },
    { initials: 'МК', name: 'Малик Кеор', role: 'minor', sub: 'Возница' },
  ],
  locations: [
    { name: 'Терея', type: 'city', note: 'Столица ордена картографов' },
    { name: 'Корна', type: 'city', note: 'Исчезнувший город — главная загадка' },
    { name: 'Сольва', type: 'village', note: 'Перекрёсток на тракте' },
    { name: 'Серая Цапля', type: 'other', note: 'Трактир в трёх днях от Корны' },
    { name: 'Лес Тихой', type: 'forest', note: 'Тянется от Сольвы до северных болот' },
  ],
  timeline: [
    { era: 'Год 412', title: 'Основание Корны', type: 'world' },
    { era: 'Год 580', title: 'Первая экспедиция Тереи', type: 'world' },
    { era: 'Зима 824', title: 'Город исчезает', type: 'plot' },
    { era: 'Весна 825', title: 'Иней получает приказ', type: 'plot' },
    { era: 'Весна 825', title: 'Прибытие в Сольву', type: 'plot' },
    { era: 'Весна 825', title: 'Встреча с Лето', type: 'character' },
    { era: 'Лето 825', title: 'Под башней', type: 'plot' },
  ],
  margins: [
    {
      id: 1,
      kind: 'idea',
      time: 'вчера',
      text: 'Сделать упоминание матери Инея в самом начале — отзеркалит финал.',
      quote: 'тоньше и темнее, чем шёлк, но плотнее',
    },
    {
      id: 2,
      kind: 'question',
      time: '2 ч',
      text: 'Откуда у трактирщика серебряный ключ? Это ружьё на стене или просто деталь?',
      quote: 'Серебряный ключ висел на гвозде',
    },
    {
      id: 3,
      kind: 'todo',
      time: '5 мин',
      text: 'Проверить — Иней могла быть в Корне ребёнком? Нужен флэшбек в гл. 7.',
      quote: 'я родилась там же, где и снег',
    },
    {
      id: 4,
      kind: 'important',
      time: '10 мин',
      text: 'НЕ называть имя двенадцатого картографа до главы 8.',
      quote: 'один из нас не вернулся',
    },
  ],
  versions: [
    { date: '8 мая, 14:32', words: 4720, label: 'Финал главы', active: true },
    { date: '8 мая, 11:07', words: 4380, label: 'Снимок · авто' },
    { date: '7 мая, 22:14', words: 4102, label: 'После правок Е.' },
    { date: '7 мая, 19:50', words: 3940, label: 'Снимок · авто' },
    { date: '6 мая, 23:11', words: 3840, label: 'Перенесла сцену' },
    { date: '5 мая, 17:22', words: 2980, label: 'Снимок · авто' },
    { date: '4 мая, 09:58', words: 2120, label: 'Начало' },
  ],
};

export const SAMPLE_PROSE = `
<p class="no-indent" style="font-variant: small-caps; letter-spacing: 0.06em; color: var(--paper-ink-2); font-size: 13px; margin-bottom: 32px;">Глава первая</p>
<h2 class="ch-title" style="font-family: var(--font-serif); font-size: 32px; font-weight: 600; line-height: 1.15; letter-spacing: -0.012em; margin-bottom: 24px;">Город, которого нет</h2>
<div class="ch-rule"></div>

<p class="no-indent">Корна исчезла за одну ночь, и никто из тех, кто жил в Терее, не желал в это верить.</p>

<p>Иней Ворон узнала об этом в архиве, на третьем этаже башни, где пахло железом и сушёным мхом. <span class="mh">Она переписывала контуры озера, которого никогда не видела</span>, когда чьи-то шаги остановились за её спиной — слишком близко, чтобы быть случайными.</p>

<p>— Картограф Ворон, — сказал голос. Голос был старый и сухой, как страница. — Магистр требует вас немедленно.</p>

<p>Иней не подняла головы. Кисть в её руке вела мягкую кривую — северный край озера, мнимый, но обязательный для атласа. <span class="mh mh--question">Она знала, что если магистр требует «немедленно», значит дело либо очень крупное, либо очень неприятное</span>. Чаще — и то, и другое.</p>

<p class="scene-break">· · ·</p>

<p class="no-indent">Магистр Терей сидел спиной к окну, и от этого его лицо казалось темнее, чем зимняя дорога. Перед ним лежало письмо <span class="spell">пергамент</span>, чёрные печати оттиснулись неровно, и одна сломалась пополам ещё до того, как письмо попало сюда.</p>

<p>— Ты слышала про Корну? — спросил он, не глядя на неё.</p>

<p>— Северный город. Семь тысяч жителей. Сорок два дня пути по тракту через Сольву.</p>

<p>— Шесть тысяч девятьсот сорок четыре, — поправил магистр. — И больше нет ни одного.</p>

<p>Иней замолчала. Где-то в зале часы пробили полдень, гулко и без интереса. <span class="mh mh--important">«Город, которого нет», — мысленно повторила она, и эти слова легли в её память как мокрое железо в снег</span>.</p>

<p>— Мы получили <del class="del">сообщение</del><ins class="ins">донесение</ins> из гарнизона Сольвы, — продолжал магистр. — Пять дней назад туда пришёл человек. Он сказал, что был в Корне. Сказал, что Корны нет. Не разрушена — нет. Снег ровный, ветер ровный, и тишина — ровная.</p>

<p>— Он сошёл с ума?</p>

<p>— Возможно. Только он принёс с собой ключ от ратуши и колокольный язык. <span class="mh mh--todo">И ещё карту, на которой Корна нарисована заново — другой рукой, другими чернилами</span>.</p>

<p>Иней поняла, зачем её позвали, ещё до того, как магистр поднял глаза.</p>

<p>— Поедешь? — спросил он. Это не был вопрос.</p>

<p>— Поеду, — ответила она.</p>

<p class="scene-break">· · ·</p>

<p class="no-indent">Той же ночью, когда снег лёг на крыши Тереи неправильно — слишком ровно, словно его расстелили чьи-то очень старые руки, — Иней вернулась в свою комнату и достала из нижнего ящика стола карту, которую сама нарисовала пятнадцать лет назад. На карте стояла Корна. На карте стояла её мать, не нарисованная, но всё равно стоящая. Иней долго смотрела на эту карту.</p>

<p>Потом она свернула её и положила во внутренний карман плаща — туда, где сердце.</p>
`;
