/* global React, NOVEL, Icon */

// =========================================================
// AUTH
// =========================================================
function ScreenAuth() {
  return (
    <div className="as" style={{height:'100%',display:'grid',gridTemplateColumns:'1.05fr 1fr',background:'var(--bg)'}}>
      {/* manuscript-side hero */}
      <div style={{position:'relative',padding:'56px 64px',background:'var(--bg-deep)',borderRight:'1px solid var(--border-soft)',display:'flex',flexDirection:'column',justifyContent:'space-between'}}>
        <div style={{display:'flex',alignItems:'center',gap:10}}>
          <span style={{width:18,height:22,background:'var(--accent)',borderRadius:'1px 4px 4px 1px',position:'relative'}}>
            <span style={{position:'absolute',inset:3,border:'0.5px solid oklch(0.98 0 0 / 0.6)'}}/>
          </span>
          <span style={{font:'500 12px var(--font-mono)',letterSpacing:'0.18em',textTransform:'uppercase',color:'var(--ink-2)'}}>авторская студия</span>
        </div>

        <div>
          <div style={{font:'500 11px var(--font-mono)',letterSpacing:'0.2em',color:'var(--accent)',textTransform:'uppercase',marginBottom:18}}>Издание для писателей · 2026</div>
          <h1 style={{font:'600 56px/1.05 var(--font-serif)',letterSpacing:'-0.02em',marginBottom:24}}>Здесь<br/>пишутся книги.</h1>
          <p style={{font:'400 16px/1.65 var(--font-serif)',color:'var(--ink-2)',maxWidth:480}}>
            Манускрипт, картотека персонажей, карта мира и хронология — в одном тихом редакторе. Автосохранение, версии глав, заметки на полях. Без шума, баннеров и рекламы.
          </p>
        </div>

        <div style={{display:'flex',gap:32,paddingTop:24,borderTop:'1px solid var(--border-soft)'}}>
          {[
            ['12 384','авторов'],
            ['41 207','книг написано'],
            ['1.8 млрд','слов'],
          ].map(([n,l])=>(
            <div key={l}>
              <div style={{font:'500 22px var(--font-serif)',color:'var(--ink)'}}>{n}</div>
              <div style={{font:'400 11px var(--font-mono)',color:'var(--ink-3)',letterSpacing:'0.08em',textTransform:'uppercase',marginTop:2}}>{l}</div>
            </div>
          ))}
        </div>
      </div>

      {/* form */}
      <div style={{display:'flex',alignItems:'center',justifyContent:'center',padding:48}}>
        <div style={{width:380}}>
          <div style={{display:'flex',gap:0,marginBottom:28,borderBottom:'1px solid var(--border-soft)'}}>
            <button style={{padding:'10px 0',marginRight:24,font:'500 14px var(--font-ui)',color:'var(--ink)',borderBottom:'1.5px solid var(--accent)'}}>Войти</button>
            <button style={{padding:'10px 0',font:'400 14px var(--font-ui)',color:'var(--ink-3)'}}>Регистрация</button>
          </div>

          <h2 style={{font:'600 24px var(--font-serif)',letterSpacing:'-0.01em',marginBottom:6}}>С возвращением.</h2>
          <p style={{font:'400 13px var(--font-ui)',color:'var(--ink-3)',marginBottom:24}}>Северный архив ждёт — последняя сессия 6 мая.</p>

          <div style={{display:'flex',flexDirection:'column',gap:12,marginBottom:16}}>
            <div>
              <label style={{font:'500 11px var(--font-mono)',color:'var(--ink-3)',letterSpacing:'0.1em',textTransform:'uppercase',display:'block',marginBottom:6}}>Email</label>
              <div style={{height:38,padding:'0 12px',border:'1px solid var(--border)',borderRadius:8,background:'var(--surface)',display:'flex',alignItems:'center',color:'var(--ink)',fontSize:13.5}}>anna.korvin@studio.ru</div>
            </div>
            <div>
              <label style={{font:'500 11px var(--font-mono)',color:'var(--ink-3)',letterSpacing:'0.1em',textTransform:'uppercase',display:'block',marginBottom:6}}>Пароль</label>
              <div style={{height:38,padding:'0 12px',border:'1px solid var(--accent)',borderRadius:8,background:'var(--surface)',display:'flex',alignItems:'center',color:'var(--ink)',fontSize:13.5,letterSpacing:'0.3em'}}>•••••••••••</div>
            </div>
          </div>

          <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:18,fontSize:12}}>
            <label style={{display:'flex',alignItems:'center',gap:8,color:'var(--ink-2)'}}>
              <span style={{width:14,height:14,borderRadius:3,border:'1px solid var(--border-strong)',background:'var(--accent)',display:'flex',alignItems:'center',justifyContent:'center'}}>
                <svg width="9" height="9" viewBox="0 0 9 9"><path d="M1 4.5L3.5 7L8 1.5" stroke="white" strokeWidth="1.5" fill="none"/></svg>
              </span>
              Запомнить меня
            </label>
            <a style={{color:'var(--accent)'}}>Забыли пароль?</a>
          </div>

          <button className="btn btn--primary" style={{width:'100%',height:42,fontSize:14}}>Войти в студию</button>

          <div style={{display:'flex',alignItems:'center',gap:12,margin:'18px 0',color:'var(--ink-4)',fontSize:11,letterSpacing:'0.1em',textTransform:'uppercase'}}>
            <span style={{flex:1,height:1,background:'var(--border-soft)'}}/>или<span style={{flex:1,height:1,background:'var(--border-soft)'}}/>
          </div>

          <button className="btn" style={{width:'100%',height:42,fontSize:13.5,justifyContent:'center'}}>
            <svg width="16" height="16" viewBox="0 0 24 24"><path fill="#EA4335" d="M12 5c1.6 0 3 .6 4.1 1.6l3-3A9.5 9.5 0 0 0 12 1a11 11 0 0 0-9.8 6l3.5 2.7C6.7 6.6 9.1 5 12 5z"/><path fill="#4285F4" d="M23 12c0-.7-.1-1.4-.2-2H12v4h6.2c-.3 1.4-1.1 2.6-2.4 3.5l3.7 2.9c2.2-2 3.5-5 3.5-8.4z"/><path fill="#FBBC05" d="M5.7 14.3a6.6 6.6 0 0 1 0-4.3L2.2 7.3a11 11 0 0 0 0 9.4z"/><path fill="#34A853" d="M12 23c2.7 0 5-.9 6.6-2.4l-3.7-2.9c-1 .7-2.3 1.1-2.9 1.1-2.9 0-5.3-1.9-6.2-4.5l-3.5 2.7A11 11 0 0 0 12 23z"/></svg>
            Продолжить с Google
          </button>
        </div>
      </div>
    </div>
  );
}
window.ScreenAuth = ScreenAuth;

