# Behavior records

A package keeps one `behavior.md` for its session. The accepted version uses a manifest and documents split by product area or shared concern. Each behavior has one owner; other documents link to that owner.

Keep journey, state, and scenario IDs stable across edits and document moves. Read existing ownership before assigning new IDs. Reuse shared rules by reference rather than repeating them in each journey.

## Manifest

Keep the accepted manifest as an index:

- Run entry, prerequisites, and shared artifact locations.
- Each behavior document's link, scope, and owned IDs.

Detailed behavior and scenario coverage belong in the owning documents.

## Record format

Use the sections below where applicable. A package includes its baseline delta and decision trail. Accepted documents omit those session sections and contain only current confirmed behavior, rationale, and agreed limitations. Reference the manifest for shared run information.

```markdown
# <Scope> behavior

Status: In review | Accepted

## Scope

User goals, actors, entry points, supported viewport classes and input modes,
and agreed exclusions.

## Changes

Package only: recoverable baseline, requested changes, and added, changed, or
removed behavior with affected IDs. Distinguish accepted scope from work still
in review. Record the presented version, the user's acceptance, and whether
integration is pending, incomplete, or complete, with destination pointers.

## Artifacts

Runtime entry and prerequisites; source, scenario, and evidence locations.
Include commands and scenario selection/reset instructions needed to reproduce
the recorded behavior. Use links to actual artifacts, not a second copy.

## Journeys

For each journey: ID, goal, actor, and preconditions.
For each transition: starting state, action or system event, immediate feedback,
intermediate states, outcome, and resulting state. Include cancellation,
recovery, retry, and return paths. Reference state and scenario IDs.

## States and scenarios

For each state: ID, visible content, and available or disabled actions.
For each scenario: ID, starting conditions, representative data, reproducible
steps, expected states and transitions, and how to reset it.

Coverage table: one row per scenario and supported viewport class. Include
exact dimensions, links to its visual states and interaction-check results,
and the verification outcome. This table is the evidence index. Name gaps and
user-agreed exclusions explicitly instead of leaving ambiguous empty cells.

## Visible information

Meaning of displayed and entered values; source from the user's perspective;
validity, absence, and change rules. Define relationships, derived values,
ordering, formatting, locale, timezone, and privacy where observable.

## Experience rules

Shared layout, input, focus, accessibility, motion, timing, and persistence
behavior. Journey-specific exceptions reference the rule they qualify.

## Decisions

Confirmed choices, rationale, agreed limitations, and affected IDs. Preserve
existing confirmations; inherited behavior without confirmation is provisional.
Packages also distinguish provisional assumptions, open questions, and
superseded choices. Preserve the reasons for changes there, without mixing
past behavior into the description of the current working version.
```
