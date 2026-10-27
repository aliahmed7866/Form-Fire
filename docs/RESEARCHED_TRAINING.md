# Research-informed training programmes

Research checked 27 October 2026. This release adds usable companions to the
existing app, with provenance and saved records. It does not claim that a
particular in-app template has been clinically validated or medically approved.

## Research and product decisions

| Source | Finding and limits | App decision |
| --- | --- | --- |
| [ACSM 2026 position stand](https://pubmed.ncbi.nlm.nih.gov/41843416/) | An overview of 137 systematic reviews supports progressive resistance training for healthy adults. Prescription can affect outcomes, but complex routines and training to failure are not prerequisites. Evidence about a training principle does not validate our exact exercise sequence. | Two simple full-body foundations. Appropriate load, technique, recovery and continued participation come before complexity. No maximum-lift testing, automatic increases or failure requirement. |
| [UK Chief Medical Officers’ guidance](https://www.gov.uk/government/publications/physical-activity-guidelines-uk-chief-medical-officers-report/uk-chief-medical-officers-physical-activity-guidelines) | Population guidance combines aerobic activity and strengthening on two or more days. People should build from their current activity. Population recommendations are not individual prescriptions. | Two non-consecutive strength sessions are a starting structure, not an imposed activity score. Existing activity-journal context stays separate. |
| [NHS Couch to 5K schedule](https://www.nhs.uk/better-health/get-active/get-running-with-couch-to-5k/couch-to-5k-running-plan/) | Nine stages, three sessions each, walk/run intervals, rest between runs, and a 30-minute running endpoint. Distance depends on pace. | Numeric timings are checked for all 27 sessions, including the differing sessions in stages 5 and 6. Warm-up and cool-down walks are included. Original interface copy; independent companion with a link to the NHS audio app via the official page. |
| [Relph et al., 2023 observational cohort](https://pubmed.ncbi.nlm.nih.gov/37681822/) | In 110 people on a modified programme, 19% reported injuries and 27.3% completed. This small, single-site observational study cannot establish causation or predict outcomes for all users of the NHS app. | No injury-prevention guarantee, forced weekly advancement, punitive streak or implied failure. Repeating a session and saving partial attempts are normal options. |
| [NHS strength exercises](https://www.nhs.uk/live-well/exercise/strength-exercises/) | Practical home-movement guidance includes chair setup, controlled movement and gradual repetition increases. It is not the same routine as our template. | Original chair-squat, wall-press and calf-raise cues emphasise stable support and manageable range. |
| [ACE single-arm row](https://www.acefitness.org/resources/everyone/exercise-library/126/single-arm-row/) and [goblet squat](https://www.acefitness.org/resources/everyone/exercise-library/362/goblet-squat/) | Movement references support a stable torso during a supported row and controlled front-loaded squatting. Descriptions and images were not copied. | Short original setup cues and possible easier alternatives; Alex still reviews technique, range and equipment. Other cues remain original guidance requiring that review, not certified demonstrations. |

The six-stage duration, exercise combinations, two working sets, 8–12 repetition
ranges, 90–120 second rests, two-to-three-repetitions-in-reserve explanation and
small-change progression rule are reversible programming choices. They are not
presented as a tested named protocol or an optimal hypertrophy prescription.
Learning with fewer sets is allowed. The gym programme is a foundation, not an
advanced strength, power, rehabilitation or maximal-muscle-gain plan.

The source safety context was also checked against [NHS chest-pain guidance](https://www.nhs.uk/symptoms/chest-pain/).
The app tells users to stop for concerning symptoms and seek appropriate help;
it does not diagnose symptoms or decide that a programme is medically safe.

## What is connected

- **Train / My plans → Explore training programmes:** a 27-session walk/run
  companion, 12-session home-strength foundation and 12-session gym foundation.
- Choose any stage or revisit a session. A repeated attempt stays in history but
  does not inflate the distinct-completion count. Partial and skipped outcomes
  do not count as completed sessions. There is no time limit or automatic load
  progression.
- Running intervals have a foreground start/pause clock, explicit previous/next
  controls and a complete interval list. Hiding the page pauses the clock;
  navigating or reloading resets it. It has no background audio, GPS or distance
  measurement. Clock events never mark completion.
- Record a dated outcome, optional effort and notes. The server owns identity,
  validates the date and session, rejects stale edits and handles identical
  retries. Saved records include the programme version, session definition and
  source snapshot. Later library changes cannot rewrite those snapshots.
- **Admin → Programme records:** read one selected client’s attempts. For strength
  programmes, copying the A/B week creates a review draft in Plan studio. Copying
  is retry-safe. Alex still tailors and explicitly publishes via the existing
  active-service journey; no automatic assignment or entitlement is granted.
- These records appear in a client’s data export and are removed by account
  deletion through foreign-key cascades. Database backups retain the table.
  Migration 014 adds tables without replacing existing plans or logs.

Programme records are distinct from assigned-plan ticks, the activity journal,
fitness metrics and food targets. The app does not silently turn planned time
into completed aerobic minutes, infer intensity, subtract exercise calories or
assume an achieved 5 km distance. Alex should consider the total load across
running, strength, sport and existing assigned plans.

## Validation and remaining checks

`tests/training.test.ts` independently checks all running-session durations and
run totals, stored/repeated/partial attempts, concurrency versions, lost-response
retries, invalid dates and sessions, cross-client isolation, admin boundaries,
CSRF, export, restart persistence, account deletion and review-to-publication.
It verifies that the timer pauses and never auto-saves a completed workout.
Navigation and migration checks are extended; `npm run check` includes the new
modules. Existing macro data and arithmetic audits remain in place.

These are software checks and evidence review, not a clinical trial or observed
training results. Visual layout, screen-reader behaviour, timer behaviour on real
phones, and Alex’s technique/programming review remain necessary before offering
these companions to real clients. This implementation remains in the app’s
existing local-test deployment model.

The cloud browser could not reach the local preview server (connection refused),
so this run cannot claim a rendered phone or desktop review. The source and API
checks, timing fixtures and timer state tests are available for repeatable local
verification. The numeric source schedule was manually cross-checked against
the NHS page, not inferred from programme marketing.

Final validation: `npm run check` passed; the serial full suite passed **284 tests
with two environment-specific skips**. A further 26 focused checks passed after
the final navigation, query-escaping and no-client admin-library refinements.
The nutrition audit still reports zero issues across its 6,468 portion checks.
