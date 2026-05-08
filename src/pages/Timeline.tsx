import { Icon } from '../components/Icon';
import { WithMode } from '../components/Chrome';
import { NOVEL } from '../data/sample';

interface Event {
  era: string;
  pos: number;
  title: string;
  type: 'plot' | 'character' | 'world' | 'other';
  ch: number | null;
  desc: string;
}

const events: Event[] = [
  { era: '412 г.', pos: 4, title: 'Основание Корны', type: 'world', ch: null, desc: 'Семь семей-основателей. Серебряный колокол отлит в первый же год.' },
  { era: '580 г.', pos: 18, title: 'Первая экспедиция Тереи', type: 'world', ch: null, desc: 'Картограф Олимар достигает северных болот.' },
  { era: '711 г.', pos: 32, title: 'Сожжение архива', type: 'world', ch: null, desc: 'Терея теряет половину карт. Корна не помечена ни на одной из уцелевших.' },
  { era: 'Зима 824', pos: 50, title: 'Корна исчезает', type: 'plot', ch: null, desc: 'За одну ночь. Снег ложится ровно, ветер — ровно.' },
  { era: 'Зима 824', pos: 56, title: 'Двенадцатый картограф уходит', type: 'character', ch: 5, desc: 'Последняя запись в журнале — «иду посмотреть».' },
  { era: 'Весна 825', pos: 64, title: 'Иней получает приказ', type: 'plot', ch: 1, desc: 'Магистр Терей. Письмо с поломанной печатью.' },
  { era: 'Весна 825', pos: 72, title: 'Прибытие в Сольву', type: 'plot', ch: 3, desc: 'Гарнизон не помнит пропавшего. Полковник Нич.' },
  { era: 'Весна 825', pos: 80, title: 'Серебряный ключ', type: 'plot', ch: 3, desc: 'Висит за стойкой трактира «Серая Цапля».' },
  { era: 'Лето 825', pos: 92, title: 'Под башней', type: 'plot', ch: 9, desc: 'Финал второго акта.' },
];

const color: Record<Event['type'], string> = {
  plot: 'var(--accent)', character: 'var(--info)', world: 'var(--ok)', other: 'var(--ink-3)',
};
const label: Record<Event['type'], string> = {
  plot: 'Сюжет', character: 'Персонаж', world: 'Мир', other: 'Другое',
};

