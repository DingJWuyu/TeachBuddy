---
name: product-behavior-design
description: "Refine a selected interactive prototype with the user and capture its agreed behavior in a complete product record."
disable-model-invocation: true
---

# Product Behavior Design

Refine a prototype's **observable behavior** with the user: what the user sees, can do, and experiences as a result. Keep a complete integrated prototype and a traceable record of each session's changes, usable without the conversation.

Do not undertake system design, API design, contract design, or production implementation.

## Process

### 1. Pick up the request

Read `prototype/behavior/manifest.md` when present to recover the current scope, then follow its pointers for the requested work. When resuming or accepting a package, read its `behavior.md` as well. On first use, locate the supplied prototype and any accompanying record; ask for the selection if it is missing or ambiguous.

**Without a change request or acceptance of a presented package, stop here.** Briefly identify the current prototype, ask what the user wants to change, and wait. This is a read-only entry: artifact creation and runtime walkthroughs begin only when there is work to do. Proceed with feedback below; for acceptance, go to step 5.

### 2. Open a session package

Use this layout at the project root:

```text
prototype/
  behavior/
    manifest.md            Document index and run entry
    <area>.md              Behavior owned by a product area or shared concern
  ...                      Runnable source, scenarios, assets, and evidence
.scratch/
  <package>/
    behavior.md            Baseline, session changes, and resulting behavior
    ...                    Working source and all artifacts from this session
```

`prototype/` is a self-contained description of the current accepted state: no history or historical pointers. A **package** holds local session work, including its baseline, feedback rounds, decisions, and evidence. Packages under `.scratch/` may be absent from a checkout; repository artifacts must neither reference nor depend on their contents. Choose an unused package name freely. A resumed package keeps its baseline and progress.

Start a new package from the latest `prototype/`, or from the supplied prototype if no integrated version exists. Before editing, identify the exact baseline through an immutable reference or a retained snapshot.

Keep all session artifacts inside the package. Reuse project tooling and dependencies through its run instructions; application source, shared rules, and unrelated documentation are outside this skill's write scope.

Create or continue the package's single `behavior.md` using the format below, with session status `In review`. Gather the affected behavior from the baseline documents; reference the recoverable baseline for unchanged context. Preserve existing confirmations; inherited behavior without confirmation remains provisional. The package is ready when its prototype runs and its baseline and requested change are recorded.

### 3. Refine the affected journeys

Work from the user's feedback. Trace each requested change through the affected **journeys**: the paths from a user's goal to an outcome, including ways back. Look for contradictions, dead ends, ambiguous feedback, and loss of user work, including consequences the user has not mentioned.

For unresolved choices that would materially change the experience, use the `grilling` skill, scoped to the affected journeys. Ground the discussion in a concrete situation the prototype can demonstrate.

Apply settled changes and make the relevant outcomes reachable with mock scenarios. A **scenario** is a product situation with the data and conditions needed to experience it. Choose contrasting examples and boundaries that change what the user sees or can do; fixture shapes carry no implementation decisions.

Exercise the changed journeys in the package's runtime, including effects on connected journeys. Update its record, change summary, and evidence in the same round. Bring the user back to the changed experience with a clear way to try it and the choices still open.

A round is complete when the demonstrated behavior and the record agree.

### 4. Verify the increment

Verify changed and connected behavior against the baseline. Reuse evidence for unaffected behavior; exercise cases whose evidence is absent or invalidated by the changes. Probe empty, busy, partial, failed, interrupted, and conflicting situations wherever the scoped behavior permits them, including destructive or repeated actions and leaving or returning with unfinished work.

The increment is ready for acceptance when:

- Every control and observable system event in scope belongs to a recorded journey.
- Every state has a reproducible scenario or action, with its exits, recovery, and verification evidence accounted for.
- Every displayed or entered value has a defined meaning, and visible rules hold across the supported viewport and input modes.
- Every in-scope outcome is defined; any deferred behavior is explicitly excluded by agreement.
- The record identifies every added, changed, or removed behavior relative to the baseline.

Feed gaps back into the refinement loop. An unexercised case remains a named gap in the record.

### 5. Accept and integrate

