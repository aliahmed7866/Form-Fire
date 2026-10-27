# Nutrition accuracy run — 27 October 2026

## Verified scope

The official CoFID 2021 workbook was downloaded again from GOV.UK. Its SHA-256
matches the previously documented source. The independent named-column comparison
verified all 2,767 included foods and all 13,835 energy/protein/carbohydrate/fat/
fibre values. Names, source codes, groups and per-100g basis also match. The
comparison includes 278 trace values mapped to zero and 1,292 missing fibre
values kept unknown. No nutrient values were fabricated or changed to force an
energy formula to balance.

`data-sources/cofid-2021-validation.json` contains the checksums and counts.
`scripts/validate-cofid.py SOURCE.xlsx` repeats that full comparison without
rewriting the catalogue. It requires openpyxl only for this optional source audit.
The official workbook is not a runtime dependency.

## Fixed food identity collision

The source assigns code `13-669` to both roasted aubergine in rapeseed oil and raw
watercress. Both originally shared an app ID; the last row won the server lookup.
At 100g, aubergine should use 62 kcal / 3.8g fat, while watercress uses 10 kcal /
0.3g fat. Aubergine now has a unique app ID; source codes remain unchanged. Startup
rejects duplicate app IDs, and automated checks pin this particular correction.
The extractor applies the same explicit disambiguation when rebuilding the JSON.

Existing records are preserved. Previous use of the ambiguous ID cannot prove
which food the user intended: saved ingredient names may already reflect the
last-row lookup. No historical diary or assigned-plan records are automatically
relabelled or given replacement macros. The optional existing-database audit
flags current recipes involving that legacy ID for manual review.

## Fixed precision and missing-data handling

New calculated recipes retain unrounded per-serving values alongside their
rounded display values. Portion scaling, cooking batches, catering totals and
daily diary totals use available unrounded values and round once at the end.
For example, a 100g banana is 81 kcal; dividing it into seven servings displays
11.6 kcal each, but preparing all seven now gives 81 kcal rather than 81.2.

Legacy snapshots keep their original saved precision and provenance. Daily totals
are aggregated from frozen snapshot quantities rather than adding rounded UI
rows. A total can differ slightly from the sum of visible rounded rows.
Missing, invalid or non-numeric nutrients render as Unknown. A day with no logged
food says Not logged instead of implying zero intake. No automatic calorie or
macro targets are prescribed or changed.

## Easier, clearer use

Food and recipe logging show a live macro estimate for the entered grams or
servings before saving. Cooking mode uses the same precision rules. A collapsed
explanation describes the source, edible weights, raw/cooked/drained states,
recipe yield, typical-food limitations, fibre and energy methodology. It links
to the official dataset and guide. Actual brands, additions, discarded oil,
water changes and uneven serving division can differ from the model.

## Repeatable checks

`npm run audit:nutrition` builds a disposable seeded catalogue and independently
checks ingredient arithmetic for all 132 recipes, 792 supported dietary/protein
variants and 6,468 portion cases. It verifies food IDs, finite non-negative
nutrients, source hash, ingredient identities, recipe nutrition and quantity
scaling. It does not simply call the recipe calculator to obtain expected values.
The audit now runs in CI as well as in the normal test suite.

`npm run audit:nutrition -- /absolute/path/form-fire.sqlite` opens an existing
SQLite database read-only. It reports current recipe mismatches and ambiguous
legacy ingredients; it does not edit records, run migrations, print client
names or export diary contents. Run it against a current backup if the live
service is busy. Private recipe IDs or mismatch text should stay private.

New tests also cover the duplicate-food regression, fractional servings, mixed
rounding, frozen historical values, incomplete nutrients, diary aggregation and
UI/server scaling agreement across every food in the catalogue.

## Limits

Validation establishes agreement with this published dataset and arithmetic;
it does not laboratory-verify meals, certify a product label, establish allergen
safety or verify what someone ate. CoFID describes typical composition. This run
had no copy of the user's live Termux database, so no claim is made that existing
private recipes or historical logs have passed the audit. Browser rendering and
a physical WhatsApp/phone journey were not part of this nutrition verification.

Sources: https://www.gov.uk/government/publications/composition-of-foods-integrated-dataset-cofid
and its linked CoFID 2021 user guide, especially the food variability, data
formats, carbohydrate and energy sections.

Validation results: source workbook comparison reported zero mismatches;
`npm run audit:nutrition` reported zero recipe issues; `npm run check` passed;
`node --test --test-concurrency=1 tests/*.test.ts` passed 280 tests with two
environment-specific skips. A preceding parallel run hit demo-launcher seed-lock
and login errors; the complete serial run passed. Launcher code was not changed.
Rendered browser verification remains outstanding.
