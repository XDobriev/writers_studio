import { Icon } from '../components/Icon';
import { WithMode } from '../components/Chrome';
import { NOVEL, type SampleChapter } from '../data/sample';

function Card({ c, synopsis }: { c: SampleChapter; synopsis: string }) {
  return (
    <div style={{ background: 'var(--surface)', border: '1px solid var(--border-soft)', borderRadius: 8, padding: '14px 16px 16px', position: 'relative', minHeight: 180, display: 'flex', flexDirection: 'column' }}>
      <div style={{ position: 'absolute', top: -6, left: 14, width: 10, height: 10, borderRadius: 999, background: 'var(--accent-2)', border: '2px solid var(--bg-deep)' }} />
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 6 }}>
        <span style={{ font: '500 10px var(--font-mono)', color: 'var(--accent)', letterSpacing: '0.1em' }}>ГЛ. {String(c.num).padStart(2, '0')}</span>
        <span style={{ flex: 1 }} />
        <span style={{ font: '400 10px var(--font-mono)', color: 'var(--ink-3)' }}>{c.words.toLocaleString('ru')} сл</span>
      </div>
      <div style={{ font: '500 16px var(--font-serif)', letterSpacing: '-0.005em', marginBottom: 10 }}>{c.title}</div>
      <div style={{ flex: 1, fontSize: 12.5, color: 'var(--ink-2)', lineHeight: 1.55 }}>{synopsis}</div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 12, paddingTop: 10, borderTop: '1px dashed var(--border-soft)' }}>
        <span style={{ width: 6, height: 6, borderRadius: 999, background: c.status === 'done' ? 'var(--ok)' : c.status === 'progress' ? 'var(--accent-2)' : 'var(--ink-4)' }} />
        <span style={{ font: '400 10.5px var(--font-mono)', color: 'var(--ink-3)', letterSpacing: '0.06em', textTransform: 'uppercase' }}>
          {c.status === 'done' ? 'готово' : c.status === 'progress' ? 'в работе' : 'черновик'}
        </span>
        <span style={{ flex: 1 }} />
        <Icon name="moremenu" size={14} />
      </div>
    </div>
  );
}

export default function Corkboard() {
  const synopsisFor = (num: number): string => {
    const map: Record<number, string> = {
      1: 'Картограф Иней Ворон узнаёт об исчезновении города Корна. Магистр Терей вручает ей задание — восстановить карту того, чего больше нет.',
      2: 'Иней разбирает письмо от пропавшего двенадцатого картографа. Сборы в путь. Прощание с её наставником Каролом, который остаётся в Терее.',
      3: 'Иней доезжает до трактира «Серая Цапля» и встречает наёмника Лето Маркиса. Серебряный ключ от ратуши Корны висит за стойкой — никто не помнит откуда.',
      4: 'Дорога вдоль реки Тихой. Иней слышит колокол там, где не должно быть деревень. Ночёвка у воды.',
      5: 'У хозяина трактира — стопка карт, нарисованных одной и той же рукой за разные века. Двенадцатый картограф был здесь.',
      6: 'Гарнизон Сольвы. Полковник Нич отказывается подтверждать сообщение. Снег идёт ровный, словно его расстелили.',
    };
    return map[num] ?? 'План сцен пока не написан.';
  };

  return (
    <WithMode active="editor">
      <div className="as as-app as-app--no-right" style={{ height: '100%' }}>
        <aside className="sb">
          <div className="sb-head">
            <div className="sb-book-title">{NOVEL.title}</div>
            <div className="sb-book-author">10 глав · 21 540 сл</div>
          </div>
          <div className="sb-tabs">
            <button className="sb-tab">Список</button>
            <button className="sb-tab sb-tab--on">Доска</button>
            <button className="sb-tab">Структура</button>
          </div>
          <div style={{ padding: '18px 18px 14px', color: 'var(--ink-3)', fontSize: 12, lineHeight: 1.6 }}>
            На доске — главы как индексные карточки. Перетащите, чтобы изменить порядок. Двойной щелчок — открыть в редакторе.
          </div>
          <div style={{ padding: '10px 14px', display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div style={{ font: '500 10px var(--font-mono)', color: 'var(--ink-3)', letterSpacing: '0.14em', textTransform: 'uppercase' }}>Фильтр</div>
            {([['все', true, 10], ['готово', false, 3], ['в работе', false, 3], ['черновик', false, 4]] as const).map(([l, on, n], i) => (
              <button key={i} className={'sb-item' + (on ? ' sb-item--on' : '')}>
                <span />
                <span className="sb-item-title" style={{ textTransform: 'capitalize' }}>{l}</span>
                <span className="sb-item-meta">{n}</span>
              </button>
            ))}
          </div>
        </aside>

        <main style={{ display: 'flex', flexDirection: 'column', background: 'var(--bg)' }}>
          <div className="tb" style={{ justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={{ font: '500 13px var(--font-ui)', color: 'var(--ink)' }}>Доска глав</span>
              <span className="chip">3 готово · 3 в работе · 4 черновик</span>
            </div>
            <div style={{ display: 'flex', gap: 6 }}>
              <button className="tb-btn"><Icon name="grid" size={15} /></button>
              <button className="tb-btn"><Icon name="layout" size={15} /></button>
              <button className="btn"><Icon name="plus" size={14} /> Новая глава</button>
            </div>
          </div>

          <div style={{ flex: 1, minHeight: 0, overflow: 'auto', padding: '28px 32px', background: 'repeating-linear-gradient(45deg, var(--bg) 0 24px, var(--bg-deep) 24px 25px)' }}>
            <div style={{ font: '500 10px var(--font-mono)', color: 'var(--ink-3)', letterSpacing: '0.14em', textTransform: 'uppercase', marginBottom: 16 }}>Часть I · Снег</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 20, marginBottom: 32 }}>
              {NOVEL.chapters.slice(0, 3).map((c) => <Card key={c.num} c={c} synopsis={synopsisFor(c.num)} />)}
            </div>
            <div style={{ font: '500 10px var(--font-mono)', color: 'var(--ink-3)', letterSpacing: '0.14em', textTransform: 'uppercase', marginBottom: 16 }}>Часть II · Тракт</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 20, marginBottom: 32 }}>
              {NOVEL.chapters.slice(3, 6).map((c) => <Card key={c.num} c={c} synopsis={synopsisFor(c.num)} />)}
            </div>
            <div style={{ font: '500 10px var(--font-mono)', color: 'var(--ink-3)', letterSpacing: '0.14em', textTransform: 'uppercase', marginBottom: 16 }}>Часть III · Корна</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 20 }}>
              {NOVEL.chapters.slice(6).map((c) => <Card key={c.num} c={c} synopsis="План сцен пока не написан." />)}
            </div>
          </div>
        </main>
      </div>
    </WithMode>
  );
}
