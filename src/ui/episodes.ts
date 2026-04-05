import { createIcons, icons } from 'lucide';
import type { Series, SeasonData, TmdbSeriesDetails } from '../types';
import type { SeriesStore } from '../store/seriesStore';
import type { TmdbClient } from '../api/tmdb';
import { sanitize } from '../utils/validation';
import { showToast, promptDate } from './modals';

export function extractSeasonsData(details: TmdbSeriesDetails): SeasonData[] {
  if (!details || !details.seasons) return [];
  return details.seasons
    .filter((s) => s.season_number > 0)
    .map((s) => ({
      season_number: s.season_number,
      episode_count: s.episode_count,
      name: s.name,
    }));
}

export function countWatchedEpisodes(s: Series): number {
  const watched = s.watchedEpisodes || {};
  return Object.values(watched).reduce(
    (sum, eps) => sum + (Array.isArray(eps) ? eps.length : 0),
    0
  );
}

export function markAllEpisodesWatched(s: Series): void {
  const seasonsData = s.seasonsData || [];
  if (!seasonsData.length) return;
  const watched: Record<string, number[]> = {};
  seasonsData.forEach((season) => {
    watched[String(season.season_number)] = Array.from(
      { length: season.episode_count },
      (_, i) => i + 1
    );
  });
  s.watchedEpisodes = watched;
}

export function updateCurrentSeasonFromWatched(s: Series): void {
  const seasonsData = s.seasonsData || [];
  if (!seasonsData.length) return;
  const watched = s.watchedEpisodes || {};
  let currentSeason = seasonsData[0] ? seasonsData[0].season_number : 1;
  for (const season of seasonsData) {
    const watchedCount = (watched[String(season.season_number)] || []).length;
    if (watchedCount > 0) currentSeason = season.season_number;
    if (watchedCount < season.episode_count) break;
  }
  s.season = currentSeason;
}

function updateEpTileStyle(ep: HTMLInputElement): void {
  const label = ep.closest('.ep-tile');
  if (!label) return;
  if (ep.checked) {
    label.classList.add('bg-brand', 'text-white');
    label.classList.remove('bg-zinc-800', 'text-zinc-400');
  } else {
    label.classList.remove('bg-brand', 'text-white');
    label.classList.add('bg-zinc-800', 'text-zinc-400');
  }
}

// ─── EPISODE DATE MAP ────────────────────────
// Tracks dates chosen via the date-picker for episodes checked in the current edit session
export const episodeDateMap = new Map<string, string>();

export function clearEpisodeDateMap(): void {
  episodeDateMap.clear();
}

