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

function watchtimeChart(
  minWatching: number,
  minCompleted: number,
  minWatchlist: number
): string {
  const total = minWatching + minCompleted + minWatchlist;
  if (!total) return '';
  const pctW = Math.round((minWatching / total) * 100);
  const pctC = Math.round((minCompleted / total) * 100);
  const pctWl = 100 - pctW - pctC;
  return `
    <div class="bg-surface-card border border-surface-border rounded-xl p-4">
      <p class="text-xs text-zinc-500 uppercase tracking-wider mb-3">Répartition du temps de visionnage</p>
      <div class="flex h-5 rounded-full overflow-hidden gap-0.5 mb-3">
        ${pctW > 0 ? `<div class="bg-blue-500 transition-all" style="width:${pctW}%" title="En cours: ${formatTime(minWatching)}"></div>` : ''}
        ${pctC > 0 ? `<div class="bg-green-500 transition-all" style="width:${pctC}%" title="Terminées: ${formatTime(minCompleted)}"></div>` : ''}
        ${pctWl > 0 ? `<div class="bg-yellow-500 transition-all" style="width:${pctWl}%" title="Watchlist: ${formatTime(minWatchlist)}"></div>` : ''}
      </div>
      <div class="flex flex-wrap gap-4 text-xs text-zinc-400">
        <span class="flex items-center gap-1.5"><span class="w-2.5 h-2.5 rounded-sm bg-blue-500 shrink-0"></span>En cours <strong class="text-zinc-200">${formatTime(minWatching)}</strong></span>
        <span class="flex items-center gap-1.5"><span class="w-2.5 h-2.5 rounded-sm bg-green-500 shrink-0"></span>Terminées <strong class="text-zinc-200">${formatTime(minCompleted)}</strong></span>
        <span class="flex items-center gap-1.5"><span class="w-2.5 h-2.5 rounded-sm bg-yellow-500 shrink-0"></span>Watchlist <strong class="text-zinc-200">${formatTime(minWatchlist)}</strong></span>
      </div>
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
    </div>
    ${watchtimeChart(s.minWatching, s.minCompleted, s.minWatchlist)}`;
  createIcons({ icons, attrs: { 'stroke-width': '1.5' } });
}
