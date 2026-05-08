import { Icon } from '../components/Icon';

export default function Export() {
  return (
    <div className="as" style={{ height: '100%', position: 'relative', overflow: 'hidden' }}>
      <div style={{ position: 'absolute', inset: 0, opacity: 0.42, filter: 'blur(1.5px)' }}>
        <div style={{ height: '100%', display: 'grid', gridTemplateColumns: '260px 1fr 320px' }}>
          <div style={{ background: 'var(--bg-deep)' }} />
          <div style={{ background: 'var(--bg)', display: 'flex', justifyContent: 'center', padding: '40px 0' }}>
            <div style={{ width: 600, height: '90%', background: 'var(--paper)', borderRadius: '4px 4px 0 0' }} />
          </div>
          <div style={{ background: 'var(--bg-deep)' }} />
        </div>
      </div>
      <div style={{ position: 'absolute', inset: 0, background: 'oklch(0.10 0.012 50 / 0.55)' }} />

      <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ width: 680, background: 'var(--bg-deep)', border: '1px solid var(--border)', borderRadius: 16, overflow: 'hidden' }}>
          <div style={{ padding: '22px 28px 18px', borderBottom: '1px solid var(--border-soft)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div>
              <div style={{ font: '500 10.5px var(--font-mono)', color: 'var(--ink-3)', letterSpacing: '0.16em', textTransform: 'uppercase', marginBottom: 4 }}>Экспорт книги</div>
              <h2 style={{ font: '600 22px var(--font-serif)', letterSpacing: '-0.01em' }}>Северный архив · 21 540 слов</h2>
            </div>
            <button className="tb-btn" style={{ width: 30, height: 30, borderRadius: 999, border: '1px solid var(--border)' }}>×</button>
          </div>

          <div style={{ padding: '20px 28px 8px' }}>
            <div style={{ font: '500 10.5px var(--font-mono)', color: 'var(--ink-3)', letterSpacing: '0.14em', textTransform: 'uppercase', marginBottom: 12 }}>Формат</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10, marginBottom: 24 }}>
              {[
                { f: 'EPUB', desc: 'Электронные читалки', active: true },
                { f: 'FB2', desc: 'Русские читалки и pocketbook', active: false },
                { f: 'DOCX', desc: 'Word, для редактора', active: false },
              ].map((o, i) => (
                <div key={i} style={{ padding: '14px 16px', borderRadius: 10, border: o.active ? '1px solid var(--accent)' : '1px solid var(--border-soft)', background: o.active ? 'var(--accent-soft)' : 'var(--surface)', cursor: 'pointer' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                    <span style={{ width: 14, height: 14, borderRadius: 999, border: '1.5px solid ' + (o.active ? 'var(--accent)' : 'var(--border-strong)'), display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      {o.active && <span style={{ width: 6, height: 6, borderRadius: 999, background: 'var(--accent)' }} />}
                    </span>
                    <span style={{ font: '500 14px var(--font-serif)', color: 'var(--ink)' }}>{o.f}</span>
                  </div>
                  <div style={{ fontSize: 11.5, color: 'var(--ink-3)', lineHeight: 1.4 }}>{o.desc}</div>
                </div>
              ))}
            </div>

            <div style={{ font: '500 10.5px var(--font-mono)', color: 'var(--ink-3)', letterSpacing: '0.14em', textTransform: 'uppercase', marginBottom: 12 }}>Метаданные</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 20 }}>
              {[['Название', 'Северный архив'], ['Автор', 'Анна Корвин'], ['Жанр', 'Тёмное фэнтези'], ['Язык', 'ru-RU']].map(([l, v], i) => (
                <div key={i} style={{ padding: '10px 12px', background: 'var(--surface)', border: '1px solid var(--border-soft)', borderRadius: 8 }}>
                  <div style={{ font: '400 10px var(--font-mono)', color: 'var(--ink-3)', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 3 }}>{l}</div>
                  <div style={{ fontSize: 13.5, color: 'var(--ink)' }}>{v}</div>
                </div>
              ))}
            </div>

            <div style={{ font: '500 10.5px var(--font-mono)', color: 'var(--ink-3)', letterSpacing: '0.14em', textTransform: 'uppercase', marginBottom: 12 }}>Включить</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 2, marginBottom: 8 }}>
              {([
                ['Все 10 глав (только готовые отметить отдельно)', true],
                ['Титульная страница и оглавление', true],
                ['Заметки на полях как сноски', false],
                ['Список персонажей в приложении', false],
              ] as const).map(([l, on], i) => (
                <label key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 0', borderBottom: i < 3 ? '1px solid var(--border-soft)' : 'none', fontSize: 13, color: 'var(--ink-2)' }}>
                  <span style={{ width: 32, height: 18, borderRadius: 999, background: on ? 'var(--accent)' : 'var(--surface-2)', position: 'relative', transition: 'all 150ms', flexShrink: 0 }}>
                    <span style={{ position: 'absolute', top: 2, left: on ? 16 : 2, width: 14, height: 14, borderRadius: 999, background: 'var(--ink)' }} />
                  </span>
                  {l}
                </label>
              ))}
            </div>
          </div>

          <div style={{ padding: '18px 28px', borderTop: '1px solid var(--border-soft)', display: 'flex', alignItems: 'center', gap: 12, background: 'var(--surface)' }}>
            <span style={{ fontSize: 11.5, color: 'var(--ink-3)' }}>
              Файл: <span style={{ font: '500 12px var(--font-mono)', color: 'var(--ink-2)' }}>severnyy-arkhiv-2026-05-08.epub</span> · ~ 280 КБ
            </span>
            <span style={{ flex: 1 }} />
            <button className="btn">Отмена</button>
            <button className="btn btn--primary"><Icon name="download" size={14} /> Скачать EPUB</button>
          </div>
        </div>
      </div>
    </div>
  );
}
