# Research 14 Nov 2026: Greek data sources, prior art, Boschetti project, thermal cameras

Web search summaries from the session of 14 Nov 2026. Search snippets, not primary texts, unless stated. Nothing here was checked against a primary document except the VIIRS ATBD (read in full text).

## Existing apps (new beyond related-tools.md)

- Global Forest Watch fire tool: all countries, last 5 years, VIIRS and MODIS shown separately ([GFW blog](https://www.globalforestwatch.org/blog/data-and-tools/wildfire-trends-gfw-fire-data/)).
- Fire anomaly from MODIS/FIRMS, Africa Knowledge Platform ([page](https://africa-knowledge-platform.ec.europa.eu/node/36950)).
- Fused FRP dataset MODIS+VIIRS 2012-2024, about 3.82 times more fire pixels than original MODIS ([Remote Sensing 18(10) 1650](https://www.mdpi.com/2072-4292/18/10/1650)). Dataset, not an app.
- GFED5NRT converts daily VIIRS active fire counts to burned area and emissions with biome-specific lookup tables ([ESSD 18, 7535](https://essd.copernicus.org/articles/18/7535/2026/)).
- EFFIS Current Statistics Portal (read in the browser pane 14 Nov): national and group statistics; burnt area and number of fires against the 14-year mean; seasonal cumulative trend; VIIRS and MODIS thermal anomalies each against the mean of 2012-2021. Other apps: Current Situation Viewer 2.0, long-term fire weather forecast, Wildfire Risk Viewer, Data Request Form.
- No existing app found that combines a harmonized MODIS+VIIRS calendar, anomalies and area selection. No Space Apps project page for this challenge found.

## Boschetti, Roy, Giglio harmonization project

- Source: MODIS Science Team talks 2022 and 2023 ("Is the world burning less?", [2023 PDF](https://modis.gsfc.nasa.gov/sci_team/meetings/202305/presentations/boschetti.pdf)). The host refused connections on 14 Nov, so only search summaries were available (UNVERIFIED in detail).
- Goal: calibrated 25-year MODIS/VIIRS burned area series on a 0.25 degree grid with uncertainties, 2012-2024 plus a VIIRS-only fallback back to 2002. Separate decadal trends from interannual variability and product uncertainty.
- Plan: Landsat-8 and Sentinel-2 reference burned area at sample sites; quantify the discrepancy between active-fire counts and burned-area detections in both records. Landsat check found a large bias from missed small burns. A later version flagged the delayed Collection 2 VIIRS burned area product as a critical risk.
- Related paper: Giglio, Boschetti, Roy et al. 2025, Remote Sensing of Environment 331, 115006, VIIRS burned area validation and comparison with MODIS ([UMD listing](https://geog.umd.edu/node/14382), citation only, no abstract).
- It harmonizes burned area, not hotspot counts. Not a method we can reuse.

## VIIRS burned area ATBD (read in full text, v1.2, July 2017)

[ATBD](https://viirsland.gsfc.nasa.gov/PDF/ATBD_VIIRS_Burned_Area_1.2.pdf)

- The VIIRS product continues the 18-year MODIS MCD64A1 series with the same MCD64 algorithm. Input: 750 m VIIRS bands M5, M7, M8, M11 plus 750 m active fires, output resampled to 500 m. The 375 m I-bands lack the 1.2 and 2.1 um channels.
- Active fires only guide training samples and priors. The ATBD states that area burned cannot be estimated reliably from active fire detections: the satellite may not overpass during burning, clouds and smoke block detection, small and cool fires are missed.
- Validation: 700 Landsat-8 image pairs, stratified by 7 biomes and high or low fire activity (activity from MODIS active fire counts).

## Forecasting (our own assessment, no source)

- Extrapolating the 2000-2025 series is not supported: about 25 years, large interannual variability, trend confounded with the sensor change, drift and harmonization error. Counts are driven by weather and ignition. Show the historical range, not a prediction.

## Thermal cameras in Greece

- No national count of ground cameras found. Press sources only, no official totals.
- AIGIS programme (Civil Protection): thermal and optical cameras, 360 degree cameras, weather stations; 8 systems running per [Newsbomb](https://www.newsbomb.gr/ellada/story/1757645/aigis-pyranixnefsi-me-to-vlemma-sto-mellon-pos-i-texnologia-anixneyei-ti-fotia-prin-ginei-apeili); Samothrace and Thasos ([pameevro.gr](https://pameevro.gr/samothraki-systima-pyroprostasias-aigis/)).
- Parnitha pilot: 135 ADMIE pylons, 540 sensors ([Eleftheros Typos](https://www.eleftherostypos.gr/ellada/entopismos-pyrkagion-me-algorithmo-thermikes-kameres-kai-aisthitires-sta-dasi)).
- Western Greece: 18 detection points on 10-16 m masts ([Kalavryta Press](https://www.kalavrytapress.gr/%CE%B4%CF%85%CF%84%CE%B9%CE%BA%CE%AE-%CE%B5%CE%BB%CE%BB%CE%AC%CE%B4%CE%B1-%CF%80%CF%85%CF%81%CE%B1%CE%BD%CE%AF%CF%87%CE%BD%CE%B5%CF%85%CF%83%CE%B7-%CF%83%CE%B5-18-%CF%83%CE%B7%CE%BC%CE%B5%CE%AF%CF%89%CE%BD/), about 440 days old).
- Patras: 100 sensors, 6 optical and 6 thermal cameras ([dete.gr](https://dete.gr/i-techniti-noimosynis-sti-machi-kata-ton-pyrkagion/)).
- Drones: more than 100 bases planned for 2026, 82 drones in 2025 ([DroneXL](https://dronexl.co/2026/06/26/greece-wildfire-drone-grid-2026/)).
- Satellites: four OroraTech thermal satellites (Hellenic Fire System), launched May 2026 ([SpaceNews](https://spacenews.com/ororatech-deploys-wildfire-constellation-for-greece/)). Full operation expected September 2026, not confirmed.
- No public archive or API for camera detections found, and no history before the 2020s.

## Official Greek fire data

- Hellenic Fire Service publishes past fire data and annual reports on its website (per OECD); no table or download page found. 2019: about 9,500 forest fires recorded ([iMEdD](https://lab.imedd.org/en/greece-burns-in-winter-too/), [OECD 2024](https://www.oecd.org/content/dam/oecd/en/publications/reports/2024/06/taming-wildfires-in-the-context-of-climate-change-the-case-of-greece_754f2c60/cfb797a7-en.pdf)).
- Ministry of Climate Crisis and Civil Protection: cited as a source by papers; no download page found. data.gov.gr: nothing relevant found. This is a gap, not proof of absence. Greek-language search was partial.
- NOA FLAME study of Fire Service data 2000-2024: fires in the May-October season fell from about 4,300 a year (2000-2012) to about 3,700 (2013-2024), burned area rose ([Pappas Post](https://pappaspost.com/data-from-decades-of-greek-fires-analyzed-by-national-observatory-of-athens/)).
- FireCube: daily 1 km datacube for Greece 2009-2020, burned areas rasterized from EFFIS polygons, ignition dates from MODIS, about 10 GB NetCDF ([Zenodo 6475592](https://zenodo.org/records/6475592), [4943354](https://zenodo.org/records/4943354)).
- Copernicus Rapid Mapping per event (Attica 2018, Thasos 2022, Thessaly 2023) in the JRC catalogue.

## Why EFFIS counts (tens to hundreds) differ from Fire Service counts (thousands)

- EFFIS maps burnt area polygons only for fires above about 30 ha. Search results: 2019, 70 fires over 30 ha, 11,110 ha; 2020, 88 fires over 30 ha, 14,915 ha; 2024, 171 fires, 10,782.7 ha (one report row also shows 301 and 43,593 ha, reading unclear). The 30 ha threshold came from the search summaries (UNVERIFIED against the EFFIS report text).
- The Fire Service counts every incident it attends, including very small forest and vegetation fires: about 9,500 in 2019, 941 forest fires in 2023 per one snippet (UNVERIFIED, snippets for 2023 were garbled and conflict: 675 fires, 136,498 ha, and EFFIS mapped 83,152 ha).
- The two numbers measure different things: mapped large fires versus all recorded incidents. Most of the area is in the large fires, most of the count is in small ones.
- Agricultural residue fires are mostly small and below the EFFIS threshold, which links to the Zervaki et al. 2026 finding in [greece.md](../greece.md).
