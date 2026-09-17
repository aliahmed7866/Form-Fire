# Decisions and launch backlog

## Decisions, 16 September 2026

- Existing target: `aliahmed7866/Form-Fire` (empty). AYCF/Admin Hub lives in `aliahmed7866/aycf-trip-planner/termux`.
- Keep FORM & FIRE separate from AYCF in source, authentication, database, configuration and process. Link it through one removable hub entry at port 8085 (existing examples use 8079–8084).
- Node 24 TypeScript server plus browser-native JS. No build step or third-party runtime dependencies makes initial Termux testing simpler. Native Node SQLite avoids Android compilation of npm database modules.
- SQLite is suitable for this single-device testing phase. A production managed relational service and identity adapter need a separate configured deployment.
- No live infrastructure credentials supplied. Implement a clearly labelled local-test identity/outbox and manual ledger. Never present these as connected managed authentication, email or provider-verified payments.
- Public copy uses only Alex's confirmed roles/personality/journey. No invented credentials, locations, testimonials, pricing or biography. Original vector illustration is not a photograph of Alex or his clients.
- Templates remain editable, assignments remain immutable snapshots. Publish a new version explicitly.
- Enquiry → approval, active service and payment are distinct. Chef confirmation requires accepted proposal and the chosen payment condition.
- Manual money uses integer minor units and independent currency totals. GBP is an editable input default, not confirmation of operating location.
- Admin TOTP is implemented for local testing. The terminal test-code convenience and local recovery outbox must not become production endpoints.

## Implemented for testing

Public home, services, about, chef enquiry, FAQs/contact route and draft policies; registration/login/verification/recovery; client profile, requests/replies/status, training/meal plan snapshots, recipes/shopping lists, weekly check-ins/feedback; admin clients/notes, services, templates/duplication/assignment, proposals and booking states; manual invoices/payments/refunds/earnings, audit metadata, client export and local deletion workflow; Termux runit install/update/backup, removable hub integration and integration tests.

## Before real onboarding

- Select and connect managed authentication, email verification/recovery, MFA enrollment/recovery and server-side identity mapping. Local roles must be migrated deliberately, never sourced from user-editable metadata.
- Move to a reviewed HTTPS deployment, production session lifecycle, stronger shared/distributed abuse protections where needed, and deployment-level secrets/backups/monitoring. Reassess data encryption and access controls for health information.
- Implement private sensitive onboarding and authorised expiring upload access if uploads are wanted. File uploads are currently absent.
- Choose hosted checkout provider. Connect hosted payment links, signature-verified webhooks, idempotent provider events, failure/cancellation/refund handling and reconciliation. No provider endpoint currently exists.
- Confirm legal location, contact details, consent/retention/deletion policies, service terms and financial record retention. The local deletion command is for fictional testing only.
- Owner review and mobile/desktop visual QA, full keyboard/screen-reader testing, contrast checks, physical Termux installation, background-process behaviour and a restore drill. No WCAG conformance claim yet.
- Consider optimistic concurrency on admin request actions across multiple devices, richer package management, explicit agreement snapshots, invoice cancellation/voiding and recipe shopping-list aggregation before expanding business operations.

## Private content checklist (do not publish placeholders)

Approved brand/name/domain; Alex-approved copy and biography; verified qualifications if to be mentioned; approved portrait/story details; final packages/inclusions/prices/currencies; operating country; chef travel area and travel charges; business contact; booking/cancellation terms; privacy/retention wording; payment provider account; hosting domain and backup owner.

## Deferred

Realtime chat, complex scheduling, wearables, community, AI meals, referrals and advanced analytics remain outside the essential release.

## Plan library update

- User requested configurable workouts, optional demonstrations, dummy starting content and equivalent meal/recipe support.
- Added schema migration 002 for exercises and library version/demo metadata; a separate local-test starter pack installs once and preserves edits across restarts.
- Workout templates store ordered sessions/exercise prescriptions. Meal templates store scheduled recipe selections and serving notes. Assignment publishing resolves full exercise/media/recipe snapshots.
- Demonstration links use validated public HTTPS URLs and open only on explicit action. No uploads, iframe embeds or remote-media fetching were added. External hosts can still change their video content.
- Original SVG/CSS two-pose illustrations provide optional local motion examples, with explicit controls and reduced-motion support. No stock footage is represented as Alex.
- Shopping lists remain authored text; automatic ingredient scaling, nutritional calculations, per-set exercise tracking and client video uploads remain out of scope.

## Daily activity update

- Added Today for the latest structured workout and meal plans on active client requests, plus Client progress for Alex. Migration 003 stores activity without rewriting existing plans or clients.
- Clients explicitly record completion, optional notes and workout effort. Records use assignment version, item type/index and local calendar date as their identity, so repeated saves cannot double-count one item. Undo deletes that record.
- Show an explicit date and named time zone. Exact weekdays recur weekly; Daily/Every day recur daily. Other schedule labels remain flexible. Allow recording from publication through today, up to 90 days back; future dates are previews.
- Ended services and replaced plan versions remain readable but cannot receive activity edits. Historical records stay tied to their original version and are included in exports and deletion.
- Admin progress reports use recorded local dates over ranges of up to 90 days. Counts describe logs, not adherence, outcomes or unique sessions across replacement versions. Admins cannot impersonate client completion.

## Visual identity update

