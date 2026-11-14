"""Download the gridded context factors into data/raw/factors/ (git-ignored).

Usage: uv run python pipeline/download_factors.py fwi [--start 2000 --end 2025]

fwi   CEMS fire danger indices, historical (Early Warning Data Store, EWDS). Needs an ECMWF
      account, the dataset licence accepted on its page, and an API key.
      Credentials: ~/.cdsapirc (url: https://ewds.climate.copernicus.eu/api, key: <your key>).
      NEVER put the key in the repository, a command line or an environment file in git.
      Request keys follow the dataset form (UNVERIFIED, check the "API request" box on
      https://ewds.climate.copernicus.eu/datasets/cems-fire-historical-v1 if a request is refused).
speibase  Print where to get SPEIbase; files are saved by hand as spei03.nc and spei06.nc.

One request per year keeps each file small and a failed year can be repeated.
"""

import argparse
from pathlib import Path

OUT = Path(__file__).resolve().parent.parent / "data" / "raw" / "factors"
GREECE_AREA = [42.0, 19.0, 34.5, 30.0]  # north, west, south, east (a box around Greece with margin)
DAYS = [f"{d:02d}" for d in range(1, 32)]
MONTHS = [f"{m:02d}" for m in range(1, 13)]


def fwi_request(year: int) -> dict:
    return {
        "product_type": "reanalysis",
        "variable": ["fire_weather_index"],
        "dataset_type": "consolidated_dataset",
        "system_version": ["4_1"],
        "year": [str(year)],
        "month": MONTHS,
        "day": DAYS,
        "grid": "original_grid",
        "data_format": "netcdf",
        "area": GREECE_AREA,
    }


def download_fwi(start: int, end: int) -> None:
    import cdsapi  # imported here so the tests and build do not need credentials

    OUT.mkdir(parents=True, exist_ok=True)
    client = cdsapi.Client()
    for year in range(start, end + 1):
        dest = OUT / f"fwi_{year}.nc"
        if dest.exists() and dest.stat().st_size > 0:
            print("skip", dest.name)
            continue
        client.retrieve("cems-fire-historical-v1", fwi_request(year), str(dest))
        print("ok  ", dest.name, f"{dest.stat().st_size / 1e6:.1f} MB")


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("what", choices=["fwi", "speibase"])
    ap.add_argument("--start", type=int, default=2000)
    ap.add_argument("--end", type=int, default=2025)
    a = ap.parse_args()
    if a.what == "fwi":
        download_fwi(a.start, a.end)
    else:
        print("SPEIbase: record DOI 10.20350/digitalCSIC/16497 (https://spei.csic.es/database.html).\n"
              f"Save the SPEI-3 and SPEI-6 NetCDF files as {OUT / 'spei03.nc'} and {OUT / 'spei06.nc'}.")


if __name__ == "__main__":
    main()
