---
title: Region boundaries
updated: 2026-11-14
verified_by: download pages linked below; licence pages read 14 Nov 2026: https://ec.europa.eu/eurostat/web/gisco/geodata/administrative-units, https://ec.europa.eu/eurostat/help/copyright-notice, https://www.ign.gob.ar/descargas/tyc1.html, https://datos.gob.ar/dataset/unidades-territoriales
sources: [sources/2026-11-13-research-conae-argentina.md]
---

| Dataset | Use | Download | Licence |
|---|---|---|---|
| GISCO NUTS 2024 | Greece NUTS2 / NUTS3 | [GISCO NUTS download](https://gisco-services.ec.europa.eu/distribution/v2/nuts/download), e.g. `ref-nuts-2024-01m.geojson.zip`; scales 1M to 60M; SHP, GeoJSON, TopoJSON, GDB, Parquet | NUTS page states no licence. GISCO administrative units: right to use and process, not for commercial purposes; attribution "© EuroGeographics for the administrative boundaries". Eurostat general notice: reuse with source acknowledged, editorial content CC BY 4.0; whether it covers NUTS geodata is not confirmed |
| IGN Argentina, Provincia and Departamento | Argentina provinces and departments; joins to CONAE `in1` ids | [IGN Capas SIG](https://www.ign.gob.ar/NuestrasActividades/InformacionGeoespacial/CapasSIG), Geodesia y demarcación > Límites; SHP, KML, GeoJSON, CSV; EPSG:4326 | IGN Términos y Condiciones: share downloaded data freely and free of charge, commercial use only in derivative works, attribution "FUENTE: Instituto Geográfico Nacional de la República Argentina" plus the date of the original data. datos.gob.ar `unidades-territoriales` (IGN, updated 4 Aug 2026) states no licence; earlier note that the departments layer is CC BY 4.0 is UNVERIFIED |
| geoBoundaries gbOpen | Global fallback | `https://www.geoboundaries.org/api/current/gbOpen/ARG/ADM2/` | CC BY 4.0; cite Runfola et al. 2020, [doi:10.1371/journal.pone.0231866](https://doi.org/10.1371/journal.pone.0231866) |
| GADM | Avoid | gadm.org | Non-commercial only; no redistribution without permission |

The current analysis boxes (Central Macedonia plain, Thessaly plain, Evros, Attica) are defined in `scripts/firms_io.py` (`REGIONS`). They are placeholders. Decided 13 Nov 2026: fit on NUTS2 and IGN provinces, display also NUTS3 and departments ([decisions.md](decisions.md)). Web geometry: GISCO NUTS 2024 1:20M and IGN simplified with mapshaper, one TopoJSON per country; datos.gob.ar CC BY 4.0 departments as the Argentina fallback if the IGN terms do not allow redistribution.

In use (14 Nov 2026, `pipeline/regions.py`): `https://gisco-services.ec.europa.eu/distribution/v2/nuts/geojson/NUTS_RG_{01M|20M}_2024_4326_LEVL_{2|3}.geojson`, all four return HTTP 200, saved in `data/raw/boundaries/`. Fields used: `NUTS_ID`, `NAME_LATN`, `CNTR_CODE` (`EL` for Greece). 13 Greek NUTS2 regions (EL30, EL41-43, EL51-54, EL61-65). 1:1M for assignment, 1:20M for the web map.

IGN provinces in use (14 Nov 2026): the Capas SIG page has no direct file link; its "Descargar Capa" button calls the GeoServer WFS `https://wms.ign.gob.ar/geoserver/ign/ows?service=WFS&version=1.0.0&request=GetFeature&typeName=ign%3Aprovincia` with `outputFormat` `SHAPE-ZIP`, `application/json`, KML or `csv`. Fields: `in1` (2-digit code, e.g. `02` CABA, `06` Buenos Aires, `14` Córdoba), `nam`, `fna`, `gna`. Full resolution, the GeoJSON is over 40 MB and the server sends about 1.5 MB per minute; a 180 s curl timeout truncated it. The layer includes the Antarctic sector of Tierra del Fuego; `pipeline/regions.py` clips to latitude > -56.
