import { TMDB_BASE } from '../config/constants';
import type { TmdbSearchResult, TmdbSeriesDetails } from '../types';

export class TmdbClient {
  constructor(private readonly apiKey: string) {}

  private buildUrl(path: string, extra: Record<string, string> = {}): string {
    const params = new URLSearchParams({ api_key: this.apiKey, language: 'fr-FR', ...extra });
    return `${TMDB_BASE}${path}?${params}`;
  }

  async searchSeries(query: string, signal?: AbortSignal): Promise<TmdbSearchResult[]> {
    if (!query.trim()) return [];
    const resp = await fetch(this.buildUrl('/search/tv', { query }), { signal });
    if (signal?.aborted) return [];
    if (resp.status === 401) throw new Error('Clé API invalide');
    if (!resp.ok) throw new Error(`TMDB erreur ${resp.status}`);
    const data = (await resp.json()) as { results: TmdbSearchResult[] };
    return data.results || [];
  }

  async getSeriesDetails(tmdbId: number): Promise<TmdbSeriesDetails | null> {
    const resp = await fetch(this.buildUrl(`/tv/${tmdbId}`));
    if (!resp.ok) return null;
    return resp.json() as Promise<TmdbSeriesDetails>;
  }

  async validateKey(): Promise<boolean> {
    const resp = await fetch(this.buildUrl('/configuration'));
    return resp.ok;
  }
}
