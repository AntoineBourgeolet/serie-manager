import { createIcons, icons } from 'lucide';
import { SeriesStore } from './store/seriesStore';
import type { SortOption } from './store/seriesStore';
import { TmdbClient } from './api/tmdb';
import {
  LS_API_KEY,
  LS_GD_KEY,
  LS_VIEW_PREF,
  LS_LAST_EXPORT,
  LS_SORT_PREF,
  LS_THEME,
  LS_STATS_COLLAPSED,
  LS_SETTINGS,
  LS_IDB_MIGRATED,
  TMDB_BASE,
  TMDB_SEARCH_DEBOUNCE_MS,
  TMDB_SUGGESTIONS_LIMIT,
  WATCHLIST_SUGGESTIONS_LIMIT,
  MAX_RECOMMENDATION_SEED_SERIES,
  IMG_BASE,
  BACKUP_REMINDER_THRESHOLD,
  BACKUP_REMINDER_DAYS,
} from './config/constants';
import { generateId, todayISO, statusLabel } from './utils/formatting';
import { sanitize } from './utils/validation';
import { exportToCSV, importCSV, generateCSV } from './utils/csv';
import { saveToGoogleDrive } from './api/googleDrive';
import {
  showToast,
  showApiKeyModal,
  closeApiKeyModal,
  openGdSetupModal,
  closeGdSetupModal,
  closeAddModal,
  openAddModalFocus,
  closeEditModal,
  openEditModalFocus,
  openHelpModal,
  closeHelpModal,
  openSimilarSeriesModal,
  closeSimilarSeriesModal,
} from './ui/modals';
import { renderStats } from './ui/stats';
import { renderGrid, renderSidebarCounts } from './ui/grid';
import {
  extractSeasonsData,
  renderEditEpisodesSection,
  loadEpisodesForEditing,
  markAllEpisodesWatched,
  updateCurrentSeasonFromWatched,
} from './ui/episodes';
import type { SeriesStatus, TmdbSearchResult, WatchHistoryEntry } from './types';

// ─── STATE ───────────────────────────────────
const store = new SeriesStore();
let tmdbClient = new TmdbClient(localStorage.getItem(LS_API_KEY) || '');
let activeFilter = 'all';
let activeView: 'series' | 'stats' = 'series';
let searchQuery = '';
let editingId: string | null = null;
let searchDebounce: ReturnType<typeof setTimeout> | null = null;
let searchAbort: AbortController | null = null;
let listView: boolean = localStorage.getItem(LS_VIEW_PREF) === 'list';
let sortBy: SortOption = (localStorage.getItem(LS_SORT_PREF) as SortOption) || 'recent';
let bulkMode = false;
const selectedIds = new Set<string>();
let statsCollapsed: boolean = localStorage.getItem(LS_STATS_COLLAPSED) === 'true';
let statusPopupTargetId: string | null = null;

// ─── APP SETTINGS ────────────────────────────
interface AppSettings {
  autoBackupInterval: number; // minutes, 0 = disabled
  lastBackupAt?: string;
}

function loadSettings(): AppSettings {
  try {
    const raw = localStorage.getItem(LS_SETTINGS);
    if (raw) return JSON.parse(raw) as AppSettings;
  } catch { /* ignore */ }
  return { autoBackupInterval: 0 };
}

function saveSettings(s: AppSettings): void {
  localStorage.setItem(LS_SETTINGS, JSON.stringify(s));
}

const appSettings: AppSettings = loadSettings();
let autoBackupTimer: ReturnType<typeof setInterval> | null = null;

// ─── VIEW MANAGEMENT ─────────────────────────
function applyView(): void {
  const seriesView = document.getElementById('view-series');
  const statsView = document.getElementById('view-stats');
  if (seriesView) seriesView.classList.toggle('hidden', activeView !== 'series');
  if (statsView) statsView.classList.toggle('hidden', activeView !== 'stats');
  if (activeView === 'stats') renderStats(store);
}

function applyStatsCollapsed(): void {
  const banner = document.getElementById('stats-banner');
  const chevron = document.getElementById('stats-toggle-chevron');
  const toggle = document.getElementById('stats-toggle');
  if (banner) banner.classList.toggle('hidden', statsCollapsed);
  if (chevron) chevron.style.transform = statsCollapsed ? 'rotate(180deg)' : '';
  if (toggle) toggle.setAttribute('aria-expanded', String(!statsCollapsed));
}

function updateUI(): void {
  if (activeView === 'series') {
    renderGrid(store, activeFilter, searchQuery, openEditModal, showStatusPopup, toggleFavourite, listView, sortBy, bulkMode);
    renderWatchlistSuggestions();
  } else {
    renderStats(store);
  }
  renderSidebarCounts(store);
  updateBulkToolbar();
  checkBackupReminder();
}

// ─── STATUS POPUP ────────────────────────────
function showStatusPopup(id: string): void {
  const popup = document.getElementById('status-popup');
  if (!popup) return;
  const btn = document.querySelector<HTMLElement>(`[data-status-id="${id}"]`);
  if (!btn) return;
  const rect = btn.getBoundingClientRect();
  const popupWidth = 190;
  let left = rect.left;
  if (left + popupWidth > window.innerWidth) left = window.innerWidth - popupWidth - 8;
  popup.style.top = `${rect.bottom + 6}px`;
  popup.style.left = `${left}px`;
  statusPopupTargetId = id;
  popup.classList.remove('hidden');
  const s = store.getAll().find((x) => x.id === id);
  popup.querySelectorAll<HTMLElement>('[data-set-status]').forEach((b) => {
    b.classList.toggle('ring-1', b.dataset['setStatus'] === s?.status);
    b.classList.toggle('ring-brand', b.dataset['setStatus'] === s?.status);
  });
}

function hideStatusPopup(): void {
  document.getElementById('status-popup')?.classList.add('hidden');
  statusPopupTargetId = null;
}

