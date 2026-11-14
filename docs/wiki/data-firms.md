---
title: NASA FIRMS data
updated: 2026-11-14
verified_by: curl tests of country CSV URLs (11 and 13 Nov 2026); area API and data_availability calls with our MAP_KEY (14 Nov 2026, pipeline/download_firms_api.py); FIRMS FAQ; FIRMS API page; MODIS and VIIRS user guides
sources: [sources/2026-11-11-research-modis-viirs.md, sources/2026-11-13-research-anomalies-rules.md, https://www.earthdata.nasa.gov/data/tools/firms/faq, https://firms.modaps.eosdis.nasa.gov/api/area/]
---

## Access

**Country CSVs** need no key. We tested these URLs ourselves:
- `https://firms.modaps.eosdis.nasa.gov/data/country/modis/{YYYY}/modis_{YYYY}_{Country}.csv`: 2000-2025 work, 2026 returns 404.
- `.../country/viirs-snpp/{YYYY}/viirs-snpp_{YYYY}_{Country}.csv`: 2012-2025 work.
- NOAA-20 and NOAA-21 country files return 404 under every pattern we tried.
- All-country zips are in `.../data/country/zips/`.

Sizes:
- Greece: 11 MB for everything, stored in `data/raw/firms/`.
- Argentina (2025): MODIS 3.9 MB/yr, S-NPP 13.7 MB/yr, about 300 MB for the whole record.

**Area API:** `/api/area/csv/[MAP_KEY]/[SOURCE]/[w,s,e,n]/[1-5 days]/[YYYY-MM-DD]`.
- Sources: `MODIS_SP/NRT`, `VIIRS_SNPP_SP/NRT`, `VIIRS_NOAA20_SP/NRT`, `VIIRS_NOAA21_SP/NRT`.
- The MAP_KEY is free and allows 5000 transactions per 10 min.
- One request covers at most 5 days, so 20 years for one sensor takes about 1500 calls.
- After S-NPP, switch `VIIRS_SNPP_*` to `VIIRS_NOAA20_*` or `VIIRS_NOAA21_*` (FIRMS blog, Nov 2026).

**What we use for 2026 (14 Nov 2026):** `pipeline/download_firms_api.py` reads `FIRMS_MAP_KEY` from the environment or from `.env` (repo root, then the main checkout) and never prints it. It asks the area API for Jan-Oct 2026 over a bounding box (Greece `19,34,30,42`, Argentina `-74,-56,-53,-21`) in 5-day windows: SP up to the last SP date, NRT after it. Files: `data/raw/firms/api/{modis|viirs-snpp}-{sp|nrt}_2026_{Country}.csv` plus `{Country}_2026_meta.json`. The whole download is about 250 calls and took 2 min 44 s.

- Without a key the API answers `Invalid MAP_KEY.` (checked 14 Nov 2026 on `/api/area/` and `/api/data_availability/`).
- `data_availability` on 14 Nov 2026: `MODIS_SP` to 2026-08-31, `MODIS_NRT` 2026-09-01 to 2026-11-14; `VIIRS_SNPP_SP` to 2026-07-31, `VIIRS_SNPP_NRT` 2026-08-01 to 2026-11-02; `VIIRS_NOAA20_SP` to 2026-07-31, `VIIRS_NOAA20_NRT` from 2026-08-01; `VIIRS_NOAA21_SP` 2023-03-01 to 2026-07-31, `VIIRS_NOAA21_NRT` from 2024-01-17.
- NRT for MODIS and S-NPP starts the day after SP ends, so there is no month with both SP and NRT to compare. Only NOAA-21 has an SP/NRT overlap.
- Rows in the bounding-box files (before clipping): Greece MODIS SP 2,637, NRT 881, VIIRS SP 6,102, NRT 9,083; Argentina MODIS SP 28,408, NRT 13,065, VIIRS SP 98,014, NRT 66,487.
- `load.py` clips the boxes to the country polygons with the region assignment rule (inside, or nearest within 5 km). Greece VIIRS Jan-Oct 2026: 3,841 of 15,185 rows kept; dropped points are in Turkey, Albania, North Macedonia and Bulgaria.
- **S-NPP gaps in 2026:** no S-NPP detections in Greece or Argentina on 10-12 Mar, 28-30 Apr, 1-2 Jun and 11-16 Jul 2026 (SP). A world query returned 0 rows on 11 Mar and 13 Jul (73,620 on 20 Jul; NOAA-20 53,804 on 13 Jul). Listed in `data/outages.csv`.

**Archive Download Tool:** SHP/CSV/JSON. It runs asynchronously and emails a link. Login is Earthdata or an emailed code.

**CONAE catalogue** (Argentina, plus global coverage from Sep 2017 for MODIS and Dec 2023 for VIIRS): see [related-tools.md](related-tools.md).

## Standard vs NRT

- **SP (standard)** is the consistent research record. It arrives with a 2-3 month lag. Use it for the calendar.
- **NRT** is for rapid response. It has no `type` attribution, and its geolocation is worse after manoeuvres.
  - Checked 14 Nov 2026: area API NRT CSVs have no `type` column; `version` is `2.0NRT` (VIIRS) and `6.1NRT` (MODIS). Area API SP for VIIRS 2026 is `version 2`, as in the country files.
  - Our replacement for `type` (`load.fill_nrt_type`): an NRT row gets type 2 when its 0.01° cell (VIIRS) or the 3x3 block around it (MODIS) had a non-zero type in SP 2023-2026 of the same sensor. Tested with masks from the 2023-2025 country files on SP Jan-Jul 2026: the cell mask catches 95.0 % (Greece) and 84.9 % (Argentina) of non-zero VIIRS rows and masks 4.2 % and 1.3 % of type-0 rows; the 3x3 MODIS mask catches 44.4 % and 89.1 % and masks 1.0 %. Masked NRT rows per month are close to the SP static rows per month: Greece VIIRS about 63 vs 51, Argentina about 670 vs 631.
- Product names after S-NPP: VNP (S-NPP), VJ1 (NOAA-20), VJ2 (NOAA-21).

## Columns

- **MODIS:** `latitude,longitude,brightness,scan,track,acq_date,acq_time,satellite,instrument,confidence,version,bright_t31,frp,daynight,type`.
- **VIIRS:** the same, except `brightness` and `bright_t31` are `bright_ti4` and `bright_ti5`.

| Field | Meaning |
|---|---|
| `confidence` | MODIS 0-100 (low <30, nominal 30-80, high ≥80). VIIRS `l` / `n` / `h`. |
| `type` | 0 presumed vegetation fire, 1 active volcano, 2 other static land source, 3 offshore |
| `frp` | fire radiative power, MW |
| `scan`, `track` | pixel size in km along scan and along track |
| `daynight` | in SP data, D or N by solar zenith angle (> 85° means night) |
| `satellite` | MODIS: `Terra` / `Aqua`; VIIRS S-NPP: `N` |

## Known issues

- **VIIRS static sources:** product versions 1 and 2 left some static sources labelled type 0. This was fixed in v3 in May 2025. The Greek country files are `version 2`, so we apply our own static filter ([decisions.md](decisions.md)).
- **Static-source share:** in the Greek data 18% of VIIRS detections are `type 2`, against 1% for MODIS.
- **MODIS `version` by year (Greece country CSVs, `type == 0`, `pipeline/load.py`, 14 Nov 2026):** `6.2` in 2000-2017, `6.03` in 2018-2022, `61.03` in 2023-2025; one value per year, never mixed. VIIRS is `2` in all years. The 2012-2019 fit window spans the 2017/2018 change. The national VIIRS/MODIS annual ratio shows no step there (2016 3.75, 2017 3.18, 2018 3.57, 2019 3.83, after the static filter).
- **MODIS archive artefact:** data from Feb-Mar 2000 can flag whole scan lines as fire. Our record starts in Nov 2000, so this does not affect us.
