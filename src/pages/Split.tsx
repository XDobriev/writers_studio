import { Icon } from '../components/Icon';
import { Sidebar } from '../components/Chrome';

const left = `
  <p class="no-indent" style="font-variant: small-caps; letter-spacing: 0.06em; color: var(--paper-ink-2); font-size: 12px; margin-bottom: 22px;">Глава 5 · сцена 2</p>
  <h2 class="ch-title" style="font-size: 26px; margin-bottom: 18px;">Карты, которые лгут</h2>
  <div class="ch-rule"></div>
  <p class="no-indent">Хозяин трактира принёс ей стопку карт, перевязанных серой лентой.</p>
  <p>— Все, что мне оставлял двенадцатый, — сказал он. — За двадцать лет.</p>
  <p>Иней развернула первую. <span class="mh">Это была Корна, нарисованная летом 805 года — за девятнадцать лет до её исчезновения</span>. Бумага пахла копотью.</p>
  <p>Вторая карта была того же города, но на ней не было ратуши. Третья — была, но колокольня стояла там, где не должно было быть колокольни. На четвёртой Корна была безлюдной, и снег вокруг лежал ровно, словно его расстелили.</p>
  <p>— Он рисовал то, что видел, — тихо сказал хозяин. — Или то, что должен был увидеть.</p>
  <p>Иней долго смотрела на четвёртую карту. <span class="mh mh--important">Она узнала почерк</span>.</p>
`;

const right = `
  <p class="no-indent" style="font-variant: small-caps; letter-spacing: 0.06em; color: var(--paper-ink-2); font-size: 12px; margin-bottom: 22px;">Глава 1 · справка</p>
  <h2 class="ch-title" style="font-size: 26px; margin-bottom: 18px;">Город, которого нет</h2>
  <div class="ch-rule"></div>
  <p class="no-indent">Магистр Терей сидел спиной к окну, и от этого его лицо казалось темнее, чем зимняя дорога. Перед ним лежало письмо, чёрные печати оттиснулись неровно, и одна сломалась пополам ещё до того, как письмо попало сюда.</p>
  <p>— Мы получили донесение из гарнизона Сольвы, — продолжал магистр. — Пять дней назад туда пришёл человек. <span class="mh">Он сказал, что был в Корне. Сказал, что Корны нет</span>.</p>
  <p>— Он сошёл с ума?</p>
  <p>— Возможно. Только он принёс с собой ключ от ратуши и колокольный язык. И ещё карту, на которой Корна нарисована заново — другой рукой, другими чернилами.</p>
  <p>Иней поняла, зачем её позвали, ещё до того, как магистр поднял глаза.</p>
`;

export default function Split() {
  const sides = [
    { side: 'left', label: 'Глава 5 · сцена 2', html: left, active: true, words: '2 320 сл' },
    { side: 'right', label: 'Глава 1 · справка', html: right, active: false, words: '4 720 сл' },
  ];
  return (
    <div className="as as-app" style={{ height: '100%' }}>
      <Sidebar active={5} />
      <main style={{ display: 'flex', flexDirection: 'column', minWidth: 0, background: 'var(--bg)' }}>
        <div className="tb">
          <button className="tb-btn"><Icon name="bold" /></button>
          <button className="tb-btn"><Icon name="italic" /></button>
          <span className="tb-sep" />
          <button className="tb-sel">Заголовок 2 <Icon name="chevd" size={12} /></button>
          <span className="tb-sep" />
          <button className="tb-btn"><Icon name="quote" /></button>
          <button className="tb-btn"><Icon name="link" /></button>
          <span className="tb-sep" />
          <span className="chip" style={{ borderColor: 'var(--accent)', color: 'var(--accent)', background: 'var(--accent-soft)' }}>Сравнение глав</span>
          <div className="tb-spacer" />
          <button className="tb-btn"><Icon name="speak" size={15} /></button>
          <button className="tb-btn"><Icon name="timer" size={15} /></button>
          <button className="tb-btn tb-btn--on"><Icon name="split" size={15} /></button>
          <button className="tb-btn"><Icon name="focus" size={15} /></button>
        </div>

        <div style={{ flex: 1, minHeight: 0, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 1, background: 'var(--border-soft)', overflow: 'hidden' }}>
          {sides.map((s, i) => (
            <div key={i} style={{ background: 'var(--bg)', display: 'flex', flexDirection: 'column', minWidth: 0 }}>
              <div style={{ height: 36, flexShrink: 0, padding: '0 16px', display: 'flex', alignItems: 'center', gap: 10, borderBottom: '1px solid var(--border-soft)', background: 'var(--bg-deep)' }}>
                <span style={{ font: '500 10.5px var(--font-mono)', color: s.active ? 'var(--accent)' : 'var(--ink-3)', letterSpacing: '0.12em', textTransform: 'uppercase' }}>{s.label}</span>
                <span style={{ flex: 1 }} />
                <span style={{ font: '400 11px var(--font-mono)', color: 'var(--ink-3)' }}>{s.words}</span>
                <button className="tb-btn"><Icon name="moremenu" size={14} /></button>
              </div>
              <div style={{ flex: 1, minHeight: 0, overflow: 'auto', display: 'flex', justifyContent: 'center', padding: '28px 24px 60px', background: 'var(--bg)' }}>
                <div className="sheet" style={{ width: 520, padding: '40px 48px 60px', fontSize: 15.5 }} dangerouslySetInnerHTML={{ __html: s.html }} />
              </div>
            </div>
          ))}
        </div>

        <div className="status">
          <span><span className="status-dot" style={{ display: 'inline-block', marginRight: 6, verticalAlign: 'middle' }} />обе панели сохранены</span>
          <span style={{ color: 'var(--ink-4)' }}>·</span>
          <span>слева: гл. 5 (черновик) · справа: гл. 1 (готово)</span>
          <span style={{ flex: 1 }} />
          <span style={{ color: 'var(--accent-2)' }}>совпадение почерка двенадцатого картографа</span>
        </div>
      </main>
    </div>
  );
}
