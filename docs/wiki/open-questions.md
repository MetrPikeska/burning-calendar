---
title: Open questions
updated: 2026-11-14
verified_by: n/a, a list of unknowns
sources: [sources/2026-11-14-audit-external.md, sources/2026-11-13-research-harmonization-validation.md, sources/2026-11-13-research-conae-argentina.md, sources/2026-11-13-research-anomalies-rules.md]
---

- **Challenge author's real name.** The transcript says "Marina Companuchi". Searches found nothing. Check the challenge page in a browser.
- **Challenge Resources tab.** It lists CONAE and other agency resources. Not read yet: the page fails TLS from our machine and its content is rendered by JavaScript.
- **Space Apps 2026 rules.** Guides read 13 Nov 2026 (see space-apps-rules.md). Pitch length (7 min + Q&A) and deadlines (15:00 to local judges, 23:59 project page) answered by the Thessaloniki FAQ, 14 Nov. Still open: the email or upload address for the 15:00 local submission (placeholder in the FAQ), number of Global Nominees per event, local prizes. Ask on Discord or the Local Lead at the kick-off.
- **CSV of individual detections.** The challenge page asks for "a downloadable CSV File of hot spots detected during a search". Answered for Greece on 14 Nov: `detections/{id}.csv` per region ([data-contract.md](data-contract.md)), linked from MCP. Argentina (4.5 M rows) still only through FIRMS; a per-province-year or gzip layout would be needed.
- **"Number of fires detected and reported".** Does "reported" mean fire-service statistics (Hellenic Fire Service, SNMF)? We have none in the app.
- **The July 2026 fire in Argentina** from the author video. Not identified. Check the SNMF daily reports for July 2026.
- **S-NPP vs NOAA-20 count factor.** No published multi-year value exists, confirmed again 13 Nov. The only number is 0.988 from 12 days in Mar 2023. Compute it from the 2018-2026 overlap (needs a MAP_KEY).
- **Licence texts.** Neither the GISCO NUTS nor the IGN Argentina licence text has been read.
- **MODIS end date.** LAADS gives Aqua ~Aug 2026, CAMS gives ~Sep 2027. Has Aqua already stopped?
- **Orbit drift effect on MODIS counts.** Not published. First measurement for Greece (14 Nov): national night ratio falls 3.3 % per year over 2012-2025, day ratio flat; time-split errors grow to +18-23 % in 2023 and 2025 ([findings-greece.md](findings-greece.md)). Fire-year effects not separated yet.
- **Aqua today.** Is Aqua still collecting, and what is its crossing time in Nov 2026? No 2026 primary source was found.
- **Ratio vs fire size.** No paper publishes the count ratio as a function of FRP or fire size.
- **NOAA-21 start date.** The FIRMS FAQ gives 17 Jan 2024; the Download tool gives 1 Mar 2023.
- **NRT vs SP for 2026.** FIRMS keeps S-NPP and MODIS NRT only from the day after SP ends, so our Aug-Oct 2026 NRT counts cannot be compared with SP yet. NOAA-21 has both (NRT from Jan 2024, SP to Jul 2026) and could give a proxy NRT/SP ratio. Re-download when SP for Aug-Oct 2026 appears.
- **Argentina 2026 low season.** July, August and October 2026 are at the 0th percentile of 2016-2025 (findings-argentina.md). Check against SNMF reports before the pitch uses it.
- **Back-cast band coverage.** The external audit (14 Nov, [sources/2026-11-14-audit-external.md](sources/2026-11-14-audit-external.md)) notes that `harm_lo` / `harm_hi` have no measured coverage: nobody has checked that the 10th-90th percentile band holds about 80 % of held-out VIIRS months, per region, per count size, or for MODIS = 0 months (band width 0). Needs nested LOYO. Until then the band is an empirical error band, not an 80 % prediction interval.
- **Harmonized regions with large time-split errors.** Audit, 14 Nov: EL42 Notio Aigaio (LOYO 25.0 %, time split 2025 -77.7 %) and EL54 Ipeiros (LOYO 24.2 %, time split 2023 +80.4 %) stay `harmonized` because the mode rule reads LOYO only. Open: show a per-region quality note in web and MCP, or add the time split to the rule.
- **MODIS = 0, VIIRS > 0.** The ratio model has no intercept, so a back-cast month with no MODIS detection is 0 with a 0-0 band. Observed case: EL52 May 2024, MODIS 0, VIIRS 13. An intercept or zero-aware model is untested.
- **Train-only season start.** `pipeline/build.py` takes `raw_start_month` from the whole MODIS record and passes it to validation, so season metrics in LOYO see the held-out years (audit, 14 Nov). Small leak, affects season metrics only, not the monthly back-cast.
- **Ablation.** No out-of-sample comparison yet of raw MODIS, one global factor, region-only and region x month x day/night on the same folds (audit, 14 Nov).
