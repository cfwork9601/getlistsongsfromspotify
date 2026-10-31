let songs = [];
let notes = [];
let filteredSongs = [];
let currentPlayingId = null;
let currentNoteSongId = null;
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

// Notes Modal Elements
const notesModal = document.getElementById('notesModal');
const notesModalTitle = document.getElementById('notesModalTitle');
const notesModalFlagWrap = document.getElementById('notesModalFlagWrap');
const notesList = document.getElementById('notesList');
const newNoteText = document.getElementById('newNoteText');
const addNoteBtn = document.getElementById('addNoteBtn');
const closeNotesModalBtn = document.getElementById('closeNotesModalBtn');

// Edit Modal Elements
const editModal = document.getElementById('editModal');
const editId = document.getElementById('editId');
const editFlag = document.getElementById('editFlag');
const editName = document.getElementById('editName');
const editArtist = document.getElementById('editArtist');
const editYtTitle = document.getElementById('editYtTitle');
const editYtLink = document.getElementById('editYtLink');
const editThumbnail = document.getElementById('editThumbnail');

function saveToLocalStorage() {
  try {
    localStorage.setItem('gls_songs', JSON.stringify(songs));
    localStorage.setItem('gls_notes', JSON.stringify(notes));
  } catch (e) {
    // Ignore storage quota errors
  }
}

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

function getSongNotes(songId) {
  return notes.filter(n => n.song_id === songId);
}

async function loadData() {
  // 1. Fetch latest songs.json (or window.SONGS_DATA for file://)
  try {
    const res = await fetch('data/songs.json');
    if (res.ok) {
      songs = await res.json();
    } else if (window.SONGS_DATA) {
      songs = window.SONGS_DATA;
    }
  } catch (e) {
    if (window.SONGS_DATA) songs = window.SONGS_DATA;
  }

  // Ensure default flag if missing
  songs.forEach(s => {
    if (!s.flag) s.flag = 'ok';
  });

  // 2. Fetch latest notes.json (or window.NOTES_DATA for file://)
  try {
    const resNotes = await fetch('data/notes.json');
    if (resNotes.ok) {
      notes = await resNotes.json();
    } else if (window.NOTES_DATA) {
      notes = window.NOTES_DATA;
    }
  } catch (e) {
    if (window.NOTES_DATA) notes = window.NOTES_DATA;
  }

  saveToLocalStorage();
  applyFilters();
}

