# Orchestrator

Your flow is the `implement-spec` skill. Invoke it; when your harness can't, since it is user-invoked, read its `SKILL.md` from your installed skills directory and follow that. This file holds this repo's values for it.

## Workers

Each worker takes its row whose use fits the task, or its only row.

| Worker | Use | Harness | Model | Effort |
| --- | --- | --- | --- | --- |
| Executor | Routine tickets | Codex | gpt-6.1-sol | high |
| Executor | Materials and math: Word/PDF/OCR extraction, question splitting, formula and figure ownership, editable outputs, functions, geometry, dynamic works, offline demos | Codex | gpt-6.1-sol | xhigh |
| Executor | Architecture, shared contracts, hard tickets | Codex | gpt-6-astra | xhigh |
| Reviewer | Every PR | Codex | gpt-6.1-sol | max |
| Cross-reviewer | High-risk PRs | Claude Code | claude-opus-5-5 | xhigh |

## Terminal

Workers run in **ThinkTerm** panes. Its agent instructions: `thinkterm skill show`, then `thinkterm cli <command> --help`.

A pane closes when its program exits, taking its output with it, so run each worker in a shell pane:

- open: `thinkterm cli spawn --label <label> --cwd <worktree>`, then `thinkterm cli send-text --pane <label> "<command>"` and `thinkterm cli send-key --pane <label> enter`;
- wait: `bash -c 'for p in <labels>; do thinkterm cli wait --command --pane "$p" & done; wait -n'`;
- exited already: `thinkterm cli wait --command --pane <label> --timeout 3` exits 124 while the command still runs;
- read, then close: `thinkterm cli get-text --pane <label> --trim`, `thinkterm cli kill-pane --pane <label>`.

## Sensitive paths

- `apps/api/src/features/auth/`, `apps/web/src/features/auth/`, `apps/api/src/contracts/auth.openapi.yaml`
- `apps/api/src/workbench/account-deletion.js`, `apps/api/src/features/auth/account-deletion.js`
- every `migrations` file or folder under `apps/`
- `apps/api/src/workbench/reliability/`
- `.github/workflows/`

## Worktrees

Worker worktrees live under `../TeachBuddy-worktrees/`.

## Polling

The poller checks GitHub every **30 minutes**.