// ─── WATCHLIST SUGGESTIONS ───────────────────
async function renderWatchlistSuggestions(): Promise<void> {
  const suggestSection = document.getElementById('watchlist-suggestions');
  if (!suggestSection) return;
  if (activeFilter !== 'watchlist') { suggestSection.classList.add('hidden'); return; }
  if (!hasTmdbKey()) { suggestSection.classList.add('hidden'); return; }
  const list = store.getFiltered('watchlist', searchQuery);
  if (list.length === 0) {
    suggestSection.classList.remove('hidden');
    suggestSection.innerHTML = `
      <div class="py-4 border-t border-surface-border">
        <div class="flex items-center gap-2 mb-4">
          <i data-lucide="sparkles" class="w-4 h-4 text-brand"></i>
          <span class="text-sm font-semibold">Que regarder ?</span>
          <span class="text-xs text-zinc-500">Séries populaires du moment</span>
        </div>
        <div id="suggestions-list" class="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-3">
          <div class="col-span-full flex justify-center py-4 text-zinc-500 text-sm">
            <i data-lucide="loader-2" class="w-4 h-4 animate-spin mr-2"></i> Chargement…
          </div>
        </div>
      </div>`;
    createIcons({ icons, attrs: { 'stroke-width': '1.5' } });
    try {
      const popular = await tmdbClient.getPopularSeries();
      const alreadyIn = new Set(store.getAll().map((s) => s.tmdbId).filter((id): id is number => id !== null));
      const filtered = popular.filter((r) => !alreadyIn.has(r.id)).slice(0, WATCHLIST_SUGGESTIONS_LIMIT);
      const listEl = document.getElementById('suggestions-list');
      if (!listEl) return;
      if (!filtered.length) { listEl.innerHTML = '<p class="text-xs text-zinc-500 col-span-full">Aucune suggestion disponible.</p>'; return; }
      const resultMap: Record<number, TmdbSearchResult> = {};
      listEl.innerHTML = filtered.map((r) => {
        resultMap[r.id] = r;
        const imgSrc = r.poster_path ? IMG_BASE + r.poster_path : `https://placehold.co/120x180/27272a/6366f1?text=${encodeURIComponent(r.name.charAt(0))}`;
        return `<button class="suggest-add-btn bg-surface-card border border-surface-border rounded-xl overflow-hidden flex flex-col cursor-pointer hover:border-brand/50 transition-colors text-left w-full" data-tmdb-id="${r.id}">
          <img src="${sanitize(imgSrc)}" alt="${sanitize(r.name)}" class="w-full aspect-[2/3] object-cover" loading="lazy" />
          <div class="p-2"><p class="text-xs font-medium truncate">${sanitize(r.name)}</p><p class="text-xs text-zinc-500">${r.first_air_date ? sanitize(r.first_air_date.slice(0, 4)) : '–'}</p></div>
        </button>`;
      }).join('');
      listEl.querySelectorAll<HTMLElement>('.suggest-add-btn').forEach((btn) => {
        btn.addEventListener('click', () => { const id = Number(btn.dataset['tmdbId']); if (resultMap[id]) addSeriesFromTmdb(resultMap[id]); });
      });
    } catch {
      const listEl = document.getElementById('suggestions-list');
      if (listEl) listEl.innerHTML = '<p class="text-xs text-zinc-500 col-span-full">Impossible de charger les suggestions.</p>';
    }
  } else {
    suggestSection.classList.remove('hidden');
    suggestSection.innerHTML = `
      <div class="flex justify-center py-3 border-t border-surface-border">
        <button id="suggest-more-btn" class="flex items-center gap-2 px-4 py-2 rounded-lg bg-surface-card border border-surface-border hover:border-brand/50 text-sm font-medium transition-colors text-zinc-400 hover:text-zinc-200">
          <i data-lucide="sparkles" class="w-4 h-4 text-brand"></i>
          Proposer des séries similaires
        </button>
      </div>`;
    createIcons({ icons, attrs: { 'stroke-width': '1.5' } });
    document.getElementById('suggest-more-btn')?.addEventListener('click', suggestMoreSeries);
  }
}

async function suggestMoreSeries(): Promise<void> {
  const allSeries = store.getAll();
  const topRated = allSeries
    .filter((s) => (s.status === 'completed' || s.status === 'watching') && s.tmdbId)
    .sort((a, b) => (b.rating ?? b.tmdbRating ?? 0) - (a.rating ?? a.tmdbRating ?? 0))
    .slice(0, MAX_RECOMMENDATION_SEED_SERIES)
    .map((s) => s.tmdbId as number);
  const alreadyIn = new Set(allSeries.map((s) => s.tmdbId).filter((id): id is number => id !== null));
  try {
    const results = topRated.length
      ? await tmdbClient.getRecommendationsForIds(topRated)
      : await tmdbClient.getPopularSeries();
    const filtered = results.filter((r) => !alreadyIn.has(r.id));
    if (!filtered.length) { showToast('Aucune nouvelle suggestion trouvée.', 'info'); return; }
    openSimilarSeriesModal(filtered, alreadyIn, addSeriesFromTmdb);
  } catch {
    showToast('Impossible de charger les suggestions.', 'error');
  }
}

// ─── AUTO BACKUP ─────────────────────────────
function setupAutoBackup(): void {
  if (autoBackupTimer !== null) {
    clearInterval(autoBackupTimer);
    autoBackupTimer = null;
  }
  if (appSettings.autoBackupInterval > 0) {
    autoBackupTimer = setInterval(() => {
      exportToCSV(store.getAll());
      appSettings.lastBackupAt = new Date().toISOString();
      saveSettings(appSettings);
      localStorage.setItem(LS_LAST_EXPORT, String(Date.now()));
      showToast('Sauvegarde automatique CSV téléchargée.', 'success');
      checkBackupReminder();
    }, appSettings.autoBackupInterval * 60 * 1000);
  }
}

function openSettingsModal(): void {
  const intervalInput = document.getElementById('settings-backup-interval') as HTMLInputElement | null;
  const lastBackupEl = document.getElementById('settings-last-backup');
  if (intervalInput) intervalInput.value = String(appSettings.autoBackupInterval || 0);
  if (lastBackupEl) {
    if (appSettings.lastBackupAt) {
      const d = new Date(appSettings.lastBackupAt);
      lastBackupEl.textContent = `Dernière sauvegarde : ${d.toLocaleString('fr-FR')}`;
    } else {
      lastBackupEl.textContent = 'Dernière sauvegarde : jamais';
    }
  }
  document.getElementById('modal-settings')?.classList.remove('hidden');
}

function closeSettingsModal(): void {
  document.getElementById('modal-settings')?.classList.add('hidden');
}

