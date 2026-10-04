# A clearer enquiry questionnaire

Reviewed 2 October 2026. This round turns the enquiry into a short sequence of related questions, with answer cards, optional written detail and an explicit review before sending. It keeps the existing coaching and private-dining field names and submission contract.

## Journey and controls

| Coaching | Private dining |
| --- | --- |
| 1. Choose support | 1. Describe the occasion |
| 2. Share a goal | 2. Describe the gathering |
| 3. Share an optional routine, or review now | 3. Add practical details |
| 4. Add optional context, then review | 4. Review the enquiry |
| 5. Review the request | |

Answer cards provide starting points; a custom answer remains available. Written answers are preserved when users go Back, revisit a completed stage, review an answer, or sign in. Optional information is marked and can be skipped. Clicking an Edit control on the review opens that stage with its existing values; continuing returns directly to review.

The automatic-next option is explained before answer selection and can be switched off. Fixed answer choices may advance after a brief cancellable pause; choosing custom text keeps the question open for typing. Back, a later choice, an explicit step change, or leaving the questionnaire must cancel any pending advance. Selecting answers, swiping, changing fields and reaching review never submits a request. Sending requires the final submit control.

Back and Continue are available as ordinary buttons. A dedicated swipe area offers an additional touch shortcut, without making users swipe on fields or answer cards. The progress controls allow revisiting stages that have already been reached; they do not skip forward to unanswered stages. Decorative symbols accompany visible text, rather than replacing labels.

## Guidance and its application

| Primary source | Relevant guidance | Application in this app |
| --- | --- | --- |
| [W3C WAI: Multi-page Forms](https://www.w3.org/WAI/tutorials/forms/multi-page/) | Divide longer forms into logical stages, explain progress, make optional stages easy to skip, and preserve answers when revisiting completed stages. | Separate support, goal and routine; show the stage count; provide an optional-details shortcut and visited-stage controls. |
| [GOV.UK: Question pages](https://design-system.service.gov.uk/patterns/question-pages/) | Start with focused questions, ask only for needed information, identify optional answers, and provide Back and Continue controls. | Keep coaching questions short. Group related event logistics where the answers make sense together. Reuse existing answers instead of requesting them again. |
| [GOV.UK: Check answers](https://design-system.service.gov.uk/patterns/check-answers/) | Let users inspect their answers before submission, change a section with values prefilled, and return directly to review afterward. | Show a separate review; add contextual Edit controls; retain unanswered optional fields as clearly unprovided information; submit only after review. |
| [W3C: WCAG 3.2.2 On Input](https://www.w3.org/WAI/WCAG22/Understanding/on-input.html) | Input changes should have predictable effects. Users must be warned beforehand when a changed control setting will alter context. State-toggle buttons can count as changed settings. | Explain automatic next before the cards, provide an off switch and a manual Continue button, cancel delayed movement when the user changes direction, and never auto-submit. |
| [W3C: WCAG 2.3.3 Animation from Interactions](https://www.w3.org/WAI/WCAG22/Understanding/animation-from-interactions.html) | This Level AAA criterion allows users to disable nonessential motion triggered by interaction; the guidance includes respecting the system reduced-motion preference. | Keep transitions short and disable their motion under `prefers-reduced-motion`. The ability to answer and navigate must remain intact. |
| [W3C: WCAG 2.5.1 Pointer Gestures](https://www.w3.org/WAI/WCAG22/Understanding/pointer-gestures.html) | Functions using multipoint or path-based gestures need an equivalent simple pointer operation. Keyboard support alone does not replace that pointer alternative. | Make touch swiping optional. Ordinary Back and Continue buttons perform the same navigation and remain available to mouse, touch and keyboard users. |

These sources support predictable, reversible and accessible form interaction. They do not establish that this app's illustrations, choice wording, five-stage structure, default automatic-next setting or approximately 280 ms delay increase completion or engagement. Those are design decisions inferred for this product. In particular, automatic navigation can move faster than some users expect; the visible explanation, off switch and cancellation behavior need testing with real users.

## Compatibility and verification

Validation for this change: syntax checks passed; the automated suite passed 245 tests with two platform-specific skips; all eight questionnaire DOM scenarios passed; all 123 recording walkthrough steps passed; the client/coach experience DOM check passed. The real Chromium launch crashed with SIGSEGV before loading a page, including outside the restricted sandbox. Responsive CSS/DOM inspection is not a substitute for a rendered browser check.

The questionnaire preserves canonical fields, custom text and the request's existing idempotency key. A fresh enquiry asks the user to choose support; a service link preselects its named service. If the user changes that choice, reopening the same link retains the changed answer. Following a different service link intentionally updates the preselection. Older three-panel drafts without flow version 2 are migrated to the corresponding stage. Authentication returns to the draft's review without sending it. A manual retry after a lost response reuses the same submission key so the saved request is not duplicated. Server-side validation and access controls continue to apply.

`scripts/test-enquiry-dom.mjs` exercises the current page's actual scripts with jsdom, real HTTP requests and a disposable SQLite database. It checks choice-card navigation, automatic-next controls and cancellation, custom answers, review editing, draft migration and authentication restoration, chef validation, explicit submission, safe retry, optional contact fallback, and unavailable browser storage. It also retains the existing home habit-save and disclosure checks.

For a jsdom installation outside the repository:

```bash
FF_JSDOM_MODULE=/absolute/path/to/jsdom/lib/api.js node scripts/test-enquiry-dom.mjs
```

Use a writable `TMPDIR` if the environment does not provide one. The test deletes its fixture database on completion and does not print account credentials.

The DOM tests cover the stated behavior, not visual rendering or complete WCAG conformance. Before release, check the experience on a phone and laptop, with keyboard navigation, a screen reader, zoom and reduced motion. Check that the automatic-next explanation is encountered before choosing an answer, focus lands on the new question or invalid field, swipe gestures do not interfere with scrolling or assistive technology, and previously entered answers survive correction and sign-in. Passing tests reduces known regression risks; it does not guarantee the absence of regressions or demonstrate engagement gains.

## Checks completed for this change

- `npm run check` passed.
- `npm test`: 245 passed, 2 platform-dependent tests skipped, 0 failed.
- `scripts/test-enquiry-dom.mjs`: all eight integration groups passed, including all legacy stage mappings and changing a service selected through a link.
- `scripts/test-recording-dom.mjs`: all 123 client/coach walkthrough steps passed, including recording recovery checks.
- `scripts/test-experience-dom.mjs`: all client navigation, Today, check-in and coach queue checks passed.
- The 13 SVG variants parse correctly. CSS/DOM inspection covered 320–1440px rules and reduced motion; this does not establish rendered geometry.
- Rendered-browser verification could not finish: the available Chromium binary exited with SIGSEGV during launch, including outside the restrictive sandbox. Phone/desktop visual and assistive-technology checks remain open.
