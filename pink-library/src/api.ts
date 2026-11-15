import type { Kind, Work } from './types'
const TMDB = 'https://api.themoviedb.org/3'
const IMG = 'https://image.tmdb.org/t/p/w500'
const tokenKey = 'pink-library-tmdb-token'
export const getToken = () => localStorage.getItem(tokenKey) || ''
export const saveToken = (token: string) => token.trim() ? localStorage.setItem(tokenKey, token.trim()) : localStorage.removeItem(tokenKey)
async function tmdb(path: string) {
  const token = getToken()
  if (!token) throw new Error('Ajoute ton jeton API TMDB dans les réglages pour activer les films et séries.')
  const r = await fetch(`${TMDB}${path}`, { headers: { Authorization: `Bearer ${token}`, accept: 'application/json' } })
  if (!r.ok) throw new Error(r.status === 401 ? 'Jeton TMDB invalide. Vérifie-le dans les réglages.' : `TMDB a répondu ${r.status}. Réessaie dans un instant.`)
  return r.json()
}
const movieGenres:Record<number,string> = {28:'Action',12:'Aventure',16:'Animation',35:'Comédie',80:'Crime',99:'Documentaire',18:'Drame',10751:'Famille',14:'Fantastique',36:'Histoire',27:'Horreur',10402:'Musique',9648:'Mystère',10749:'Romance',878:'Science-fiction',10770:'Téléfilm',53:'Thriller',10752:'Guerre',37:'Western',10759:'Action & aventure',10762:'Enfants',10763:'Actualités',10764:'Télé-réalité',10765:'Science-fiction & fantastique',10766:'Soap',10767:'Talk-show',10768:'Guerre & politique'}
function fromTmdb(x:any, kind:Kind):Work {
  return { id:`${kind}-${x.id}`, kind, title:x.title || x.name || x.original_title || x.original_name,
    year:(x.release_date || x.first_air_date || '').slice(0,4), genres:(x.genre_ids || []).map((g:number)=>movieGenres[g]).filter(Boolean),
    overview:x.overview || '', poster:x.poster_path ? IMG+x.poster_path : undefined, rating:typeof x.vote_average==='number' && x.vote_count>0 ? x.vote_average : undefined,
    source:'TMDB', url:`https://www.themoviedb.org/${kind==='movie'?'movie':'tv'}/${x.id}`, raw:x }
}
export async function searchTMDB(q:string):Promise<Work[]> {
  const data = await tmdb(`/search/multi?query=${encodeURIComponent(q)}&include_adult=false&language=fr-FR&page=1`)
  return (data.results || []).filter((x:any)=>['movie','tv'].includes(x.media_type)).slice(0,12).map((x:any)=>fromTmdb(x,x.media_type))
}
export async function tmdbRecommendations(work:Work):Promise<Work[]> {
  const id = work.id.split('-').slice(1).join('-'), endpoint = work.kind==='movie'?'movie':'tv'
  const [rec, similar] = await Promise.all([
    tmdb(`/${endpoint}/${id}/recommendations?language=fr-FR&page=1`),
    tmdb(`/${endpoint}/${id}/similar?language=fr-FR&page=1`).catch(()=>({results:[]}))
  ])
  const merged = [...(rec.results||[]), ...(similar.results||[])]
  const seen = new Set<number>()
  return merged.filter((x:any)=>!seen.has(x.id) && seen.add(x.id)).slice(0,18).map((x:any)=>fromTmdb(x,work.kind))
}
async function googleBooks(q:string) {
  const r = await fetch(`https://www.googleapis.com/books/v1/volumes?q=${encodeURIComponent(q)}&maxResults=12&printType=books&langRestrict=fr`)
  if (!r.ok) throw new Error('Google Books est momentanément indisponible.')
  const data = await r.json()
  return (data.items||[]).map((x:any):Work => {
    const v=x.volumeInfo||{}
    return { id:`book-${x.id}`, kind:'book', title:v.title||'Titre inconnu', year:(v.publishedDate||'').slice(0,4),
      genres:v.categories||[], overview:v.description||'', poster:v.imageLinks?.thumbnail?.replace('http:','https:'),
      rating:typeof v.averageRating==='number'?v.averageRating*2:undefined, source:'Google Books',
      authors:v.authors||[], url:v.infoLink, tags:[...(v.categories||[])] }
  })
}
async function openLibrary(q:string) {
  const r=await fetch(`https://openlibrary.org/search.json?q=${encodeURIComponent(q)}&limit=12&fields=key,title,author_name,first_publish_year,subject,cover_i`)
  if(!r.ok) throw new Error('Open Library est momentanément indisponible.')
  const data=await r.json()
  return (data.docs||[]).map((x:any):Work=>({ id:`book-ol-${x.key}`,kind:'book',title:x.title||'Titre inconnu',
    year:x.first_publish_year?String(x.first_publish_year):undefined,genres:(x.subject||[]).slice(0,4),
    overview:'Résumé non fourni par Open Library.',poster:x.cover_i?`https://covers.openlibrary.org/b/id/${x.cover_i}-M.jpg`:undefined,
    source:'Open Library',authors:x.author_name||[],url:`https://openlibrary.org${x.key}`,tags:x.subject||[] }))
}
export async function searchBooks(q:string):Promise<Work[]> {
  const results=await Promise.allSettled([googleBooks(q),openLibrary(q)])
  const all=results.flatMap(x=>x.status==='fulfilled'?x.value:[])
  const seen=new Set<string>()
  return all.filter(x=>{const k=x.title.toLowerCase().replace(/[^\p{L}\p{N}]/gu,'');if(seen.has(k))return false;seen.add(k);return true}).slice(0,18)
}
export async function recommendBooks(work:Work):Promise<Work[]> {
  const terms=[...(work.genres||[]),...(work.tags||[])].slice(0,3)
  const queries=terms.length?terms.map(x=>`subject:${x}`):[work.title.split(' ').slice(0,2).join(' ')]
  const result=await Promise.allSettled(queries.map(q=>searchBooks(q)))
  const all=result.flatMap(x=>x.status==='fulfilled'?x.value:[])
  const seen=new Set([work.id])
  return all.filter(x=>{const k=x.title.toLowerCase();if(seen.has(k))return false;seen.add(k);return true}).slice(0,18)
}
export async function searchWorks(q:string, mode:'all'|Kind='all'):Promise<Work[]> {
  const jobs:Promise<Work[]>[]=[]
  if(mode==='all'||mode==='movie'||mode==='tv') jobs.push(searchTMDB(q).then(xs=>mode==='all'?xs:xs.filter(x=>x.kind===mode)))
  if(mode==='all'||mode==='book') jobs.push(searchBooks(q))
  const settled=await Promise.allSettled(jobs)
  const data=settled.flatMap(x=>x.status==='fulfilled'?x.value:[])
  if(!data.length) {
    const errors=settled.filter(x=>x.status==='rejected') as PromiseRejectedResult[]
    if(errors.length===settled.length && errors[0]) throw errors[0].reason
  }
  return data
}
export async function recommendations(work:Work):Promise<Work[]> {
  return work.kind==='book'?recommendBooks(work):tmdbRecommendations(work)
}
