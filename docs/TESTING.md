# Test report — updated 17 September 2026

## Independent branch and application revalidation — 17 September 2026

Validated repository revision `ad8dc0b8524eab4a080198b040340f737c9d4a9a` against the project brief. The exercise branch points to `b940f94`, which is already an ancestor of `main`; it has zero unmerged commits and is one documentation commit behind. No conflicting changes or open pull requests were found. Retain the branch and fast-forward it to the validated main revision with this documentation update. No force push or branch deletion is needed.

Fresh checks on Linux with Node 24.19.0 and Python 3.12.14:

- `npm test`: **135 passed, 0 failed, 0 skipped**.
- `npm run check`: passed.
- `python -m unittest discover -s tests -p '*_test.py'`: **4 passed**.
- `bash -n termux/install.sh termux/update.sh`: passed.
- `git diff --check`: passed.

The executed suite covers registration/verification/recovery, admin password plus TOTP, server role and ownership checks, request review/activation, immutable plan publication, check-ins and daily activity, chef booking gates, manual payment/refund arithmetic and idempotency, database reopening, migrations, all 40 exercise IDs, animation controls, TLS, and encrypted backup tamper/restore handling. API tests use temporary fictional data. Browser-script tests run simulated DOM/VM interactions; they are not rendered browser end-to-end tests.

Rendered browser validation remains blocked: Playwright is installed, but its Chromium executable is absent, and the browser download timed out. No new mobile/desktop screenshots, physical Android checks, real Google OAuth round trip or device restore drill were completed. No installed phone instance was updated or inspected.

**Result:** automated validation passes for the local test release. Production acceptance remains incomplete: managed identity, email delivery, hosted checkout and private uploads are disconnected; live SQLite is not app-encrypted; owner content/policy approval and device/accessibility checks remain open. Google client sign-in is optional and needs credentials; the ledger records explicitly manual payments. See the launch backlog and security scope for the remaining work.

## Current release: exercise library integrated into main (0.7.0)

Merged the 40-exercise animation feature onto the security release without conflicts. The combined code passed all **135 Node tests**, **four Python Admin Hub tests**, syntax checks, Termux shell syntax checks and Git whitespace checks on 17 September 2026. This includes the existing authentication, authorization, TLS, encrypted-backup and client data-isolation regressions, plus exercise catalogue, migration and playback controls.

The updated installation guide follows `main`. Migrations 005/006 retain existing exercise records and published client snapshots; starter-pack markers preserve previous edits/removals. No new browser or physical Android visual verification was performed for the merge. Existing visual/technique-review limits below still apply.

## Previous release: unified sign-in and security (0.6.0)

`npm test`: all 117 reported tests passed. The four Python Admin Hub tests passed; syntax, shell and whitespace checks passed. Earlier sections below describe the historical releases, including their former public admin-link UI.

Added regressions cover one public login, server-role destinations, no public setup links, delayed OTP challenge, preservation of credentials during retry, and clear network/non-JSON errors with manual read-only retry. No phone network failure was reproduced; these are simulated frontend responses plus real local HTTP/TLS tests.

Security tests submit SQL-shaped login/profile/identifier values and attempted role/verification overrides, test cross-client isolation and admin denial, and verify CSRF, exact media types, payload limits, Host checks (including health), response policies and private database/WAL permissions. Native HTTPS tests verify a dedicated test certificate using an explicit CA, inspect Secure/HttpOnly/SameSite cookies, confirm hashed session tokens and exercise both health-check transports. Misconfigured/mismatched origin, port, address family or TLS settings fail closed.

Password tests check stronger salted scrypt, malformed hash rejection, legacy compatibility and upgrades only after complete password/TOTP success. Backup tests cover committed WAL data and multi-chunk streaming, nonces, key persistence/permissions, altered header/ciphertext/tag/version, wrong/lost/replaced/symlinked keys, no overwrite, cleanup and offline decrypt without opening the live DB. The existing activity/deletion integration also passed with encrypted pre-deletion backups.

