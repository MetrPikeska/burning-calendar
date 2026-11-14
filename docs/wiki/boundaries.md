---
title: Region boundaries
updated: 2026-11-13
verified_by: download pages linked below; licence texts for GISCO and IGN not read
sources: [sources/2026-11-13-research-conae-argentina.md]
---

| Dataset | Use | Download | Licence |
|---|---|---|---|
| GISCO NUTS 2024 | Greece NUTS2 / NUTS3 | [GISCO NUTS download](https://gisco-services.ec.europa.eu/distribution/v2/nuts/download), e.g. `ref-nuts-2024-01m.geojson.zip`; scales 1M to 60M; SHP, GeoJSON, TopoJSON, GDB, Parquet | Eurostat copyright notice plus GISCO provisions; exact text UNVERIFIED |
| IGN Argentina, Provincia and Departamento | Argentina provinces and departments; joins to CONAE `in1` ids | [IGN Capas SIG](https://www.ign.gob.ar/NuestrasActividades/InformacionGeoespacial/CapasSIG), Geodesia y demarcación > Límites; SHP, KML, GeoJSON, CSV; EPSG:4326 | IGN terms UNVERIFIED; the datos.gob.ar departments layer, derived from IGN, is CC BY 4.0 |
| geoBoundaries gbOpen | Global fallback | `https://www.geoboundaries.org/api/current/gbOpen/ARG/ADM2/` | CC BY 4.0; cite Runfola et al. 2020, [doi:10.1371/journal.pone.0231866](https://doi.org/10.1371/journal.pone.0231866) |
| GADM | Avoid | gadm.org | Non-commercial only; no redistribution without permission |

The current analysis boxes (Central Macedonia plain, Thessaly plain, Evros, Attica) are defined in `scripts/firms_io.py` (`REGIONS`). They are placeholders. Decided 13 Nov 2026: fit on NUTS2 and IGN provinces, display also NUTS3 and departments ([decisions.md](decisions.md)). Web geometry: GISCO NUTS 2024 1:20M and IGN simplified with mapshaper, one TopoJSON per country; datos.gob.ar CC BY 4.0 departments as the Argentina fallback if the IGN terms do not allow redistribution.
