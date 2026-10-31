#!/usr/bin/env python3
import json
import re
import subprocess
import urllib.request
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path


def sanitize_filename(name: str) -> str:
    sanitized = re.sub(r'["*/:<>?\\|]', "_", name)
    sanitized = re.sub(r"\s+", " ", sanitized).strip().rstrip(".")
    return sanitized


def parse_result_file(result_path: Path):
    items = []
    with open(result_path, "r", encoding="utf-8", errors="replace") as f:
        for line in f:
            line = line.strip()
            if not line:
                continue
            m = re.match(r"^(\d+)\.\s+(.+)$", line)
            if m:
                idx = int(m.group(1))
                raw = m.group(2).strip()
            else:
                idx = len(items) + 1
                raw = line

            if " - " in raw:
                song_name, artist = raw.rsplit(" - ", 1)
            else:
                song_name, artist = raw, ""
            items.append((idx, raw, song_name.strip(), artist.strip()))
    return items


def process_song(entry, songs_dir: Path, thumbs_dir: Path):
    idx, raw_query, song_name, artist = entry
    safe_base = f"{idx:03d}. {sanitize_filename(raw_query)}"
    mp3_path = songs_dir / f"{safe_base}.mp3"
    thumb_path = thumbs_dir / f"{safe_base}.jpg"

    yt_title = ""
    yt_link = ""

    if mp3_path.exists():
        try:
            out = subprocess.check_output(
                ["ffprobe", "-v", "quiet", "-print_format", "json", "-show_format", str(mp3_path)],
                timeout=15,
            )
            tags = json.loads(out).get("format", {}).get("tags", {})
            yt_title = tags.get("title", "")
            yt_link = tags.get("purl") or tags.get("comment", "")
        except Exception as e:
            print(f"Warning: ffprobe failed for #{idx}: {e}")

    # Extract YouTube video ID from yt_link
    vid_match = re.search(r"(?:v=|youtu\.be/)([A-Za-z0-9_-]{11})", yt_link)
    if vid_match and (not thumb_path.exists() or thumb_path.stat().st_size == 0):
        vid_id = vid_match.group(1)
        for res_name in ("maxresdefault.jpg", "hqdefault.jpg", "mqdefault.jpg"):
            url = f"https://i.ytimg.com/vi/{vid_id}/{res_name}"
            try:
                req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
                with urllib.request.urlopen(req, timeout=15) as resp:
                    if resp.status == 200:
                        data = resp.read()
                        if data:
                            thumb_path.write_bytes(data)
                            break
            except Exception:
                continue

    return {
        "id": idx,
        "name": song_name,
        "Artist": artist,
        "yt_title": yt_title,
        "yt_link": yt_link,
        "thumbnail": str(thumb_path),
    }


def main():
    root_dir = Path(__file__).resolve().parent.parent
    result_file = root_dir / "data" / "imports" / "result.txt"
    songs_dir = root_dir / "media" / "songs"
    thumbs_dir = root_dir / "media" / "thumbnails"
    json_path = root_dir / "data" / "songs.json"

    thumbs_dir.mkdir(parents=True, exist_ok=True)

    entries = parse_result_file(result_file)
    print(f"Processing {len(entries)} songs (extracting metadata & downloading thumbnails)...")

    with ThreadPoolExecutor(max_workers=16) as executor:
        records = list(executor.map(lambda e: process_song(e, songs_dir, thumbs_dir), entries))

    records.sort(key=lambda r: r["id"])

    # Preserve existing flags if songs.json already exists
    existing_flags = {}
    if json_path.exists():
        try:
            for s in json.loads(json_path.read_text(encoding="utf-8")):
                if "id" in s and "flag" in s:
                    existing_flags[s["id"]] = s["flag"]
        except Exception:
            pass

    for r in records:
        r["flag"] = existing_flags.get(r["id"], "ok")

    # Write JSON list and JS fallback for direct file:// opening
    with open(json_path, "w", encoding="utf-8") as f:
        json.dump(records, f, ensure_ascii=False, indent=2)
    js_path = root_dir / "data" / "songs_data.js"
    js_path.write_text("window.SONGS_DATA = " + json.dumps(records, ensure_ascii=False) + ";\n", encoding="utf-8")
    print(f"Saved JSON list to: {json_path} (and {js_path.name})")

    thumbs_count = len(list(thumbs_dir.glob("*.jpg")))
    print(f"Total thumbnails downloaded in {thumbs_dir}: {thumbs_count}/{len(records)}")


if __name__ == "__main__":
    main()
