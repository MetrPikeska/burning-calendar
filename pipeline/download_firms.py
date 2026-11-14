"""Download FIRMS standard-processing country CSVs (no MAP_KEY needed).

Usage: uv run python pipeline/download_firms.py [--countries Greece Argentina] [--workers 4]
Files land in data/raw/firms/{sensor}_{year}_{Country}.csv. Existing complete files are skipped.
"""

import argparse
from concurrent.futures import ThreadPoolExecutor, as_completed
from pathlib import Path

import requests

BASE = "https://firms.modaps.eosdis.nasa.gov/data/country"
OUT = Path(__file__).resolve().parent.parent / "data" / "raw" / "firms"
SENSORS = {"modis": range(2000, 2026), "viirs-snpp": range(2012, 2026)}


def url_for(sensor: str, year: int, country: str) -> str:
    return f"{BASE}/{sensor}/{year}/{sensor}_{year}_{country}.csv"


def fetch(sensor: str, year: int, country: str, session: requests.Session) -> str:
    dest = OUT / f"{sensor}_{year}_{country}.csv"
    url = url_for(sensor, year, country)
    head = session.head(url, timeout=60)
    if head.status_code == 404:
        return f"404  {dest.name}"
    head.raise_for_status()
    size = int(head.headers.get("content-length", -1))
    if dest.exists() and dest.stat().st_size == size:
        return f"skip {dest.name}"
    tmp = dest.with_suffix(".part")
    with session.get(url, stream=True, timeout=300) as r:
        r.raise_for_status()
        with open(tmp, "wb") as f:
            for chunk in r.iter_content(1 << 20):
                f.write(chunk)
    if size >= 0 and tmp.stat().st_size != size:
        tmp.unlink()
        raise RuntimeError(f"size mismatch for {url}")
    tmp.rename(dest)
    return f"ok   {dest.name} ({size / 1e6:.1f} MB)"


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--countries", nargs="+", default=["Greece", "Argentina"])
    ap.add_argument("--workers", type=int, default=4)
    args = ap.parse_args()
    OUT.mkdir(parents=True, exist_ok=True)

    jobs = [(s, y, c) for c in args.countries for s, years in SENSORS.items() for y in years]
    failed = []
    with requests.Session() as session, ThreadPoolExecutor(args.workers) as pool:
        futures = {pool.submit(fetch, *j, session): j for j in jobs}
        for fut in as_completed(futures):
            try:
                print(fut.result(), flush=True)
            except Exception as e:  # report and continue, rerun picks up the rest
                failed.append(futures[fut])
                print(f"FAIL {futures[fut]}: {e}", flush=True)
    print(f"done: {len(jobs) - len(failed)}/{len(jobs)} ok")
    if failed:
        raise SystemExit(1)


if __name__ == "__main__":
    main()
