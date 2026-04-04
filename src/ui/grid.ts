import { createIcons, icons } from 'lucide';
import type { Series } from '../types';
import type { SeriesStore } from '../store/seriesStore';
import type { SortOption } from '../store/seriesStore';
import { sanitize } from '../utils/validation';
import { formatTime, statusLabel, statusColor } from '../utils/formatting';
import { countWatchedEpisodes } from './episodes';
import { IMG_BASE } from '../config/constants';

function computeNextEpisode(s: Series): string | null {
  if (!s.seasonsData || !s.seasonsData.length) return null;
  const watched = s.watchedEpisodes || {};
  for (const season of s.seasonsData) {
    const sn = String(season.season_number);
    const watchedEps = watched[sn] || [];
    for (let ep = 1; ep <= season.episode_count; ep++) {
      if (!watchedEps.includes(ep)) {
        return `S${String(season.season_number).padStart(2, '0')}E${String(ep).padStart(2, '0')}`;
      }
    }
  }
  return null;
}

function computeAccurateProgress(s: Series): number {
  const totalWatched = countWatchedEpisodes(s);
  // Prefer total from seasonsData (actual episode counts) over the TMDB aggregate
  const totalFromSeasons =
    s.seasonsData && s.seasonsData.length
      ? s.seasonsData.reduce((sum, season) => sum + season.episode_count, 0)
      : s.episodesTotal;
  if (!totalFromSeasons || totalFromSeasons <= 0) return 0;
  return Math.min(100, Math.round((totalWatched / totalFromSeasons) * 100));
}

