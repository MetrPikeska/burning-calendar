# Wiki schema

Project knowledge base for the NASA Space Apps 2026 challenge "Harmonization of MODIS and VIIRS Hot Spots". LLM agents maintain it, and the team reads it. This file holds the rules for working inside `docs/wiki/`. Every other page states facts; none of them gives instructions.

## Layout

| Path | Content |
|---|---|
| `index.md` | Catalog, one line per page, at most 50 lines. Read it first. |
| `log.md` | Append-only record of ingests, edits and lint runs. |
| `sources/` | Immutable inputs: research reports, transcripts, pasted texts. Never edit them; add a new dated file instead. |
| `*.md` | Topic pages compiled from `sources/`, from our own analysis (`scripts/`) and from decisions. |

Out of scope: tasks (`TODO.md`), raw data (`data/`), the team's Czech meeting notes (`docs/notes/`).

## Page format

```markdown
---
title: Short name
updated: 2026-11-13
verified_by: command or URL that confirms the facts
sources: [sources/<file>.md, https://...]
---

Facts, newest state first. Absolute dates (13 Nov 2026).
```

- Keep the `UNVERIFIED` and `UNVERIFIED-SNIPPET` markers from sources until someone checks the claim against the primary source. Then remove the marker and cite the URL.
- When sources disagree, list both values with their sources and do not pick one silently.
- Our own numbers cite the script that produced them.
- No em dashes. Write plain, specific prose: numbers, paths, names.

## Operations

- **Ingest:** save the new material in `sources/YYYY-MM-DD-<slug>.md`, update the affected pages, add a line to `log.md`, and update `index.md` when a page is added.
- **Query:** answer from the pages, cite the page, and fall back to `sources/` for detail.
- **Lint:** check frontmatter on every page, check that links resolve, look for stale `updated` dates and contradictions between pages, then log the run.
