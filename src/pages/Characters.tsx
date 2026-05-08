import { Icon } from '../components/Icon';
import { WithMode } from '../components/Chrome';
import { NOVEL } from '../data/sample';

const detail = {
  name: 'Иней Ворон', role: 'protagonist', age: 31,
  role_label: 'Главный герой',
  appearance: 'Высокая, худая, светлые волосы, состриженные коротко по обычаю ордена. Шрам через правую бровь — память о падении в Сольве в детстве. Носит зимний плащ Тереи с медной застёжкой в форме секстанта.',
  personality: 'Замкнутая, точная, не доверяет совпадениям. Считает карты честнее людей. Умеет подолгу молчать так, что собеседник начинает говорить вместо неё.',
  backstory: 'Родилась в северной деревне, которая позже была включена в карты Тереи под другим именем. Мать — травница, погибшая, когда Инею было девять. Принята в орден в 14 лет, обет картографа дала в 19. До «Северного архива» составила атлас побережья Хольда — самая молодая, кто это делал.',
  notes: 'НЕ говорит о матери до главы 6. У неё есть карта детства во внутреннем кармане плаща — это деталь, которая раскроется в финале.',
  appearsIn: [1, 2, 3, 4, 5, 6, 8, 9, 10] as number[],
};

export default function Characters() {
  return (
    <WithMode active="characters">
      <div className="as as-app as-app--no-right" style={{ height: '100%' }}>
        <aside className="sb">
          <div className="sb-head">
            <div className="sb-book-title">{NOVEL.title}</div>
            <div className="sb-book-author">персонажи · 6</div>
          </div>
          <nav style={{ padding: '14px 8px', display: 'flex', flexDirection: 'column', gap: 2 }}>
            {([
              ['book', 'Манускрипт', false],
              ['char', 'Персонажи', true],
              ['map', 'Карта мира', false],
              ['clock', 'Хронология', false],
            ] as const).map(([n, l, on]) => (
              <a key={l} className={'sb-item' + (on ? ' sb-item--on' : '')}>
                <span style={{ display: 'flex', justifyContent: 'center', color: on ? 'var(--ink)' : 'var(--ink-3)' }}><Icon name={n} size={15} /></span>
                <span className="sb-item-title">{l}</span>
                <span />
              </a>
            ))}
          </nav>
          <div style={{ padding: '12px 14px 6px' }}>
            <div style={{ height: 32, padding: '0 10px', border: '1px solid var(--border-soft)', borderRadius: 6, display: 'flex', alignItems: 'center', gap: 6, color: 'var(--ink-3)', fontSize: 12 }}>
              <Icon name="search" size={13} /> Поиск
            </div>
          </div>
          <div style={{ padding: '10px 14px 6px', display: 'flex', gap: 4 }}>
            {['все', 'главные', 'второстеп.', 'эпиз.'].map((l, i) => (
              <button key={i} className="sb-tab" style={i === 0 ? { background: 'var(--surface)', color: 'var(--ink)' } : {}}>{l}</button>
            ))}
          </div>
          <div style={{ flex: 1, overflow: 'auto', padding: '4px 8px 8px' }}>
            {NOVEL.characters.map((c, i) => (
              <div key={c.name} className={'sb-item' + (i === 0 ? ' sb-item--on' : '')} style={{ height: 'auto', padding: '8px 10px' }}>
                <span style={{ width: 30, height: 30, borderRadius: 999, background: i === 0 ? 'var(--accent)' : 'var(--surface-2)', display: 'flex', alignItems: 'center', justifyContent: 'center', font: '500 11px var(--font-ui)', color: i === 0 ? 'oklch(0.98 0 0)' : 'var(--ink)', gridRow: '1 / 3', marginRight: 2 }}>{c.initials}</span>
                <div style={{ minWidth: 0 }}>
                  <div className="sb-item-title">{c.name}</div>
                  <div style={{ font: '400 11px var(--font-mono)', color: 'var(--ink-3)', letterSpacing: '0.04em' }}>{c.sub}</div>
                </div>
                <span />
              </div>
            ))}
          </div>
          <div style={{ padding: '10px 14px', borderTop: '1px solid var(--border-soft)' }}>
            <button className="btn" style={{ width: '100%', justifyContent: 'center' }}><Icon name="plus" size={13} /> Новый персонаж</button>
          </div>
        </aside>

        <main style={{ display: 'flex', flexDirection: 'column', background: 'var(--bg)', overflow: 'hidden' }}>
          <div className="tb" style={{ justifyContent: 'space-between' }}>
            <span style={{ font: '500 13px var(--font-ui)' }}>Картотека персонажей</span>
            <div style={{ display: 'flex', gap: 6 }}>
              <button className="tb-btn"><Icon name="grid" size={15} /></button>
              <button className="tb-btn tb-btn--on"><Icon name="layout" size={15} /></button>
              <button className="btn"><Icon name="download" size={14} /> Экспорт</button>
            </div>
          </div>

          <div style={{ flex: 1, minHeight: 0, overflow: 'auto', padding: '32px 48px' }}>
            <div style={{ display: 'flex', gap: 32, alignItems: 'flex-start', marginBottom: 36 }}>
              <div style={{ width: 160, height: 200, borderRadius: 8, background: 'linear-gradient(160deg, oklch(0.45 0.04 50), oklch(0.25 0.02 50))', display: 'flex', alignItems: 'flex-end', justifyContent: 'center', padding: 18, position: 'relative', overflow: 'hidden' }}>
                <div style={{ position: 'absolute', inset: 0, background: 'repeating-linear-gradient(135deg, oklch(0.40 0.04 50) 0 6px, oklch(0.36 0.04 50) 6px 12px)', opacity: 0.4 }} />
                <div style={{ position: 'relative', font: '600 56px var(--font-serif)', color: 'oklch(0.95 0.01 80 / 0.9)', letterSpacing: '-0.02em' }}>
                  {detail.name.split(' ').map((s) => s[0]).join('')}
                </div>
                <div style={{ position: 'absolute', top: 8, left: 8, right: 8, font: '400 9px var(--font-mono)', color: 'oklch(0.95 0.01 80 / 0.5)', letterSpacing: '0.14em' }}>ПОРТРЕТ — НЕТ</div>
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                  <span className="chip chip--accent">{detail.role_label}</span>
                  <span className="chip">{detail.age} год</span>
                  <span className="chip">упоминается в 9 главах</span>
                </div>
                <h1 style={{ font: '600 44px var(--font-serif)', letterSpacing: '-0.018em', marginBottom: 6 }}>{detail.name}</h1>
                <p style={{ font: '400 15px/1.65 var(--font-serif)', color: 'var(--ink-2)', maxWidth: 560, fontStyle: 'italic' }}>«я родилась там же, где и снег. Там, где сейчас ничего нет.»</p>
                <div style={{ display: 'flex', gap: 8, marginTop: 18 }}>
                  <button className="btn"><Icon name="plus" size={14} /> Добавить связь</button>
                  <button className="btn btn--ghost">Дублировать</button>
                  <button className="btn btn--ghost" style={{ color: 'var(--danger)' }}>Удалить</button>
                </div>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, marginBottom: 24 }}>
              {([
                ['Внешность', detail.appearance],
                ['Характер', detail.personality],
                ['Предыстория', detail.backstory],
                ['Авторские заметки', detail.notes, true],
              ] as const).map(([l, v, warn], i) => (
                <div key={i} style={{ background: warn ? 'oklch(0.70 0.16 25 / 0.08)' : 'var(--surface)', border: `1px solid ${warn ? 'oklch(0.70 0.16 25 / 0.4)' : 'var(--border-soft)'}`, borderRadius: 12, padding: '16px 18px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                    {warn && <span style={{ width: 6, height: 6, borderRadius: 999, background: 'var(--danger)' }} />}
                    <span style={{ font: '500 10.5px var(--font-mono)', color: warn ? 'var(--danger)' : 'var(--ink-3)', letterSpacing: '0.14em', textTransform: 'uppercase' }}>{l}</span>
                  </div>
                  <div style={{ font: '400 13.5px/1.65 var(--font-serif)', color: 'var(--ink)' }}>{v}</div>
                </div>
              ))}
            </div>

            <div style={{ background: 'var(--surface)', border: '1px solid var(--border-soft)', borderRadius: 12, padding: '18px 22px', marginBottom: 24 }}>
              <div style={{ font: '500 10.5px var(--font-mono)', color: 'var(--ink-3)', letterSpacing: '0.14em', textTransform: 'uppercase', marginBottom: 14 }}>Связи</div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 14 }}>
                {[
                  { who: 'Стен Кальм', rel: 'Наставник в архиве', init: 'СК' },
                  { who: 'Лето Маркис', rel: 'Спутник по тракту', init: 'ЛМ' },
                  { who: 'Аделия Рейн', rel: 'Сестра пропавшего', init: 'АР' },
                ].map((r, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 12px', border: '1px solid var(--border-soft)', borderRadius: 8 }}>
                    <div style={{ width: 34, height: 34, borderRadius: 999, background: 'var(--surface-2)', display: 'flex', alignItems: 'center', justifyContent: 'center', font: '500 12px var(--font-ui)', color: 'var(--ink-2)' }}>{r.init}</div>
                    <div style={{ minWidth: 0, flex: 1 }}>
                      <div style={{ font: '500 13px var(--font-ui)' }}>{r.who}</div>
                      <div style={{ fontSize: 11.5, color: 'var(--ink-3)' }}>{r.rel}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div style={{ background: 'var(--surface)', border: '1px solid var(--border-soft)', borderRadius: 12, padding: '18px 22px' }}>
              <div style={{ font: '500 10.5px var(--font-mono)', color: 'var(--ink-3)', letterSpacing: '0.14em', textTransform: 'uppercase', marginBottom: 14 }}>Появляется в главах</div>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {NOVEL.chapters.map((c) => {
                  const has = detail.appearsIn.includes(c.num);
                  return (
                    <div key={c.num} style={{ padding: '4px 10px', borderRadius: 999, border: has ? '1px solid var(--accent)' : '1px solid var(--border-soft)', background: has ? 'var(--accent-soft)' : 'transparent', font: '500 11.5px var(--font-mono)', color: has ? 'var(--accent)' : 'var(--ink-4)' }}>
                      {String(c.num).padStart(2, '0')} · {c.title}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </main>
      </div>
    </WithMode>
  );
}