- Retain the original textured dumbbell-and-food hero. Extend its sage, charcoal, citrus and terracotta palette through four original SVG still-life illustrations: training equipment, nourishing food, a dining place setting and a notebook with everyday essentials.
- Introduce a compact F/flame mark for the header, footer and SVG favicon. Keep the provisional FORM & FIRE name replaceable.
- Use illustrations on services, enquiries, sign-in, client overview/plans/check-ins, Today and the plan studio. These are general brand illustrations, not pictures of Alex or client-specific meals, and are not exercise technique instructions.
- Refine responsive typography, navigation, cards and form controls while retaining existing routes and workflows. Keep SVG assets local and explicitly allowlisted by the server; no image service, font CDN, extra runtime package or database migration is required.


## Exercise illustrations (v0.6)

- Extend the existing original SVG identity with 24 stylised movement illustrations, keeping the app dependency-free for Termux. Use explicit playback controls and manual poses, not autoplay.
- Group catalogue browsing by the selected movement’s primary body part. Preserve the editable category field and all existing records; unsupported/custom selections appear under Other / custom.
- Keep all new starter records labelled as examples. Alex reviews technique cues and exercise choice before client use. Technique reference checks: [NHS strength exercises](https://www.nhs.uk/live-well/exercise/strength-exercises/) and [ACE bird dog](https://www.acefitness.org/resources/everyone/exercise-library/14/bird-dog/).
- Animation IDs are saved in plan snapshots. This release deliberately refreshes the renderer of the four legacy IDs; saved exercise selection, instructions and prescription stay intact. Future technique changes should introduce a new animation ID to preserve existing selections.
- Rebuild the exercise table transactionally in migration 005 to expand its CHECK constraint while copying every existing column. A separate idempotent content pack adds 20 new examples without changing the original four.

## Google sign-in, lifestyle and admin testing

- Added opt-in Google client identity through an authorisation-code flow with PKCE, browser-bound single-use state, nonce and signature/claim verification. Migration 004 stores stable identity mappings and short-lived transactions. Email collisions never silently link accounts; Google cannot bypass admin password/TOTP. Credentials and real provider verification remain owner setup tasks.
- Added a dedicated admin-test CLI setup, current-code and recovery commands. Fictional examples are explicit, marked, idempotent and never installed on normal startup. Existing credentials and edited starter content are preserved.
- Added distinct original outdoors, rest, kitchen and movement drawings. Only small decorative details animate, on request, for 4.8 seconds; reduced motion keeps them still. No playback or lifestyle browsing becomes health/adherence data.
- Added Feel-good ideas, a gentle daily invitation, focused client/admin sign-in and in-app setup guides. Copy centres enjoyable food, accessible movement, rest and personal choice without weight targets, streaks or promised outcomes.

## Unified sign-in and security update (0.6.0)

- One public sign-in; server-verified roles choose the destination. Admin TOTP appears only after a valid admin password. Public admin/testing/setup links are removed; server authorization remains mandatory for every private operation.
- Preserve client/admin accounts and existing passwords. New password hashes use the OWASP 16 MiB scrypt profile (N16384/r8/p5); legacy hashes migrate only after complete successful authentication.
- Add AES-256-GCM backups with a separate private key, authenticated restore and no overwrite. Existing plaintext backups are not deleted automatically. Live SQLite encryption is still a production gap; file permissions and backup encryption are not a substitute.
- Keep default loopback HTTP testing on 8085. Add native verified HTTPS with owner-configured trusted certificates, strict origin/binding configuration and no silent HTTP fallback. No public deployment mode is added.
- Tighten directory/sidecar permissions, exact JSON types, request time/header limits and response policy headers. Retain parameterized SQL, MFA, CSRF, role/ownership checks and existing rate limits; add explicit attack regression tests.
- A phone fetch failure was reported but not reproduced. Add actionable connection feedback and read-only retry; do not claim that network connectivity was repaired on a device we cannot inspect.

## Expanded exercise library (v0.7, integrated into main)

- Increase the catalogue to 40 movements with 16 additional starter examples, retaining existing exercise IDs and selection snapshots. Keep migration 005 immutable and add migration 006 for the larger animation CHECK constraint.
- Use separate content-pack markers so upgrades preserve existing edits, archives, removed examples and client assignments. Exercise examples still require Alex’s review before client use.
- Separate the original catalogue, expansion catalogue and renderer into local scripts. The application remains dependency-free; no external animation service is used.
- Add manual movement-position controls and quarter-speed playback, accessible status messages for intentional actions, and a single active guide to reduce competing motion and phone rendering work. Reduced motion keeps manual inspection available.
- Refine grounded foot pivots, equipment contact, joint paths and viewing labels in the existing artwork. Catalogue geometry and the visual renderer are illustrative; written prescription and technique review remain with Alex.
- Initially published on `codex/exercise-animation-library` at the user’s request. Commit `b940f94` is already included in `main`; the 17 September branch review confirmed no unmerged feature changes or conflicts. The retained feature branch is synchronised forward after validation, without rewriting history.

## 0.8 — meal preparation and coaching inbox

- Add account-backed shopping ticks against immutable published meal-plan lines, with optimistic revisions to reject stale edits. Preserve Alex’s quantities exactly; no inferred ingredient aggregation.
- Keep shopping progress separate from activity logs and plan content. Include it in client exports and account deletion. A new assignment starts fresh, and inactive/superseded assignments reject writes.
- Separate current active plans from reference history, and route waiting clients to their existing request.
- Add signed-in client/service search and request filters for Alex. Do not put client search strings in URLs.
- Reuse the bundled illustration system and existing Node/SQLite architecture. No dependency or port change.
- Remaining gate: rendered desktop/mobile and physical Termux checks. See ENRICHMENT.md for the executed checks and browser limitation.
