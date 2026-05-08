/* global React, NOVEL, SAMPLE_PROSE */

// Reusable chrome elements for the 3 editor variants

function Icon({ name, size = 16 }) {
  // Stroke icons inline — small set we actually need
  const s = size;
  const common = { width: s, height: s, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 1.5, strokeLinecap: 'round', strokeLinejoin: 'round' };
  const paths = {
    bold: <path d="M7 5h6a3.5 3.5 0 0 1 0 7H7zM7 12h7a3.5 3.5 0 0 1 0 7H7z"/>,
    italic: <><line x1="19" y1="4" x2="10" y2="4"/><line x1="14" y1="20" x2="5" y2="20"/><line x1="15" y1="4" x2="9" y2="20"/></>,
    underline: <><path d="M6 3v8a6 6 0 0 0 12 0V3"/><line x1="4" y1="21" x2="20" y2="21"/></>,
    strike: <><path d="M16 4H9a3 3 0 0 0 0 6h3"/><path d="M14 14h.5a3 3 0 0 1 0 6H8"/><line x1="4" y1="12" x2="20" y2="12"/></>,
    h1: <><path d="M4 4v16M12 4v16M4 12h8"/><path d="M17 8l3-1v13"/></>,
    h2: <><path d="M4 4v16M12 4v16M4 12h8"/><path d="M16 8a3 3 0 0 1 6 0c0 2-3 3-6 6h6"/></>,
    h3: <><path d="M4 4v16M12 4v16M4 12h8"/><path d="M16 8a3 3 0 1 1 3 4 3 3 0 1 1-3 4"/></>,
    list: <><line x1="9" y1="6" x2="20" y2="6"/><line x1="9" y1="12" x2="20" y2="12"/><line x1="9" y1="18" x2="20" y2="18"/><circle cx="5" cy="6" r="1"/><circle cx="5" cy="12" r="1"/><circle cx="5" cy="18" r="1"/></>,
    olist: <><line x1="10" y1="6" x2="20" y2="6"/><line x1="10" y1="12" x2="20" y2="12"/><line x1="10" y1="18" x2="20" y2="18"/><path d="M4 6h2M5 6V3M4 18h2a1 1 0 0 0 0-2H4a1 1 0 0 1 0-2h2"/></>,
    align: <><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="15" y2="12"/><line x1="3" y1="18" x2="18" y2="18"/></>,
    aligncenter: <><line x1="3" y1="6" x2="21" y2="6"/><line x1="6" y1="12" x2="18" y2="12"/><line x1="4" y1="18" x2="20" y2="18"/></>,
    quote: <path d="M7 7h4v6H7zM7 13c0 2 1 3 3 3M13 7h4v6h-4zM13 13c0 2 1 3 3 3"/>,
    link: <><path d="M10 13a5 5 0 0 0 7 0l3-3a5 5 0 0 0-7-7l-1 1"/><path d="M14 11a5 5 0 0 0-7 0l-3 3a5 5 0 0 0 7 7l1-1"/></>,
    color: <><circle cx="12" cy="12" r="9"/><path d="M12 3a4 4 0 0 0 0 8c2 0 3 1 3 2s-1 2-3 2-3 1-3 2 0 2 3 2"/></>,
    sparkles: <><path d="M12 3l1.5 4.5L18 9l-4.5 1.5L12 15l-1.5-4.5L6 9l4.5-1.5z"/><path d="M19 14l.7 2.3L22 17l-2.3.7L19 20l-.7-2.3L16 17l2.3-.7z"/></>,
    focus: <><path d="M4 8V5a1 1 0 0 1 1-1h3M16 4h3a1 1 0 0 1 1 1v3M20 16v3a1 1 0 0 1-1 1h-3M8 20H5a1 1 0 0 1-1-1v-3"/><circle cx="12" cy="12" r="3"/></>,
    split: <><rect x="3" y="4" width="18" height="16" rx="1.5"/><line x1="12" y1="4" x2="12" y2="20"/></>,
    speak: <><path d="M11 5L6 9H3v6h3l5 4z"/><path d="M16 9a4 4 0 0 1 0 6"/><path d="M19 6a8 8 0 0 1 0 12"/></>,
    download: <><path d="M12 4v12"/><path d="M7 11l5 5 5-5"/><path d="M5 20h14"/></>,
    save: <><path d="M5 4h11l3 3v13H5z"/><path d="M8 4v5h8V4"/></>,
    book: <><path d="M5 4h11a3 3 0 0 1 3 3v13H8a3 3 0 0 1-3-3z"/><path d="M5 17a3 3 0 0 1 3-3h11"/></>,
    layout: <><rect x="3" y="4" width="18" height="16" rx="1.5"/><line x1="9" y1="4" x2="9" y2="20"/></>,
    grid: <><rect x="3" y="3" width="8" height="8" rx="1"/><rect x="13" y="3" width="8" height="8" rx="1"/><rect x="3" y="13" width="8" height="8" rx="1"/><rect x="13" y="13" width="8" height="8" rx="1"/></>,
    tree: <><path d="M5 4v6M5 14v6M5 10h7M5 17h7M12 4h7v4h-7zM12 12h7v4h-7zM12 19h7v3h-7z"/></>,
    map: <><path d="M9 4l-6 2v14l6-2 6 2 6-2V4l-6 2z"/><line x1="9" y1="4" x2="9" y2="18"/><line x1="15" y1="6" x2="15" y2="20"/></>,
    clock: <><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></>,
    user: <><circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/></>,
    note: <><path d="M5 4h11l3 3v13H5z"/><line x1="9" y1="10" x2="15" y2="10"/><line x1="9" y1="14" x2="15" y2="14"/></>,
    plus: <><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></>,
    chev: <polyline points="9 6 15 12 9 18"/>,
    chevd: <polyline points="6 9 12 15 18 9"/>,
    track: <><path d="M4 7h10M4 12h16M4 17h13"/><path d="M16 5l4 4-4 4"/></>,
    history: <><path d="M3 12a9 9 0 1 0 3-6.7L3 8"/><path d="M3 4v4h4"/><path d="M12 8v5l3 2"/></>,
    settings: <><circle cx="12" cy="12" r="3"/><path d="M19 12a7 7 0 0 0-.1-1.1l2-1.5-2-3.5-2.4.8a7 7 0 0 0-1.9-1.1L14 3h-4l-.6 2.6a7 7 0 0 0-1.9 1.1l-2.4-.8-2 3.5 2 1.5A7 7 0 0 0 5 12c0 .4 0 .7.1 1.1l-2 1.5 2 3.5 2.4-.8a7 7 0 0 0 1.9 1.1L10 21h4l.6-2.6a7 7 0 0 0 1.9-1.1l2.4.8 2-3.5-2-1.5c.1-.4.1-.7.1-1.1z"/></>,
    timer: <><circle cx="12" cy="13" r="8"/><path d="M9 2h6M12 9v4l2 2"/></>,
    sound: <><path d="M11 5L6 9H3v6h3l5 4z"/><path d="M16 9a4 4 0 0 1 0 6"/></>,
    search: <><circle cx="11" cy="11" r="7"/><line x1="21" y1="21" x2="16" y2="16"/></>,
    eye: <><path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7-10-7-10-7z"/><circle cx="12" cy="12" r="3"/></>,
    panel: <><rect x="3" y="4" width="18" height="16" rx="1.5"/><line x1="15" y1="4" x2="15" y2="20"/></>,
    dot: <circle cx="12" cy="12" r="2"/>,
    pin: <><path d="M12 17v5"/><path d="M9 5h6l-1 6 3 2H7l3-2z"/></>,
    char: <><circle cx="12" cy="9" r="3.5"/><path d="M5 20a7 7 0 0 1 14 0"/><circle cx="12" cy="9" r="3.5"/></>,
    arrows: <><polyline points="15 6 9 12 15 18"/></>,
    moremenu: <><circle cx="6" cy="12" r="1.4"/><circle cx="12" cy="12" r="1.4"/><circle cx="18" cy="12" r="1.4"/></>,
    feather: <><path d="M21 4c0 7-7 14-14 14H4l4-4M5 17l7-7M14 7l3 3"/></>,
  };
  return <svg {...common}>{paths[name] || null}</svg>;
}
window.Icon = Icon;

