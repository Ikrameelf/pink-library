import { useEffect, useMemo, useState } from 'react'
import { Search, Heart, Bookmark, Clock3, Sparkles, Settings, Sun, Moon, Download, Upload, X, Star, BookOpen, Clapperboard, Tv, Flower2, Trash2, Check, Shuffle, SlidersHorizontal, ArrowLeft, ExternalLink, WandSparkles, Library, ChevronRight } from 'lucide-react'
import { searchWorks, recommendations, getToken, saveToken } from './api'
import { getSaved, putSaved, deleteSaved, getHistory, putHistory, clearHistory, getPref, setPref, exportData, importData } from './db'
import type { Kind, Mode, RecMode, SavedWork, SearchRecord, Work } from './types'

const kindLabel:Record<Kind,string>={movie:'Film',tv:'Série',book:'Livre'}
const modeLabel:Record<RecMode,string>={ambiance:'Même ambiance',universe:'Même univers',characters:'Personnages',style:'Même style',surprise:'Surprise me'}
const modeCopy:Record<RecMode,string>={ambiance:'Pour retrouver les mêmes émotions et la même atmosphère.',universe:'Des mondes, thèmes et décors qui se répondent.',characters:'Des personnages complexes et des relations qui font écho.',style:'Une narration, un rythme ou une esthétique proche.',surprise:'Des pistes inattendues, à la frontière de tes goûts.'}
const moods:Record<RecMode,string[]>={ambiance:['ambiance','mélancolie','romance','drame','émotion'],universe:['fantasy','fantastique','science-fiction','mystère','aventure'],characters:['personnages','relations','famille','amitié','romance'],style:['narration','mystère','thriller','drame','animation'],surprise:['découverte','inattendu','univers']}
const STOP = new Set('avec dans pour mais comme cette celui celle leurs leur sont être avoir faire plus moins très alors aussi entre après avant vers sous sur chez dont qui que quoi les des une un du de la le et ou au aux en par est son sa ses mon ma mes ton ta tes the and with from into that this their they have has are was were your you'.split(' '))
const lexicon = (w:Work) => {
  const raw = [w.title, w.overview, ...w.genres, ...(w.tags||[])].join(' ').toLocaleLowerCase('fr')
  return raw.normalize('NFD').replace(/[\u0300-\u036f]/g,'').match(/[a-z]{4,}/g)?.filter(t=>!STOP.has(t)) || []
}
function similarity(a:Work,b:Work,mode:RecMode) {
  const genreA=new Set(a.genres.map(x=>x.toLowerCase())), genreB=new Set(b.genres.map(x=>x.toLowerCase()))
  const genreCommon=[...genreA].filter(x=>genreB.has(x)).length
  const genreScore=genreCommon/Math.max(1,new Set([...genreA,...genreB]).size)
  const aa=new Set(lexicon(a)), bb=new Set(lexicon(b))
  const common=[...aa].filter(x=>bb.has(x))
  const lexical=common.length/Math.max(1,new Set([...aa,...bb]).size)
  const moodHits=(moods[mode]||[]).filter(w=>(a.overview+' '+a.genres.join(' ')).toLowerCase().includes(w)&&(b.overview+' '+b.genres.join(' ')).toLowerCase().includes(w)).length
  const weights:Record<RecMode,[number,number,number]>={ambiance:[.25,.55,.20],universe:[.50,.35,.15],characters:[.20,.65,.15],style:[.25,.60,.15],surprise:[.20,.35,.45]}
  const [gw,lw,mw]=weights[mode]
  const surprisePenalty=mode==='surprise'&&genreCommon>0?.08:0
  return Math.max(0,Math.min(.99,genreScore*gw+lexical*lw+Math.min(moodHits,2)*mw*.25+Math.min(common.length,8)*.025-surprisePenalty))
}
function explanation(a:Work,b:Work,mode:RecMode) {
  const commonGenres=a.genres.filter(g=>b.genres.some(h=>h.toLowerCase()===g.toLowerCase())).slice(0,2)
  const aa=new Set(lexicon(a)), shared=lexicon(b).filter(x=>aa.has(x)).filter((x,i,arr)=>arr.indexOf(x)===i).slice(0,3)
  const details=[...commonGenres,...shared].slice(0,3)
  const lead=mode==='surprise'?'Une découverte un peu inattendue à explorer':modeCopy[mode]
  return details.length?`${lead} Les métadonnées des deux œuvres font ressortir : ${details.join(', ')}.`:`${lead} Les informations disponibles sont limitées : cette suggestion provient du catalogue de recommandations.`
}
function App() {
  const [page,setPage]=useState<'home'|'results'|'wishlist'|'favorites'|'history'>('home')
  const [query,setQuery]=useState(''),[searchMode,setSearchMode]=useState<Mode>('all')
  const [works,setWorks]=useState<Work[]>([]),[selected,setSelected]=useState<Work|null>(null)
  const [recs,setRecs]=useState<Work[]>([]),[filter,setFilter]=useState<Mode>('all'),[recMode,setRecMode]=useState<RecMode>('ambiance')
  const [saved,setSaved]=useState<SavedWork[]>([]),[history,setHistory]=useState<SearchRecord[]>([])
  const [busy,setBusy]=useState(false),[error,setError]=useState(''),[notice,setNotice]=useState('')
  const [showSettings,setShowSettings]=useState(false),[token,setToken]=useState(getToken()),[dark,setDark]=useState(false)
  const [detail,setDetail]=useState<Work|null>(null),[wishQuery,setWishQuery]=useState(''),[note,setNote]=useState('')
  useEffect(()=>{(async()=>{setSaved(await getSaved());setHistory((await getHistory()).sort((a,b)=>b.at-a.at));setDark(await getPref('dark',false))})()},[])
  useEffect(()=>{document.documentElement.dataset.theme=dark?'dark':'light'},[dark])
  const refresh=async()=>{setSaved(await getSaved());setHistory((await getHistory()).sort((a,b)=>b.at-a.at))}
  const runSearch=async(q=query,mode:Mode=searchMode)=>{
    if(!q.trim())return
    setBusy(true);setError('');setNotice('');setSelected(null);setRecs([])
    try{
      const found=await searchWorks(q.trim(),mode)
      setWorks(found)
      if(!found.length){setError('Aucune œuvre trouvée. Essaie un autre titre ou vérifie la catégorie.');setPage('home')}
      else if(found.length===1){await chooseWork(found[0])}
    }catch(e:any){setError(e?.message||'La recherche a échoué. Vérifie ta connexion puis réessaie.')}
    finally{setBusy(false)}
  }
  const chooseWork=async(w:Work)=>{
    setSelected(w);setPage('results');setBusy(true);setError('')
    try{
      const found=await recommendations(w);setRecs(found)
      const record:SearchRecord={id:`${Date.now()}-${w.id}`,query:w.title,at:Date.now(),work:w,recommendations:found}
      await putHistory(record);await refresh()
    }catch(e:any){setRecs([]);setError(e?.message||'Impossible de charger les recommandations.')}
    finally{setBusy(false)}
  }
  const filtered=useMemo(()=>recs.filter(w=>filter==='all'||w.kind===filter).sort((a,b)=>similarity(selected!,b,recMode)-similarity(selected!,a,recMode)),[recs,filter,selected,recMode])
  const addSaved=async(w:Work,field:'favorite'|'wishlist'='wishlist')=>{
    const old=saved.find(x=>x.id===w.id)
    await putSaved({...old,...w,savedAt:old?.savedAt||Date.now(),favorite:field==='favorite'?true:old?.favorite||false,discovered:old?.discovered||false,note:old?.note||''})
    await refresh();setNotice(field==='favorite'?'Ajouté à tes favoris ♡':'Ajouté à ta wishlist ♡');setTimeout(()=>setNotice(''),2400)
  }
  const removeSaved=async(id:string)=>{await deleteSaved(id);await refresh()}
  const updateSaved=async(w:SavedWork,patch:Partial<SavedWork>)=>{await putSaved({...w,...patch});await refresh()}
  const surprise=()=>{const pool=history.flatMap(h=>h.recommendations);if(pool.length){const w=pool[Math.floor(Math.random()*pool.length)];setSelected(w);chooseWork(w)}else{setQuery('romance mélancolique');runSearch('romance mélancolique','all')}}
  const doExport=async()=>{const data=await exportData(),blob=new Blob([JSON.stringify(data,null,2)],{type:'application/json'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download='pink-library-backup.json';a.click();URL.revokeObjectURL(url)}
  const doImport=(file?:File)=>{if(!file)return;const reader=new FileReader();reader.onload=async()=>{try{await importData(JSON.parse(String(reader.result)));await refresh();setNotice('Bibliothèque importée avec succès ♡')}catch(e:any){setError(e.message||'Import impossible.')}};reader.readAsText(file)}
  const list=saved.filter(x=>page==='favorites'?x.favorite:!x.favorite).filter(x=>!wishQuery||x.title.toLowerCase().includes(wishQuery.toLowerCase()))
  const nav=(p:typeof page)=>{setPage(p);setDetail(null)}
  const card=(w:Work,showWhy=false)=><article className="work-card" key={w.id}>
    <button className="poster-button" onClick={()=>setDetail(w)} aria-label={`Voir ${w.title}`}><Poster work={w}/></button>
    <div className="card-content"><div className="card-meta">{kindLabel[w.kind]}{w.year?` · ${w.year}`:''}</div><button className="card-title" onClick={()=>setDetail(w)}>{w.title}</button>
      <div className="genre-line">{w.genres.slice(0,2).join(' · ')||'À découvrir'}</div>
      {w.rating!==undefined&&<div className="rating"><Star size={13} fill="currentColor"/> {w.rating.toFixed(1)}<span>/10</span></div>}
      {showWhy&&selected&&<p className="why">{explanation(selected,w,recMode)}</p>}
      <div className="card-actions"><button onClick={()=>addSaved(w)}><Bookmark size={15}/> Wishlist</button><button onClick={()=>addSaved(w,'favorite')}><Heart size={15}/> Favori</button></div>
    </div>
  </article>
  return <div className="app-shell">
    <aside className="sidebar"><button className="brand" onClick={()=>nav('home')}><span className="brand-icon">🎀</span><span>pink library<small>your little culture corner</small></span></button>
      <div className="side-label">MON ESPACE</div>
      <button className={page==='home'?'nav active':'nav'} onClick={()=>nav('home')}><Sparkles/> Découvrir</button>
      <button className={page==='wishlist'?'nav active':'nav'} onClick={()=>nav('wishlist')}><Bookmark/> Ma wishlist <span className="nav-count">{saved.filter(x=>!x.favorite).length||''}</span></button>
      <button className={page==='favorites'?'nav active':'nav'} onClick={()=>nav('favorites')}><Heart/> Mes favoris</button>
      <button className={page==='history'?'nav active':'nav'} onClick={()=>nav('history')}><Clock3/> Historique</button>
      <div className="sidebar-bottom"><div className="quote-card"><span>✿</span><p>“A little world of stories, feelings & daydreams.”</p><small>TA BIBLIOTHÈQUE PERSONNELLE</small></div>
        <button className="nav" onClick={()=>setShowSettings(true)}><Settings/> Réglages</button>
      </div>
    </aside>
    <main className="main">
      <header className="topbar"><div className="breadcrumb">Pink Library <span>/</span> {({home:'Découvrir',results:'Recommandations',wishlist:'Ma wishlist',favorites:'Mes favoris',history:'Historique'} as any)[page]}</div>
        <div className="top-actions"><span className="hello">ton petit cocon culturel ♡</span><button className="icon-button" onClick={()=>setDark(!dark)} title="Changer de thème">{dark?<Sun/>:<Moon/>}</button><button className="avatar" onClick={()=>setShowSettings(true)}>P</button></div></header>
      {notice&&<div className="toast">{notice}</div>}
      {error&&<div className="error-banner"><span>{error}</span><button onClick={()=>setError('')}><X size={16}/></button></div>}
      {page==='home'&&<section className="home-page">
        <div className="hero"><div className="hero-flower">✿</div><div className="eyebrow">BIENVENUE DANS TON UNIVERS</div><h1>Every story has<br/><em>a little magic.</em></h1><p>Retrouve les histoires qui te ressemblent et découvre tes prochains coups de cœur.</p>
          <div className="search-box"><Search size={20}/><input value={query} onChange={e=>setQuery(e.target.value)} onKeyDown={e=>e.key==='Enter'&&runSearch()} placeholder="Un livre, un film, une série..." /><select value={searchMode} onChange={e=>setSearchMode(e.target.value as Mode)}><option value="all">Tout</option><option value="movie">Films</option><option value="tv">Séries</option><option value="book">Livres</option></select><button onClick={()=>runSearch()} disabled={busy||!query.trim()}>{busy?'...':'Explorer'}</button></div>
          <div className="search-hint">What are we in the mood for today?</div>
          <div className="quick-links"><button onClick={()=>{setSearchMode('movie');document.querySelector<HTMLInputElement>('.search-box input')?.focus()}}><Clapperboard/> Films</button><button onClick={()=>{setSearchMode('tv');document.querySelector<HTMLInputElement>('.search-box input')?.focus()}}><Tv/> Séries</button><button onClick={()=>{setSearchMode('book');document.querySelector<HTMLInputElement>('.search-box input')?.focus()}}><BookOpen/> Livres</button><button className="surprise" onClick={surprise}><Shuffle/> Surprise me</button></div>
        </div>
        {works.length>1&&<section className="section-block"><div className="section-heading"><div><span className="eyebrow">RÉSULTATS DE RECHERCHE</span><h2>Quelle œuvre voulais-tu dire ?</h2></div></div><div className="work-grid">{works.map(w=>card(w))}</div></section>}
        {history.length>0&&<section className="section-block"><div className="section-heading"><div><span className="eyebrow">REPRENDRE SON VOYAGE</span><h2>Tes dernières découvertes</h2></div><button className="text-link" onClick={()=>nav('history')}>Tout voir <ChevronRight size={15}/></button></div><div className="recent-row">{history.slice(0,4).map(h=><button className="recent-item" key={h.id} onClick={()=>chooseWork(h.work)}><Poster work={h.work}/><span><b>{h.work.title}</b><small>{kindLabel[h.work.kind]} · {new Date(h.at).toLocaleDateString('fr-FR')}</small></span></button>)}</div></section>}
        {saved.length>0&&<section className="section-block"><div className="section-heading"><div><span className="eyebrow">PETITS TRÉSORS</span><h2>À garder près de soi</h2></div><button className="text-link" onClick={()=>nav('wishlist')}>Ma wishlist <ChevronRight size={15}/></button></div><div className="work-grid">{saved.slice(0,4).map(w=>card(w))}</div></section>}
        <div className="footer-note">Fait avec amour, pour les amoureuses des histoires <span>♡</span></div>
      </section>}
      {page==='results'&&selected&&<section className="results-page">
        <button className="back-link" onClick={()=>nav('home')}><ArrowLeft size={16}/> Nouvelle recherche</button>
        <div className="selected-work"><div className="selected-poster"><Poster work={selected}/></div><div className="selected-info"><span className="eyebrow">TON POINT DE DÉPART · {kindLabel[selected.kind].toUpperCase()}</span><h1>{selected.title}</h1><div className="selected-meta">{selected.year||'Année inconnue'} · {selected.genres.join(' · ')||'Genre non renseigné'} {selected.rating!==undefined&&<span className="rating"><Star size={14} fill="currentColor"/> {selected.rating.toFixed(1)}/10</span>}</div><p>{selected.overview||'Aucun résumé disponible pour cette œuvre.'}</p><div className="selected-buttons"><button className="primary" onClick={()=>addSaved(selected)}><Bookmark size={16}/> Ajouter à ma wishlist</button><button className="soft-button" onClick={()=>addSaved(selected,'favorite')}><Heart size={16}/> Favori</button>{selected.url&&<a href={selected.url} target="_blank" rel="noreferrer"><ExternalLink size={15}/> Source</a>}</div></div></div>
        <div className="section-heading recommendations-heading"><div><span className="eyebrow">TA PROCHAINE OBSESSION ?</span><h2>Des histoires à aimer</h2><p>Des suggestions sélectionnées à partir de ton œuvre.</p></div><span className="result-count">{recs.length} suggestions</span></div>
        <div className="mode-tabs">{(Object.keys(modeLabel) as RecMode[]).map(m=><button className={recMode===m?'selected':''} key={m} onClick={()=>setRecMode(m)}>{m==='ambiance'?'♡ ':m==='universe'?'✧ ':m==='characters'?'❀ ':m==='style'?'✿ ':'✦ '}{modeLabel[m]}</button>)}</div>
        <p className="mode-description">{modeCopy[recMode]}</p>
        <div className="filter-row"><span><SlidersHorizontal size={15}/> CATÉGORIES</span>{(['all','movie','tv','book'] as Mode[]).map(m=><button key={m} className={filter===m?'chosen':''} onClick={()=>setFilter(m)}>{m==='all'?'Tout':kindLabel[m]}</button>)}</div>
        {busy?<div className="loading"><div className="loader"/>Les histoires arrivent...</div>:filtered.length?<div className="work-grid">{filtered.map(w=>card(w,true))}</div>:<div className="empty-state"><Flower2/><h3>Pas encore de suggestions</h3><p>Essaie une autre œuvre ou une autre catégorie.</p></div>}
      </section>}
      {(page==='wishlist'||page==='favorites')&&<section className="collection-page"><div className="page-intro"><span className="eyebrow">TA COLLECTION PERSONNELLE</span><h1>{page==='wishlist'?'Ma wishlist':'Mes favoris'} <span>♡</span></h1><p>{page==='wishlist'?'Toutes ces histoires qui attendent leur moment.':'Les œuvres qui ont trouvé une place dans ton cœur.'}</p></div>
        <div className="collection-tools"><div className="search-mini"><Search size={16}/><input placeholder="Rechercher dans ma collection..." value={wishQuery} onChange={e=>setWishQuery(e.target.value)}/></div><span>{list.length} œuvre{list.length>1?'s':''}</span></div>
        {list.length?<div className="collection-list">{list.map(w=><div className="collection-item" key={w.id}><button className="collection-poster" onClick={()=>setDetail(w)}><Poster work={w}/></button><div className="collection-info"><span className="eyebrow">{kindLabel[w.kind]} {w.year&&`· ${w.year}`}</span><h3>{w.title}</h3><p>{w.genres.slice(0,3).join(' · ')}</p><textarea placeholder="Une petite note personnelle..." value={w.note||''} onChange={e=>updateSaved(w,{note:e.target.value})}/></div><div className="collection-actions"><label className="discover-check"><input type="checkbox" checked={!!w.discovered} onChange={e=>updateSaved(w,{discovered:e.target.checked})}/> Découvert</label><button className="icon-button" title="Retirer" onClick={()=>removeSaved(w.id)}><Trash2 size={17}/></button></div></div>)}</div>:<div className="empty-state"><Flower2/><h3>Un espace à remplir de belles histoires</h3><p>Ajoute une œuvre depuis tes recommandations pour la retrouver ici.</p><button className="primary" onClick={()=>nav('home')}>Explorer des œuvres</button></div>}
      </section>}
      {page==='history'&&<section className="collection-page"><div className="page-intro"><span className="eyebrow">TON PETIT JOURNAL CULTUREL</span><h1>Historique <span>✧</span></h1><p>Retrouve les œuvres explorées et leurs recommandations.</p></div>
        <div className="history-toolbar"><span>{history.length} recherche{history.length>1?'s':''}</span>{history.length>0&&<button className="text-link" onClick={async()=>{if(confirm('Effacer tout ton historique ?')){await clearHistory();await refresh()}}}>Effacer l'historique</button>}</div>
        {history.length?<div className="history-list">{history.map(h=><div className="history-entry" key={h.id}><button className="history-cover" onClick={()=>chooseWork(h.work)}><Poster work={h.work}/></button><div><span className="eyebrow">{new Date(h.at).toLocaleString('fr-FR')} · {kindLabel[h.work.kind]}</span><h3>{h.work.title}</h3><p>{h.recommendations.length} recommandations récupérées</p></div><button className="soft-button" onClick={()=>chooseWork(h.work)}>Revoir <ChevronRight size={15}/></button></div>)}</div>:<div className="empty-state"><Clock3/><h3>Ton journal est encore vierge</h3><p>Les œuvres recherchées apparaîtront ici automatiquement.</p></div>}
      </section>}
    </main>
    {detail&&<div className="modal-backdrop" onClick={()=>setDetail(null)}><div className="detail-modal" onClick={e=>e.stopPropagation()}><button className="modal-close" onClick={()=>setDetail(null)}><X/></button><div className="detail-top"><Poster work={detail}/><div><span className="eyebrow">{kindLabel[detail.kind]} · {detail.year||'Date inconnue'}</span><h2>{detail.title}</h2><p>{detail.genres.join(' · ')}</p>{detail.rating!==undefined&&<div className="rating"><Star size={14} fill="currentColor"/> {detail.rating.toFixed(1)}/10</div>}<p>{detail.overview||'Aucun résumé disponible.'}</p><small>Informations : {detail.source}</small></div></div><div className="selected-buttons"><button className="primary" onClick={()=>addSaved(detail)}><Bookmark size={16}/> Wishlist</button><button className="soft-button" onClick={()=>addSaved(detail,'favorite')}><Heart size={16}/> Favori</button>{detail.url&&<a href={detail.url} target="_blank" rel="noreferrer">Voir la fiche <ExternalLink size={14}/></a>}</div></div></div>}
    {showSettings&&<div className="modal-backdrop" onClick={()=>setShowSettings(false)}><div className="settings-modal" onClick={e=>e.stopPropagation()}><button className="modal-close" onClick={()=>setShowSettings(false)}><X/></button><span className="eyebrow">TON ESPACE, TES RÈGLES</span><h2>Réglages</h2><p>Les données de ta bibliothèque restent dans ton navigateur. Le jeton TMDB sert uniquement aux appels directs vers TMDB.</p>
      <label className="field-label">JETON D'ACCÈS API TMDB (V4)</label><input className="settings-input" type="password" value={token} onChange={e=>setToken(e.target.value)} placeholder="Colle ton Read Access Token ici"/>
      <small>Crée un compte gratuit sur themoviedb.org, puis génère un « API Read Access Token » dans les paramètres API. Sans jeton, les recherches de livres restent disponibles.</small>
      <button className="primary full" onClick={()=>{saveToken(token);setShowSettings(false);setNotice('Réglages enregistrés sur cet appareil ♡')}}><Check size={16}/> Enregistrer</button>
      <div className="settings-divider"/>
      <h3>Mes données</h3><p>Exporte une sauvegarde JSON ou importe une sauvegarde existante.</p><div className="data-buttons"><button className="soft-button" onClick={doExport}><Download size={16}/> Exporter</button><label className="soft-button upload-label"><Upload size={16}/> Importer<input type="file" accept="application/json" onChange={e=>doImport(e.target.files?.[0])}/></label></div>
      <div className="privacy-note"><Heart size={15}/> Aucun compte Pink Library. Wishlist, favoris, notes et historique sont stockés localement dans IndexedDB.</div>
    </div></div>}
  </div>
}
function Poster({work}:{work:Work}){return <div className="poster">{work.poster?<img src={work.poster} alt={`Couverture de ${work.title}`} loading="lazy" onError={e=>{e.currentTarget.style.display='none'}}/>:<div className="poster-placeholder"><span>{work.kind==='book'?'✿':work.kind==='tv'?'✧':'♡'}</span><small>{work.title}</small></div>}</div>}
export default App
