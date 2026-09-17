# Meal preparation and coaching inbox — 0.8

Built from main commit `7c88119` on `feature/meal-prep-and-coaching-inbox`.

## Client walkthrough

1. With an active service and a published meal plan, open **Shop & prepare**.
2. Tick an ingredient. Reload: the tick stays saved. Clear a tick to put it back on the list.
3. Open a recipe beneath **What’s cooking?** to see its preparation, substitutions, recipe yield and personal serving notes.
4. Choose **Download list** for a text checklist, or **Start a fresh shop** to clear ticks after confirmation.
5. Open **My plans**. Latest active plans appear first; older versions and paused services remain available in a separate disclosure.

A checklist is for the whole published plan, not an automatically dated week. Each non-empty shopping-list line is a separate item, including duplicate lines. Quantities and substitutions remain Alex’s guidance; the app does not infer shopping totals, allergens, nutrition values or medical advice. Alex should write one item per line and review quantities before publishing. Empty lists explain what is missing and link to the meal plan.

## Alex’s walkthrough

Open **Requests**, search by client or service name, and combine status and service-type filters. **Ready for your review** includes submitted and under-review requests. **Waiting for a client** is separate. A third shortcut shows check-ins without feedback. Search text remains in the current signed-in page and is not stored in the URL.

Plan studio now explains how shopping-list lines become checklist items. Editing the template leaves a client’s existing list intact. Publishing a replacement starts a new checklist; ending or pausing a service removes its list from the current view and blocks further writes to that plan. Existing checklist records remain exportable until account deletion.

## Data and access

Migration 007 adds `shopping_progress`, keyed by immutable assignment ID and owned by a user. State contains purchased line indexes, a revision and an update timestamp. Reads/writes require a verified client; writes additionally validate assignment ownership, active service and latest plan version. Admins cannot tick on a client’s behalf. Parameterised queries, existing CSRF/origin protections and request-size limits apply.

Updates carry a revision. A stale tab receives a conflict instead of replacing newer work. After a failed save, the UI attempts to reload authoritative state; when it cannot, it disables further changes and asks for a page reload. Client exports include historical checklist progress. The existing account-deletion command removes checklist records through foreign-key cascades, including after its encrypted pre-deletion backup.

## Verification

Executed on Linux, Node 24.19.0:

- Baseline: all 144 existing Node tests passed before changes.
- Updated suite: **156 Node tests passed**, including authenticated HTTP tests for reads, writes, reset, cross-client denial, admin/unverified denial, CSRF/origin denial, invalid inputs, concurrent edits, restart persistence, immutable versions, template changes, inactive services, owner-only export and the actual account-deletion command.
- UI logic tests cover pending-request routing, active-plan selection, escaped shopping content, duplicate ingredient identity, combined inbox filtering, restricted accounts and preservation of recipe/serving guidance.
- All four Python hub registry tests passed.
- `npm run check` and `git diff --check` passed.

Browser visual verification could not be completed in this environment: the cloud browser did not complete navigation to the loopback preview; a local browser runtime was unavailable and its official download timed out. Desktop/mobile layout, keyboard interaction, checkbox/download controls and physical Android/Termux operation therefore still need a rendered-browser check. No screenshots or WCAG conformance claim are provided.

## Release status

Source is on a feature branch for review, not merged or deployed. No real client data was used. No port, authentication provider, payment connection or runtime dependency was changed. The current app remains a local test edition; managed auth, email delivery, hosted checkout and private uploads remain disconnected as described in the README.
