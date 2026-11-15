# Project page draft (NASA Space Apps portal)

Text for the 2026 project page fields ([space-apps-rules.md](wiki/space-apps-rules.md)) and the Thessaloniki submission form. Copy each section into the field of the same name. Thessaloniki form: by Sun 15 Nov 15:00. NASA portal: Submit for Judging by Sun 15 Nov 23:59 (only the last submission counts). Numbers come from `web/public/data/v1/*/validation.json` and `index.json` on main 5665ae2, method `v1-region-month-dn-loyo`.

## Thessaloniki submission form (Google Form)

- Team Name: Spearow (as on the video title card; check the exact spelling on the NASA team page, e.g. "Team Spearow")
- Selected Challenge: Harmonization of MODIS and VIIRS Hot Spots
- Link to Project Demo: the public video link (see Link to Project Demo below)
- Link to Final Project: https://burning-calendar.vercel.app (code: https://github.com/MetrPikeska/burning-calendar)

## Before you press Submit for Judging

- [ ] Demo video uploaded (YouTube Unlisted, or Google Drive "Anyone with the link can view"), opened in a private window without login. File: `burning-calendar-wt/video/video/out/burning-calendar-v8-voice.mp4` (30.0 s, voice-over by Vít Kadlec); watch it once with sound before uploading.
- [ ] https://burning-calendar.vercel.app opens in a private window.
- [ ] https://github.com/MetrPikeska/burning-calendar opens in a private window (public since 15 Nov).
- [ ] All team members on the Members tab, registered for Thessaloniki, none waitlisted.
- [ ] SI drop-down: code and text generated with SI; images and video: none generated (see SI section).
- [ ] Project Submission Verification: tick the terms and conditions and "confirm all work is original", then Submit for Judging. The banner and the participant certificate confirm it.

## Project Name

Burning Calendar

## High-Level Project Summary

Burning Calendar joins 26 years of NASA fire detections into one consistent monthly record. MODIS has watched fires since 2000; VIIRS, since 2012, records three to six times more detections of the same fires because its pixels are smaller, so stitching the two creates a fake jump in 2012. We fitted VIIRS/MODIS ratios per region, calendar month and day/night on 2012-2019 and back-cast the MODIS years onto the VIIRS scale, each modelled month with a likely range. Left-out years show a median annual error of 5.4 % for Greece and 1.5 % for Argentina; on the unseen years 2020-2025 it is 7.1 % and 6.7 %. The web app shows, for 13 Greek regions and 24 Argentine provinces or for an area the user draws, when the burning season starts, peaks and ends, and flags months above the 90th percentile of the preceding ten years. An MCP server lets AI assistants answer the same questions with numbers, caveats and a link back to the map.

## Link to Project Demo

PASTE the public video link here (30 s video; no password, permission or registration).

## Link to Final Project

https://burning-calendar.vercel.app

https://github.com/MetrPikeska/burning-calendar

(The web app and the code with data, pipeline and wiki. The MCP endpoint answers POST requests from AI clients, so opened in a browser it shows an error; it is named in the description instead.)

## Detailed Project Description

