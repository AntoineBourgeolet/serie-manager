import { describe, it, expect } from 'vitest';
import Papa from 'papaparse';
import { generateCSV, importCSV } from '../utils/csv';
import type { Series } from '../types';

function makeSeries(overrides: Partial<Series> = {}): Series {
  return {
    id: 'test-id-1',
    tmdbId: 12345,
    name: 'Breaking Bad',
    status: 'watching',
    rating: 9.5,
    season: 3,
    totalSeasons: 5,
    year: '2008',
    poster: '/poster.jpg',
    overview: 'A chemistry teacher...',
    episodesTotal: 62,
    episodeRuntime: 47,
    viewingDate: '2024-01-15',
    seasonsData: [{ season_number: 1, episode_count: 7, name: 'Season 1' }],
    watchedEpisodes: { '1': [1, 2, 3] },
    ...overrides,
  };
}

describe('generateCSV', () => {
  it('produces a CSV string with header row', () => {
    const csv = generateCSV([makeSeries()]);
    expect(typeof csv).toBe('string');
    expect(csv).toContain('name');
    expect(csv).toContain('status');
    expect(csv).toContain('Breaking Bad');
  });

  it('serializes seasonsData and watchedEpisodes as JSON strings', () => {
    const s = makeSeries();
    const csv = generateCSV([s]);
    // CSV escapes double-quotes as "", so parse first then check
    const parsed = Papa.parse<Record<string, string>>(csv, { header: true });
    const row = parsed.data[0];
    expect(JSON.parse(row['seasonsData'] ?? '')).toEqual(s.seasonsData);
    expect(JSON.parse(row['watchedEpisodes'] ?? '')).toEqual(s.watchedEpisodes);
  });

  it('serializes notes, isFavourite, tags, genres, and watchHistory', () => {
    const s = makeSeries({
      notes: 'Great show',
      isFavourite: true,
      tags: ['drama', 'favourite'],
      genres: ['Crime', 'Drama'],
      watchHistory: [{ season: 1, episode: 1, watchedAt: '2024-01-01' }],
    });
    const csv = generateCSV([s]);
    const parsed = Papa.parse<Record<string, string>>(csv, { header: true });
    const row = parsed.data[0];
    expect(row['notes']).toBe('Great show');
    expect(row['isFavourite']).toBe('true');
    expect(JSON.parse(row['tags'] ?? '')).toEqual(['drama', 'favourite']);
    expect(JSON.parse(row['genres'] ?? '')).toEqual(['Crime', 'Drama']);
    expect(JSON.parse(row['watchHistory'] ?? '')).toEqual([{ season: 1, episode: 1, watchedAt: '2024-01-01' }]);
  });

  it('handles empty list', () => {
    const csv = generateCSV([]);
    const parsed = Papa.parse<Record<string, string>>(csv, { header: true, skipEmptyLines: true });
    expect(parsed.data).toHaveLength(0);
  });

  it('produces parseable output', () => {
    const series = [makeSeries()];
    const csv = generateCSV(series);
    const parsed = Papa.parse<Record<string, string>>(csv, { header: true });
    expect(parsed.data[0]['name']).toBe('Breaking Bad');
    expect(parsed.data[0]['status']).toBe('watching');
    expect(parsed.data[0]['rating']).toBe('9.5');
    expect(parsed.data[0]['year']).toBe('2008');
  });
});

describe('importCSV round-trip', () => {
  it('imports a valid CSV and restores series data', async () => {
    const original = [makeSeries()];
    const csv = generateCSV(original);
    const file = new File([csv], 'test.csv', { type: 'text/csv' });

    const result = await new Promise<Series[]>((resolve, reject) => {
      importCSV(file, resolve, (msg) => reject(new Error(msg)));
    });

    expect(result).toHaveLength(1);
    expect(result[0].name).toBe('Breaking Bad');
    expect(result[0].status).toBe('watching');
    expect(result[0].rating).toBe(9.5);
    expect(result[0].year).toBe('2008');
    expect(result[0].episodesTotal).toBe(62);
    expect(result[0].episodeRuntime).toBe(47);
    expect(result[0].seasonsData).toEqual(original[0].seasonsData);
    expect(result[0].watchedEpisodes).toEqual(original[0].watchedEpisodes);
  });

  it('round-trips new fields: notes, isFavourite, tags, genres, watchHistory', async () => {
    const original = [makeSeries({
      notes: 'Amazing series',
      isFavourite: true,
      tags: ['sci-fi', 'rewatch'],
      genres: ['Drama'],
      watchHistory: [{ season: 1, episode: 2, watchedAt: '2024-06-01' }],
    })];
    const csv = generateCSV(original);
    const file = new File([csv], 'test.csv', { type: 'text/csv' });

    const result = await new Promise<Series[]>((resolve, reject) => {
      importCSV(file, resolve, (msg) => reject(new Error(msg)));
    });

    expect(result[0].notes).toBe('Amazing series');
    expect(result[0].isFavourite).toBe(true);
    expect(result[0].tags).toEqual(['sci-fi', 'rewatch']);
    expect(result[0].genres).toEqual(['Drama']);
    expect(result[0].watchHistory).toEqual([{ season: 1, episode: 2, watchedAt: '2024-06-01' }]);
  });

  it('falls back to watchlist for invalid status', async () => {
    const csv = 'id,name,status\ntest-1,My Show,invalid_status';
    const file = new File([csv], 'test.csv', { type: 'text/csv' });

    const result = await new Promise<Series[]>((resolve, reject) => {
      importCSV(file, resolve, (msg) => reject(new Error(msg)));
    });

    expect(result[0].status).toBe('watchlist');
  });

  it('calls onError for empty CSV', async () => {
    const file = new File([''], 'empty.csv', { type: 'text/csv' });

    const msg = await new Promise<string>((resolve) => {
      importCSV(file, () => resolve(''), resolve);
    });

    expect(msg).toBe('Fichier CSV vide ou invalide.');
  });

  it('handles null rating correctly', async () => {
    const csv = 'id,name,status,rating\ntest-1,My Show,watchlist,';
    const file = new File([csv], 'test.csv', { type: 'text/csv' });

    const result = await new Promise<Series[]>((resolve, reject) => {
      importCSV(file, resolve, (msg) => reject(new Error(msg)));
    });

    expect(result[0].rating).toBeNull();
  });
});
