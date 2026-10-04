# Everyday ease: navigation, food, progress and coaching

4 October 2026 · Research-informed improvements to the existing app

## What this round addresses

The review followed recurring client and coach tasks: finding a page, choosing a meal, recording progress, writing a weekly update, and replying with useful context. The goal is to make those tasks easier to start and finish, while keeping the app's warm illustrations and encouraging language.

The existing app already provides these capabilities. The friction was in using them: a long navigation list, a dense recipe filter form, a full page render after saving a favourite, repeated typing of exercise names, a metric-change handler that also reached the chart filter form, and unsent coaching text that could disappear during navigation. Alex's feedback screen also required too much recall of the client's current situation.

These are findings from a code and interaction review. The source guidance below informs the proposed solutions; it is **not user research on FORM & FIRE**, evidence of increased engagement, or a claim of WCAG conformance. Whether people prefer the changes still needs observation with representative clients and Alex.

## Evidence and design decisions

| Observed friction | Relevant evidence | Application in this round |
| --- | --- | --- |
| People need to remember which section contains a task. Some controls rely on short labels or symbols. | [NN/G: Recognition and Recall](https://www.nngroup.com/articles/recognition-and-recall/) explains why visible choices, contextual cues and previously used items reduce dependence on memory. | Add searchable, plainly labelled task shortcuts within the existing workspace navigation. Pair decorative symbols with text. Preserve normal navigation and deep links. |
| Recipe discovery starts with many equally prominent controls. | [NN/G: Progressive Disclosure](https://www.nngroup.com/articles/progressive-disclosure/) recommends prioritising frequent controls and revealing secondary options through clearly labelled actions. Splitting interdependent tasks into too many stages creates its own burden. | Keep recipe search and common ways to browse prominent; group extra filters in one clearly named area. Do not turn everyday food browsing into another multistep questionnaire. |
| Hiding every filter would create a different discovery problem. | [GOV.UK: Details](https://design-system.service.gov.uk/components/details/) advises reserving disclosure for information only some people need, rather than content needed by most users. | Keep the main search available and make extra filter state visible. Provide a clear way to remove filters and recover from an empty result. |
| Favourite changes refresh the page, and dynamic results can be hard to notice. | [W3C: Status Messages](https://www.w3.org/WAI/WCAG22/Understanding/status-messages.html) describes programmatically exposed success, waiting and result messages that assistive technology can announce without moving focus. | Update favourite state in place, show a concise result, and keep the person at their current task. Announce meaningful outcomes rather than every keystroke. |
| Progress logging asks people to repeat names and can react to the wrong form's metric selector. | [W3C: Focus Order](https://www.w3.org/WAI/WCAG22/Understanding/focus-order.html) explains logical, operable keyboard sequences; the recognition principle above supports showing previous choices. | Scope metric updates to the correct form. Offer existing exercise/activity choices, while retaining custom entry. Keep recorded values explicit: a previous result is context, not a new measurement. |
| An interruption can discard a check-in, feedback or reply before it is sent. | [W3C: Avoid Data Loss and “Timeouts”](https://www.w3.org/WAI/WCAG2/supplemental/patterns/o4p09-data-loss/) recommends allowing breaks without losing work, with security and privacy considered. This is supplemental cognitive accessibility guidance. | Keep check-in, feedback and reply drafts in the browser tab's session storage, with a memory fallback and visible status when storage is unavailable. Scope them to the account, form and relevant record or week. Sending remains explicit. |
| A failed save can leave people unsure whether to retype or retry. | [GOV.UK: Error Message](https://design-system.service.gov.uk/components/error-message/) says to explain the problem and recovery, and retain both passing and failing answers when showing validation errors. | Keep entered work on failure. Clear a draft only after confirmed success; retain the established validation and submission rules. Distinguish an unsent draft from a saved record. |
| More animation could make frequent tasks distracting. | [W3C: Animation from Interactions](https://www.w3.org/WAI/WCAG22/Understanding/animation-from-interactions.html) describes disabling non-essential interaction motion, including support for reduced-motion preferences. | Use playful symbols and existing artwork to support understanding. Essential controls, feedback and task completion must remain understandable with motion disabled. |

## Product boundaries

Engagement here means making useful actions approachable and reliable. This round does not add pressure from streaks, rankings, compulsory body measurements, unearned badges or fabricated progress. It does not measure retention or introduce behavioural tracking.

On the check-in screen, put the unfinished task before the history on phones, show recent updates first, and let people reveal older updates. Require an explicit energy choice rather than treating an untouched default as the client's answer.

Coach context should bring the client's existing information beside the feedback task, with clear labels and links to fuller records. It must not invent advice, automatically send a reply, or present administrative notes as client-visible feedback. If saved feedback changes while a draft is open, preserve both for review rather than silently replacing one.

These changes use the existing routes and server operations. Request approval, service activation, payment and booking confirmation keep their separate meanings. Client and administrator access must continue to be enforced by the server; shortcut visibility is only a presentation rule.

Draft preservation is deliberately bounded. Keeping a browser-tab draft does not itself save it to the account or send it to Alex or the client. Session storage can support a reload in that tab; the memory fallback cannot. The interface distinguishes these cases. Clear drafts on confirmed success, sign-out and an account switch. When a send response is lost, retain the draft and ask the person to check the conversation before resending; the request may have reached the server. Do not reuse another client's text when changing a coach selection, or another person's draft after sign-out.

## Verification that matters

The following checks target risks introduced by these changes rather than cosmetic implementation details:

- **Find and return:** use the task shortcuts with a keyboard, search common task words, follow an existing deep link, use browser Back, and check empty search results. Confirm that each role still has all of its permitted destinations.
- **Browse without losing place:** search and combine recipe filters, clear them, save and unsave recipes, and test a failed favourite request. Check that the visible state changes only when justified and that saved-only results remain accurate.
- **Record a real new result:** change a chart metric independently of the logging form; reuse an exercise name, enter a fresh value, and submit. Confirm the stored metric, unit, context and repetition count, including a custom activity and optional energy entry.
- **Interrupt and recover:** leave and return to a supported unfinished form, change the selected client or request, trigger a validation or network failure, then send successfully. Check that drafts stay scoped correctly, persist on failure, clear on success and are removed at the stated session boundary.
- **Coach with context:** open a client's check-in, read the accompanying context and send feedback. Confirm that the reply reaches the intended client and that no other client's draft or administrative-only content leaks into it.
- **Phone and assistive use:** inspect narrow and desktop layouts, zoom, long labels, keyboard order and focus visibility. Test dynamic status text with a screen reader and reduced motion. DOM checks alone do not establish rendered usability or accessibility conformance.

Retain the existing API, authorisation and recorded end-to-end journey checks as regression gates. Report their actual outcome separately from this design rationale.

For a small follow-up usability session, ask a client to find a quick meal, save it, record a familiar activity, pause a check-in and return to it. Ask Alex to find a waiting update and reply using the client's context. Observe completion, wrong turns, backtracking, re-entry and moments of uncertainty; ask what felt easy or frustrating. Compare equivalent tasks before and after before claiming an improvement in time, completion or enjoyment.

## Verification results

- `npm test`: 249 passed, two platform-dependent skips, zero failures (251 total).
- The recording walkthrough completed all 123 steps, plus its playback, recovery and control checks.
- `npm run test:usability`: all five suites passed against the real local server and SQLite records. Coverage includes task search without losing form text, draft recovery and account isolation, uncertain-send guidance, pending check-in locking, feedback conflicts, recipe filters and favourite retries, progress units and explicit energy, and the existing animated questionnaires.
- `npm run check` and `git diff --check` passed. No runtime dependency or database migration was added.
- DOM and CSS inspection covered the new controls, stylesheet parsing, narrow-layout rules, hidden states, focus styles and reduced motion. This is not a rendered layout check.

Rendered phone and desktop verification remains open: the available Chromium process crashed before loading a page. The pull request stays in draft pending that check. Screen-reader testing and sessions with representative users also remain open; automated results do not establish accessibility conformance or improved engagement.
