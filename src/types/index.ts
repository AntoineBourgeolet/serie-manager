export type SeriesStatus = 'watchlist' | 'watching' | 'completed';

export interface SeasonData {
  season_number: number;
  episode_count: number;
  name: string;
}

export type WatchedEpisodes = Record<string, number[]>;

export interface Series {
  id: string;
  tmdbId: number | null;
  name: string;
  status: SeriesStatus;
  rating: number | null;
  season: number;
  totalSeasons: number | null;
  year: string;
  poster: string;
  overview: string;
  episodesTotal: number | null;
  episodeRuntime: number | null;
  viewingDate: string;
  seasonsData: SeasonData[];
  watchedEpisodes: WatchedEpisodes;
}

export interface TmdbSearchResult {
  id: number;
  name: string;
  first_air_date: string;
  poster_path: string | null;
  overview: string;
}

export interface TmdbSeriesDetails {
  id: number;
  name: string;
  number_of_seasons: number;
  number_of_episodes: number;
  episode_run_time: number[];
  seasons: TmdbSeason[];
}

export interface TmdbSeason {
  season_number: number;
  episode_count: number;
  name: string;
}

export interface AppStats {
  total: number;
  countWatching: number;
  countCompleted: number;
  countWatchlist: number;
  epWatching: number;
  epCompleted: number;
  epWatchlist: number;
  epTotal: number;
  minWatching: number;
  minCompleted: number;
  minWatchlist: number;
  minTotal: number;
}