function applyFilters() {
  const q = searchInput.value.trim().toLowerCase();
  const mode = filterSelect.value;

  let mismatchCount = 0;
  let workNeededCount = 0;
  let checkNeededCount = 0;

  songs.forEach(s => {
    s._matched = isLikelyMatch(s);
    if (!s._matched) mismatchCount++;
    if (s.flag === 'work needed') workNeededCount++;
    if (s.flag === 'check needed') checkNeededCount++;
  });

  filteredSongs = songs.filter(s => {
    if (mode === 'check_needed' && s.flag !== 'check needed') return false;
    if (mode === 'work_needed' && s.flag !== 'work needed') return false;
    if (mode === 'flag_ok' && s.flag !== 'ok') return false;
    if (mode === 'has_notes' && getSongNotes(s.id).length === 0) return false;
    if (mode === 'matched' && !s._matched) return false;
    if (mode === 'mismatch' && s._matched) return false;

    if (!q) return true;

    // Search query matches song metadata or attached notes
    const songNotesText = getSongNotes(s.id).map(n => n.text).join(' ').toLowerCase();
    return (
      String(s.id).includes(q) ||
      (s.name || '').toLowerCase().includes(q) ||
      (s.Artist || '').toLowerCase().includes(q) ||
      (s.yt_title || '').toLowerCase().includes(q) ||
      songNotesText.includes(q)
    );
  });

  document.getElementById('statTotal').textContent = songs.length;
  document.getElementById('statShowing').textContent = filteredSongs.length;
  document.getElementById('statCheckNeeded').textContent = checkNeededCount;
  document.getElementById('statWorkNeeded').textContent = workNeededCount;
  document.getElementById('statNotes').textContent = notes.length;
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

function renderFlagBadge(item) {
  let cls = 'flag-ok';
  let text = '✅ OK';
  if (item.flag === 'work needed') {
    cls = 'flag-work';
    text = '⚠️ Work Needed';
  } else if (item.flag === 'check needed') {
    cls = 'flag-check';
    text = '🔍 Check Needed';
  }
  return `<span class="flag-pill ${cls}" onclick="toggleFlag(${item.id})" title="Click to cycle Flag (ok -> work needed -> check needed)">${text}</span>`;
}

function renderNotesButton(item) {
  const songNotes = getSongNotes(item.id);
  const count = songNotes.length;
  const cls = count > 0 ? 'notes-btn has-notes' : 'notes-btn';
  const label = count > 0 ? `📝 ${count} note${count > 1 ? 's' : ''}` : `+ Note`;
  return `<button class="${cls}" onclick="openNotesModal(${item.id})">${label}</button>`;
}

function render() {
  if (!isGridView) {
    tableView.style.display = 'block';
    gridView.style.display = 'none';
    tableBody.innerHTML = filteredSongs.map(item => {
      const playingClass = item.id === currentPlayingId ? 'playing' : '';
      const thumbSrc = getRelativeThumb(item.thumbnail);
      const matchBadge = item._matched
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
          <td>${renderFlagBadge(item)}</td>
          <td>
            <div class="song-title">${escapeHtml(item.name)}</div>
            <div class="song-artist">${escapeHtml(item.Artist)}</div>
          </td>
          <td>
            <div class="yt-title">${escapeHtml(item.yt_title)}</div>
            ${matchBadge}
          </td>
          <td>${renderNotesButton(item)}</td>
          <td>
            <a class="yt-link" href="${escapeHtml(item.yt_link)}" target="_blank" rel="noopener">
              ${escapeHtml(item.yt_link)}
            </a>
          </td>
          <td>
            <div class="row-actions">
              <button class="btn btn-sm" onclick="playSong(${item.id})">▶</button>
              <button class="btn btn-sm" onclick="openEditModal(${item.id})">✎</button>
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
      const matchBadge = item._matched
        ? '<span class="badge badge-ok">Matched</span>'
        : '<span class="badge badge-warn">Check Match</span>';

      return `
        <div class="card ${playingClass}">
          <div class="card-thumb" onclick="playSong(${item.id})">
            <img src="${thumbSrc}" loading="lazy" alt="" />
            <div class="play-overlay" style="opacity:1;background:rgba(0,0,0,0.3);">${item.id === currentPlayingId ? '🔊' : '▶'}</div>
          </div>
          <div class="card-body">
            <div style="display:flex; justify-content:space-between; align-items:center;">
              <span class="card-id">#${String(item.id).padStart(3, '0')} • ${matchBadge}</span>
              ${renderFlagBadge(item)}
            </div>
            <div class="song-title">${escapeHtml(item.name)}</div>
            <div class="song-artist">${escapeHtml(item.Artist)}</div>
            <div class="yt-title" style="font-size:0.78rem;color:var(--subtext);">YT: ${escapeHtml(item.yt_title)}</div>
            <div style="display:flex; justify-content:space-between; align-items:center; margin-top:auto; padding-top:10px;">
              ${renderNotesButton(item)}
              <div class="row-actions">
                <a class="btn btn-sm" href="${escapeHtml(item.yt_link)}" target="_blank" rel="noopener">YT ↗</a>
                <button class="btn btn-sm" onclick="openEditModal(${item.id})">Edit</button>
              </div>
            </div>
          </div>
        </div>
      `;
    }).join('');
  }
}

window.setFlag = function(id, newFlag) {
  const item = songs.find(s => s.id === id);
  if (!item) return;
  item.flag = newFlag;
  saveToLocalStorage();
  applyFilters();
  if (currentNoteSongId === id) {
    renderNotesModalFlag();
  }
};

window.toggleFlag = function(id) {
  const item = songs.find(s => s.id === id);
  if (!item) return;
  if (item.flag === 'ok') {
    item.flag = 'work needed';
  } else if (item.flag === 'work needed') {
    item.flag = 'check needed';
  } else {
    item.flag = 'ok';
  }
  saveToLocalStorage();
  applyFilters();
  if (currentNoteSongId === id) {
    renderNotesModalFlag();
  }
};

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

// ==================== NOTES MODAL LOGIC ====================
function renderNotesModalFlag() {
  const song = songs.find(s => s.id === currentNoteSongId);
  if (!song) return;
  notesModalFlagWrap.innerHTML = `
    <div style="display:flex; align-items:center; gap:6px; flex-wrap:wrap;">
      <span style="font-size:0.75rem; color:var(--subtext);">Flag:</span>
      ${renderFlagBadge(song)}
      <button class="btn btn-sm" onclick="setFlag(${song.id}, 'check needed')" style="font-size:0.72rem; padding:3px 8px; color:#60a5fa;" title="Mark as check needed">Set Check Needed</button>
      <button class="btn btn-sm" onclick="setFlag(${song.id}, 'ok')" style="font-size:0.72rem; padding:3px 8px; color:#4ade80;" title="Mark as OK">Set OK</button>
    </div>
  `;
}

function renderNotesList() {
  const songNotes = getSongNotes(currentNoteSongId);
  if (songNotes.length === 0) {
    notesList.innerHTML = `
      <div style="text-align:center; padding:24px 12px; color:var(--subtext); font-size:0.88rem;">
        No notes yet for this song.<br>Add a note below to record what needs changing.
      </div>
    `;
    return;
  }

  notesList.innerHTML = songNotes.map(n => {
    const dateStr = n.created_at ? new Date(n.created_at).toLocaleString() : '';
    return `
      <div class="note-item" data-note-id="${n.id}">
        <div class="note-content">
          <div>${escapeHtml(n.text)}</div>
          <div class="note-time">${escapeHtml(dateStr)}</div>
        </div>
        <button class="note-delete-btn" onclick="deleteNote(${n.id})" title="Delete Note">✕</button>
      </div>
    `;
  }).join('');
}

window.openNotesModal = function(id) {
  const song = songs.find(s => s.id === id);
  if (!song) return;
  currentNoteSongId = id;
  notesModalTitle.textContent = `#${String(song.id).padStart(3, '0')} ${song.name} - ${song.Artist}`;
  renderNotesModalFlag();
  renderNotesList();
  newNoteText.value = '';
  notesModal.classList.add('open');
  setTimeout(() => newNoteText.focus(), 50);
};

closeNotesModalBtn.addEventListener('click', () => {
  notesModal.classList.remove('open');
  currentNoteSongId = null;
});

addNoteBtn.addEventListener('click', () => {
  const text = newNoteText.value.trim();
  if (!text || !currentNoteSongId) return;

  const song = songs.find(s => s.id === currentNoteSongId);
  if (!song) return;

  // 1. Add Note to notes collection (1-n)
  const newNote = {
    id: Date.now(),
    song_id: currentNoteSongId,
    text: text,
    created_at: new Date().toISOString()
  };
  notes.push(newNote);

  // 2. Automatically set flag to "work needed"
  song.flag = 'work needed';

  saveToLocalStorage();
  renderNotesModalFlag();
  renderNotesList();
  newNoteText.value = '';
  applyFilters();
});

window.deleteNote = function(noteId) {
  notes = notes.filter(n => n.id !== noteId);
  saveToLocalStorage();
  renderNotesList();
  applyFilters();
};

// ==================== EDIT MODAL LOGIC ====================
window.openEditModal = function(id) {
  const item = songs.find(s => s.id === id);
  if (!item) return;
  document.getElementById('modalTitle').textContent = `Edit Song #${item.id}`;
  editId.value = item.id;
  editFlag.value = item.flag || 'ok';
  editName.value = item.name;
  editArtist.value = item.Artist;
  editYtTitle.value = item.yt_title;
  editYtLink.value = item.yt_link;
  editThumbnail.value = item.thumbnail;
  editModal.classList.add('open');
};

document.getElementById('cancelEditBtn').addEventListener('click', () => {
  editModal.classList.remove('open');
});

document.getElementById('saveEditBtn').addEventListener('click', () => {
  const id = Number(editId.value);
  const item = songs.find(s => s.id === id);
  if (item) {
    item.flag = editFlag.value;
    item.name = editName.value.trim();
    item.Artist = editArtist.value.trim();
    item.yt_title = editYtTitle.value.trim();
    item.yt_link = editYtLink.value.trim();
    item.thumbnail = editThumbnail.value.trim();
  }
  editModal.classList.remove('open');
  saveToLocalStorage();
  applyFilters();
});

document.getElementById('deleteSongBtn').addEventListener('click', () => {
  const id = Number(editId.value);
  if (confirm(`Remove song #${id} from list?`)) {
    songs = songs.filter(s => s.id !== id);
    notes = notes.filter(n => n.song_id !== id);
    editModal.classList.remove('open');
    saveToLocalStorage();
    applyFilters();
  }
});

// ==================== SAVE JSON FILES ====================
async function downloadOrSaveFile(filename, content) {
  if (window.showSaveFilePicker) {
    try {
      const handle = await window.showSaveFilePicker({
        suggestedName: filename,
        types: [{ description: 'JSON File', accept: { 'application/json': ['.json'] } }]
      });
      const writable = await handle.createWritable();
      await writable.write(content);
      await writable.close();
      return;
    } catch (err) {
      if (err.name === 'AbortError') return;
    }
  }

  const blob = new Blob([content], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  a.click();
}

// Save songs.json
document.getElementById('exportBtn').addEventListener('click', () => {
  const cleanList = songs.map(({ id, flag, name, Artist, yt_title, yt_link, thumbnail }) => ({
    id, flag: flag || 'ok', name, Artist, yt_title, yt_link, thumbnail
  }));
  downloadOrSaveFile('songs.json', JSON.stringify(cleanList, null, 2));
});

// Save notes.json
document.getElementById('saveNotesBtn').addEventListener('click', () => {
  downloadOrSaveFile('notes.json', JSON.stringify(notes, null, 2));
});

searchInput.addEventListener('input', applyFilters);
filterSelect.addEventListener('change', applyFilters);
toggleViewBtn.addEventListener('click', () => {
  isGridView = !isGridView;
  toggleViewBtn.textContent = isGridView ? 'Table View' : 'Grid View';
  render();
});

loadData();
