# Technical audit: Burning Calendar

Audit date: 14 Nov 2026, 15:00 EET (feature freeze Sun 15 Nov 12:00). Checked against `main` at f6b682d and the production deployment https://burning-calendar.vercel.app. Input: an external review written by ChatGPT with our MCP server connected (score 8/10, tests A-G). Every claim below was re-checked; the command or tool call is given.

## Status after the fixes (15 Nov 2026, branches pipeline-mcp and web-features, not yet on main)

- burncal-dxk fixed: `VIIRS_START = "2012-02"`, January 2012 back-cast with a range, out of fit, LOYO and trend. Greece LOYO 5.4 % and time split 7.1 % unchanged; EL52 time split 11.7 -> 11.8 %; Argentina time split 7.0 -> 6.7 %; Neuquén (58) relative -> harmonized (LOYO 26.5 -> 20.5 %). Demo numbers (EL64 Aug 2021: 4,235, median 63.1; Entre Ríos Aug 2020: 16,492) unchanged.
- burncal-wp4 fixed: 13 Terra, Aqua and S-NPP gaps of 4+ days plus the S-NPP record start (1-19 Jan 2012) in `data/outages.csv`; outages are per sensor (`outage`, `outage_viirs`).
- The series now runs to Oct 2026 (burncal-ap5, FIRMS area API, Aug-Oct 2026 provisional NRT). Claim 2 below ("ends Dec 2025") is outdated.
- burncal-k9p fixed: `backcast` caveat on `annual_mean` / `density_per_1000km2`; new `small_counts` caveat (anomaly on < 20 detections); the `coverage` caveat names the live tools.
- Web: "VIIRS saw fire on N of M days" in the month card, Hotspots CSV for Greek regions (burncal-fd6), Markdown region report, and a "Now" line from FIRMS NRT via `GET /api/recent` (hidden on failure).
- Tests: 82 pytest, 147 vitest, typecheck and build pass.

## Next steps (slide, no code before the freeze)

1. NOAA-20/21 splice to continue after S-NPP (2 Nov 2026), with its own fit and validation.
2. Daily series and days with a detection as an MCP tool; finer units than NUTS2 (municipalities or a grid).
3. Fire events instead of detections (space-time clustering); detections next to burned area (MCD64A1, EFFIS).
4. Drought and weather as explanatory variables: FWI (CEMS), SPEI, lag analysis with LOYO; association, not cause.
5. Custom areas: raw VIIRS 2012-2026 for Greek points first, harmonized only after a calibration for arbitrary areas.
6. Detrended baseline and an anomaly score with an interval instead of a yes/no flag.
7. Citable data release (Zenodo DOI, v1/v2).
8. Alerts (webhook, e-mail) only after the splice and operational monitoring.

## Verdict

The external review is mostly right about the data and the method, but four of its ten weaknesses are already resolved in production, and its P0 list misses the one real P0 we have: January 2012 enters the fit as a full VIIRS month although S-NPP data start on 20 Jan 2012 (bead burncal-dxk). That bug biases the January factors and every back-cast January, and fixing it changes the published validation numbers. It should come before any new feature.

Arbitrary AOI analysis (review P0.2) and an in-app "AI Fire Investigator" (review P0.3, section 6) do not fit before the freeze and are not needed for the challenge brief.

## Architecture

| Layer | What | Where |
|---|---|---|
| Pipeline | Python 3 (uv), pandas; FIRMS archive CSV download, filters (type 0, static sources on a 0.01° grid with 16+ detection days per year), region assignment, harmonization, validation, calendar metrics, JSON/CSV export | `pipeline/*.py`, 69 pytest tests in `tests/` |
| Data contract | Static JSON + CSV, JSON Schema, generated and committed | `web/public/data/v1/{gr,ar}/`, `web/public/data/v1/schema/`, [wiki/data-contract.md](wiki/data-contract.md) |
| Web | Vite + TypeScript, no framework, MapLibre GL 6.18, Observable Plot 0.6.19, URL state deep links | `web/src/` |
| MCP | One stateless read-only Vercel function, mcp-handler 2.4.0, Streamable HTTP, 15 tools, MCP Apps widget, Origin allowlist (report-only) | `web/api/mcp.ts`, `web/api/_lib/` |
| Live context | Fixed host allowlist (GDACS, Copernicus EMS, Open-Meteo, Meteostat, FIRMS NRT), 4 s timeout, per-instance cache, `upstream_error` instead of exceptions | `web/api/_lib/live/` |
| Hosting | Vercel, Git auto-deploy from `main` (every push to `main` is production), `maxDuration` 10 s | `web/vercel.json` |
| Tests | 130 vitest tests in 11 files (contract, tools, live core, alerts, widget, origin) | `cd web && npx vitest run` |

