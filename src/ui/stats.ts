import { createIcons, icons } from 'lucide';
import type { SeriesStore } from '../store/seriesStore';
import { formatTime } from '../utils/formatting';

export function statCard(
  icon: string,
  label: string,
  value: string | number,
  color: string
): string {
  const cls: Record<string, string> = {
    indigo: 'bg-indigo-500/10 text-indigo-400',
    blue: 'bg-blue-500/10 text-blue-400',
    green: 'bg-green-500/10 text-green-400',
    yellow: 'bg-yellow-500/10 text-yellow-400',
  };
  return `<div class="bg-surface-card border border-surface-border rounded-xl p-3 flex items-center gap-3">
    <div class="w-8 h-8 rounded-lg ${cls[color] || ''} flex items-center justify-center shrink-0"><i data-lucide="${icon}" class="w-4 h-4"></i></div>
    <div class="min-w-0"><p class="text-xs text-zinc-500 uppercase tracking-wider truncate">${label}</p><p class="text-xl font-bold">${value}</p></div>
  </div>`;
}

export function renderStats(store: SeriesStore): void {
  const s = store.computeStats();
  const el = document.getElementById('stats-banner');
  if (!el) return;
  el.innerHTML = `
    <div class="grid grid-cols-2 sm:grid-cols-4 gap-3">
      ${statCard('tv-2', 'Total séries', s.total, 'indigo')}
      ${statCard('play-circle', 'En cours', s.countWatching, 'blue')}
      ${statCard('check-circle-2', 'Terminées', s.countCompleted, 'green')}
      ${statCard('bookmark', 'Watchlist', s.countWatchlist, 'yellow')}
    </div>
    <div class="grid grid-cols-2 sm:grid-cols-4 gap-3">
      ${statCard('film', 'Épisodes en cours', s.epWatching || '–', 'blue')}
      ${statCard('film', 'Épisodes terminés', s.epCompleted || '–', 'green')}
      ${statCard('film', 'Épisodes à voir', s.epWatchlist || '–', 'yellow')}
      ${statCard('film', 'Épisodes total', s.epTotal || '–', 'indigo')}
    </div>
    <div class="grid grid-cols-2 sm:grid-cols-4 gap-3">
      ${statCard('clock', 'Temps en cours', formatTime(s.minWatching), 'blue')}
      ${statCard('clock', 'Temps terminé', formatTime(s.minCompleted), 'green')}
      ${statCard('clock', 'Temps à voir', formatTime(s.minWatchlist), 'yellow')}
      ${statCard('clock', 'Temps total', formatTime(s.minTotal), 'indigo')}
    </div>`;
  createIcons({ icons, attrs: { 'stroke-width': '1.5' } });
}
