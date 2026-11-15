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
const genreIds:Record<string,number> = {'action':28,'aventure':12,'animation':16,'comédie':35,'crime':80,'documentaire':99,'drame':18,'famille':10751,'fantastique':14,'histoire':36,'horreur':27,'musique':10402,'mystère':9648,'romance':10749,'science-fiction':878,'thriller':53,'guerre':10752,'western':37,'action & aventure':10759,'science-fiction & fantastique':10765}

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
async function discoverTMDB(kind:'movie'|'tv', ids:number[]):Promise<Work[]> {
  if (!ids.length) return []
  const path=kind==='movie'?'/discover/movie':'/discover/tv'
  const data=await tmdb(`${path}?with_genres=${ids.join(',')}&sort_by=vote_average.desc&vote_count.gte=80&include_adult=false&language=fr-FR&page=1`)
  return (data.results||[]).slice(0,12).map((x:any)=>fromTmdb(x,kind))
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
      genres:v.categories||[], overview:typeof v.description==='string'?v.description:'', poster:v.imageLinks?.thumbnail?.replace('http:','https:'),
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
    overview:'',poster:x.cover_i?`https://covers.openlibrary.org/b/id/${x.cover_i}-M.jpg`:undefined,
    source:'Open Library',authors:x.author_name||[],url:`https://openlibrary.org${x.key}`,tags:x.subject||[] }))
}
async function enrichOpenLibraryDescriptions(works:Work[]):Promise<Work[]> {
  return Promise.all(works.map(async work=>{
    if(!work.id.startsWith('book-ol-')) return work
    const key=work.id.replace('book-ol-','')
    try {
      const r=await fetch(`https://openlibrary.org${key}.json`)
      if(!r.ok) return work
      const data=await r.json()
      const description=typeof data.description==='string'?data.description:data.description?.value
      return {...work,overview:typeof description==='string'?description:''}
    } catch { return work }
  }))
}
export async function searchBooks(q:string):Promise<Work[]> {
  const results=await Promise.allSettled([googleBooks(q),openLibrary(q)])
  const all=results.flatMap(x=>x.status==='fulfilled'?x.value:[])
  const seen=new Set<string>()
  const unique=all.filter(x=>{const k=x.title.toLowerCase().replace(/[^\p{L}\p{N}]/gu,'');if(seen.has(k))return false;seen.add(k);return true}).slice(0,18)
  return enrichOpenLibraryDescriptions(unique)
}

function usefulTerms(work:Work):string[] {
  const text=[work.title,...(work.genres||[]),...(work.tags||[]),work.overview||''].join(' ').toLocaleLowerCase('fr')
  const stop=new Set('avec dans pour mais comme cette celui celle leurs leur sont être avoir faire plus moins très alors aussi entre après avant vers sous sur chez dont qui que quoi les des une un du de la le et ou au aux en par est son sa ses mon ma mes ton ta tes the and with from into that this their they have has are was were your you'.split(' '))
  const terms=text.normalize('NFD').replace(/[\u0300-\u036f]/g,'').match(/[a-z]{4,}/g)||[]
  const counts=new Map<string,number>()
  for(const term of terms) if(!stop.has(term)) counts.set(term,(counts.get(term)||0)+1)
  return [...counts].sort((a,b)=>b[1]-a[1]).map(x=>x[0]).slice(0,4)
}
function genreIdsFor(work:Work):number[] {
  const ids=new Set<number>((work.raw?.genre_ids||[]).filter((x:number)=>Number.isFinite(x)))
  for(const genre of [...(work.genres||[]),...(work.tags||[])]) {
    const id=genreIds[genre.toLocaleLowerCase('fr')]
    if(id) ids.add(id)
  }
  return [...ids].slice(0,3)
}
function uniqueWorks(works:Work[],exclude:string):Work[] {
  const seen=new Set([exclude])
  return works.filter(w=>{if(seen.has(w.id))return false;seen.add(w.id);return true})
}
async function crossMediaRecommendations(work:Work):Promise<Work[]> {
  const terms=usefulTerms(work)
  const ids=genreIdsFor(work)
  const jobs:Promise<Work[]>[]=[]
  if(work.kind==='book') {
    if(terms.length) jobs.push(searchTMDB(terms.slice(0,2).join(' ')))
    if(ids.length) jobs.push(discoverTMDB('movie',ids),discoverTMDB('tv',ids))
  } else {
    const query=(work.genres||[]).slice(0,2).join(' ') || terms.slice(0,2).join(' ')
    if(query) jobs.push(searchBooks(query))
    if(terms.length) jobs.push(searchBooks(terms.slice(0,2).join(' ')))
    if(ids.length) jobs.push(searchBooks((work.genres||[]).slice(0,2).join(' ')))
    if(ids.length) jobs.push(discoverTMDB(work.kind==='movie'?'tv':'movie',ids))
  }
  const settled=await Promise.allSettled(jobs)
  return uniqueWorks(settled.flatMap(x=>x.status==='fulfilled'?x.value:[]),work.id)
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
  const [same,cross]=await Promise.allSettled([
    work.kind==='book'?Promise.resolve([] as Work[]):tmdbRecommendations(work),
    crossMediaRecommendations(work)
  ])
  const combined=[...(same.status==='fulfilled'?same.value:[]),...(cross.status==='fulfilled'?cross.value:[])]
  return uniqueWorks(combined,work.id).slice(0,36)
}
