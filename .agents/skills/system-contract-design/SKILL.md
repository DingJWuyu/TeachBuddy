---
name: system-contract-design
description: "Turn the accepted outputs of product-behavior-design into an agreed frontend/backend contract with the user."
disable-model-invocation: true
---

# System Contract Design

Work with the user to agree the **shared interface** that lets frontend and backend independently implement the behavior recorded in `product-behavior-design`'s accepted outputs. Leave each side's internal implementation to its implementer. Do not implement either side.

## Establish the starting point

Read [product-behavior-design's artifact layout](../product-behavior-design/SKILL.md#artifacts) and [behavior record definition](../product-behavior-design/references/record.md) as the input contract. Read the project document entry for the authoritative product scope, existing contracts, and acceptance definitions. Then read the design-system entry and selected owning sources, following their links to the runnable reference and relevant visual inputs. Establish acceptance from the user's instruction or package record; no manifest is required. Prototype simulations and historical passes do not define current product capabilities. Reuse journey, state, and scenario IDs where the inputs provide them.

Consume only the selected explicitly accepted scope of the current integrated reference. Keep these inputs read-only. If that scope is ambiguous, still in review, or awaiting integration, identify the input gap with the user before designing the dependent interface. Other accepted scopes can proceed independently.

When resuming, compare the current behavior with the source revision recorded in the contract. Reopen agreements affected by a behavior change before treating them as ready.

Explore the existing interfaces, relevant code, domain language, and recorded decisions. Bring confirmed design intent and established product decisions into the discussion with their owners and applicable scope. Existing product specs/contracts remain authoritative for current production behavior; surface a conflict as a named input gap rather than silently overriding either source.

## Design together

Use these skills throughout the discussion:

- **`grilling`** to work through the decisions about what frontend and backend must agree on.
- **`domain-modeling`** to sharpen shared meanings and record domain terms and significant decisions as they settle.
- **`codebase-design`** for the interface vocabulary and principles used to shape the agreement.

Focus the design tree on the shared interface needed to deliver the accepted journeys. New shared-interface decisions belong in that discussion with the user. Keep choices either implementation can make independently outside the contract.

Walk proposed agreements through the journeys from both sides, including the accepted failure and recovery paths. Use concrete exchanges to expose incompatible interpretations. Feed discoveries back into the design tree; an agreed happy path does not settle the rest of a journey.

If an answer requires deciding previously unspecified product behavior, return the affected IDs to the user as an input gap for `product-behavior-design`. Keep dependent contract choices open until the resolution is part of its integrated accepted output. Continue with independent choices.

## Deliver the contract

Use `writing-for-agents` to maintain the following artifacts as agreements form. Give the contract one durable entry using the project's document conventions. Definitions and cases can live in that document or in linked files suited to the project's tooling; each has one authoritative home.

**Contract entry**

- Identify the scope, agreement status, and exact source revision and accepted scope. Link the authoritative product docs, design entry, owning reference records, and relevant visual inputs or task evidence through their existing entries.
- Map the in-scope upstream scenario IDs and referenced states to shared interface definitions and contract cases, or to the side that owns the behavior entirely.
- Link the shared definitions, cases, glossary, and relevant decisions. Distinguish confirmed agreements from proposals, and name open decisions with the IDs and interface elements they block.

**Shared interface definitions**

Define the concrete operations and data shapes, responsibility for each result, and the rules both sides need to use the interface correctly. Include the communication protocol when a transport is involved. Follow `codebase-design` for what belongs to the interface and `domain-modeling` for shared meanings.

Use the project's authoritative contract format where one exists. Keep schemas, types, and protocol definitions precise enough for either side to implement without inventing fields or outcomes. Derive these from the agreed interface; upstream prototype data illustrates behavior and does not prescribe the exchange format.

**Contract cases**

Turn the mapped upstream scenarios into concrete exchanges: starting conditions, inputs or events, expected results, and the assertions each side must satisfy. Cover the shared interactions in the accepted success, failure, and recovery paths. A case must explain how the frontend can exercise it with a substitute backend and how the backend can verify it without the frontend.

Keep examples consistent with the shared definitions. Add runnable mocks or contract tests when requested or needed to remove an ambiguity, using these same definitions and cases. Record how to run anything executable and what was actually checked; case definitions alone are not evidence of a passing implementation.

## Check independent implementation

Rehearse every in-scope journey using only the contract entry and its linked artifacts. Check the upstream scenario mapping for omissions. For every shared interaction, use the corresponding definition and case to check whether the frontend can determine what to send and how to respond, and whether the backend can determine what to accept and produce.

Any point that requires an implementer to guess a shared meaning or seek an undocumented agreement is still an open decision. Return it to `grilling` and update the contract as it is resolved.

Present the contract entry, shared definitions, contract cases, covered upstream IDs, and any remaining decisions. The contract is ready when the user confirms the agreement, its source revision still matches the accepted behavior, and both sides can implement and check all in-scope journeys compatibly from these artifacts with no unresolved shared decisions.
