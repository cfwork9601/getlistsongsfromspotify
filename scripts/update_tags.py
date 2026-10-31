#!/usr/bin/env python3
"""
Updates the internal ID3 metadata of all MP3 files in media/songs/ so they ONLY contain:
  1. Title (from 'name' in songs.json)
  2. Artist (from 'Artist' in songs.json)
  3. APIC Front Cover Thumbnail (from media/thumbnails/)
All other cluttered tags (descriptions, synopses, dates, comments) are wiped clean.
"""

import json
from pathlib import Path
from mutagen.id3 import ID3, TIT2, TPE1, APIC, ID3NoHeaderError


def embed_clean_metadata(mp3_path: Path, title: str, artist: str, thumb_path: Path) -> bool:
    try:
        try:
            audio = ID3(mp3_path)
        except ID3NoHeaderError:
            audio = ID3()

        # Wipe all existing tags
        audio.clear()

        # 1. Song Title
        if title:
            audio.add(TIT2(encoding=3, text=title))

        # 2. Artist
        if artist:
            audio.add(TPE1(encoding=3, text=artist))

        # 3. Front Cover Thumbnail
        if thumb_path.exists() and thumb_path.stat().st_size > 0:
            audio.add(
                APIC(
                    encoding=3,
                    mime="image/jpeg",
                    type=3,  # Cover (front)
                    desc="Cover",
                    data=thumb_path.read_bytes(),
                )
            )

        audio.save(mp3_path, v2_version=3)
        return True
    except Exception as e:
        print(f"Error updating {mp3_path.name}: {e}")
        return False


def main():
    root_dir = Path(__file__).resolve().parent.parent
    json_path = root_dir / "data" / "songs.json"
    songs_dir = root_dir / "media" / "songs"
    thumbs_dir = root_dir / "media" / "thumbnails"

    if not json_path.exists():
        print(f"Error: {json_path} not found.")
        return

    songs = json.loads(json_path.read_text(encoding="utf-8"))
    print(f"Cleaning tags & embedding thumbnails into {len(songs)} MP3 files...")

    # Index existing MP3 files by track number prefix (e.g. 001) for fast lookup
    mp3_files = {p.name[:3]: p for p in songs_dir.glob("*.mp3") if p.name[:3].isdigit()}
    thumb_files = {p.name[:3]: p for p in thumbs_dir.glob("*.jpg") if p.name[:3].isdigit()}

    updated = 0
    missing = []

    for item in songs:
        key = f"{item['id']:03d}"
        mp3 = mp3_files.get(key)
        if not mp3:
            missing.append(key)
            continue

        thumb = thumb_files.get(key) or (thumbs_dir / f"{key}. {item.get('name', '')}.jpg")
        if embed_clean_metadata(mp3, item.get("name", ""), item.get("Artist", ""), thumb):
            updated += 1

    print(f"Successfully processed {updated}/{len(songs)} MP3 files!")
    if missing:
        print(f"Missing MP3s: {missing}")


if __name__ == "__main__":
    main()
