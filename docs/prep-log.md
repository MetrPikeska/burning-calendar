# Pre-event preparation log

The NASA Space Apps 2026 hackathon started on Sat 14 Nov 2026 at 09:00 (Thessaloniki). Before that, team Spearow (Petr, Vita) chose a challenge and read up on it. This file records what we prepared before the event, and with which tools, so the submission can disclose it in "Use of Super Intelligence (SI)" and "References".

SI tool used in all sessions: Claude Code (Anthropic Claude). The SI did web research, summarised papers and documentation, and drafted the wiki pages. The team chose the challenge and made the design decisions.

## What this repo contains from before the event

- `docs/wiki/`: research notes on the challenge, sensors, FIRMS data, harmonization methods, regions, Space Apps rules, plus design decisions and the JSON data contract. Every fact page lists its sources.
- `docs/notes/`: the team's working notes in Czech.

## What it does not contain

Pre-event code, downloaded data, computed numbers and git history stayed out of this repo:
- the FIRMS download and ratio-check scripts,
- the QGIS GeoPackage,
- the wiki page with the Greek VIIRS/MODIS ratios,
- the abandoned SAR prototype.

All code and every number in this repo are written or computed during the event.

## Sessions

### 11 Nov 2026: challenge choice
- Started on "Dancing with the SARs". The SI searched the NISAR GCOV catalogue for Thessaloniki and built a throwaway pipeline on synthetic data. The real data needs an Earthdata login and is about 20 GB.
- The team switched to "Harmonization of MODIS and VIIRS Hot Spots". The SI checked that FIRMS country CSVs are public and small.
- The SI wrote a first research report (FIRMS, MODIS and VIIRS sensors, methods, Greece) and a team note on the challenge text. It also ran a quick VIIRS/MODIS count comparison for Greece; that code and its numbers are not in this repo.

### 13 Nov 2026: research and design
- Research on count harmonization and validation, CONAE and Argentina, anomaly definitions and the Space Apps rules. The SI put it all into `docs/wiki/`.
- A question-and-answer design session fixed several choices; all of them are recorded in `docs/wiki/decisions.md` and `docs/wiki/data-contract.md`:
  - VIIRS-equivalent reference scale,
  - region units (NUTS2, provinces),
  - the JSON data contract,
  - agent access through a read-only MCP endpoint.
- Research on agent access (MCP on Vercel), recorded in `docs/wiki/agent-access.md`.
- A check of the rule on pre-event work led the team to start this clean repo on 14 Nov.
- Research on judging criteria, submission rules and past winners: `docs/wiki/space-apps-rules.md`, `docs/wiki/past-winners.md`, and the team guide `docs/notes/2026-11-13-jak-vyhrat.md`.
