import { createIcons, icons } from 'lucide';
import type { Series } from '../types';
import type { SeriesStore } from '../store/seriesStore';
import { sanitize } from '../utils/validation';
import { formatTime, statusLabel, statusColor } from '../utils/formatting';
import { countWatchedEpisodes } from './episodes';
import { IMG_BASE } from '../config/constants';

export function seriesCard(s: Series): string {
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
  return `
    <div class="card-transition bg-surface-card border border-surface-border rounded-xl overflow-hidden flex">
      <div class="shrink-0 w-16">
        <img src="${sanitize(img)}" alt="${sanitize(s.name)}" class="w-16 h-full min-h-[96px] object-cover" loading="lazy"
          onerror="this.src='${sanitize(placeholder)}'" />
      </div>
      <div class="p-2.5 flex flex-col flex-1 min-w-0 gap-1">
        <h3 class="font-semibold text-sm leading-tight line-clamp-2">${sanitize(s.name)}</h3>
        <div class="flex flex-wrap items-center gap-x-1.5 gap-y-0.5">
          <span class="text-xs text-zinc-500">${sanitize(s.year || '')}</span>
          <span class="text-xs text-zinc-600">·</span>
          <span class="text-xs text-zinc-500">${seasonInfo}</span>
          ${epInfo ? `<span class="text-xs text-zinc-600">·</span><span class="text-xs text-zinc-500">${epInfo}</span>` : ''}
          ${timeInfo ? `<span class="text-xs text-zinc-600">·</span><span class="text-xs text-zinc-500">${timeInfo}</span>` : ''}
        </div>
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
  onStatusChange: (id: string) => void
): void {
  const list = store.getFiltered(
    filter as Parameters<SeriesStore['getFiltered']>[0],
    query
  );
  const grid = document.getElementById('series-grid');
  const empty = document.getElementById('empty-state');
  const countEl = document.getElementById('series-count');
  if (countEl)
    countEl.textContent = `${list.length} série${list.length !== 1 ? 's' : ''}`;
  if (!grid) return;
  if (!list.length) {
    grid.innerHTML = '';
    empty?.classList.remove('hidden');
    return;
  }
  empty?.classList.add('hidden');
  grid.innerHTML = list.map(seriesCard).join('');
  createIcons({ icons, attrs: { 'stroke-width': '1.5' } });
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
}

export function renderSidebarCounts(store: SeriesStore): void {
  const all = store.getAll();
  const map: Record<string, number> = {
    all: all.length,
    watching: all.filter((s) => s.status === 'watching').length,
    completed: all.filter((s) => s.status === 'completed').length,
    watchlist: all.filter((s) => s.status === 'watchlist').length,
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
