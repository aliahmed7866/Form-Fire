# Automatic screen-recording tour

The recording player performs 123 scripted steps in the working app, alternating between a visitor, Sam (client), Alex (administrator) and Robin (another client). It uses visible links and navigation menus where available, opens disclosure sections, types text gradually, submits actual forms, checks saved results and describes the current action. Brief actor/chapter cards explain when the story moves from Sam to Alex or to an alternative example. The controls can stay hidden throughout playback. Start your phone's screen recorder yourself, then press **Play tour**.

## Pull and launch

Until this branch is merged:

```bash
cd "$HOME/Form-Fire"
git fetch origin
git switch feature/natural-recording-tour
git pull --ff-only origin feature/natural-recording-tour
bash termux/record.sh
```

After merge, use `main` instead of `feature/natural-recording-tour`. Git will stop if local edits conflict; preserve those edits before switching. The launcher requires Node 24 or later and no npm installation. Desktop users can run `npm run record`.

The launcher opens **http://127.0.0.1:8088/?record=1** with `termux-open-url` when available, and prints the same address if you need to open it manually. Keep Termux running. Start screen recording, return to the browser, and tap **Play tour**. Recording the video is handled by your device, not by the app.

- **Pause** pauses at action boundaries; an in-flight save may finish.
- **Next step** runs one step while paused.
- **Speed** offers half, normal and double speed. Start with normal for readable captions.
- **Hide panel** removes the full presenter and its large page spacer while playback continues. Only a small **Tour · step/123** button remains; tap it to restore the controls. The hidden preference is remembered for this take in the tab. Errors bring the panel back so the reason for stopping stays visible.
- **Tap cues** show a ring on the exact button, checkbox or field being used, with a short label such as “Tap · Save” or “Fill · Goals”. The player pauses briefly on the cue before acting. Cues stay visible with the panel hidden and never intercept taps. They name controls without repeating entered values or passwords. Reduced-motion settings use a static marker instead of the tap animation. Page changes and inspections retain the existing page/section highlights; they do not pretend a navigation link was tapped.
- **Check connection** verifies the recording server and take ID. A failure before a save unlocks Play/Next. At **Make the profile personal**, it can also read the server profile and compare every intended field: if the saved result matches, it completes that step without another PUT. A mismatch or a different take stays blocked. Other uncertain writes require a fresh take.
- **Coverage** lists completed, failed and unrun steps, plus remaining manual checks. Its downloadable JSON includes actor roles, navigation counts and the last failed request’s method/path, code and timeout flag; it omits query strings and form values. It identifies a confirmed profile recovery separately.

Switching away from the browser or interacting with the app pauses playback. Return to the current tour screen before resuming. Reloads between completed steps retain progress within the same browser tab. Reloading during a step blocks replay because the save may already have happened; the profile step can use the read-only confirmation described above. An older tour’s saved step numbers are not reused after a tour update: start a fresh take.

For another recording, stop the server with **Ctrl+C**, then run `bash termux/record.sh` again. Each launch creates a new take. Connection failures before any attempted save can recover through Check connection. Other failures, unconfirmed writes and interrupted older-player takes require a fresh take. Recording reads have a ten-second timeout per attempt and one retry; writes have one attempt only. Playback checks the take before starting, and the server rejects requests carrying a different take ID.

## If any step says it cannot reach the app

The loaded page does not prove the server is still running. The older player permanently blocked even a failed read and suggested restarting the normal app. The fixed player checks the recording connection and reports the correct port and command.

For example, “Make the profile personal” can stop while loading the profile, before its Save button is used. If the error says **No save was attempted**, check the same server and resume through **Check connection → Play tour**. If a save may have happened at this particular profile step, Check connection can confirm the intended server result before moving on, without resubmitting it. The step name alone does not establish a problem with profile saving, and the browser error cannot identify why the server stopped responding. If it recurs, preserve the Termux status output and the Coverage JSON so the failed request can be identified.

Keep the recording Termux session open. From a second Termux session, run:

```bash
cd "$HOME/Form-Fire"
bash termux/record.sh status
```

For a custom port, prefix the status command with the same `FF_RECORD_PORT` value. Status is read-only, prints no credentials, and exits unsuccessfully if the server is down or the port belongs to an ordinary app. If it reports reachable, return to the browser and press **Check connection**, then **Play tour**. If the server stopped, launch a fresh take and reload the printed URL. A take blocked by the older player should also be replaced with a fresh take after updating.

