# Alex’s admin guide

Use fictional data while the local-test banner is displayed. Create a unique admin with the terminal command in the README; there are no shared default credentials. Sign in with your password and TOTP authenticator code. Ordinary signup cannot create administrators.

## Try the panel with examples

Run `~/.local/bin/form-fire admin setup-admin-test` in Termux, then use the regular **Your space → Sign in** form. After the server verifies your admin password it shows the authenticator field, and successful verification opens your admin tools. There is no separate public admin link. The dedicated email is `admin-test@form-fire.example`; its unique password and authenticator key are printed only on first creation. `~/.local/bin/form-fire admin read-test-otp` gives a current local test code. Normal password + TOTP checks remain mandatory.

The command explicitly adds Example · Jamie with a pending request and Example · Sam with an active service and welcome check-in. Unedited starter plans are copied into Sam’s assignments when available; archived or changed starter content is left alone. There are no sample payments or invented progress results. Repeating setup preserves all credentials and edits, and does not recreate deleted examples.

For recovery, `~/.local/bin/form-fire admin recover-admin-test` creates a one-use, hour-long password reset code. Enter it on Reset password; this changes the password only when submitted and keeps the existing authenticator. Commands refuse to repurpose an unrelated account with a reserved example email.

Open **Setup & testing** for the admin walkthrough and optional Google connection guide. Google sign-in is for clients; it cannot create or enter an admin account.

## Coaching

- Open Requests. Move a submitted request to **under review**.
- Reply with any questions and choose **awaiting client response**. A client reply returns the request to **under review**.
- Approve or decline after reviewing. Approval alone does not activate service or imply payment.
- For an approved coaching request, record the agreed package/onboarding note, choose **Activate service**, and save.
- In Plan studio create a template. Training guidance should include exercises, sets/reps, weekly structure and appropriate instructions. Meal guidance should include meals, portions, ingredients and preparation, with a shopping list and substitutions. Recipes can be created separately and included in templates.
- Choose the active request, a template and any client adjustments, then **Publish new client version**. Repeat for other clients as needed. Published copies include recipe snapshots. Changing a template or recipe does not change prior assignments.
- Check-ins are one per Monday-based week for clients with active services. Feedback is private to that client. Optional measurements may be omitted.
- Client admin notes are private and excluded from client API responses and exports. Do not copy private notes into replies or plans.

## Plan studio: exercises, workouts and food

The **Plans**, **Exercise library**, **Recipes** and **Publish to clients** tabs separate reusable content from client assignments. Search by name in each library. Use Duplicate to start a variation, then save it with its own title. Archive hides an item from new selection while preserving history.

### Exercises and videos

Create an exercise with a name, category, equipment and coaching cues. Attach a complete HTTPS video URL and a written summary. Share only videos you own or have permission to use. YouTube/Vimeo pages and hosted video-file links open in a new tab; file uploads and embedded playback are not implemented. Video changes on the remote host remain outside the app’s control.

Choose from 40 built-in movement illustrations across nine body-part groups, or choose No animation. The exercise editor updates its preview immediately as you change the movement. Use Play/Pause, half- or quarter-speed, Show next pose, and the position slider to inspect any point in the movement. Dragging the slider pauses playback; Play continues from the selected position. Reduced-motion preferences keep motion still while preserving manual pose changes. These are stylised illustrations for your review; keep the selected movement consistent with the exercise and written cues. They are not videos of Alex or professional technique assessments.

Use the **Body part** filter and name/equipment search together to find an exercise. The library shows an illustrated preview for every supported movement. You can also preview an exercise inside a workout session before saving the template. Clients see the selected animation in published plans and Today. New client versions still require explicit publication.

### Configuring a workout plan

1. Create a training plan or duplicate the starter week.
2. Add a workout session. Enter its day/week label and session name.
3. Add exercises from the library. Set sets, reps or duration, rest in seconds and individual notes.
4. Use arrows to reorder sessions/exercises. Remove unwanted rows. Add overall structure and guidance; save the template.
5. In Publish to clients, choose an active request, the template and client-specific adjustments. Publish a new version when ready.

To prescribe different sets or exercises for one client, duplicate and customise the template first. Client adjustments are additional text; they do not automatically modify structured prescriptions.

### Configuring a meal plan

1. Add or adapt recipes with ingredients/quantities, recipe yield, preparation and substitutions.
2. Create a meal plan. Add scheduled meals with a day/week label, meal name, recipe and serving notes.
3. Add a shopping list checked against the intended servings. The app does not calculate/scale ingredient quantities, nutrition or allergen safety automatically.
4. Save, then publish as above. Scheduled recipes are included automatically; Additional recipe collection can include extras.

