#!/usr/bin/env python3
import argparse
import re
import subprocess
from concurrent.futures import ThreadPoolExecutor, as_completed
from pathlib import Path
from mutagen.id3 import ID3, TIT2, TPE1, APIC, ID3NoHeaderError


def sanitize_filename(name: str) -> str:
    # Replace characters invalid on exFAT/Windows filesystems: " * / : < > ? \ |
    sanitized = re.sub(r'["*/:<>?\\|]', "_", name)
    sanitized = re.sub(r"\s+", " ", sanitized).strip().rstrip(".")
    return sanitized


def apply_clean_metadata(mp3_path: Path, query: str):
    """Ensure the MP3 only contains Title, Artist, and Cover Thumbnail."""
    if " - " in query:
        title, artist = query.rsplit(" - ", 1)
    else:
        title, artist = query, ""

    try:
        audio = ID3(mp3_path)
    except ID3NoHeaderError:
        audio = ID3()

    # Extract existing thumbnail APIC if yt-dlp embedded it
    existing_apic = None
    for k in list(audio.keys()):
        if k.startswith("APIC"):
            existing_apic = audio[k]
            break

    # Wipe all other clutter (descriptions, dates, comments, etc.)
    audio.clear()

    if title:
        audio.add(TIT2(encoding=3, text=title.strip()))
    if artist:
        audio.add(TPE1(encoding=3, text=artist.strip()))
    if existing_apic:
        audio.add(existing_apic)

    audio.save(mp3_path, v2_version=3)


def parse_result_file(result_path: Path):
    songs = []
    with open(result_path, "r", encoding="utf-8", errors="replace") as f:
        for line in f:
            line = line.strip()
            if not line:
                continue
            # Match optional "123. " prefix
            m = re.match(r"^(\d+)\.\s+(.+)$", line)
            if m:
                idx = int(m.group(1))
                query = m.group(2).strip()
            else:
                idx = len(songs) + 1
                query = line
            songs.append((idx, query))
    return songs


def download_single_song(idx: int, query: str, output_dir: Path) -> tuple[int, str, bool, str]:
    safe_name = f"{idx:03d}. {sanitize_filename(query)}"
    final_mp3 = output_dir / f"{safe_name}.mp3"

    if final_mp3.exists() and final_mp3.stat().st_size > 0:
        return (idx, query, True, "already exists (skipped)")

    output_template = str(output_dir / f"{safe_name}.%(ext)s")
    queries_to_try = [
        f"ytsearch1:{query} official audio",
        f"ytsearch1:{query} lyrics",
    ]

    last_err = "unknown error"
    for search_query in queries_to_try:
        cmd = [
            "yt-dlp",
            "--cookies-from-browser", "chrome",
            "--remote-components", "ejs:github",
            "--extract-audio",
            "--audio-format", "mp3",
            "--audio-quality", "0",
            "--embed-thumbnail",
            "--windows-filenames",
            "--no-playlist",
            "--no-warnings",
            "--quiet",
            "-o", output_template,
            search_query,
        ]

        try:
            proc = subprocess.run(cmd, capture_output=True, text=True, timeout=180)
            if proc.returncode == 0 and final_mp3.exists():
                apply_clean_metadata(final_mp3, query)
                return (idx, query, True, "downloaded")
            err = (proc.stderr or proc.stdout or f"exit code {proc.returncode}").strip().splitlines()
            last_err = err[-1] if err else "unknown error"
        except Exception as e:
            last_err = str(e)

    return (idx, query, False, last_err)


def main():
    parser = argparse.ArgumentParser(description="Download songs from result.txt as MP3s.")
    parser.add_argument("--limit", type=int, default=50, help="Number of songs to process (0 for all)")
    parser.add_argument("--start", type=int, default=1, help="1-based index to start from")
    parser.add_argument("--workers", type=int, default=4, help="Number of parallel downloads")
    args = parser.parse_args()

    root_dir = Path(__file__).resolve().parent.parent
    result_file = root_dir / "data" / "imports" / "result.txt"
    songs_dir = root_dir / "media" / "songs"
    songs_dir.mkdir(parents=True, exist_ok=True)

    if not result_file.exists():
        print(f"Error: {result_file} not found.")
        return

    all_songs = parse_result_file(result_file)
    # Filter by start index and limit
    selected = [s for s in all_songs if s[0] >= args.start]
    if args.limit > 0:
        selected = selected[: args.limit]

    print(f"Found {len(all_songs)} total songs in result.txt.")
    print(f"Processing {len(selected)} songs (from #{selected[0][0]} to #{selected[-1][0]}) with {args.workers} workers...")
    print(f"Saving to: {songs_dir}\n")

    succeeded = 0
    failed = []

    with ThreadPoolExecutor(max_workers=args.workers) as executor:
        futures = {
            executor.submit(download_single_song, idx, query, songs_dir): (idx, query)
            for idx, query in selected
        }
        for count, future in enumerate(as_completed(futures), 1):
            idx, query, ok, status = future.result()
            if ok:
                succeeded += 1
                print(f"[{count}/{len(selected)}] OK   #{idx:03d}: {query} ({status})", flush=True)
            else:
                failed.append((idx, query, status))
                print(f"[{count}/{len(selected)}] FAIL #{idx:03d}: {query} -> {status}", flush=True)

    print("\n" + "=" * 50)
    print(f"Finished! {succeeded}/{len(selected)} succeeded, {len(failed)} failed.")
    if failed:
        failed_log = root_dir / "data" / "failed_downloads.txt"
        with open(failed_log, "w", encoding="utf-8") as f:
            for idx, query, err in sorted(failed):
                f.write(f"{idx}. {query} | Error: {err}\n")
        print(f"Failed songs logged to: {failed_log}")


if __name__ == "__main__":
    main()