export function renderEditEpisodesSection(
  s: Series,
  onRefresh: (id: string) => void,
  onEditDate?: (sn: number, ep: number, newDate: string) => void
): void {
  const container = document.getElementById('edit-episodes-section');
  if (!container) return;
  if (!s.tmdbId) {
    container.innerHTML = '';
    return;
  }

  const seasonsData = s.seasonsData || [];
  const watched = s.watchedEpisodes || {};

  if (!seasonsData.length) {
    container.innerHTML = `
      <div class="border-t border-surface-border pt-3">
        <p class="text-xs text-zinc-400 uppercase tracking-wider mb-3">Épisodes</p>
        <div id="episodes-loading" class="flex items-center justify-center gap-2 py-4 text-zinc-400 text-sm">
          <i data-lucide="loader-2" class="w-4 h-4 animate-spin text-brand"></i>
          Chargement des épisodes…
        </div>
      </div>`;
    createIcons({ icons });
    return;
  }

  const totalWatched = countWatchedEpisodes(s);
  const totalEps = seasonsData.reduce((sum, season) => sum + season.episode_count, 0);

  container.innerHTML = `
    <div class="border-t border-surface-border pt-3">
      <div class="flex items-center justify-between mb-3">
        <p class="text-xs text-zinc-400 uppercase tracking-wider">Épisodes <span class="text-zinc-300 font-medium">${totalWatched}/${totalEps}</span></p>
        <button id="refresh-episodes-btn" class="text-xs text-zinc-500 hover:text-zinc-300 flex items-center gap-1 transition-colors">
          <i data-lucide="refresh-cw" class="w-3 h-3"></i> Actualiser
        </button>
      </div>
      <div id="seasons-list" class="space-y-2">
        ${seasonsData
          .map((season) => {
            const sn = String(season.season_number);
            const seasonWatched = watched[sn] || [];
            const watchedCount = seasonWatched.length;
            const totalCount = season.episode_count;
            const allWatched = watchedCount >= totalCount;
            const anyWatched = watchedCount > 0;
            const pct = totalCount > 0 ? Math.round((watchedCount / totalCount) * 100) : 0;
            const history = s.watchHistory || [];
            return `
            <div class="bg-surface rounded-xl border border-surface-border overflow-hidden">
              <div class="flex items-center gap-2.5 px-3 py-2.5 cursor-pointer hover:bg-zinc-800/50 transition-colors select-none" data-toggle-season="${season.season_number}" role="button" tabindex="0" aria-expanded="false">
                <input type="checkbox" data-season-check="${season.season_number}"
                  class="w-4 h-4 shrink-0 cursor-pointer rounded"
                  ${allWatched ? 'checked' : ''}
                  ${anyWatched && !allWatched ? 'data-indeterminate="true"' : ''} />
                <div class="flex-1 min-w-0">
                  <div class="flex items-center justify-between gap-2">
                    <span class="text-sm font-medium text-zinc-200 truncate">${sanitize(season.name)}</span>
                    <span class="text-xs text-zinc-400 shrink-0" id="count-s${season.season_number}">${watchedCount}/${totalCount}</span>
                  </div>
                  <div class="mt-1.5 h-1 bg-zinc-700 rounded-full overflow-hidden">
                    <div class="h-full bg-brand rounded-full transition-all duration-300" id="progress-s${season.season_number}" role="progressbar" aria-valuenow="${pct}" aria-valuemin="0" aria-valuemax="100" style="width:${pct}%"></div>
                  </div>
                </div>
                <i data-lucide="chevron-down" class="w-4 h-4 text-zinc-500 shrink-0 transition-transform duration-200" id="chevron-s${season.season_number}"></i>
              </div>
              <div id="episodes-s${season.season_number}" class="hidden px-3 pb-3 pt-0.5">
                <div class="flex flex-wrap gap-1.5">
                  ${Array.from({ length: totalCount }, (_, i) => i + 1)
                    .map((ep) => {
                      const isWatched = seasonWatched.includes(ep);
                      const watchEntry = history
                        .filter(
                          (h) =>
                            (h.season === season.season_number && h.episode === ep && (!h.type || h.type === 'episode')) ||
                            (h.type === 'season' && h.season === season.season_number) ||
                            h.type === 'series'
                        )
                        .sort((a, b) => b.watchedAt.localeCompare(a.watchedAt))[0];
                      const titleAttr = watchEntry ? ` title="Vu le ${watchEntry.watchedAt}"` : '';
                      const badgeDot = watchEntry
                        ? '<span class="absolute bottom-0.5 inset-x-0 flex justify-center pointer-events-none"><span class="w-1 h-1 rounded-full bg-white/50 block"></span></span>'
                        : '';
                      const editBtn = isWatched
                        ? `<button type="button" data-ep-edit-date="${sn}_${ep}" class="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-zinc-600 hover:bg-brand flex items-center justify-center z-10 transition-colors opacity-0 group-hover:opacity-100 cursor-pointer" title="Modifier la date" aria-label="Modifier la date de l'épisode ${ep}"><span class="text-white leading-none" style="font-size:8px">✎</span></button>`
                        : '';
                      return `<div class="relative inline-flex group">
                        <label class="ep-tile relative inline-flex items-center justify-center w-9 h-9 rounded-lg text-xs font-semibold cursor-pointer transition-colors ${isWatched ? 'bg-brand text-white' : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700 hover:text-zinc-200'}"${titleAttr}>
                          <input type="checkbox" class="sr-only" data-ep-season="${sn}" data-ep-num="${ep}" aria-label="Épisode ${ep}" ${isWatched ? 'checked' : ''}>
                          ${ep}${badgeDot}
                        </label>${editBtn}
                      </div>`;
                    })
                    .join('')}
                </div>
              </div>
            </div>`;
          })
          .join('')}
      </div>
    </div>`;

  createIcons({ icons });

  seasonsData.forEach((season) => {
    const sn = String(season.season_number);
    const toggleRow = container.querySelector<HTMLElement>(
      `[data-toggle-season="${season.season_number}"]`
    );
    const chevron = container.querySelector<HTMLElement>(`#chevron-s${season.season_number}`);
    const epList = container.querySelector<HTMLElement>(`#episodes-s${season.season_number}`);
    const seasonCheck = container.querySelector<HTMLInputElement>(
      `[data-season-check="${season.season_number}"]`
    );
    const progressBar = container.querySelector<HTMLElement>(
      `#progress-s${season.season_number}`
    );
    const countEl = container.querySelector<HTMLElement>(`#count-s${season.season_number}`);
    const getEpBoxes = () =>
      container.querySelectorAll<HTMLInputElement>(`[data-ep-season="${sn}"]`);

    if (seasonCheck && seasonCheck.dataset['indeterminate']) seasonCheck.indeterminate = true;

    if (seasonCheck) {
      seasonCheck.addEventListener('click', (e) => e.stopPropagation());
    }

    const toggleEpList = () => {
      if (!epList) return;
      const hidden = epList.classList.toggle('hidden');
      if (chevron) chevron.style.transform = hidden ? '' : 'rotate(180deg)';
      if (toggleRow) toggleRow.setAttribute('aria-expanded', String(!hidden));
    };

    if (toggleRow) {
      toggleRow.addEventListener('click', toggleEpList);
      toggleRow.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          toggleEpList();
        }
      });
    }

    if (seasonCheck) {
      seasonCheck.addEventListener('change', async () => {
        if (!seasonCheck.checked) {
          // User unchecked the season
          getEpBoxes().forEach((ep) => {
            ep.checked = false;
            updateEpTileStyle(ep);
            episodeDateMap.delete(`${sn}_${ep.dataset['epNum'] || '0'}`);
          });
          seasonCheck.indeterminate = false;
          if (progressBar) progressBar.style.width = '0%';
          if (countEl) countEl.textContent = `0/${season.episode_count}`;
          return;
        }

        // User checked the season → prompt for date
        const date = await promptDate(`Saison ${season.season_number} — ${sanitize(season.name)}`);
        if (date === null) {
          // Cancelled — revert checkbox
          seasonCheck.checked = false;
          return;
        }

        getEpBoxes().forEach((ep) => {
          ep.checked = true;
          updateEpTileStyle(ep);
          episodeDateMap.set(`${sn}_${ep.dataset['epNum'] || '0'}`, date);
        });
        seasonCheck.indeterminate = false;
        if (progressBar) progressBar.style.width = '100%';
        if (countEl) countEl.textContent = `${season.episode_count}/${season.episode_count}`;
      });
    }

    container.querySelectorAll<HTMLInputElement>(`[data-ep-season="${sn}"]`).forEach((ep) => {
      ep.addEventListener('change', async () => {
        const epNum = ep.dataset['epNum'] || '0';

        if (!ep.checked) {
          // User unchecked the episode
          updateEpTileStyle(ep);
          episodeDateMap.delete(`${sn}_${epNum}`);
          const all = Array.from(getEpBoxes());
          const checkedCount = all.filter((e) => e.checked).length;
          if (seasonCheck) {
            seasonCheck.checked = checkedCount === all.length;
            seasonCheck.indeterminate = checkedCount > 0 && checkedCount < all.length;
          }
          const pct = season.episode_count > 0 ? Math.round((checkedCount / season.episode_count) * 100) : 0;
          if (progressBar) progressBar.style.width = pct + '%';
          if (countEl) countEl.textContent = `${checkedCount}/${season.episode_count}`;
          return;
        }

        // User checked the episode → prompt for date
        const date = await promptDate(`Saison ${season.season_number} — Épisode ${epNum}`);
        if (date === null) {
          // Cancelled — revert checkbox
          ep.checked = false;
          return;
        }

        episodeDateMap.set(`${sn}_${epNum}`, date);
        updateEpTileStyle(ep);
        const all = Array.from(getEpBoxes());
        const checkedCount = all.filter((e) => e.checked).length;
        if (seasonCheck) {
          seasonCheck.checked = checkedCount === all.length;
          seasonCheck.indeterminate = checkedCount > 0 && checkedCount < all.length;
        }
        const pct =
          season.episode_count > 0
            ? Math.round((checkedCount / season.episode_count) * 100)
            : 0;
        if (progressBar) progressBar.style.width = pct + '%';
        if (countEl) countEl.textContent = `${checkedCount}/${season.episode_count}`;
      });
    });

    // Edit date buttons for already-watched episodes
    container.querySelectorAll<HTMLElement>(`[data-ep-edit-date^="${sn}_"]`).forEach((btn) => {
      btn.addEventListener('click', async (e) => {
        e.stopPropagation();
        e.preventDefault();
        const key = btn.dataset['epEditDate']!;
        const [snStr, epStr] = key.split('_');
        const snNum = parseInt(snStr, 10);
        const epNum = parseInt(epStr, 10);
        const existingEntry = (s.watchHistory || [])
          .filter(
            (h) =>
              ((!h.type || h.type === 'episode') && h.season === snNum && h.episode === epNum) ||
              (h.type === 'season' && h.season === snNum) ||
              h.type === 'series'
          )
          .sort((a, b) => b.watchedAt.localeCompare(a.watchedAt))[0];
        const newDate = await promptDate(`Modifier — S${snNum}E${epNum}`, existingEntry?.watchedAt);
        if (newDate !== null && onEditDate) {
          onEditDate(snNum, epNum, newDate);
        }
      });
    });
  });

  document.getElementById('refresh-episodes-btn')?.addEventListener('click', () => {
    if (s.id) onRefresh(s.id);
  });
}

