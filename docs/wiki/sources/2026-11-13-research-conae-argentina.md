# Source: research report A, CONAE / Argentina / calendars / boundaries

Produced 2026-11-13 by a read-only research agent (web search + fetch). This is the agent's report as delivered, and it is not reviewed claim by claim. It is an immutable input; the wiki pages cite it.

---

I didn't find a burning activity calendar published by CONAE, the challenge author's real name, a notable Argentine fire in July 2026, or any official INPE switch from AQUA to a VIIRS reference satellite. Everything else below has a source. Claims I couldn't check against a primary source are marked UNVERIFIED.

## Actionable for the build

1. **Use a "reference satellite" series as your main trend line, the way INPE does.** INPE uses AQUA's afternoon MODIS pass (AQUA_M-T) as the single series for trends, because the detection method and overpass time stay the same over the years. INPE's FAQ says that when AQUA stops, the reference will move to Suomi-NPP VIIRS, and that "the compatibility between the series will then be adjusted cautiously" (agent's translation). That is exactly your harmonization problem. ([INPE FAQ](https://data.inpe.br/queimadas/portal/faq/))
2. **Copy INPE's chart set.** Its country statistics page has a historical series, the current year against min/mean/max of past years (current year excluded, current month flagged as partial), first and second half-year comparisons, a cumulative monthly total and a CSV download. Argentina is one of the countries. ([INPE stats](https://data.inpe.br/queimadas/estatisticas/?tipo=paises&item=brasil))
3. **For Argentina, match CONAE's own tool.** It filters by province and department, defaults to 80% confidence, and returns monthly totals as CSV or SHP. Its MODIS data starts in 2000/2002 and VIIRS in 2012/2019. Before September 2017 (MODIS) and December 2023 (VIIRS) it covers Argentina only. ([CONAE manual e02, 2024](https://catalogos5.conae.gov.ar/catalogofocos/Docs/035_CONAE_AQUA_TERRA_NOAA20_MODIS_VIIRS_FC_VISOR_ManualUsuarios_e02.pdf))
4. **For Greece, compare against EFFIS.** EFFIS has VIIRS and MODIS thermal-anomaly seasonal trends with a 2012–2021 baseline. ([EFFIS applications](https://forest-fire.emergency.copernicus.eu/applications))
5. **Boundaries:** use GISCO NUTS 2024 for Greece, IGN "Departamento" GeoJSON for Argentina, and geoBoundaries (CC BY 4.0) as the global fallback. Avoid GADM if the app may be redistributed.
6. **Expect gaps in AQUA data.** INPE logged days when AQUA didn't image part of South America (10 Jul, 22 Jul and 12 Aug 2026). Show missing-data days in the calendar instead of treating them as zero fires. ([INPE avisos](https://terrabrasilis.dpi.inpe.br/queimadas/portal/pages/secao_informacoes/avisos/index.html))

## 1. CONAE fire products and services

- **Hotspot catalog, "Consultas Interactivas: Incendios":** https://catalogos5.conae.gov.ar/catalogofocos ([manual](https://catalogos5.conae.gov.ar/catalogofocos/Docs/035_CONAE_AQUA_TERRA_NOAA20_MODIS_VIIRS_FC_VISOR_ManualUsuarios_e02.pdf))
  - Satellites: AQUA and TERRA (MODIS), and SNPP and NOAA-20 (VIIRS).
  - Data arrives within 3 hours of the satellite pass.
  - "Totalizar" mode gives monthly counts by province or department. It also has MCD64A1 burned area by province and department, and statistical charts (section 4.6).
  - Queries return at most 400,000 points. Downloading needs a free account at registro.conae.gov.ar.
  - The CSV includes the IGN department ID (`in1`), so CONAE's data joins directly to IGN boundaries.
  - Authors: Valentina Gutierrez and Pablo Thomas. Approved by Mariana Horlent.
- **Burning activity calendar ("calendario de actividad de quemas"):** no CONAE publication with that name found. UNVERIFIED.
- **Emergency unit:** CONAE has a "Unidad de Emergencias y Alertas Tempranas" (Emergency and Early Warning Unit). During the 2022 fires it made hotspot maps, burned-area estimates and NO₂/aerosol smoke maps for Córdoba and the Paraná Delta. It sent them to SNMF, the Environment Ministry, the Security Ministry and Córdoba's risk management office. ([argentina.gob.ar, 20 Sep 2022](https://www.argentina.gob.ar/noticias/los-incendios-vistos-desde-el-espacio))
- **International Charter:** CONAE has been a member since 2003 ([argentina.gob.ar](https://www.argentina.gob.ar/node/412551)). The Charter was activated for the Córdoba fires in 2020 ([Disasters Charter activation 678](https://disasterscharter.org/es/activations/fire-in-argentina-activation-678-)). A caption on a CONAE page mentions a Sentinel-2 product for "activación nro. 157" near Alta Gracia (Sep 2020) ([argentina.gob.ar](https://www.argentina.gob.ar/node/251754)).
- **SAOCOM and fires:**
  - CONAE ran a public call (funded by the Inter-American Development Bank through PROSAT II, 2021) for an integrated fire-management platform combining SAOCOM 1 radar with optical sensors ([argentina.gob.ar](https://www.argentina.gob.ar/node/251754)).
  - A unit coordinator told the press that SAOCOM is mainly useful for soil moisture, so its role in fire work is limited. That quote comes from the newspaper Río Negro, not a primary source.
- **UN statements (COPUOS):** Argentina's statements to the UN mention a hotspot monitoring tool for the Comarca Andina ([2025 statement](https://www.unoosa.org/documents/pdf/copuos/stsc/2025/Statements/6_Argentina.pdf)). The PDF returned a 404 when fetched, so this comes from the search snippet only. Partially UNVERIFIED.
- **Challenge author's real name:** UNVERIFIED.
  - Searches for Compagnucci, Campanucci and Companucci together with CONAE found nothing.
  - The Space Apps 2026 challenge page loads its content with JavaScript, and the agent couldn't extract the challenge text.
  - Check the challenge page in a browser.

## 2. Existing fire calendars to cite or compare against

| Tool | What it shows | Source |
|---|---|---|
| INPE Programa Queimadas, country statistics | Monthly reference-satellite counts since 1998, min/mean/max, CSV; includes Argentina | [data.inpe.br](https://data.inpe.br/queimadas/estatisticas/?tipo=paises&item=brasil) |
| EFFIS Current Statistics Portal | Cumulative burned area and fire counts against a 14-year average; VIIRS/MODIS anomalies against 2012–2021 | [EFFIS](https://forest-fire.emergency.copernicus.eu/applications) |
| GWIS Country Profile | Fire seasonality from GlobFire and MCD64A1, at country and sub-country level. The applications page says 2002–2019; a third-party summary says it now goes to 2024 (UNVERIFIED) | [GWIS](https://gwis.jrc.ec.europa.eu/applications) |
| Greenpeace "Global Fire Calendar" (NGO, not an agency) | MODIS 2001–2022, average monthly profile per country in 4 risk levels; includes Greece and Argentina | [maps.greenpeace.org/projects/firecal](https://maps.greenpeace.org/projects/firecal/) |
| NASA FIRMS seasonality chart | No official one found. UNVERIFIED. Raw data: [FIRMS download](https://firms2.modaps.eosdis.nasa.gov/download/) | n/a |

**History of INPE's reference satellite**

- 22 Aug 2011 notice: the reference changed from NOAA-15 to AQUA because NOAA-15 images had degraded. NOAA-12 was kept for 1998–2007. AQUA sees more hotspots than NOAA-15 but the same spatial pattern and percentage trends. ([INPE notice](https://dataserver-coids.inpe.br/queimadas/queimadas/Publicacoes-Impacto/documentos/20110824_Aviso_Ref_Mudoup_Aqua.pdf))
- The current FAQ gives a different history: NOAA-12 from June 1998 to July 2002, then AQUA_M-T. INPE's own documents contradict each other on this.
- The FAQ names NPP-SUOMI (VIIRS) as the planned successor. It notes VIIRS detects about 10 times more hotspots than MODIS. It does not mention NOAA-20.
- INPE's TerraBrasilis dashboard still used "AQUA/MODIS afternoon pass" as its reference in Oct 2024 ([change history PDF](https://www.terrabrasilis.dpi.inpe.br/app/dashboard/fires/biomes/aggregated/data/historico-de-alteracoes.pdf)).
- Official statement that AQUA has been replaced by S-NPP or NOAA-20: none found as of Nov 2026. UNVERIFIED.

## 3. Argentina fire context

- **SNMF (Servicio Nacional de Manejo del Fuego):** now under the Ministerio de Seguridad Nacional ([SNMF page](https://www.argentina.gob.ar/interior/ambiente/fuego/servicio-nacional)). It publishes:
  - a daily report ([reporte diario](https://www.argentina.gob.ar/ambiente/fuego/reporte-diario-manejo-del-fuego))
  - fire occurrence reports ([ocurrencia](https://www.argentina.gob.ar/ambiente/fuego/alertatemprana/reporte-ocurrencia)); the monthly ones count hotspots from SNPP VIIRS, e.g. [Feb 2024](https://argentina.gob.ar/sites/default/files/2024/01/informe_ocurrencia_febrero2024.pdf)
  - fire danger maps for 24/48/72 hours
  - a monthly 3-month early-warning outlook ([alerta temprana](https://www.argentina.gob.ar/ambiente/fuego/alertatemprana/reportemensual))
- **Burning regulation, Ley 26.815:**
  - Art. 14: each province regulates fire use and may ban risky burning or require prior authorization.
  - Art. 32(c): burning without authorization is an infraction.
  - Art. 6: each jurisdiction names its own competent authority.
  - National calendar of permitted burning: none found. UNVERIFIED. ([law text, AFIP](https://biblioteca.afip.gob.ar/dcp/LEY_C_026815_2012_11_28))
- **Main fire regions and seasons:**
  - **Paraná Delta (wetlands), 2022:** CONAE estimated at least 170,500 ha burned since mid-June, and Córdoba fires from 16 Aug to 18 Sep 2022 ([argentina.gob.ar](https://www.argentina.gob.ar/noticias/los-incendios-vistos-desde-el-espacio)). Chequeado, a fact-checking site, cites SNMF for 386,305 ha in the Delta in 2022, with the peak in August. Secondary source.
  - **Paraná Delta, 2020:** about 328,000 ha, from secondary sources. UNVERIFIED as a primary figure.
  - **Corrientes (Jan–Feb 2022):** INTA reported 1,042,514 ha (12% of the province) by 27 Feb 2022. That figure comes from press reports quoting INTA; the original INTA report was not found.
  - **Córdoba hills:** winter–spring fire season; the Charter was activated in Sep 2020 (see above).
  - **Andean Patagonia (Chubut, Río Negro):** summer season. Greenpeace (NGO) estimated 60,845 ha burned from Oct 2025 to Mar 2026.
  - **Regional seasons from SNMF:** Meteored, a weather site, says the North (Formosa, Chaco, Santiago del Estero, Santa Fe) peaks June–October. No official SNMF regional calendar found. UNVERIFIED.
- **July 2026 fire:** UNVERIFIED.
  - The only hits came from news aggregators with unreliable dates (e.g. Última Hora; a fire near San Rafael, Mendoza, over 4,000 ha around 11 Jul).
  - Several "July 2026" articles actually describe the summer Patagonia fires.
  - Check SNMF daily reports for July 2026.

## 4. Administrative boundaries

| Dataset | Download | License |
|---|---|---|
| Greece NUTS 2024 (latest version, dated 01/01/2024) | [GISCO NUTS download](https://gisco-services.ec.europa.eu/distribution/v2/nuts/download): e.g. `ref-nuts-2024-01m.geojson.zip`, scales 1M/3M/10M/20M/60M, formats SHP/GeoJSON/TopoJSON/GDB/Parquet | GISCO's own download provisions plus Eurostat's copyright notice ([GISCO NUTS page](https://ec.europa.eu/eurostat/web/gisco/geodata/statistical-units/territorial-units-statistics)). Exact license text not read. UNVERIFIED |
| Argentina provinces and departments (IGN) | [IGN Capas SIG](https://www.ign.gob.ar/NuestrasActividades/InformacionGeoespacial/CapasSIG), under Geodesia y demarcación > Límites: Provincia, Departamento; SHP/KML/GeoJSON/CSV; EPSG:4326 | IGN's "Términos y Condiciones" page, not read. UNVERIFIED. The datos.gob.ar departments layer, derived from IGN data, is CC BY 4.0 ([datos.gob.ar](https://www.datos.gob.ar/dataset/jgm-servicio-normalizacion-datos-geograficos)) |
| geoBoundaries (global) | `https://www.geoboundaries.org/api/current/gbOpen/ARG/ADM2/` ([API](https://www.geoboundaries.org/api.html)) | CC BY 4.0, attribution required; cite Runfola et al. 2020, [doi:10.1371/journal.pone.0231866](https://doi.org/10.1371/journal.pone.0231866) ([geoboundaries.org](https://www.geoboundaries.org/)) |
| GADM | gadm.org | Free for academic and other non-commercial use; "Redistribution or commercial use is not allowed without prior permission" ([GADM license](https://gadm.org/license.html)) |
