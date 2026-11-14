# SPEC: Burning Calendar, 30 s rough cut

```text
GOAL:    a judge understands in 30 s that switching from MODIS to VIIRS fakes a jump in fire
         records, that we remove it, and that the app answers "is this month abnormal here?"
OUTPUT:  HyperFrames, 1920 x 1080, 30 fps
TIME:    30 s x 30 = 900 frames, no music, no voice (rough cut)
LOOK:    ground #faf8f5 (the app's --bg), ink #1d1b19, muted #615a53, rules #e2dbd2;
         raw series ink, the 2012 jump in orange #f57d15, harmonized line and band in inferno
         purple #6a176e (band at 16 % opacity), anomaly blue #1565b5 only for "26x".
         IBM Plex Sans Variable (the app's face): titles 76-96 px weight 650, tracking -1.5 %;
         labels 30-34 px weight 450; header 28 px. Tabular figures everywhere.
         Medium: the real app (screen recording) and a flat chart drawn like the app's charts.
OBJECTS: the yearly line chart of Greece (axis, year ticks every 4 years, 2012 marker);
         the app at 1920 x 1080 with a visible cursor; two numbers; the end card.
MOTION:  enter expo.out / power4.out, camera power2.inOut, exit power3.in.
         Lines draw at constant speed (linear progress), the 2012 step in 0.3 s.
         Exits 40-50 % shorter than entrances. Titles land and hold still.
SHOTS:   f0-f330     (0-11 s)  chart scene
           0-3.0 s   raw stitched series draws 2003 -> 2025, the 2012 step lands at 1.9 s
           3.1-5.4 s "Did fires in Greece triple in 2012?"  (ratio from data.js)
           5.4-7.6 s "No. The satellite changed." + "VIIRS sees 3.5x more detections ..."
           7.6-11 s  y axis rescales, raw MODIS fades to grey, harmonized line + band draw
         f330-f390   (11-13 s)  night map of Greece: VIIRS detections 15 Jul-31 Aug 2021 light up
                     day by day (date and count top right, "Evia" at 6 Aug), real data, no AI imagery
         f390-f600   (13-20 s)  app recording: Greece, click Evia (Sterea Elláda, EL64), click Aug 2021,
                     punch-in x2 on the median panel at 4.0 s: "4,235 ... 67x the median"
         f600-f735   (20-24.5 s) MCP: same question about Evia Aug 2021, get_anomalies call,
                     tool response 4,235 detections, 67x the median, caveat, view_url
         f735-f810   (24.5-27 s) two numbers: 5.4 % and 86 % vs 57 %, source line
         f810-f900   (27-30 s)   end card: Burning Calendar, Team Spearow, Petr Mikeska,
                     Vít Kadlec, challenge name, NASA FIRMS, app URL, MCP URL
BANNED:  dark void with glow, three cards in a row, bullet slides, KPI grid, NASA logos or
         mission marks anywhere, generated footage without the "AI-generated" watermark,
         any number not in assets/data.js or the README validation table.
QA:      0 s chart visible (never blank); 2 s step visible; 5 s question readable;
         10 s harmonized line and band; 12.2 s map with the Evia burst; 19.5 s 67x sentence sharp;
         23.5 s MCP response; 25.8 s both numbers; 29 s team, members, challenge, URLs.
```

Notes

- The chart starts in 2003, the first full Terra + Aqua year. 2001-2002 use the Terra-only chained factor; the back-cast 2001 total (14,216) would read as an unexplained spike in a 30 s film.
- The harmonized band is the sum of monthly 10th-90th percentile bounds, wider than a true annual interval.
- Footage: `assets/footage/app-evia.mp4`, recorded 14 Nov 2026 from https://burning-calendar.vercel.app by a Playwright + CDP screencast script (cursor drawn by an injected overlay). Production still showed data to Dec 2025 at recording time.
