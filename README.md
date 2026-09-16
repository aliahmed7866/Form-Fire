# FORM & FIRE by Alex

A working local-test app for online coaching, chef-created meal plans and private dining. Warm charcoal, bone and citrus; copy based only on the confirmed brief. FORM & FIRE is a provisional name, not a cleared brand.

**This is a testing release, not a production launch. Use fictional client information.** Data persists in SQLite. Google client sign-in is optional and requires your own OAuth credentials; it is disabled until configured. Managed authentication migration, email delivery, hosted checkout and private file uploads are not connected. Local authentication includes password hashing, verification/recovery through a private terminal outbox, server sessions and administrator TOTP. The server deliberately binds only to loopback.

## Termux: install beside AYCF and Admin Hub

Use a current Termux installation with Node 24 or later available. The installer checks for Node's built-in SQLite support. No npm dependencies, bundler, native npm module builds or Docker required.

```bash
pkg install -y git
git clone https://github.com/aliahmed7866/Form-Fire.git "$HOME/Form-Fire"
cd "$HOME/Form-Fire"
bash termux/install.sh --with-hub
~/.local/bin/form-fire admin create-admin alex@example.test
```

Open **http://127.0.0.1:8085** on that Android device. The existing Admin Hub (normally port 8079) gets a FORM & FIRE tile. Your other apps and ports stay intact.

The admin command prints a unique password and authenticator setup key once. Store them privately and add the key to an authenticator app. For fictional local tests only, `~/.local/bin/form-fire admin test-otp alex@example.test` shows the current code. This terminal convenience is not a production MFA recovery mechanism.

If AYCF/Admin Hub is not installed, use `bash termux/install.sh` without `--with-hub`. You can attach later. A custom registry path is supported via `AYCF_ADMIN_REGISTRY`; custom port via `FF_PORT` on first install.

## Try Alex’s admin panel

After updating, run:

```bash
~/.local/bin/form-fire admin setup-admin-test
```

Open **Your space → Alex’s admin sign-in**. Use `admin-test@form-fire.example` and the unique password printed in your terminal, plus its authenticator code. For a fresh test code:

```bash
~/.local/bin/form-fire admin read-test-otp
```

Setup adds two clearly labelled fictional Example clients, pending/active requests, untouched starter plan copies where available, and a sample check-in. It never adds payment figures or progress outcomes. Run it again safely: existing credentials, edits and deleted examples are preserved. Lost password? `form-fire admin recover-admin-test` prints a one-use code for the normal reset page. The in-app **Try admin** guide walks through everything; no public bypass or shared password exists.

## Google sign-in and everyday ideas

**Continue with Google** appears on client sign-in and registration. Configure your Google Cloud web OAuth client and private device credentials using [the setup guide](docs/GOOGLE_SIGN_IN.md) or the app’s **Connection setup** screen. Admin sign-in continues to require its password and authenticator. Existing password accounts are not automatically linked by email.

**Feel-good ideas** brings together movement, enjoyable food, fresh air and rest through four distinct new illustrated scenes. Choose Play for a short, gentle animation; Pause and reduced-motion support keep you in control. The ideas are optional, with no streaks, health scores or pressure. Today includes a small invitation alongside your own plan.

## Test the complete coaching journey

1. Create a client account in the app using fictional details. Registration always creates a client, never an admin.
2. Read the verification code with `~/.local/bin/form-fire admin outbox`; enter it on the verification screen and sign in. Email is not sent. Codes expire in one hour. For an expired verification code, see the recovery instructions in the admin guide.
3. Choose training, meals or both and submit a request. Drafts remain in the browser tab during sign-in. Duplicate submissions reuse one request.
4. In a separate browser session, sign in as the administrator. Open Requests → review → ask a question or approve.
5. After agreeing the package, activate the service. In Plan studio create a training or meal template (and recipes if wanted), then publish a customised client version.
6. Refresh the client's portal and open **Today**. Log a workout or prepared meal, optionally add a note/effort rating, and try Undo. Review **Client progress** in admin. Submit a weekly check-in; review and leave feedback in admin.
7. Register a second client. They cannot see the first client's requests, plans, check-ins or payments, including through direct API URLs.

Private dining has a separate enquiry, proposal, client acceptance and booking confirmation flow. Where a proposal requires payment, a matching invoice must have its payment recorded before booking confirmation. Manual entries are explicitly labelled; this is not payment-provider verification.

## Workout, meal and recipe builder

Open **Alex’s admin → Plan studio**:

- **Plans:** create or duplicate training programmes and meal plans. Add workout sessions, order exercises, and configure sets, reps/duration, rest and notes. Schedule recipes by day/meal with serving notes and a shopping list.
- **Exercise library:** create, edit, duplicate or archive exercises; add equipment, cues, an optional HTTPS demonstration-video link and a built-in illustrative motion example.
- **Recipes:** create, edit, duplicate or archive recipes with ingredients, quantities, yield, preparation and substitutions.
- **Publish to clients:** select an active client request and explicitly publish a new customised version.

