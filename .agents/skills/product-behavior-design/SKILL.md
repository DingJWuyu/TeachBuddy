---
name: product-behavior-design
description: "Refine a selected interactive prototype with the user and capture its agreed behavior in a complete product record."
disable-model-invocation: true
---

# Product Behavior Design

Refine a selected prototype's **observable behavior** with the user: what the user sees, can do, and experiences as a result. Keep a runnable accepted version and a record of each session's work, understandable without the conversation.

Do not undertake system design, API design, contract design, or production implementation.

## Write boundary

A **package** is one session's working copy and decision record under `.scratch/`. Feedback rounds continue in the same package. The integrated design reference is `docs/design-system/`; its README links the runnable `teachbuddy-app/` and design rules. Read the project's document entry and the selected design sources. Acceptance applies only to the scope explicitly confirmed by the user; do not infer it from a file's existence. Production behavior and contracts follow the project's authoritative docs, not inferred prototype data or historical passes.

**Before explicit user acceptance, the package is the only writable repository location.** Keep all of `docs/design-system/` read-only, including its source, design documents, and assets. This boundary includes writes made by development servers, builds, verification scripts, and capture tools.

Acceptance authorizes integration of the presented scope into `docs/design-system/`, not changes elsewhere in the repository.

## Artifacts

Use this output layout at the project root. Create directories as needed; preserve the prototype's native source structure inside its runtime location.

```text
docs/design-system/
  README.md                 Design entry and shared principles
  teachbuddy-app/            Integrated runnable reference
  components/               Component design references
  assets/                   Design assets
  ...                       Existing design rules and references
.scratch/
  <package>/
    behavior.md             Baseline, changes, decisions, and coverage
    app/                    Independently editable, runnable source copy
    reference/              External examples, captures, and measurements
    evidence/               This package's screenshots and check results
    verification/           Session checks and capture scripts
    tmp/                    Probes and intermediate output
```

Use the existing design entry and owning documents; do not introduce a parallel manifest or duplicate rules just to fit this skill. Preserve useful confirmed intent and any existing scenario IDs, and record the selected scope and acceptance in the package. Fixed Git links may provide necessary historical provenance without making old outputs runtime inputs. Keep durable selected visual inputs with a stated purpose and execution results in the package or task evidence. The reference must remain runnable without any package; repository artifacts outside `.scratch/` must neither reference nor depend on package contents.

The package's decision record preserves the process; its evidence presents the current working version. Use `writing-for-agents` when writing behavior records. Read [references/record.md](references/record.md) when creating or updating a record.

## Process

### 1. Pick up the request

Read the project document entry, design-system README, and design sources relevant to the request. Establish the selected scope and its acceptance status from the user's instruction or recorded acceptance before treating it as settled input. When resuming a package, read its record as well. If there is no accepted version, locate the supplied prototype; ask for a selection when it is missing or ambiguous.

Without a change request or acceptance, identify the current prototype, ask what the user wants to change, and wait. Do not create artifacts or start a runtime walkthrough on this entry path. For explicit acceptance of a presented package, go to step 6.

### 2. Prepare the working copy

Start each feedback round by recording the repository's existing change state, including enough detail to distinguish new edits to already-modified files. Resolve runtime and output paths against the package before running tools; keep generated files within the write boundary.

For new work, choose an unused package name and start from the current integrated reference for the selected scope, or the supplied prototype on first use. Record inherited Draft behavior as provisional. Copy only the runtime entry, required code, assets, scenarios, and configuration into `app/`. Read existing behavior documents and evidence in place; do not duplicate the whole accepted directory. Reuse installed tooling and dependencies read-only. Editable source must be an independent copy, not a link that writes through to the original.

Record a recoverable baseline before editing. Prefer an immutable source reference; if it does not capture the starting code, retain the missing source snapshot or patch under the package's `baseline/`. A resumed package keeps its baseline and progress.

Create or update the package record. The package is ready when its own runtime starts, its baseline is recoverable, and its record identifies the requested change and supported environments. Keep its status `In review`.

### 3. Expand the scenario coverage

A **journey** takes a user from a goal to an outcome. A **scenario** supplies the starting state, data, and events needed to experience a particular branch. Build a scenario map for changed journeys and their connections before implementing them; update it as feedback exposes new branches.

Expand breadth-first from each entry state: enumerate available actions and observable system events, their immediate feedback, intermediate states, and outcomes, then expand newly reached states. Include success, rejection, empty or partial data, waiting, failure, interruption, and conflicting or repeated actions where applicable. Follow failure through recovery and retry, and unfinished work through cancellation, departure, and return. Reuse a state already represented rather than unfolding loops indefinitely.

Derive branches from the user's goal and product conditions, not only from what the existing code implements. A missing implementation is a coverage gap, not an exclusion. Mock external outcomes so their experience can be designed without implementing the underlying service.

When a branch exposes an unspecified or conflicting product choice, invoke `grilling` for that choice before implementing the branch. Resolve already-defined behavior from its owning record. An exclusion requires the user's agreement; record unresolved branches instead of silently choosing or dropping them.

Continue until every reachable state has its actions and events accounted for. Each resulting branch is defined, awaiting a named decision, or explicitly excluded. A choice that blocks further expansion remains a named gap; defined branches can proceed while independent decisions remain open.

### 4. Implement and demonstrate

Apply settled changes to the working copy. Make each defined scenario reproducible and resettable. Exercise the affected journeys through the runtime, including their connections to unchanged behavior.

Use the record's coverage table as the evidence index. Capture every distinct visual state of each scenario on every supported viewport class, not just successful outcomes. Record exact viewport dimensions; prefix filenames with the viewport class and scenario ID, adding a state suffix when a scenario has several visible steps. Group by journey. Keep external reference captures in `reference/`, separate from evidence of the working copy.

Before each capture, establish its starting conditions and assert the expected state after the action. Inspect the resulting image. Verify transitions, focus, timing, and recovery through interaction; a still image does not prove them. Record any case that could not be exercised as a gap, not a pass.

Keep the package evidence current: replace affected scenario outputs within the package and preserve failed runs until resolved. Generated passes do not update integrated design inputs automatically. On acceptance, select only the images needed for an enduring design purpose; leave full screenshot runs and results in task evidence.

This step is complete when implemented behavior, its record, and its evidence agree, with remaining work explicitly identified.

### 5. Close the feedback round

Before reporting a round complete, check:

- **Write boundary:** compare against the round's starting state, including tracked, untracked, and ignored outputs and further edits to already-modified files. Account for every write caused by this round. Correct your own out-of-bound writes without disturbing unrelated work; if ownership is unclear, stop and ask.
- **Coverage:** every implemented branch has a reproducible scenario, checked behavior, and current evidence across supported environments. Missing decisions, unimplemented branches, and failed or unexercised checks remain named gaps.
- **Record:** changes from the baseline, product decisions, scenario coverage, run instructions, and artifact links describe the working version.

Give the user the package run entry, the screenshot entry, a concise change summary, and any decisions or gaps still open. Repeat from step 2 for further feedback. A round can hand back a partial result; present a scope for acceptance only when it has no unresolved gaps other than exclusions the user agreed to.

### 6. Integrate accepted work

Explicit acceptance of the presented scope, such as “验收通过”, starts integration without a second permission request. Read [references/integration.md](references/integration.md) and follow it for that accepted scope. Ordinary feedback or approval of an individual choice does not accept the package.