**What it does.** For each country and region the app shows a year × month calendar of active fire detections from Nov 2000 to Oct 2026 (Aug-Oct 2026 from near-real-time data, marked provisional). Users switch between raw MODIS, raw VIIRS and the harmonized series, read the season metrics (peak month, onset and end at 10 % and 90 % of the year's cumulative count, season length), and see whether a month was abnormal against the same month of the preceding ten years. The map is coloured by detections per 1000 km² a year. A region can be picked on the map, from a list or by latitude and longitude. In Greece a user can also draw a polygon, place a point or a line with a radius, or drop a GeoJSON file, and get the same calendar for that area. Views live in the URL, and every view downloads as CSV; Greek regions also download every individual detection.

**Who it is for.** An early warning analyst at a fire service or civil protection agency who needs to know whether this season is normal for this region, and researchers who need one comparable series across the MODIS and VIIRS eras. The challenge comes from CONAE, so Argentina is covered at province level; Greece is covered because we work from Thessaloniki and Greece has both summer wildfires and autumn stubble burning.

**How it works.**
1. FIRMS standard-processing country CSVs (2026 from the FIRMS area API), vegetation fires only (`type == 0`), plus our own filter for static heat sources (0.01° cells with detections on 16 or more days a year).
2. Detections assigned to NUTS 2024 regions (Greece) and IGN provinces (Argentina).
3. VIIRS/MODIS ratios per region × calendar month × day/night, fitted on Feb 2012 - Dec 2019, before the Terra and Aqua orbit drift. Thin strata fall back to season, region or national ratios. Terra-only months (Nov 2000 to Jun 2002) get a chained factor through Terra + Aqua.
4. Validation. Leave-one-year-out on 2012-2019: median annual error 5.4 % (Greece) and 1.5 % (Argentina); the harmonized series hits the VIIRS peak month in 6 of 7 held-out Greek seasons, against 4 of 7 for raw MODIS (Argentina 7 of 7 against 6 of 7). Time split (fit 2012-2019, test 2020-2025): 7.1 % and 6.7 %. We also publish where the method is weaker: a single constant VIIRS/MODIS ratio does as well or better on 2020-2025 in many regions (Greece as a whole 6.0 % against our 7.1 %), and the back-cast range held the observed count in 60-61 % of held-out national months, so the app calls it a likely range, not an 80 % interval.
5. Regions that fail validation (Ionian Islands, Buenos Aires city, Tierra del Fuego) are shown in a relative mode built on MODIS alone, so the app never presents an unreliable number as harmonized. Regions that pass but miss a held-out year by more than 50 %, or have a 2020-2025 error above 25 %, carry a "with limits" note.

**AI agent access.** A read-only MCP server at `https://burning-calendar.vercel.app/api/mcp` exposes 16 tools: region search, series, season calendars, anomalies, rankings by count or density, aggregation, validation per region and year, point lookup, methodology, a calendar widget for chat apps, and live context (NASA FIRMS near-real-time detections, GDACS and Copernicus EMS alerts, Open-Meteo weather, Meteostat stations). `investigate_month` answers "what happened in this region in this month" in one call. Each answer carries its units and caveats (back-cast range, relative mode, detections are not fires) and a deep link to the map view.

**Benefits.** One series instead of two incompatible ones, a season calendar per administrative region that agencies already report on, open data under CC BY 4.0, and stated uncertainty: every modelled value comes with a range, and every answer says what the numbers are and are not. They count satellite detections, not fires or burned area.

**Tools.** Python (pandas, GeoPandas, Shapely) for the pipeline; TypeScript, Vite, MapLibre GL and Observable Plot for the web; mcp-handler on Vercel Functions for the MCP server. The app is static JSON plus serverless functions.

**Next steps.** S-NPP production ended on 2 Nov 2026, so the next release splices VIIRS to NOAA-20 with its own fit and validation, then daily series, finer tiles and custom areas for Argentina, a validation of the factors for areas smaller than a region, weather and drought context, and burned area.

## Use of Super Intelligence (SI)

The team chose the challenge, the users and the method: the VIIRS reference scale, region × month × day/night factors, the 2012-2019 fit window, leave-one-year-out validation, the static-source filter and the relative-mode rule. Claude (Anthropic) did literature research. During the event Claude Code (Claude Opus 5.5) wrote most of the pipeline, web and MCP code to the team's specification, ran the pipeline, wrote tests and drafted documentation; outside AI reviews (ChatGPT, and audit reports written with AI) were checked against the code before anything changed. The team reviewed the results and the numbers. Every SI task is logged with time, tool and files in the project's SI log. Claude Code built the 30 s demo video in HyperFrames (HTML rendered to video) from our data, our charts and a screen recording of the real app; it contains no generated images or footage. The voice-over is a recording of team member Vít Kadlec; no generated speech or music.

## NASA Data

- FIRMS MODIS Collection 6.1 active fire detections, Terra and Aqua, standard processing, 2000-2026: https://firms.modaps.eosdis.nasa.gov/
- FIRMS VIIRS S-NPP 375 m active fire detections (VNP14IMG), standard processing 2012-2026, near real time Aug-Oct 2026 (FIRMS area API): https://firms.modaps.eosdis.nasa.gov/
- FIRMS near-real-time VIIRS NOAA-20, NOAA-21 and MODIS detections (LANCE), live context only: https://firms.modaps.eosdis.nasa.gov/
- Method papers: Giglio et al. 2016, doi:10.1016/j.rse.2016.02.054; Schroeder et al. 2014, doi:10.1016/j.rse.2013.12.008.

## Space Agency Partner Data

- Copernicus Emergency Management Service rapid mapping activations (live alerts in the MCP server): https://emergency.copernicus.eu/
- ERA5 reanalysis (Copernicus Climate Change Service) through Open-Meteo, for the weather context.
- CONAE's hotspot catalogue (https://catalogos5.conae.gov.ar/catalogofocos) served as the reference for what Argentine users see today; no CONAE data is used directly.

## Other References

Data:
- Eurostat GISCO, NUTS 2024 boundaries, © EuroGeographics for the administrative boundaries
- Instituto Geográfico Nacional de la República Argentina, provinces layer (FUENTE: IGN), downloaded 14 Nov 2026
- Natural Earth 1:50M countries (public domain); OpenFreeMap tiles, © OpenStreetMap contributors
- Live context: GDACS (https://www.gdacs.org), Open-Meteo (CC BY 4.0, https://open-meteo.com), Meteostat (CC BY 4.0, https://meteostat.net)

Code (open source):
- Python: pandas, GeoPandas, Shapely, pyogrio, PyArrow, requests, pytest, jsonschema
- Web: MapLibre GL JS, Observable Plot, Vite, TypeScript, Vitest, IBM Plex Sans (Fontsource)
- MCP: mcp-handler (Vercel), @modelcontextprotocol/server, Zod
- Demo video: HyperFrames (Apache-2.0)

Literature on season metrics and harmonization: Freeborn et al. 2014 (season onset and end), Giglio et al. 2006 (peak month), and the method papers above.