function saveSettingsFromModal(): void {
  const intervalInput = document.getElementById('settings-backup-interval') as HTMLInputElement | null;
  const val = parseInt(intervalInput?.value || '0');
  appSettings.autoBackupInterval = isNaN(val) || val < 0 ? 0 : Math.min(val, 1440);
  saveSettings(appSettings);
  setupAutoBackup();
  closeSettingsModal();
  showToast(
    appSettings.autoBackupInterval > 0
      ? `Sauvegarde automatique toutes les ${appSettings.autoBackupInterval} min.`
      : 'Sauvegarde automatique désactivée.',
    'success'
  );
}

// ─── BACKUP REMINDER ─────────────────────────
function checkBackupReminder(): void {
  const banner = document.getElementById('backup-banner');
  if (!banner) return;
  const total = store.getAll().length;
  if (total < BACKUP_REMINDER_THRESHOLD) { banner.classList.add('hidden'); return; }
  const lastExport = localStorage.getItem(LS_LAST_EXPORT);
  if (lastExport) {
    const daysSince = (Date.now() - parseInt(lastExport)) / (1000 * 60 * 60 * 24);
    if (daysSince < BACKUP_REMINDER_DAYS) { banner.classList.add('hidden'); return; }
  }
  banner.classList.remove('hidden');
}

// ─── API KEY MANAGEMENT ──────────────────────
function hasTmdbKey(): boolean {
  return !!(localStorage.getItem(LS_API_KEY) || '');
}

async function validateAndSaveTmdbKey(): Promise<void> {
  const input = document.getElementById('apikey-input') as HTMLInputElement | null;
  const errEl = document.getElementById('apikey-error');
  if (!input || !errEl) return;
  const key = input.value.trim();
  errEl.classList.add('hidden');
  if (!key) {
    errEl.textContent = 'Veuillez entrer une clé API.';
    errEl.classList.remove('hidden');
    return;
  }
  try {
    const params = new URLSearchParams({ api_key: key });
    const resp = await fetch(`${TMDB_BASE}/configuration?${params}`);
    if (resp.status === 401) {
      errEl.textContent = 'Clé API invalide. Vérifiez sur themoviedb.org.';
      errEl.classList.remove('hidden');
      return;
    }
    if (!resp.ok) {
      errEl.textContent = `Erreur de connexion (${resp.status}). Réessayez.`;
      errEl.classList.remove('hidden');
      return;
    }
    localStorage.setItem(LS_API_KEY, key);
    tmdbClient = new TmdbClient(key);
    closeApiKeyModal();
    showToast('Clé API TMDB enregistrée !', 'success');
  } catch {
    errEl.textContent = 'Impossible de contacter TMDB. Vérifiez votre connexion.';
    errEl.classList.remove('hidden');
  }
}

// ─── EDIT MODAL ──────────────────────────────
function openEditModal(id: string): void {
  const s = store.getAll().find((x) => x.id === id);
  if (!s) return;
  editingId = id;
  const titleEl = document.getElementById('edit-modal-title');
  const statusEl = document.getElementById('edit-status') as HTMLSelectElement | null;
  const ratingEl = document.getElementById('edit-rating') as HTMLInputElement | null;
  const dateEl = document.getElementById('edit-viewing-date') as HTMLInputElement | null;
  const notesEl = document.getElementById('edit-notes') as HTMLTextAreaElement | null;
  const tagsEl = document.getElementById('edit-tags') as HTMLInputElement | null;
  const genresEl = document.getElementById('edit-genres-display');
  const tmdbInfoEl = document.getElementById('edit-tmdb-info');
  if (titleEl) titleEl.textContent = s.name;
  if (statusEl) statusEl.value = s.status || 'watchlist';
  if (ratingEl) ratingEl.value = s.rating != null ? String(s.rating) : '';
  if (dateEl) dateEl.value = s.viewingDate || todayISO();
  const watchDateEl = document.getElementById('edit-watch-date') as HTMLInputElement | null;
  if (watchDateEl) watchDateEl.value = todayISO();
  if (notesEl) notesEl.value = s.notes || '';
  if (tagsEl) tagsEl.value = s.tags ? s.tags.join(', ') : '';
  if (genresEl) {
    genresEl.innerHTML = s.genres && s.genres.length
      ? s.genres
          .map((g) => `<span class="text-xs bg-zinc-800 text-zinc-400 px-2 py-0.5 rounded-full">${sanitize(g)}</span>`)
          .join('')
      : '<span class="text-xs text-zinc-600">–</span>';
  }
  if (tmdbInfoEl) {
    const parts: string[] = [];
    if (s.tmdbRating != null) parts.push(`<span title="Note TMDB">⭐ ${s.tmdbRating.toFixed(1)}/10</span>`);
    if (s.network) parts.push(`<span>${sanitize(s.network)}</span>`);
    if (s.originCountry) parts.push(`<span>${sanitize(s.originCountry)}</span>`);
    if (s.productionStatus) parts.push(`<span>${sanitize(s.productionStatus)}</span>`);
    if (s.createdBy) parts.push(`<span>Créateur : ${sanitize(s.createdBy)}</span>`);
    tmdbInfoEl.innerHTML = parts.length
      ? parts.map((p) => `<span class="text-xs text-zinc-500">${p}</span>`).join('<span class="text-zinc-700">·</span>')
      : '';
    tmdbInfoEl.classList.toggle('hidden', parts.length === 0);
  }
  renderEditEpisodesSection(s, (sid) => loadEpisodesForEditing(sid, store, tmdbClient));
  if (s.tmdbId && (!s.seasonsData || !s.seasonsData.length)) {
    loadEpisodesForEditing(id, store, tmdbClient);
  }
  document.getElementById('modal-edit')?.classList.remove('hidden');
  openEditModalFocus();
}

