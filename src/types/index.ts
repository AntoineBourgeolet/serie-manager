export type SeriesStatus = 'watchlist' | 'watching' | 'completed';

export interface SeasonData {
  season_number: number;
  episode_count: number;
  name: string;
}

export type WatchedEpisodes = Record<string, number[]>;

export interface WatchHistoryEntry {
  season: number;
  episode: number;
  watchedAt: string; // ISO date (YYYY-MM-DD)
  type?: 'episode' | 'season' | 'series';
  seasonLabel?: string;
  episodeCount?: number;
}

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
  // New fields (all optional for backward-compatibility)
  notes?: string;
  isFavourite?: boolean;
  tags?: string[];
  genres?: string[];
  watchHistory?: WatchHistoryEntry[];
  // TMDB enrichment fields
  network?: string;
  originCountry?: string;
  originalLanguage?: string;
  tmdbRating?: number;
  productionStatus?: string;
  createdBy?: string;
}

export interface TmdbSearchResult {
  id: number;
  name: string;
  first_air_date: string;
  poster_path: string | null;
  overview: string;
}

export interface TmdbGenre {
  id: number;
  name: string;
}

export interface TmdbNetwork {
  id: number;
  name: string;
}

export interface TmdbCreator {
  id: number;
  name: string;
}

export interface TmdbSeriesDetails {
  id: number;
  name: string;
  number_of_seasons: number;
  number_of_episodes: number;
  episode_run_time: number[];
  seasons: TmdbSeason[];
  genres?: TmdbGenre[];
  networks?: TmdbNetwork[];
  original_language?: string;
  origin_country?: string[];
  vote_average?: number;
  status?: string;
  created_by?: TmdbCreator[];
  first_air_date?: string;
  last_air_date?: string;
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
