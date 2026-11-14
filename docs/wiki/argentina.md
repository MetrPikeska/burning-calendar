---
title: Argentina
updated: 2026-11-13
verified_by: argentina.gob.ar pages, CONAE manual, Ley 26.815 text (URLs in source); FIRMS CSV sizes by curl on 11 Nov 2026
sources: [sources/2026-11-13-research-conae-argentina.md, sources/2026-11-13-research-harmonization-validation.md]
---

The challenge author's country. It is our second region, and we have not downloaded its data yet (about 300 MB of FIRMS country CSVs, [data-firms.md](data-firms.md)).

## Institutions

- **CONAE, Unidad de Emergencias y Alertas Tempranas:**
  - In 2022 it produced hotspot maps, burned-area estimates and NO₂/aerosol smoke maps for Córdoba and the Paraná Delta.
  - It sent them to SNMF, the Environment Ministry, the Security Ministry and Córdoba's risk management office.
  - CONAE has been a member of the International Charter Space and Major Disasters since 2003. The Charter was activated for the Córdoba fires in 2020.
- **CONAE hotspot catalogue:** monthly totals by province and department, see [related-tools.md](related-tools.md).
- **SAOCOM:** a 2021 call (IDB, PROSAT II) sought an integrated fire-management platform combining SAOCOM 1 radar with optical sensors. Its fire role is limited and mainly about soil moisture (press quote, secondary).
- **SNMF, Servicio Nacional de Manejo del Fuego,** under the Ministerio de Seguridad Nacional. It publishes:
  - [daily reports](https://www.argentina.gob.ar/ambiente/fuego/reporte-diario-manejo-del-fuego),
  - [occurrence reports](https://www.argentina.gob.ar/ambiente/fuego/alertatemprana/reporte-ocurrencia) that count S-NPP VIIRS hotspots,
  - 24/48/72 h fire danger maps,
  - a monthly 3-month outlook.

## Regulation

- **Ley 26.815:**
  - Art. 14: provinces regulate the use of fire and may ban burning or require authorization.
  - Art. 32(c): burning without authorization is an infraction.
  - Art. 6: each jurisdiction names its own competent authority.
- National calendar of permitted burning: none found (UNVERIFIED).

## Fire regions and seasons

| Region | Season / event | Figure | Status |
|---|---|---|---|
| Paraná Delta wetlands | 2022, from mid-June, peak in August | ≥170,500 ha (CONAE); 386,305 ha (SNMF via Chequeado) | CONAE primary; the SNMF figure is secondary |
| Paraná Delta | 2020 | about 328,000 ha | UNVERIFIED |
| Corrientes | Jan-Feb 2022 | 1,042,514 ha, 12% of the province (INTA via press) | secondary |
| Córdoba hills | winter-spring; 16 Aug to 18 Sep 2022 | Charter activation in 2020 | primary |
| Andean Patagonia (Chubut, Río Negro) | summer | 60,845 ha Oct 2025 to Mar 2026 (Greenpeace) | NGO |
| North (Formosa, Chaco, Santiago del Estero, Santa Fe) | peak Jun-Oct | | UNVERIFIED (weather site) |

**Sensor ratio, Paraná Delta 2020:** 39,821 VIIRS S-NPP hotspots, 39.8% of them in August, against 8,673 MODIS: a ratio of 4.59 (our calculation from Morandeira 2021, [ISPRS Archives](https://isprs-archives.copernicus.org/articles/XLVI-4-W2-2021/109/2021/isprs-archives-XLVI-4-W2-2021-109-2021.pdf)). No CONAE MODIS/VIIRS comparison and no per-sensor Corrientes 2022 counts were found. The whole country lies under the South Atlantic Magnetic Anomaly, whose night filter also drops some small VIIRS fires, so Argentine night ratios will differ from Greek ones ([harmonization.md](harmonization.md)).

The challenge video mentions a fire in Argentina in July 2026 as its example. We could not identify it (UNVERIFIED, see [open-questions.md](open-questions.md)).

Boundaries: [boundaries.md](boundaries.md).
