# Burning calendar: harmonized MODIS + VIIRS fire hotspots

NASA Space Apps Challenge 2026, Thessaloniki. Challenge: "Harmonization of MODIS and VIIRS Hot Spots" (CONAE). Team Spearow: Petr, Vita.

A web app that joins MODIS (2000-) and VIIRS (2012-) active fire records from NASA FIRMS into one burning activity calendar per region, for Greece and Argentina.

- Research and design notes: [docs/wiki/index.md](docs/wiki/index.md)
- What was prepared before the event: [docs/prep-log.md](docs/prep-log.md)

Work in progress.

## Licence and how to cite

Code: MIT ([LICENSE](LICENSE)). Harmonized data in `web/public/data/v1/`: CC BY 4.0. Region polygons keep their source terms, see [DATA_LICENSE.md](DATA_LICENSE.md) for FIRMS, GISCO and IGN.

Cite the release from [CITATION.cff](CITATION.cff) (GitHub shows it under "Cite this repository") and name the data version:

> Mikeska, P., Kadlec, V. (2026). Burning calendar: harmonized MODIS + VIIRS fire hotspots for Greece and Argentina, v1 (method v1-region-month-dn-loyo). https://github.com/MetrPikeska/burning-calendar

Also cite NASA FIRMS for the source detections, with the acknowledgement and method papers listed in [DATA_LICENSE.md](DATA_LICENSE.md). A DOI is planned for later versions.

## Next steps

Release v1 covers Nov 2000 to Dec 2025, by month, for Greek NUTS2 regions and Argentine provinces. Two target users tested the web and the MCP server on 14 Nov 2026, an early warning analyst and a research scientist ([feedback](docs/notes/2026-11-14-feedback-early-warning-research.md)). Their priorities set this order:

1. **Near-real-time.** S-NPP FIRMS production ended on 2 Nov 2026. Splice VIIRS to NOAA-20, which overlaps S-NPP since Apr 2018, with a factor per region and day/night fitted on Apr 2018 to Oct 2026, then to NOAA-21. Add FIRMS NRT detections, and return the last update date and the delay status in every API and MCP answer.
2. **Daily series and finer tiles.** Daily counts and days with a detection per region. A grid or municipalities instead of NUTS2: Attica or the Peloponnese hide local hotspots.
3. **Risk context.** Weather and the Fire Weather Index (FWI), severity levels (normal, elevated, critical), webhook notifications.
4. **Drought as a predictor.** SPEI/SPI, soil moisture from ERA5-Land or Copernicus, NDVI/NDMI. Test the lag: how many weeks drought leads a detection anomaly, by lag correlation and a regression that controls for season and trend.
5. **Fires, not only detections.** Link burned area (EFFIS, MODIS MCD64A1), plot detections against burned area, cluster detections into events in space and time.
6. **Better anomalies.** A detrended baseline, since Greece has a trend, and an anomaly score with an interval in place of the binary 90th percentile flag.
7. **Citable, open data.** A DOI for each dataset version and an API to the raw daily data under the same licence.
