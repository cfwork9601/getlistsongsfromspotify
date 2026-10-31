#!/usr/bin/env python3
"""
Updates the internal ID3 metadata tags (Title, Artist, Track Number) of all MP3 files
in media/songs/ to match the 'name' and 'Artist' fields in data/songs.json.
"""

import json
from pathlib import Path
from mutagen.easyid3 import EasyID3
from mutagen.id3 import ID3NoHeaderError


def main():
    root_dir = Path(__file__).resolve().parent.parent
    json_path = root_dir / "data" / "songs.json"
    songs_dir = root_dir / "media" / "songs"

    if not json_path.exists():
        print(f"Error: {json_path} not found.")
        return

    songs = json.loads(json_path.read_text(encoding="utf-8"))
    print(f"Updating ID3 tags for {len(songs)} songs using {json_path.name}...")

    updated_count = 0
    missing_files = []

    for item in songs:
        idx = item["id"]
        target_title = item.get("name", "").strip()
        target_artist = item.get("Artist", "").strip()

        # Find corresponding MP3
        matches = list(songs_dir.glob(f"{idx:03d}. *.mp3"))
        if not matches:
            missing_files.append((idx, target_title))
            continue

        mp3_file = matches[0]
        try:
            try:
                audio = EasyID3(mp3_file)
            except ID3NoHeaderError:
                audio = EasyID3()
                audio.save(mp3_file)
                audio = EasyID3(mp3_file)

            changed = False
            if audio.get("title") != [target_title]:
                audio["title"] = target_title
                changed = True

            if audio.get("artist") != [target_artist]:
                audio["artist"] = target_artist
                changed = True

            if audio.get("tracknumber") != [str(idx)]:
                audio["tracknumber"] = str(idx)
                changed = True

            if changed:
                audio.save()
                updated_count += 1

        except Exception as e:
            print(f"Error updating #{idx:03d} ({mp3_file.name}): {e}")

    print(f"\nDone! Successfully checked {len(songs)} files. Updated {updated_count} MP3 tags in-place.")
    if missing_files:
        print(f"Warning: {len(missing_files)} MP3 files were not found on disk.")


if __name__ == "__main__":
    main()