Four dummy exercises, three recipes and two sample plans are added once when this update starts in local-test mode. They are labelled **Starter example**, editable, and never assigned automatically. Updating/restarting does not overwrite your changes. Remove the starter label only after replacing/reviewing that record; archive examples you do not want.

Video links open the provider in a new tab; no videos load automatically, and file uploads/video hosting are not connected. Built-in motion illustrations have play/pause and static-pose controls, respect reduced-motion settings and are not a substitute for Alex’s exercise coaching. No third-party videos or fabricated footage of Alex are bundled.

Published client plans snapshot exercise instructions, prescriptions, media URLs, recipes, serving notes and shopping lists. Editing or archiving library content never rewrites an existing assignment. Archiving a referenced item blocks new publication until the template is updated. External video files remain controlled by their host; a URL snapshot cannot preserve a removed or changed remote video.

Update an existing Termux installation with `~/.local/bin/form-fire update`, then refresh the browser. Database migrations preserve existing clients and plans. No Admin Hub change is required.

## Today and client progress

Clients can open **Today** for the latest published workout and meal plans attached to their active services. Select a calendar day, review exercises or recipes, and mark a workout done or a meal prepared. Logs persist across refreshes and restarts. Notes and workout effort ratings are optional and visible to Alex; a saved note also marks the item complete. Use Undo to remove a current log.

The week view shows recorded activity, with no streaks or adherence scores. Exact weekday labels recur weekly; `Daily` and `Every day` appear every day. Other labels stay flexible so the app does not guess a start date. The selected date and named time zone are shown explicitly; the default zone comes from the device. Future days are previews. Recording is allowed from publication through today, up to 90 days back.

**Alex’s admin → Client progress** shows client-reported counts and notes for a selected range of up to 90 days. Logs remain attached to the exact published plan version. Publishing a replacement or ending a service keeps previous logs in history and export, but those older items can no longer be edited. Clients can access only their own activity; Alex can review it but cannot record on their behalf. Client exports and account deletion include activity records.

## Artwork and interface

The original training-and-food hero is joined by four matching illustrations for training, meals, private dining and everyday check-ins. A new F/flame mark appears in the header, footer and browser tab. The artwork is bundled as small SVG files, with no external image service or font dependency.

Services, sign-in, client plans, Today and Alex’s plan studio share the same visual identity, with responsive layouts, labelled navigation and larger form controls. Illustrations are general brand artwork, not photographs of Alex, clients or a particular assigned recipe. Update with `~/.local/bin/form-fire update` and refresh the browser.

## Detach later

```bash
~/.local/bin/form-fire detach
```

This removes only the hub tile. FORM & FIRE still runs independently, with its own accounts, database and `form-fire` runit service. AYCF code, identity and data are not dependencies. Reattach with `~/.local/bin/form-fire attach`.

## Updates and controls

```bash
~/.local/bin/form-fire status
~/.local/bin/form-fire restart
~/.local/bin/form-fire update
~/.local/bin/form-fire admin backup
```

Updates are deliberate: fetch `main`, fast-forward only, run tests, restart, then health-check. A database backup is made first. AYCF's automatic deployment watcher updates AYCF only; it does **not** silently update this repository. See [operations and restore](docs/OPERATIONS.md).

## Desktop development

```bash
node --version  # 24+
npm test
python3 tests/hub_registry_test.py
npm run admin -- create-admin alex@example.test
npm start
```

Open http://127.0.0.1:8085. Read local verification/recovery codes with `npm run admin -- outbox`. Optional environment defaults are in `.env.example`; use `node --env-file=.env src/server.ts` to load a file. Never commit `.env`, databases, backups or credentials.

## Architecture

- TypeScript server on Node 24 using built-in HTTP, crypto and SQLite; browser-native JS/CSS front end with no build step.
- Versioned SQL migrations. A separate SQLite database and config directory outside the Termux checkout.
- Server-enforced roles and ownership, host/origin checks, CSRF, rate limits, safe JSON handling and escaped rendering.
- Immutable assigned plan snapshots, request transitions/history and metadata-only admin audit events.
- Integer minor-unit money records, per-currency reporting, payment/refund separation and idempotent manual event keys.
- Local testing includes a clearly labelled starter library: four exercises with optional motion examples, three recipes, one workout plan and one meal plan. Nothing is assigned automatically. No clients are seeded at startup. The explicit admin-test command adds labelled fictional examples; no testimonial, price or earnings fixtures are created.

## Verification and limitations

Automated tests cover the complete request → review → activation → assignment → client view loop, ownership/role denial, verification/recovery, admin TOTP, CSRF/origin enforcement, check-ins, stable plan versions, payment/refund arithmetic, chef booking gates, persistence after restart, and removable hub registration.

The implementation has been executed and tested on Linux/Node 24. The cloud browser blocked the local preview, so desktop/mobile visual inspection and a physical Android/Termux installation remain to be checked. This is not a WCAG conformance or production-security claim. See [test report](docs/TESTING.md) and [launch backlog](docs/DECISIONS.md).

[Admin guide](docs/ADMIN.md) · [Operations](docs/OPERATIONS.md) · [Decisions and launch checklist](docs/DECISIONS.md)
