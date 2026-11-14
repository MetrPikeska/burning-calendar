"""Download Jan-Oct 2026 FIRMS detections from the area API (needs a free MAP_KEY).

The yearly country CSVs (download_firms.py) stop at 2025. For 2026 this script asks the
area API for MODIS and VIIRS S-NPP over a country bounding box: standard processing (SP)
up to the last SP date FIRMS reports, near real-time (NRT) after that, to 31 Oct 2026
(S-NPP stopped on 2 Nov 2026). Clipping to the country happens in load.py.

Usage: uv run python pipeline/download_firms_api.py [--countries Greece Argentina] [--refresh]
Key: FIRMS_MAP_KEY from the environment, else a `FIRMS_MAP_KEY=...` line in .env at the
repo root or at the main checkout. The key is never printed.
Files: data/raw/firms/api/{modis|viirs-snpp}-{sp|nrt}_2026_{Country}.csv (API response rows,
windows concatenated) plus {Country}_2026_meta.json with the date ranges and availability.
"""

import argparse
import csv
import io
import json
import os
import re
import subprocess
import time
from datetime import date, datetime, timedelta, timezone
from pathlib import Path

import requests

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "data" / "raw" / "firms" / "api"
API = "https://firms.modaps.eosdis.nasa.gov/api"
KEY_VAR = "FIRMS_MAP_KEY"
YEAR = 2026
START, END = date(2026, 1, 1), date(2026, 10, 31)
DAY_RANGE = 5
BBOX = {"Greece": "19,34,30,42", "Argentina": "-74,-56,-53,-21"}
SENSORS = {"modis": "MODIS", "viirs-snpp": "VIIRS_SNPP"}  # file prefix -> API source stem


class KeyMissing(SystemExit):
    pass


def parse_env(text: str) -> str | None:
    """Value of the last `FIRMS_MAP_KEY=...` line (optional `export`, optional quotes)."""
    key = None
    for line in text.splitlines():
        line = line.strip()
        if line.startswith("export "):
            line = line[len("export "):].lstrip()
        m = re.fullmatch(rf"{KEY_VAR}\s*=\s*(.*)", line)
        if m:
            v = m.group(1).strip().strip("\"'").strip()
            if v:
                key = v
    return key


def env_files() -> list[Path]:
    files = [ROOT / ".env"]
    try:
        common = subprocess.run(["git", "-C", str(ROOT), "rev-parse", "--path-format=absolute", "--git-common-dir"],
                                capture_output=True, text=True, check=True).stdout.strip()
        files.append(Path(common).parent / ".env")
    except (OSError, subprocess.CalledProcessError):
        pass
    return list(dict.fromkeys(files))


def map_key(files: list[Path] | None = None) -> str:
    if os.environ.get(KEY_VAR):
        return os.environ[KEY_VAR].strip()
    for f in files if files is not None else env_files():
        if f.is_file():
            k = parse_env(f.read_text())
            if k:
                return k
    raise KeyMissing(f"{KEY_VAR} not found. Put one line `{KEY_VAR}=<your key>` into .env at the repo root "
                     f"(the key alone on a line does not count), or export {KEY_VAR}.")


def mask(text: str, key: str) -> str:
    return text.replace(key, "***") if key else text


def windows(start: date, end: date, n: int = DAY_RANGE) -> list[tuple[date, int]]:
    """(first day, day range) windows covering start..end with no overlap."""
    out, d = [], start
    while d <= end:
        days = min(n, (end - d).days + 1)
        out.append((d, days))
        d += timedelta(days=days)
    return out


def plan(sp_max: date | None, start: date = START, end: date = END) -> list[tuple[str, date, date]]:
    """[(kind, first, last)]: SP up to its last available date, NRT for the rest."""
    parts = []
    sp_end = min(sp_max, end) if sp_max else None
    if sp_end and sp_end >= start:
        parts.append(("sp", start, sp_end))
    nrt_start = max(start, sp_end + timedelta(days=1)) if sp_end else start
    if nrt_start <= end:
        parts.append(("nrt", nrt_start, end))
    return parts


