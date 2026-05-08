/* global React, NOVEL, SAMPLE_PROSE, Icon, Sidebar, Toolbar, StatusBar */

// =========================================================
// SPLIT VIEW — two synchronised sheets
// =========================================================
function ScreenSplit() {
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
  return (
    <div className="as as-app" style={{height:'100%'}}>
      <Sidebar active={5}/>
      <main style={{display:'flex',flexDirection:'column',minWidth:0,background:'var(--bg)'}}>
        <div className="tb">
          <button className="tb-btn"><Icon name="bold"/></button>
          <button className="tb-btn"><Icon name="italic"/></button>
          <span className="tb-sep"/>
          <button className="tb-sel">Заголовок 2 <Icon name="chevd" size={12}/></button>
          <span className="tb-sep"/>
          <button className="tb-btn"><Icon name="quote"/></button>
          <button className="tb-btn"><Icon name="link"/></button>
          <span className="tb-sep"/>
          <span className="chip" style={{borderColor:'var(--accent)',color:'var(--accent)',background:'var(--accent-soft)'}}>Сравнение глав</span>
          <div className="tb-spacer"/>
          <button className="tb-btn"><Icon name="speak" size={15}/></button>
          <button className="tb-btn"><Icon name="timer" size={15}/></button>
          <button className="tb-btn tb-btn--on"><Icon name="split" size={15}/></button>
          <button className="tb-btn"><Icon name="focus" size={15}/></button>
        </div>

        <div style={{flex:1,minHeight:0,display:'grid',gridTemplateColumns:'1fr 1fr',gap:1,background:'var(--border-soft)',overflow:'hidden'}}>
          {[
            { side:'left',  label:'Глава 5 · сцена 2', title:'Карты, которые лгут', html:left,  active:true },
            { side:'right', label:'Глава 1 · справка', title:'Город, которого нет', html:right, active:false },
          ].map((s,i)=>(
            <div key={i} style={{background:'var(--bg)',display:'flex',flexDirection:'column',minWidth:0}}>
              <div style={{height:36,flexShrink:0,padding:'0 16px',display:'flex',alignItems:'center',gap:10,borderBottom:'1px solid var(--border-soft)',background:'var(--bg-deep)'}}>
                <span style={{font:'500 10.5px var(--font-mono)',color: s.active?'var(--accent)':'var(--ink-3)',letterSpacing:'0.12em',textTransform:'uppercase'}}>{s.label}</span>
                <span style={{flex:1}}/>
                <span style={{font:'400 11px var(--font-mono)',color:'var(--ink-3)'}}>{s.active?'2 320 сл':'4 720 сл'}</span>
                <button className="tb-btn"><Icon name="moremenu" size={14}/></button>
              </div>
              <div style={{flex:1,minHeight:0,overflow:'auto',display:'flex',justifyContent:'center',padding:'28px 24px 60px',background:'var(--bg)'}}>
                <div className="sheet" style={{width:520,padding:'40px 48px 60px',fontSize:15.5}} dangerouslySetInnerHTML={{__html: s.html}}/>
              </div>
            </div>
          ))}
        </div>

        <div className="status">
          <span><span className="status-dot" style={{display:'inline-block',marginRight:6,verticalAlign:'middle'}}/>обе панели сохранены</span>
          <span style={{color:'var(--ink-4)'}}>·</span>
          <span>слева: гл. 5 (черновик) · справа: гл. 1 (готово)</span>
          <span style={{flex:1}}/>
          <span style={{color:'var(--accent-2)'}}>совпадение почерка двенадцатого картографа</span>
        </div>
      </main>
    </div>
  );
}
window.ScreenSplit = ScreenSplit;

