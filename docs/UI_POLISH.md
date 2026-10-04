# UI review and polish

4 October 2026

This round reviews the existing implementation after the everyday-ease changes. It keeps the warm charcoal, citrus and illustrated identity, and improves how existing actions, records and forms are presented. It adds no runtime dependency, migration or new business workflow.

## Findings and changes

| Area | Finding | Change |
| --- | --- | --- |
| Shared controls | Pale input borders were difficult to distinguish from the input surface. Supporting text and table content were small. | Stronger control borders and focus treatment; modestly larger supporting text and tables; clearer table headers and rows. Decorative card borders stay quiet. |
| Request states | Every state used the same uppercase pill. Approval and active service should remain visibly distinct. | Sentence-case labels with decorative symbols and restrained state colours. Approval is informational; active service has its own state. Existing status text and business rules are preserved. |
| Client home | The three daily actions had weak visual separation between their descriptions and calls to action. | Small original SVG illustrations, clearer action footers, focus styles and compact phone arrangements. The three-action limit remains. |
| Check-ins | Technical dates, repeated waiting text and indistinguishable selected weeks made history harder to scan. | Readable date-only labels, an explicit selected-week label, distinct saved/feedback states and a clearer send action. Reflection text, notes, energy and feedback remain intact. |
| Profile | A long sequence of fields mixed goals, settings and optional body targets. | Three labelled groups, the existing profile character, a clearly optional measurements section and explicit units. Native validation opens closed details containing an invalid field. Saving still submits the same canonical fields. |
| Progress | Five energy cards were cramped in narrow phone and desktop cards; stacked desktop filters pushed the chart down. | Energy choices become readable rows in narrow containers, with a viewport fallback. Filters use available width; the history table names its metric and units and identifies column headers. |
| Chef questionnaire | The required budget was visible while its required currency was inside a disclosure. | Show amount and currency together. Keep the current stages, custom answers, review/edit flow, draft recovery and submission protection. |
| Coach workspace | Client identity, several equal-weight actions, detailed profile values and reply controls competed for attention. | Group related actions and details, improve check-in/reflection/feedback hierarchy and make the existing queue easier to scan. No private notes are added to client views. |
| Recipe groups | Recipes without calculated ingredients offered a group-quantity path that ended in an application error. | Explain the missing prerequisite and offer a useful return or next action, including for a direct link. Keep server quantity and access checks in place. |

## Evidence and boundaries

- [W3C: Contrast (Minimum)](https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum.html) and [Non-text Contrast](https://www.w3.org/WAI/WCAG22/Understanding/non-text-contrast.html) inform the text and control-boundary colour checks. Stronger boundaries improve distinction on pale surfaces; individual nominal colour checks are not a whole-page conformance result.
- [W3C: Reflow](https://www.w3.org/WAI/WCAG22/Understanding/reflow.html) informs the narrow layouts and avoidance of cramped side-by-side controls.
- [W3C: Focus Not Obscured (Minimum)](https://www.w3.org/WAI/WCAG22/Understanding/focus-not-obscured-minimum.html) informs focus visibility and the existing sticky-header/bottom-navigation spacing. Opening an invalid field's disclosure makes recovery possible without changing the user's entries.
- The earlier [everyday-ease rationale](EVERYDAY_EASE.md) covers task recognition, progressive disclosure, recoverable drafts and motion preferences.

These are code-review findings and research-informed decisions. They are not measured improvements in engagement, task time or retention. No tracking, pressure-based streaks or fabricated achievements were added.

## Verification

The audit covers public information and authentication, client navigation and daily tools, recipes and kitchen paths, enquiries, requests and plans, progress/profile, and coach review, publishing and business screens. Real local HTTP/SQLite flows remain the regression gate for saved data and access boundaries.

Completed checks:

- `npm test`: 249 passed, two platform-dependent skips, zero failures (251 total).
- `npm run test:usability`: all five suites passed, including profile field persistence and disclosure recovery, questionnaire amount/currency review, draft isolation, recipe failure handling, admin access to personal recipes and fitness units.
- Recording walkthrough: all 123 steps passed, plus playback controls, saved-profile reconciliation and dropped-read recovery checks.
- Semantic audit: 63 route/view checks — 14 public, 27 client and 22 coach — reported no application errors, duplicate IDs, broken ARIA references or axe A/AA semantic violations. Colour contrast was disabled in this non-rendering run.
- All 14 stylesheets parsed. CSS-rule checks at 320, 390, 768 and 1440px covered narrow controls, check-in columns, navigation positioning and reduced-motion energy controls. The input border/surface colour pair calculates to 3.78:1; checked status text/background pairs range from 5.94:1 to 7.61:1. These are nominal solid-colour calculations.
- `npm run check` and `git diff --check` passed. An independent integrated code review found no blocking issues.

The available Chromium process crashed at launch before opening a page. The bounded attempt was stopped, so there are no new screenshots or rendered viewport results. DOM semantics, CSS parsing, colour calculations and automated interaction checks do not substitute for rendered phone/desktop, zoom, keyboard or screen-reader testing. This review remains a draft until those checks can be completed in a working browser.

One separate navigation issue remains recorded for a follow-up: returning through kitchen/adaptation/group screens can lose the originating recipe catalogue filters. This round preserves the existing direct catalogue-to-recipe return and improves the unsupported group-quantity handoff; it does not redesign the multi-screen navigation state.
