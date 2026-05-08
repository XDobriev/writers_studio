/* global React, NOVEL, SAMPLE_PROSE, Icon, Sidebar, StatusBar, Sheet, RightPanel */

// ============== HYBRID — STUDIO ↔ PAGE ==============
// Base = Variant A (3-column). User collapses sidebars at will:
//   • studio  — full editing desk (sidebar + sheet + margin notes)
//   • left    — sidebar only (chapter context, no margins)
//   • right   — margins only (focused but reference open)
//   • page    — pure manuscript, floating tool pill, word-goal arc
// Toggle lives in the toolbar; cmd-\ / cmd-shift-\ map to it (visual only here).

function ModeSegment({ mode, setMode }) {
  const opts = [
    ['studio', 'layout', 'Студия'],
    ['left',   'panel',  'Сайдбар'],
    ['right',  'note',   'На полях'],
    ['page',   'focus',  'Страница'],
  ];
  return (
    <div style={{display:'inline-flex',alignItems:'center',gap:2,padding:2,borderRadius:8,background:'var(--bg-deep)',border:'1px solid var(--border-soft)'}}>
      {opts.map(([k,icn,l])=>(
        <button key={k} onClick={()=>setMode(k)} className={'tb-btn'+(mode===k?' tb-btn--on':'')}
          style={{height:24,padding:'0 8px',borderRadius:6,gap:4,color: mode===k ? 'var(--ink)':'var(--ink-3)'}}>
          <Icon name={icn} size={13}/><span style={{fontSize:11,letterSpacing:'0.01em'}}>{l}</span>
        </button>
      ))}
    </div>
  );
}

function StudioToolbar({ mode, setMode }) {
  return (
    <div className="tb">
      <button className="tb-btn"><Icon name="bold"/></button>
      <button className="tb-btn"><Icon name="italic"/></button>
      <button className="tb-btn"><Icon name="underline"/></button>
      <span className="tb-sep"/>
      <button className="tb-sel">Заголовок 2 <Icon name="chevd" size={12}/></button>
      <span className="tb-sep"/>
      <button className="tb-btn"><Icon name="list"/></button>
      <button className="tb-btn"><Icon name="quote"/></button>
      <button className="tb-btn"><Icon name="link"/></button>
      <span className="tb-sep"/>
      <button className="tb-btn tb-btn--on"><Icon name="track" size={15}/> Правки</button>
      <div className="tb-spacer"/>
      <ModeSegment mode={mode} setMode={setMode}/>
      <span className="tb-sep"/>
      <button className="tb-btn"><Icon name="speak" size={15}/></button>
      <button className="tb-btn"><Icon name="timer" size={15}/></button>
      <button className="tb-btn"><Icon name="download" size={15}/> Экспорт</button>
    </div>
  );
}

function PageHeader({ mode, setMode }) {
  return (
    <div style={{height:54,flexShrink:0,display:'flex',alignItems:'center',padding:'0 28px',gap:12,borderBottom:'1px solid var(--border-soft)',background:'var(--bg)'}}>
      <span style={{font:'400 12px var(--font-mono)',color:'var(--ink-3)',letterSpacing:'0.04em'}}>СЕВЕРНЫЙ АРХИВ</span>
      <span style={{color:'var(--ink-4)'}}>›</span>
      <span style={{font:'400 12px var(--font-mono)',color:'var(--ink-3)'}}>Часть I</span>
      <span style={{color:'var(--ink-4)'}}>›</span>
      <span style={{font:'500 13px var(--font-serif)',color:'var(--ink)'}}>1. Город, которого нет</span>
      <button className="tb-btn" style={{marginLeft:4,color:'var(--ink-4)'}}><Icon name="chevd" size={13}/></button>
      <div style={{flex:1}}/>
      <span className="chip">черновик · 4 720 сл</span>
      <span style={{width:1,height:18,background:'var(--border-soft)',margin:'0 4px'}}/>
      <ModeSegment mode={mode} setMode={setMode}/>
    </div>
  );
}