// =========================================================
// EXPORT MODAL — overlay over editor
// =========================================================
function ScreenExport() {
  return (
    <div className="as" style={{height:'100%',position:'relative',overflow:'hidden'}}>
      {/* dimmed editor underneath */}
      <div style={{position:'absolute',inset:0,opacity:0.42,filter:'blur(1.5px)'}}>
        <div style={{height:'100%',display:'grid',gridTemplateColumns:'260px 1fr 320px'}}>
          <div style={{background:'var(--bg-deep)'}}/>
          <div style={{background:'var(--bg)',display:'flex',justifyContent:'center',padding:'40px 0'}}>
            <div style={{width:600,height:'90%',background:'var(--paper)',borderRadius:'4px 4px 0 0'}}/>
          </div>
          <div style={{background:'var(--bg-deep)'}}/>
        </div>
      </div>
      <div style={{position:'absolute',inset:0,background:'oklch(0.10 0.012 50 / 0.55)'}}/>

      {/* modal */}
      <div style={{position:'absolute',inset:0,display:'flex',alignItems:'center',justifyContent:'center'}}>
        <div style={{width:680,background:'var(--bg-deep)',border:'1px solid var(--border)',borderRadius:16,overflow:'hidden'}}>
          <div style={{padding:'22px 28px 18px',borderBottom:'1px solid var(--border-soft)',display:'flex',alignItems:'center',justifyContent:'space-between'}}>
            <div>
              <div style={{font:'500 10.5px var(--font-mono)',color:'var(--ink-3)',letterSpacing:'0.16em',textTransform:'uppercase',marginBottom:4}}>Экспорт книги</div>
              <h2 style={{font:'600 22px var(--font-serif)',letterSpacing:'-0.01em'}}>Северный архив · 21 540 слов</h2>
            </div>
            <button className="tb-btn" style={{width:30,height:30,borderRadius:999,border:'1px solid var(--border)'}}>×</button>
          </div>

          <div style={{padding:'20px 28px 8px'}}>
            <div style={{font:'500 10.5px var(--font-mono)',color:'var(--ink-3)',letterSpacing:'0.14em',textTransform:'uppercase',marginBottom:12}}>Формат</div>
            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:10,marginBottom:24}}>
              {[
                { f:'EPUB',  desc:'Электронные читалки',     active:true },
                { f:'FB2',   desc:'Русские читалки и pocketbook', active:false },
                { f:'DOCX',  desc:'Word, для редактора',     active:false },
              ].map((o,i)=>(
                <div key={i} style={{padding:'14px 16px',borderRadius:10,border: o.active?'1px solid var(--accent)':'1px solid var(--border-soft)',background: o.active?'var(--accent-soft)':'var(--surface)',cursor:'pointer'}}>
                  <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:6}}>
                    <span style={{width:14,height:14,borderRadius:999,border:'1.5px solid '+(o.active?'var(--accent)':'var(--border-strong)'),display:'flex',alignItems:'center',justifyContent:'center'}}>
                      {o.active && <span style={{width:6,height:6,borderRadius:999,background:'var(--accent)'}}/>}
                    </span>
                    <span style={{font:'500 14px var(--font-serif)',color:'var(--ink)'}}>{o.f}</span>
                  </div>
                  <div style={{fontSize:11.5,color:'var(--ink-3)',lineHeight:1.4}}>{o.desc}</div>
                </div>
              ))}
            </div>

            <div style={{font:'500 10.5px var(--font-mono)',color:'var(--ink-3)',letterSpacing:'0.14em',textTransform:'uppercase',marginBottom:12}}>Метаданные</div>
            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10,marginBottom:20}}>
              {[['Название','Северный архив'],['Автор','Анна Корвин'],['Жанр','Тёмное фэнтези'],['Язык','ru-RU']].map(([l,v],i)=>(
                <div key={i} style={{padding:'10px 12px',background:'var(--surface)',border:'1px solid var(--border-soft)',borderRadius:8}}>
                  <div style={{font:'400 10px var(--font-mono)',color:'var(--ink-3)',letterSpacing:'0.1em',textTransform:'uppercase',marginBottom:3}}>{l}</div>
                  <div style={{fontSize:13.5,color:'var(--ink)'}}>{v}</div>
                </div>
              ))}
            </div>

            <div style={{font:'500 10.5px var(--font-mono)',color:'var(--ink-3)',letterSpacing:'0.14em',textTransform:'uppercase',marginBottom:12}}>Включить</div>
            <div style={{display:'flex',flexDirection:'column',gap:2,marginBottom:8}}>
              {[
                ['Все 10 глав (только готовые отметить отдельно)', true],
                ['Титульная страница и оглавление', true],
                ['Заметки на полях как сноски', false],
                ['Список персонажей в приложении', false],
              ].map(([l,on],i)=>(
                <label key={i} style={{display:'flex',alignItems:'center',gap:10,padding:'10px 0',borderBottom: i<3?'1px solid var(--border-soft)':'none',fontSize:13,color:'var(--ink-2)'}}>
                  <span style={{width:32,height:18,borderRadius:999,background:on?'var(--accent)':'var(--surface-2)',position:'relative',transition:'all 150ms',flexShrink:0}}>
                    <span style={{position:'absolute',top:2,left:on?16:2,width:14,height:14,borderRadius:999,background:'var(--ink)'}}/>
                  </span>
                  {l}
                </label>
              ))}
            </div>
          </div>

          <div style={{padding:'18px 28px',borderTop:'1px solid var(--border-soft)',display:'flex',alignItems:'center',gap:12,background:'var(--surface)'}}>
            <span style={{fontSize:11.5,color:'var(--ink-3)'}}>Файл: <span style={{font:'500 12px var(--font-mono)',color:'var(--ink-2)'}}>severnyy-arkhiv-2026-05-08.epub</span> · ~ 280 КБ</span>
            <span style={{flex:1}}/>
            <button className="btn">Отмена</button>
            <button className="btn btn--primary"><Icon name="download" size={14}/> Скачать EPUB</button>
          </div>
        </div>
      </div>
    </div>
  );
}
window.ScreenExport = ScreenExport;
