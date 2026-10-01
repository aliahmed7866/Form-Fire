# A calmer, more engaging client and coach experience

1 October 2026 · Version 0.18.0

## Architecture and scope

This round evolves the existing responsive JavaScript client, Node 24 HTTP API and SQLite database. There is no framework migration, database migration, reset, runtime dependency, authentication change or new service integration. Existing published plan snapshots, client histories, request transitions, payments and Termux launch commands stay authoritative.

The baseline was 229 passing tests and two platform-specific skips. The audit found 17 client navigation destinations competing for attention, long daily pages, duplicate weekly check-in invitations, and admin lists that mixed work for Alex with work waiting on clients.

## Client changes

- Five primary destinations: **Today, Train, Eat, Progress, Account**. Labelled SVG icons support scanning; on phones the navigation sits at the bottom with safe-area spacing. All existing routes remain available through grouped shortcuts. Train opens the existing training and meal plan collection; its desktop description and the retained **My plans** shortcut make this clear. Eat opens recipes, with planner, diary and shopping shortcuts nearby.
- Today keeps three next-action cards. A small original SVG notebook illustration and restrained decorative emoji add personality without adding scoring, compulsory streaks or automatic motion.
- Daily schedule shows up to three remaining scheduled items, prioritising training. More items, saved logs, flexible sessions, other days and optional helpers remain in labelled disclosures. Completing or undoing an item preserves its original plan/date/timezone identifiers. The saved item’s disclosure opens before keyboard focus returns. Saving an optional note follows the same behaviour.
- The weekly check-in screen distinguishes an unsent update, a saved update awaiting feedback, and feedback from Alex. It avoids offering a second submission for an already saved week. Week selection and extra notes/measurements remain available; clients with no active coaching service see the next useful step. Existing check-in history remains readable.
- The home coaching card reflects a saved check-in or actual feedback rather than repeating the invitation. The app does not claim that feedback is unread or invent a notification state.

## Coach changes

- Overview prioritises unanswered check-ins, requests needing review, inactive approved services needing review, and missing plan types for active services. An inactive service may be an agreed pause; it is never activated automatically.
- Client replies and unaccepted chef proposals stay in a separate waiting list. Accepted chef proposals still require request approval and agreed payment checks before booking confirmation.
- Client search runs locally and hides existing cards. Filtering does not rebuild forms or discard unsaved notes. Profile details and private admin notes open only when needed.
- Check-ins default to those needing a reply. All records and saved feedback remain accessible, with client and selected-check-in filters. Feedback starts blank where no feedback exists and always requires an explicit Send.
- A missing-plan shortcut preselects the eligible active request in the publish form. The coach still chooses a template and explicitly publishes a new version.

## Artwork and accessibility choices

The static `art-good-day.svg`, inline coach clipboard illustration and navigation icons are original project SVGs. They depict objects rather than Alex or clients and have no external asset dependency. Decorative symbols are hidden from assistive technology; action labels remain plain text. Native disclosures, labelled fields, focus restoration and existing reduced-motion controls are retained. The phone bar reserves content space and adjusts toast and recording-player placement.

## Verification

Run the application checks with Node 24 or later:

```bash
npm run check
npm test
```

Optional real HTTP/SQLite DOM rehearsals use a separately installed development copy of jsdom; jsdom is not an app runtime dependency:

```bash
FF_JSDOM_MODULE=/absolute/path/to/jsdom/lib/api.js node scripts/test-enquiry-dom.mjs
FF_JSDOM_MODULE=/absolute/path/to/jsdom/lib/api.js node scripts/test-recording-dom.mjs
FF_JSDOM_MODULE=/absolute/path/to/jsdom/lib/api.js node scripts/test-experience-dom.mjs
```

If the host lacks a writable temporary directory, set `TMPDIR` to a disposable writable directory. These checks create and remove separate fictional databases rather than use installed client data.

The final regression suite reports **245 passed, 0 failed, 2 platform-specific skips (247 tests)**. It covers persistence, cross-client access, administrator authorisation, private notes, plan versioning, recipe adaptations, booking/payment gates and backups. Focused tests cover navigation aliases, all secondary destinations, saved-week handling, escaping, daily focus, coach queue classifications, filtering and eligible publish-request preselection. The enquiry rehearsal, five focused experience DOM suites and all 123 recording steps pass, including lost-response recovery and protection against automatic write replay. The final check-in save keeps the selected week in the URL without a second competing render and moves focus to the saved receipt.

**Rendering remains unverified here.** Stock Chromium could not download successfully; packaged Chromium 138 and 153 exited immediately with SIGTRAP. DOM checks do not establish visual geometry or WCAG conformance. Before accepting device layout, inspect narrow phones (320 and 390 CSS pixels), a tablet and desktop, large text/zoom, keyboard focus, the recording overlay and Android’s onscreen keyboard. No claim is made of measured engagement or reduced admin time; test those with Alex and a representative client.

The app remains the existing local test edition. Google sign-in appears only when configured; email delivery, hosted checkout and private uploads have not been connected by this round.
