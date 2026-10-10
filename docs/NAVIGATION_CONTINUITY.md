# Pick up where you left off

Local usability pass, 10 October 2026. Based on main commit `7d2bc1dc1f4fcd1426e0d9644ffa7ec41b0d70f7`.

## Verified gaps and changes

- Local password sign-in previously dropped dates, selected weeks and filters on protected links. The full return path now survives sign-in, account creation links and password-recovery links. A nested `next` parameter cannot override a protected page's own location.
- Signed-out request and published-plan links now open the shared sign-in form instead of attempting a private fetch and showing a generic error. Both clients and Alex can resume authorized detail pages, including trailing-slash links. Server ownership and role checks are unchanged.
- Query parsing preserves literal question marks inside query values.
- Browser titles distinguish Food diary, Check-ins, My plans and other destinations, using fixed labels rather than client names, record IDs or entered answers. Anonymous protected pages say Sign in. Failed loads say Page unavailable rather than keeping the previous page's title.

## Research

[W3C Page Titled](https://www.w3.org/WAI/WCAG22/Understanding/page-titled.html) recommends descriptive titles that update as a single-page application's view changes. This informed the fixed, route-specific labels.

[W3C Re-authenticating](https://www.w3.org/WAI/WCAG22/Understanding/re-authenticating.html) explains preserving activity and context across sign-in interruptions. This pass preserves navigation context; it is not a claim that every editable form preserves unsaved data or that the app meets the full criterion.

## Validation

- `npm test`: 252 passed, 0 failed, 2 skipped (Termux supervised-service lifecycle tests require their platform).
- `npm run check`: passed.
- `python3 tests/hub_registry_test.py`: 4 passed.
- Focused navigation and experience tests: 26 passed, including password-submit handlers, anonymous detail gates, query/recovery continuity, role-safe returns, titles and failed-load retry.
- `git diff --check`: passed.
- Independent read-only code and focused-test review: no blockers.

The full suite exercises real HTTP/SQLite behavior, but the new focused frontend checks use the repository's Node VM harness. The first standalone patch did not run the optional jsdom suite. The subsequent combined diary-save pass completed all five real DOM/HTTP usability suites; see DIARY_SAVE_CONTINUITY.md. No rendered-browser, phone or Android acceptance claim is made.

## Scope and applying

No runtime dependency, database migration, account change or deployment is required. The original standalone patch was local-only; subsequent publication is tracked by its pull request. Google sign-in retains its existing narrower return-path allowlist; this improvement to full return context is for local password sign-in. Do not widen that allowlist without reviewing what is included in OAuth state.

Apply the accompanying patch to a clean checkout of the stated base with `git apply --check form-fire-navigation.patch`, then `git apply form-fire-navigation.patch`. Run the checks above before publishing. Existing normal Termux update commands will not install this patch until it has been reviewed and published to main.
