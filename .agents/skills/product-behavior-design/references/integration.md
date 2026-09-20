# Integrate accepted work

## 1. Establish the accepted delta

Read the package record and identify the version and scope the user accepted; ask if either is ambiguous. Record that acceptance, mark the scope `Accepted` and its reviewed choices `Confirmed`, and leave other work `In review`. Acceptance and completed integration are separate facts.

Compare the accepted changes with both their baseline and the current accepted version. Preserve intervening work. Use `grilling` if resolving a conflict requires a new product choice; otherwise resolve the integration from the recorded behavior. Before replacement, make the affected starting source recoverable by immutable reference or a minimal snapshot in the package.

This step is complete when the accepted delta is distinguishable from unaccepted and intervening changes.

## 2. Update the current version

Integrate by artifact, not by copying the package:

- **Runtime:** apply accepted source, scenario, configuration, and asset changes to their canonical locations. Adapt imports and run entries. Remove superseded copies and update their consumers. The first integration establishes the complete runnable version.
- **Behavior:** read the manifest and update the existing owner. Add a document only when no current scope fits; split scopes that have become independently understandable. Follow [record.md](record.md), writing the resulting behavior directly. Update ownership in the manifest when it changes.
- **Verification:** retain reusable checks for accepted behavior, adapting their runtime and output paths. Leave exploratory probes and intermediate logs in the package.
- **Evidence:** check which package evidence still represents the integrated runtime. Regenerate invalidated cases, replace affected current entries, and retain unaffected valid evidence. Use the same classification and capture requirements as refinement. Reconcile the owning record's coverage table with the resulting files.

External reference collections, baseline copies, and session history stay in the package. Express adopted design decisions in the current behavior record; do not transplant the research trail.

This step is complete when the accepted changes have canonical owners and no obsolete copies or references remain in the affected scope.

## 3. Verify and close

Exercise affected journeys from the integrated run entry, including their connections to retained behavior. Integration is complete when:

- Runtime, behavior records, and evidence agree for the accepted scope, including every supported environment.
- The manifest covers the resulting behavior ownership, and all run, scenario, and evidence pointers resolve.
- The accepted version describes only the present and can be understood, run, and verified without `.scratch/`.
- The integration's writes stay within the skill's write boundary.

If checks fail, preserve the package and mark integration incomplete until resolved. A new product decision returns to `grilling`; acceptance is not permission to invent its answer.

Record the integration result, checks, and destination pointers in the package. Report the current run and behavior entries and any agreed exclusions. New work starts from the updated accepted version; retain unaccepted work in its package.