The committed TLS fixtures are public test keys only and must never be used for hosting. Browser rendering, physical Android/Termux operation, Android certificate trust, a real Google round trip and a full device restore drill remain unverified. Live SQLite content is not app-encrypted; the local default remains loopback HTTP. See [security scope](SECURITY.md) for exact encryption coverage and limits.

On the phone after updating: refresh the regular sign-in screen, confirm no admin link, sign in with the existing admin password, enter a fresh authenticator code, and verify admin tools appear. Then test a separate client session. Check status/restart if a connection error persists. Create an encrypted backup, preserve its separate key securely and test restoration into a private temporary destination before relying on it.

Environment: Linux, Node 24.19.0, Python 3.12.14. Integration tests use temporary SQLite databases and actual HTTP requests to the server. No real customer or money records were used.

## Executed successfully

`npm test`: 11 integration subtests plus the parent test passed (12 reported tests):

1. Client-only registration, verification gates, single-use verification codes and admin TOTP.
2. Role escalation/admin endpoint denial, Host/Origin rejection and CSRF enforcement.
3. Persistent requests, duplicate submission handling, cross-client request/reply rejection.
4. Legal request transitions, replies, independent approval and activation.
5. Recipe snapshots, immutable assigned plans, explicit new versions, stale-template edit rejection and direct plan API isolation.
6. Active-service check-ins, duplicate-week rejection and private feedback.
7. Private admin notes absent from client dashboard, request and export responses.
8. Idempotent manual payments, mismatched duplicate event rejection, overpayment/refund bounds, currency separation and outstanding balances.
9. Chef enquiry/proposal/acceptance/payment/confirmation gates; accepted proposals cannot be silently replaced.
10. Single-use password recovery and session revocation.
11. Server/database reopen preserves requests, assigned versions and payments.

`python tests/hub_registry_test.py`: 2 tests passed. Repeated attach/detach preserves other apps and custom fields; registered port collisions leave the file unchanged.

`npm run check`, shell syntax checks and `git diff --check`: passed.

## Not verified in this environment

The cloud browser returned `net::ERR_BLOCKED_BY_CLIENT` for the loopback preview. Rendered mobile/desktop visual inspection, browser-driven end-to-end tests, a complete keyboard/screen-reader audit, physical Android installation and full backup/restore drill remain open. A local server was started successfully and the HTTP application is covered by integration tests. Do not interpret passing API tests as a complete visual or accessibility audit.

## Phone/browser acceptance checklist

- Install with `--with-hub`; open the tile at port 8085. Test stop/start/restart in Admin Hub.
- At 390px and desktop widths, check header wrapping, hero, enquiry forms, admin tabs, plan editor and horizontally scrolling invoice table.
- Navigate with Tab/Shift+Tab/Enter. Check skip link, focus visibility, labels, error announcements and keyboard selects.
- Start an enquiry, type answers, register/verify/sign in, return and confirm the draft is preserved. Repeat a submission and confirm only one request.
- Use separate sessions for Alex and two clients; exercise the full coaching journey in README.
- Create recipes and meal/training plans, publish, edit the template, and check the old assignment remains unchanged until republishing.
- Test chef proposal acceptance, required manual payment and booking confirmation.
- Check manual report date range and separate currency/refund amounts. Use fictional figures only.
- Restart the service and confirm persistence. Back up, stop, restore into a test copy and check records.
- Detach from hub and verify the app and data remain usable; reattach and check there is one tile.

## Plan library update verification

`npm test`: 23 reported tests passed (including two suite parents), plus the existing two Python hub tests. Syntax and whitespace checks passed.

Added checks for upgrading a populated schema-1 database, preserving old template content/client records, installing starter examples only once, preserving edited/archived examples after reopening, and creating no automatic assignments. API tests exercise admin-only library mutations, structured exercise prescriptions and ordering, changed media/cues, stale edit rejection, validation of sets/rest/references, day/meal recipe snapshots, shopping lists, archive publication gates, stable historical assignments, client isolation and exports. URL validation rejects executable schemes, credentials, local addresses and iframe snippets. Markup tests verify escaping, explicit video links without automatic media loading, inactive default animation controls and old-plan rendering compatibility. Shared-script tests also render every admin studio view and both sample plan editors.

