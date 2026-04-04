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
    red: 'bg-red-500/10 text-red-400',
    orange: 'bg-orange-500/10 text-orange-400',
    purple: 'bg-purple-500/10 text-purple-400',
  };
  return `<div class="bg-surface-card border border-surface-border rounded-xl p-3 flex items-center gap-3">
    <div class="w-8 h-8 rounded-lg ${cls[color] || ''} flex items-center justify-center shrink-0"><i data-lucide="${icon}" class="w-4 h-4"></i></div>
    <div class="min-w-0"><p class="text-xs text-zinc-500 uppercase tracking-wider truncate">${label}</p><p class="text-xl font-bold">${value}</p></div>
  </div>`;
}

function svgDonut(
  segments: { value: number; color: string; label: string }[],
  size = 120,
  strokeWidth = 20
): string {
  const total = segments.reduce((s, seg) => s + seg.value, 0);
  if (!total) return '';
  const r = (size - strokeWidth) / 2;
  const cx = size / 2;
  const cy = size / 2;
  const circumference = 2 * Math.PI * r;
  let offset = 0;
  const arcs = segments
    .filter((seg) => seg.value > 0)
    .map((seg) => {
      const pct = seg.value / total;
      const dash = pct * circumference;
      const arc = `<circle
        cx="${cx}" cy="${cy}" r="${r}"
        fill="none"
        stroke="${seg.color}"
        stroke-width="${strokeWidth}"
        stroke-dasharray="${dash.toFixed(2)} ${(circumference - dash).toFixed(2)}"
        stroke-dashoffset="${(-offset * circumference + circumference / 4).toFixed(2)}"
        class="transition-all duration-500">
        <title>${seg.label}: ${seg.value}</title>
      </circle>`;
      offset += pct;
      return arc;
    })
    .join('');
  return `<svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">${arcs}</svg>`;
}

function watchtimeChart(store: SeriesStore): string {
  const all = store.getAll();
  const sumMin = (status: string) =>
    all
      .filter((s) => s.status === status)
      .reduce((a, s) => a + (s.episodesTotal || 0) * (s.episodeRuntime || 0), 0);

  const minWatching = sumMin('watching');
  const minCompleted = sumMin('completed');
  const minWatchlist = sumMin('watchlist');
  const minAbandoned = sumMin('abandoned');
  const minOnHold = sumMin('on-hold');
  const minWaiting = sumMin('waiting-platform');
  const total = minWatching + minCompleted + minWatchlist + minAbandoned + minOnHold + minWaiting;
  if (!total) return '';

  const segments = [
    { value: minWatching, color: '#3b82f6', label: 'En cours' },
    { value: minCompleted, color: '#22c55e', label: 'Terminées' },
    { value: minWatchlist, color: '#eab308', label: 'Watchlist' },
    { value: minAbandoned, color: '#ef4444', label: 'Abandonnées' },
    { value: minOnHold, color: '#f97316', label: 'En pause' },
    { value: minWaiting, color: '#a855f7', label: 'En attente' },
  ].filter((s) => s.value > 0);

  const legend = segments
    .map(
      (seg) =>
        `<span class="flex items-center gap-1.5 text-xs text-zinc-400">
          <span class="w-2.5 h-2.5 rounded-sm shrink-0" style="background:${seg.color}"></span>
          ${seg.label} <strong class="text-zinc-200">${formatTime(seg.value)}</strong>
        </span>`
    )
    .join('');

  return `
    <div class="bg-surface-card border border-surface-border rounded-xl p-4">
      <p class="text-xs text-zinc-500 uppercase tracking-wider mb-3">Répartition du temps de visionnage</p>
      <div class="flex items-center gap-6">
        <div class="shrink-0">${svgDonut(segments)}</div>
        <div class="flex flex-wrap gap-x-4 gap-y-1.5">${legend}</div>
      </div>
    </div>`;
}

