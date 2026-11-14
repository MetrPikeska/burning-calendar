# Review: rough cut v4 (14 Nov 2026)

v4 keeps the film in Greece: the app shot is re-recorded on Evia (Sterea Elláda, EL64), Aug 2021, 4,235 detections, 67x the 2011-2020 median, the same answer the MCP scene shows next ("Same question, from any AI assistant"). Argentina stays in the numbers' small print and on the end card.

## v3

v3 replaces the Higgsfield placeholder (11-13 s) with a map drawn from real VIIRS detections, `scripts/build_fires.py` -> `assets/fires.js` (7,280 detections, Greece, 15 Jul-31 Aug 2021; 3,623 on 6 Aug). The map is SVG, one path per day: a canvas did not paint on seeked frames. The video now contains no generated imagery.


v2 adds a 4.5 s MCP scene (20-24.5 s, Evia Aug 2021 via get_anomalies, numbers equal to the production tool response) and the MCP URL on the end card; the app shot shrinks to 7 s, the numbers to 2.5 s. Frame times in the table below are from v1.

Render: `out/burning-calendar-roughcut-v4.mp4`, 30.0 s, 1920x1080, 30 fps, H.264, 3.4 MB, no audio. `check`: 0 errors.

## Checked frames

| t | Shows | OK |
|---|---|---|
| 0 s | header with challenge and team, chart axes, line starting at 2003 | yes |
| 2.5 s | 2012 step in orange, marker "2012: MODIS (1 km) → VIIRS (375 m)" | yes |
| 4.5 s | "Did fires in Greece triple in 2012?" (2,651 → 7,805 = 2.9x) | yes |
| 6.5 s | "No. The satellite changed." + 3.5x (VIIRS/MODIS 2012-2019) | yes |
| 10 s | harmonized line and band, raw MODIS dotted, step gone | yes |
| 12.5 s | placeholder with "AI-generated (Higgsfield)" watermark | yes |
| 17.6 s | app: Entre Ríos selected, Aug 2020 clicked | yes |
| 20 s | punch-in x2: "16,492 ... 26x the median of August 2010-2019 (634)" | yes |
| 24.5 s | 5.4 % and 86 % vs 57 %, Argentina 1.5 %, 100 % vs 86 %, source line | yes |
| 29.5 s | Burning Calendar, Team Spearow, Petr Mikeska, Vít Kadlec, challenge, URL | yes |

## Known issues (accepted for the rough cut)

- Read-time warnings: the 3.5x subline (1.7 s), numbers source line (3.3 s) and the end card (3 s) are under the checker's reading floor. A 30 s cap forces it; cut words before the final, not time from the chart.
- No sound. `film_silent` warning. A short music bed would help; Space Apps does not require it.
- "raw MODIS" label sits close to the dotted line around 2006.
- The app footage shows production as of 14 Nov 15:55 (data to Dec 2025, header "2000-2025"). Re-record after the Oct 2026 data are deployed with `scripts/record_app.cjs` (usage in its header).
- Playwright `recordVideo` needs its own ffmpeg build (missing in ~/.cache/ms-playwright), so the recording uses a CDP screencast and system ffmpeg.

## Next

1. Petr approves the cut or asks for changes.
3. Re-record the app footage after deploy, re-render, upload (YouTube unlisted or Drive), link in the project page.