The prior local-preview browser restriction remains: these are HTTP/database and markup tests, not a new claim of rendered visual or physical Android verification. On the phone, check the four Plan studio tabs, adding/removing/reordering rows, animation Play/Pause/Next pose, reduced-motion mode, video links, and a sample plan in a separate client session.

## Daily activity update verification

`npm test`: 41 reported tests passed (including three parent tests), plus two Python hub tests. JavaScript/TypeScript syntax, shell syntax and whitespace checks passed.

Added HTTP/database checks for verified owner-only activity, admin read access, CSRF/origin validation, snapshot item validation, local-day boundaries, the publication/backfill window, idempotent completion, note/effort edits, undo, replaced versions, ended services, restart persistence, complete exports and requested deletion. The populated-database upgrade test now verifies migration 003 alongside preservation of existing content.

Browser-script VM/markup tests cover weekday versus flexible labels, latest active versions, date/time-zone controls, future previews, escaped notes, repeated recipes with distinct meal names, helpful restricted-account views and stale-date actions. These do not replace rendered browser or physical Termux checks.

On the phone, publish the starter workout and meal plans to a verified fictional client, then:

- Open Today, review exercises/recipes, log a workout and prepared meal, add a note/effort rating, refresh and try Undo.
- Change the selected date/time zone and move between weeks. Check future dates have no logging controls and each button records its displayed day.
- Review the client’s logs in Alex’s Client progress, including date filtering and the note. Confirm a second client cannot see them.
- Publish a replacement version. Confirm the previous logs remain in weekly history and export, and new actions use the replacement plan.
- Check mobile layout, keyboard navigation, animation controls and reduced-motion behaviour within expanded daily cards.

## Visual identity update verification

The existing 41 application tests passed. A separate smoke check rendered 20 public/client/admin view templates, found no error notices or unbalanced HTML tags, and verified that every referenced illustration exists. All five new SVG assets return HTTP 200 with the correct SVG content type.

The original and companion illustrations were rasterised with Sharp and visually inspected; the logo was checked at 24, 48 and 128 pixels. Source review covered the 390px and 768px breakpoint rules, navigation, form layouts and artwork sizing. The artwork renderer is a development convenience, not an app dependency.

The cloud browser again blocked the loopback preview with `net::ERR_BLOCKED_BY_CLIENT`. These checks do not constitute a rendered full-page mobile/desktop review. After updating on the phone, check the new header/footer mark, all three Train/Eat/Both states, service and sign-in layouts, client plan covers, Today, check-ins and Plan studio. Confirm the form actions and tabs remain convenient at the device’s text size.

## Google, lifestyle and admin test release

`npm test`: 91 reported tests passed, plus the two existing Python hub tests. Syntax, shell and whitespace checks passed. A 26-view template smoke check covers public pages, Google/admin setup, both sign-in modes, client lifestyle/daily pages and admin setup; HTML tags are balanced, IDs unique and no error notices rendered. The new illustration/Google assets return the expected SVG responses.

The Google tests use generated signing keys and a simulated provider transport: they cover valid sessions, signature and claim rejection, fixed endpoints, state/cookie binding, expiry/replay/concurrency, PKCE, cancellation, oversized/provider failures, stable subject identity, existing-account collisions and admin MFA protection. They do not prove the owner’s Google Cloud consent/credential configuration; a real Google round trip remains to be tested after setup.

Admin tests cover explicit setup, unique hashed credentials, normal TOTP login, repeat-run preservation, reserved-address collisions, edited/archived starter handling, one-use recovery and session invalidation. Frontend tests cover enabled/disabled Google options, safe error messages, admin sign-in controls, optional animation playback/pause/time limit, cleanup and reduced motion.

The four new lifestyle assets were rendered and visually inspected as a contact sheet. Full interactive mobile/desktop rendering remains unverified because the cloud browser blocks loopback access. On the phone, try each Play/Pause button, reduced-motion mode, the Feel-good ideas page, Today’s invitation, client versus admin sign-in, admin test setup and Google consent/callback after configuring credentials.

