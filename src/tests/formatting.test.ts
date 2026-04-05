import { describe, it, expect } from 'vitest';
import {
  generateId,
  todayISO,
  daysAgoISO,
  lastUsedWatchDate,
  statusLabel,
  statusColor,
  nextStatus,
  formatTime,
  tryParseJSON,
} from '../utils/formatting';
import type { Series } from '../types';

describe('generateId', () => {
  it('returns a non-empty string', () => {
    const id = generateId();
    expect(typeof id).toBe('string');
    expect(id.length).toBeGreaterThan(0);
  });

  it('returns unique values', () => {
    const ids = new Set(Array.from({ length: 100 }, () => generateId()));
    expect(ids.size).toBe(100);
  });
});

describe('todayISO', () => {
  it('returns a valid ISO date string (YYYY-MM-DD)', () => {
    const today = todayISO();
    expect(today).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(new Date(today).toString()).not.toBe('Invalid Date');
  });
});

describe('statusLabel', () => {
  it('returns correct French labels', () => {
    expect(statusLabel('watching')).toBe('En cours');
    expect(statusLabel('completed')).toBe('Terminé');
    expect(statusLabel('watchlist')).toBe('Watchlist');
  });
});

describe('statusColor', () => {
  it('returns CSS class strings for each status', () => {
    expect(statusColor('watching')).toContain('blue');
    expect(statusColor('completed')).toContain('green');
    expect(statusColor('watchlist')).toContain('yellow');
  });
});

describe('nextStatus', () => {
  it('cycles through statuses in order', () => {
    expect(nextStatus('watchlist')).toBe('watching');
    expect(nextStatus('watching')).toBe('completed');
    expect(nextStatus('completed')).toBe('watchlist');
  });

  it('maps new statuses back to watchlist or watching', () => {
    expect(nextStatus('abandoned')).toBe('watchlist');
    expect(nextStatus('on-hold')).toBe('watching');
    expect(nextStatus('waiting-platform')).toBe('watchlist');
  });
});

describe('formatTime', () => {
  it('returns "–" for zero or negative values', () => {
    expect(formatTime(0)).toBe('–');
    expect(formatTime(-10)).toBe('–');
  });

  it('formats hours correctly', () => {
    expect(formatTime(120)).toBe('2h');
    expect(formatTime(90)).toBe('1h');
  });

  it('formats days correctly', () => {
    expect(formatTime(24 * 60)).toBe('1j 0h');
    expect(formatTime(48 * 60 + 30)).toBe('2j 0h');
  });

  it('formats months correctly', () => {
    // 30 days = 720h, 30.44 days per month -> 0 months... let's use 35 days
    const mins35Days = 35 * 24 * 60;
    const result = formatTime(mins35Days);
    expect(result).toContain('mois');
  });

  it('formats years correctly', () => {
    const mins400Days = 400 * 24 * 60;
    const result = formatTime(mins400Days);
    expect(result).toContain('an');
  });
});

describe('tryParseJSON', () => {
  it('parses valid JSON', () => {
    expect(tryParseJSON('{"a":1}', {})).toEqual({ a: 1 });
    expect(tryParseJSON('[1,2,3]', [])).toEqual([1, 2, 3]);
  });

  it('returns fallback for invalid JSON', () => {
    expect(tryParseJSON('not-json', [])).toEqual([]);
    expect(tryParseJSON('', { default: true })).toEqual({ default: true });
  });
});

describe('daysAgoISO', () => {
  it('returns a valid ISO date string (YYYY-MM-DD)', () => {
    const result = daysAgoISO(3);
    expect(result).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(new Date(result).toString()).not.toBe('Invalid Date');
  });

  it('returns today when n is 0', () => {
    expect(daysAgoISO(0)).toBe(todayISO());
  });

  it('returns a date strictly before today when n > 0', () => {
    expect(daysAgoISO(1) < todayISO()).toBe(true);
    expect(daysAgoISO(7) < daysAgoISO(1)).toBe(true);
  });
});

function makeMinimalSeries(overrides: Partial<Series> = {}): Series {
  return {
    id: 'test-id',
    tmdbId: null,
    name: 'Test',
    status: 'watching',
    rating: null,
    season: 1,
    totalSeasons: null,
    year: '2020',
    poster: '',
    overview: '',
    episodesTotal: null,
    episodeRuntime: null,
    viewingDate: '2024-01-01',
    seasonsData: [],
    watchedEpisodes: {},
    ...overrides,
  };
}

describe('lastUsedWatchDate', () => {
  it('returns today when series has no watchHistory', () => {
    const s = makeMinimalSeries();
    expect(lastUsedWatchDate(s)).toBe(todayISO());
  });

  it('returns today when watchHistory is empty', () => {
    const s = makeMinimalSeries({ watchHistory: [] });
    expect(lastUsedWatchDate(s)).toBe(todayISO());
  });

  it('returns the most recent watchedAt date from watchHistory', () => {
    const s = makeMinimalSeries({
      watchHistory: [
        { season: 1, episode: 1, watchedAt: '2024-03-01', type: 'episode' },
        { season: 1, episode: 2, watchedAt: '2024-05-10', type: 'episode' },
        { season: 1, episode: 3, watchedAt: '2024-04-15', type: 'episode' },
      ],
    });
    expect(lastUsedWatchDate(s)).toBe('2024-05-10');
  });

  it('returns the only entry date when watchHistory has one entry', () => {
    const s = makeMinimalSeries({
      watchHistory: [{ season: 1, episode: 1, watchedAt: '2023-12-25' }],
    });
    expect(lastUsedWatchDate(s)).toBe('2023-12-25');
  });
});