function Sidebar({ active = 4 }) {
  return (
    <aside className="sb">
      <div className="sb-head">
        <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:6}}>
          <span style={{width:18,height:22,background:'var(--accent)',borderRadius:'1px 4px 4px 1px',position:'relative'}}>
            <span style={{position:'absolute',left:3,top:3,right:3,bottom:3,border:'0.5px solid oklch(0.98 0 0 / 0.6)'}}/>
          </span>
          <span style={{font:'500 11px var(--font-mono)',letterSpacing:'0.14em',textTransform:'uppercase',color:'var(--ink-3)'}}>авторская студия</span>
        </div>
        <div className="sb-book-title">{NOVEL.title}</div>
        <div className="sb-book-author">{NOVEL.author} · {NOVEL.genre}</div>
      </div>

      <nav style={{padding:'10px 8px 4px',display:'flex',flexDirection:'column',gap:1}}>
        {[
          ['book','Манускрипт',true],
          ['char','Персонажи',false],
          ['map','Карта мира',false],
          ['clock','Хронология',false],
          ['note','Заметки',false],
          ['layout','Дэшборд',false],
        ].map(([icn,label,on])=>(
          <a key={label} className="sb-item" style={on ? {background:'var(--surface)'} : {}}>
            <span style={{display:'flex',justifyContent:'center',color: on ? 'var(--ink)' : 'var(--ink-3)'}}><Icon name={icn} size={15}/></span>
            <span className="sb-item-title" style={{color: on ? 'var(--ink)' : 'var(--ink-2)'}}>{label}</span>
          </a>
        ))}
      </nav>

      <div className="sb-tabs" style={{paddingTop:14}}>
        <button className="sb-tab sb-tab--on">Список</button>
        <button className="sb-tab">Доска</button>
        <button className="sb-tab">Структура</button>
      </div>

      <div className="sb-section">
        <span className="sb-section-title">Часть I · Снег</span>
        <span className="sb-section-meta">3/3</span>
      </div>
      <div className="sb-list">
        {NOVEL.chapters.slice(0,3).map((c,i)=>(
          <div key={c.num} className={'sb-item' + (active===c.num ? ' sb-item--on':'')}>
            <span className="sb-item-num">{String(c.num).padStart(2,'0')}</span>
            <span className="sb-item-title">{c.title}</span>
            <span className={'sb-item-dot sb-item-dot--' + c.status}/>
          </div>
        ))}
      </div>

      <div className="sb-section">
        <span className="sb-section-title">Часть II · Тракт</span>
        <span className="sb-section-meta">0/3</span>
      </div>
      <div className="sb-list">
        {NOVEL.chapters.slice(3,6).map(c=>(
          <div key={c.num} className={'sb-item' + (active===c.num ? ' sb-item--on':'')}>
            <span className="sb-item-num">{String(c.num).padStart(2,'0')}</span>
            <span className="sb-item-title">{c.title}</span>
            <span className={'sb-item-dot sb-item-dot--' + c.status}/>
          </div>
        ))}
      </div>

      <div className="sb-section">
        <span className="sb-section-title">Часть III · Корна</span>
        <span className="sb-section-meta">0/4</span>
      </div>
      <div className="sb-list">
        {NOVEL.chapters.slice(6).map(c=>(
          <div key={c.num} className={'sb-item' + (active===c.num ? ' sb-item--on':'')}>
            <span className="sb-item-num">{String(c.num).padStart(2,'0')}</span>
            <span className="sb-item-title" style={{color:'var(--ink-3)'}}>{c.title}</span>
            <span className={'sb-item-dot sb-item-dot--' + c.status}/>
          </div>
        ))}
      </div>

      <div className="sb-foot">
        <div className="sb-avatar">АК</div>
        <div style={{flex:1,minWidth:0}}>
          <div className="sb-foot-name">Анна Корвин</div>
          <div className="sb-foot-meta">Свободный план</div>
        </div>
        <button className="tb-btn"><Icon name="settings" size={15}/></button>
      </div>
    </aside>
  );
}
window.Sidebar = Sidebar;