export function seriesCard(
  s: Series,
  listView = false,
  onFavouriteToggle?: (id: string) => void
): string {
  const placeholder = `https://placehold.co/120x180/27272a/6366f1?text=${encodeURIComponent(s.name.charAt(0))}`;
  const img = s.poster ? IMG_BASE + s.poster : placeholder;
  const stars = s.rating != null ? `★ ${s.rating}/10` : '';
  const seasonInfo = s.totalSeasons ? `S${s.season || 1}/${s.totalSeasons}` : `S${s.season || 1}`;
  const totalWatched = countWatchedEpisodes(s);
  const epInfo = s.episodesTotal
    ? totalWatched > 0
      ? `${totalWatched}/${s.episodesTotal} ép.`
      : `${s.episodesTotal} ép.`
    : totalWatched > 0
      ? `${totalWatched} ép. vus`
      : '';
  const timeInfo =
    s.episodesTotal && s.episodeRuntime
      ? formatTime(s.episodesTotal * s.episodeRuntime)
      : '';

  // Accurate progress bar for watching series
  const progressBar =
    s.status === 'watching'
      ? (() => {
          const pct = computeAccurateProgress(s);
          return pct > 0 || totalWatched > 0
            ? `<div class="h-1 bg-zinc-700 rounded-full overflow-hidden mt-1">
            <div class="h-full bg-brand rounded-full transition-all" style="width:${pct}%"></div>
          </div>`
            : '';
        })()
      : '';

  // Next episode badge
  const nextEp = s.status === 'watching' ? computeNextEpisode(s) : null;
  const nextEpBadge = nextEp
    ? `<span class="text-xs font-mono text-brand bg-brand/10 px-1.5 py-0.5 rounded border border-brand/20">${sanitize(nextEp)}</span>`
    : '';

  // Favourite star icon
  const starClass = s.isFavourite
    ? 'text-yellow-400 hover:text-yellow-300'
    : 'text-zinc-600 hover:text-yellow-400';
  const starFill = s.isFavourite ? 'fill-current' : '';

  // Notes icon (shown only when notes exist)
  const notesIcon = s.notes?.trim()
    ? `<span title="${sanitize(s.notes)}" class="text-zinc-500 flex items-center"><i data-lucide="file-text" class="w-3 h-3"></i></span>`
    : '';

  // Genre tags (first 2 to keep cards compact)
  const genreChips =
    s.genres && s.genres.length
      ? s.genres
          .slice(0, 2)
          .map(
            (g) =>
              `<span class="text-xs bg-zinc-800 text-zinc-400 px-1.5 py-0.5 rounded">${sanitize(g)}</span>`
          )
          .join('')
      : '';

  if (listView) {
    return `
      <div class="card-transition bg-surface-card border border-surface-border rounded-xl overflow-hidden flex items-center gap-3 px-3 py-2" role="article" tabindex="0" data-series-id="${s.id}">
        <img src="${sanitize(img)}" alt="${sanitize(s.name)}" class="w-10 h-14 object-cover rounded shrink-0" loading="lazy"
          onerror="this.src='${sanitize(placeholder)}'" />
        <div class="flex-1 min-w-0 flex flex-wrap items-center gap-x-3 gap-y-0.5">
          <span class="font-semibold text-sm truncate max-w-[200px]">${sanitize(s.name)}</span>
          <span class="text-xs text-zinc-500">${sanitize(s.year || '')}</span>
          <span class="text-xs text-zinc-500">${seasonInfo}</span>
          ${epInfo ? `<span class="text-xs text-zinc-500">${epInfo}</span>` : ''}
          ${nextEpBadge}
          ${stars ? `<span class="text-xs text-yellow-400">${stars}</span>` : ''}
          ${notesIcon}
          ${genreChips}
        </div>
        <div class="flex items-center gap-1.5 shrink-0">
          <button data-fav-id="${s.id}" class="p-1 ${starClass} transition-colors shrink-0" title="${s.isFavourite ? 'Retirer des favoris' : 'Ajouter aux favoris'}">
            <i data-lucide="star" class="w-3.5 h-3.5 ${starFill}"></i>
          </button>
          <button data-status-id="${s.id}"
            class="text-xs font-medium px-2 py-1 rounded-md truncate transition-opacity hover:opacity-70 ${statusColor(s.status)}"
            title="Cliquer pour changer le statut">
            ${statusLabel(s.status)}
          </button>
          <button data-edit-id="${s.id}" class="p-1.5 rounded-md bg-zinc-700 hover:bg-zinc-600 transition-colors shrink-0" title="Modifier">
            <i data-lucide="pencil" class="w-3 h-3"></i>
          </button>
          <input type="checkbox" class="bulk-checkbox w-4 h-4 rounded shrink-0" data-bulk-id="${s.id}" aria-label="Sélectionner ${sanitize(s.name)}" />
        </div>
      </div>`;
  }

  void onFavouriteToggle; // used via event delegation in renderGrid
  return `
    <div class="card-transition bg-surface-card border border-surface-border rounded-xl overflow-hidden flex" role="article" tabindex="0" data-series-id="${s.id}">
      <div class="shrink-0 w-16 relative">
        <img src="${sanitize(img)}" alt="${sanitize(s.name)}" class="w-16 h-full min-h-[96px] object-cover" loading="lazy"
          onerror="this.src='${sanitize(placeholder)}'" />
      </div>
      <div class="p-2.5 flex flex-col flex-1 min-w-0 gap-1">
        <div class="flex items-start justify-between gap-1">
          <h3 class="font-semibold text-sm leading-tight line-clamp-2">${sanitize(s.name)}</h3>
          <div class="flex items-center gap-1 shrink-0">
            <button data-fav-id="${s.id}" class="p-0.5 ${starClass} transition-colors" title="${s.isFavourite ? 'Retirer des favoris' : 'Ajouter aux favoris'}">
              <i data-lucide="star" class="w-3.5 h-3.5 ${starFill}"></i>
            </button>
            <input type="checkbox" class="bulk-checkbox w-4 h-4 rounded" data-bulk-id="${s.id}" aria-label="Sélectionner ${sanitize(s.name)}" />
          </div>
        </div>
        <div class="flex flex-wrap items-center gap-x-1.5 gap-y-0.5">
          <span class="text-xs text-zinc-500">${sanitize(s.year || '')}</span>
          <span class="text-xs text-zinc-600">·</span>
          <span class="text-xs text-zinc-500">${seasonInfo}</span>
          ${epInfo ? `<span class="text-xs text-zinc-600">·</span><span class="text-xs text-zinc-500">${epInfo}</span>` : ''}
          ${timeInfo ? `<span class="text-xs text-zinc-600">·</span><span class="text-xs text-zinc-500">${timeInfo}</span>` : ''}
          ${notesIcon}
        </div>
        ${genreChips ? `<div class="flex flex-wrap gap-1">${genreChips}</div>` : ''}
        ${nextEpBadge ? `<div>${nextEpBadge}</div>` : ''}
        ${progressBar}
        ${stars ? `<span class="text-xs text-yellow-400">${stars}</span>` : ''}
        ${s.viewingDate ? `<span class="text-xs text-zinc-600">${sanitize(s.viewingDate)}</span>` : ''}
        <div class="mt-auto flex items-center gap-1.5 pt-1">
          <button data-status-id="${s.id}"
            class="flex-1 text-xs font-medium px-2 py-1 rounded-md truncate transition-opacity hover:opacity-70 ${statusColor(s.status)}"
            title="Cliquer pour changer le statut">
            ${statusLabel(s.status)}
          </button>
          <button data-edit-id="${s.id}" class="p-1.5 rounded-md bg-zinc-700 hover:bg-zinc-600 transition-colors shrink-0" title="Modifier">
            <i data-lucide="pencil" class="w-3 h-3"></i>
          </button>
        </div>
      </div>
    </div>`;
}