function saveEdit(): void {
  if (!editingId) return;
  const s = store.getAll().find((x) => x.id === editingId);
  if (!s) return;
  const statusEl = document.getElementById('edit-status') as HTMLSelectElement | null;
  const ratingEl = document.getElementById('edit-rating') as HTMLInputElement | null;
  const dateEl = document.getElementById('edit-viewing-date') as HTMLInputElement | null;
  const notesEl = document.getElementById('edit-notes') as HTMLTextAreaElement | null;
  const tagsEl = document.getElementById('edit-tags') as HTMLInputElement | null;
  const newStatus = (statusEl?.value || 'watchlist') as SeriesStatus;
  const r = parseFloat(ratingEl?.value || '');
  const rating = isNaN(r) ? null : Math.min(10, Math.max(0, r));
  const viewingDate = dateEl?.value || '';
  const watchDateEl = document.getElementById('edit-watch-date') as HTMLInputElement | null;
  const watchDate = watchDateEl?.value || todayISO();
  const notes = notesEl?.value.trim() || undefined;
  const tagsRaw = tagsEl?.value || '';
  const tags = tagsRaw
    ? tagsRaw
        .split(',')
        .map((t) => t.trim())
        .filter(Boolean)
    : undefined;

  const updated = { ...s, status: newStatus, rating, viewingDate, notes, tags };

  // Collect watched episodes from checkboxes (or mark all if completed)
  let watchedEpisodes = s.watchedEpisodes;
  if (newStatus === 'completed') {
    markAllEpisodesWatched(updated);
    watchedEpisodes = updated.watchedEpisodes;
  } else {
    const container = document.getElementById('edit-episodes-section');
    const seasonsData = s.seasonsData || [];
    if (container && seasonsData.length) {
      const newWatched: Record<string, number[]> = {};
      seasonsData.forEach((season) => {
        const sn = String(season.season_number);
        const epChecks = container.querySelectorAll<HTMLInputElement>(`[data-ep-season="${sn}"]`);
        newWatched[sn] = Array.from(epChecks)
          .filter((e) => e.checked)
          .map((e) => parseInt(e.dataset['epNum'] || '0'));
      });
      updated.watchedEpisodes = newWatched;
      watchedEpisodes = newWatched;
    }
  }

  // Record new watched episodes in watchHistory — grouped by season/series
  const today = watchDate;
  const existingHistory = s.watchHistory || [];
  // Keep existing history for episodes that are still watched
  const retainedHistory = existingHistory.filter((h) => {
    // Always keep season/series level entries - they represent bulk actions
    if (h.type === 'season' || h.type === 'series') {
      const sn = String(h.season);
      const seasonData = (s.seasonsData || []).find((sd) => String(sd.season_number) === sn);
      if (h.type === 'series') {
        // Keep series entry if any episode is still watched
        return Object.values(watchedEpisodes).some((eps) => eps.length > 0);
      }
      if (seasonData) {
        // Keep season entry if most episodes of that season are still watched
        const watchedCount = (watchedEpisodes[sn] || []).length;
        return watchedCount > 0;
      }
    }
    // For episode-level entries, keep if episode is still watched
    const sn = String(h.season);
    return (watchedEpisodes[sn] || []).includes(h.episode);
  });

  const newHistory: WatchHistoryEntry[] = [...retainedHistory];

  // Determine what was newly watched
  const seasonsData = s.seasonsData || [];
  const allNewlyWatchedSeasons: string[] = [];

  Object.entries(watchedEpisodes).forEach(([sn, eps]) => {
    const oldEps = s.watchedEpisodes[sn] || [];
    const newEps = eps.filter((ep) => !oldEps.includes(ep));
    if (!newEps.length) return;

    const seasonData = seasonsData.find((sd) => String(sd.season_number) === sn);
    const totalInSeason = seasonData ? seasonData.episode_count : eps.length;
    const allNewSeasonWatched = eps.length >= totalInSeason && newEps.length > 0;

    if (allNewSeasonWatched) {
      // All (or remaining) episodes of this season were just watched — one season entry
      allNewlyWatchedSeasons.push(sn);
      // Remove any individual episode entries for this season from new history
      const prevEpisodeEntries = newHistory.filter(
        (h) => String(h.season) === sn && (!h.type || h.type === 'episode')
      );
      prevEpisodeEntries.forEach((e) => {
        const idx = newHistory.indexOf(e);
        if (idx !== -1) newHistory.splice(idx, 1);
      });
      newHistory.push({
        season: Number(sn),
        episode: 0,
        watchedAt: today,
        type: 'season',
        seasonLabel: seasonData?.name || `Saison ${sn}`,
        episodeCount: totalInSeason,
      });
    } else {
      // Individual episodes
      newEps.forEach((ep) => {
        newHistory.push({ season: Number(sn), episode: ep, watchedAt: today, type: 'episode' });
      });
    }
  });

  // Check if ALL seasons were completed in this save → collapse to one series entry
  const allSeasonsDone =
    seasonsData.length > 0 &&
    seasonsData.every((sd) => {
      const sn = String(sd.season_number);
      return (watchedEpisodes[sn] || []).length >= sd.episode_count;
    });

  if (allSeasonsDone && allNewlyWatchedSeasons.length > 0 && newStatus === 'completed') {
    // Remove individual season entries added in this save, replace with one series entry
    allNewlyWatchedSeasons.forEach((sn) => {
      const idx = newHistory.findIndex(
        (h) => String(h.season) === sn && h.type === 'season'
      );
      if (idx !== -1) newHistory.splice(idx, 1);
    });
    // Only add a series entry if one doesn't already exist
    const hasSeriesEntry = newHistory.some((h) => h.type === 'series');
    if (!hasSeriesEntry) {
      newHistory.push({
        season: 0,
        episode: 0,
        watchedAt: today,
        type: 'series',
        episodeCount: seasonsData.reduce((sum, sd) => sum + sd.episode_count, 0),
      });
    }
  }

  updated.watchHistory = newHistory;

  updateCurrentSeasonFromWatched(updated);

  const wasCompleted = s.status !== 'completed' && newStatus === 'completed';
  store.update(editingId, updated);
  closeEditModal();
  updateUI();
  showToast('Série mise à jour !', 'success');

  // Offer similar series suggestions after completing
  if (wasCompleted && s.tmdbId && hasTmdbKey()) {
    suggestSimilarSeries(s.tmdbId);
  }
}

function deleteSeries(): void {
  if (!editingId) return;
  const s = store.getAll().find((x) => x.id === editingId);
  if (!s) return;
  const deletedSeries = { ...s };
  const name = s.name;
  store.remove(editingId);
  editingId = null;
  closeEditModal();
  updateUI();
  showToast(
    name ? `"${name}" supprimée.` : 'Série supprimée.',
    'info',
    {
      label: 'Annuler',
      onClick: () => {
        store.add(deletedSeries);
        updateUI();
        showToast(`"${name}" restaurée.`, 'success');
      },
    }
  );
}

// ─── FAVOURITE TOGGLE ────────────────────────
function toggleFavourite(id: string): void {
  const s = store.getAll().find((x) => x.id === id);
  if (!s) return;
  store.update(id, { isFavourite: !s.isFavourite });
  updateUI();
}

