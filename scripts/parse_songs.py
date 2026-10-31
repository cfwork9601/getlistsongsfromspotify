#!/usr/bin/env python3
import re
from pathlib import Path
from bs4 import BeautifulSoup


def extract_songs(html_content: str):
    soup = BeautifulSoup(html_content, "html.parser")
    rows = soup.find_all("div", attrs={"data-testid": "tracklist-row"})

    results = []

    if rows:
        for idx, row in enumerate(rows, 1):
            track_el = row.find("a", attrs={"data-testid": "internal-track-link"})
            if not track_el:
                track_el = row.find("a", href=re.compile(r"^/track/"))

            song_name = ""
            if track_el:
                name_div = track_el.find("div", attrs={"dir": "auto"})
                if name_div:
                    song_name = name_div.get_text(strip=True)
                else:
                    song_name = track_el.get_text(strip=True)

            artist_els = row.find_all("a", href=re.compile(r"^/artist/"))
            artists = []
            for a in artist_els:
                t = a.get_text(strip=True)
                if t and t not in artists:
                    artists.append(t)
            artist_str = ", ".join(artists) if artists else ""

            if not song_name or not artist_str:
                for btn in row.find_all("button", attrs={"aria-label": True}):
                    label = btn["aria-label"]
                    m = re.search(r"(?:Play|More options for)\s+(.+?)\s+by\s+(.+)", label)
                    if m:
                        if not song_name:
                            song_name = m.group(1).strip()
                        if not artist_str:
                            artist_str = m.group(2).strip()
                        break

            if song_name or artist_str:
                results.append((idx, song_name or "Unknown Title", artist_str or "Unknown Artist"))
    else:
        play_buttons = soup.find_all("button", attrs={"aria-label": re.compile(r"^Play\s+.+\s+by\s+")})
        for idx, btn in enumerate(play_buttons, 1):
            m = re.match(r"^Play\s+(.+?)\s+by\s+(.+)$", btn["aria-label"])
            if m:
                results.append((idx, m.group(1).strip(), m.group(2).strip()))

    return results


def main():
    root_dir = Path(__file__).resolve().parent.parent
    imports_dir = root_dir / "data" / "imports"
    input_file = imports_dir / "list.txt"
    output_file = imports_dir / "result.txt"

    if not input_file.exists():
        print(f"Error: {input_file} not found.")
        return

    print(f"Reading {input_file.relative_to(root_dir)}...")
    with open(input_file, "r", encoding="utf-8", errors="replace") as f:
        content = f.read()

    songs = extract_songs(content)

    with open(output_file, "w", encoding="utf-8") as f:
        for idx, song, artist in songs:
            f.write(f"{idx}. {song} - {artist}\n")

    print(f"Successfully extracted {len(songs)} songs into {output_file.relative_to(root_dir)}")
    if songs:
        print("\n--- Preview (First 3) ---")
        for idx, song, artist in songs[:3]:
            print(f"{idx}. {song} - {artist}")
        if len(songs) > 3:
            print("\n--- Preview (Last 3) ---")
            for idx, song, artist in songs[-3:]:
                print(f"{idx}. {song} - {artist}")


if __name__ == "__main__":
    main()
