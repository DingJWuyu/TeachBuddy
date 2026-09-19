---
name: system-contract-design
description: "Derive an implementation-ready system contract from an accepted product behavior record."
disable-model-invocation: true
---

# System Contract Design

Turn an accepted product behavior record into the stable boundary that independent frontend and backend implementations can share. **Trace, then design**: every contract element must serve an observable behavior or an established system invariant.

This is a fresh design pass, not a continuation of visual prototyping. Preserve the accepted experience and choose the simplest robust boundary that fits the repository's architecture.

## Process

### 1. Establish the source

Read the supplied `product-behavior.md`, every artifact it marks authoritative, `CONTEXT.md`, applicable ADRs, `docs/ARCHITECTURE.md`, and existing contracts in the affected area. Use prototype fixtures as semantic examples rather than copying them into transport shapes.

The behavior record must identify one selected prototype and have status `Accepted`. If either condition is missing, report the exact product input gap and stop before designing around guesses.

Write the result beside the behavior record unless an existing project convention says otherwise:

```text
docs/product/<slice>/system-contract.md
```

### 2. Classify every observable obligation

Create a traceability table from each behavior or state ID to one of:

- frontend-only behavior;
- backend-owned behavior;
- shared boundary behavior;
- unresolved product behavior.

Frontend-only behavior needs no invented API. Backend-owned and shared behavior must identify the responsible capability and the information or action crossing the boundary. An unresolved product behavior remains a product gap rather than becoming a technical assumption.

The step is complete when every behavior ID is classified and every proposed contract element traces back to at least one behavior or system invariant.

### 3. Design the boundary

Model user intent and domain capability rather than pages, components, fixtures, or database tables. Reuse established seams and vocabulary. Keep ownership cohesive: one authority owns each invariant and other parts collaborate through explicit contracts.

Define only the boundary forms the feature needs, such as:

- queries and read models;
- commands and their outcomes;
- domain or integration events;
- module public ports;
- HTTP or other transport bindings;
- shared validation or schema artifacts.

For each operation, make the relevant semantics explicit:

- actor, authorization, and account isolation;
- input meaning, required context, and validation;
- successful result and observable timing;
- stable identifiers and lifecycle;
- errors the caller can act on;
- retry, idempotency, concurrency, and ordering behavior;
- timezone, locale, pagination, filtering, and sorting where they affect meaning;
- consistency, caching, and partial failure where the experience depends on them.

Omit irrelevant machinery instead of filling a generic checklist. Add a machine-readable schema only when it is the project's established source of truth or materially removes ambiguity; link it from the document rather than duplicating it.

### 4. Run the adversarial pass

Walk the proposed contract against every accepted journey and fixture. Test the boundary mentally against slow responses, repetition, interruption, stale data, concurrent actors, permission changes, partial failure, and future compatible evolution wherever those cases are plausible.

Classify each discovery:

- **Product gap**: the answer changes what the user observes. Return the question without choosing for the user.
- **Contract decision**: the answer is internal to the boundary. Decide it, record the rationale, and keep the experience unchanged.
- **Implementation detail**: either side can choose independently. Keep it outside the contract.

Continue designing unaffected portions when a gap is local. Mark the whole contract blocked only when independent implementation would otherwise require incompatible guesses.

### 5. Write the contract

Use this shape, pruning sections that have no bearing on the feature:

```markdown
# <Product slice> system contract

Status: Draft | Blocked by product decision | Ready for implementation
Source behavior: <path and accepted revision>

## Scope and boundary
Capabilities covered, ownership, consumers, dependencies, and non-goals.

## Behavior traceability
Behavior or state ID, classification, responsible capability, and contract
element. Frontend-only rows remain visible to prove they were considered.

## Domain semantics and invariants
Authoritative terms, identities, lifecycle, validation, authorization, account
isolation, and rules that must agree across the boundary.

## Operations
Queries, commands, events, or ports. For each: purpose, actor, input, output,
success semantics, actionable errors, and relevant concurrency or timing rules.

## Transport binding
Routes, methods, headers, status codes, serialization, and schemas when the
boundary uses a transport. Keep transport separate from domain meaning.

## Examples and mocks
Representative success and failure exchanges mapped to prototype fixtures.
Examples illustrate the contract and never add undocumented semantics.

## Verification
Contract-level acceptance cases both implementations can run independently,
including compatibility and failure cases that materially matter.

## Decisions, assumptions, and open product gaps
Record technical decisions with rationale. Keep assumptions explicit and list
product questions that require user-visible decisions.
```

### 6. Set the readiness state

Mark the document `Ready for implementation` only when:

- every backend-dependent accepted behavior has a traceable contract path;
- every operation has one owner and complete success and actionable-failure semantics;
- every shared field has one meaning;
- authorization and account isolation are explicit;
- relevant retry, concurrency, ordering, time, and consistency behavior is settled;
- frontend and backend can build compatible implementations without a private side conversation;
- no open product gap can cause those implementations to diverge.

Report the contract path, readiness state, covered behavior IDs, decisions made, and remaining product gaps. Preserve the design artifacts and stop before frontend or backend implementation; the user controls the next invocation.