export default function Timeline() {
  return (
    <WithMode active="timeline">
      <div className="as as-app as-app--no-right" style={{ height: '100%' }}>
        <aside className="sb">
          <div className="sb-head">
            <div className="sb-book-title">{NOVEL.title}</div>
            <div className="sb-book-author">хронология · 9 событий</div>
          </div>
          <nav style={{ padding: '14px 8px', display: 'flex', flexDirection: 'column', gap: 2 }}>
            {([
              ['book', 'Манускрипт', false],
              ['char', 'Персонажи', false],
              ['map', 'Карта мира', false],
              ['clock', 'Хронология', true],
              ['layout', 'Дэшборд', false],
            ] as const).map(([n, l, on]) => (
              <a key={l} className={'sb-item' + (on ? ' sb-item--on' : '')}>
                <span style={{ display: 'flex', justifyContent: 'center', color: on ? 'var(--ink)' : 'var(--ink-3)' }}><Icon name={n} size={15} /></span>
                <span className="sb-item-title">{l}</span>
                <span />
              </a>
            ))}
          </nav>
          <div className="sb-section"><span className="sb-section-title">Слои</span></div>
          <div style={{ padding: '4px 14px', display: 'flex', flexDirection: 'column', gap: 6 }}>
            {Object.entries(label).map(([k, l]) => (
              <label key={k} style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 13, color: 'var(--ink-2)', padding: '4px 0' }}>
                <span style={{ width: 14, height: 14, borderRadius: 3, border: '1px solid var(--border)', background: k === 'plot' ? color[k as Event['type']] : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  {k !== 'plot' && <span style={{ width: 8, height: 8, borderRadius: 2, background: color[k as Event['type']] }} />}
                </span>
                {l}
              </label>
            ))}
          </div>
          <div style={{ padding: '14px', marginTop: 'auto', borderTop: '1px solid var(--border-soft)', display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div style={{ font: '500 10px var(--font-mono)', color: 'var(--ink-3)', letterSpacing: '0.14em', textTransform: 'uppercase' }}>Внутреннее время книги</div>
            <div style={{ font: '500 14px var(--font-serif)' }}>Зима 824 — Лето 825</div>
            <div style={{ fontSize: 12, color: 'var(--ink-3)' }}>~ 8 месяцев</div>
          </div>
        </aside>

        <main style={{ display: 'flex', flexDirection: 'column', background: 'var(--bg)' }}>
          <div className="tb" style={{ justifyContent: 'space-between' }}>
            <span style={{ font: '500 13px var(--font-ui)' }}>Хронология «{NOVEL.title}»</span>
            <div style={{ display: 'flex', gap: 6 }}>
              <button className="tb-btn"><Icon name="layout" size={15} /> По главам</button>
              <button className="tb-btn tb-btn--on"><Icon name="clock" size={15} /> По времени</button>
              <button className="btn"><Icon name="plus" size={14} /> Событие</button>
            </div>
          </div>

          <div style={{ flex: 1, minHeight: 0, overflow: 'auto', padding: '40px 32px' }}>
            <div style={{ position: 'relative', height: 520, marginTop: 20, minWidth: 1500 }}>
              <div style={{ position: 'absolute', left: 0, right: 0, top: 260, height: 1, background: 'var(--border-strong)' }} />
              {([['IV в.', 4], ['V в.', 18], ['VI в.', 32], ['VII в.', 46], ['VIII в.', 60], ['IX в.', 80]] as const).map(([l, x], i) => (
                <div key={i} style={{ position: 'absolute', left: x + '%', top: 255, transform: 'translateX(-50%)' }}>
                  <div style={{ width: 1, height: 16, background: 'var(--ink-4)' }} />
                  <div style={{ font: '500 10.5px var(--font-mono)', color: 'var(--ink-3)', marginTop: 6, letterSpacing: '0.06em', whiteSpace: 'nowrap' }}>{l}</div>
                </div>
              ))}
              {events.map((e, i) => {
                const above = i % 2 === 0;
                const top = above ? 60 : 290;
                const lineH = 200;
                return (
                  <div key={i} style={{ position: 'absolute', left: e.pos + '%', top, transform: 'translateX(-50%)', width: 200, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                    {!above && <div style={{ position: 'absolute', bottom: '100%', width: 1, height: 30, background: color[e.type] }} />}
                    <div style={{ background: 'var(--surface)', border: '1px solid var(--border-soft)', borderLeft: `3px solid ${color[e.type]}`, borderRadius: 8, padding: '10px 12px', width: '100%', position: 'relative' }}>
                      <div style={{ font: '500 9.5px var(--font-mono)', color: color[e.type], letterSpacing: '0.14em', textTransform: 'uppercase', marginBottom: 4 }}>{label[e.type]} · {e.era}</div>
                      <div style={{ font: '500 13.5px var(--font-serif)', color: 'var(--ink)', marginBottom: 6, lineHeight: 1.25 }}>{e.title}</div>
                      <div style={{ fontSize: 11.5, color: 'var(--ink-2)', lineHeight: 1.45 }}>{e.desc}</div>
                      {e.ch && <div style={{ font: '400 10px var(--font-mono)', color: 'var(--ink-3)', marginTop: 8, paddingTop: 6, borderTop: '1px dashed var(--border-soft)', letterSpacing: '0.04em' }}>→ ГЛ. {String(e.ch).padStart(2, '0')}</div>}
                    </div>
                    {above && <>
                      <div style={{ width: 1, height: lineH - 180, background: color[e.type] }} />
                      <div style={{ width: 10, height: 10, borderRadius: 999, background: color[e.type], marginTop: -3, border: '2px solid var(--bg)' }} />
                    </>}
                    {!above && <div style={{ width: 10, height: 10, borderRadius: 999, background: color[e.type], position: 'absolute', top: -34, border: '2px solid var(--bg)' }} />}
                  </div>
                );
              })}
            </div>
          </div>
        </main>
      </div>
    </WithMode>
  );
}
