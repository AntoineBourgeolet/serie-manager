import { createIcons, icons } from 'lucide';
import { SeriesStore } from './store/seriesStore';
import { TmdbClient } from './api/tmdb';
import {
  LS_API_KEY,
  LS_GD_KEY,
  TMDB_BASE,
  TMDB_SEARCH_DEBOUNCE_MS,
  TMDB_SUGGESTIONS_LIMIT,
  IMG_BASE,
} from './config/constants';
import { generateId, todayISO, statusLabel, nextStatus } from './utils/formatting';
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
  closeEditModal,
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
import type { TmdbSearchResult } from './types';

// ─── STATE ───────────────────────────────────
const store = new SeriesStore();
let tmdbClient = new TmdbClient(localStorage.getItem(LS_API_KEY) || '');
let activeFilter = 'all';
let searchQuery = '';
let editingId: string | null = null;
let searchDebounce: ReturnType<typeof setTimeout> | null = null;
let searchAbort: AbortController | null = null;

// ─── UI UPDATE ───────────────────────────────
function updateUI(): void {
  renderStats(store);
  renderGrid(store, activeFilter, searchQuery, openEditModal, quickChangeStatus);
  renderSidebarCounts(store);
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
  if (titleEl) titleEl.textContent = s.name;
  if (statusEl) statusEl.value = s.status || 'watchlist';
  if (ratingEl) ratingEl.value = s.rating != null ? String(s.rating) : '';
  if (dateEl) dateEl.value = s.viewingDate || todayISO();
  renderEditEpisodesSection(s, (sid) => loadEpisodesForEditing(sid, store, tmdbClient));
  if (s.tmdbId && (!s.seasonsData || !s.seasonsData.length)) {
    loadEpisodesForEditing(id, store, tmdbClient);
  }
  document.getElementById('modal-edit')?.classList.remove('hidden');
}

function saveEdit(): void {
  if (!editingId) return;
  const s = store.getAll().find((x) => x.id === editingId);
  if (!s) return;
  const statusEl = document.getElementById('edit-status') as HTMLSelectElement | null;
  const ratingEl = document.getElementById('edit-rating') as HTMLInputElement | null;
  const dateEl = document.getElementById('edit-viewing-date') as HTMLInputElement | null;
  const newStatus = (statusEl?.value || 'watchlist') as 'watchlist' | 'watching' | 'completed';
  const r = parseFloat(ratingEl?.value || '');
  const rating = isNaN(r) ? null : Math.min(10, Math.max(0, r));
  const viewingDate = dateEl?.value || '';
  const updated = { ...s, status: newStatus, rating, viewingDate };

  if (newStatus === 'completed') {
    markAllEpisodesWatched(updated);
  } else {
    const container = document.getElementById('edit-episodes-section');
    const seasonsData = s.seasonsData || [];
    if (container && seasonsData.length) {
      const watchedEpisodes: Record<string, number[]> = {};
      seasonsData.forEach((season) => {
        const sn = String(season.season_number);
        const epChecks = container.querySelectorAll<HTMLInputElement>(`[data-ep-season="${sn}"]`);
        watchedEpisodes[sn] = Array.from(epChecks)
          .filter((e) => e.checked)
          .map((e) => parseInt(e.dataset['epNum'] || '0'));
      });
      updated.watchedEpisodes = watchedEpisodes;
    }
  }

  updateCurrentSeasonFromWatched(updated);
  store.update(editingId, updated);
  closeEditModal();
  updateUI();
  showToast('Série mise à jour !', 'success');
}

function deleteSeries(): void {
  if (!editingId) return;
  const s = store.getAll().find((x) => x.id === editingId);
  const name = s?.name || '';
  store.remove(editingId);
  editingId = null;
  closeEditModal();
  updateUI();
  showToast(name ? `"${name}" supprimée.` : 'Série supprimée.', 'info');
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
  searchInput?.focus();
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
  };
  store.add(series);
  closeAddModal();
  updateUI();
  showToast(`"${series.name}" ajoutée à la watchlist !`, 'success');
}

function quickChangeStatus(id: string): void {
  const s = store.getAll().find((x) => x.id === id);
  if (!s) return;
  const newStatus = nextStatus(s.status);
  const updated = { ...s, status: newStatus };
  if (newStatus === 'completed') markAllEpisodesWatched(updated);
  store.update(id, updated);
  updateUI();
  showToast(`"${s.name}" → ${statusLabel(newStatus)}`, 'success');
}

// ─── EVENT LISTENERS ─────────────────────────
function setupEventListeners(): void {
  document.getElementById('btn-add')?.addEventListener('click', openAddModal);
  document.getElementById('modal-close')?.addEventListener('click', closeAddModal);
  document.getElementById('edit-modal-close')?.addEventListener('click', () => {
    editingId = null;
    closeEditModal();
  });
  document.getElementById('edit-save')?.addEventListener('click', saveEdit);
  document.getElementById('edit-delete')?.addEventListener('click', deleteSeries);

  document.getElementById('btn-export')?.addEventListener('click', () => {
    exportToCSV(store.getAll());
    showToast('Export CSV téléchargé !', 'success');
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
      () => showToast('CSV sauvegardé sur Google Drive !', 'success'),
      (msg) => showToast(msg, 'error')
    );
  });

  document.getElementById('btn-apikey')?.addEventListener('click', showApiKeyModal);
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
      () => showToast('CSV sauvegardé sur Google Drive !', 'success'),
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
      activeFilter = btn.dataset['filter'] || 'all';
      document.querySelectorAll<HTMLElement>('.nav-btn').forEach((b) => {
        b.classList.remove('bg-brand', 'text-white');
        b.classList.add('text-zinc-400', 'hover:bg-surface-border', 'hover:text-white');
      });
      btn.classList.add('bg-brand', 'text-white');
      btn.classList.remove('text-zinc-400', 'hover:bg-surface-border', 'hover:text-white');
      const titles: Record<string, string> = {
        all: 'Toutes les séries',
        watching: 'En cours',
        completed: 'Terminées',
        watchlist: 'Watchlist',
      };
      const titleEl = document.getElementById('section-title');
      if (titleEl) titleEl.textContent = titles[activeFilter] || 'Séries';
      updateUI();
    });
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

  document.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape') return;
    closeAddModal();
    editingId = null;
    closeEditModal();
    closeGdSetupModal();
    if (hasTmdbKey()) closeApiKeyModal();
  });
}

// ─── INITIALISE ──────────────────────────────
store.load();
createIcons({ icons });
setupEventListeners();
updateUI();
if (!hasTmdbKey()) showApiKeyModal();
