import { createIcons, icons } from 'lucide';
import type { SeriesStore } from '../store/seriesStore';
import type { WatchHistoryEntry } from '../types';
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

function watchHistorySection(allHistory: (WatchHistoryEntry & { seriesName: string })[]):string {
  if (!allHistory.length) return '';
  const recent = allHistory
    .slice()
    .sort((a, b) => b.watchedAt.localeCompare(a.watchedAt))
    .slice(0, 10);
  const rows = recent
    .map((h) => {
      let badge: string;
      let label: string;
      if (h.type === 'series') {
        badge = `<span class="text-xs font-mono text-green-400 bg-green-500/10 px-1.5 py-0.5 rounded border border-green-500/20 shrink-0">Série</span>`;
        label = `Série complète${h.episodeCount ? ` (${h.episodeCount} ép.)` : ''} — ${h.seriesName}`;
      } else if (h.type === 'season') {
        badge = `<span class="text-xs font-mono text-indigo-400 bg-indigo-500/10 px-1.5 py-0.5 rounded border border-indigo-500/20 shrink-0">${h.seasonLabel || `S${String(h.season).padStart(2, '0')}`}</span>`;
        label = `${h.seriesName}${h.episodeCount ? ` (${h.episodeCount} ép.)` : ''}`;
      } else {
        badge = `<span class="text-xs font-mono text-brand shrink-0">S${String(h.season).padStart(2, '0')}E${String(h.episode).padStart(2, '0')}</span>`;
        label = h.seriesName;
      }
      return `<div class="flex items-center gap-3 py-1.5 border-b border-surface-border last:border-0">
          ${badge}
          <span class="text-sm text-zinc-300 flex-1 truncate">${label}</span>
          <span class="text-xs text-zinc-500 shrink-0">${h.watchedAt}</span>
        </div>`;
    })
    .join('');
  return `
    <div class="bg-surface-card border border-surface-border rounded-xl p-4">
      <p class="text-xs text-zinc-500 uppercase tracking-wider mb-3">Derniers visionnages</p>
      <div>${rows}</div>
    </div>`;
}

function watchTrendSection(allHistory: (WatchHistoryEntry & { seriesName: string })[]): string {
  if (!allHistory.length) return '';
  // Count episodes watched per week (last 8 weeks)
  const now = new Date();
  const weeks: { label: string; count: number }[] = [];
  for (let w = 7; w >= 0; w--) {
    const weekStart = new Date(now);
    weekStart.setDate(now.getDate() - w * 7 - 6);
    const weekEnd = new Date(now);
    weekEnd.setDate(now.getDate() - w * 7);
    const startStr = weekStart.toISOString().slice(0, 10);
    const endStr = weekEnd.toISOString().slice(0, 10);
    const count = allHistory.filter((h) => h.watchedAt >= startStr && h.watchedAt <= endStr).length;
    const label = `S${8 - w}`;
    weeks.push({ label, count });
  }
  const max = Math.max(...weeks.map((w) => w.count), 1);
  const bars = weeks
    .map(
      (w) => `
        <div class="flex flex-col items-center gap-1 flex-1">
          <span class="text-xs text-zinc-500">${w.count || ''}</span>
          <div class="w-full bg-zinc-700 rounded-sm overflow-hidden" style="height:60px">
            <div class="w-full bg-brand rounded-sm transition-all" style="height:${Math.round((w.count / max) * 100)}%;margin-top:auto"></div>
          </div>
          <span class="text-xs text-zinc-600">${w.label}</span>
        </div>`
    )
    .join('');
  return `
    <div class="bg-surface-card border border-surface-border rounded-xl p-4">
      <p class="text-xs text-zinc-500 uppercase tracking-wider mb-3">Épisodes vus par semaine (8 dernières semaines)</p>
      <div class="flex items-end gap-1">${bars}</div>
    </div>`;
}

function completionStats(store: SeriesStore): string {
  const completed = store.getAll().filter((s) => s.status === 'completed');
  if (!completed.length) return '';
  const rated = completed.filter((s) => s.rating != null);
  const avgRating =
    rated.length > 0
      ? (rated.reduce((sum, s) => sum + (s.rating ?? 0), 0) / rated.length).toFixed(1)
      : null;

  const watching = store.getAll().filter((s) => s.status === 'watching');
  const totalRemaining = watching.reduce((sum, s) => {
    const watched = Object.values(s.watchedEpisodes || {}).reduce(
      (a, eps) => a + (Array.isArray(eps) ? eps.length : 0),
      0
    );
    const total = s.episodesTotal || 0;
    return sum + Math.max(0, total - watched);
  }, 0);
  const avgRuntime =
    watching.length > 0
      ? watching.reduce((sum, s) => sum + (s.episodeRuntime || 0), 0) / watching.length
      : 0;
  const remainingMin = Math.round(totalRemaining * avgRuntime);

  return `
    <div class="grid grid-cols-2 sm:grid-cols-3 gap-3">
      ${avgRating ? statCard('star', 'Note moyenne (terminées)', avgRating + '/10', 'yellow') : ''}
      ${statCard('check-circle-2', 'Séries terminées', completed.length, 'green')}
      ${remainingMin > 0 ? statCard('clock', 'Temps restant (en cours)', formatTime(remainingMin), 'blue') : ''}
    </div>`;
}