No database, no server-side spatial index. Greece ships per-region hotspot CSVs (`data/v1/gr/detections/*.csv`, 16 MB total, columns `region_id,sensor,satellite,acq_date,acq_time,daynight,latitude,longitude,frp,confidence,version`). Argentina ships no hotspot points (raw FIRMS for AR is 362 MB).

## External review claims, re-checked

| # | Review claim | Status 14 Nov 15:10 | Evidence |
|---|---|---|---|
| 1 | FIRMS NRT not configured (`configured: false`) | **Resolved.** `FIRMS_MAP_KEY` is set in production | `get_recent_detections` EL52 2 days: `configured: true`, 7 detections; AR 1 day: 455 detections, by province; caveats `nrt_not_harmonized`, `provisional` |
| 2 | Historical series ends Dec 2025 | True, by decision | decisions.md 14 Nov; NOAA-20 splice needs its own fit and validation |
| 3 | No arbitrary AOI | True | Region ids only (`^(GR|AR|EL\d\d|\d\d)$`); `find_region_at` maps a point to a region |
| 4 | NRT and history not on one scale | True and stated | `calendar_context.note`: "Order of magnitude only (nrt_not_harmonized)"; NRT compares NOAA-20 per day with S-NPP median per day |
| 5 | Weather is not a validated fire danger index | True and stated | `get_fire_weather` description: "Gridded model values, not station measurements; no FWI index" |
| 6 | Regional uncertainty is large in places | True and exposed | `get_validation`; EL62, AR 02, 58, 94 are `relative` |
| 7 | Season comparisons use different 12-month windows | **Resolved in MCP.** Every row has `season_window`, plus a `season_window` caveat pointing to `aggregate` with from/to | `compare_regions` season_total 2024 for 06, EL52, EL61: windows 2024-05..2025-04, 2024-04..2025-03, 2023-12..2024-11 |
| 8 | Station values may be model-filled | **Resolved in MCP.** Per-day `model_fields` lists which fields are modelled; `days_with_measurements` and `last_measured_date` per station | `get_weather_stations` EL52 1-5 Oct 2026: 5 measured days, only `precip_mm` model-filled. The review's "0 of 6 observed" is the recent-days lag (`station_lag` caveat) |
| 9 | No verified usability or accessibility audit | Partly wrong. UX test with a persona walk-through and an impeccable critique were done on 14 Nov; open items are tracked | `docs/notes/2026-11-14-ux-test.md`; beads burncal-m2s (anomaly outline relies on hue), -bha, -4dr, -26w |
| 10 | No end-to-end AI workflow | Partly wrong. "Use with AI" panel on the web, demo script with a verified prompt, MCP Apps widget | `web/src/ui/agent-panel.ts`, `docs/notes/2026-11-14-agent-demo.md` (EL64 Aug 2021: 4,235 detections, median 63.1, 67.1x). Not yet recorded as video |

Test A reproduced exactly: EL52 2024 flags May-Aug, Aug 2024 = 208, median 19, ratio 10.9, `src: observed`. Test B, C and G numbers match `findings-greece.md`.

## Bugs and scientific risks (open beads, ordered by effect on published numbers)

