---
name: product-behavior-design
description: "Refine one selected UI prototype and preserve its complete user-observable behavior as the product record."
---

# Product Behavior Design

Work on one selected prototype with the user until its experience is accepted. The **observable surface** is your boundary: what the user can see, do, perceive, and recover from. Leave system and API design to a later contract-design session.

Read `docs/rules/design-and-verification.md` before changing UI. Use the vocabulary in `CONTEXT.md` and respect applicable ADRs.

## Process

### 1. Fix the subject

Identify the exact prototype or product area the user selected. Continue that direction instead of reopening the earlier variant search. If more than one candidate remains plausible, ask one concise question and wait.

Find the existing artifact home. If the project has no convention for this product slice, use:

```text
docs/product/<slice>/product-behavior.md
```

Record pointers to the prototype source, its run command, fixtures, visual references, and relevant decisions. The step is complete when one selected prototype and one behavior record have unambiguous locations.

### 2. Iterate on the observable surface

Keep the prototype runnable while the user reviews it. Apply each round of feedback to the same selected direction, inspect the result in a real browser, and update the behavior record during the session rather than reconstructing it at the end.

Keep changes inside the selected prototype and its evidence package. Production frontend and backend implementation begin only after the later contract stage.

For every visible control and system response, capture:

- the visible precondition;
- the user action, including pointer, keyboard, and touch behavior where relevant;
- immediate feedback and any intermediate state;
- the settled success state;
- cancellation, failure, recovery, and retry behavior when the user can encounter them;
- responsive, focus, motion, timing, and persistence effects when they change what the user perceives.

Use mock data to make meaningful states reachable. Treat fixtures as **product evidence**: record the meaning the UI needs, not a presumed wire format, endpoint, table, or storage model. Cover contrasting records and boundary cases that materially change the experience.

When a new state would change the product experience, bring it into the prototype discussion. Leave backend mechanisms and transport design unchosen; record the visible effect, data meaning, or unresolved product behavior instead.

### 3. Maintain the product behavior record

Keep `product-behavior.md` aligned with the current prototype using this shape:

```markdown
# <Product slice> behavior

Status: In review | Accepted

## Scope
The user goal, actor, entry point, and explicit non-goals.

## Artifact index
Paths and run instructions for the selected prototype, fixtures, screenshots,
and references. State which artifact is authoritative when two overlap.

## Observable states
Stable IDs for every distinct state the user can perceive, with entry and exit
conditions and the fixture or action that makes each state reachable.

## Behavior journeys
For each journey: visible precondition, user action, immediate response,
settled result, and failure or recovery path. Reference observable-state IDs.

## Visible data semantics
What each displayed value means to the user, representative examples, and
formatting, ordering, timezone, locale, or privacy expectations that are visible.

## Experience rules
Confirmed responsive, input, focus, motion, timing, persistence, and
accessibility behavior.

## Decisions and unknowns
Separate Confirmed, Inferred, and Open items. Product-affecting inference stays
visible until the user confirms it.
```

Prefer tables when they make state or transition coverage easier to audit. Keep each meaning authoritative in one place and link to it elsewhere.

### 4. Sweep the gaps

Before asking the user to accept the result, exercise the prototype end to end and account for:

- every interactive control;
- every state transition and way back;
- empty, populated, loading, partial, unavailable, and failure states that are relevant to this experience;
- destructive, repeated, interrupted, and conflicting actions the user could observe;
- supported viewport and input modes;
- every fixture and every screenshot retained as evidence.

Add only relevant cases. Record an explicit unknown when the product has not settled an observable outcome. The sweep is complete when every implemented control maps to a documented journey and every documented state is reachable or clearly marked as a future state.

### 5. Close the session

Mark the behavior record `Accepted` only after the user explicitly accepts the selected prototype and its observable behavior. Preserve the prototype source, required assets, meaningful fixtures, accepted screenshots, and the final behavior record; remove superseded temporary artifacts.

Report the artifact paths, confirmed coverage, and remaining open questions. State that the package is ready for a separately invoked `$system-contract-design` session when it meets that bar. Stop there: the user controls whether and when contract design begins.