Present the package's prototype and behavior changes for acceptance, highlighting provisional choices and agreed exclusions. Explicit acceptance of that presented scope authorizes integration immediately; ordinary language such as “accepted” suffices. Record the accepted version and scope, mark it `Accepted`, and mark its reviewed choices `Confirmed`. Acceptance and completed integration are separate facts; work outside the accepted scope stays `In review` in the package.

Compare the accepted increment with both its baseline and the current `prototype/`. Preserve intervening accepted changes; ask the user only about conflicts that require a new product decision. Before replacing anything, ensure the displaced state is recoverable from an immutable reference or a snapshot in the package. The first integration establishes a complete runnable `prototype/` from the accepted baseline and increment.

Integrate by artifact:

- **Source, scenarios, and assets:** apply the accepted changes to the canonical files. Remove superseded copies and files made obsolete by the change, and update their consumers.
- **Behavior:** read the manifest first and update the document whose scope owns the change. Add a document only when no existing scope fits; split independently understandable scopes when needed. Use `writing-for-agents` when composing the integrated record. Describe the resulting behavior and its rationale directly; before/after comparisons, superseded decisions, and review chronology belong in the package. Update the manifest when ownership changes.
- **Evidence:** retain or regenerate evidence that represents the integrated state. Replace invalidated screenshots and verification results for the affected scenarios; keep still-valid evidence for unaffected scenarios. Keep working copies and run logs in the package, and repair references to replaced or removed artifacts.

Verify the affected journeys from the integrated run entry. Integration is complete when the runtime, behavior documents, and evidence agree; every changed behavior has an owner; all manifest and artifact pointers resolve without `.scratch/`; and the integrated prototype can be understood, run, and verified without any package. If verification fails, retain the package and record integration as incomplete until resolved.

Record the integration result, verification, and destination pointers in the package. Report the integrated and package entry points, what was integrated, and any agreed exclusions. Subsequent work starts from the updated integrated version.

## Integrated manifest

Keep `prototype/behavior/manifest.md` as an index of the current prototype: run entry, shared artifact locations, and each behavior document's link, scope, and owned journey/state IDs. Detailed behavior belongs in the linked documents.

## Behavior documents

Integrated documents collectively cover the prototype; a package keeps one record for its session's scope. Keep journey and state IDs stable across versions and document moves. Use the sections below where they apply. In integrated documents, omit Changes, reference the manifest for shared run and artifact information, and link other documents for behavior they own.

```markdown
# <Product area> behavior

Status: In review | Accepted

## Scope

User goal, actors, entry points, supported environments, and non-goals.

## Changes

Identify the recoverable baseline, the user's requested change, and added,
changed, or removed behavior with affected journey and state IDs.
Describe before and after; reference the decisions and evidence below. Record
which changes were accepted and integrated, with a pointer to the result.

## Artifacts

Pointers to the prototype source, run instructions, required assets, scenarios,
and visual evidence within this package or integrated prototype. Packages also
identify the working version and record the accepted version and confirmation.

## Journeys

For each journey: ID, user goal, actor, and visible preconditions.
For each step: starting state, action or system event, immediate feedback,
intermediate states, settled outcome, and resulting state. Include available
cancellation, failure, recovery, and retry paths. Reference state IDs.

## States and scenarios

For each distinct observable state: ID, what is visible, available and disabled
actions, and the scenario or steps that reproduce it. Link visual evidence
where appearance matters. Scenarios include their starting conditions,
representative data, and how to select and reset them.

## Visible information

What each displayed or entered value means, its source from the user's
perspective, examples, and rules for validity, absence, and change. Define
visible relationships, derived values, ordering, formatting, locale, timezone,
and privacy expectations where they affect interpretation.

## Experience rules

Shared behavior across journeys: responsive layout, input methods, focus,
accessibility, motion, timing, and what survives navigation or a new session.
Journey-specific exceptions reference the shared rule they qualify.

## Decisions and questions

Confirmed: choices the user accepted, with their rationale and affected IDs.
Provisional: inherited behavior or working assumptions awaiting review.
Open: unanswered product questions and the journeys they affect.
Packages retain superseded choices and reasons for changing them. Integrated
documents keep only current accepted decisions, rationale, and agreed limits;
provisional choices and open questions remain in the package. In packages,
link existing decision records rather than copying them.
```
