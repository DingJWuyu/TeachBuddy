---
name: product-behavior-design
description: "Refine a selected interactive prototype with the user and capture its agreed behavior in a complete product record."
disable-model-invocation: true
---

# Product Behavior Design

Work with the user on one supplied prototype until its **observable behavior** is settled: what the user sees, can do, and experiences as a result. Preserve that behavior in a runnable prototype and a written record a fresh reader can use without the conversation.

Keep changes within the prototype and its artifacts. Do not undertake system design, API design, contract design, or production implementation.

## Process

### 1. Open the prototype

Run the selected prototype and walk its existing journeys. Resolve an ambiguous selection or missing access before editing.

Create or continue one Markdown behavior record among its artifacts, using the format below. Establish the user goal and scope from the supplied material, and index what is needed to run and review it. Treat behavior without recorded user confirmation as provisional.

### 2. Refine a journey

Work from the user's feedback. Trace each requested change through the affected **journeys**: the paths from a user's goal to an outcome, including ways back. Look for contradictions, dead ends, ambiguous feedback, and loss of user work, including consequences the user has not mentioned.

For unresolved choices that would materially change the experience, use the `grilling` skill, scoped to the affected journeys. Ground the discussion in a concrete situation the prototype can demonstrate.

Apply settled changes and make the relevant outcomes reachable with mock scenarios. A **scenario** is a product situation with the data and conditions needed to experience it. Choose contrasting examples and boundaries that change what the user sees or can do; fixture shapes carry no implementation decisions.

Exercise the changed journeys in the target runtime, including effects on connected journeys. Update the record and its evidence in the same round. Bring the user back to the changed experience with a clear way to try it and the choices still open.

Repeat as feedback or exploration exposes more work. A round is complete when the demonstrated behavior and the record agree.

### 3. Walk the whole scope

Follow every journey from its entry point in the target runtime. Probe empty, busy, partial, failed, interrupted, and conflicting situations wherever the scoped behavior permits them, including destructive or repeated actions and leaving or returning with unfinished work.

The walkthrough is complete when:

- Every control and observable system event belongs to a recorded journey.
- Every state has been exercised through its recorded scenario or action, with its exits and recovery accounted for.
- Every displayed or entered value has a defined meaning, and visible rules hold across the supported viewport and input modes.
- Every in-scope outcome is defined; any deferred behavior is explicitly excluded by agreement.

Feed gaps back into the refinement loop. An unexercised case remains a named gap in the record.

### 4. Accept and preserve

After the walkthrough, present the prototype and record for acceptance, highlighting provisional choices. Identify the version being reviewed. Mark the record `Accepted` and its provisional choices `Confirmed` only when the user explicitly accepts that version and its behavior; until then it remains `In review`.

Preserve the accepted source, required assets, scenarios, visual evidence, and record as a reproducible set. Report its entry point and any agreed exclusions. If accepted behavior is reopened, return the working record to `In review` and retain a reference to the accepted version.

## Behavior record

Give journeys and states stable IDs so scenarios, evidence, and decisions can refer to exact behavior. Use this format:

```markdown
# <Product area> behavior

Status: In review | Accepted

## Scope

User goal, actors, entry points, supported environments, and non-goals.

## Artifacts

Pointers to the prototype source, run instructions, required assets, scenarios,
and visual evidence. Identify the working version and, on acceptance, the
accepted version and confirmation.

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
When a decision changes, retain what it superseded and why. Link existing
decision records rather than copying them.
```