### Starter examples and stable client versions

The update installs 40 exercises, three recipes and two sample plans once, only in local-test mode. All are marked Starter example. They are fictional starting points for editing, not client-ready prescriptions or confirmed Alex recipes. They are never automatically assigned. Existing client plans remain unchanged by the upgrade.

The starter label propagates into published snapshots if a template or any included exercise/recipe remains marked. Once you have replaced/reviewed an item, you can clear its label in its editor. Archiving examples is safe: restarting does not restore them. An archived exercise or recipe must be removed/replaced in a template before a new client version can be published.

Saved exercise/recipe/template editors check versions and reject stale edits from another session. Refresh to load the current version. Published plan content is independent of future library edits; past assignments remain accessible even after an item is archived.

## Today and client progress

The client’s Today tab uses the newest published training and meal version for each active request. Give sessions and meals exact weekday labels such as `Monday` for a weekly recurrence, or `Daily`/`Every day`. Labels such as `Day 1` or `Week 1 Monday` remain flexible; no start date or programme progression is inferred. Clients can deliberately log an item on a different day without changing its plan.

Clients choose the displayed date and IANA time zone, for example `Europe/London`. They can log on or after publication, through the current local day, up to 90 days back. Future days are previews. Workout effort (1–5) and notes are optional. Saving a note also logs the item; Undo removes it. Each item can have one log per calendar day and published version. No wearable or video-playback completion is inferred.

Open **Client progress** and choose a range of up to 90 days to see counts and the clients’ notes, including the recorded dates/time zones. These are self-reported records, not an adherence score. Administrators cannot add or edit client logs. Clients without records still appear with zero counts.

Publishing a new version or ending a service makes previous items read-only for activity tracking; their records remain in history and client export. A replacement version has its own tracking records. Avoid treating multiple version records as unique exercise sessions without reviewing them. Client exports include all retained activity, even beyond the interactive reporting window.

## Services

Create, edit, publish, unpublish or archive a service. Leave price empty for enquiry-only pricing. Record only confirmed prices. Archive preserves request history. No prices or client success claims are invented.

## Private dining

1. Review date, named time zone, location, guest count, occasion, indicative budget, currency, dietary requirements and notes.
2. Review and approve the request. Send a proposal describing menu, event/date/location, travel and total price.
3. The client accepts in their portal. Accepted proposals cannot be silently edited. For revisions, cancel and begin a new enquiry/proposal.
4. If full payment is required, create an invoice matching the accepted proposal's exact currency and amount, then record the payment.
5. Confirm the booking separately. Cancellation does not automatically issue a refund; record refunds explicitly.

## Money

Invoices are created against approved requests. Use a descriptive agreed package and correct currency. Amounts in forms are major currency units (for example 25.00); the server stores whole minor units.

Record manual payments or refunds with the bank/provider reference. A repeated submission key cannot double-count. You cannot record more than the invoice balance or refund more than payments received. Paid revenue, refunds, net receipts and current outstanding invoices are separate. Net receipts are **not profit**. Currencies are never combined.

A refund does not automatically reopen an invoice balance: the report retains original amount, gross payments and refunds separately. If further payment is agreed, create a new invoice. Period reports use UTC transaction dates. Proposed work is excluded. Hosted checkout/payment links are not configured.

## Test accounts and recovery

`form-fire admin outbox` reads verification and reset messages locally. No message is sent externally. Use the reset screen for password recovery; resetting invalidates existing sessions but does not remove admin TOTP.

An expired verification code can be reissued from the **Resend verification** action on the verification screen. Recovery codes can be reissued on Forgot password. Outbox records are removed when their code is redeemed. Never expose the outbox or CLI over a public web route.

## Export and deletion

Clients can download their own JSON export from My profile and submit a deletion request. Account requests are listed in admin Clients.

For fictional local test data, process a requested deletion:

```bash
~/.local/bin/form-fire admin delete-requested-account client@example.test
```

This requires an existing deletion request, creates a backup, then removes that client's records, including activity, invoices and payments. The backup retains the old data: remove it according to your testing needs. Do not use this test deletion flow for real financial records. Agree legal retention and identity-verification procedures before live use.

## Shopping lists and request triage (0.8)

Write one item per line in a meal template’s shopping list and check quantities against the agreed servings before publishing. Clients can tick items, download a text copy and reset their ticks for a new shop. Published lists stay attached to their exact client plan version; publishing a new version starts a fresh checklist.

Use **Requests** to search client/service names and filter by status or coaching/private dining. The summary shortcuts separate requests ready for review from those awaiting a client response, and show check-ins still needing feedback. Current client plans now exclude paused services; older versions remain accessible under **Previous plans & paused services**.