// ─── SIMILAR SERIES ──────────────────────────
async function suggestSimilarSeries(tmdbId: number): Promise<void> {
  try {
    const similar = await tmdbClient.getSimilarSeries(tmdbId);
    if (!similar.length) return;
    const alreadyIn = new Set(store.getAll().map((s) => s.tmdbId).filter((id): id is number => id !== null));
    openSimilarSeriesModal(similar, alreadyIn, addSeriesFromTmdb);
  } catch {
    // silently ignore; suggestions are non-critical
  }
}

// ─── BULK OPERATIONS ─────────────────────────
function updateBulkToolbar(): void {
  const toolbar = document.getElementById('bulk-toolbar');
  const countEl = document.getElementById('bulk-count');
  if (!toolbar) return;
  if (bulkMode) {
    toolbar.classList.remove('hidden');
    if (countEl) countEl.textContent = String(selectedIds.size);
  } else {
    toolbar.classList.add('hidden');
    selectedIds.clear();
  }
}

function exitBulkMode(): void {
  bulkMode = false;
  selectedIds.clear();
  document.getElementById('btn-bulk-select')?.setAttribute('aria-pressed', 'false');
  updateUI();
}

// ─── ADD MODAL & TMDB SEARCH ─────────────────
function openAddModal(): void {
  if (!hasTmdbKey()) {
    showApiKeyModal();
    return;
  }
  const searchInput = document.getElementById('tmdb-search-input') as HTMLInputElement | null;
  const suggestionsEl = document.getElementById('tmdb-suggestions');
  const errorEl = document.getElementById('tmdb-error');
  const loadingEl = document.getElementById('tmdb-loading');
  if (searchInput) searchInput.value = '';
  if (suggestionsEl) {
    suggestionsEl.innerHTML = '';
    suggestionsEl.classList.add('hidden');
  }
  errorEl?.classList.add('hidden');
  loadingEl?.classList.add('hidden');
  document.getElementById('modal-add')?.classList.remove('hidden');
  openAddModalFocus();
}

async function handleTmdbSearch(query: string, signal: AbortSignal): Promise<void> {
  const suggestionsEl = document.getElementById('tmdb-suggestions');
  const errorEl = document.getElementById('tmdb-error');
  const loadingEl = document.getElementById('tmdb-loading');
  const errorMsgEl = document.getElementById('tmdb-error-msg');
  errorEl?.classList.add('hidden');
  if (!query.trim()) {
    suggestionsEl?.classList.add('hidden');
    if (suggestionsEl) suggestionsEl.innerHTML = '';
    return;
  }
  loadingEl?.classList.remove('hidden');
  suggestionsEl?.classList.add('hidden');
  try {
    const results = await tmdbClient.searchSeries(query, signal);
    if (signal.aborted) return;
    loadingEl?.classList.add('hidden');
    if (!results.length) {
      if (errorMsgEl) errorMsgEl.textContent = 'Aucune série trouvée pour ce titre.';
      errorEl?.classList.remove('hidden');
      return;
    }
    const resultMap: Record<number, TmdbSearchResult> = {};
    if (suggestionsEl) {
      suggestionsEl.innerHTML = results
        .slice(0, TMDB_SUGGESTIONS_LIMIT)
        .map((r, i) => {
          resultMap[i] = r;
          const imgSrc = r.poster_path
            ? IMG_BASE + r.poster_path
            : 'https://placehold.co/60x90/27272a/6366f1?text=?';
          return `<button class="suggestion-item w-full flex items-center gap-3 p-3 text-left transition-colors" data-result-index="${i}">
            <img src="${sanitize(imgSrc)}" alt="" class="w-10 h-14 object-cover rounded shrink-0" />
            <div class="overflow-hidden">
              <p class="font-medium text-sm truncate">${sanitize(r.name)}</p>
              <p class="text-xs text-zinc-400">${r.first_air_date ? sanitize(r.first_air_date.slice(0, 4)) : '–'}</p>
              <p class="text-xs text-zinc-500 line-clamp-2 mt-0.5">${sanitize(r.overview || '')}</p>
            </div>
          </button>`;
        })
        .join('');
      suggestionsEl.classList.remove('hidden');
      suggestionsEl.querySelectorAll<HTMLElement>('.suggestion-item').forEach((btn) => {
        btn.addEventListener('click', () => {
          const idx = Number(btn.dataset['resultIndex']);
          const result = resultMap[idx];
          if (result) addSeriesFromTmdb(result);
        });
      });
    }
  } catch (err) {
    if (signal.aborted) return;
    loadingEl?.classList.add('hidden');
    if (errorMsgEl)
      errorMsgEl.textContent = `Erreur API TMDB : ${err instanceof Error ? err.message : 'Erreur inconnue'}`;
    errorEl?.classList.remove('hidden');
  }
}

async function addSeriesFromTmdb(tmdbResult: TmdbSearchResult): Promise<void> {
  if (store.has(tmdbResult.id)) {
    showToast('Cette série est déjà dans votre liste.', 'info');
    return;
  }
  // Warn on near-duplicate name
  if (store.hasSimilarName(tmdbResult.name)) {
    showToast(`⚠️ Une série nommée "${tmdbResult.name}" est déjà dans votre liste.`, 'info');
  }
  const details = await tmdbClient.getSeriesDetails(tmdbResult.id).catch(() => null);
  const seasonsData = extractSeasonsData(
    details ?? {
      id: 0,
      name: '',
      number_of_seasons: 0,
      number_of_episodes: 0,
      episode_run_time: [],
      seasons: [],
    }
  );
  const genres = details?.genres?.map((g) => g.name) ?? [];
  const series = {
    id: generateId(),
    tmdbId: tmdbResult.id,
    name: tmdbResult.name,
    status: 'watchlist' as const,
    rating: null,
    season: 1,
    totalSeasons: details ? details.number_of_seasons || null : null,
    year: tmdbResult.first_air_date ? tmdbResult.first_air_date.slice(0, 4) : '',
    poster: tmdbResult.poster_path || '',
    overview: tmdbResult.overview || '',
    episodesTotal: details ? details.number_of_episodes || null : null,
    episodeRuntime:
      details && details.episode_run_time && details.episode_run_time[0]
        ? details.episode_run_time[0]
        : null,
    viewingDate: todayISO(),
    seasonsData,
    watchedEpisodes: {},
    genres: genres.length ? genres : undefined,
    network: details?.networks?.[0]?.name || undefined,
    originCountry: details?.origin_country?.[0] || undefined,
    originalLanguage: details?.original_language || undefined,
    tmdbRating: details?.vote_average || undefined,
    productionStatus: details?.status || undefined,
    createdBy: details?.created_by?.map((c) => c.name).join(', ') || undefined,
  };
  store.add(series);
  closeSimilarSeriesModal();
  closeAddModal();
  updateUI();
  showToast(`"${series.name}" ajoutée à la watchlist !`, 'success');
}