function FloatingPill() {
  return (
    <div style={{position:'absolute',left:'50%',bottom:24,transform:'translateX(-50%)',display:'flex',alignItems:'center',gap:2,background:'var(--bg-deep)',border:'1px solid var(--border)',borderRadius:999,padding:'4px 6px',boxShadow:'0 8px 28px rgba(0,0,0,.35)',zIndex:5}}>
      <button className="tb-btn"><Icon name="bold"/></button>
      <button className="tb-btn"><Icon name="italic"/></button>
      <button className="tb-btn"><Icon name="underline"/></button>
      <span className="tb-sep"/>
      <button className="tb-sel" style={{padding:'0 12px'}}>H2 <Icon name="chevd" size={12}/></button>
      <span className="tb-sep"/>
      <button className="tb-btn"><Icon name="quote"/></button>
      <button className="tb-btn"><Icon name="link"/></button>
      <button className="tb-btn"><Icon name="color"/></button>
      <span className="tb-sep"/>
      <button className="tb-btn tb-btn--on" style={{color:'var(--accent)'}}><Icon name="track" size={15}/></button>
      <button className="tb-btn"><Icon name="sparkles" size={15}/></button>
      <span className="tb-sep"/>
      <button className="tb-btn"><Icon name="speak" size={15}/></button>
      <button className="tb-btn"><Icon name="timer" size={15}/></button>
    </div>
  );
}

function GoalArc() {
  return (
    <div style={{position:'absolute',right:24,bottom:24,display:'flex',alignItems:'center',gap:12,background:'var(--bg-deep)',border:'1px solid var(--border)',borderRadius:14,padding:'10px 14px 10px 12px',boxShadow:'0 8px 28px rgba(0,0,0,.25)',zIndex:5}}>
      <svg width="44" height="44" viewBox="0 0 44 44">
        <circle cx="22" cy="22" r="18" fill="none" stroke="var(--surface-2)" strokeWidth="3"/>
        <circle cx="22" cy="22" r="18" fill="none" stroke="var(--accent)" strokeWidth="3" strokeLinecap="round"
          strokeDasharray={`${(348/1000)*2*Math.PI*18} ${2*Math.PI*18}`} transform="rotate(-90 22 22)"/>
        <text x="22" y="25" textAnchor="middle" style={{font:'500 10px var(--font-mono)',fill:'var(--ink)'}}>34%</text>
      </svg>
      <div>
        <div style={{font:'500 12px var(--font-ui)',color:'var(--ink)'}}>348 / 1 000 слов</div>
        <div style={{font:'400 10.5px var(--font-mono)',color:'var(--ink-3)',letterSpacing:'0.04em'}}>сегодня · серия 7 дней</div>
      </div>
    </div>
  );
}

function MinimalStatus() {
  return (
    <div style={{position:'absolute',left:24,bottom:30,font:'400 11px var(--font-mono)',color:'var(--ink-4)',display:'flex',gap:14,zIndex:5}}>
      <span><span className="status-dot" style={{display:'inline-block',marginRight:6,verticalAlign:'middle'}}/>Сохранено · 14:32</span>
      <span>4 720 сл · 28 140 зн · ~21 мин</span>
    </div>
  );
}

function EditorHybrid({ defaultMode = 'studio' }) {
  const [mode, setMode] = React.useState(defaultMode);
  const showLeft  = mode === 'studio' || mode === 'left';
  const showRight = mode === 'studio' || mode === 'right';
  const isPage    = mode === 'page';

  // Grid columns adapt to which panels are visible.
  const cols = isPage ? '1fr'
    : showLeft && showRight ? '260px 1fr 320px'
    : showLeft  ? '260px 1fr'
    : showRight ? '1fr 320px'
    : '1fr';

  // Sheet sizing: a touch wider in "page" since both gutters are gone.
  const sheetWidth = isPage ? 740 : 680;
  const sheetPad   = isPage ? '64px 80px 80px' : '48px 64px 80px';

  return (
    <div className="as" style={{height:'100%',display:'grid',gridTemplateColumns:cols,background:'var(--bg)',position:'relative',transition:'grid-template-columns 220ms cubic-bezier(.2,.7,.3,1)'}}>
      {showLeft && <Sidebar active={1}/>}

      <main style={{display:'flex',flexDirection:'column',minWidth:0,background:'var(--bg)',position:'relative',overflow:'hidden'}}>
        {isPage ? <PageHeader mode={mode} setMode={setMode}/>
                : <StudioToolbar mode={mode} setMode={setMode}/>}

        <div className="sheet-wrap" style={{padding: isPage ? '48px 56px 110px' : '36px 32px 0'}}>
          <div className="sheet" style={{width:sheetWidth,padding:sheetPad}} dangerouslySetInnerHTML={{__html: SAMPLE_PROSE}}/>
        </div>

        {!isPage && <StatusBar/>}
        {isPage && <FloatingPill/>}
        {isPage && <GoalArc/>}
        {isPage && <MinimalStatus/>}
      </main>

      {showRight && <RightPanel tab="margins"/>}
    </div>
  );
}
window.EditorHybrid = EditorHybrid;
