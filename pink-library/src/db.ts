import type { SavedWork, SearchRecord } from './types'
const DB_NAME = 'pink-library-db', VERSION = 1
let dbPromise: Promise<IDBDatabase> | undefined
function db() {
  if (!dbPromise) dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, VERSION)
    req.onupgradeneeded = () => {
      const d = req.result
      if (!d.objectStoreNames.contains('saved')) d.createObjectStore('saved', { keyPath: 'id' })
      if (!d.objectStoreNames.contains('history')) d.createObjectStore('history', { keyPath: 'id' })
      if (!d.objectStoreNames.contains('prefs')) d.createObjectStore('prefs', { keyPath: 'key' })
    }
    req.onsuccess = () => resolve(req.result); req.onerror = () => reject(req.error)
  })
  return dbPromise
}
async function request<T>(store: string, mode: IDBTransactionMode, action: (s: IDBObjectStore) => IDBRequest): Promise<T> {
  const d = await db()
  return new Promise((resolve, reject) => {
    const tx = d.transaction(store, mode), req = action(tx.objectStore(store))
    req.onsuccess = () => resolve(req.result as T); req.onerror = () => reject(req.error)
  })
}
export const getSaved = () => request<SavedWork[]>('saved', 'readonly', s => s.getAll())
export const putSaved = (v: SavedWork) => request<IDBValidKey>('saved', 'readwrite', s => s.put(v))
export const deleteSaved = (id: string) => request<undefined>('saved', 'readwrite', s => s.delete(id))
export const getHistory = () => request<SearchRecord[]>('history', 'readonly', s => s.getAll())
export const putHistory = (v: SearchRecord) => request<IDBValidKey>('history', 'readwrite', s => s.put(v))
export const clearHistory = () => request<undefined>('history', 'readwrite', s => s.clear())
export const getPref = async <T,>(key: string, fallback: T): Promise<T> => {
  const row = await request<{key:string,value:T}|undefined>('prefs', 'readonly', s => s.get(key))
  return row?.value ?? fallback
}
export const setPref = (key: string, value: unknown) => request<IDBValidKey>('prefs', 'readwrite', s => s.put({key,value}))
export async function exportData() {
  const [saved, history, dark] = await Promise.all([getSaved(), getHistory(), getPref('dark', false)])
  return { app: 'Pink Library', version: 1, exportedAt: new Date().toISOString(), saved, history, dark }
}
export async function importData(data: any) {
  if (data?.app !== 'Pink Library' || !Array.isArray(data.saved) || !Array.isArray(data.history)) throw new Error('Fichier Pink Library invalide.')
  const d = await db()
  await new Promise<void>((resolve,reject) => {
    const tx = d.transaction(['saved','history','prefs'], 'readwrite')
    tx.objectStore('saved').clear(); tx.objectStore('history').clear()
    data.saved.forEach((x:SavedWork) => tx.objectStore('saved').put(x))
    data.history.forEach((x:SearchRecord) => tx.objectStore('history').put(x))
    tx.objectStore('prefs').put({key:'dark', value:!!data.dark})
    tx.oncomplete = () => resolve(); tx.onerror = () => reject(tx.error)
  })
}
