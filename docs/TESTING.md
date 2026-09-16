# Test report — 16 September 2026

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
