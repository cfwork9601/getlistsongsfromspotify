let songs = [];
let filteredSongs = [];
let currentPlayingId = null;
let isGridView = false;

const tableBody = document.getElementById('tableBody');
const gridView = document.getElementById('gridView');
const tableView = document.getElementById('tableView');
const searchInput = document.getElementById('searchInput');
const filterSelect = document.getElementById('filterSelect');
const toggleViewBtn = document.getElementById('toggleViewBtn');
const audioPlayer = document.getElementById('audioPlayer');
const npThumb = document.getElementById('npThumb');
const npTitle = document.getElementById('npTitle');
const npArtist = document.getElementById('npArtist');

function getRelativeThumb(thumbPath) {
  if (!thumbPath) return '';
  const parts = thumbPath.split('/thumbnails/');
  if (parts.length > 1) {
    return 'media/thumbnails/' + encodeURIComponent(parts[1]);
  }
  return thumbPath;
}

function getRelativeMp3(item) {
  const thumbPath = item.thumbnail || '';
  const parts = thumbPath.split('/thumbnails/');
  if (parts.length > 1) {
    const baseName = parts[1].replace(/\.jpg$/i, '.mp3');
    return 'media/songs/' + encodeURIComponent(baseName);
  }
  return '';
}

function normalizeText(str) {
  return (str || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .trim();
}

function isLikelyMatch(item) {
  const yt = normalizeText(item.yt_title);
  const name = normalizeText(item.name);
  const artist = normalizeText((item.Artist || '').split(',')[0]);
  if (!yt) return false;
  if (yt.includes(name) || name.includes(yt)) return true;

  const words = name.split(/\s+/).filter(w => w.length > 2);
  const matchedWords = words.filter(w => yt.includes(w));
  if (words.length > 0 && matchedWords.length / words.length >= 0.5) return true;
  if (artist && yt.includes(artist) && matchedWords.length >= 1) return true;
  return false;
}

async function loadSongs() {
  try {
    const res = await fetch('data/songs.json');
    if (res.ok) {
      songs = await res.json();
    } else if (window.SONGS_DATA) {
      songs = window.SONGS_DATA;
    }
  } catch (e) {
    if (window.SONGS_DATA) {
      songs = window.SONGS_DATA;
    }
  }
  applyFilters();
}

function applyFilters() {
  const q = searchInput.value.trim().toLowerCase();
  const mode = filterSelect.value;

  let mismatchCount = 0;
  songs.forEach(s => {
    s._matched = isLikelyMatch(s);
    if (!s._matched) mismatchCount++;
  });

  filteredSongs = songs.filter(s => {
    if (mode === 'matched' && !s._matched) return false;
    if (mode === 'mismatch' && s._matched) return false;
    if (!q) return true;
    return (
      String(s.id).includes(q) ||
      (s.name || '').toLowerCase().includes(q) ||
      (s.Artist || '').toLowerCase().includes(q) ||
      (s.yt_title || '').toLowerCase().includes(q)
    );
  });

  document.getElementById('statTotal').textContent = songs.length;
  document.getElementById('statShowing').textContent = filteredSongs.length;
  document.getElementById('statMismatch').textContent = mismatchCount;

  render();
}

function escapeHtml(str) {
  return String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function render() {
  if (!isGridView) {
    tableView.style.display = 'block';
    gridView.style.display = 'none';
    tableBody.innerHTML = filteredSongs.map(item => {
      const playingClass = item.id === currentPlayingId ? 'playing' : '';
      const thumbSrc = getRelativeThumb(item.thumbnail);
      const badge = item._matched
        ? '<span class="badge badge-ok">Matched</span>'
        : '<span class="badge badge-warn">Check Match</span>';

      return `
        <tr class="song-row ${playingClass}" data-id="${item.id}">
          <td><strong>#${String(item.id).padStart(3, '0')}</strong></td>
          <td class="thumb-cell">
            <div class="thumb-wrap" onclick="playSong(${item.id})" title="Play local MP3">
              <img src="${thumbSrc}" loading="lazy" alt="" />
              <div class="play-overlay">${item.id === currentPlayingId ? '🔊' : '▶'}</div>
            </div>
          </td>
          <td>
            <div class="song-title">${escapeHtml(item.name)}</div>
            <div class="song-artist">${escapeHtml(item.Artist)}</div>
          </td>
          <td>
            <div class="yt-title">${escapeHtml(item.yt_title)}</div>
            ${badge}
          </td>
          <td>
            <a class="yt-link" href="${escapeHtml(item.yt_link)}" target="_blank" rel="noopener">
              ${escapeHtml(item.yt_link)}
            </a>
          </td>
          <td>
            <div class="row-actions">
              <button class="btn btn-sm" onclick="playSong(${item.id})">▶ Play</button>
              <button class="btn btn-sm" onclick="openEditModal(${item.id})">✎ Edit</button>
            </div>
          </td>
        </tr>
      `;
    }).join('');
  } else {
    tableView.style.display = 'none';
    gridView.style.display = 'grid';
    gridView.innerHTML = filteredSongs.map(item => {
      const playingClass = item.id === currentPlayingId ? 'playing' : '';
      const thumbSrc = getRelativeThumb(item.thumbnail);
      const badge = item._matched
        ? '<span class="badge badge-ok">Matched</span>'
        : '<span class="badge badge-warn">Check Match</span>';

      return `
        <div class="card ${playingClass}">
          <div class="card-thumb" onclick="playSong(${item.id})">
            <img src="${thumbSrc}" loading="lazy" alt="" />
            <div class="play-overlay" style="opacity:1;background:rgba(0,0,0,0.3);">${item.id === currentPlayingId ? '🔊' : '▶'}</div>
          </div>
          <div class="card-body">
            <div class="card-id">#${String(item.id).padStart(3, '0')} • ${badge}</div>
            <div class="song-title">${escapeHtml(item.name)}</div>
            <div class="song-artist">${escapeHtml(item.Artist)}</div>
            <div class="yt-title" style="font-size:0.78rem;color:var(--subtext);">YT: ${escapeHtml(item.yt_title)}</div>
            <div class="row-actions" style="margin-top:auto;padding-top:8px;">
              <a class="btn btn-sm" href="${escapeHtml(item.yt_link)}" target="_blank" rel="noopener">YouTube ↗</a>
              <button class="btn btn-sm" onclick="openEditModal(${item.id})">Edit</button>
            </div>
          </div>
        </div>
      `;
    }).join('');
  }
}

window.playSong = function(id) {
  const item = songs.find(s => s.id === id);
  if (!item) return;
  currentPlayingId = id;
  audioPlayer.src = getRelativeMp3(item);
  audioPlayer.play().catch(() => {});
  npThumb.src = getRelativeThumb(item.thumbnail);
  npThumb.style.display = 'block';
  npTitle.textContent = `#${String(item.id).padStart(3, '0')} ${item.name}`;
  npArtist.textContent = `${item.Artist} • YT: ${item.yt_title}`;
  render();
};

function playAdjacent(offset) {
  if (!filteredSongs.length) return;
  const idx = filteredSongs.findIndex(s => s.id === currentPlayingId);
  const nextIdx = idx === -1 ? 0 : (idx + offset + filteredSongs.length) % filteredSongs.length;
  window.playSong(filteredSongs[nextIdx].id);
}

document.getElementById('prevBtn').addEventListener('click', () => playAdjacent(-1));
document.getElementById('nextBtn').addEventListener('click', () => playAdjacent(1));
audioPlayer.addEventListener('ended', () => playAdjacent(1));

// Edit Modal logic
const editModal = document.getElementById('editModal');
window.openEditModal = function(id) {
  const item = songs.find(s => s.id === id);
  if (!item) return;
  document.getElementById('modalTitle').textContent = `Edit Song #${item.id}`;
  document.getElementById('editId').value = item.id;
  document.getElementById('editName').value = item.name;
  document.getElementById('editArtist').value = item.Artist;
  document.getElementById('editYtTitle').value = item.yt_title;
  document.getElementById('editYtLink').value = item.yt_link;
  document.getElementById('editThumbnail').value = item.thumbnail;
  editModal.classList.add('open');
};

document.getElementById('cancelEditBtn').addEventListener('click', () => {
  editModal.classList.remove('open');
});

document.getElementById('saveEditBtn').addEventListener('click', () => {
  const id = Number(document.getElementById('editId').value);
  const item = songs.find(s => s.id === id);
  if (item) {
    item.name = document.getElementById('editName').value.trim();
    item.Artist = document.getElementById('editArtist').value.trim();
    item.yt_title = document.getElementById('editYtTitle').value.trim();
    item.yt_link = document.getElementById('editYtLink').value.trim();
    item.thumbnail = document.getElementById('editThumbnail').value.trim();
  }
  editModal.classList.remove('open');
  applyFilters();
});

document.getElementById('deleteSongBtn').addEventListener('click', () => {
  const id = Number(document.getElementById('editId').value);
  if (confirm(`Remove song #${id} from list?`)) {
    songs = songs.filter(s => s.id !== id);
    editModal.classList.remove('open');
    applyFilters();
  }
});

// Save or export updated songs.json
document.getElementById('exportBtn').addEventListener('click', async () => {
  const cleanList = songs.map(({ id, name, Artist, yt_title, yt_link, thumbnail }) => ({
    id, name, Artist, yt_title, yt_link, thumbnail
  }));
  const jsonText = JSON.stringify(cleanList, null, 2);

  if (window.showSaveFilePicker) {
    try {
      const handle = await window.showSaveFilePicker({
        suggestedName: 'songs.json',
        types: [{ description: 'JSON File', accept: { 'application/json': ['.json'] } }]
      });
      const writable = await handle.createWritable();
      await writable.write(jsonText);
      await writable.close();
      return;
    } catch (err) {
      if (err.name === 'AbortError') return;
    }
  }

  const blob = new Blob([jsonText], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'songs.json';
  a.click();
});

// Import custom JSON
document.getElementById('importFile').addEventListener('change', (e) => {
  const file = e.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    try {
      songs = JSON.parse(reader.result);
      applyFilters();
    } catch (err) {
      alert('Invalid JSON file');
    }
  };
  reader.readAsText(file);
});

searchInput.addEventListener('input', applyFilters);
filterSelect.addEventListener('change', applyFilters);
toggleViewBtn.addEventListener('click', () => {
  isGridView = !isGridView;
  toggleViewBtn.textContent = isGridView ? 'Table View' : 'Grid View';
  render();
});

loadSongs();