function Toolbar({ chapter = 1, dense = false }) {
  return (
    <div className="tb">
      <button className="tb-btn"><Icon name="bold"/></button>
      <button className="tb-btn"><Icon name="italic"/></button>
      <button className="tb-btn"><Icon name="underline"/></button>
      <button className="tb-btn"><Icon name="strike"/></button>
      <span className="tb-sep"/>
      <button className="tb-sel">Заголовок 2 <Icon name="chevd" size={12}/></button>
      <span className="tb-sep"/>
      <button className="tb-btn"><Icon name="list"/></button>
      <button className="tb-btn"><Icon name="olist"/></button>
      <button className="tb-btn"><Icon name="quote"/></button>
      <span className="tb-sep"/>
      <button className="tb-btn"><Icon name="align"/></button>
      <button className="tb-btn"><Icon name="link"/></button>
      <button className="tb-btn"><Icon name="color"/></button>
      <span className="tb-sep"/>
      <button className="tb-btn tb-btn--on"><Icon name="track" size={15}/> Правки</button>
      <div className="tb-spacer"/>
      <button className="tb-btn"><Icon name="sound" size={15}/></button>
      <button className="tb-btn"><Icon name="timer" size={15}/></button>
      <button className="tb-btn"><Icon name="speak" size={15}/></button>
      <button className="tb-btn"><Icon name="split" size={15}/></button>
      <button className="tb-btn"><Icon name="focus" size={15}/></button>
      <span className="tb-sep"/>
      <button className="tb-btn"><Icon name="download" size={15}/> Экспорт</button>
    </div>
  );
}
window.Toolbar = Toolbar;

