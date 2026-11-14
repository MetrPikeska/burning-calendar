---
title: Existing fire calendars and tools
updated: 2026-11-13
verified_by: URLs below, read by the research agent on 13 Nov 2026
sources: [sources/2026-11-13-research-harmonization-validation.md, sources/2026-11-13-research-conae-argentina.md]
---

| Tool | What it does | Relevance |
|---|---|---|
| [CONAE "Consultas Interactivas: Incendios"](https://catalogos5.conae.gov.ar/catalogofocos) | Hotspots from Aqua, Terra (MODIS), S-NPP and NOAA-20 (VIIRS) within 3 h of the overpass | The challenge author's own agency; mirror its options for Argentina |
| [INPE Programa Queimadas, statistics](https://data.inpe.br/queimadas/estatisticas/?tipo=paises&item=brasil) | Monthly reference-satellite counts since 1998, current year against min/mean/max, cumulative curves, CSV. Covers Argentina too. | Closest existing "burning calendar"; copy the chart set |
| [EFFIS applications](https://forest-fire.emergency.copernicus.eu/applications) | Cumulative fires and burnt area against a multi-year average; VIIRS/MODIS anomalies against 2012-2021 | Comparison for Greece |
| [GWIS applications](https://gwis.jrc.ec.europa.eu/applications) | Country profiles, seasonal cumulative fires against the 10-year mean | Anomaly pattern |
| [Greenpeace Global Fire Calendar](https://maps.greenpeace.org/projects/firecal/) | MODIS 2001-2022, average monthly profile per country in 4 levels. Run by an NGO. | Prior art; MODIS only, not harmonized |
| NASA FIRMS | Raw data. No official seasonality chart found (UNVERIFIED). | Our data source |

## CONAE catalogue details

- Manual: [e02, 2024](https://catalogos5.conae.gov.ar/catalogofocos/Docs/035_CONAE_AQUA_TERRA_NOAA20_MODIS_VIIRS_FC_VISOR_ManualUsuarios_e02.pdf).
- Filters by province and department. Confidence defaults to 80%.
- "Totalizar" returns monthly totals as CSV or SHP. MCD64A1 burned area by province and department is also available.
- MODIS from 2000/2002, VIIRS from 2012/2019.
- Coverage is Argentina only before Sep 2017 (MODIS) and Dec 2023 (VIIRS).
- A query returns at most 400,000 points. Downloads need a free account.
- The CSV carries the IGN department id (`in1`), so it joins to IGN boundaries.

## INPE reference satellite

- INPE keeps one satellite as the reference for trends. That is Aqua MODIS, afternoon pass (AQUA_M-T).
- In 2011 it moved the reference from NOAA-15 to Aqua, without calibration. Its argument: Aqua counts are higher, but the spatial distribution and the percent change over time stay the same ([INPE aviso 2011](https://dataserver-coids.inpe.br/queimadas/queimadas/Publicacoes-Impacto/documentos/20110824_Aviso_Ref_Mudoup_Aqua.pdf)).
- Its FAQ names S-NPP VIIRS as the successor and notes VIIRS sees about 10× more hotspots than MODIS.
- **It has not switched.** Aqua is still the reference in the Jul-Aug 2026 notices on Aqua gaps ([INPE Avisos](https://data.inpe.br/queimadas/avisos/)). The [FAQ](https://data.inpe.br/queimadas/portal/faq/) says S-NPP takes over "quando o satélite AQUA deixar de operar", with compatibility "ajustada cautelosamente". No adjustment method is published, and the named successor S-NPP itself stopped on 2 Nov 2026. INPE pages were read through a fetch summary, not as raw text.
- The "~10×" is an undocumented round number. It is far above Paraná Delta 2020 (4.6, [argentina.md](argentina.md)) and Punjab (4.8-6.5), so do not use it for Argentina.
- INPE documents disagree on the early history, NOAA-12 vs NOAA-15.