// ─── JSON EXPORT/IMPORT ──────────────────────
function exportJSON(): void {
  const data = JSON.stringify(store.getAll(), null, 2);
  const blob = new Blob([data], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `serie-manager-${todayISO()}.json`;
  a.click();
  URL.revokeObjectURL(url);
  localStorage.setItem(LS_LAST_EXPORT, String(Date.now()));
  showToast('Export JSON téléchargé !', 'success');
  checkBackupReminder();
}

function importJSON(file: File): void {
  const reader = new FileReader();
  reader.onload = (e) => {
    try {
      const parsed = JSON.parse(e.target?.result as string);
      if (!Array.isArray(parsed)) throw new Error('Format invalide');
      let imported = 0;
      parsed.forEach((s) => {
        if (s && s.id && s.name && s.status) {
          if (!store.getAll().some((x) => x.id === s.id)) {
            store.add(s);
            imported++;
          }
        }
      });
      updateUI();
      showToast(`${imported} série(s) importée(s) depuis JSON.`, 'success');
    } catch {
      showToast('Fichier JSON invalide.', 'error');
    }
  };
  reader.readAsText(file);
}


// ─── SORT ────────────────────────────────────
function applySort(value: SortOption): void {
  sortBy = value;
  localStorage.setItem(LS_SORT_PREF, value);
  updateUI();
}

// ─── VIEW TOGGLE ─────────────────────────────
function applyViewToggle(list: boolean): void {
  listView = list;
  localStorage.setItem(LS_VIEW_PREF, list ? 'list' : 'grid');
  const gridBtn = document.getElementById('btn-view-grid');
  const listBtn = document.getElementById('btn-view-list');
  if (gridBtn) gridBtn.classList.toggle('text-brand', !list);
  if (listBtn) listBtn.classList.toggle('text-brand', list);
  updateUI();
}

// ─── THEME TOGGLE ────────────────────────────
function applyTheme(light: boolean): void {
  document.documentElement.classList.toggle('light-mode', light);
  localStorage.setItem(LS_THEME, light ? 'light' : 'dark');
  const themeBtn = document.getElementById('btn-theme');
  const icon = themeBtn?.querySelector('[data-lucide]');
  if (icon) {
    icon.setAttribute('data-lucide', light ? 'moon' : 'sun');
    createIcons({ icons });
  }
  if (themeBtn) themeBtn.title = light ? 'Passer en mode sombre' : 'Passer en mode clair';
}


// ─── EVENT LISTENERS ─────────────────────────
function setupEventListeners(): void {
  document.getElementById('btn-add')?.addEventListener('click', openAddModal);
  document.getElementById('empty-add-btn')?.addEventListener('click', openAddModal);
  document.getElementById('modal-close')?.addEventListener('click', closeAddModal);
  document.getElementById('edit-modal-close')?.addEventListener('click', () => {
    editingId = null;
    closeEditModal();
  });
  document.getElementById('edit-save')?.addEventListener('click', saveEdit);
  document.getElementById('edit-delete')?.addEventListener('click', deleteSeries);

  document.getElementById('btn-export')?.addEventListener('click', () => {
    exportToCSV(store.getAll());
    localStorage.setItem(LS_LAST_EXPORT, String(Date.now()));
    showToast('Export CSV téléchargé !', 'success');
    checkBackupReminder();
  });

  document.getElementById('btn-export-json')?.addEventListener('click', exportJSON);

  document.getElementById('json-import-input')?.addEventListener('change', (e) => {
    const file = (e.target as HTMLInputElement).files?.[0];
    if (file) importJSON(file);
    (e.target as HTMLInputElement).value = '';
  });

  document.getElementById('btn-gdrive')?.addEventListener('click', () => {
    const clientId = localStorage.getItem(LS_GD_KEY) || '';
    if (!clientId) {
      openGdSetupModal();
      return;
    }
    const csv = generateCSV(store.getAll());
    saveToGoogleDrive(
      clientId,
      csv,
      () => {
        localStorage.setItem(LS_LAST_EXPORT, String(Date.now()));
        showToast('CSV sauvegardé sur Google Drive !', 'success');
        checkBackupReminder();
      },
      (msg) => showToast(msg, 'error')
    );
  });

  document.getElementById('btn-apikey')?.addEventListener('click', showApiKeyModal);
  document.getElementById('btn-settings')?.addEventListener('click', openSettingsModal);
  document.getElementById('settings-modal-close')?.addEventListener('click', closeSettingsModal);
  document.getElementById('settings-save')?.addEventListener('click', saveSettingsFromModal);
  document.getElementById('modal-settings')?.addEventListener('click', (e) => {
    if (e.target === document.getElementById('modal-settings')) closeSettingsModal();
  });
  document.getElementById('apikey-close')?.addEventListener('click', closeApiKeyModal);
  document.getElementById('apikey-save')?.addEventListener('click', validateAndSaveTmdbKey);
  (document.getElementById('apikey-input') as HTMLInputElement | null)?.addEventListener(
    'keydown',
    (e) => {
      if (e.key === 'Enter') validateAndSaveTmdbKey();
    }
  );

  document.getElementById('gd-setup-close')?.addEventListener('click', closeGdSetupModal);
  document.getElementById('gd-setup-cancel')?.addEventListener('click', closeGdSetupModal);
  document.getElementById('gd-setup-save')?.addEventListener('click', () => {
    const input = document.getElementById('gd-clientid-input') as HTMLInputElement | null;
    const id = input?.value.trim() || '';
    if (!id) return;
    localStorage.setItem(LS_GD_KEY, id);
    closeGdSetupModal();
    showToast('Client ID Google Drive enregistré !', 'success');
    const csv = generateCSV(store.getAll());
    saveToGoogleDrive(
      id,
      csv,
      () => {
        localStorage.setItem(LS_LAST_EXPORT, String(Date.now()));
        showToast('CSV sauvegardé sur Google Drive !', 'success');
        checkBackupReminder();
      },
      (msg) => showToast(msg, 'error')
    );
  });

  document.getElementById('modal-add')?.addEventListener('click', (e) => {
    if (e.target === document.getElementById('modal-add')) closeAddModal();
  });
  document.getElementById('modal-edit')?.addEventListener('click', (e) => {
    if (e.target === document.getElementById('modal-edit')) {
      editingId = null;
      closeEditModal();
    }
  });
  document.getElementById('modal-gd-setup')?.addEventListener('click', (e) => {
    if (e.target === document.getElementById('modal-gd-setup')) closeGdSetupModal();
  });
  document.getElementById('modal-help')?.addEventListener('click', (e) => {
    if (e.target === document.getElementById('modal-help')) closeHelpModal();
  });
  document.getElementById('help-modal-close')?.addEventListener('click', closeHelpModal);
  document.getElementById('modal-similar')?.addEventListener('click', (e) => {
    if (e.target === document.getElementById('modal-similar')) closeSimilarSeriesModal();
  });
  document.getElementById('similar-modal-close')?.addEventListener('click', closeSimilarSeriesModal);
  document.getElementById('similar-modal-skip')?.addEventListener('click', closeSimilarSeriesModal);

  // Theme toggle
  document.getElementById('btn-theme')?.addEventListener('click', () => {
    const isLight = document.documentElement.classList.contains('light-mode');
    applyTheme(!isLight);
  });

  // Help modal trigger
  document.getElementById('btn-help')?.addEventListener('click', openHelpModal);

  document.getElementById('search-input')?.addEventListener('input', (e) => {
    searchQuery = (e.target as HTMLInputElement).value;
    updateUI();
  });

  document.getElementById('tmdb-search-input')?.addEventListener('input', (e) => {
    const query = (e.target as HTMLInputElement).value;
    if (searchDebounce !== null) clearTimeout(searchDebounce);
    searchAbort?.abort();
    searchAbort = new AbortController();
    const ctrl = searchAbort;
    searchDebounce = setTimeout(() => {
      handleTmdbSearch(query, ctrl.signal);
    }, TMDB_SEARCH_DEBOUNCE_MS);
  });

  document.querySelectorAll<HTMLElement>('.nav-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      const filter = btn.dataset['filter'] || 'all';
      document.querySelectorAll<HTMLElement>('.nav-btn').forEach((b) => {
        b.classList.remove('bg-brand', 'text-white');
        b.classList.add('text-zinc-400', 'hover:bg-surface-border', 'hover:text-white');
      });
      btn.classList.add('bg-brand', 'text-white');
      btn.classList.remove('text-zinc-400', 'hover:bg-surface-border', 'hover:text-white');

      if (filter === 'stats') {
        activeView = 'stats';
        const titleEl = document.getElementById('section-title');
        if (titleEl) titleEl.textContent = 'Statistiques';
        applyView();
        renderSidebarCounts(store);
        return;
      }

      activeView = 'series';
      activeFilter = filter;
      const titles: Record<string, string> = {
        all: 'Toutes les séries',
        watching: 'En cours',
        completed: 'Terminées',
        watchlist: 'Watchlist',
        favourites: 'Favoris',
        abandoned: 'Abandonnées',
        'on-hold': 'En pause',
        'waiting-platform': 'En attente de plateforme',
      };
      const titleEl = document.getElementById('section-title');
      if (titleEl) titleEl.textContent = titles[activeFilter] || 'Séries';
      updateUI();
      applyView();
    });
  });

  // Status popup actions
  document.getElementById('status-popup')?.querySelectorAll<HTMLElement>('[data-set-status]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const id = statusPopupTargetId;
      const newStatus = btn.dataset['setStatus'] as SeriesStatus;
      hideStatusPopup();
      if (!id || !newStatus) return;
      const s = store.getAll().find((x) => x.id === id);
      if (!s) return;
      const updated = { ...s, status: newStatus };
      if (newStatus === 'completed') {
        markAllEpisodesWatched(updated);
        const today = todayISO();
        const seasonsData = s.seasonsData || [];
        const totalEps = seasonsData.reduce((sum, sd) => sum + sd.episode_count, 0);
        const existingHistory = s.watchHistory || [];
        if (!existingHistory.some((h) => h.type === 'series')) {
          updated.watchHistory = [
            ...existingHistory,
            { season: 0, episode: 0, watchedAt: today, type: 'series' as const, episodeCount: totalEps || (s.episodesTotal ?? undefined) },
          ];
        }
      }
      updateCurrentSeasonFromWatched(updated);
      store.update(id, updated);
      updateUI();
      showToast(`"${s.name}" → ${statusLabel(newStatus)}`, 'success');
      if (newStatus === 'completed' && s.tmdbId && hasTmdbKey()) suggestSimilarSeries(s.tmdbId);
    });
  });

  // Close status popup on outside click
  document.addEventListener('click', (e) => {
    const popup = document.getElementById('status-popup');
    if (!popup || popup.classList.contains('hidden')) return;
    const target = e.target as HTMLElement;
    if (!popup.contains(target) && !target.closest('[data-status-id]')) hideStatusPopup();
  });

  document.getElementById('csv-import-input')?.addEventListener('change', (e) => {
    const file = (e.target as HTMLInputElement).files?.[0];
    if (file) {
      importCSV(
        file,
        (series) => {
          series.forEach((s) => store.add(s));
          updateUI();
          showToast(`${series.length} série(s) importée(s).`, 'success');
        },
        (msg) => showToast(msg, 'error')
      );
    }
    (e.target as HTMLInputElement).value = '';
  });

  // Sort dropdown
  document.getElementById('sort-select')?.addEventListener('change', (e) => {
    applySort((e.target as HTMLSelectElement).value as SortOption);
  });

  // View toggle buttons
  document.getElementById('btn-view-grid')?.addEventListener('click', () => applyViewToggle(false));
  document.getElementById('btn-view-list')?.addEventListener('click', () => applyViewToggle(true));

  // Bulk select toggle
  document.getElementById('btn-bulk-select')?.addEventListener('click', () => {
    bulkMode = !bulkMode;
    document.getElementById('btn-bulk-select')?.setAttribute('aria-pressed', String(bulkMode));
    if (!bulkMode) selectedIds.clear();
    updateUI();
  });

  // Bulk toolbar actions
  document.getElementById('bulk-delete')?.addEventListener('click', () => {
    if (!selectedIds.size) return;
    const count = selectedIds.size;
    selectedIds.forEach((id) => store.remove(id));
    exitBulkMode();
    showToast(`${count} série(s) supprimée(s).`, 'info');
  });

  document.getElementById('bulk-watchlist')?.addEventListener('click', () => {
    selectedIds.forEach((id) => {
      const s = store.getAll().find((x) => x.id === id);
      if (s) store.update(id, { status: 'watchlist' });
    });
    exitBulkMode();
    showToast('Statut mis à jour.', 'success');
  });

  document.getElementById('bulk-watching')?.addEventListener('click', () => {
    selectedIds.forEach((id) => {
      const s = store.getAll().find((x) => x.id === id);
      if (s) store.update(id, { status: 'watching' });
    });
    exitBulkMode();
    showToast('Statut mis à jour.', 'success');
  });

  document.getElementById('bulk-completed')?.addEventListener('click', () => {
    selectedIds.forEach((id) => {
      const s = store.getAll().find((x) => x.id === id);
      if (s) {
        const updated = { ...s, status: 'completed' as const };
        markAllEpisodesWatched(updated);
        store.update(id, updated);
      }
    });
    exitBulkMode();
    showToast('Statut mis à jour.', 'success');
  });

  document.getElementById('bulk-cancel')?.addEventListener('click', exitBulkMode);

  // Delegated bulk checkbox listener on series grid
  document.getElementById('series-grid')?.addEventListener('change', (e) => {
    const target = e.target as HTMLInputElement;
    if (!target.classList.contains('bulk-checkbox')) return;
    const id = target.dataset['bulkId'];
    if (!id) return;
    if (target.checked) selectedIds.add(id);
    else selectedIds.delete(id);
    const countEl = document.getElementById('bulk-count');
    if (countEl) countEl.textContent = String(selectedIds.size);
  });

  // Backup reminder dismiss
  document.getElementById('backup-dismiss')?.addEventListener('click', () => {
    localStorage.setItem(LS_LAST_EXPORT, String(Date.now()));
    document.getElementById('backup-banner')?.classList.add('hidden');
  });

  // Data integrity banner dismiss
  document.getElementById('data-error-dismiss')?.addEventListener('click', () => {
    document.getElementById('data-error-banner')?.classList.add('hidden');
  });

  // Stats section collapse toggle (PC only)
  document.getElementById('stats-toggle')?.addEventListener('click', () => {
    statsCollapsed = !statsCollapsed;
    localStorage.setItem(LS_STATS_COLLAPSED, String(statsCollapsed));
    applyStatsCollapsed();
  });

  // IDB migration banner
  document.getElementById('idb-migrate-btn')?.addEventListener('click', async () => {
    try {
      await store.migrateToIDB();
      localStorage.setItem(LS_IDB_MIGRATED, 'true');
      document.getElementById('idb-migration-banner')?.classList.add('hidden');
      showToast('Données migrées vers IndexedDB !', 'success');
    } catch {
      showToast('Erreur lors de la migration.', 'error');
    }
  });
  document.getElementById('idb-migrate-dismiss')?.addEventListener('click', () => {
    localStorage.setItem(LS_IDB_MIGRATED, 'skipped');
    document.getElementById('idb-migration-banner')?.classList.add('hidden');
  });

  // Sidebar collapse
  document.getElementById('sidebar-toggle')?.addEventListener('click', () => {
    const sidebar = document.getElementById('sidebar');
    sidebar?.classList.toggle('sidebar-collapsed');
    const icon = document.querySelector('#sidebar-toggle [data-lucide]');
    if (icon) {
      const isCollapsed = sidebar?.classList.contains('sidebar-collapsed');
      icon.setAttribute('data-lucide', isCollapsed ? 'panel-left-open' : 'panel-left-close');
      createIcons({ icons });
    }
  });

  // Keyboard shortcuts (global)
  document.addEventListener('keydown', (e) => {
    const tag = (document.activeElement as HTMLElement)?.tagName;
    const inInput = tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT';

    if (e.key === 'Escape') {
      closeAddModal();
      editingId = null;
      closeEditModal();
      closeGdSetupModal();
      closeHelpModal();
      closeSimilarSeriesModal();
      closeSettingsModal();
      hideStatusPopup();
      if (hasTmdbKey()) closeApiKeyModal();
      if (bulkMode) exitBulkMode();
      return;
    }

    // Shortcuts only when not typing in a field and no modal open
    const anyModalOpen = !!(
      document.getElementById('modal-add')?.classList.contains('hidden') === false ||
      document.getElementById('modal-edit')?.classList.contains('hidden') === false ||
      document.getElementById('modal-apikey')?.classList.contains('hidden') === false ||
      document.getElementById('modal-help')?.classList.contains('hidden') === false ||
      document.getElementById('modal-similar')?.classList.contains('hidden') === false ||
      document.getElementById('modal-settings')?.classList.contains('hidden') === false
    );
    if (inInput || anyModalOpen) return;

    switch (e.key) {
      case '?':
        e.preventDefault();
        openHelpModal();
        break;
      case 'n':
        e.preventDefault();
        openAddModal();
        break;
      case 'g':
        e.preventDefault();
        applyViewToggle(false);
        break;
      case 'l':
        e.preventDefault();
        applyViewToggle(true);
        break;
      case 'b':
        e.preventDefault();
        bulkMode = !bulkMode;
        document.getElementById('btn-bulk-select')?.setAttribute('aria-pressed', String(bulkMode));
        if (!bulkMode) selectedIds.clear();
        updateUI();
        break;
    }
  });
}

// ─── INITIALISE ──────────────────────────────
store.load();
createIcons({ icons });
setupEventListeners();

// Show error banner if localStorage data was corrupt
if (store.hadLoadError()) {
  document.getElementById('data-error-banner')?.classList.remove('hidden');
}

// Apply persisted theme
applyTheme(localStorage.getItem(LS_THEME) === 'light');

// Apply persisted view pref to buttons
applyViewToggle(listView);

// Apply persisted sort pref to dropdown
const sortSelectEl = document.getElementById('sort-select') as HTMLSelectElement | null;
if (sortSelectEl) sortSelectEl.value = sortBy;

updateUI();
applyView();
if (!hasTmdbKey()) showApiKeyModal();

// Start auto-backup if configured
setupAutoBackup();

// Try IndexedDB — offer migration if localStorage data exists but IDB is empty
store.initFromDB().then((hadIdbData) => {
  if (hadIdbData) {
    updateUI();
  } else if (store.hasLocalStorageData() && !localStorage.getItem(LS_IDB_MIGRATED)) {
    document.getElementById('idb-migration-banner')?.classList.remove('hidden');
  }
});
