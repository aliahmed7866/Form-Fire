# Food, training and recovery: everyday tools

## What changed

The client overview now connects the next training session, their own meal ideas, optional habits and a weekly summary. Four large shortcuts lead to training, diary, meal planning and progress. The existing request, assigned-plan, check-in, payment and profile journeys remain available.

- **Meal planner:** choose a recipe from the catalogue, a date/meal and 0.25–20 servings. Edit, reschedule or remove ideas. This personal planner is separate from Alex’s published assignments. A recipe snapshot saves its method, ingredient weights, yield and estimated nutrition at planning time. Later recipe edits or archive do not rewrite a planned meal.
- **Shopping:** unlogged meals in the selected Monday–Sunday week produce one combined quantity per exact CoFID food ID. Raw/cooked/drained states remain distinct. Quantities are edible weights in the stated food state, not automatically converted retail purchase weights. Ticks persist to the account; changed quantities require a fresh tick. Alex’s assigned lists keep their existing versioned journey.
- **Cooking:** open kitchen mode from a catalogue recipe or a saved planned meal. Scale ingredient quantities by selected servings / original recipe yield, tick ingredients, follow the original method one step at a time, and view the whole method. The displayed macros describe the complete scaled batch. Changing cooking servings does not edit the planner or diary. Ingredient ticks and step position last only in the current browser page session.
- **Timer:** an optional visible timer uses elapsed clock time. It can be paused or reset; Start begins a new timer. No audio or notification delivery is connected. It is also available in Today for agreed rest periods. Time alone does not establish food doneness or prescribed rest needs.
- **Diary:** “I ate this” creates exactly one diary entry from the planned snapshot. Future planned dates cannot be logged. Client timezone is used for the current date. Removing a planner item preserves an existing diary entry. Logged items are edited in the diary, not silently changed from the planner. Deleting a diary entry does not enable an accidental second planner conversion. Recent favourites can be repeated with their original nutrition and a newly chosen portion/date/meal.
- **Recipe discovery:** quick-meal shortcuts, time filter, estimated protein/fibre order, literal comma-separated ingredient exclusions and a “pick something for me” action from current results. Unknown nutrients sort after known values. Ingredient filters do not establish allergen safety. The selected planning date carries through search.
- **Catalogue:** 12 additional original recipes with explicit methods and measured ingredients bring the calculated catalogue to 132. Multi-serving curry, noodle, pasta and lentil recipes make batch quantities meaningful. Content packs install once and preserve Alex’s edits, archives and removals on subsequent starts. These are editable editorial recipes, not claims that Alex personally approved them.
- **My rhythm:** choose any combination of movement, colourful food, preparation, wind-down and fluid prompts, including none. Taps persist with version checks; tap again to correct. No points, compulsory streaks, missed-day warnings or automatic calorie offsets. The accessible weekly table marks recorded moments only. Weekly sleep/energy averages disclose the number of recorded days; blank means no observations.
- **Field guide:** 12 short, original, source-linked guides across Food, Training, Recovery, Kitchen and Goals. Practical guidance stays separate from personalised coaching targets.
- **Alex’s admin:** Client weeks shows a selected client’s recorded week and meal ideas, with links to their diary, fitness progress and check-ins. All new client data is included in the owner’s JSON export and deleted with their account using existing deletion procedures.

## Research and decisions

Official/primary sources reviewed 29 September 2026. These choices interpret the research as product features; sources do not prescribe this UI. Guidance is general adult education. Individual clinical needs, allergies, pregnancy and age-specific activity require appropriate professional advice. We have not added automated diagnosis, medical meal plans, a calorie prescription engine or claims of proven fat/muscle change.

