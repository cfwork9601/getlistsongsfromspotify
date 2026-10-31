# Spotify -> MP3 Library Manager (`getlistsongsfromspotify`)

A lightweight, serverless workflow to export playlists from Spotify Web Player, download high-quality `.mp3` audio + thumbnails from YouTube via `yt-dlp`, and manage/play your library directly from a static [`index.html`](./index.html) page.

---

## Folder Structure

```text
getlistsongsfromspotify/
├── README.md                   # Project documentation
├── index.html                  # Serverless management UI & local MP3 player
├── assets/                     # Frontend styles and logic
│   ├── style.css
│   └── app.js
├── data/                       # Catalog data & raw playlist imports
│   ├── songs.json              # Master JSON list of songs, YouTube links & thumbnails
│   ├── songs_data.js           # Auto-generated JS fallback for direct file:// opening
│   └── imports/                # Raw Spotify exports
│       ├── result.txt          # Numbered "1. Song - Artist" list
│       ├── list.txt            # Raw HTML snippet from Spotify DOM
│       └── song.txt            # Single tracklist-row HTML sample
├── media/                      # Downloaded media files
│   ├── songs/                  # Downloaded .mp3 files (001..289)
│   └── thumbnails/             # Downloaded YouTube .jpg thumbnails (001..289)
└── scripts/                    # Occasional Python CLI utilities
    ├── parse_songs.py          # Parses data/imports/list.txt -> data/imports/result.txt
    ├── download_songs.py       # Downloads MP3s from result.txt -> media/songs/
    └── build_metadata.py       # Extracts metadata & thumbnails -> data/songs.json
```

---

## Quick Start: Using the Management UI

No backend server is required:
1. **Open Directly:** Double-click [`index.html`](./index.html) in your file manager.
2. **Features:**
   - **Play Local MP3s:** Click any cover thumbnail or **▶ Play** button to stream the `.mp3` from `media/songs/`.
   - **Check YouTube Matches:** Filter by **Potential Mismatch (Review)** to spot any songs where YouTube's search title differs from Spotify's title.
   - **Search & Views:** Instant search by `#ID`, song name, artist, or YouTube title; toggle between **Table View** and **Grid View**.
   - **Edit & Save:** Edit any song record in the modal and click **Save songs.json** to save directly to `data/songs.json`.

---

## Occasional CLI Workflows

### 1. Exporting a Full Playlist from Spotify Web Player
Because Spotify Web Player uses virtual scrolling, paste this snippet into your browser's **Developer Tools Console (`F12`)** while viewing a playlist to auto-scroll and download `result.txt`:

```javascript
(async () => {
  const songs = new Map();
  let lastCount = 0, unchanged = 0;

  while (unchanged < 5) {
    document.querySelectorAll('div[data-testid="tracklist-row"]').forEach(row => {
      const track = row.querySelector('a[data-testid="internal-track-link"]')?.textContent?.trim();
      const artists = Array.from(row.querySelectorAll('a[href^="/artist/"]')).map(a => a.textContent.trim()).join(', ');
      if (track && artists) songs.set(`${track} - ${artists}`, true);
    });

    if (songs.size === lastCount) unchanged++;
    else { unchanged = 0; lastCount = songs.size; }

    window.scrollBy(0, 1000);
    await new Promise(r => setTimeout(r, 600));
  }

  const text = Array.from(songs.keys()).map((s, i) => `${i + 1}. ${s}`).join('\n');
  const blob = new Blob([text], { type: 'text/plain' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'result.txt';
  a.click();
})();
```
Place the downloaded `result.txt` in `data/imports/result.txt`.

*(Alternatively, if you saved raw HTML into `data/imports/list.txt`, run `python3 scripts/parse_songs.py`.)*

---

### 2. Downloading `.mp3` Files (`scripts/download_songs.py`)
Reads `data/imports/result.txt` and downloads `.mp3` files into `media/songs/`. Existing files are automatically skipped.

```bash
# Download all songs in result.txt (skipping already-downloaded ones)
python3 scripts/download_songs.py --limit 0

# Download a specific batch (e.g., songs #51 to #100 with 4 parallel workers)
python3 scripts/download_songs.py --start 51 --limit 50 --workers 4
```

---

### 3. Updating Metadata & Thumbnails (`scripts/build_metadata.py`)
Reads embedded YouTube metadata from `media/songs/*.mp3`, downloads missing thumbnails into `media/thumbnails/`, and refreshes `data/songs.json` + `data/songs_data.js`:

```bash
python3 scripts/build_metadata.py
```

---

## JSON Schema (`data/songs.json`)

```json
[
  {
    "id": 1,
    "name": "busy doing nothing",
    "Artist": "Muse Petal",
    "yt_title": "busy doing nothing",
    "yt_link": "https://www.youtube.com/watch?v=yo5eCuzFucc",
    "thumbnail": "/run/media/thanhtuan/STORAGE/Projects/getlistsongsfromspotify/media/thumbnails/001. busy doing nothing - Muse Petal.jpg"
  }
]
```