1. **burncal-dxk (P0).** `pipeline/harmonize.py:23` sets `VIIRS_START = "2012-01"`; FIRMS S-NPP starts 20 Jan 2012. Jan 2012 enters `fit_ratio` and LOYO/time-split annual sums with 12 days of VIIRS against a full month of MODIS. Argentina Jan 2012: VIIRS/MODIS 0.98 vs 2.8-3.9 in Jan 2013-2019. Effect: January factors and January back-cast biased low; validation numbers move after the fix.
2. **burncal-wp4 (P1).** Outage list has only Aqua Aug-Sep 2020. Missing S-NPP 2022-07-27..08-10 and July 2024 gaps, several Terra and Aqua gaps. Observed VIIRS months in those windows are undercounted without a flag (AR 2024-07 VIIRS/MODIS 1.91 vs 3.2-3.3 in other Julys).
3. **burncal-8ah (P1).** Back-cast band (`pipeline/validate.py:43-54`) is driven by small months; EL65 Aug 2007 upper bound 2.7x the estimate, regional bands wider than the national one. The band is an empirical LOYO ratio range, not a confidence interval; the MCP and web must keep calling it "likely range".
4. **burncal-k9p (P2).** `annual_mean` and `density_per_1000km2` average 2001-2025 including back-cast years without a `backcast` caveat. Both review demo questions (density ranking, Thessalia vs Kentriki Makedonia) hit this.
5. **burncal-640 (P3).** Back-cast NUTS2 series do not sum to GR (2007: -10 %, Aug 2007: -19 %); `aggregate` has no caveat.
6. **Small-count anomalies.** EL52 May 2024 is flagged with 13 detections against median 8 and p90 12.1. No minimum count for `anom: true`. Related: burncal-0kc (median sentence on a median of 1).
7. **Constant factors.** Factors are fixed per region-month-day/night over 2012-2019; the GR time split shows drift after 2022 (2023 +22.9 %, 2025 +17.9 %). Stated in `get_methodology` limits.

## Security

- FIRMS key is read only in the function (`process.env.FIRMS_MAP_KEY`); not present in `web/src` or `web/dist`. Responses contain no key.
- Live fetches use code-built URLs on a fixed host allowlist; no user URL reaches `fetch` (no SSRF path). Inputs are zod-validated with regex region ids, bounded `days` (1-10), windows (31 / 62 days), `limit` (50).
- Origin check runs in report-only mode (`MCP_ORIGIN_ENFORCE` unset). Rate limit: a Vercel Firewall rule `Rate limit MCP` on `/api/mcp` (600 requests per 60 s per IP) exists with action Log only, publish not checked (log.md 14 Nov). The new `/api/recent` (15 Nov) is not covered by that rule. A burst of `get_recent_detections` calls spends the FIRMS MAP_KEY quota (5,000 transactions per 10 min per key). The per-instance cache only helps within one warm instance.

## Performance

- Static data are CDN-served; MCP reads the same JSON files from the bundle. The function bundles 14 MB of CSVs it never reads (burncal-59a).
- Live tools: 4 s upstream timeout inside a 10 s function limit.
- Web: basemap tile stalls keep the region panel on "Loading..." for up to 20 s on slow Wi-Fi (burncal-med, P1). Offline basemap fallback exists (`?basemap=local`).

## Challenge compliance (challenge page, 14 Nov 2026)

| Requirement | Status |
|---|---|
| Harmonize MODIS and VIIRS hotspots | Done: VIIRS-equivalent, region x month x day/night factors, LOYO + 2020-2025 time split, `relative` mode where it fails |
| Consistent historical series | Nov 2000 - Dec 2025, GR (13 NUTS2 + country), AR (24 provinces + country) |
| Burning calendar, seasonality, anomalies | Done: heatmap, season strip, month vs median of preceding 10 years, anomaly flags |
| Geographic and temporal selection | Done for regions, point lookup, date range. No free AOI |
| Download | Per-region CSV (range-filtered), JSON, GR hotspot CSV via MCP links (web download: burncal-fd6 open) |
| Users | Primary persona early warning analyst (personas.md); MCP adds agent access |

## What changes the next step

1. Fix burncal-dxk before the freeze and regenerate GR and AR data, then update the validation numbers in README, wiki and the pitch. Without it the January back-cast is wrong in both countries.
2. Add the outage gaps from burncal-wp4 to `data/outages.csv` in the same rebuild.
3. Add the `backcast` caveat to `annual_mean` / density (burncal-k9p): small, MCP-only.
4. Do not start AOI or an in-app chat. Record the agent demo fallback video instead (open in TODO.md).
