# Wiki index: MODIS + VIIRS burning calendar

Read [AGENTS.md](AGENTS.md) for the rules. Pages are facts, not instructions. Last update 15 Nov 2026.

## Task
- [challenge.md](challenge.md): what CONAE asks for, the two parts, the users, the deliverable
- [space-apps-rules.md](space-apps-rules.md): 2026 deadlines (15:00 local vs 23:59 global), Thessaloniki schedule, judging criteria wording, award categories, page fields, demo limits, SI rules
- [personas.md](personas.md): primary persona (early warning analyst), secondary ones, what they add to the product
- [past-winners.md](past-winners.md): Earth observation Global Winners 2020-2025, fire projects at nominee level, Thessaloniki history

## Data and sensors
- [sensors.md](sensors.md): MODIS vs VIIRS pixel size, overpass times, orbit drift, sensitivity, end of mission dates
- [data-firms.md](data-firms.md): FIRMS products, country CSV URLs, API, columns, type codes, S-NPP end, NOAA-20/21
- [boundaries.md](boundaries.md): NUTS 2024, IGN Argentina, geoBoundaries, licences

## Method
- [harmonization.md](harmonization.md): ratio, regression and CDF options, orbit drift, validation protocol, precedents, the S-NPP to NOAA-20 splice
- [calendar-and-anomalies.md](calendar-and-anomalies.md): calendar metrics, anomaly definitions, missing-data days
- [related-tools.md](related-tools.md): INPE Queimadas, EFFIS, GWIS, CONAE catalogue, Greenpeace fire calendar

## Regions
- [greece.md](greece.md): fire regimes, stubble burning, GAEC 3, major fires, CORINE classes
- [argentina.md](argentina.md): CONAE, SNMF, Ley 26.815, Paraná Delta, Corrientes, Córdoba, Patagonia

## Our work
- [decisions.md](decisions.md): what we decided and why, plus open design choices
- [data-contract.md](data-contract.md): JSON files and fields the pipeline writes for the web app
- [agent-access.md](agent-access.md): MCP server on Vercel, clients, MCP Apps, llms.txt, deep links, proposed tools
- [findings-greece.md](findings-greece.md): our numbers for Greece: LOYO, time split, ratio trend, NUTS2 modes
- [findings-argentina.md](findings-argentina.md): our numbers for Argentina: LOYO, time split, provinces, Paraná 2020
- [open-questions.md](open-questions.md): what still needs checking

## Sources
- [sources/2026-11-11-research-modis-viirs.md](sources/2026-11-11-research-modis-viirs.md): first research, FIRMS, sensors, methods, Greece
- [sources/2026-11-11-challenge-video.md](sources/2026-11-11-challenge-video.md): challenge text and author video summary
- [sources/2026-11-13-research-conae-argentina.md](sources/2026-11-13-research-conae-argentina.md): CONAE, INPE, Argentina, boundaries
- [sources/2026-11-13-research-harmonization-validation.md](sources/2026-11-13-research-harmonization-validation.md): deep research, count harmonization methods, validation, orbit drift, seasonality, claim checks
- [sources/2026-11-13-research-agent-access.md](sources/2026-11-13-research-agent-access.md): MCP spec, mcp-handler on Vercel, clients, MCP Apps, geo MCP precedents, security
- [sources/2026-11-13-research-how-to-win.md](sources/2026-11-13-research-how-to-win.md): 2026 judging and submission guides, past winners, pitch and execution advice
- [sources/2026-11-13-research-anomalies-rules.md](sources/2026-11-13-research-anomalies-rules.md): NOAA-20, anomalies, harmonization options, Space Apps rules
- [sources/2026-11-14-challenge-page.md](sources/2026-11-14-challenge-page.md): full challenge page text (Details tab)
- [sources/2026-11-14-thessaloniki-organiser-info.md](sources/2026-11-14-thessaloniki-organiser-info.md): organiser emails, local FAQ, Presentation Guide (7 min pitch, 15:00 local deadline)
- [sources/2026-11-14-research-live-sources.md](sources/2026-11-14-research-live-sources.md): live upstreams for MCP: GDACS, Copernicus EMS, ReliefWeb, NOAA NCEI, Meteostat, SMN, Open-Meteo, EFFIS FWI, FIRMS NRT; auth, licence, decision
- [sources/2026-11-14-research-greek-data-prior-art.md](sources/2026-11-14-research-greek-data-prior-art.md): existing apps, Boschetti project, VIIRS BA ATBD, Greek cameras and official fire data, EFFIS vs Fire Service counts
- [sources/2026-11-14-research-map-layout.md](sources/2026-11-14-research-map-layout.md): map + detail layout for desktop, projector and phone, design systems, NN/g, how FIRMS, EFFIS, GWIS, GFW, Worldview and Queimadas lay it out
- [sources/2026-11-14-audit-external.md](sources/2026-11-14-audit-external.md): external read-only audit of b09212a (Czech): score 6.8/10, MCP red team of all 16 tools, bugs BC-001 to BC-005, scientific review, roadmap
- [sources/2026-11-14-review-hackathon-plan.md](sources/2026-11-14-review-hackathon-plan.md): outside AI review (Czech): "AI Fire Investigator" direction, P0-P3 backlog, 60 s demo on Thessalia vs Kentriki Makedonia, what not to claim; checked against repo