export async function loadEpisodesForEditing(
  seriesId: string,
  store: SeriesStore,
  client: TmdbClient,
  onEditDate?: (sn: number, ep: number, newDate: string) => void
): Promise<void> {
  const s = store.getAll().find((x) => x.id === seriesId);
  if (!s || !s.tmdbId) return;

  try {
    const details = await client.getSeriesDetails(s.tmdbId);
    if (details) {
      store.update(seriesId, {
        seasonsData: extractSeasonsData(details),
        totalSeasons: details.number_of_seasons || s.totalSeasons,
      });
      const updated = store.getAll().find((x) => x.id === seriesId);
      if (updated) {
        renderEditEpisodesSection(updated, (id) => loadEpisodesForEditing(id, store, client, onEditDate), onEditDate);
      }
    }
  } catch {
    const container = document.getElementById('edit-episodes-section');
    if (container) {
      container.innerHTML = `
        <div class="border-t border-surface-border pt-3">
          <p class="text-xs text-zinc-400 uppercase tracking-wider mb-2">Épisodes</p>
          <p class="text-xs text-red-400 py-2">Erreur lors du chargement des épisodes.</p>
          <button id="retry-episodes-btn" class="text-xs text-zinc-400 hover:text-zinc-200 flex items-center gap-1.5 transition-colors">
            <i data-lucide="refresh-cw" class="w-3 h-3"></i> Réessayer
          </button>
        </div>`;
      createIcons({ icons });
      document
        .getElementById('retry-episodes-btn')
        ?.addEventListener('click', () => loadEpisodesForEditing(seriesId, store, client, onEditDate));
    }
    showToast('Erreur lors du chargement des épisodes.', 'error');
  }
}
