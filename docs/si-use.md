# Use of Super Intelligence (SI)

Log for the "Use of Super Intelligence" field on the project page and for acknowledgements in the README. Space Apps rules: SI must not be used to come up with the idea of how to solve the challenge; SI-generated code and data must be acknowledged.

The idea and the method (VIIRS-equivalent reference scale, back-cast factors by region x month x day/night, LOYO validation, static-source filter) were decided by the team; see docs/wiki/decisions.md.

| Date, time | Tool | What it did | Output |
|---|---|---|---|
| 11-13 Nov | Claude (Anthropic) | Literature and documentation research before the event (FIRMS, sensors, harmonization precedents, rules) | docs/wiki/sources/ |
| 14 Nov 10:30 | Claude Code (Claude Opus 5.5) | Read organiser emails and the Thessaloniki FAQ / Presentation Guide, summarised them into the wiki | docs/wiki/sources/2026-11-14-thessaloniki-organiser-info.md |
| 14 Nov 10:45 | Claude Code (Claude Opus 5.5) | Wrote the project scaffold and the FIRMS download script | pyproject.toml, pipeline/download_firms.py, TODO.md |
| 14 Nov 10:40 | Claude Code (Claude Opus 5.5) | Wrote the Greece vertical-slice pipeline (loader, static filter, v0 factors, calendar metrics, anomalies, JSON export) and unit tests, following the team's method in docs/wiki/decisions.md | pipeline/load.py, filters.py, harmonize.py, calendar_metrics.py, export.py, build.py, tests/ |