// =========================================================
// HOME — book list
// =========================================================
function ScreenHome() {
  const books = [
    { title:'Северный архив', author:'А. Корвин', genre:'Тёмное фэнтези', words:21540, goal:80000, days:48, last:'8 мая', cover:'#7c1d1d' },
    { title:'Дом, где живёт ноябрь', author:'А. Корвин', genre:'Магический реализм', words:54300, goal:65000, days:184, last:'2 мая', cover:'#3d4a2e' },
    { title:'Лето в провинции Кирн', author:'А. Корвин', genre:'Роман', words:8120, goal:60000, days:21, last:'29 апр.', cover:'#1c3a4a' },
    { title:'Маленькие смерти', author:'А. Корвин', genre:'Сборник', words:12440, goal:30000, days:64, last:'10 апр.', cover:'#4a2e3c' },
    { title:'Чёрный сад', author:'А. Корвин', genre:'Детектив', words:0, goal:60000, days:0, last:'—', cover:'#2a2a3a', empty:true },
  ];
  return (
    <div className="as" style={{height:'100%',background:'var(--bg)',display:'flex',flexDirection:'column'}}>
      {/* topbar */}
      <div style={{height:60,flexShrink:0,display:'flex',alignItems:'center',padding:'0 32px',gap:14,borderBottom:'1px solid var(--border-soft)'}}>
        <span style={{width:18,height:22,background:'var(--accent)',borderRadius:'1px 4px 4px 1px',position:'relative'}}>
          <span style={{position:'absolute',inset:3,border:'0.5px solid oklch(0.98 0 0 / 0.6)'}}/>
        </span>
        <span style={{font:'500 12px var(--font-mono)',letterSpacing:'0.16em',textTransform:'uppercase',color:'var(--ink-2)'}}>авторская студия</span>
        <span style={{flex:1}}/>
        <div style={{display:'flex',alignItems:'center',gap:6,padding:'7px 12px',border:'1px solid var(--border-soft)',borderRadius:8,minWidth:280,color:'var(--ink-3)',fontSize:13}}>
          <Icon name="search" size={14}/> Найти книгу, главу или персонажа<span style={{flex:1}}/><span style={{font:'400 10.5px var(--font-mono)',padding:'2px 5px',border:'1px solid var(--border-soft)',borderRadius:4}}>⌘K</span>
        </div>
        <div className="sb-avatar">АК</div>
      </div>

      <div style={{flex:1,minHeight:0,overflow:'hidden',padding:'40px 48px'}}>
        <div style={{display:'flex',alignItems:'baseline',justifyContent:'space-between',marginBottom:28}}>
          <div>
            <h1 style={{font:'600 36px var(--font-serif)',letterSpacing:'-0.012em'}}>Мои книги</h1>
            <p style={{font:'400 14px var(--font-ui)',color:'var(--ink-3)',marginTop:6}}>5 проектов · 96 400 слов · 7 дней подряд</p>
          </div>
          <div style={{display:'flex',gap:8}}>
            <button className="btn"><Icon name="grid" size={14}/> Сетка</button>
            <button className="btn btn--primary"><Icon name="plus" size={14}/> Новая книга</button>
          </div>
        </div>

        <div style={{display:'grid',gridTemplateColumns:'repeat(3, 1fr)',gap:24}}>
          {books.map((b,i)=>(
            <div key={i} style={{background:'var(--surface)',borderRadius:12,border:'1px solid var(--border-soft)',overflow:'hidden',display:'flex',flexDirection:'column'}}>
              {/* cover */}
              <div style={{height:180,background: b.empty ? 'repeating-linear-gradient(135deg, var(--surface-2) 0 8px, var(--surface) 8px 16px)' : `linear-gradient(160deg, ${b.cover}, oklch(0.20 0.02 50))`,position:'relative',display:'flex',flexDirection:'column',justifyContent:'flex-end',padding:'18px 20px',borderBottom:'1px solid var(--border-soft)'}}>
                {!b.empty && <>
                  <div style={{font:'500 10px var(--font-mono)',letterSpacing:'0.18em',textTransform:'uppercase',color:'oklch(0.95 0.008 80 / 0.7)',marginBottom:6}}>{b.genre}</div>
                  <div style={{font:'600 22px var(--font-serif)',color:'oklch(0.97 0.01 80)',letterSpacing:'-0.01em',lineHeight:1.15,maxWidth:'90%'}}>{b.title}</div>
                  <div style={{font:'400 11px var(--font-mono)',color:'oklch(0.97 0.01 80 / 0.6)',marginTop:6,letterSpacing:'0.06em'}}>{b.author}</div>
                </>}
                {b.empty && <div style={{font:'500 12px var(--font-mono)',color:'var(--ink-3)',letterSpacing:'0.1em',textTransform:'uppercase'}}>Черновик</div>}
              </div>
              {/* meta */}
              <div style={{padding:'14px 20px 16px'}}>
                <div style={{display:'flex',justifyContent:'space-between',font:'400 11px var(--font-mono)',color:'var(--ink-3)',letterSpacing:'0.06em',textTransform:'uppercase',marginBottom:8}}>
                  <span>{b.words.toLocaleString('ru')} / {b.goal.toLocaleString('ru')}</span>
                  <span>{Math.round(b.words/b.goal*100)}%</span>
                </div>
                <div style={{height:3,background:'var(--surface-2)',borderRadius:999,overflow:'hidden',marginBottom:12}}>
                  <div style={{width:`${(b.words/b.goal)*100}%`,height:'100%',background: b.empty ? 'var(--ink-4)' : 'var(--accent)'}}/>
                </div>
                <div style={{display:'flex',justifyContent:'space-between',fontSize:12,color:'var(--ink-3)'}}>
                  <span>{b.days} дн. в работе</span>
                  <span>изм. {b.last}</span>
                </div>
              </div>
            </div>
          ))}

          {/* new book card */}
          <div style={{borderRadius:12,border:'1px dashed var(--border-strong)',display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',gap:10,padding:24,minHeight:300,color:'var(--ink-3)'}}>
            <div style={{width:48,height:48,borderRadius:999,border:'1px solid var(--border)',display:'flex',alignItems:'center',justifyContent:'center'}}><Icon name="plus" size={20}/></div>
            <div style={{font:'500 14px var(--font-serif)',color:'var(--ink-2)'}}>Начать новую книгу</div>
            <div style={{fontSize:12,textAlign:'center',maxWidth:200,color:'var(--ink-3)'}}>Роман, детектив, научпоп, фэнтези или пустой проект</div>
          </div>
        </div>
      </div>
    </div>
  );
}
window.ScreenHome = ScreenHome;
