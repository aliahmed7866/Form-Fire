# Move your way — 0.13

Clients can now record everyday movement in **Move your way**, reached from the workspace menu or the overview’s training card. Alex can read those notes under **Client weeks**. Records persist in SQLite and can be corrected or removed.

## Behaviour

- Log a date, activity name, whole minutes, one activity type and optional notes. Gentle movement, moderate aerobic activity, vigorous aerobic activity and strength work stay distinct. For mixed sessions, record non-overlapping portions separately.
- The weekly summary shows recorded minutes, days with notes, strength days and each activity type. Eight weeks of history include accessible text figures and label absent weeks “No records”. Recent weeks can be incomplete. These figures describe records, not measured fitness or compliance.
- An expandable explanation uses moderate minutes + 2 × vigorous minutes to explain general adult aerobic guidance. Strength days do not prove all major muscle groups were trained. Gentle and strength minutes do not enter the aerobic equivalent. No personal target is automatically assigned.
- Existing workout completion, daily cardio metrics, steps, habits and food targets remain separate. Nothing is automatically added across these data sources, avoiding double-counting. There is no calorie-burn estimate, food compensation, streak penalty or wearable connection.
- Client dates use the saved profile timezone, defaulting to Europe/London. Future completed records are rejected. Weeks run Monday–Sunday. An activity may be moved to a different week when correcting it.
- Added source-linked field guides explain balanced plant-based swaps and why dietary labels cannot establish allergen safety. The existing recipe catalogue, swaps and catering functionality remain available.

## Research and product decisions

Official sources reviewed on 30 September 2026. These are general educational references. The UI and data decisions below are our interpretation, not a tested clinical intervention or a claim that these sources endorse the app.

| Source | Finding used | Product decision |
| --- | --- | --- |
| [NHS adult activity](https://www.nhs.uk/live-well/exercise/physical-activity-guidelines-for-adults-aged-19-to-64/) | Adult 19–64 guidance distinguishes aerobic intensity and strength; the talk test helps describe intensity. | Separate activity types, manual intensity selection, optional reference explanation and gradual-start guidance. No automatic classification from an activity name. |
| [WHO activity guidance at a glance](https://www.who.int/europe/publications/i/item/9789240014886) | Everyday transport, leisure and household activity can matter; some movement is better than none. | Include gentle and adapted movement, avoid compulsory thresholds, leave unrecorded time unknown. |
| [NHS vegan diet](https://www.nhs.uk/live-well/eat-well/how-to-eat-a-balanced-diet/the-vegan-diet/) | A varied vegan pattern needs planning, fortified foods and attention to nutrients including B12. | Add practical guidance alongside substitutions; avoid treating equal ingredient weights as equal protein or prescribing supplements automatically. |
| [FSA/GOV.UK vegan food labelling](https://www.gov.uk/understanding-food-labelling/vegan-food-labelling) | Vegan labelling does not remove cross-contamination risk. | Direct users to check labels and discuss catering requirements; recipe filters never certify allergen safety. The former FSA URL now redirects to GOV.UK. |
| [W3C form notifications](https://www.w3.org/WAI/tutorials/forms/notifications/) | Users need clear success and error feedback. | Reuse labelled forms and alert regions, preserve failed form inputs, provide saved feedback, text equivalents for weekly bars, and explicit removal controls. Visual/accessibility browser validation remains outstanding. |

## Persistence and access

Migration 012 installs on startup. No runtime dependencies, deployment requirements or port changes.

The server scopes reads and writes to the signed-in client. Only administrators can read other clients through Client weeks. Existing session, Origin/CSRF and role checks apply. Writes are rate-limited, use parameterised SQL and validate dates, lengths, types and a maximum of 1440 recorded minutes per day. This ceiling is a data-validity limit, not a recommended activity duration.

Submission keys are owner-scoped. Identical creation retries return the original ID, even after an edit; conflicting reuse returns 409. Version checks reject stale edits and removals. A removed entry cannot be recreated by retrying its old submission. Removal erases its title, notes and original payload; minimal retry metadata including date, type and duration remains until account deletion, excluded from summaries and exports. The existing requested-account deletion command removes both active records and retry tombstones. Active records are included in the client JSON export; internal retry payloads are excluded.

## Validation

- **204 Node tests passed** across the full suite, including eight new movement checks.
- New coverage: ownership and CSRF, admin read access, invalid data and dates, aggregate day limits, retry conflicts, stale versions, movement between weeks, distinct strength-day counting, aerobic equivalence, unknown weeks, reopening the database, export, real requested-account deletion and HTML escaping.
- JavaScript/TypeScript syntax and whitespace checks passed.
- **Not visually verified:** the cloud browser timed out opening the local preview. The local Playwright browser was absent and its official download failed. Desktop, 390px/320px phone, keyboard and physical Termux walkthroughs remain review gates. This is why the pull request is a draft.

## Try the branch in Termux

Commit or stash any local edits first, then:

```bash
cd "$HOME/Form-Fire" && git fetch origin && git switch feature/movement-journal && git pull --ff-only origin feature/movement-journal
bash termux/demo.sh stop && bash termux/demo.sh start
```

Open http://127.0.0.1:8086 and refresh. Sign in as a fictional client, open **Move your way**, save an activity, refresh, edit it and inspect the weekly figures. Sign in as Alex and open **Client weeks** to see the same notes. Earlier data is retained by the migration. The standard installed non-demo app remains on its configured port (normally 8085).

## Remaining work

1. Complete the rendered phone/desktop and physical Termux walkthrough above, including stale-tab error feedback and keyboard focus.
2. Keep any future activity import explicit about overlap with this journal, daily cardio totals and assigned workout ticks.
3. Existing launch blockers remain: managed authentication, real email, hosted payments and private uploads are not connected. Use fictional information in this local test edition.
