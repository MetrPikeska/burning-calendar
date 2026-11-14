---
title: Greece
updated: 2026-11-14
verified_by: sources below; our own seasonality from scripts/ratio_check.py; EFFIS applications page read 14 Nov 2026
sources: [sources/2026-11-11-research-modis-viirs.md, sources/2026-11-14-research-greek-data-prior-art.md, https://egusphere.copernicus.org/preprints/2026/egusphere-2026-4576/]
---

## Fire regimes in our data (2012-2025)

- **Summer wildfires:** the national peak is in August. Evros and Attica peak in August in both sensors. Fires are large with high FRP.
- **Agricultural residue burning:** small fires with low FRP.
  - Central Macedonia plain: two seasons, Jan-Mar and Oct-Nov.
  - Thessaly plain: MODIS peaks in October, VIIRS in July. VIIRS likely catches small wheat-stubble fires that MODIS misses. This is our interpretation and has not been checked against field data.
- The satellite cannot tell fire types apart. We will estimate them from CORINE land cover, season and FRP. That estimate is not validated per fire.

## Facts from sources

- **Zervaki, Grillakis & Voulgarakis 2026** (EGUsphere preprint):
  - MODIS MCD64A1 burned area is 41% above Hellenic Fire Service records for 2002-2023, and only 12% above on natural land cover.
  - The excess comes from cropland burning in Thessaly-Central Greece and Macedonia-Thrace, which the Fire Service does not record.
  - The difference peaks in Sep-Oct.
- **Legal:**
  - EU CAP conditionality GAEC 3: "Ban on burning arable stubble, except for plant health reasons", Reg. (EU) 2021/2115 Annex III. Wording confirmed only via a 2026 Council draft.
  - Greece also bans open burning of crop residues in the fire season (secondary source).
- **March 2025:** more than 70 fires in one day, mostly crop residue burning, led to a temporary nationwide ban (To Vima, secondary).
- **Evros/Dadia 2023:** the largest single wildfire in the EU since EFFIS records began, about 81,000 ha (AFP via phys.org).
- **2007 and 2021 areas:** take them from the EFFIS annual reports. UNVERIFIED.

## Land cover

- **CORINE Land Cover**, 100 m, 2000/2006/2012/2018: https://land.copernicus.eu/en/products/corine-land-cover
  - arable 211-213 (212 permanently irrigated, 213 rice fields),
  - heterogeneous agriculture 241-244.
- **ESA WorldCover** 10 m, 2020 ([doi:10.5281/zenodo.5571936](https://doi.org/10.5281/zenodo.5571936)) and 2021 ([doi:10.5281/zenodo.7254221](https://doi.org/10.5281/zenodo.7254221)). The algorithm versions differ, so do not treat 2020 vs 2021 differences as real change.

## Official and reference data (14 Nov 2026)

Detail and links: [sources/2026-11-14-research-greek-data-prior-art.md](sources/2026-11-14-research-greek-data-prior-art.md).

- **Hellenic Fire Service:** annual reports and past fire data on its website per OECD. No download page found. About 9,500 forest fires in 2019 (iMEdD).
- **EFFIS:** burnt area polygons and national annual totals; the best source for validation totals. FireCube (Zenodo 6475592) is a daily 1 km Greece datacube for 2009-2020 built on EFFIS polygons.
- **Ministry of Climate Crisis and Civil Protection, data.gov.gr:** nothing found. A gap, not proof of absence.
- **Fire counts differ by orders of magnitude between sources.** EFFIS maps only fires above about 30 ha (UNVERIFIED): tens to low hundreds a year (70 in 2019, 88 in 2020, 171 in 2024 in search snippets). The Fire Service counts all incidents: thousands a year. They measure different things, so never compare the two counts directly. A hotspot count is a third quantity, since one fire gives many detections.
- **Use for us:** compare yearly EFFIS or Fire Service totals with our harmonized counts as an independent check of seasonality. Expect correlation, not equal numbers.
- **Thermal cameras:** only local networks (AIGIS, Parnitha, Patras), no national count, no public archive. Not usable as data. Four OroraTech thermal satellites launched May 2026.

Boundaries: [boundaries.md](boundaries.md). Numbers: [findings-greece.md](findings-greece.md).