| Source | Product decision |
| --- | --- |
| [NHS Eatwell Guide](https://www.nhs.uk/live-well/eat-well/food-guidelines-and-food-labels/the-eatwell-guide/) | Encourage variety across a day/week, enjoyable meals, protein foods and higher-fibre starches. Preserve editable portions rather than grade individual meals. |
| [NHS fibre guidance](https://www.nhs.uk/live-well/eat-well/digestive-health/how-to-get-more-fibre-into-your-diet/) | Explain the general adult 30g/day guideline; offer a fibre-estimate sort. Missing CoFID fibre remains unknown and no target is assigned automatically. |
| [NHS salt guidance](https://www.nhs.uk/live-well/eat-well/food-types/salt-in-your-diet/) | Encourage flavour from herbs, spices, garlic and lemon; log changes to ingredients so estimates remain honest. |
| [NHS adult activity](https://www.nhs.uk/live-well/exercise/physical-activity-guidelines-for-adults-aged-19-to-64/) | Include everyday movement and adapted activity, gradual starts and a source-linked general activity reference. Do not assume step totals equal moderate/vigorous minutes. |
| [ACSM 2026 resistance update](https://acsm.org/resistance-training-guidelines-update-2026/) and [primary position stand](https://pubmed.ncbi.nlm.nih.gov/41843416/) | Support repeatable, individually tailored resistance training; distinguish strength and size signals. Do not require failure training or infer muscle gain from scale changes. |
| [NHS weight management](https://www.nhs.uk/better-health/lose-weight/) | Connect food, movement, sleep and reflection; preserve optional weight tracking and goal choices without deadlines or food punishment. |
| [NHS hydration](https://www.nhs.uk/live-well/eat-well/food-guidelines-and-food-labels/water-drinks-nutrition/) | Explain 6–8 cups/glasses as a general guide with variable needs, rather than enforce a universal litre target. Fluid prompts stay optional. |
| [NHS Every Mind Matters sleep](https://www.nhs.uk/every-mind-matters/mental-wellbeing-tips/how-to-fall-asleep-faster-and-sleep-better/) | Add an optional wind-down prompt and weekly sleep context. Do not treat a habit tick as measured sleep quality. |
| [FSA chilling/freezing](https://www.gov.uk/government/publications/how-to-chill-freeze-and-defrost-food-safely/how-to-chill-freeze-and-defrost-food-safely) | Explain small-container cooling, refrigeration within 1–2 hours, 0–5°C fridge storage and general leftovers within 48 hours or freezing sooner. The planner never promises seven days of fridge safety. |
| [FSA rice guidance](https://www.gov.uk/government/publications/home-food-fact-checker/home-food-fact-checker) | Show rice-specific handling when a recipe contains a named rice ingredient: cool ideally within one hour, fridge storage no more than 24 hours, reheat once until steaming hot. Read the complete guidance and packaging. |
| [FSA cooking](https://www.gov.uk/government/publications/cooking-your-food/cooking-your-food) | Separate timer completion from doneness; include thermometer guidance, safe reheating and separation of raw/ready-to-eat food. |
| UK CoFID 2021 (existing documented source pack) | Calculate new recipe estimates from measured edible ingredients and yield. No calories are invented and no automated allergen guarantee is offered. |

## Data and access

Migration 010 adds `planned_meals`, `habit_logs` and `planner_shopping`, all tied to their owner with deletion cascades. Mutations use the existing Origin/CSRF/session checks. Every client query/mutation scopes to the authenticated client ID; personal recipe visibility is checked before planning. Alex’s read endpoint requires the admin role and a valid client. Recipe snapshot conversion is a transaction; repeats use submission keys; edits and shopping ticks use versions. No admin note is included in these client payloads.

## Local update

These changes are on `feature/nutrition-recipe-diary`. In Termux:

```bash
cd "$HOME/Form-Fire" && git fetch origin && git switch feature/nutrition-recipe-diary && git pull --ff-only origin feature/nutrition-recipe-diary
bash termux/demo.sh stop && bash termux/demo.sh start
```

Open http://127.0.0.1:8086 and refresh. Migrations run at startup and preserve existing records. Existing email, payment, managed-auth, upload and wearable limitations remain as documented; this update does not connect external services.

## Validation

Validation on 29 September 2026: **185 tests passed**, syntax checks passed, and desktop/phone browser checks passed.

The integration suite covers client isolation, role/CSRF rejection, private recipe access, snapshot history, future logging, conversion/repeat retries, stale edits, quantity-aware shopping, habit corrections, timezone boundaries, exports and deletion. Existing coaching, auth, payments, assignments and backup tests are also run. Browser checks use disposable fictional accounts on desktop 1440px and phone 390px/320px. They cover the daily hub, planning, persisted shopping ticks, cooking portions/steps/timer, diary conversion/repeat, habits, guides and Alex’s client-week view. Visual screenshots are inspected before publication.
