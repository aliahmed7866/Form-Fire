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
- Shopping lists remain authored text; automatic ingredient scaling, nutritional calculations, exercise tracking and client video uploads remain out of scope.
