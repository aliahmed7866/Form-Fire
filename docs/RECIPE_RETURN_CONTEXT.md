# Return from recipe tools without starting over

10 October 2026. Follow-on to merged PR #21, based on main `298cb73ae2168c7947c202a0d163b020f44c1e4c`.

## What was reproduced

The direct catalogue → recipe → catalogue path retained filters, but recipe-tool detours did not. Kitchen mode and recipe swaps could also return to the recipe without its selected date, causing later forms to default to today.

## Changes

A small shared route helper carries the selected day and only the existing catalogue keys through kitchen mode, vegan/vegetarian previews, changed protein choices, group quantities and saved private recipe copies. Both kitchen return actions use the same context. Oversized context is discarded; arbitrary return URLs and unknown fields are not carried.

Catalogue state remains navigation-only and is removed from adaptation POST payloads. Existing admin destinations and planned-meal → kitchen → planner routes are unchanged. No database migration, dependency, nutrition rule or real-client readiness change.

## Verification

- Four new dependency-free route tests cover the allowlist, day precedence, bounded context, admin routing and absence of catalogue data from save payloads.
- Real DOM/HTTP tests follow kitchen Back and Plan/log, swap preview changes, group quantities and saved private copies back to the filtered catalogue. A planned meal still returns to its selected planner date.
- Full Node tests: 264 passed, zero failed, two platform-specific service skips.
- Syntax checks, four hub-registry tests and all five optional DOM/HTTP usability suites passed.
- Independent read-only review: no remaining blockers.

The change is intended to reduce repeated searching and date re-entry. No measured time-saving, rendered-mobile QA or accessibility-conformance claim is made. Physical Android/Termux and rendered visual acceptance remain separate checks.