def get(session: requests.Session, url: str, key: str, tries: int = 4) -> str:
    for i in range(tries):
        try:
            r = session.get(url, timeout=180)
            if r.status_code < 500:
                break
        except requests.RequestException as e:
            if i == tries - 1:
                raise RuntimeError(mask(f"request failed: {url}: {e}", key)) from None
        time.sleep(5 * (i + 1))
    if r.status_code != 200:
        raise RuntimeError(mask(f"HTTP {r.status_code} for {url}: {r.text[:200]}", key))
    if r.text.lstrip().startswith("Invalid"):
        raise RuntimeError(mask(f"{r.text.strip()[:200]} for {url}", key))
    return r.text


def availability(session: requests.Session, key: str) -> dict[str, dict]:
    text = get(session, f"{API}/data_availability/csv/{key}/all", key)
    return {row["data_id"]: {"min_date": row["min_date"], "max_date": row["max_date"]}
            for row in csv.DictReader(io.StringIO(text))}


def fetch_range(session: requests.Session, key: str, source: str, bbox: str, first: date, last: date) -> tuple[str, int]:
    """Concatenated CSV for first..last; returns (text, rows)."""
    header, rows = None, []
    for d, n in windows(first, last):
        text = get(session, f"{API}/area/csv/{key}/{source}/{bbox}/{n}/{d.isoformat()}", key)
        lines = [ln for ln in text.splitlines() if ln.strip()]
        if not lines:
            continue
        if header is None:
            header = lines[0]
        elif lines[0] != header:
            raise RuntimeError(f"{source} {d}: header changed: {lines[0]!r}")
        rows += lines[1:]
    return ((header or "") + "\n" + "".join(r + "\n" for r in rows)), len(rows)


def download(country: str, session: requests.Session, key: str, avail: dict, refresh: bool) -> dict:
    meta_path = OUT / f"{country}_{YEAR}_meta.json"
    old = json.loads(meta_path.read_text()) if meta_path.exists() else {}
    meta = {"country": country, "year": YEAR, "bbox": BBOX[country], "requested": [START.isoformat(), END.isoformat()],
            "availability": {}, "files": {}}
    for prefix, stem in SENSORS.items():
        sp = avail.get(f"{stem}_SP")
        nrt = avail.get(f"{stem}_NRT")
        meta["availability"][stem] = {"SP": sp, "NRT": nrt}
        sp_max = date.fromisoformat(sp["max_date"]) if sp else None
        for kind, first, last in plan(sp_max):
            if kind == "nrt" and nrt and date.fromisoformat(nrt["min_date"]) > first:
                print(f"WARN {stem}_NRT starts {nrt['min_date']}, gap after SP end {first - timedelta(days=1)}")
            name = f"{prefix}-{kind}_{YEAR}_{country}.csv"
            dest = OUT / name
            prev = old.get("files", {}).get(name)
            rng = [first.isoformat(), last.isoformat()]
            if dest.exists() and prev and prev["range"] == rng and not refresh:
                meta["files"][name] = prev
                print(f"skip {name}")
                continue
            source = f"{stem}_{kind.upper()}"
            text, n = fetch_range(session, key, source, BBOX[country], first, last)
            tmp = dest.with_suffix(".part")
            tmp.write_text(text)
            tmp.rename(dest)
            meta["files"][name] = {"source": source, "sensor": prefix, "kind": kind, "range": rng, "rows": n,
                                   "downloaded": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")}
            print(f"ok   {name}: {n} rows, {rng[0]}..{rng[1]}", flush=True)
    meta_path.write_text(json.dumps(meta, indent=1))
    return meta


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--countries", nargs="+", default=list(BBOX), choices=list(BBOX))
    ap.add_argument("--refresh", action="store_true", help="download again even when the file is complete")
    args = ap.parse_args()
    key = map_key()
    OUT.mkdir(parents=True, exist_ok=True)
    with requests.Session() as s:
        avail = availability(s, key)
        for stem in SENSORS.values():
            print(stem, {k: avail.get(f"{stem}_{k}") for k in ("SP", "NRT")})
        for c in args.countries:
            download(c, s, key, avail, args.refresh)


if __name__ == "__main__":
    main()
