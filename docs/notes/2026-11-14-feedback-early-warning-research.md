# Feedback: improvement ideas from two personas (web + MCP)

Petr, 14 Nov 2026, after testing the web and the MCP server. Original in Czech, kept close to the wording. Triage into beads: label `feedback` (before the freeze) and bead "Pitch roadmap" (next steps, no code before the freeze).

## A) Early warning

1. **Timeliness (priority one).** Data end Dec 2025; S-NPP stopped 2 Nov 2026; nothing for the current month. Needs near-real-time: splice to NOAA-20 / NOAA-21, or fresh FIRMS detections with an hour's delay. The API should return the last update date and the delay status.
2. **Granularity.** Monthly aggregation is not usable for warnings; a daily series is needed. Metric "days with a detection" per region (easier to read than detection counts). Finer tiles than NUTS2 (grid or municipalities); large regions such as Attica and the Peloponnese hide too much.
3. **Risk and context.** The 90th percentile flag is a good base, but warnings need risk: weather context (wind, humidity, temperature, FWI), comparison with the current season, not only the preceding 10 years, severity levels (normal, elevated, critical) and notifications or a webhook.
4. **Drought.** Add SPEI or SPI and soil moisture (e.g. Copernicus), or NDVI / NDMI as vegetation state. Track the lead time: how many weeks drought precedes a detection anomaly, so it becomes a usable predictor. Combined warning: drought + wind + low humidity.
5. **MCP server.** Missing aggregation tools: sum over a period, sum over regions, top months; today this is computed outside. The back-cast caveats repeat in every answer; send once, then only a code or a link. A tool for the daily series and for days with a detection.

Priorities: (1) near-real-time and the NOAA-20/21 splice, (2) daily series and days with a detection, (3) weather and drought layer, severity levels, (4) finer spatial tiles, (5) MCP aggregation tools, fewer repeated caveats.

## B) Research scientist

1. **Method and validation.** The pre-2012 back-cast rests on a factor fitted on 2012-2019: short window, fire regime may not be stationary. Show the error distribution by month and region, not one number (median 5.4 %). Uncertainty intervals for the first 20 Terra-only months directly in the data. Always return harm_lo..harm_hi for modelled months.
2. **Source and citability.** FIRMS archive version and download date. Exact documentation of the static-source filter (0.01° cells with 16 or more detection days a year). Citable dataset version with DOI and licence; versioning (v1, v2) for reproducibility.
3. **The right quantity.** Detections are not fires or burned area. Link EFFIS or MODIS burned area and show detections vs burned area. Cluster detections into events (space-time clustering) to talk about the number of fires. Offer days with a detection.
4. **Statistics and drought.** The 10-year anomaly window ignores trend, and Greece has one; offer a detrended version or another baseline. Anomaly score with an interval, not only a binary flag. Drought as an explanatory variable (SPEI/SPI, soil moisture from ERA5-Land or Copernicus) with documented source and lag. Test drought -> detections (lag correlation, regression controlling for seasonality and trend), not only a visual comparison.
5. **Data access.** Besides per-region CSV, an API to raw data with a clear licence. Daily and finer data for own analyses. Machine-readable metadata on harmonization and quality.

Priorities: (1) back-cast validation and visible uncertainty, (2) versioning, DOI, full source documentation, (3) detections vs burned area, event clustering, (4) detrended anomalies and a tested drought link, (5) raw data access with a licence.

## What already exists (14 Nov)

- harm_lo..harm_hi for every back-cast month, in JSON, CSV and MCP (`backcast` caveat asks to quote it).
- Per-region LOYO, time split and per-year errors in `validation.json` and in each `regions/{id}.json` (not yet exposed by an MCP tool or the web).
- Static filter documented in docs/wiki/data-contract.md, llms.txt and get_methodology.
- `coverage` and the S-NPP end caveat in every MCP result.
