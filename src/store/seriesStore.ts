import type { Series, SeriesStatus, AppStats } from '../types';
import { LS_KEY } from '../config/constants';
import { dbGetAll, dbPutAll, isIndexedDBAvailable } from './db';

export type SortOption = 'name-asc' | 'name-desc' | 'rating-desc' | 'rating-asc' | 'recent';
export type FilterOption = SeriesStatus | 'all' | 'favourites';

export class SeriesStore {
  private series: Series[] = [];
  private subscribers: Array<() => void> = [];
  private _hadLoadError = false;

  subscribe(fn: () => void): () => void {
    this.subscribers.push(fn);
    return () => {
      this.subscribers = this.subscribers.filter((s) => s !== fn);
    };
  }

  private notify(): void {
    this.subscribers.forEach((fn) => fn());
  }

  hadLoadError(): boolean {
    return this._hadLoadError;
  }

  hasLocalStorageData(): boolean {
    return !!localStorage.getItem(LS_KEY);
  }

  load(): void {
    this._hadLoadError = false;
    try {
      const raw = localStorage.getItem(LS_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as Series[];
        if (!Array.isArray(parsed)) throw new Error('Invalid data shape');
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
      this._hadLoadError = true;
    }
  }

  save(): void {
    try {
      localStorage.setItem(LS_KEY, JSON.stringify(this.series));
    } catch {
      // handled by caller via toast
    }
    if (isIndexedDBAvailable()) {
      dbPutAll(this.series).catch(() => {});
    }
  }

  async initFromDB(): Promise<boolean> {
    if (!isIndexedDBAvailable()) return false;
    try {
      const items = await dbGetAll<Series>();
      if (items.length > 0) {
        this.series = items.map((s) => ({
          ...s,
          seasonsData: s.seasonsData?.length ? s.seasonsData : [],
          watchedEpisodes:
            s.watchedEpisodes && Object.keys(s.watchedEpisodes).length
              ? s.watchedEpisodes
              : {},
        }));
        this._hadLoadError = false;
        this.notify();
        return true;
      }
    } catch {
      // Fall back silently
    }
    return false;
  }

  async migrateToIDB(): Promise<void> {
    if (!isIndexedDBAvailable()) return;
    await dbPutAll(this.series);
  }

  getAll(): Series[] {
    return this.series;
  }

  getFiltered(filter: FilterOption, query: string, sort: SortOption = 'recent'): Series[] {
    const filtered = this.series.filter((s) => {
      let matchFilter: boolean;
      if (filter === 'all') {
        matchFilter = true;
      } else if (filter === 'favourites') {
        matchFilter = !!s.isFavourite;
      } else {
        matchFilter = s.status === filter;
      }
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
          const ra = a.rating ?? Infinity;
          const rb = b.rating ?? Infinity;
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

  /** Returns true if a series with a similar name already exists (case-insensitive, trimmed). */
  hasSimilarName(name: string): boolean {
    const normalised = name.trim().toLowerCase();
    return this.series.some((s) => s.name.trim().toLowerCase() === normalised);
  }

  computeStats(): AppStats {
    const byStatus = (st: SeriesStatus) => this.series.filter((s) => s.status === st);
    const watching = byStatus('watching');
    const completed = byStatus('completed');
    const watchlist = byStatus('watchlist');
    const abandoned = byStatus('abandoned');
    const onHold = byStatus('on-hold');
    const waitingPlatform = byStatus('waiting-platform');
    const totalEpFor = (list: Series[]) => list.reduce((a, s) => a + (s.episodesTotal || 0), 0);
    const totalMinFor = (list: Series[]) =>
      list.reduce((a, s) => a + (s.episodesTotal || 0) * (s.episodeRuntime || 0), 0);
    return {
      total: this.series.length,
      countWatching: watching.length,
      countCompleted: completed.length,
      countWatchlist: watchlist.length,
      countAbandoned: abandoned.length,
      countOnHold: onHold.length,
      countWaitingPlatform: waitingPlatform.length,
      epWatching: totalEpFor(watching),
      epCompleted: totalEpFor(completed),
      epWatchlist: totalEpFor(watchlist),
      epAbandoned: totalEpFor(abandoned),
      epOnHold: totalEpFor(onHold),
      epWaitingPlatform: totalEpFor(waitingPlatform),
      epTotal: totalEpFor(this.series),
      minWatching: totalMinFor(watching),
      minCompleted: totalMinFor(completed),
      minWatchlist: totalMinFor(watchlist),
      minAbandoned: totalMinFor(abandoned),
      minOnHold: totalMinFor(onHold),
      minWaitingPlatform: totalMinFor(waitingPlatform),
      minTotal: totalMinFor(this.series),
    };
  }
}