function genreDonutChart(store: SeriesStore): string {
  const all = store.getAll();
  if (!all.length) return '';

  // Count genre → {series, episodes, minutes}
  type GenreStat = { series: number; episodes: number; minutes: number };
  const genreMap: Record<string, GenreStat> = {};
  all.forEach((s) => {
    (s.genres || []).forEach((g) => {
      if (!genreMap[g]) genreMap[g] = { series: 0, episodes: 0, minutes: 0 };
      genreMap[g].series++;
      genreMap[g].episodes += s.episodesTotal || 0;
      genreMap[g].minutes += (s.episodesTotal || 0) * (s.episodeRuntime || 0);
    });
  });

  const entries = Object.entries(genreMap)
    .filter(([, v]) => v.series >= 2)
    .sort((a, b) => b[1].series - a[1].series)
    .slice(0, 8);

  if (!entries.length) return '';

  const palette = [
    '#6366f1', '#3b82f6', '#22c55e', '#eab308',
    '#ef4444', '#f97316', '#a855f7', '#06b6d4',
  ];

  const segments = entries.map(([genre, stat], i) => ({
    value: stat.series,
    color: palette[i % palette.length],
    label: genre,
  }));

  const maxSeries = Math.max(...entries.map(([, v]) => v.series));
  const bars = entries
    .map(
      ([genre, stat], i) => `
      <div class="flex items-center gap-2">
        <span class="text-xs text-zinc-400 w-24 truncate shrink-0">${genre}</span>
        <div class="flex-1 h-2 bg-zinc-700 rounded-full overflow-hidden">
          <div class="h-full rounded-full transition-all" style="width:${Math.round((stat.series / maxSeries) * 100)}%;background:${palette[i % palette.length]}"></div>
        </div>
        <span class="text-xs text-zinc-500 w-5 text-right shrink-0">${stat.series}</span>
      </div>`
    )
    .join('');

  return `
    <div class="bg-surface-card border border-surface-border rounded-xl p-4">
      <p class="text-xs text-zinc-500 uppercase tracking-wider mb-3">Genres les plus regardés</p>
      <div class="flex items-start gap-6">
        <div class="shrink-0">${svgDonut(segments, 100, 18)}</div>
        <div class="flex-1 space-y-2">${bars}</div>
      </div>
    </div>`;
}

function statusBreakdownChart(store: SeriesStore): string {
  const all = store.getAll();
  if (!all.length) return '';

  const statuses = [
    { key: 'watching', label: 'En cours', color: '#3b82f6' },
    { key: 'completed', label: 'Terminées', color: '#22c55e' },
    { key: 'watchlist', label: 'Watchlist', color: '#eab308' },
    { key: 'abandoned', label: 'Abandonnées', color: '#ef4444' },
    { key: 'on-hold', label: 'En pause', color: '#f97316' },
    { key: 'waiting-platform', label: 'En attente', color: '#a855f7' },
  ];

  const counts = statuses.map((s) => ({
    ...s,
    count: all.filter((x) => x.status === s.key).length,
  })).filter((s) => s.count > 0);

  if (counts.length < 2) return '';

  const max = Math.max(...counts.map((s) => s.count));
  const bars = counts
    .map(
      (s) => `
      <div class="flex items-center gap-3">
        <span class="text-xs w-28 truncate shrink-0" style="color:${s.color}">${s.label}</span>
        <div class="flex-1 h-3 bg-zinc-700 rounded-full overflow-hidden">
          <div class="h-full rounded-full transition-all" style="width:${Math.round((s.count / max) * 100)}%;background:${s.color}"></div>
        </div>
        <span class="text-xs text-zinc-400 w-6 text-right shrink-0">${s.count}</span>
      </div>`
    )
    .join('');

  return `
    <div class="bg-surface-card border border-surface-border rounded-xl p-4">
      <p class="text-xs text-zinc-500 uppercase tracking-wider mb-3">Répartition par statut</p>
      <div class="space-y-2.5">${bars}</div>
    </div>`;
}

