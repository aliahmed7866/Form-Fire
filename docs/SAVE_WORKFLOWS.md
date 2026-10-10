# Reliable planner, progress and diary saves

10 October 2026. Based on merged main `2e144488f7e64172e3a2e56440ef71d41fd3f1e2`.

## Reproduced failures

A delayed planner response navigated away from newer profile edits. A delayed fitness measurement response refreshed the user's newer page and replaced unsaved fields. Review also found that typing during an automatic redirect's loading window could still be lost.

## Consistent save behavior

Planner add/edit, planned-portion logging, repeated diary portions, progress add/edit and diary add/edit now share one small form lifecycle:

- Capture the intended payload, lock only the submitted form, and ignore repeated pending submissions.
- Complete the explicit write with the existing server-side ownership, idempotency and version checks.
- Preserve newer navigation and edits, including typing during a same-page refresh.
- Confirm cross-page saves in place with a **View saved…** link instead of redirecting automatically. This also applies when a planned meal's date changes. The user can finish other work before choosing to navigate.
- Keep unknown network outcomes unconfirmed, restore original controls and retry keys, and avoid scrolling/focusing an older failure on a newer page.
- Remove previous-account forms when a refresh discovers an account switch, even if they contain unsaved edits.

The helper is served through the app's explicit static-file allowlist, loaded before its callers and syntax-checked. No dependency, schema, nutrition rule, credential, authentication-policy or deployment change.

## Validation

- Full Node suite: 274 passed, zero failed, two platform-specific service skips.
- Syntax checks and all four hub-registry tests passed.
- All six optional real DOM/HTTP/SQLite usability suites passed.
- The complete 123-step fictional recording rehearsal passed, including presenter pause/recovery controls and no write replay.
- Ten new default-CI tests cover caller payloads, duplicate writes, new-route protection, failure retries, asset wiring and explicit cross-page navigation. The seven diary lifecycle regressions also continue to pass against the shared helper.
- New real-server UI tests cover delayed planner/progress writes, newer navigation, typing during post-save reads, cross-day saves, lost-response retry, controls and account switching.
- Independent review found the redirect/loading race; removing automatic cross-page redirects resolved it. Final code review has no remaining blockers.

These checks do not establish rendered-browser or physical Android usability, WCAG conformance or production security.

## Scope and launch gates

This is save reliability in the existing fictional-data/local-test application. It is not autosave, a universal draft system or a claim that all unrelated admin editors protect arbitrary unsaved navigation.

Before real clients, the existing launch gates in [DECISIONS.md](DECISIONS.md) still apply: choose and configure reviewed production identity/email/checkout, hosting and backup arrangements; confirm operating jurisdiction, privacy/retention/cancellation terms, packages and contact details; review Alex's content; complete real-device, security and restore acceptance. Current local-test accounts, optional email verification, terminal recovery and manually recorded payments must not be described as connected production services.