function networkStats(store: SeriesStore): string {
  const all = store.getAll();
  const networkMap: Record<string, number> = {};
  all.forEach((s) => {
    if (s.network) networkMap[s.network] = (networkMap[s.network] || 0) + 1;
  });

  const entries = Object.entries(networkMap)
    .filter(([, count]) => count >= 2)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8);

  if (!entries.length) return '';

  const chips = entries
    .map(
      ([name, count]) =>
        `<span class="inline-flex items-center gap-1.5 text-xs bg-zinc-800 text-zinc-300 px-2 py-1 rounded-lg">
          ${name} <span class="text-zinc-500">${count}</span>
        </span>`
    )
    .join('');

  return `
    <div class="bg-surface-card border border-surface-border rounded-xl p-4">
      <p class="text-xs text-zinc-500 uppercase tracking-wider mb-3">Top plateformes / networks</p>
      <div class="flex flex-wrap gap-2">${chips}</div>
    </div>`;
}

function genreStats(store: SeriesStore): string {
  const all = store.getAll();
  if (!all.length) return '';

  // Build genre → count map
  const genreMap: Record<string, number> = {};
  all.forEach((s) => {
    (s.genres || []).forEach((g) => {
      genreMap[g] = (genreMap[g] || 0) + 1;
    });
  });

  // Only show genres with at least 2 series
  const entries = Object.entries(genreMap)
    .filter(([, count]) => count >= 2)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10);

  if (!entries.length) return '';

  const max = entries[0][1];
  const bars = entries
    .map(
      ([genre, count]) => `
      <div class="flex items-center gap-2">
        <span class="text-xs text-zinc-400 w-24 truncate shrink-0">${genre}</span>
        <div class="flex-1 h-2 bg-zinc-700 rounded-full overflow-hidden">
          <div class="h-full bg-brand rounded-full transition-all" style="width:${Math.round((count / max) * 100)}%"></div>
        </div>
        <span class="text-xs text-zinc-500 w-5 text-right shrink-0">${count}</span>
      </div>`
    )
    .join('');

  return `
    <div class="bg-surface-card border border-surface-border rounded-xl p-4">
      <p class="text-xs text-zinc-500 uppercase tracking-wider mb-3">Top genres</p>
      <div class="space-y-2">${bars}</div>
    </div>`;
}

export function renderStats(store: SeriesStore): void {
  const s = store.computeStats();
  const el = document.getElementById('stats-banner');
  if (!el) return;

  // Empty state - no series at all
  if (s.total === 0) {
    el.innerHTML = `<div class="text-center py-6 text-zinc-500 text-sm">Ajoutez votre première série pour voir vos statistiques.</div>`;
    createIcons({ icons, attrs: { 'stroke-width': '1.5' } });
    return;
  }

  // Build watch history across all series
  const allHistory: (WatchHistoryEntry & { seriesName: string })[] = [];
  store.getAll().forEach((series) => {
    (series.watchHistory || []).forEach((h) =>
      allHistory.push({ ...h, seriesName: series.name })
    );
  });

  // Series counts row — only show cards for statuses that have series
  const countCards = [
    statCard('tv-2', 'Total séries', s.total, 'indigo'),
    s.countWatching > 0 ? statCard('play-circle', 'En cours', s.countWatching, 'blue') : '',
    s.countCompleted > 0 ? statCard('check-circle-2', 'Terminées', s.countCompleted, 'green') : '',
    s.countWatchlist > 0 ? statCard('bookmark', 'Watchlist', s.countWatchlist, 'yellow') : '',
  ].filter(Boolean).join('');

  // Episode counts row — only show non-zero statuses
  const epCards = [
    s.epWatching > 0 ? statCard('film', 'Épisodes en cours', s.epWatching, 'blue') : '',
    s.epCompleted > 0 ? statCard('film', 'Épisodes terminés', s.epCompleted, 'green') : '',
    s.epWatchlist > 0 ? statCard('film', 'Épisodes à voir', s.epWatchlist, 'yellow') : '',
    s.epTotal > 0 ? statCard('film', 'Épisodes total', s.epTotal, 'indigo') : '',
  ].filter(Boolean).join('');

  // Time row — only show non-zero statuses
  const timeCards = [
    s.minWatching > 0 ? statCard('clock', 'Temps en cours', formatTime(s.minWatching), 'blue') : '',
    s.minCompleted > 0 ? statCard('clock', 'Temps terminé', formatTime(s.minCompleted), 'green') : '',
    s.minWatchlist > 0 ? statCard('clock', 'Temps à voir', formatTime(s.minWatchlist), 'yellow') : '',
    s.minTotal > 0 ? statCard('clock', 'Temps total', formatTime(s.minTotal), 'indigo') : '',
  ].filter(Boolean).join('');

  el.innerHTML = `
    <div class="grid grid-cols-2 sm:grid-cols-4 gap-3">${countCards}</div>
    ${epCards ? `<div class="grid grid-cols-2 sm:grid-cols-4 gap-3">${epCards}</div>` : ''}
    ${timeCards ? `<div class="grid grid-cols-2 sm:grid-cols-4 gap-3">${timeCards}</div>` : ''}
    ${completionStats(store)}
    ${genreStats(store)}
    ${networkStats(store)}
    ${watchtimeChart(s.minWatching, s.minCompleted, s.minWatchlist)}
    ${watchTrendSection(allHistory)}
    ${watchHistorySection(allHistory)}`;
  createIcons({ icons, attrs: { 'stroke-width': '1.5' } });
}
