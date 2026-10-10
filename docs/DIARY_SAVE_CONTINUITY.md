# Diary saves without interrupting newer work

10 October 2026. This second iteration is combined with the navigation-continuity changes for publication. The earlier standalone navigation patch remains a separate historical artifact.

## Reproduced problem

A food-diary POST or PUT could finish after the client had opened another page or edited another form. Its unconditional navigation/refresh discarded that newer context. A second race existed when typing began during the refresh GET after a successful save.

## Changes

- Lock only the submitted diary form while its request is pending; retain the original control states for retry.
- Ignore repeated submit events for that pending form.
- Complete the requested server write normally. Show a date-specific confirmation, but do not change a newer route or replace newer edits.
- Guard same-day refresh at DOM commit time, so typing during the follow-up GET also wins. A saved form becomes a small confirmation with a View saved diary link when another form is being edited.
- Account changes take precedence over edit preservation: refresh removes the previous account's private forms instead of leaving them paired with a new session.
- Failed writes unlock original fields and preserve the retry key. A stale failure does not move focus or scroll a newer page. Lost responses are not presented as confirmed failures or silently retried.

No schema, authentication policy, OAuth allowlist, runtime dependency, real-client mode or deployment change. Server POST idempotency and edit-version checks remain authoritative.

## Verification

- Full Node suite: 260 passed, zero failed, two platform-specific supervised-service skips.
- Syntax checks and four hub-registry tests passed.
- All five `test:usability` suites passed using an external jsdom installation and the real HTTP/SQLite server.
- New DOM cases verify delayed POST/PUT, newer navigation, same-page edits, edits during a delayed refresh GET, duplicate submit, database persistence, offline failure, lost-response POST retry, and an account switch during the refresh.
- Seven dependency-free diary-save tests and a render-guard test are included in the default `npm test` CI run.
- Independent read-only review reproduced and verified the two refresh races; no remaining blockers.

DOM tests are not rendered mobile/browser acceptance. Physical Android/Termux service tests and rendered visual QA remain separate checks. The app remains fictional-data, local-test software.

## Running the optional UI suite

Install jsdom outside the dependency-free application, then set `FF_JSDOM_MODULE` to that installation's `jsdom/lib/api.js` and run `npm run test:usability`. Normal CI continues to require no npm runtime dependencies; the new Node VM regressions run there.

## Shared lifecycle follow-on

The subsequent [planner/progress pass](SAVE_WORKFLOWS.md) extracts this behavior into a shared helper. Cross-page diary saves now also confirm in place with an explicit View saved diary link instead of automatically navigating.
