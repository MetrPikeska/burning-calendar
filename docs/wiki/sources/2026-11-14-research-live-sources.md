---
title: Live context sources for the MCP server (alerts, stations, weather, FIRMS NRT)
updated: 2026-11-14
verified_by: curl requests from petr-ntb on 14 Nov 2026 (12:00-13:00 UTC) to every endpoint below; terms pages read with a fetch tool the same day
sources: [https://www.gdacs.org/gdacsapi/api/events/geteventlist/SEARCH, https://rapidmapping.emergency.copernicus.eu/backend/dashboard-api/public-activations-info/, https://api.reliefweb.int/v2/reports, https://open-meteo.com/en/terms, https://dev.meteostat.net/license, https://www.ncei.noaa.gov/access/services/data/v1, https://maps.effis.emergency.copernicus.eu/gwis, https://firms.modaps.eosdis.nasa.gov/api/area/]
---

Research for beads burncal-2s3 (14 Nov 2026): which live sources the MCP server can call at request time for Greece and Argentina. Each entry: endpoint, auth, limits, licence, coverage, freshness, format, decision. "Tested" means we called it ourselves on 14 Nov 2026.

## Alerts and news

### GDACS event API (used)

- Endpoint: `https://www.gdacs.org/gdacsapi/api/events/geteventlist/SEARCH?eventlist=WF&country=<English name>&fromDate=YYYY-MM-DD&toDate=YYYY-MM-DD&alertlevel=green;orange;red`. GeoJSON FeatureCollection; per event `eventid`, `episodeid`, `name`, `htmldescription`, `fromdate`, `todate`, `alertlevel`, `iso3`, `url.report`, `severitydata` (hectares), point geometry, `source: "GWIS"`.
- Tested: without `alertlevel` the API returns orange and red only (Greece Aug 2025 gave HTTP 204). `country=Greece` returned 4 events for Aug 2025 (one Orange, 4162 ha); `country=GRC` returned 204, so the filter takes the English name. `country=ARG` happened to work. Argentina 2026: 8 events, newest 10 Nov 2026 (6291 ha, Formosa). No country filter: at most 100 features per call. HTTP 204 with an empty body when nothing matches. Latency 0.5-2.7 s.
- Wildfire events come from GWIS burnt-area mapping; Greece in Nov 2026 had none in the last 30 days.
- RSS `https://www.gdacs.org/xml/rss.xml`: 777 kB, all hazards, `<copyright>public domain</copyright>`; too large to parse per call, not used.
- Auth: none. Rate limit: none published (UNVERIFIED).
- Licence: the API quick start asks to "acknowledge the source as 'Global Disaster Alert and Coordination System, GDACS'" (search snippet of `GDACS_API_quickstart_v1.pdf`, UNVERIFIED-SNIPPET). Terms of use item 5, read on gdacs.org/About/termofuse.aspx: "They should not be used for decision making without prior confirmation of their validity." Copyright links to the European Commission legal notice.
- Decision: use, both countries.

### Copernicus EMS rapid mapping (used)

- Endpoint: `https://rapidmapping.emergency.copernicus.eu/backend/dashboard-api/public-activations-info/?category=Wildfire&limit=60`. JSON with `count`, `results[]`: `code` (EMSRnnn), `countries`, `eventTime`, `activationTime`, `name`, `centroid` (WKT POINT lon lat), `category`, `closed`, `gdacsId`, newest first.
- Tested: 268 activations in the list on 14 Nov 2026, 131 of them wildfires. `category=Wildfire` filters; `countries=Argentina` does not (filter in code). Greece: 6 wildfire activations in Jul-Aug 2026 (EMSR907 to EMSR929), many in 2023-2025. Argentina: none in the list (UNVERIFIED whether CEMS was ever activated for Argentine fires in this API's history). Without a parameter the endpoint `public-activations/` answers "Activation code parameter is mandatory".
- Activation page: `https://mapping.emergency.copernicus.eu/activations/EMSRnnn` (the old `rapidmapping.../EMSRnnn/` redirects there).
- Auth: none. Rate limit: not published.
- Licence: Copernicus data policy, free, full and open; attribution "© European Union, Copernicus Emergency Management Service" (UNVERIFIED for this dashboard API; not read on a primary page today).
- Decision: use. Mostly Greek summer events; useful for the "was there a mapped fire" question.

### ReliefWeb API v2 (skipped, needs registration)

- Tested `https://api.reliefweb.int/v2/reports?appname=burning-calendar&...`: HTTP 403, "You are not using an approved appname. Kindly request an appname from ReliefWeb here: https://apidoc.reliefweb.int/parameters#appname".
- Decision: skip until Petr requests an approved appname. Report content stays the copyright of each publisher; we would pass title, date and link only.

### EFFIS / GWIS fire news (skipped)

- No news feed found. EFFIS current situation is map-only. GDACS wildfire events already carry the GWIS burnt-area estimate.

### Greek and Argentine media RSS (skipped)

- Terms differ per outlet and were not checked. Not built.

## Weather stations

### NOAA NCEI Access Data Service (skipped, stale)

- Endpoint: `https://www.ncei.noaa.gov/access/services/data/v1?dataset=daily-summaries|global-summary-of-the-day&stations=...&startDate=...&endDate=...&format=json&units=metric`. No key.
- Tested: GHCN-Daily `GR000016716` (Athens) and GSOD `16716099999`, `87576099999` (Ezeiza) have their last record on 24 Aug 2025; queries for Oct-Nov 2026 return `[]`. `isd-history.csv` was last updated 28 Aug 2025. Nothing newer for any GR or AR station we tried.
- Decision: skip. Fifteen months behind is not live.

### Meteostat (used)

- Endpoint: `https://data.meteostat.net/daily/{year}/{station}.csv.gz`, one gzip CSV per station and year, 5-6 kB. Columns `year,month,day,temp,temp_source,tmin,tmin_source,tmax,tmax_source,rhum,rhum_source,prcp,prcp_source,wspd,wspd_source,pres,pres_source,cldc,cldc_source`. Each value names its provider: `metar`, `dwd_poi` (observations), `dwd_mosmix` (DWD MOSMIX model forecast), `metno_forecast` (model). No key; dev.meteostat.net/data: "Users are not required to sign up for this service." HTTP 404 for a station-year without data.
- Station metadata: `https://data.meteostat.net/stations.db` (SQLite, 33 MB, tables `stations`, `names`, `identifiers`, `inventory` per provider and parameter). The older `bulk.meteostat.net/v2/stations/full.json.gz` stops in Mar 2026.
- Tested: 32 Greek and 48 Argentine stations have observations (metar or dwd_poi) after 1 Nov 2026. Measured values lag 4-9 days: Thessaloniki 16622 last measured 5 Nov, Gualeguaychú 87497 on 11 Nov; later days are MOSMIX. Athens 16716 (old Hellinikon airport) is MOSMIX only.
- Licence (dev.meteostat.net/license): "published under the terms of the Creative Commons Attribution 4.0 International (CC BY 4.0) license"; "You must give credit to Meteostat and its meteorological data providers." Commercial reuse allowed.
- Decision: use, both countries. Model-filled values are flagged per field.

### SMN Argentina open data (skipped for now)

- Tested: `https://ssl.smn.gob.ar/dpd/descarga_opendata.php?file=observaciones/datohorario{YYYYMMDD}.txt`, 192 kB fixed-width text, hourly temperature, humidity, pressure, wind for all SMN stations, no key, ISO-8859-1, station names only (no ids or coordinates in the file). `obs_diarias...` returned "El archivo no existe".
- Licence: not found (UNVERIFIED).
- Decision: skip. Meteostat already carries the SMN airport METARs with coordinates; a name-to-coordinate join is extra work before the freeze.

### meteo.gr / National Observatory of Athens (skipped, not checked)

- Not checked on 14 Nov 2026. The station network data are described as restricted in earlier notes (UNVERIFIED).

## Weather and fire danger

### Open-Meteo (used)

- Endpoints: `https://archive-api.open-meteo.com/v1/archive` (ERA5, ERA5-Land, IFS analysis for the latest days) and `https://api.open-meteo.com/v1/forecast` (up to 16 days). Parameters `latitude`, `longitude`, `start_date`, `end_date`, `daily=...`, `timezone=auto`. JSON with `daily.time` and one array per variable plus `daily_units`.
- Tested daily variables in both APIs: `temperature_2m_max`, `relative_humidity_2m_min`, `wind_speed_10m_max`, `wind_gusts_10m_max`, `precipitation_sum`, `et0_fao_evapotranspiration`, `vapour_pressure_deficit_max`, `soil_moisture_0_to_7cm_mean`. The archive answered up to 14 Nov 2026 (today) for Argentina. The forecast API returned nulls for 20 Aug and 1 Sep 2026 and values for 20 Oct 2026, so its past range is short; use the archive for every past day. Evia 1-3 Aug 2021: tmax 36.1-40.9 °C, RH min 18-28 %. Latency 0.2-1.3 s.
- Licence (open-meteo.com/en/terms): non-commercial users "accept to the CC-BY 4.0 licence"; free tier "Less than 10'000 API calls per day, 5'000 per hour and 600 per minute", 300,000 a month. No key for non-commercial use.
- Decision: use, both countries. Values are model output, not measurements.

### EFFIS / GWIS FWI (skipped)

- WMS `https://maps.effis.emergency.copernicus.eu/gwis` lists `ecmwf.fwi`, `ecmwf.ffmc`, `mf025.fwi`, `nasa_geos5.fwi` (not queryable) and `ecmwf.query`, `mf025.query`, `nasa_geos5.query` (queryable, time 2018-01-01 to 2099-12-31, default 2026-11-22). GetFeatureInfo needs `styles=`; with it, `ecmwf.query` at 38.8 N 23.4 E and at 32.9 S 59.9 W returns a feature with no attributes in text/plain and GML for 14 Nov 2026 and 12 Aug 2025.
- The CEMS historical FWI on the Copernicus EWDS needs an account and key.
- Decision: skip. No key-free point value found.

## FIRMS near real time (used, needs a key)

- Endpoint: `https://firms.modaps.eosdis.nasa.gov/api/area/csv/{MAP_KEY}/{SOURCE}/{w,s,e,n}/{1-5}[/{YYYY-MM-DD}]` ([data-firms.md](../data-firms.md)); the pipeline session uses the same pattern in `pipeline/download_firms_api.py`. Sources after S-NPP: `VIIRS_NOAA20_NRT`, `VIIRS_NOAA21_NRT`, `MODIS_NRT`. Free MAP_KEY, 5000 transactions per 10 min.
- Tested: an invalid key gives HTTP 400 with the body `Invalid MAP_KEY.`. A call with a real key was not made today (no key in this environment), so the live NRT CSV columns are UNVERIFIED here; the code expects the documented header starting with `latitude`.
- Licence: NASA open data, citation requested (UNVERIFIED wording, not read today).
- Decision: use; the server reads the key from the Vercel env `FIRMS_MAP_KEY` and reports `not_configured` without it.
