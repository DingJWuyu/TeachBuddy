# Claude Code

## Launching a worker

- A worker started from inside a Claude Code session inherits its child-session marker, which turns transcript saving off; set `CLAUDE_CODE_FORCE_SESSION_PERSISTENCE=1` to keep the transcript.

## Reading a run back

A worker's run records are its session transcripts, one JSONL file per session, under `~/.claude/projects/<dir>/`, where `<dir>` is the worktree's absolute path with every character other than a letter or digit replaced by `-`.

## Waiting on workers

As the orchestrator, run the wait as a background command: you are invoked again when it exits. Start one only when none is running, since the user can start a run while a wait is still out.