function StatusBar({ words = 4720, chars = 28140, savedAt = '14:32' }) {
  return (
    <div className="status">
      <span><span className="status-dot" style={{display:'inline-block',marginRight:6,verticalAlign:'middle'}}/>Сохранено · {savedAt}</span>
      <span style={{color:'var(--ink-4)'}}>·</span>
      <span>Слов: {words.toLocaleString('ru')}</span>
      <span style={{color:'var(--ink-4)'}}>·</span>
      <span>Знаков: {chars.toLocaleString('ru')}</span>
      <span style={{color:'var(--ink-4)'}}>·</span>
      <span>~{Math.ceil(words/220)} мин чтения</span>
      <span style={{flex:1}}/>
      <span>сегодня · 348/1000 слов</span>
      <span style={{color:'var(--ink-4)'}}>·</span>
      <span style={{color:'var(--accent-2)'}}>серия 7 дней</span>
    </div>
  );
}
window.StatusBar = StatusBar;

function Sheet({ wide = false }) {
  return (
    <div className="sheet-wrap">
      <div className="sheet" style={wide ? {width:760}:{}} dangerouslySetInnerHTML={{__html: SAMPLE_PROSE}}/>
    </div>
  );
}
window.Sheet = Sheet;

function RightPanel({ tab = 'margins' }) {
  return (
    <aside className="rp">
      <div className="rp-head">
        <span className={'rp-tab' + (tab==='margins'?' rp-tab--on':'')}>Заметки на полях</span>
        <span className={'rp-tab' + (tab==='versions'?' rp-tab--on':'')}>Версии</span>
        <span style={{flex:1}}/>
        <button className="tb-btn"><Icon name="plus" size={14}/></button>
      </div>
      <div className="rp-body">
        {tab==='margins' && NOVEL.margins.map(m=>(
          <div key={m.id} className={'mn' + (m.kind!=='idea'?' mn--'+m.kind:'')}>
            <div className="mn-head">
              <span className="mn-label">{ {idea:'Идея',question:'Вопрос',todo:'TODO',important:'Важно'}[m.kind] }</span>
              <span className="mn-time">{m.time}</span>
            </div>
            <div className="mn-quote">«{m.quote}…»</div>
            <div className="mn-text">{m.text}</div>
          </div>
        ))}
        {tab==='versions' && NOVEL.versions.map((v,i)=>(
          <div key={i} className="mn" style={v.active?{borderColor:'var(--accent)'}:{}}>
            <div className="mn-head">
              <span className="mn-label">{v.label}</span>
              <span className="mn-time">{v.words.toLocaleString('ru')} сл</span>
            </div>
            <div className="mn-text" style={{color:'var(--ink-2)'}}>{v.date}</div>
            {v.active && <div style={{font:'500 10px var(--font-mono)',color:'var(--accent)',letterSpacing:'0.1em',textTransform:'uppercase'}}>текущая</div>}
          </div>
        ))}
      </div>
    </aside>
  );
}
window.RightPanel = RightPanel;