export function renderGrid(
  store: SeriesStore,
  filter: string,
  query: string,
  onEdit: (id: string) => void,
  onStatusChange: (id: string) => void,
  onFavouriteToggle: (id: string) => void,
  listView = false,
  sort: SortOption = 'recent',
  bulkMode = false
): void {
  const list = store.getFiltered(
    filter as Parameters<SeriesStore['getFiltered']>[0],
    query,
    sort
  );
  const grid = document.getElementById('series-grid');
  const empty = document.getElementById('empty-state');
  const countEl = document.getElementById('series-count');
  const liveEl = document.getElementById('results-live');

  const countText = `${list.length} série${list.length !== 1 ? 's' : ''}`;
  if (countEl) countEl.textContent = countText;
  if (liveEl) liveEl.textContent = countText;

  if (!grid) return;

  if (!list.length) {
    grid.innerHTML = '';
    empty?.classList.remove('hidden');
    return;
  }
  empty?.classList.add('hidden');

  if (listView) {
    grid.className = 'flex flex-col gap-2';
  } else {
    grid.className = 'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-3';
  }

  grid.innerHTML = list.map((s) => seriesCard(s, listView)).join('');
  createIcons({ icons, attrs: { 'stroke-width': '1.5' } });

  // Show/hide bulk checkboxes
  grid.querySelectorAll<HTMLInputElement>('.bulk-checkbox').forEach((cb) => {
    cb.style.display = bulkMode ? '' : 'none';
  });

  grid.querySelectorAll<HTMLElement>('[data-edit-id]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const id = btn.dataset['editId'];
      if (id) onEdit(id);
    });
  });
  grid.querySelectorAll<HTMLElement>('[data-status-id]').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const id = btn.dataset['statusId'];
      if (id) onStatusChange(id);
    });
  });
  grid.querySelectorAll<HTMLElement>('[data-fav-id]').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const id = btn.dataset['favId'];
      if (id) onFavouriteToggle(id);
    });
  });

  // Keyboard navigation: Enter/Space on card opens edit modal
  grid.querySelectorAll<HTMLElement>('[data-series-id]').forEach((card) => {
    card.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        const id = card.dataset['seriesId'];
        if (id) onEdit(id);
      }
    });
  });
}

export function renderSidebarCounts(store: SeriesStore): void {
  const all = store.getAll();
  const map: Record<string, number> = {
    all: all.length,
    watching: all.filter((s) => s.status === 'watching').length,
    completed: all.filter((s) => s.status === 'completed').length,
    watchlist: all.filter((s) => s.status === 'watchlist').length,
    favourites: all.filter((s) => !!s.isFavourite).length,
  };
  document.querySelectorAll<HTMLElement>('.nav-btn').forEach((btn) => {
    const existing = btn.querySelector('.count-badge');
    if (existing) existing.remove();
    const filter = btn.dataset['filter'];
    const n = filter !== undefined ? map[filter] : undefined;
    if (n && n > 0) {
      const badge = document.createElement('span');
      badge.className = 'count-badge ml-auto text-xs bg-surface-border px-2 py-0.5 rounded-full';
      badge.textContent = String(n);
      btn.appendChild(badge);
    }
  });
}

