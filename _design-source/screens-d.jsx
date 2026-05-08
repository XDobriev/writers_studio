/* global React, NOVEL, Icon */

// =========================================================
// WORLD MAP — leaflet-style with locations
// =========================================================
function ScreenMap() {
  // hand-placed pins for Северный архив world
  const pins = [
    { x: 28, y: 62, type:'city', name:'Терея',   role:'Столица ордена',     active:false },
    { x: 64, y: 22, type:'city', name:'Корна',   role:'Исчезнувший город',  active:true },
    { x: 46, y: 50, type:'village', name:'Сольва', role:'Гарнизон',         active:false },
    { x: 56, y: 38, type:'other', name:'Серая Цапля', role:'Трактир',       active:false },
    { x: 38, y: 30, type:'forest', name:'Лес Тихой', role:'Тянется на север', active:false },
    { x: 72, y: 70, type:'sea', name:'Море Хольд', role:'Южный берег',      active:false },
  ];
  const typeIcon = { city: '◆', village:'●', other:'▲', forest:'※', sea:'~', castle:'♛' };
  return (
    <div className="as as-app as-app--no-right" style={{height:'100%'}}>
      <aside className="sb">
        <div className="sb-head"><div className="sb-book-title">{NOVEL.title}</div><div className="sb-book-author">карта мира · 6 локаций</div></div>
        <nav style={{padding:'14px 8px',display:'flex',flexDirection:'column',gap:2}}>
          {[['book','Манускрипт',false],['char','Персонажи',false],['map','Карта мира',true],['clock','Хронология',false],['layout','Дэшборд',false]].map(([n,l,on])=>(
            <a key={l} className={'sb-item'+(on?' sb-item--on':'')}><span style={{display:'flex',justifyContent:'center',color: on?'var(--ink)':'var(--ink-3)'}}><Icon name={n} size={15}/></span><span className="sb-item-title">{l}</span><span/></a>
          ))}
        </nav>
        <div className="sb-section"><span className="sb-section-title">Локации</span><span className="sb-section-meta">6</span></div>
        <div className="sb-list" style={{flex:1,overflow:'auto'}}>
          {pins.map((p,i)=>(
            <div key={i} className={'sb-item'+(p.active?' sb-item--on':'')}>
              <span style={{textAlign:'center',color:'var(--accent-2)',font:'500 13px var(--font-mono)'}}>{typeIcon[p.type]}</span>
              <div style={{minWidth:0}}>
                <div className="sb-item-title">{p.name}</div>
                <div style={{fontSize:11,color:'var(--ink-3)'}}>{p.role}</div>
              </div>
              <span/>
            </div>
          ))}
        </div>
        <div style={{padding:'10px 14px',borderTop:'1px solid var(--border-soft)'}}>
          <button className="btn" style={{width:'100%',justifyContent:'center'}}><Icon name="plus" size={13}/> Добавить локацию</button>
        </div>
      </aside>

      <main style={{display:'flex',flexDirection:'column',background:'var(--bg)'}}>
        <div className="tb" style={{justifyContent:'space-between'}}>
          <div style={{display:'flex',alignItems:'center',gap:10}}>
            <span style={{font:'500 13px var(--font-ui)'}}>Карта мира</span>
            <span className="chip">подложка: «Север Тереи»</span>
          </div>
          <div style={{display:'flex',gap:6}}>
            <button className="tb-btn"><Icon name="eye" size={15}/> Только активные главы</button>
            <button className="btn"><Icon name="plus" size={14}/> Загрузить карту</button>
          </div>
        </div>

        <div style={{flex:1,minHeight:0,position:'relative',overflow:'hidden',background:'oklch(0.32 0.018 80)'}}>
          {/* faux parchment map */}
          <div style={{position:'absolute',inset:24,borderRadius:8,background:'oklch(0.86 0.03 85)',boxShadow:'inset 0 0 80px oklch(0.20 0.04 50 / 0.5)',overflow:'hidden'}}>
            {/* terrain */}
            <svg viewBox="0 0 100 100" preserveAspectRatio="none" style={{position:'absolute',inset:0,width:'100%',height:'100%'}}>
              {/* coastline */}
              <path d="M0 75 Q 12 70 22 75 T 50 78 Q 65 82 80 80 T 100 75 L 100 100 L 0 100 Z" fill="oklch(0.68 0.06 230)" opacity="0.55"/>
              <path d="M0 75 Q 12 70 22 75 T 50 78 Q 65 82 80 80 T 100 75" fill="none" stroke="oklch(0.30 0.04 50)" strokeWidth="0.18"/>
              {/* mountains */}
              <g opacity="0.7" stroke="oklch(0.30 0.04 50)" strokeWidth="0.15" fill="none">
                <path d="M20 20 l3-4 3 4 m-2 0 l2-3 2 3"/>
                <path d="M40 12 l3-4 3 4 m-2 0 l2-3 2 3"/>
                <path d="M55 18 l3-4 3 4"/>
                <path d="M70 26 l3-4 3 4 m-2 0 l2-3 2 3"/>
              </g>
              {/* forest */}
              <g opacity="0.45" fill="oklch(0.46 0.06 130)">
                {Array.from({length:80}).map((_,i)=>(
                  <circle key={i} cx={20+(i*7)%50} cy={28+((i*11)%18)} r="0.6"/>
                ))}
              </g>
              {/* river */}
              <path d="M30 18 Q 38 32 44 44 T 52 65 Q 58 72 70 78" fill="none" stroke="oklch(0.62 0.08 230)" strokeWidth="0.6" opacity="0.7"/>
              <path d="M30 18 Q 38 32 44 44 T 52 65 Q 58 72 70 78" fill="none" stroke="oklch(0.30 0.04 50)" strokeWidth="0.15" strokeDasharray="0.4 0.4"/>
              {/* roads (dashed) */}
              <path d="M28 62 Q 40 58 46 50 Q 52 42 56 38 Q 60 30 64 22" fill="none" stroke="oklch(0.35 0.04 50)" strokeWidth="0.2" strokeDasharray="0.6 0.6"/>
              {/* compass */}
              <g transform="translate(90 92)" stroke="oklch(0.30 0.04 50)" strokeWidth="0.2" fill="oklch(0.30 0.04 50)" opacity="0.7">
                <circle cx="0" cy="0" r="3" fill="none"/>
                <path d="M0 -3 L 0.6 0 L 0 3 L -0.6 0 Z"/>
                <text x="0" y="-4.2" textAnchor="middle" style={{font:'600 1.6px var(--font-serif)',fill:'oklch(0.30 0.04 50)'}}>С</text>
              </g>
              {/* graticule */}
              <g stroke="oklch(0.30 0.04 50)" strokeWidth="0.05" opacity="0.25">
                {[20,40,60,80].map(v=><line key={'h'+v} x1={0} x2={100} y1={v} y2={v}/>)}
                {[20,40,60,80].map(v=><line key={'v'+v} x1={v} x2={v} y1={0} y2={100}/>)}
              </g>
            </svg>

            {/* pins */}
            {pins.map((p,i)=>(
              <div key={i} style={{position:'absolute',left:p.x+'%',top:p.y+'%',transform:'translate(-50%, -100%)',display:'flex',flexDirection:'column',alignItems:'center'}}>
                <div style={{position:'relative',width:p.active?28:22,height:p.active?34:26}}>
                  <svg viewBox="0 0 22 26" width={p.active?28:22} height={p.active?34:26}>
                    <path d="M11 25 C 11 20 21 16 21 9 A 10 10 0 1 0 1 9 C 1 16 11 20 11 25 Z" fill={p.active?'var(--accent)':'oklch(0.30 0.04 50)'} stroke="oklch(0.18 0.04 50)" strokeWidth="0.5"/>
                    <circle cx="11" cy="9" r="3" fill="oklch(0.95 0.014 85)"/>
                  </svg>
                </div>
                <div style={{font:'500 11px var(--font-serif)',color:'oklch(0.22 0.02 60)',background:'oklch(0.95 0.014 85 / 0.85)',padding:'2px 6px',borderRadius:3,marginTop:2,whiteSpace:'nowrap',border: p.active ? '1px solid var(--accent)' : 'none'}}>{p.name}</div>
              </div>
            ))}

            {/* zoom controls */}
            <div style={{position:'absolute',right:14,top:14,display:'flex',flexDirection:'column',background:'oklch(0.96 0.014 85)',borderRadius:6,overflow:'hidden',border:'1px solid oklch(0.30 0.04 50 / 0.4)'}}>
              <button style={{width:32,height:32,borderBottom:'1px solid oklch(0.30 0.04 50 / 0.2)',color:'oklch(0.22 0.02 60)'}}>+</button>
              <button style={{width:32,height:32,color:'oklch(0.22 0.02 60)'}}>−</button>
            </div>

            {/* selected location card */}
            <div style={{position:'absolute',left:24,bottom:24,width:300,background:'var(--bg-deep)',border:'1px solid var(--border)',borderRadius:12,padding:'16px 18px'}}>
              <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:8}}>
                <span style={{width:8,height:8,borderRadius:999,background:'var(--accent)'}}/>
                <span style={{font:'500 10px var(--font-mono)',color:'var(--accent)',letterSpacing:'0.16em',textTransform:'uppercase'}}>город · упоминается в гл. 1, 2, 5</span>
              </div>
              <div style={{font:'600 22px var(--font-serif)',letterSpacing:'-0.01em',marginBottom:6}}>Корна</div>
              <p style={{fontSize:12.5,color:'var(--ink-2)',lineHeight:1.55,marginBottom:12}}>Северный город на реке Тихой. Шесть тысяч девятьсот сорок четыре жителя на момент исчезновения. Известен зимними ярмарками и ратушей с серебряным колоколом.</p>
              <div style={{display:'flex',gap:14,fontSize:11,color:'var(--ink-3)',paddingTop:10,borderTop:'1px solid var(--border-soft)'}}>
                <span>62.4° с.ш.</span><span>·</span><span>34.1° в.д.</span><span style={{flex:1}}/><a style={{color:'var(--accent)'}}>Открыть статью →</a>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
