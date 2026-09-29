# Nutrition, goals and progress

This update extends the existing local-test Node/SQLite app. It adds persistent nutrition and fitness tools; managed auth, email delivery, payments, uploads and wearable integrations remain subject to the existing configuration and limitations. Use fictional client information until launch hardening is complete.

## Client journey

1. **My profile:** choose a goal, preferred metric/imperial units, an illustrated profile character and time zone. Add food preferences, dietary requirements, training experience, equipment and availability. Height, weight targets, a maintenance range and body measurements are optional. Hide weight charts if preferred. Names and preferences persist after refresh.
2. **Recipes:** browse 132 prefilled original recipes plus Alex’s existing recipes. Search by ingredients/name; filter by meal/style or favourites. Each calculated recipe shows estimated calories, protein, carbs, fat and available fibre. Read the ingredient quantities and method, then log any fractional serving to a chosen date and meal.
3. **Food diary:** browse the date’s logged meals and totals; log individual foods by edible grams from 2,767 UK food records. Correct portions, move entries between meals/dates or remove them. Missing nutrients are marked unknown. Logging is voluntary; there are no food grades, red “over budget” warnings or exercise-calorie offsets.
4. **My progress:** record weight, waist/hips/chest/arm measurements, self-reported body-fat estimates, exercise loads/reps, distance, duration, steps, sleep or energy. Choose only what helps. View 30/90/365-day, all-time or current-goal charts. Strength series keep different exercise names and rep counts separate. Notes and an accessible data table accompany charts. Edit/delete older records through pagination.

Goal choices are wellbeing, gradual weight loss, cutting, maintaining, bulking, building muscle, strength and endurance. Suggested chart choices vary by goal, but every available metric stays selectable. Neutral summaries describe recorded changes; weight gain is never labelled proven muscle gain and weight loss is never labelled proven fat loss. “Recorded best” refers only to the selected like-for-like exercise series. Celebratory copy recognises taking notes rather than a compulsory daily streak.

## Alex’s controls

- **Plan studio → Recipes:** add recipes, edit, duplicate, archive or restore using the archive checkbox. Starter recipes remain available. Choose food entries and gram weights, edit yield/method/substitutions/tags/time, then save to recalculate nutrition. Check raw/cooked/drained states. The source food code distinguishes entries with identical names.
- To tailor a meal, **duplicate** it and select the client in “Who can browse this recipe?”. Personal copies appear only for that client. Add the copy to a meal template and explicitly publish it when appropriate. A recipe owned by another client cannot be included in a published assignment.
- **Nutrition:** choose a client/date, review their diary and set optional calories/protein/carbs/fat/fibre targets and guidance. Blank fields mean no target. No client goal automatically prescribes calorie or protein amounts.
- **Fitness progress:** review a client’s metrics and goal history.
- **Clients → Manage goals & profile:** update goals, preferences and profile settings. Server-side admin permission checks and version checks apply. Private admin notes remain separate.

## Research and product decisions

Reviewed primary/official sources on 29 September 2026. Guidance cards link to their sources in the app. These are general adult educational resources, not medical assessment or an automatic programme prescription. The following product choices are interpretations of that evidence rather than claims that the sources prescribe a software design.

