# SeriesTracker

A personal TV series tracker that runs entirely in the browser — no account, no server, no cloud required.

---

## Features

- 🔍 **Search & add series** from [TMDB](https://www.themoviedb.org/) with autocomplete suggestions
- 📋 **Track status**: Watchlist → En cours → Terminé
- ⭐ **Rate** series (0–10 by 0.5 increments)
- 🎬 **Episode tracking**: mark individual episodes watched per season with accurate progress bars
- 📝 **Personal notes** per series
- 🏷️ **Custom tags** (comma-separated)
- ❤️ **Favourites**: star any series and filter by favourites
- 🎭 **TMDB Genres** automatically imported and displayed as tags
- 💡 **Similar series suggestions** after marking a series as completed
- 📊 **Statistics dashboard**: counts, episode totals, watch time by status, watch trend chart, recent history
- 🔄 **Bulk operations**: multi-select to change status or delete
- 🔢 **Sort**: by recency, name (A→Z / Z→A), or rating
- 📐 **Grid / List view** toggle
- 🌗 **Dark / Light theme** toggle (persisted)
- 📤 **Export to CSV** / 📥 **Import from CSV** (backward-compatible)
- ☁️ **Google Drive backup** via OAuth2
- ⌨️ **Keyboard shortcuts** (see below)
- 🚨 **Backup reminder** banner after 7 days without export

All data is stored in `localStorage` — nothing leaves your browser unless you export or use Google Drive.

---

## Getting Started

### Prerequisites

- [Node.js](https://nodejs.org/) 18+
- A free [TMDB API key](https://www.themoviedb.org/settings/api) (v3 auth)

### Install & Run

```bash
npm install
npm run dev        # http://localhost:5173
```

### Build for Production

```bash
npm run build      # output in dist/
```

### Tests

```bash
npm test           # vitest run (50+ unit tests)
npm run coverage   # with coverage report
npm run test:ui    # interactive Vitest UI
```

### Lint

```bash
npm run lint
```

---

## TMDB API Key

1. Create a free account at [themoviedb.org](https://www.themoviedb.org/signup)
2. Go to **Settings → API**
3. Copy your **API Key (v3 auth)**
4. Paste it in the app's **Clé API TMDB** dialog (sidebar → bottom)

Your key is stored only in your browser's `localStorage`.

---

## CSV Format

The exported CSV has these columns (in order):

| Column | Type | Description |
|--------|------|-------------|
| `id` | string | Unique ID |
| `tmdbId` | number | TMDB series ID |
| `name` | string | Series title |
| `status` | `watchlist` \| `watching` \| `completed` | Watch status |
| `rating` | number \| empty | Personal rating (0–10) |
| `season` | number | Current season |
| `totalSeasons` | number | Total seasons from TMDB |
| `year` | string | First air year |
| `poster` | string | TMDB poster path |
| `overview` | string | TMDB synopsis |
| `episodesTotal` | number | Total episodes |
| `episodeRuntime` | number | Average episode runtime (min) |
| `viewingDate` | string | ISO date |
| `seasonsData` | JSON | Array of `{ season_number, episode_count, name }` |
| `watchedEpisodes` | JSON | Record of season → episode numbers watched |
| `notes` | string | Personal notes |
| `isFavourite` | `true` \| empty | Favourite flag |
| `tags` | JSON | Array of custom tag strings |
| `genres` | JSON | Array of TMDB genre names |
| `watchHistory` | JSON | Array of `{ season, episode, watchedAt }` |

Old exports without the newer columns are imported gracefully (missing fields default to empty).

---

## Google Drive Backup

1. Open [Google Cloud Console → Credentials](https://console.cloud.google.com/apis/credentials)
2. Create a project, enable the **Google Drive API**
3. Create an **OAuth 2.0 Web Application** credential
4. Add your site origin (e.g. `http://localhost:5173`) to the authorised JavaScript origins
5. Copy the **Client ID** and paste it in the app's **Configurer Google Drive** dialog

---

## Keyboard Shortcuts

| Key | Action |
|-----|--------|
| `?` | Open keyboard shortcuts help |
| `N` | Open "Add series" modal |
| `G` | Switch to grid view |
| `L` | Switch to list view |
| `B` | Toggle bulk select mode |
| `Esc` | Close any open modal |

Shortcuts are disabled while typing in a text field or when a modal is already open.

---

## Tech Stack

- [Vite](https://vitejs.dev/) — build tool & dev server
- [TypeScript](https://www.typescriptlang.org/) — type safety
- [Tailwind CSS](https://tailwindcss.com/) (CDN) — styling
- [Lucide](https://lucide.dev/) — icons
- [PapaParse](https://www.papaparse.com/) — CSV parsing
- [DOMPurify](https://github.com/cure53/DOMPurify) — XSS sanitisation
- [Vitest](https://vitest.dev/) — unit tests