The launcher requests `termux-wake-lock` when available, checks readiness and prints recovery instructions. When finished, run `termux-wake-unlock` once you no longer need Termux kept awake. This is best effort: it does not prevent every Android process kill. If Termux reports that its process was killed, allow background activity in its Android battery settings and try a fresh take. Do not close the recording Termux session while recording. See [Termux’s Android process notice](https://github.com/termux/termux-app/blob/master/README.md) and [the keep-awake command source](https://github.com/termux/termux-tools/blob/master/scripts/termux-wake-lock.in). The reported browser error alone does not establish that Android killed the process.

## Data and access

Each take uses its own private directory under `~/.local/share/form-fire-recordings/take-*`, random fictional account passwords, and a fresh SQLite database. The launcher ignores the normal app data-directory setting. It does not change the installed app database or reset earlier takes. The normal app and complete demo can continue on their own ports.

Recording mode binds only to `127.0.0.1`, forces password-only local testing, and disables configured Google/TLS integrations for this isolated server. Its recording configuration endpoint exposes only that take's fictional credentials. Normal app instances return 404 for the configuration and presenter assets. Normal role, ownership, CSRF and validation rules still apply.

All people, messages, progress, invoices, payments and refunds in the tour are fictional. No money moves. Confirmation prompts for scripted fictional actions are accepted by the player. Do not enter personal information into a recording take or expose its server through a tunnel.

Optional settings: `FF_RECORD_PORT=8090 bash termux/record.sh` uses another free port; 8085 and 8086 are rejected. `FF_RECORD_ROOT` chooses the parent directory for new takes. An occupied port causes an error before another take is created. Saved takes remain until you deliberately remove the relevant recording folders.

## Coverage and limits

The tour covers the implemented feature families and representative create/edit/delete workflows. It includes client registration, coaching conversations and activation, versioned training/meal plans, exercise playback and timers, movement journal, recipes and dietary adaptations, group meals, kitchen/planner/shopping/diary, metrics/goals/habits, check-ins and Alex's review tools, library editing, chef booking, manual invoices/payments/refunds, privacy requests and export preview.

It does not claim to exercise every possible input, error, animation frame or security boundary. Google OAuth, real email delivery, hosted payments, uploads and wearables remain disconnected or require external configuration. Password recovery codes/reset, browser download dialogs, external video providers, install/update, encrypted backup/restore and actual account deletion need separate manual or terminal checks. The recording shows applicable entry points and reports these limits; it does not pretend they succeeded. Export data is previewed without interrupting the recording with a download dialog.

## Development rehearsal

The normal test suite checks fresh-data isolation, fixture validation, asset/configuration isolation, authentication and launcher behaviour. `scripts/test-recording-dom.mjs` additionally runs every step against the real server and frontend DOM, then checks presenter controls. It requires optional development-only `jsdom@30.1.1`; the app and phone launcher do not require it.

```bash
npm install --prefix ../recording-test-tools jsdom@30.1.1 --no-audit --no-fund
FF_JSDOM_MODULE="$(cd ../recording-test-tools && pwd)/node_modules/jsdom/lib/api.js" node scripts/test-recording-dom.mjs
```

This DOM rehearsal checks actual forms, events and persisted results. It does not verify rendered browser layout, physical Android playback or the phone screen recorder. Check the first few steps on your device before making a full video.

Version 0.16.0 verification (1 October 2026, London time; Linux / Node 24.19.0): all 123 workflows and existing presenter/recovery checks passed. Focused tests reproduced a dropped profile response after the write and a failed request before the write; only a matching saved profile unlocked continuation, and no recovery wrote the profile again. Changed takes stayed blocked. A 390px-width DOM rehearsal of onboarding used five main-menu taps, two section-menu taps and 14 links, with no direct route jumps. All 23 focused Node tests and application syntax checks passed. Browser visual verification remains outstanding because the cloud browser could not open the local preview; the phone's original server interruption is not diagnosed by these tests.

## How the story plays

The main client journey includes discovering the services, joining, reopening a saved profile, a coaching conversation, Alex publishing plans, choosing today’s workout, a rest timer and workout note, then food discovery, adaptations, planning, shopping, the complete cooking method and the eaten-portion diary. Progress, optional habits and check-ins lead into Alex’s review and Sam reading the reply.

Later chapters cover Alex’s library administration, a separate private-chef enquiry through proposal/payment/confirmation, and explicitly labelled cancellation, refund, correction, privacy and account examples. Existing feature families remain covered. The full cooking method is an accelerated UI demonstration; it does not cook food, run the real preparation time or certify safety.

Public pages and saved results get reading pauses. Text fields fill in short increments; passwords remain masked. Menus, links and disclosure summaries are actually activated. A saved filtered/detail view without an available link may still open directly; Coverage records link and direct navigation counts for the current page session rather than implying that every transition was a tap.

The full tour is intentionally longer. Use Normal speed for a readable recording, Quick for a rehearsal, and Pause whenever needed. Dismiss any browser-owned Save password prompt yourself; page scripts cannot control the browser’s password manager. No real password should be saved from these disposable fictional accounts.

## Step inventory

The following list is generated from `public/showcase-scenario.js`; the in-app Coverage report records what actually ran.

| Step | Chapter | Role | Action | Type |
| --- | --- | --- | --- | --- |
| 1 | Welcome | visitor | Welcome to Form & Fire | view |
| 2 | Welcome | visitor | Coaching and combined services | view |
| 3 | Welcome | visitor | Meet Alex | view |
| 4 | Welcome | visitor | Private dining enquiries | view |
| 5 | Welcome | visitor | FAQs and contact | view |
| 6 | Welcome | visitor | Feel-good ideas and illustrations | view |
| 7 | Welcome | visitor | Privacy and service terms | view |
| 8 | Welcome | visitor | Train / Eat / Both | live |
| 9 | Welcome | visitor | Service terms | view |
| 10 | Join | visitor | Create a client account | live |
| 11 | Join | client | Sign in as Sam | live |
| 12 | Join | client | Make the profile personal | live |
| 13 | Join | client | Reopen the saved profile | live |
| 14 | Coaching | client | Ask for training and food support | live |
| 15 | Coaching | client | Read the submitted request and its history | live |
| 16 | Coaching | client | Add a note to the conversation | live |
| 17 | Coaching | admin | Alex’s work queue | view |
| 18 | Coaching | admin | Start reviewing the request | live |
| 19 | Coaching | admin | Alex asks a useful question | live |
| 20 | Coaching | client | Sam reads Alex’s question | live |
| 21 | Coaching | client | Sam replies | live |
| 22 | Coaching | admin | Alex reads Sam’s availability | live |
| 23 | Coaching | admin | Approve, then activate separately | live |
| 24 | Plans | admin | Publish a training programme | live |
| 25 | Plans | admin | Publish a meal plan | live |
| 26 | Plans | admin | Edit a template without changing the client copy | live |
| 27 | Plans | admin | Explicitly publish the revised version | live |
| 28 | Training | client | Sam sees current and previous plans | view |
| 29 | Training | client | Choose today’s next workout | live |
| 30 | Training | client | Open the complete programme | view |
| 31 | Training | client | Explore movement cues and animation | live |
| 32 | Training | client | Use the optional rest timer | live |
| 33 | Training | client | Record a workout and a note | live |
| 34 | Training | client | Return to the saved workout log | live |
| 35 | Training | client | Record everyday movement | live |
| 36 | Training | client | Correct an activity record | live |
| 37 | Training | client | Weekly activity and eight-week history | view |
| 38 | Food | client | Search and filter the recipe catalogue | live |
| 39 | Food | client | Read the recipe before choosing it | live |
| 40 | Food | client | Save a favourite | live |
| 41 | Food | client | Browse favourites | view |
| 42 | Food | client | Preview vegetarian substitutions | view |
| 43 | Food | client | Check what a vegan swap changes | live |
| 44 | Food | client | Make and save a private vegan copy | live |
| 45 | Food | client | Plan a meal for tomorrow | live |
| 46 | Food | client | Move the meal to today and adjust portions | live |
| 47 | Food | client | Review the day’s planned meals | live |
| 48 | Food | client | Tick an ingredient on the combined shopping list | live |
| 49 | Food | client | Cook step by step and scale the batch | live |
| 50 | Food | client | Log only the portion Sam ate | live |
| 51 | Food | client | See the eaten portion in the diary | live |
| 52 | Food | client | Correct a diary portion | live |
| 53 | Food | client | Repeat a previous meal | live |
| 54 | Food | client | Find and log an individual food | live |
| 55 | Food | client | Review the meals logged today | view |
| 56 | Food | client | Prepare quantities for a mixed group | live |
| 57 | Food | client | Save all the group batches to the planner | live |
| 58 | Food | client | Tick Alex’s assigned shopping list | live |
| 59 | Food | client | Reset the assigned shopping checklist | live |
| 60 | Progress | client | Record optional energy and sleep | live |
| 61 | Progress | client | Record comparable strength results | live |
| 62 | Progress | client | Read the chart and underlying records | live |
| 63 | Progress | client | Change units and preserve the measurement | live |
| 64 | Progress | client | Change goals and inspect goal history | live |
| 65 | Rhythm | client | Choose optional habits | live |
| 66 | Rhythm | client | Record and undo a habit | live |
| 67 | Rhythm | client | Read the source-linked field guide | view |
| 68 | Rhythm | client | Explore a recovery idea | live |
| 69 | Check-ins | client | Send a weekly check-in | live |
| 70 | Check-ins | client | Read the saved weekly check-in | live |
| 71 | Coach review | admin | Review client workouts | view |
| 72 | Coach review | admin | Review the whole client week | view |
| 73 | Coach review | admin | Review goal-based progress | view |
| 74 | Coach review | admin | Review food and optional coaching guidance | live |
| 75 | Coach review | admin | Keep an admin-only note | live |
| 76 | Coach review | admin | Reply to the check-in | live |
| 77 | Studio | admin | Create an unpublished service | live |
| 78 | Studio | admin | Publish and then archive that demo service | live |
| 79 | Studio | admin | Create an exercise with an illustration | live |
| 80 | Studio | admin | Duplicate and archive an exercise | live |
| 81 | Studio | admin | Duplicate and tailor a private recipe | live |
| 82 | Studio | admin | Edit and archive a recipe copy | live |
| 83 | Studio | admin | Duplicate a training template | live |
| 84 | Studio | admin | Archive the spare template | live |
| 85 | Studio | admin | Filter the exercise library and inspect coaching cues | live |
| 86 | Studio | admin | Adjust a client profile from Alex’s account | live |
| 87 | Studio | admin | Open an adapted recipe in Alex’s editor | live |
| 88 | Studio | admin | Connection and testing setup | view |
| 89 | Client follow-up | client | Read Alex’s saved feedback | view |
| 90 | Client follow-up | client | Read the feedback beside the check-in | live |
| 91 | Private chef | client | Send a private chef enquiry | live |
| 92 | Private chef | client | Check the event enquiry is unconfirmed | live |
| 93 | Private chef | admin | Alex reviews and approves the enquiry | live |
| 94 | Private chef | admin | Send a fictional proposal | live |
| 95 | Private chef | admin | Create the chef invoice | live |
| 96 | Private chef | client | Sam reads the proposal before accepting | live |
| 97 | Private chef | client | Accept the fictional proposal | live |
| 98 | Private chef | client | See the outstanding invoice | view |
| 99 | Payments | admin | Record a fictional manual payment | live |
| 100 | Payments | admin | Confirm after requirements are satisfied | live |
| 101 | Payments | client | Sam sees the confirmed booking | live |
| 102 | Payments | admin | Inspect earnings by period and currency | live |
| 103 | Payments | admin | Cancel the fictional event explicitly | live |
| 104 | Payments | admin | Record the separate manual refund | live |
| 105 | Payments | client | Client sees the payment and refund history | view |
| 106 | Other request states | client | Submit a second request to withdraw | live |
| 107 | Other request states | client | Submit a meal-only request | live |
| 108 | Other request states | admin | Review and decline without activating | live |
| 109 | Other request states | admin | Pause and resume coaching | live |
| 110 | Privacy | other | Another client has a separate space | live |
| 111 | Corrections | client | Remove a movement entry | live |
| 112 | Corrections | client | Remove a diary entry without changing the recipe | live |
| 113 | Corrections | client | Remove a planned meal while retaining diary history | live |
| 114 | Corrections | client | Correct then remove an optional measurement | live |
| 115 | Account | client | Preview the client data export | live |
| 116 | Account | client | Request account deletion | live |
| 117 | Account | client | Password recovery and honest delivery status | view |
| 118 | Contact | admin | Alex configures client contact options | live |
| 119 | Contact | admin | Preview the saved contact settings | live |
| 120 | Contact | visitor | Visitors keep the enquiry option | live |
| 121 | Contact | client | Sam sees the enabled contact channels | live |
| 122 | Contact | client | Return to the in-app conversation | live |
| 123 | Finish | client | End with the client’s daily hub | view |