// =========================================================
// Slim rail-nav: shown when a screen is in "page" mode and its
// full sidebar is hidden via .mode-page CSS rules.
// =========================================================
function RailNav({ active = 'editor', style = {} }) {
  const items = [
    ['editor','book'], ['characters','char'], ['map','map'],
    ['timeline','clock'], ['notes','note'], ['dashboard','layout'],
  ];
  return (
    <aside style={{
      position:'absolute', left:0, top:0, bottom:0, width:56,
      background:'var(--bg-deep)', borderRight:'1px solid var(--border-soft)',
      display:'flex', flexDirection:'column', alignItems:'center',
      padding:'14px 0', gap:6, zIndex:4, ...style,
    }}>
      <div style={{width:24,height:30,background:'var(--accent)',borderRadius:'1px 4px 4px 1px',marginBottom:8,position:'relative'}}>
        <span style={{position:'absolute',inset:3,border:'0.5px solid oklch(0.98 0 0 / 0.5)'}}/>
      </div>
      {items.map(([k,icn])=>(
        <button key={k} className={'tb-btn'+(k===active?' tb-btn--on':'')} style={{width:36,height:36,borderRadius:8}}>
          <Icon name={icn} size={17}/>
        </button>
      ))}
      <div style={{flex:1}}/>
      <button className="tb-btn" style={{width:36,height:36,borderRadius:8}}><Icon name="settings" size={17}/></button>
      <div className="sb-avatar" style={{width:32,height:32,fontSize:11}}>АК</div>
    </aside>
  );
}
window.RailNav = RailNav;

// Floating mode toggle — appears bottom-right of any screen wrapped in <WithMode>.
function ScreenModeToggle({ mode, setMode, options = ['studio','page'] }) {
  const labels = { studio:['layout','Студия'], page:['focus','Страница'] };
  return (
    <div style={{position:'absolute',bottom:14,right:14,zIndex:10,display:'inline-flex',gap:2,padding:3,borderRadius:10,background:'var(--bg-deep)',border:'1px solid var(--border)',boxShadow:'0 8px 28px rgba(0,0,0,.35)'}}>
      {options.map(k => {
        const [icn,l] = labels[k];
        return (
          <button key={k} onClick={()=>setMode(k)} className={'tb-btn'+(mode===k?' tb-btn--on':'')}
            style={{height:26,padding:'0 10px',borderRadius:7,gap:5,color: mode===k?'var(--ink)':'var(--ink-3)'}}>
            <Icon name={icn} size={14}/><span style={{fontSize:11.5,fontWeight:500}}>{l}</span>
          </button>
        );
      })}
    </div>
  );
}
window.ScreenModeToggle = ScreenModeToggle;

// Wrap any non-editor screen so the user can collapse its sidebar to a slim rail.
function WithMode({ active = 'editor', children }) {
  const [mode, setMode] = React.useState('studio');
  return (
    <div className={mode==='page'?'mode-page':''} style={{position:'relative', height:'100%', overflow:'hidden'}}>
      {children}
      {mode === 'page' && <RailNav active={active}/>}
      <ScreenModeToggle mode={mode} setMode={setMode}/>
    </div>
  );
}
window.WithMode = WithMode;
