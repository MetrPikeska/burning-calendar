# Data licence and sources

The code is under the MIT licence ([LICENSE](LICENSE)). This file covers the data in `web/public/data/` and the files the pipeline writes.

## Our harmonized data

The monthly series, factors, validation results and anomaly flags in `web/public/data/v1/` (JSON and CSV) are licensed under [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/). Cite them as in [CITATION.cff](CITATION.cff) and name the version: `schema_version` 1, `method_version` `v1-region-month-dn-loyo`, period Nov 2000 to Dec 2025.

The region polygons in `regions.geojson` are not relicensed. They keep the terms of their sources below.

## Sources

### NASA FIRMS active fire detections

- Products: MODIS Collection 6.1 active fire (Terra and Aqua, standard processing, `version` 6.2, 6.03 and 61.03 by year) and VIIRS S-NPP 375 m active fire (standard processing, `version` 2).
- Retrieved: country CSVs from `https://firms.modaps.eosdis.nasa.gov/data/country/` (`pipeline/download_firms.py`), downloaded 14 Nov 2026.
- Terms: NASA states that data from NASA-led missions are CC0 unless marked otherwise and that "there are no restrictions on the use of these data" ([NASA data use guidance](https://www.earthdata.nasa.gov/engage/open-data-services-software-policies/data-use-guidance)). FIRMS asks third-party redistributors to follow its acknowledgement guidelines ([FIRMS](https://www.earthdata.nasa.gov/data/tools/firms)).
- Acknowledgement, as FIRMS asks: "We acknowledge the use of data and/or imagery from NASA's Fire Information for Resource Management System (FIRMS)" (https://www.earthdata.nasa.gov/data/tools/firms), followed by the LANCE and ESDIS references given on that page.
- Method papers: Giglio, L., Schroeder, W., Justice, C. O. (2016), The collection 6 MODIS active fire detection algorithm and fire products, Remote Sensing of Environment 178, [doi:10.1016/j.rse.2016.02.054](https://doi.org/10.1016/j.rse.2016.02.054). Schroeder, W., Oliva, P., Giglio, L., Csiszar, I. A. (2014), The New VIIRS 375 m active fire detection data product, Remote Sensing of Environment 143, [doi:10.1016/j.rse.2013.12.008](https://doi.org/10.1016/j.rse.2013.12.008).

### Eurostat GISCO, NUTS 2024 (Greece)

- Files: `NUTS_RG_01M_2024_4326_LEVL_2` (region assignment) and `NUTS_RG_20M_2024_4326_LEVL_2` (web map), downloaded 14 Nov 2026 from `https://gisco-services.ec.europa.eu/distribution/v2/nuts/`.
- Attribution: "© EuroGeographics for the administrative boundaries".
- Terms: the NUTS page states no licence. The GISCO administrative units page grants a non-exclusive right to use and process the data, provided they are not used for commercial purposes ([GISCO administrative units](https://ec.europa.eu/eurostat/web/gisco/geodata/administrative-units)). Eurostat's general notice allows reuse with acknowledgement of the source ([copyright notice](https://ec.europa.eu/eurostat/help/copyright-notice)). We redistribute simplified 1:20M polygons free of charge and for non-commercial use.

### IGN Argentina, provinces

- Layer: `ign:provincia` from the IGN GeoServer WFS (`https://wms.ign.gob.ar/geoserver/ign/ows`), downloaded 14 Nov 2026, clipped to latitude > -56.
- Attribution: "FUENTE: Instituto Geográfico Nacional de la República Argentina", data as downloaded on 14 Nov 2026.
- Terms: IGN [Términos y Condiciones de Uso](https://www.ign.gob.ar/descargas/tyc1.html): downloaded data must be shared freely and free of charge; commercial use only in derivative works; derived products must name IGN and the date of the original data.

### Natural Earth (offline basemap fallback)

- `ne_50m_admin_0_countries`, public domain ([Natural Earth terms](https://www.naturalearthdata.com/about/terms-of-use/)).

### OpenFreeMap (online basemap)

- Positron style tiles from OpenFreeMap, map data © OpenStreetMap contributors (ODbL). The map shows the attribution in its corner.