| Source | Evidence used | Product consequence |
| --- | --- | --- |
| [NHS adult activity guidelines](https://www.nhs.uk/live-well/exercise/physical-activity-guidelines-for-adults-aged-19-to-64/) and [UK Chief Medical Officers](https://www.gov.uk/government/publications/physical-activity-guidelines-uk-chief-medical-officers-report/uk-chief-medical-officers-physical-activity-guidelines) | General adult guidance includes 150 minutes of moderate activity weekly and strengthening on at least two days; some activity is useful. | Movement, duration and strength can be tracked independently. Goals remain adaptable rather than enforcing a universal exercise schedule. |
| [NHS weight-loss guidance](https://www.nhs.uk/live-well/healthy-weight/managing-your-weight/tips-to-help-you-lose-weight/) and [CDC weight management](https://www.cdc.gov/healthy-weight-growth/losing-weight/index.html) | Gradual weight change, nutrition, activity, sleep and sustainable routines are emphasised; personal circumstances affect results. | A weight-loss card describes the NHS 0.5–1kg/week general guidance without making it a personal target. Charts focus on trends and recovery context, without deadlines or punishment. |
| [ACSM resistance training update, 17 March 2026](https://acsm.org/resistance-training-guidelines-update-2026/) | An overview of 137 reviews supports progressive resistance training and tailoring load/volume to goals, enjoyment and ability. Participation and consistency matter; complex techniques are not universally required. | Separate strength and muscle goals; compare exercise names and rep counts; track recovery. No required failure training, inferred 1RM prescription or compulsory equipment. |
| [ISSN protein position stand, 2017](https://pubmed.ncbi.nlm.nih.gov/28642676/) | The review describes roughly 1.4–2.0g/kg/day for most healthy exercising people, with different contexts requiring individual assessment. | Protein is a visible diary metric and an optional coach-set target. The app does not apply this population guidance as an automatic personal requirement, especially during a cut. |
| [Helms et al., energy-surplus study, 2023](https://pubmed.ncbi.nlm.nih.gov/37914977/) | An eight-week study in trained lifters compared estimated maintenance, 5% and 15% surpluses. Faster gain mainly increased skinfolds; the optimal surplus remains uncertain. The sample and study duration limit generalisation. | Bulking emphasises training plus weight/measurements together. No default large surplus or promise that rapid gain means more muscle. |
| [NIDDK Body Weight Planner](https://www.niddk.nih.gov/health-information/weight-management/body-weight-planner) | Energy planning is personalised and maintenance is distinct from reaching a target. The tool has adult/pregnancy/breastfeeding limitations. | Optional maintenance bands and editable coach targets. No simplified 3,500-calorie rule or automatic metabolic/calorie calculator. |
| [UK CoFID 2021](https://www.gov.uk/government/publications/composition-of-foods-integrated-dataset-cofid) | Government food-composition values with named preparation states, source codes and missing-data conventions. | Reproducible ingredient calculations, visible source attribution, unknown fibre preserved and no allergen-safety inference. |

The 7-calendar-day weight average is a presentation choice: it averages available observations within that window, not seven invented daily values. Sparse sampling can affect it. Raw observations remain visible. Date gaps are proportional to elapsed time. A shaded maintenance band appears only when the client/Alex sets both limits. A target line uses only an explicitly entered goal and does not calculate a deadline. Body-fat estimates are user supplied and are not treated as clinical measurements. Distance and duration are activity records; larger values do not automatically mean better fitness.

## Persistence, security and upgrades

Migrations 008 and 009 preserve existing users, recipes and assignments. A versioned content-pack marker installs the catalogue once; restarting does not overwrite Alex’s edits or resurrect removed catalogue entries. New data stays in the existing SQLite database and therefore uses its encrypted backup workflow.

Diary snapshots retain nutrition, recipe version and ingredients at log time. Assigned plan snapshots also retain the published recipe nutrition. Editing a template/library recipe does not alter either history. Legacy free-text edits clear calculated nutrition when their ingredient/portion text changes, rather than retaining stale values. Concurrency checks protect recipe, profile, metric, diary and target updates. Submission keys make diary/metric retries idempotent. Same-day metric/exercise/rep duplicates require editing the existing record.

Client queries and mutations use the authenticated user ID; supplied ownership IDs are ignored. Server routes reject clients from admin operations and prevent cross-client reads, edits and deletes. CSRF/origin/session checks apply. Export includes only the caller’s nutrition, favourites, metrics and goal history. Existing requested-account deletion cascades the new private tables and redacts/archives personalised recipe content; encrypted pre-deletion backups follow existing retention limits. No real health data belongs in local-test mode.

## Remaining scope

Barcode scanning, commercial food/recipe API feeds, automatic wearable sync, progress-photo storage, custom uploaded profile photos, medical meal planning and automated calorie prescriptions are not connected. The catalogue is a useful prefilled starting point, not an exhaustive branded-food database or 120 independently kitchen-tested dishes. Alex should review recipes and dietary needs before publishing personalised plans. No external recipe-site content or photos have been copied.

The connected daily hub, personal meal planner, kitchen mode, optional habits and additional recipes are described in [Everyday tools](EVERYDAY_RHYTHM.md).
