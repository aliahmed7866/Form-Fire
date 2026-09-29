# Recipe swaps and group preparation (0.12)

## Use it

Open a recipe in Your space → Recipes and choose **Make vegan**, **Make vegetarian** or **Cook for a group**. The unchanged 132-recipe catalogue supports both styles. Meat/fish replacements can use steamed tofu, cooked chickpeas or cooked lentils. Preview every changed ingredient, the revised method and original/adapted per-serving estimates before saving a private copy. That copy works with cooking mode, the planner, favourites and the diary.

For a mixed group, enter original, vegetarian and vegan recipe servings, up to **100 in total**. Each batch has its own method and per-serving estimates. One combined ingredient list aggregates exact food IDs with the recipe yield accounted for. Download it or add the batches to your personal planner and persistent shopping checklist. These are edible raw/cooked/drained weights as named, rather than automatically converted dry weights or retail pack sizes. Larger batches require suitable equipment and cooking time; the original time is not a group cooking estimate.

**Log my portion** asks how many servings you ate, defaulting to one. It records only that quantity from the saved snapshot and marks that planned batch logged. It does not log the guests' intake or track remaining portions. Further meals can be logged or repeated from the diary. Future planned dates still cannot be logged. Recipe/diary dates share the server default of Europe/London until a profile timezone is chosen, so browser locale cannot shift an unsaved account to a different day.

Alex's Plan studio has the same previews. **Open a separate recipe draft** brings the adapted ingredients and method into the existing editor for review, recalculation and a choice of all clients or a personal client copy. Saving a draft does not publish a client assignment. Edited/custom recipes need Alex's input for substitutions; original-only group scaling still works when calculated ingredients are present.

## Swap decisions and sources

Official guidance checked on 29 September 2026. These are implementation choices informed by the sources, not clinically prescribed substitutions or claims of Alex's personal approval.

| Ingredient | Vegan swap | Vegetarian swap |
| --- | --- | --- |
| Chicken, salmon, tuna | Chosen cooked tofu, chickpeas or lentils | Same |
| Milk | Named fortified unsweetened soya drink | Retained |
| Plain yoghurt in sweet dishes | Named fortified fruit-flavoured soya yoghurt; its flavour difference is explicit | Retained |
| Yoghurt in savoury curry/wrap dressing | Mashed/blended steamed tofu with water as needed | Retained |
| Cottage cheese, boiled egg | Steamed tofu with a revised preparation method | Retained |
| Cooked egg noodles | Named cooked rice noodles | Retained |

Replacement amounts use equal **edible grams** as a starting point. They are not protein-equivalent portions. CoFID values are recalculated for each variant rather than retaining the original calories. Missing fibre remains unknown. Product values and cooking outcomes can differ. The existing source data's soya yoghurt is fruit-flavoured; it is never represented as plain yoghurt or used for a savoury cream. Recipe methods change alongside ingredients, including egg/noodle instructions and savoury dressing preparation.

- [NHS vegan diet](https://www.nhs.uk/live-well/eat-well/how-to-eat-a-balanced-diet/the-vegan-diet/): varied plant foods, protein foods and fortified alternatives; a reliable B12 source and other nutrients deserve attention beyond the macros. We show a linked educational note, not supplement dosing or an automatic nutrient-completeness score.
- [FSA vegan food and allergies](https://www.food.gov.uk/news-alerts/news/fsa-launches-campaign-highlighting-risk-of-food-labelled-as-vegan-to-people-with-allergies): a vegan label does not establish allergen absence. Product checks remain explicit; soya may be introduced, packaged foods need suitability checks, vegetarian cheese may require a rennet check, and preparation cross-contact matters.
- [CoFID source attribution](../data-sources/README.md): retain the exact named cooked/drained/fortified entries and recipe yield in calculations. Water added for texture has no macro contribution. Added stock, toppings or sauces require ingredient changes or separate logging.
- Existing [food preparation research](EVERYDAY_RHYTHM.md) supports manageable batches, safe cooling/storage, rice-specific handling and reheating. A timer alone does not establish doneness.

No automatic allergy-safe, gluten-free, clinical or nutritionally complete diet claim is made. The 132 methods are original editable catalogue material; software checks do not replace kitchen testing or Alex's review for individual dietary needs.

## Records and access

Migration 011 stores adapted-recipe provenance and mixed-group submission metadata. Client recipe copies remain private through the existing `client_id` visibility rule. Sources must be visible and unarchived; previews use actual authenticated roles. Client save endpoints require a verified client, Origin/CSRF checks and rate limits. The source version must match the preview. Unchanged catalogue version 1 is eligible for automatic methods; edited/custom methods are never overwritten by the rules.

Group recipe copies and all planned batches save in one transaction. Retry keys are owner-scoped and reject changed payloads. Retries of an already completed request return its original result, even if the source is later edited. Planned/diary snapshots remain unchanged by later recipe edits. Adapted recipes, provenance and group records are in the owner's JSON export. Actual requested-account deletion blanks and archives private recipes, then removes owner records with the existing deletion process and cascades. The pre-deletion encrypted backup follows existing retention behaviour.

## Validation and update

196 Node tests passed, with application syntax and whitespace checks. New integration coverage tests all 132 recipes × two styles × three proteins, prohibited ingredient removal, fresh calculations, savoury/sweet method differences, private visibility, roles, CSRF, invalid counts, source versions, exact yield scaling, mixed shopping quantities, retry conflicts, forced transaction rollback, 100 prepared servings versus one eaten serving, unchanged snapshots, exports and the real requested-account deletion command.

Real browser checks passed at 1440px, 390px and 320px: preview protein changes, private save, mixed 2/3/4-serving groups, ingredient download, batch planning, a 0.75-serving diary entry and Alex's reviewed drafts. Screenshots were inspected. No browser errors or horizontal overflow were observed. Physical Android/Termux testing remains a device check.

These changes are on `feature/nutrition-recipe-diary`:

```bash
cd "$HOME/Form-Fire" && git fetch origin && git switch feature/nutrition-recipe-diary && git pull --ff-only origin feature/nutrition-recipe-diary
bash termux/demo.sh stop && bash termux/demo.sh start
```

Open http://127.0.0.1:8086 and refresh. Migration runs on startup. If the repository lives elsewhere, use its actual directory before running Git commands.
