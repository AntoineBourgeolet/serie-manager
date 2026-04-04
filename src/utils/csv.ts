import Papa from 'papaparse';
import type { Series, SeriesStatus } from '../types';
import { generateId, tryParseJSON } from './formatting';
import { isValidStatus } from './validation';

const CSV_FIELDS: (keyof Series)[] = [
  'id',
  'tmdbId',
  'name',
  'status',
  'rating',
  'season',
  'totalSeasons',
  'year',
  'poster',
  'overview',
  'episodesTotal',
  'episodeRuntime',
  'viewingDate',
  'seasonsData',
  'watchedEpisodes',
  'notes',
  'isFavourite',
  'tags',
  'genres',
  'watchHistory',
];

export function generateCSV(seriesList: Series[]): string {
  return Papa.unparse({
    fields: CSV_FIELDS as string[],
    data: seriesList.map((s) =>
      CSV_FIELDS.map((f) => {
        if (
          f === 'seasonsData' ||
          f === 'watchedEpisodes' ||
          f === 'tags' ||
          f === 'genres' ||
          f === 'watchHistory'
        ) {
          return s[f] ? JSON.stringify(s[f]) : '';
        }
        const val = s[f];
        return val != null ? String(val) : '';
      })
    ),
  });
}

export function exportToCSV(seriesList: Series[]): void {
  const csv = generateCSV(seriesList);
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'series_tracker.csv';
  a.click();
  URL.revokeObjectURL(url);
}

export function importCSV(
  file: File,
  onSuccess: (series: Series[]) => void,
  onError: (msg: string) => void
): void {
  Papa.parse<Record<string, string>>(file, {
    header: true,
    skipEmptyLines: true,
    complete: ({ data }) => {
      if (!data.length) {
        onError('Fichier CSV vide ou invalide.');
        return;
      }
      const series: Series[] = data.map((row) => {
        const statusRaw = row['status'] ?? '';
        const status: SeriesStatus = isValidStatus(statusRaw) ? statusRaw : 'watchlist';
        const ratingRaw = row['rating'];
        const rating =
          ratingRaw !== '' && ratingRaw != null && ratingRaw !== undefined
            ? Number(ratingRaw)
            : null;
        return {
          id: row['id'] || generateId(),
          tmdbId: row['tmdbId'] ? Number(row['tmdbId']) : null,
          name: row['name'] || '',
          status,
          rating,
          season: row['season'] ? Number(row['season']) : 1,
          totalSeasons: row['totalSeasons'] ? Number(row['totalSeasons']) : null,
          year: row['year'] || '',
          poster: row['poster'] || '',
          overview: row['overview'] || '',
          episodesTotal: row['episodesTotal'] ? Number(row['episodesTotal']) : null,
          episodeRuntime: row['episodeRuntime'] ? Number(row['episodeRuntime']) : null,
          viewingDate: row['viewingDate'] || '',
          seasonsData: row['seasonsData'] ? tryParseJSON(row['seasonsData'], []) : [],
          watchedEpisodes: row['watchedEpisodes']
            ? tryParseJSON(row['watchedEpisodes'], {})
            : {},
          notes: row['notes'] || undefined,
          isFavourite: row['isFavourite'] === 'true' ? true : undefined,
          tags: row['tags'] ? tryParseJSON<string[]>(row['tags'], []) : undefined,
          genres: row['genres'] ? tryParseJSON<string[]>(row['genres'], []) : undefined,
          watchHistory: row['watchHistory']
            ? tryParseJSON(row['watchHistory'], [])
            : undefined,
        };
      });
      onSuccess(series);
    },
    error: () => onError('Erreur lors de la lecture du CSV.'),
  });
}
