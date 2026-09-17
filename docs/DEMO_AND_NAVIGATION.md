# Demo access and responsive navigation

The main app and fictional demo use separate databases on ports 8085 and 8086. Browsers share cookies across ports: earlier versions used `ff_session` for both, so signing into one could replace the other session. Other ports now receive distinct session and Google callback cookie names. Port 8085 retains its existing cookie name. Origin validation, CSRF protection, administrator MFA and role/owner checks remain enforced.

The screenshot's connection error means the browser could not complete an API request. It does not establish whether the password was correct. A stopped foreground demo, a different database, stale saved credentials and competing sessions are separate problems; this release provides checks for each.

## Install after this change is merged into main

Run the existing updater, then start the demo from the updated checkout:

```bash
~/.local/bin/form-fire update
bash "$HOME/Form-Fire/termux/demo.sh" start
```

If the previous demo is still running in a foreground Termux session, press Ctrl+C in that session first. The new launcher refuses an occupied port instead of killing an unidentified process. For a different checkout location, pass its path as the second script argument.

The script installs `~/.local/bin/form-fire-demo`, remembering the exact checkout, data directory and port. With the existing Termux service supervisor, `start` creates an independent `form-fire-demo` service, verifies its health/instance and tests actual admin/client logins plus session retrieval. Failed live checks stop the service started by that command. Without the supervisor it explicitly runs in the foreground; keep that session open. Android can still terminate Termux processes.

Open `http://127.0.0.1:8086/#/login` in your normal browser and refresh the page after updating. Port 8085 uses main-app accounts. The demo uses `demo-alex@form-fire.example` for Alex and `demo-sam@form-fire.example` for the main client journey. Passwords are generated privately on your device; there is no shared default password.

```bash
~/.local/bin/form-fire-demo logins
~/.local/bin/form-fire-demo otp
~/.local/bin/form-fire-demo status
~/.local/bin/form-fire-demo stop
```

`logins` prints a saved password only if it still matches the account in that demo database. Get a fresh authenticator code immediately before entering it; the code changes every 30 seconds. All ten demo accounts are listed, including a deliberately unverified client for testing verification.

## Recover a demo login

Choose one account; recovery never targets an unidentified or deleted account:

```bash
~/.local/bin/form-fire-demo recover demo-alex@form-fire.example
```

This prints a private, one-hour recovery code for the app's Reset password screen. To have the launcher generate and save a new password directly:

```bash
~/.local/bin/form-fire-demo repair-logins demo-alex@form-fire.example
~/.local/bin/form-fire-demo otp
```

Repair changes only that identified demo account's password, revokes its sessions and outstanding password-reset codes, and preserves its authenticator, plans, requests and payment records. Replace the email with the desired address from `logins` for another demo account. Refresh the sign-in page afterward. Repeated seeding preserves existing edits and deletions. Unmarked databases and linked demo files are rejected.

## Navigation and layout

Public navigation collapses into a labelled Menu button below 1024px. The account button remains available. Client/admin sections use a collapsible picker below 1180px and a sidebar on larger screens. Both controls report their expanded state, close on navigation and support Escape with focus restored. Skip to content now focuses the main region without triggering an application route.

Phone layouts stack workspace cards and forms, keep tables inside their own scrolling container, use larger input text, and simplify the sign-in screen. Sign-in identifies the connected workspace, offers password visibility and can refresh its connection without clearing entered details. A stale CSRF response refreshes the session and asks the user to submit again; it never replays a write automatically.

## Validation and limits

Automated checks cover all ten generated account logins, administrator MFA, main/demo cookies in one shared cookie jar, stale CSRF, logout isolation, password repair, recovery codes, preserved records, repeated seeding, role/owner isolation and complete seeded client/admin journeys. Navigation tests cover menu/picker interactions, keyboard dismissal, skip-to-content, password visibility and connection refresh.

The full Node suite and four Python registry tests pass. Shell syntax is checked. The managed Termux supervisor cannot be exercised in this Linux workspace. Browser security policy blocked the local rendered preview; actual layout, zoom, touch and on-device service survival still need a phone/laptop check. Breakpoints and overflow rules were inspected in source, not visually certified.
