# Burning calendar: harmonized MODIS + VIIRS fire hotspots

NASA Space Apps Challenge 2026, Thessaloniki. Challenge: "Harmonization of MODIS and VIIRS Hot Spots" (CONAE). Team Spearow: Petr, Vita.

A web app and an MCP server that join MODIS (from Nov 2000) and VIIRS (from 2012) active fire detections from NASA FIRMS into one burning activity calendar per region, for Greece and Argentina, Nov 2000 to Oct 2026.

- Web app: https://burning-calendar.vercel.app
- MCP server for AI agents: `https://burning-calendar.vercel.app/api/mcp`
- Research and design notes: [docs/wiki/index.md](docs/wiki/index.md)

## Problem

MODIS has flown since 2000 and is near its end. VIIRS S-NPP has flown since 2012 at 375 m instead of 1 km, so it sees three to six times more detections of the same fires. A series that switches from MODIS to VIIRS shows a fake jump in 2012, and a calendar built on MODIS alone loses small agricultural burns. Fire services, analysts and researchers in Greece and Argentina need one consistent record to tell a normal season from an abnormal one.

## What the app shows

- A year × month calendar of detections for each country, the 13 Greek NUTS2 regions and the 24 Argentine provinces.
- Season metrics per region: peak month, onset and end (months where the year's cumulative count reaches 10 % and 90 %), season length, bimodal seasons.
- Anomalies: each month against the same month of the preceding 10 years, flagged above the 90th percentile, with the baseline median shown next to it.
- A map coloured by detections per 1000 km² a year; `relative` regions stay grey.
- Your own area (Greece): draw a polygon, place a point or a line with a radius, or drop a GeoJSON file on the map, and get the same calendar, month card and anomalies for it, with downloads of its monthly CSV, its detections and the area. Each detection keeps the factors of its NUTS2 region, so values before Feb 2012 are an estimate that was not validated for that area. Argentina has no published detection points, so there the panel lists the provinces the area touches.
- Switch between MODIS, VIIRS and the harmonized series, pick a region on the map or by latitude/longitude, set a date range, download CSV. The URL keeps the state, for example `?country=gr&region=EL52&from=2007-01&to=2007-12&series=harm`.

## Method

The reference scale is VIIRS S-NPP. From February 2012 the series is VIIRS as observed; before that it is back-cast from MODIS (FIRMS S-NPP starts on 20 Jan 2012, so January 2012 is a partial month and is back-cast too).

1. FIRMS standard-processing country CSVs, `type == 0` (vegetation fire), plus our own static-source filter: 0.01° cells with detections on 16 or more days a year are dropped.
2. Detections assigned to GISCO NUTS 2024 regions (Greece) and IGN provinces (Argentina).
3. VIIRS/MODIS ratios fitted on 2012-2019 per region × calendar month × day/night. Thin strata (under 5 MODIS detections a year or 30 over the window) fall back to season, then region, then national level.
4. Terra-only months (Nov 2000 to Jun 2002) get a chained factor: (Terra + Aqua)/Terra fitted on 2003-2011, then VIIRS/MODIS.
5. Every back-cast month carries an interval (`harm_lo`..`harm_hi`), the 10th-90th percentile of leave-one-year-out errors by season.
6. A region whose back-cast fails validation is shown in `relative` mode: calendar and anomalies from MODIS alone, VIIRS next to it, no harmonized counts.

The fit window ends in 2019 because Terra and Aqua drift from their nominal orbits after 2020. Method version: `v1-region-month-dn-loyo`.

## Validation

Leave-one-year-out (LOYO) over 2012-2019: fit on seven years, predict the eighth from MODIS, compare with VIIRS.

| | Greece | Argentina |
|---|---|---|
| Annual totals, median absolute error | 5.4 % | 1.5 % |
| Monthly correlation r | 0.985 | 0.986 |
| Peak month hit, harmonized vs raw MODIS | 86 % vs 57 % | 100 % vs 86 % |
| Time split, fit 2012-2019, test 2020-2025 | 7.1 % | 7.0 % |

- Regions: 12 of 13 Greek regions and 22 of 24 Argentine provinces are `harmonized`. Ionia Nisia, Ciudad de Buenos Aires and Tierra del Fuego are `relative`.
- Mode rule: `relative` when the LOYO error of annual totals exceeds 25 %, or when the harmonized series misses the VIIRS peak month in more season years than raw MODIS, with one year of tolerance. We added that tolerance on 14 Nov after seeing the results: with 7-8 held-out years, one year moves the hit rate by 13-14 points.
- Per-region numbers: [findings-greece.md](docs/wiki/findings-greece.md), [findings-argentina.md](docs/wiki/findings-argentina.md), and `validation.json` per country.

## Limits

- **Detections, not fires.** One large fire gives many detections, a small burn under cloud gives none. The counts say nothing about burned area.
- **Back-cast is a model.** Before 2012 the values are predicted from MODIS with an interval; quote the interval.
- **Orbit drift.** In Greece the time-split error grows after 2022 (2023 +22.9 %, 2025 +17.9 %), and the night ratio falls 3.3 % a year from 2012 to 2025. Argentina shows no such trend.
- **The 25 % threshold** for `relative` mode is our own choice, with no literature anchor.
- **Monthly resolution** only; one month is the smallest shift in onset or peak that the calendar can show. Dates are UTC, so some night detections in Argentina fall on the next day.
- **Data end in Oct 2026.** Jan-Oct 2026 come from the FIRMS area API, not the yearly country files. Aug-Oct 2026 use near real-time data and are marked provisional; near real-time rows have no `type` field, so a cell mask from the standard record removes static sources. S-NPP production stopped on 2 Nov 2026 and had 14 days without data in Mar-Jul 2026; the NOAA-20 splice is on the roadmap below.
- **Outages:** `data/outages.csv` lists Terra, Aqua and S-NPP gaps of 3 or more days from 2001 to 2026; months with one are flagged.

## AI agents (MCP)

The MCP server is read-only and asks clients for no key or login. It answers questions such as "which province had the most detections per km²" or "was August 2021 abnormal in Attica" with numbers, caveats and a link back to the map. After the first call an agent can ask for caveat codes instead of full texts to save tokens.

- claude.ai or Claude Desktop: Customize > Connectors > Add custom connector, paste the URL above.
- Claude Code: `claude mcp add --transport http burncal https://burning-calendar.vercel.app/api/mcp`
- Cursor, VS Code, ChatGPT: add the URL as a remote (HTTP) MCP server. The "Use with AI" button in the web app header shows the config lines, a copy button for the URL and three example questions.
- Tools and outputs: [agent-access.md](docs/wiki/agent-access.md). Plain-text summary for crawlers: `/llms.txt`.
- Live context: five more tools; `investigate_month` answers "what happened in this region in this month" in one call, and four fetch current wildfire alerts (GDACS, Copernicus EMS), model weather (Open-Meteo), station records (Meteostat) and NASA FIRMS near-real-time detections (needs `FIRMS_MAP_KEY` on the server), each with source, licence and fetch time.

## How to run

Requirements: Python 3.12 with [uv](https://docs.astral.sh/uv/), Node 20+.

```sh
uv sync
uv run python pipeline/download_firms.py              # FIRMS country CSVs into data/raw/firms/ (about 370 MB)
uv run python pipeline/download_firms_api.py          # Jan-Oct 2026 from the area API; needs FIRMS_MAP_KEY=... in .env (free key)
# boundaries into data/raw/boundaries/, URLs in pipeline/regions.py
uv run python pipeline/basemap.py                     # offline basemap
uv run python pipeline/build.py --country GR --refresh # writes web/public/data/v1/gr/
uv run python pipeline/build.py --country AR --refresh
uv run pytest

cd web
npm ci
npm run dev                                           # http://localhost:5173
npm test                                              # MCP tool tests
```

The web app reads only the static JSON in `web/public/data/v1/`; the data contract is in [data-contract.md](docs/wiki/data-contract.md). Every push to `main` deploys to Vercel.

## Licence and how to cite

Code: MIT ([LICENSE](LICENSE)). Harmonized data in `web/public/data/v1/`: CC BY 4.0. Region polygons keep their source terms, see [DATA_LICENSE.md](DATA_LICENSE.md) for FIRMS, GISCO and IGN.

Cite the release from [CITATION.cff](CITATION.cff) (GitHub shows it under "Cite this repository") and name the data version:

> Mikeska, P., Kadlec, V. (2026). Burning calendar: harmonized MODIS + VIIRS fire hotspots for Greece and Argentina, v1 (method v1-region-month-dn-loyo). https://github.com/MetrPikeska/burning-calendar

Also cite NASA FIRMS for the source detections, with the acknowledgement and method papers listed in [DATA_LICENSE.md](DATA_LICENSE.md). A DOI is planned for later versions.

## Next steps

Release v1 covers Nov 2000 to Oct 2026, by month, for Greek NUTS2 regions and Argentine provinces. Two target users tested the web and the MCP server on 14 Nov 2026, an early warning analyst and a research scientist ([feedback](docs/notes/2026-11-14-feedback-early-warning-research.md)). Their priorities set this order:

1. **Near-real-time.** S-NPP FIRMS production ended on 2 Nov 2026. Splice VIIRS to NOAA-20, which overlaps S-NPP since Apr 2018, with a factor per region and day/night fitted on Apr 2018 to Oct 2026, then to NOAA-21. Add FIRMS NRT detections, and return the last update date and the delay status in every API and MCP answer.
2. **Daily series and finer tiles.** Daily counts and days with a detection per region. A grid or municipalities instead of NUTS2: Attica or the Peloponnese hide local hotspots. Custom areas work for Greece since 15 Nov; for Argentina they need a precomputed monthly grid (0.05°), and a validation of the factors for areas smaller than a region.
3. **Risk context.** Weather and the Fire Weather Index (FWI), severity levels (normal, elevated, critical), webhook notifications.
4. **Drought as a predictor.** SPEI/SPI, soil moisture from ERA5-Land or Copernicus, NDVI/NDMI. Test the lag: how many weeks drought leads a detection anomaly, by lag correlation and a regression that controls for season and trend.
5. **Fires, not only detections.** Link burned area (EFFIS, MODIS MCD64A1), plot detections against burned area, cluster detections into events in space and time.
6. **Better anomalies.** A detrended baseline, since Greece has a trend, and an anomaly score with an interval in place of the binary 90th percentile flag.
7. **Citable, open data.** A DOI for each dataset version and an API to the raw daily data under the same licence.
