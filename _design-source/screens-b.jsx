/* global React, NOVEL, Icon */

// =========================================================
// OUTLINE — book structure tree
// =========================================================
function ScreenOutline() {
  const tree = [
    { kind:'part', title:'Часть I · Снег', words:13636, status:'done',
      chapters:[
        { num:1, title:'Город, которого нет', words:4720, status:'done',
          scenes:['В архиве Тереи','Магистр и письмо','Карта матери']},
        { num:2, title:'Письмо из Корны', words:3812, status:'done',
          scenes:['Снег на крышах','Сборы в путь','Прощание с Каролом']},
        { num:3, title:'Трактир «Серая Цапля»', words:5104, status:'done',
          scenes:['Дорога через Сольву','Серебряный ключ','Лето Маркис']},
      ]},
    { kind:'part', title:'Часть II · Тракт', words:7922, status:'progress',
      chapters:[
        { num:4, title:'Дорога вдоль Тихой', words:2998, status:'progress',
          scenes:['Лес и колокол','Беглец','Ночёвка у реки']},
        { num:5, title:'Карты, которые лгут', words:3320, status:'progress',
          scenes:['Архив трактирщика','Двенадцатый картограф']},
        { num:6, title:'Снег и колокол', words:1604, status:'progress',
          scenes:['Гарнизон Сольвы']},
      ]},
    { kind:'part', title:'Часть III · Корна', words:0, status:'draft',
      chapters:[
        { num:7, title:'Архив старой Тереи', words:0, status:'draft' },
        { num:8, title:'Двенадцатый картограф', words:0, status:'draft' },
        { num:9, title:'Под башней', words:0, status:'draft' },
        { num:10, title:'Тишина в Корне', words:0, status:'draft' },
      ]},
  ];
  return (
    <div className="as as-app as-app--no-right" style={{height:'100%'}}>
      <aside className="sb">
        <div className="sb-head">
          <div className="sb-book-title">{NOVEL.title}</div>
          <div className="sb-book-author">структура · 21 540 / 80 000 сл</div>
        </div>
        <div className="sb-tabs"><button className="sb-tab">Список</button><button className="sb-tab">Доска</button><button className="sb-tab sb-tab--on">Структура</button></div>
        <div style={{padding:'18px 18px 14px',color:'var(--ink-3)',fontSize:12}}>Дерево структуры показывает книгу целиком: части, главы и сцены. Перетащите, чтобы переупорядочить.</div>
        <div style={{padding:'4px 14px 0',display:'flex',flexDirection:'column',gap:4}}>
          <button className="btn"><Icon name="plus" size={13}/> Новая часть</button>
          <button className="btn btn--ghost" style={{justifyContent:'flex-start'}}><Icon name="plus" size={13}/> Новая глава</button>
        </div>
      </aside>

      <main style={{display:'flex',flexDirection:'column',background:'var(--bg)'}}>
        <div className="tb" style={{justifyContent:'space-between'}}>
          <div style={{display:'flex',alignItems:'center',gap:8}}>
            <span style={{font:'500 13px var(--font-ui)',color:'var(--ink)'}}>Структура</span>
            <span className="chip">3 части · 10 глав · 23 сцены</span>
          </div>
          <div style={{display:'flex',gap:6,alignItems:'center'}}>
            <span style={{font:'400 11px var(--font-mono)',color:'var(--ink-3)'}}>цели по словам</span>
            <button className="tb-btn"><Icon name="settings" size={15}/></button>
          </div>
        </div>

        <div style={{flex:1,minHeight:0,overflow:'auto',padding:'28px 40px'}}>
          {tree.map((p,pi)=>(
            <div key={pi} style={{marginBottom:32}}>
              <div style={{display:'flex',alignItems:'baseline',gap:14,marginBottom:14,paddingBottom:10,borderBottom:'1px solid var(--border-soft)'}}>
                <Icon name="chevd" size={14}/>
                <h2 style={{font:'600 22px var(--font-serif)',letterSpacing:'-0.01em',color: p.status==='draft' ? 'var(--ink-3)' : 'var(--ink)'}}>{p.title}</h2>
                <span style={{flex:1}}/>
                <span style={{font:'400 11.5px var(--font-mono)',color:'var(--ink-3)',letterSpacing:'0.06em'}}>{p.words.toLocaleString('ru')} сл · {Math.round(p.words/26000*100)}%</span>
                <div style={{width:120,height:3,background:'var(--surface-2)',borderRadius:999,overflow:'hidden'}}><div style={{width:`${Math.min(100,p.words/26000*100)}%`,height:'100%',background: p.status==='done' ? 'var(--ok)' : 'var(--accent-2)'}}/></div>
              </div>
              {p.chapters.map((c,ci)=>(
                <div key={ci} style={{display:'flex',alignItems:'flex-start',gap:14,padding:'10px 16px 10px 28px',borderRadius:8,position:'relative'}}>
                  <span style={{font:'500 12px var(--font-mono)',color: c.status==='draft' ? 'var(--ink-4)' : 'var(--accent)',letterSpacing:'0.04em',marginTop:3,minWidth:28}}>{String(c.num).padStart(2,'0')}</span>
                  <div style={{flex:1}}>
                    <div style={{font:'500 15px var(--font-serif)',color: c.status==='draft' ? 'var(--ink-3)' : 'var(--ink)'}}>{c.title}</div>
                    {c.scenes && (
                      <div style={{display:'flex',flexDirection:'column',gap:2,marginTop:8,paddingLeft:18,borderLeft:'1px solid var(--border-soft)'}}>
                        {c.scenes.map((s,si)=>(
                          <div key={si} style={{display:'flex',alignItems:'center',gap:10,fontSize:12,color:'var(--ink-2)',padding:'3px 0'}}>
                            <span style={{width:5,height:5,borderRadius:999,background:'var(--ink-4)'}}/>
                            {s}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                  <span style={{font:'400 11px var(--font-mono)',color:'var(--ink-3)',marginTop:4}}>{c.words.toLocaleString('ru')} сл</span>
                  <span style={{width:6,height:6,borderRadius:999,marginTop:8,background: c.status==='done' ? 'var(--ok)' : c.status==='progress' ? 'var(--accent-2)' : 'var(--ink-4)'}}/>
                </div>
              ))}
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}
window.ScreenOutline = ScreenOutline;

// =========================================================
// CORKBOARD — chapter cards grid
// =========================================================
function ScreenCorkboard() {
  return (
    <div className="as as-app as-app--no-right" style={{height:'100%'}}>
      <aside className="sb">
        <div className="sb-head"><div className="sb-book-title">{NOVEL.title}</div><div className="sb-book-author">10 глав · 21 540 сл</div></div>
        <div className="sb-tabs"><button className="sb-tab">Список</button><button className="sb-tab sb-tab--on">Доска</button><button className="sb-tab">Структура</button></div>
        <div style={{padding:'18px 18px 14px',color:'var(--ink-3)',fontSize:12,lineHeight:1.6}}>На доске — главы как индексные карточки. Перетащите, чтобы изменить порядок. Двойной щелчок — открыть в редакторе.</div>
        <div style={{padding:'10px 14px',display:'flex',flexDirection:'column',gap:8}}>
          <div style={{font:'500 10px var(--font-mono)',color:'var(--ink-3)',letterSpacing:'0.14em',textTransform:'uppercase'}}>Фильтр</div>
          {[['все', true, 10],['готово', false, 3],['в работе', false, 3],['черновик', false, 4]].map(([l,on,n],i)=>(
            <button key={i} className={'sb-item'+(on?' sb-item--on':'')}>
              <span/>
              <span className="sb-item-title" style={{textTransform:'capitalize'}}>{l}</span>
              <span className="sb-item-meta">{n}</span>
            </button>
          ))}
        </div>
      </aside>

      <main style={{display:'flex',flexDirection:'column',background:'var(--bg)'}}>
        <div className="tb" style={{justifyContent:'space-between'}}>
          <div style={{display:'flex',alignItems:'center',gap:10}}>
            <span style={{font:'500 13px var(--font-ui)',color:'var(--ink)'}}>Доска глав</span>
            <span className="chip">3 готово · 3 в работе · 4 черновик</span>
          </div>
          <div style={{display:'flex',gap:6}}>
            <button className="tb-btn"><Icon name="grid" size={15}/></button>
            <button className="tb-btn"><Icon name="layout" size={15}/></button>
            <button className="btn"><Icon name="plus" size={14}/> Новая глава</button>
          </div>
        </div>

        <div style={{flex:1,minHeight:0,overflow:'auto',padding:'28px 32px',background:'repeating-linear-gradient(45deg, var(--bg) 0 24px, var(--bg-deep) 24px 25px)'}}>
          <div style={{font:'500 10px var(--font-mono)',color:'var(--ink-3)',letterSpacing:'0.14em',textTransform:'uppercase',marginBottom:16}}>Часть I · Снег</div>
          <div style={{display:'grid',gridTemplateColumns:'repeat(3, 1fr)',gap:20,marginBottom:32}}>
            {NOVEL.chapters.slice(0,3).map(c => <Card key={c.num} c={c} synopsis={
              c.num===1 ? 'Картограф Иней Ворон узнаёт об исчезновении города Корна. Магистр Терей вручает ей задание — восстановить карту того, чего больше нет.' :
              c.num===2 ? 'Иней разбирает письмо от пропавшего двенадцатого картографа. Сборы в путь. Прощание с её наставником Каролом, который остаётся в Терее.' :
              'Иней доезжает до трактира «Серая Цапля» и встречает наёмника Лето Маркиса. Серебряный ключ от ратуши Корны висит за стойкой — никто не помнит откуда.'
            }/>)}
          </div>
          <div style={{font:'500 10px var(--font-mono)',color:'var(--ink-3)',letterSpacing:'0.14em',textTransform:'uppercase',marginBottom:16}}>Часть II · Тракт</div>
          <div style={{display:'grid',gridTemplateColumns:'repeat(3, 1fr)',gap:20,marginBottom:32}}>
            {NOVEL.chapters.slice(3,6).map(c => <Card key={c.num} c={c} synopsis={
              c.num===4 ? 'Дорога вдоль реки Тихой. Иней слышит колокол там, где не должно быть деревень. Ночёвка у воды.' :
              c.num===5 ? 'У хозяина трактира — стопка карт, нарисованных одной и той же рукой за разные века. Двенадцатый картограф был здесь.' :
              'Гарнизон Сольвы. Полковник Нич отказывается подтверждать сообщение. Снег идёт ровный, словно его расстелили.'
            }/>)}
          </div>
          <div style={{font:'500 10px var(--font-mono)',color:'var(--ink-3)',letterSpacing:'0.14em',textTransform:'uppercase',marginBottom:16}}>Часть III · Корна</div>
          <div style={{display:'grid',gridTemplateColumns:'repeat(3, 1fr)',gap:20}}>
            {NOVEL.chapters.slice(6).map(c => <Card key={c.num} c={c} synopsis="План сцен пока не написан."/>)}
          </div>
        </div>
      </main>
    </div>
  );
}
function Card({c, synopsis}) {
  return (
    <div style={{background:'var(--surface)',border:'1px solid var(--border-soft)',borderRadius:8,padding:'14px 16px 16px',position:'relative',minHeight:180,display:'flex',flexDirection:'column'}}>
      <div style={{position:'absolute',top:-6,left:14,width:10,height:10,borderRadius:999,background:'var(--accent-2)',border:'2px solid var(--bg-deep)'}}/>
      <div style={{display:'flex',alignItems:'baseline',gap:8,marginBottom:6}}>
        <span style={{font:'500 10px var(--font-mono)',color:'var(--accent)',letterSpacing:'0.1em'}}>ГЛ. {String(c.num).padStart(2,'0')}</span>
        <span style={{flex:1}}/>
        <span style={{font:'400 10px var(--font-mono)',color:'var(--ink-3)'}}>{c.words.toLocaleString('ru')} сл</span>
      </div>
      <div style={{font:'500 16px var(--font-serif)',letterSpacing:'-0.005em',marginBottom:10}}>{c.title}</div>
      <div style={{flex:1,fontSize:12.5,color:'var(--ink-2)',lineHeight:1.55}}>{synopsis}</div>
      <div style={{display:'flex',alignItems:'center',gap:6,marginTop:12,paddingTop:10,borderTop:'1px dashed var(--border-soft)'}}>
        <span style={{width:6,height:6,borderRadius:999,background: c.status==='done' ? 'var(--ok)' : c.status==='progress' ? 'var(--accent-2)' : 'var(--ink-4)'}}/>
        <span style={{font:'400 10.5px var(--font-mono)',color:'var(--ink-3)',letterSpacing:'0.06em',textTransform:'uppercase'}}>
          {c.status==='done' ? 'готово' : c.status==='progress' ? 'в работе' : 'черновик'}
        </span>
        <span style={{flex:1}}/>
        <Icon name="moremenu" size={14}/>
      </div>
    </div>
  );
}
window.ScreenCorkboard = ScreenCorkboard;
