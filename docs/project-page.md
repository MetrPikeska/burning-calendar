# Project page draft (NASA Space Apps portal)

Draft for the 2026 project page fields ([space-apps-rules.md](wiki/space-apps-rules.md)). Copy each section into the portal field of the same name. First save by Sun 15 Nov 14:00, editable until 23:59. Numbers come from `web/public/data/v1/*/validation.json`, method `v1-region-month-dn-loyo`.

## Project Name

Burning Calendar

## High-Level Project Summary

Burning Calendar joins 25 years of NASA fire detections into one consistent record. MODIS has watched fires since 2000; VIIRS, since 2012, sees three to six times more detections of the same fires because its pixels are smaller. Stitching the two creates a fake jump in 2012. We fitted VIIRS/MODIS ratios per region, calendar month and day/night on 2012-2019 and back-cast the MODIS years onto the VIIRS scale, with an error interval for every modelled month. Held-out years show a median annual error of 5.4 % for Greece and 1.5 % for Argentina. The web app shows, for 13 Greek regions and 24 Argentine provinces, when the burning season starts, peaks and ends, and flags months above the 90th percentile of the preceding ten years. An MCP server lets AI assistants answer the same questions with numbers, caveats and a link back to the map.

## Link to Project Demo

TODO: slides PDF or 30 s video link (no password, permission or registration).

## Link to Final Project

https://burning-calendar.vercel.app
Code: https://github.com/MetrPikeska/burning-calendar

## Detailed Project Description

**What it does.** For each country and region the app shows a year × month calendar of active fire detections from Nov 2000 to Dec 2025. Users switch between raw MODIS, raw VIIRS and the harmonized series, read the season metrics (peak month, onset and end at 10 % and 90 % of the year's cumulative count, season length), and see whether a month was abnormal against the same month of the preceding ten years. The map is coloured by detections per 1000 km² a year. A region can be picked on the map, from a list or by latitude and longitude; the date range and the series live in the URL, so any view can be shared, and every view downloads as CSV.

**Who it is for.** An early warning analyst at a fire service or civil protection agency who needs to know whether this season is normal for this region, and researchers who need one comparable series across the MODIS and VIIRS eras. The challenge comes from CONAE, so Argentina is covered at province level; Greece is covered because we work from Thessaloniki and Greece has both summer wildfires and autumn stubble burning.

**How it works.**
1. FIRMS standard-processing country CSVs, vegetation fires only (`type == 0`), plus our own filter for static heat sources (0.01° cells with detections on 16 or more days a year).
2. Detections assigned to NUTS 2024 regions (Greece) and IGN provinces (Argentina).
3. VIIRS/MODIS ratios per region × calendar month × day/night, fitted on 2012-2019, before the Terra and Aqua orbit drift. Thin strata fall back to season, region or national ratios. Terra-only months (Nov 2000 to Jun 2002) get a chained factor through Terra + Aqua.
4. Validation by leave-one-year-out: the harmonized series hits the VIIRS peak month in 86 % of held-out Greek seasons, against 57 % for raw MODIS (Argentina 100 % vs 86 %). A time split (fit 2012-2019, test 2020-2025) gives 7.1 % and 7.0 % median annual error.
5. Regions that fail validation (Ionian Islands, Buenos Aires city, Neuquén, Tierra del Fuego) are shown in a relative mode built on MODIS alone, so the app never presents an unreliable number as harmonized.

**AI agent access.** A read-only MCP server at `https://burning-calendar.vercel.app/api/mcp` exposes tools for region search, series, season calendars, anomalies, rankings by count or density, aggregation, validation per region and year, point lookup and methodology. Each answer carries its caveats (back-cast interval, relative mode, detections are not fires), in full on the first call and as short codes after, and a deep link to the map view.

**Benefits.** One series instead of two incompatible ones, a season calendar per administrative region that agencies already report on, open data under CC BY 4.0, and honest uncertainty: every modelled value comes with a range.

**Tools.** Python (pandas, GeoPandas, Shapely) for the pipeline; TypeScript, Vite, MapLibre GL and Observable Plot for the web; mcp-handler on Vercel Functions for the MCP server. The whole app is static JSON plus one serverless function.

**Next steps.** S-NPP production ended on 2 Nov 2026, so the next release splices VIIRS to NOAA-20 and adds near-real-time detections, then daily series, finer tiles, weather and drought context, and burned area. Full list in the README.

## Use of Super Intelligence (SI)

The team chose the challenge, the users and the method: the VIIRS reference scale, region × month × day/night factors, the 2012-2019 fit window, leave-one-year-out validation, the static-source filter and the relative-mode rule (docs/wiki/decisions.md in the repository). Claude (Anthropic) did literature research before the event. During the event Claude Code (Claude Opus 5.5) wrote most of the pipeline, web and MCP code to the team's specification, ran the pipeline, wrote tests and drafted documentation; the team reviewed the results and the numbers. Every SI task is logged with time, tool and files in docs/si-use.md. No SI-generated images or video are used.

## NASA Data

- FIRMS MODIS Collection 6.1 active fire detections, Terra and Aqua, standard processing, 2000-2025: https://firms.modaps.eosdis.nasa.gov/
- FIRMS VIIRS S-NPP 375 m active fire detections (VNP14IMG), standard processing, 2012-2025: https://firms.modaps.eosdis.nasa.gov/
- Method papers: Giglio et al. 2016, doi:10.1016/j.rse.2016.02.054; Schroeder et al. 2014, doi:10.1016/j.rse.2013.12.008.

## Space Agency Partner Data

None used directly. CONAE's hotspot catalogue (https://catalogos5.conae.gov.ar/catalogofocos) served as the reference for what Argentine users see today.

## Other References

Data:
- Eurostat GISCO, NUTS 2024 boundaries, © EuroGeographics for the administrative boundaries
- Instituto Geográfico Nacional de la República Argentina, provinces layer (FUENTE: IGN), downloaded 14 Nov 2026
- Natural Earth 1:50M countries (public domain); OpenFreeMap tiles, © OpenStreetMap contributors

Code (open source):
- Python: pandas, GeoPandas, Shapely, pyogrio, PyArrow, requests, pytest, jsonschema
- Web: MapLibre GL JS, Observable Plot, Vite, TypeScript, Vitest, IBM Plex Sans (Fontsource)
- MCP: mcp-handler (Vercel), @modelcontextprotocol/server, Zod

Literature on season metrics and harmonization: docs/wiki/calendar-and-anomalies.md and docs/wiki/harmonization.md in the repository.
