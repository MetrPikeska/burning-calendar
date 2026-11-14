# Challenge: Harmonization of MODIS and VIIRS Hot Spots

## Short description (Space Apps challenge list)

> Understanding how burning activity is distributed across our planet over time, including wildfires and agricultural burns intense enough to be detected by satellite sensors, enables us to anticipate critical periods, guide monitoring efforts, and improve fire response. Satellites have tracked active fire hotspots for more than two decades, but the record is split across sensors whose data cannot be compared directly, leaving fire managers without a consistent picture of when and where burning has occurred. Your challenge is to build a web application that harmonizes these records into a burning activity calendar based on active fire hotspots, enabling early warning and emergency responders, scientists, and land managers to examine historical fire patterns, unusual conditions, and critical periods within a selected area of interest.

## Challenge author video (summary of an automatic transcript)

The challenge author works at CONAE, the Argentine space agency, at the Teófilo Tabanera Space Center in Córdoba. The transcript spells her name "Marina Companuchi", which may be wrong, so check it on the challenge page.

- **Context:** her team supports early warning and emergency response worldwide (fires, floods, oil spills). About half of those emergencies are fires: forest wildfires, plus fires from agriculture, industry and land clearing.
- **How hotspots are used now:**
  - During an ongoing fire, the team monitors it from hotspots while waiting for a detailed satellite image.
  - Hotspots also show where the fire can and cannot spread.
  - The example is a fire in Argentina, July 2026. The location is garbled in the transcript.
- **Burning activity calendar (fire activity calendar):**
  - It combines historical and recent hotspots and shows trends, anomalies and seasonal patterns.
  - Example from the video: how many hotspots a given month has across different years.
  - Climate models project more frequent and more intense fire weather, which makes such tools more important.
- **The problem:**
  - MODIS and VIIRS differ in spatial resolution, sensitivity and observation schedule, so their data cannot be compared directly.
  - MODIS is reaching the end of its operational life and VIIRS is replacing it.
  - Without a method to compare them, "almost 10 years of historical information will be lost".
- **The ask:** a harmonized burning activity calendar that combines the long MODIS history with the continuity and finer detail of VIIRS, giving a consistent time series of hotspot activity inside an application.
- **Suggested resources:** NASA FIRMS, plus resources from CONAE and other agencies. Check the challenge Resources tab.
- **Two suggested parts:**
  1. **Harmonization:** in the end it should not matter which sensor a hotspot came from. What matters are the trends, anomalies and patterns.
  2. **Web application:** takes the hotspots as input and shows them in a calendar. The user picks a date and a region, sees its fire activity history, and can download analytics.
- Other approaches are welcome.

## What this means for us

- **The author is confirmed:** CONAE, Argentina.
- **Calendar = month × year matrix.** This matches the planned heatmap.
- **New must-haves:**
  - select a date (month or date range) and a region,
  - download analytics (CSV/JSON for the selected region).
- **Argentina as a second country:** the author's own country, so it is cheap and visible. FIRMS country CSVs exist for Argentina. MODIS is about 4-6 MB per year and VIIRS about 14 MB per year (2025), so roughly 300 MB in total. Download it at home.
