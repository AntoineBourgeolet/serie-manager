import { TMDB_BASE } from '../config/constants';
import type { TmdbSearchResult, TmdbSeriesDetails } from '../types';

export class TmdbClient {
  constructor(private readonly apiKey: string) {}

  private buildUrl(path: string, extra: Record<string, string> = {}): string {
    const params = new URLSearchParams({ api_key: this.apiKey, language: 'fr-FR', ...extra });
    return `${TMDB_BASE}${path}?${params}`;
  }

  private async fetchJson<T>(url: string, signal?: AbortSignal): Promise<T> {
    const resp = await fetch(url, signal ? { signal } : undefined);
    if (signal?.aborted) throw new DOMException('Aborted', 'AbortError');
    if (resp.status === 401) throw new Error('Clé API invalide');
    if (resp.status === 429) throw new Error('Limite de requêtes TMDB atteinte. Réessayez dans quelques secondes.');
    if (!resp.ok) throw new Error(`TMDB erreur ${resp.status}`);
    return resp.json() as Promise<T>;
  }

  async searchSeries(query: string, signal?: AbortSignal): Promise<TmdbSearchResult[]> {
    if (!query.trim()) return [];
    const data = await this.fetchJson<{ results: TmdbSearchResult[] }>(
      this.buildUrl('/search/tv', { query }),
      signal
    );
    return data.results || [];
  }

  async getSeriesDetails(tmdbId: number): Promise<TmdbSeriesDetails | null> {
    try {
      return await this.fetchJson<TmdbSeriesDetails>(this.buildUrl(`/tv/${tmdbId}`));
    } catch {
      return null;
    }
  }

  async getSimilarSeries(tmdbId: number): Promise<TmdbSearchResult[]> {
    try {
      const data = await this.fetchJson<{ results: TmdbSearchResult[] }>(
        this.buildUrl(`/tv/${tmdbId}/similar`)
      );
      return data.results || [];
    } catch {
      return [];
    }
  }

  async validateKey(): Promise<boolean> {
    const resp = await fetch(this.buildUrl('/configuration'));
    return resp.ok;
  }
}
