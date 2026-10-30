# Codex

## Launching a worker

- The worker needs the `danger-full-access` sandbox: a worktree's git metadata lives in the main checkout, outside the sandbox's workspace, and `gh` needs the network.

## Reading a run back

A worker's run records are its session rollouts, one JSONL file per session, under `~/.codex/sessions/<year>/<month>/<day>/`. The first line of each (`session_meta`) holds the worktree's path as `payload.cwd`.

## Waiting on workers

As the orchestrator, run the wait as a foreground command with a timeout longer than a worker's run. A timeout is a wake like any other.
