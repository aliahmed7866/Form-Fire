# WhatsApp conversations, app records

The app keeps enquiries, request status, proposals, service activation, plans,
check-ins and dated shared updates. WhatsApp is the preferred conversation route.
No WhatsApp account, messages or delivery status is connected to the database.

## Enable the chat link

Sign in as Alex through the normal sign-in screen. Open Contact options, add the
international WhatsApp number, choose Signed-in accounts or Everyone, and save.
The saved preview lets Alex check the destination. Hidden remains the default;
no real number has been assumed. Click-to-chat opens WhatsApp or its web handoff,
depending on the device. The user must send the message themselves.

Contact now puts available channels first. An open client request shows a
Continue on WhatsApp link with a fixed, editable greeting. Profile details,
answers, request identifiers and health information are never added to the URL.
Closed requests keep their existing records without a chat link or update form.

## Record the outcome

After discussing a request, open Add a request update and save the next action or
agreed change. Both Alex and that client see the update. Existing replies are
preserved in chronological order using their original authors and timestamps.
Private admin notes still belong in the client profile. Saving an update does
not change the agreed proposal, payment record, plan or service activation.
Those existing explicit actions remain necessary.

The existing owned request/reply API stores updates. A client update to an
Awaiting client response request returns it to Under review as before. Unsent
update drafts use the existing per-account tab storage and reopen their editor
when restored. Signing out clears them. No database migration is needed.

## UI refinement

The final shared stylesheet standardises action and submit controls at a 48px
minimum height, with matching padding and typography. Labels wrap, action groups
have consistent gaps, flex rows and builder controls wrap, and grid children can
shrink. Request details stack below 900px. Existing specialised navigation and
exercise controls keep their own layouts. The update form is collapsed until
needed; its brief reveal honours reduced motion.

## Validation

- `npm run check` and `npm test` cover syntax, persistence, request ownership,
  contact visibility, URL validation and existing client/admin journeys.
- `tests/contact-ui.test.ts` also verifies the request-record view, retained and
  escaped historical updates, shared visibility, hidden editor, closed records,
  and the missing-contact fallback.
- `scripts/test-request-record-browser.mjs` is an optional real Chromium check:
  `node scripts/test-request-record-browser.mjs`. Install Playwright and Chromium
  first. `FF_PLAYWRIGHT_MODULE` accepts an absolute module path;
  `FF_UI_SCREENSHOTS` optionally saves review screenshots. It checks 320, 390,
  768 and 1280px viewports, request-update save/reload/admin visibility and denied
  cross-client access. It uses fictional data in a disposable database.
- Rendered browser verification could not run in the implementation environment:
  Chromium was absent and browser downloads returned invalid archives. The browser
  script is supplied for follow-up validation; it is not a passing test claim.

Before release, visually check the request view, enquiry wizard, profile and
contact settings with large text, keyboard navigation and the actual WhatsApp
account on a phone. This change does not claim the existing local-test server is
a production deployment.