function watchHistorySection(allHistory: (WatchHistoryEntry & { seriesName: string })[]): string {
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
  const abandoned = store.getAll().filter((s) => s.status === 'abandoned');
  if (!completed.length && !abandoned.length) return '';
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

  const cards = [
    avgRating ? statCard('star', 'Note moyenne (terminées)', avgRating + '/10', 'yellow') : '',
    completed.length ? statCard('check-circle-2', 'Séries terminées', completed.length, 'green') : '',
    abandoned.length ? statCard('x-circle', 'Séries abandonnées', abandoned.length, 'red') : '',
    remainingMin > 0 ? statCard('clock', 'Temps restant (en cours)', formatTime(remainingMin), 'blue') : '',
  ].filter(Boolean).join('');

  if (!cards) return '';
  return `<div class="grid gap-3" style="grid-template-columns:repeat(auto-fill,minmax(180px,1fr))">${cards}</div>`;
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

export function renderStats(store: SeriesStore): void {
  const s = store.computeStats();
  const el = document.getElementById('stats-banner');
  if (!el) return;

  if (s.total === 0) {
    el.innerHTML = `<div class="text-center py-6 text-zinc-500 text-sm">Ajoutez votre première série pour voir vos statistiques.</div>`;
    createIcons({ icons, attrs: { 'stroke-width': '1.5' } });
    return;
  }

  const allHistory: (WatchHistoryEntry & { seriesName: string })[] = [];
  store.getAll().forEach((series) => {
    (series.watchHistory || []).forEach((h) =>
      allHistory.push({ ...h, seriesName: series.name })
    );
  });

  // Series counts row — auto-fit grid, only non-zero
  const countCards = [
    statCard('tv-2', 'Total séries', s.total, 'indigo'),
    s.countWatching > 0 ? statCard('play-circle', 'En cours', s.countWatching, 'blue') : '',
    s.countCompleted > 0 ? statCard('check-circle-2', 'Terminées', s.countCompleted, 'green') : '',
    s.countWatchlist > 0 ? statCard('bookmark', 'Watchlist', s.countWatchlist, 'yellow') : '',
    s.countAbandoned > 0 ? statCard('x-circle', 'Abandonnées', s.countAbandoned, 'red') : '',
    s.countOnHold > 0 ? statCard('pause-circle', 'En pause', s.countOnHold, 'orange') : '',
    s.countWaitingPlatform > 0 ? statCard('clock-3', 'En attente', s.countWaitingPlatform, 'purple') : '',
  ].filter(Boolean).join('');

  const epCards = [
    s.epWatching > 0 ? statCard('film', 'Épisodes en cours', s.epWatching, 'blue') : '',
    s.epCompleted > 0 ? statCard('film', 'Épisodes terminés', s.epCompleted, 'green') : '',
    s.epWatchlist > 0 ? statCard('film', 'Épisodes à voir', s.epWatchlist, 'yellow') : '',
    s.epTotal > 0 ? statCard('film', 'Épisodes total', s.epTotal, 'indigo') : '',
  ].filter(Boolean).join('');

  const timeCards = [
    s.minWatching > 0 ? statCard('clock', 'Temps en cours', formatTime(s.minWatching), 'blue') : '',
    s.minCompleted > 0 ? statCard('clock', 'Temps terminé', formatTime(s.minCompleted), 'green') : '',
    s.minWatchlist > 0 ? statCard('clock', 'Temps à voir', formatTime(s.minWatchlist), 'yellow') : '',
    s.minTotal > 0 ? statCard('clock', 'Temps total', formatTime(s.minTotal), 'indigo') : '',
  ].filter(Boolean).join('');

  el.innerHTML = `
    <div class="grid gap-3" style="grid-template-columns:repeat(auto-fill,minmax(160px,1fr))">${countCards}</div>
    ${epCards ? `<div class="grid gap-3" style="grid-template-columns:repeat(auto-fill,minmax(160px,1fr))">${epCards}</div>` : ''}
    ${timeCards ? `<div class="grid gap-3" style="grid-template-columns:repeat(auto-fill,minmax(160px,1fr))">${timeCards}</div>` : ''}
    ${completionStats(store)}
    ${statusBreakdownChart(store)}
    ${genreDonutChart(store)}
    ${networkStats(store)}
    ${watchtimeChart(store)}
    ${watchTrendSection(allHistory)}
    ${watchHistorySection(allHistory)}`;
  createIcons({ icons, attrs: { 'stroke-width': '1.5' } });
}