window.ScreenMap = ScreenMap;

// =========================================================
// TIMELINE
// =========================================================
function ScreenTimeline() {
  const events = [
    { era:'412 г.',  pos: 4,  title:'Основание Корны',          type:'world',     ch:null,  desc:'Семь семей-основателей. Серебряный колокол отлит в первый же год.'},
    { era:'580 г.',  pos: 18, title:'Первая экспедиция Тереи',  type:'world',     ch:null,  desc:'Картограф Олимар достигает северных болот.'},
    { era:'711 г.',  pos: 32, title:'Сожжение архива',          type:'world',     ch:null,  desc:'Терея теряет половину карт. Корна не помечена ни на одной из уцелевших.'},
    { era:'Зима 824', pos: 50, title:'Корна исчезает',           type:'plot',      ch:null,  desc:'За одну ночь. Снег ложится ровно, ветер — ровно.'},
    { era:'Зима 824', pos: 56, title:'Двенадцатый картограф уходит', type:'character', ch:5,  desc:'Последняя запись в журнале — «иду посмотреть».'},
    { era:'Весна 825', pos: 64, title:'Иней получает приказ',   type:'plot',      ch:1,     desc:'Магистр Терей. Письмо с поломанной печатью.'},
    { era:'Весна 825', pos: 72, title:'Прибытие в Сольву',       type:'plot',      ch:3,     desc:'Гарнизон не помнит пропавшего. Полковник Нич.'},
    { era:'Весна 825', pos: 80, title:'Серебряный ключ',          type:'plot',      ch:3,     desc:'Висит за стойкой трактира «Серая Цапля».'},
    { era:'Лето 825',  pos: 92, title:'Под башней',                 type:'plot',      ch:9,     desc:'Финал второго акта.'},
  ];
  const color = { plot:'var(--accent)', character:'var(--info)', world:'var(--ok)', other:'var(--ink-3)' };
  const label = { plot:'Сюжет', character:'Персонаж', world:'Мир', other:'Другое' };

  return (
    <div className="as as-app as-app--no-right" style={{height:'100%'}}>
      <aside className="sb">
        <div className="sb-head"><div className="sb-book-title">{NOVEL.title}</div><div className="sb-book-author">хронология · 9 событий</div></div>
        <nav style={{padding:'14px 8px',display:'flex',flexDirection:'column',gap:2}}>
          {[['book','Манускрипт',false],['char','Персонажи',false],['map','Карта мира',false],['clock','Хронология',true],['layout','Дэшборд',false]].map(([n,l,on])=>(
            <a key={l} className={'sb-item'+(on?' sb-item--on':'')}><span style={{display:'flex',justifyContent:'center',color: on?'var(--ink)':'var(--ink-3)'}}><Icon name={n} size={15}/></span><span className="sb-item-title">{l}</span><span/></a>
          ))}
        </nav>
        <div className="sb-section"><span className="sb-section-title">Слои</span></div>
        <div style={{padding:'4px 14px',display:'flex',flexDirection:'column',gap:6}}>
          {Object.entries(label).map(([k,l])=>(
            <label key={k} style={{display:'flex',alignItems:'center',gap:10,fontSize:13,color:'var(--ink-2)',padding:'4px 0'}}>
              <span style={{width:14,height:14,borderRadius:3,border:'1px solid var(--border)',background: k==='plot'?color[k]:'transparent',display:'flex',alignItems:'center',justifyContent:'center'}}>
                {k!=='plot' && <span style={{width:8,height:8,borderRadius:2,background:color[k]}}/>}
              </span>
              {l}
            </label>
          ))}
        </div>
        <div style={{padding:'14px',marginTop:'auto',borderTop:'1px solid var(--border-soft)',display:'flex',flexDirection:'column',gap:8}}>
          <div style={{font:'500 10px var(--font-mono)',color:'var(--ink-3)',letterSpacing:'0.14em',textTransform:'uppercase'}}>Внутреннее время книги</div>
          <div style={{font:'500 14px var(--font-serif)'}}>Зима 824 — Лето 825</div>
          <div style={{fontSize:12,color:'var(--ink-3)'}}>~ 8 месяцев</div>
        </div>
      </aside>

      <main style={{display:'flex',flexDirection:'column',background:'var(--bg)'}}>
        <div className="tb" style={{justifyContent:'space-between'}}>
          <span style={{font:'500 13px var(--font-ui)'}}>Хронология «Северного архива»</span>
          <div style={{display:'flex',gap:6}}>
            <button className="tb-btn"><Icon name="layout" size={15}/> По главам</button>
            <button className="tb-btn tb-btn--on"><Icon name="clock" size={15}/> По времени</button>
            <button className="btn"><Icon name="plus" size={14}/> Событие</button>
          </div>
        </div>

        <div style={{flex:1,minHeight:0,overflow:'auto',padding:'40px 32px'}}>
          {/* axis */}
          <div style={{position:'relative',height:520,marginTop:20,minWidth:1500}}>
            {/* baseline */}
            <div style={{position:'absolute',left:0,right:0,top:260,height:1,background:'var(--border-strong)'}}/>
            {/* era markers */}
            {[ ['IV в.', 4],['V в.', 18],['VI в.', 32],['VII в.', 46],['VIII в.', 60],['IX в.', 80] ].map(([l,x],i)=>(
              <div key={i} style={{position:'absolute',left:x+'%',top:255,transform:'translateX(-50%)'}}>
                <div style={{width:1,height:16,background:'var(--ink-4)'}}/>
                <div style={{font:'500 10.5px var(--font-mono)',color:'var(--ink-3)',marginTop:6,letterSpacing:'0.06em',whiteSpace:'nowrap'}}>{l}</div>
              </div>
            ))}
            {/* events */}
            {events.map((e,i)=>{
              const above = i % 2 === 0;
              const top = above ? 60 : 290;
              const lineH = above ? 200 : 200;
              return (
                <div key={i} style={{position:'absolute',left:e.pos+'%',top,transform:'translateX(-50%)',width:200,display:'flex',flexDirection:'column',alignItems:'center'}}>
                  {!above && <div style={{position:'absolute',bottom:'100%',width:1,height:30,background: color[e.type]}}/>}
                  <div style={{background:'var(--surface)',border:'1px solid var(--border-soft)',borderLeft:`3px solid ${color[e.type]}`,borderRadius:8,padding:'10px 12px',width:'100%',position:'relative'}}>
                    <div style={{font:'500 9.5px var(--font-mono)',color:color[e.type],letterSpacing:'0.14em',textTransform:'uppercase',marginBottom:4}}>{label[e.type]} · {e.era}</div>
                    <div style={{font:'500 13.5px var(--font-serif)',color:'var(--ink)',marginBottom:6,lineHeight:1.25}}>{e.title}</div>
                    <div style={{fontSize:11.5,color:'var(--ink-2)',lineHeight:1.45}}>{e.desc}</div>
                    {e.ch && <div style={{font:'400 10px var(--font-mono)',color:'var(--ink-3)',marginTop:8,paddingTop:6,borderTop:'1px dashed var(--border-soft)',letterSpacing:'0.04em'}}>→ ГЛ. {String(e.ch).padStart(2,'0')}</div>}
                  </div>
                  {above && <>
                    <div style={{width:1,flex:0,height:lineH-180,background:color[e.type]}}/>
                    <div style={{width:10,height:10,borderRadius:999,background:color[e.type],marginTop:-3,border:'2px solid var(--bg)'}}/>
                  </>}
                  {!above && <div style={{width:10,height:10,borderRadius:999,background:color[e.type],position:'absolute',top:-34,border:'2px solid var(--bg)'}}/>}
                </div>
              );
            })}
          </div>
        </div>
      </main>
    </div>
  );
}
window.ScreenTimeline = ScreenTimeline;
