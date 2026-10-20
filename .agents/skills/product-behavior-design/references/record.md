# Behavior records

A package keeps one `behavior.md` for its session. The integrated reference uses the existing design-system entry and documents split by reference area or shared concern. Each behavior has one owner; other documents link to that owner.

Keep journey, state, and scenario IDs stable across edits and document moves. Read existing ownership before assigning new IDs. Reuse shared rules by reference rather than repeating them in each journey.

## Design entry

Use the existing README as the design entry. Maintain pointers where the accepted change requires them:

- Run entry, prerequisites, and shared artifact locations.
- The owning design sources and their scope. Preserve existing IDs where provided; package records hold the user's acceptance of the selected revision.
- The project's authoritative product docs, and the boundary between prototype intent and current product requirements.

Detailed behavior belongs in the owning documents; execution coverage belongs in task evidence. Do not create a manifest or scenario taxonomy solely to match this format.

## Record format

Use the sections below where applicable. A package includes its baseline delta and decision trail. Integrated documents omit those session sections and describe current reference behavior, rationale, and limitations using the existing document conventions. Reference the design entry for shared run information.

```markdown
# <Scope> behavior

Status: In review | Accepted | Mixed | Draft

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

Package coverage: one row per scenario and supported viewport class, with exact
dimensions, visual states, interaction results, and verification outcomes. Name
gaps and agreed exclusions explicitly. Integrated references retain scenario
meaning and reproducible check entries; task results stay with the task. Index
only selected enduring visual inputs, giving their purpose and accepted scope.
Use fixed Git links for necessary historical provenance instead of maintaining
large per-image pass tables or repair logs.

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
