---
title: Greece
updated: 2026-11-13
verified_by: sources below; our own seasonality from scripts/ratio_check.py
sources: [sources/2026-11-11-research-modis-viirs.md, https://egusphere.copernicus.org/preprints/2026/egusphere-2026-4576/]
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

Boundaries: [boundaries.md](boundaries.md). Numbers: [findings-greece.md](findings-greece.md).