## Exercise art and animation library (v0.6)

- Full Node test suite: **102 tests passed** after integrating the Google sign-in/lifestyle update. Syntax checks passed; two Admin Hub registry tests and Termux shell syntax checks also passed.
- Added catalogue/database validation for all 24 keys, upgrade from the Google-enabled v4 database, preservation of Google identity mappings, administrator edits and published snapshots, repeat-seed behaviour, CSRF and client ownership checks.
- Added delegated UI-event tests for combined body-part/search filtering, live editor and workout previews, all catalogue selections, playback/half speed/pause/next-pose controls, reduced-motion changes, and cleanup when hidden, collapsed, offscreen or removed.
- Confirmed the new JS/CSS are served with the correct content types and loaded before the plan studio. No animation service or external media request is required.
- Rendered all exercise endpoint illustrations as PNG contact sheets for visual inspection; checked intermediate frames for the complex movements. These remain stylised starter guides requiring Alex’s coaching review.
- Browser layout testing could not run in this workspace: Chromium was unavailable and its download timed out. Actual mobile layout, keyboard navigation in a browser and physical Android playback remain a phone acceptance check. No claim of professional technique certification or WCAG conformance is made.

On the phone, open **Alex’s admin → Plan studio → Exercise library**, combine a body-part filter and equipment search, play/slow/step a movement, change the editor’s illustration, save it and refresh. Publish a sample client version, then check the movement in **Plans** and **Today**. With reduced motion enabled, Next pose should remain available and Play should explain why movement stays still.

## Administrator sign-in fix (0.5.1)

`npm test`: all 93 reported tests passed. `npm run check` and `git diff --check` passed. The local run uses a writable workspace `TMPDIR` because this execution environment has no `/tmp` directory.

HTTP regressions verify that only a correct administrator password produces the structured authenticator challenge. Missing or invalid OTP codes create no session or cookie; wrong passwords and unknown accounts remain generic errors. A correct OTP still creates the normal administrator session.

The real browser-script submit handler is exercised with a simulated form and HTTP responses: the client sign-in form reveals one required code field, keeps the same email/password fields and values, focuses the code after announcing the error, handles an invalid-code retry, then submits the code and opens admin. Ordinary credential errors add no code field. Markup checks cover the visible sign-in options above the form.

Rendered phone behaviour remains to be checked on the device. After updating and refreshing, try administrator credentials from Client sign-in, enter a fresh code, and confirm the admin panel opens. Also check Alex’s admin sign-in directly and a normal client login.
## Exercise expansion feature branch (v0.7)

The combined branch passes **135 Node tests**, **four Python Admin Hub tests**, application syntax checks, Termux shell syntax checks and Git whitespace checks. It includes upstream sign-in, transport and encrypted-backup changes through `9d89143`. Tests use a writable workspace `TMPDIR`; no real client records are used.

The exercise checks cover all 40 saved animation IDs, 200 rendered poses, editor and assigned-plan integration, position seeking/resume, quarter-speed playback, reduced motion, single-guide playback and lifecycle cleanup. Upgrade checks preserve edited, archived and deleted examples, Google identity records and immutable client snapshots across migrations 005 and 006. HTTP smoke checks confirm the four exercise scripts/styles are served with the expected types and the scripts load in dependency order.

All 40 illustrations were rasterised and visually reviewed at endpoints and intermediate positions. Corrections include grounded support contact, forward curl paths, calf toe pivots, the side-lying clamshell projection, the mountain-climber knee path and the step-up finish. See [the visual reference](exercise-preview.png) and [feature-branch test instructions](EXERCISE_LIBRARY.md).

A browser executable is unavailable in this workspace, so full-page browser rendering and physical Android playback remain unverified. On the phone, check the body-part filters, exercise editor previews, Plans and Today, keyboard/range controls, quarter speed and reduced motion. Alex’s review of the illustrative technique remains part of selecting exercises for a client.
