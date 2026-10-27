# UK food composition data

`cofid-2021.json` is an extract of **McCance and Widdowson’s Composition of Foods Integrated Dataset 2021**, published by Public Health England. Contains public sector information licensed under the [Open Government Licence v3.0](https://www.nationalarchives.gov.uk/doc/open-government-licence/version/3/). © Crown copyright 2021. No endorsement is implied.

- Publication: https://www.gov.uk/government/publications/composition-of-foods-integrated-dataset-cofid
- Workbook: https://assets.publishing.service.gov.uk/media/60538b91e90e07527df82ae4/McCance_Widdowsons_Composition_of_Foods_Integrated_Dataset_2021..xlsx
- Retrieved: 29 September 2026.
- Workbook SHA-256: `436e9445ef2adb2a75f3d7edd51302de3adad25385f9795fc94ba58bd030e97d`.
- Extractor: `scripts/extract-cofid.py`; read-only workbook processing with openpyxl. Runtime uses bundled JSON and needs no API key or Python.

The extract contains 2,767 entries from the Proximates sheet with numeric energy, protein, carbohydrate and fat. Columns are taken by their source positions; food codes, original names and groups remain available. Values are per 100g edible food in the explicitly named raw, cooked or drained state. Alcohol-containing records and excluded alcoholic-group records are omitted because alcoholic drinks have a different volume basis. Trace (`Tr`) is represented as zero for calculations. Unavailable values stay null; AOAC fibre is never replaced with zero or NSP fibre. Nutrient values are estimates and CoFID carbohydrates follow the source methodology, so calories are not reconstructed using a universal 4/4/9 formula.

Recipes are original editable assembly templates, not copies of third-party recipe text, and are not represented as recipes authored or tested by Alex. Each seeded recipe stores the source food codes and gram quantities. Nutrition is the sum of each ingredient’s per-100g value times edible grams / 100, divided by recipe yield. Displayed per-serving results are rounded to 0.1; new recipe estimates also retain unrounded per-serving values for subsequent scaling and aggregation. Daily and group totals round once after aggregation. Legacy snapshots keep their original saved precision; individual-food diary records retain per-gram precision until their quantity is applied. Added water has no macros; optional additions should be included as new ingredients or diary entries. No automatic cooking-loss, retention, allergen, or micronutrient model is claimed.


## Source validation — 27 October 2026

`scripts/validate-cofid.py SOURCE.xlsx` independently resolves named workbook
columns and compares every included row to the bundled catalogue. The source
workbook checksum above was confirmed again. All 2,767 rows and 13,835 nutrient
values match, including 278 trace values represented as zero and 1,292 unknown
AOAC fibre values retained as null. `cofid-2021-validation.json` records the hashes
and counts; the runtime audit checks that the catalogue still matches that hash.

The official workbook uses food code **13-669 twice**: roasted aubergine in
rapeseed oil and raw watercress. The original app ID now remains assigned to
watercress, preserving its existing lookup behaviour; aubergine uses the unique
app ID `cofid-13-669-aubergine-roasted`. Both retain the original source code.
This resolves the previous last-entry-wins lookup. It does not rewrite old diary
snapshots or infer which of the two foods someone intended to log previously.
Review historical records involving this code manually if necessary.

CoFID's available carbohydrate uses monosaccharide equivalents (which can exceed
100g/100g for some sugars), not the same basis as every product label. Its source
energy values are preserved. The official user guide explains the source's
energy factors; do not enforce a universal 4/4/9 reconstruction or subtract fibre
from these carbohydrate values.

Run `npm run audit:nutrition` to independently check all seeded recipes, supported
variants and portions. To inspect an existing database without changing it, run
`npm run audit:nutrition -- /absolute/path/form-fire.sqlite` (keep private output
private). This audits current recipe calculations; it cannot verify what someone
actually ate or determine the intent behind an ambiguous historical food entry.
