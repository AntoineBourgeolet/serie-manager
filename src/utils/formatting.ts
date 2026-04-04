import type { SeriesStatus } from '../types';
import { AVG_DAYS_PER_MONTH } from '../config/constants';

export function generateId(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID();
  return (
    Date.now().toString(36) +
    Math.random().toString(36).slice(2) +
    Math.random().toString(36).slice(2)
  );
}

export function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

export function statusLabel(s: SeriesStatus): string {
  return (
    {
      watching: 'En cours',
      completed: 'Terminé',
      watchlist: 'Watchlist',
      abandoned: 'Abandonné',
      'on-hold': 'En pause',
      'waiting-platform': 'En attente',
    }[s] || s
  );
}

export function statusColor(s: SeriesStatus): string {
  return (
    {
      watching: 'bg-blue-500/20   text-blue-400   border border-blue-500/30',
      completed: 'bg-green-500/20  text-green-400  border border-green-500/30',
      watchlist: 'bg-yellow-500/20 text-yellow-400 border border-yellow-500/30',
      abandoned: 'bg-red-500/20    text-red-400    border border-red-500/30',
      'on-hold': 'bg-orange-500/20 text-orange-400 border border-orange-500/30',
      'waiting-platform': 'bg-purple-500/20 text-purple-400 border border-purple-500/30',
    }[s] || ''
  );
}

export function nextStatus(s: SeriesStatus): SeriesStatus {
  return (
    ({
      watchlist: 'watching',
      watching: 'completed',
      completed: 'watchlist',
      abandoned: 'watchlist',
      'on-hold': 'watching',
      'waiting-platform': 'watchlist',
    } as Record<SeriesStatus, SeriesStatus>)[s] || 'watchlist'
  );
}

export function formatTime(totalMinutes: number): string {
  if (!totalMinutes || totalMinutes <= 0) return '–';
  const h = Math.floor(totalMinutes / 60);
  if (h < 24) return h + 'h';
  const d = Math.floor(h / 24);
  if (d < 30) return d + 'j ' + (h % 24) + 'h';
  const mo = Math.floor(d / AVG_DAYS_PER_MONTH);
  if (mo < 12) return mo + 'mois ' + Math.floor(d % AVG_DAYS_PER_MONTH) + 'j';
  const yr = Math.floor(mo / 12);
  return yr + 'an' + (yr > 1 ? 's' : '') + ' ' + (mo % 12) + 'mois';
}

export function tryParseJSON<T>(str: string, fallback: T): T {
  try {
    return JSON.parse(str) as T;
  } catch {
    return fallback;
  }
}
