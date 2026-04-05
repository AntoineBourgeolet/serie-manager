import { describe, it, expect, beforeEach, vi } from 'vitest';
import { SeriesStore } from '../store/seriesStore';
import type { Series } from '../types';

function makeSeries(overrides: Partial<Series> = {}): Series {
  return {
    id: 'test-id-1',
    tmdbId: 12345,
    name: 'Breaking Bad',
    status: 'watching',
    rating: 9.5,
    season: 1,
    totalSeasons: 5,
    year: '2008',
    poster: '/poster.jpg',
    overview: 'A chemistry teacher...',
    episodesTotal: 62,
    episodeRuntime: 47,
    viewingDate: '2024-01-15',
    seasonsData: [],
    watchedEpisodes: {},
    ...overrides,
  };
}

describe('SeriesStore', () => {
  let store: SeriesStore;

  beforeEach(() => {
    localStorage.clear();
    store = new SeriesStore();
  });

  describe('load / save', () => {
    it('loads an empty list when localStorage is empty', () => {
      store.load();
      expect(store.getAll()).toEqual([]);
    });

    it('saves and reloads series from localStorage', () => {
      const s = makeSeries();
      store.add(s);

      const store2 = new SeriesStore();
      store2.load();
      expect(store2.getAll()).toHaveLength(1);
      expect(store2.getAll()[0].name).toBe('Breaking Bad');
    });

    it('handles corrupt localStorage data gracefully', () => {
      localStorage.setItem('series_tracker_data', 'not-json{{{');
      store.load();
      expect(store.getAll()).toEqual([]);
    });

    it('merges defaults for seasonsData and watchedEpisodes on load', () => {
      const raw = JSON.stringify([{ id: '1', name: 'Test', status: 'watchlist' }]);
      localStorage.setItem('series_tracker_data', raw);
      store.load();
      const s = store.getAll()[0];
      expect(s.seasonsData).toEqual([]);
      expect(s.watchedEpisodes).toEqual({});
    });
  });

  describe('add', () => {
    it('adds a series', () => {
      store.add(makeSeries());
      expect(store.getAll()).toHaveLength(1);
    });

    it('notifies subscribers', () => {
      const fn = vi.fn();
      store.subscribe(fn);
      store.add(makeSeries());
      expect(fn).toHaveBeenCalledOnce();
    });
  });

  describe('update', () => {
    it('updates an existing series', () => {
      store.add(makeSeries({ id: 'abc' }));
      store.update('abc', { name: 'Better Call Saul' });
      expect(store.getAll()[0].name).toBe('Better Call Saul');
    });

    it('does nothing for unknown id', () => {
      store.add(makeSeries({ id: 'abc' }));
      store.update('unknown', { name: 'Other' });
      expect(store.getAll()[0].name).toBe('Breaking Bad');
    });

    it('patches a single watchHistory entry without touching others', () => {
      const s = makeSeries({
        id: 'wh-test',
        watchHistory: [
          { season: 1, episode: 1, watchedAt: '2024-01-01', type: 'episode' },
          { season: 1, episode: 2, watchedAt: '2024-01-02', type: 'episode' },
        ],
      });
      store.add(s);
      const history = [...(store.getAll()[0].watchHistory ?? [])];
      history[0] = { ...history[0], watchedAt: '2024-03-15' };
      store.update('wh-test', { watchHistory: history });
      const updated = store.getAll()[0];
      expect(updated.watchHistory?.[0].watchedAt).toBe('2024-03-15');
      expect(updated.watchHistory?.[1].watchedAt).toBe('2024-01-02');
    });
  });

  describe('remove', () => {
    it('removes a series by id', () => {
      store.add(makeSeries({ id: 'abc' }));
      store.remove('abc');
      expect(store.getAll()).toHaveLength(0);
    });

    it('notifies subscribers on remove', () => {
      const fn = vi.fn();
      store.add(makeSeries({ id: 'abc' }));
      store.subscribe(fn);
      store.remove('abc');
      expect(fn).toHaveBeenCalledOnce();
    });
  });

  describe('has', () => {
    it('returns true if tmdbId exists', () => {
      store.add(makeSeries({ tmdbId: 999 }));
      expect(store.has(999)).toBe(true);
    });

    it('returns false if tmdbId does not exist', () => {
      expect(store.has(999)).toBe(false);
    });
  });

  describe('hasSimilarName', () => {
    it('returns true for exact match', () => {
      store.add(makeSeries({ name: 'Breaking Bad' }));
      expect(store.hasSimilarName('Breaking Bad')).toBe(true);
    });

    it('is case-insensitive', () => {
      store.add(makeSeries({ name: 'Breaking Bad' }));
      expect(store.hasSimilarName('breaking bad')).toBe(true);
      expect(store.hasSimilarName('BREAKING BAD')).toBe(true);
    });

    it('ignores leading/trailing whitespace', () => {
      store.add(makeSeries({ name: 'Breaking Bad' }));
      expect(store.hasSimilarName('  Breaking Bad  ')).toBe(true);
    });

    it('returns false when no match', () => {
      store.add(makeSeries({ name: 'Breaking Bad' }));
      expect(store.hasSimilarName('Ozark')).toBe(false);
    });
  });

  describe('hadLoadError', () => {
    it('returns false when data loads normally', () => {
      store.load();
      expect(store.hadLoadError()).toBe(false);
    });

    it('returns true when localStorage data is corrupt', () => {
      localStorage.setItem('series_tracker_data', 'not-json{{{');
      store.load();
      expect(store.hadLoadError()).toBe(true);
    });
  });

  describe('getFiltered (favourites)', () => {
    beforeEach(() => {
      store.add(makeSeries({ id: '1', name: 'Breaking Bad', status: 'watching', isFavourite: true }));
      store.add(makeSeries({ id: '2', name: 'Better Call Saul', status: 'completed' }));
      store.add(makeSeries({ id: '3', name: 'Ozark', status: 'watchlist', isFavourite: true }));
    });

    it('returns only favourites with filter "favourites"', () => {
      expect(store.getFiltered('favourites', '')).toHaveLength(2);
    });

    it('combines favourites filter with search', () => {
      expect(store.getFiltered('favourites', 'breaking')).toHaveLength(1);
      expect(store.getFiltered('favourites', 'xyz')).toHaveLength(0);
    });
  });

  describe('getFiltered', () => {
    beforeEach(() => {
      store.add(makeSeries({ id: '1', name: 'Breaking Bad', status: 'watching' }));
      store.add(makeSeries({ id: '2', name: 'Better Call Saul', status: 'completed' }));
      store.add(makeSeries({ id: '3', name: 'Ozark', status: 'watchlist' }));
    });

    it('returns all with filter "all"', () => {
      expect(store.getFiltered('all', '')).toHaveLength(3);
    });

    it('filters by status', () => {
      expect(store.getFiltered('watching', '')).toHaveLength(1);
      expect(store.getFiltered('completed', '')).toHaveLength(1);
      expect(store.getFiltered('watchlist', '')).toHaveLength(1);
    });

    it('filters by search query (case-insensitive)', () => {
      expect(store.getFiltered('all', 'breaking')).toHaveLength(1);
      expect(store.getFiltered('all', 'BREAKING')).toHaveLength(1);
      expect(store.getFiltered('all', 'saul')).toHaveLength(1);
      expect(store.getFiltered('all', 'xyz')).toHaveLength(0);
    });

    it('combines status and search filters', () => {
      expect(store.getFiltered('watching', 'breaking')).toHaveLength(1);
      expect(store.getFiltered('completed', 'breaking')).toHaveLength(0);
    });
  });

  describe('computeStats', () => {
    it('returns zeros for empty store', () => {
      const stats = store.computeStats();
      expect(stats.total).toBe(0);
      expect(stats.countWatching).toBe(0);
      expect(stats.countCompleted).toBe(0);
      expect(stats.countWatchlist).toBe(0);
      expect(stats.countAbandoned).toBe(0);
      expect(stats.countOnHold).toBe(0);
      expect(stats.countWaitingPlatform).toBe(0);
      expect(stats.epTotal).toBe(0);
      expect(stats.minTotal).toBe(0);
    });

    it('computes correct counts per status', () => {
      store.add(makeSeries({ id: '1', status: 'watching', episodesTotal: 62, episodeRuntime: 47 }));
      store.add(makeSeries({ id: '2', status: 'completed', episodesTotal: 10, episodeRuntime: 30 }));
      store.add(makeSeries({ id: '3', status: 'watchlist', episodesTotal: 20, episodeRuntime: 45 }));

      const stats = store.computeStats();
      expect(stats.total).toBe(3);
      expect(stats.countWatching).toBe(1);
      expect(stats.countCompleted).toBe(1);
      expect(stats.countWatchlist).toBe(1);
      expect(stats.epWatching).toBe(62);
      expect(stats.epCompleted).toBe(10);
      expect(stats.epWatchlist).toBe(20);
      expect(stats.epTotal).toBe(92);
      expect(stats.minWatching).toBe(62 * 47);
      expect(stats.minCompleted).toBe(10 * 30);
      expect(stats.minWatchlist).toBe(20 * 45);
      expect(stats.minTotal).toBe(62 * 47 + 10 * 30 + 20 * 45);
    });

    it('counts new statuses correctly', () => {
      store.add(makeSeries({ id: '1', status: 'abandoned', episodesTotal: 10, episodeRuntime: 20 }));
      store.add(makeSeries({ id: '2', status: 'on-hold', episodesTotal: 5, episodeRuntime: 30 }));
      store.add(makeSeries({ id: '3', status: 'waiting-platform', episodesTotal: 20, episodeRuntime: 40 }));

      const stats = store.computeStats();
      expect(stats.countAbandoned).toBe(1);
      expect(stats.countOnHold).toBe(1);
      expect(stats.countWaitingPlatform).toBe(1);
      expect(stats.epAbandoned).toBe(10);
      expect(stats.epOnHold).toBe(5);
      expect(stats.epWaitingPlatform).toBe(20);
      expect(stats.minAbandoned).toBe(10 * 20);
      expect(stats.minOnHold).toBe(5 * 30);
      expect(stats.minWaitingPlatform).toBe(20 * 40);
    });
  });

  describe('getFiltered with new statuses', () => {
    beforeEach(() => {
      store.add(makeSeries({ id: '1', name: 'Abandoned Show', status: 'abandoned' }));
      store.add(makeSeries({ id: '2', name: 'On Hold Show', status: 'on-hold' }));
      store.add(makeSeries({ id: '3', name: 'Waiting Platform Show', status: 'waiting-platform' }));
    });

    it('filters by abandoned status', () => {
      expect(store.getFiltered('abandoned', '')).toHaveLength(1);
      expect(store.getFiltered('on-hold', '')).toHaveLength(1);
      expect(store.getFiltered('waiting-platform', '')).toHaveLength(1);
    });

    it('includes new statuses in "all" filter', () => {
      expect(store.getFiltered('all', '')).toHaveLength(3);
    });
  });

  describe('subscribe / unsubscribe', () => {
    it('unsubscribes correctly', () => {
      const fn = vi.fn();
      const unsub = store.subscribe(fn);
      unsub();
      store.add(makeSeries());
      expect(fn).not.toHaveBeenCalled();
    });
  });
});
