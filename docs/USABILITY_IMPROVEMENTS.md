# Easier client and coach journeys

1 October 2026 · Existing app improvement, not a framework migration or compliance certification

## What the audit found

The app already had real enquiry/reply, coaching, food, progress, booking and contact-settings workflows, backed by server authentication and SQLite. The main friction was presentation: generic input padding reached checkboxes, some grid children resisted shrinking, action rows had very small gaps, and the workspace showed a long undifferentiated list of destinations. Initial coaching required background details before a conversation could start. A configured WhatsApp link existed on Contact, but was separated from the submitted enquiry.

## Implemented decisions

- **Short initial enquiry.** Coaching requires a support choice and one goal. Routine and more background are optional. Three panels offer Back, review and Edit; answers and submission keys survive registration/sign-in. No request is sent until the final Send action. Chef enquiries group the existing required gathering/practical details and expose errors inside collapsed sections.
- **Optional WhatsApp follow-up.** Alex keeps control of the number and audience in Contact options. When available, an open client request offers WhatsApp beside the in-app reply. Only a fixed, editable greeting is put in the link. No goal, health information, name, email, request ID or token is included. Nothing sends automatically. External messages do not sync back; plans, check-ins and agreed package/booking changes remain in the app.
- **Clear next actions.** Client home shows three useful actions and keeps additional meals, habits, summaries and settings in expandable sections. Requests explain the next step for Alex and the client. Approval, activation, payment and booking confirmation remain separate states.
- **Roomier, stable controls.** Checkbox/radio footprints no longer inherit text-input padding. Shared buttons and action groups wrap with more space. Grid children can shrink; expanded details stay in normal flow. Phone layouts simplify plan cards, control groups, charts and date navigation. Keyboard focus and reduced-motion behavior remain available.
- **Grouped navigation.** Client and Alex destinations are arranged into three labelled groups. All 17 client and 14 admin destinations remain available; role separation and deep links are preserved.

## Research informing the choices

These sources informed design decisions, not measured claims of faster use:

| Source | Relevant guidance | Application |
| --- | --- | --- |
| [W3C target size](https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum.html) | WCAG 2.2 AA specifies a 24 CSS-pixel minimum with exceptions; spacing and larger targets help prevent accidental activation | Comfortable controls, stable selection footprints and larger gaps |
| [W3C reflow](https://www.w3.org/WAI/WCAG22/Understanding/reflow.html) | Content should work at a narrow effective viewport, including the 320 CSS-pixel reference | Shrinkable grids, wrapping action groups and phone-specific layouts |
| [GOV.UK question pages](https://design-system.service.gov.uk/patterns/question-pages/) | Ask only necessary questions, label optional answers, provide Back/Continue, and avoid repeated entry | Short related question groups, optional background, review and retained drafts |
| [ICO data minimisation](https://ico.org.uk/for-organisations/uk-gdpr-guidance-and-resources/data-protection-principles/a-guide-to-the-data-protection-principles/data-minimisation/) | Personal information should be relevant and limited to the stated purpose | Minimal initial intake and no questionnaire data copied into an external URL |
| [WhatsApp click to chat](https://faq.whatsapp.com/5913398998672934/) | Click-to-chat can open a conversation with prefilled text | Explicit user-initiated handoff with a generic editable greeting |

## Validation and remaining checks

The real-server DOM test covers required/optional answers, review/edit, account setup and return to the draft, successful persistence, manual retry after a lost response, contact unavailability, chef validation and unavailable browser storage. The full 123-step recording rehearsal passes using actual frontend forms/events and the HTTP/SQLite app. It now progresses through visible enquiry panels before sending.

Contact checks cover audience settings, authentication/CSRF, conflict protection, canonical destinations and the absence of private data from the greeting. Navigation tests preserve every destination. Stylesheet parsing and computed-style checks verify that checkbox size and padding stay stable when checked and focused.

**Rendering limit:** a real Chromium run was attempted, but the official browser download returned a Site Unavailable response. DOM/style tests do not establish rendered geometry or device usability. Before claiming phone acceptance or WCAG conformance, inspect 320/390/768-pixel and desktop layouts, large text/zoom, expanded plan editors, keyboard focus and actual Android controls. No claim is made that every possible overlap has been visually verified. Test with Alex and a representative client before claiming time savings.

The app remains the existing local test edition. Jurisdiction, business policies, communication retention and production configuration still need confirmation before real-client use; this change does not certify legal compliance.
