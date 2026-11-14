NASA Space Apps 2026 (Thessaloniki, 14-15 Nov): harmonized MODIS + VIIRS burning activity calendar web app, Greece and Argentina.
@docs/wiki/index.md
When a fact changes or new material arrives, update the wiki page, follow docs/wiki/AGENTS.md, and add a line to docs/wiki/log.md.

## Parallel sessions: one worktree each

- `~/projects/burning-calendar` stays on `main` and clean. It is only for merging and pushing; nobody edits files there.
- Each session works in its own worktree and branch: `bd worktree create ../burning-calendar-wt/<area> --branch <area>` (areas: `pipeline-mcp` for pipeline/ and web/api/, `web` for web/src/ and index.html, `docs` for wiki, slides, README).
- Setup in a new worktree: `ln -s ~/projects/burning-calendar/data/raw data/raw && ln -s ~/projects/burning-calendar/data/interim data/interim`, then `uv sync` and `cd web && npm ci`. Raw data stay read-only.
- To land work: in the worktree `git rebase main`, then in the main checkout `git merge --ff-only <area>`. Push only when Petr asks; every push to `main` deploys production.
- Shared append-only files (`docs/wiki/log.md`, `docs/si-use.md`, `TODO.md`): add lines at the end; in a conflict keep both sides.


<!-- BEGIN BEADS INTEGRATION v:1 profile:minimal hash:1105d646 -->
## Beads Issue Tracker

This project uses **bd (beads)** for issue tracking. Run `bd prime` to see full workflow context and commands.

### Quick Reference

```bash
bd ready              # Find available work
bd show <id>          # View issue details
bd update <id> --claim  # Claim work
bd close <id>         # Complete work
```

### Rules

- Use `bd` for ALL task tracking — do NOT use TodoWrite, TaskCreate, or markdown TODO lists
- Run `bd prime` for detailed command reference and session close protocol
- Use `bd remember` for persistent knowledge — do NOT use MEMORY.md files

**Architecture in one line:** issues live in a local Dolt DB; sync uses `refs/dolt/data` on your git remote; `.beads/issues.jsonl` is a passive export. See https://github.com/gastownhall/beads/blob/main/docs/core-concepts/sync-concepts.md for details and anti-patterns.

## Agent Context Profiles

The managed Beads block is task-tracking guidance, not permission to override repository, user, or orchestrator instructions.

- **Conservative (default)**: Use `bd` for task tracking. Do not run git commits, git pushes, or Dolt remote sync unless explicitly asked. At handoff, report changed files, validation, and suggested next commands.
- **Minimal**: Keep tool instruction files as pointers to `bd prime`; use the same conservative git policy unless active instructions say otherwise.
- **Team-maintainer**: Only when the repository explicitly opts in, agents may close beads, run quality gates, commit, and push as part of session close. A current "do not commit" or "do not push" instruction still wins.

## Session Completion

This protocol applies when ending a Beads implementation workflow. It is subordinate to explicit user, repository, and orchestrator instructions.

1. **File issues for remaining work** - Create beads for anything that needs follow-up
2. **Run quality gates** (if code changed) - Tests, linters, builds
3. **Update issue status** - Close finished work, update in-progress items
4. **Handle git/sync by active profile**:
   ```bash
   # Conservative/minimal/default: report status and proposed commands; wait for approval.
   git status

   # Team-maintainer opt-in only, unless current instructions forbid it:
   git pull --rebase
   git push
   git status
   ```
5. **Hand off** - Summarize changes, validation, issue status, and any blocked sync/commit/push step

**Critical rules:**
- Explicit user or orchestrator instructions override this Beads block.
- Do not commit or push without clear authority from the active profile or the current user request.
- If a required sync or push is blocked, stop and report the exact command and error.
<!-- END BEADS INTEGRATION -->
