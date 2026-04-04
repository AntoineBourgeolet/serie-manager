import type { Series, SeriesStatus, AppStats } from '../types';
import { LS_KEY } from '../config/constants';
import { tryParseJSON } from '../utils/formatting';

export type SortOption = 'name-asc' | 'name-desc' | 'rating-desc' | 'rating-asc' | 'recent';

export class SeriesStore {
  private series: Series[] = [];
  private subscribers: Array<() => void> = [];

  subscribe(fn: () => void): () => void {
    this.subscribers.push(fn);
    return () => {
      this.subscribers = this.subscribers.filter((s) => s !== fn);
    };
  }

  private notify(): void {
    this.subscribers.forEach((fn) => fn());
  }

  load(): void {
    try {
      const raw = localStorage.getItem(LS_KEY);
      if (raw) {
        const parsed = tryParseJSON<Series[]>(raw, []);
        this.series = parsed.map((s) => ({
          ...s,
          seasonsData: s.seasonsData?.length ? s.seasonsData : [],
          watchedEpisodes: s.watchedEpisodes && Object.keys(s.watchedEpisodes).length
            ? s.watchedEpisodes
            : {},
        }));
      }
    } catch {
      this.series = [];
    }
  }

  save(): void {
    try {
      localStorage.setItem(LS_KEY, JSON.stringify(this.series));
    } catch {
      // handled by caller via toast
    }
  }

  getAll(): Series[] {
    return this.series;
  }

  getFiltered(filter: SeriesStatus | 'all', query: string, sort: SortOption = 'recent'): Series[] {
    const filtered = this.series.filter((s) => {
      const matchFilter = filter === 'all' || s.status === filter;
      const matchSearch = !query || s.name.toLowerCase().includes(query.toLowerCase());
      return matchFilter && matchSearch;
    });

    return filtered.slice().sort((a, b) => {
      switch (sort) {
        case 'name-asc':
          return a.name.localeCompare(b.name);
        case 'name-desc':
          return b.name.localeCompare(a.name);
        case 'rating-desc': {
          const ra = a.rating ?? -1;
          const rb = b.rating ?? -1;
          return rb - ra;
        }
        case 'rating-asc': {
          const ra = a.rating ?? 11;
          const rb = b.rating ?? 11;
          return ra - rb;
        }
        case 'recent':
        default:
          return 0; // preserve insertion order
      }
    });
  }

  add(series: Series): void {
    this.series.push(series);
    this.save();
    this.notify();
  }

  update(id: string, updates: Partial<Series>): void {
    const idx = this.series.findIndex((s) => s.id === id);
    if (idx === -1) return;
    this.series[idx] = { ...this.series[idx], ...updates };
    this.save();
    this.notify();
  }

  remove(id: string): void {
    this.series = this.series.filter((s) => s.id !== id);
    this.save();
    this.notify();
  }

  has(tmdbId: number): boolean {
    return this.series.some((s) => s.tmdbId === tmdbId);
  }

  computeStats(): AppStats {
    const byStatus = (st: SeriesStatus) => this.series.filter((s) => s.status === st);
    const watching = byStatus('watching');
    const completed = byStatus('completed');
    const watchlist = byStatus('watchlist');
    const totalEpFor = (list: Series[]) => list.reduce((a, s) => a + (s.episodesTotal || 0), 0);
    const totalMinFor = (list: Series[]) =>
      list.reduce((a, s) => a + (s.episodesTotal || 0) * (s.episodeRuntime || 0), 0);
    return {
      total: this.series.length,
      countWatching: watching.length,
      countCompleted: completed.length,
      countWatchlist: watchlist.length,
      epWatching: totalEpFor(watching),
      epCompleted: totalEpFor(completed),
      epWatchlist: totalEpFor(watchlist),
      epTotal: totalEpFor(this.series),
      minWatching: totalMinFor(watching),
      minCompleted: totalMinFor(completed),
      minWatchlist: totalMinFor(watchlist),
      minTotal: totalMinFor(this.series),
    };
  }
}
