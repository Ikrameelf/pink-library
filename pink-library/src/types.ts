export type Kind = 'movie' | 'tv' | 'book'
export type Mode = 'all' | Kind
export type RecMode = 'ambiance' | 'universe' | 'characters' | 'style' | 'surprise'
export interface Work {
  id: string; kind: Kind; title: string; year?: string; genres: string[]; overview: string;
  poster?: string; rating?: number; source: string; url?: string; tags?: string[];
  authors?: string[]; characters?: string[]; raw?: any;
}
export interface SavedWork extends Work { savedAt: number; discovered?: boolean; note?: string; favorite?: boolean }
export interface SearchRecord { id: string; query: string; at: number; work: Work; recommendations: Work[] }
