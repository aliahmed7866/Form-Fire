# UK food composition data

`cofid-2021.json` is an extract of **McCance and Widdowson’s Composition of Foods Integrated Dataset 2021**, published by Public Health England. Contains public sector information licensed under the [Open Government Licence v3.0](https://www.nationalarchives.gov.uk/doc/open-government-licence/version/3/). © Crown copyright 2021. No endorsement is implied.

- Publication: https://www.gov.uk/government/publications/composition-of-foods-integrated-dataset-cofid
- Workbook: https://assets.publishing.service.gov.uk/media/60538b91e90e07527df82ae4/McCance_Widdowsons_Composition_of_Foods_Integrated_Dataset_2021..xlsx
- Retrieved: 29 September 2026.
- Workbook SHA-256: `436e9445ef2adb2a75f3d7edd51302de3adad25385f9795fc94ba58bd030e97d`.
- Extractor: `scripts/extract-cofid.py`; read-only workbook processing with openpyxl. Runtime uses bundled JSON and needs no API key or Python.

The extract contains 2,767 entries from the Proximates sheet with numeric energy, protein, carbohydrate and fat. Columns are taken by their source positions; food codes, original names and groups remain available. Values are per 100g edible food in the explicitly named raw, cooked or drained state. Alcohol-containing records and excluded alcoholic-group records are omitted because alcoholic drinks have a different volume basis. Trace (`Tr`) is represented as zero for calculations. Unavailable values stay null; AOAC fibre is never replaced with zero or NSP fibre. Nutrient values are estimates and CoFID carbohydrates follow the source methodology, so calories are not reconstructed using a universal 4/4/9 formula.

Recipes are original editable assembly templates, not copies of third-party recipe text, and are not represented as recipes authored or tested by Alex. Each seeded recipe stores the source food codes and gram quantities. Nutrition is the sum of each ingredient’s per-100g value times edible grams / 100, divided by recipe yield. Per-serving results are rounded to 0.1; individual-food diary records retain per-gram precision until their quantity is applied. Added water has no macros; optional additions should be included as new ingredients or diary entries. No automatic cooking-loss, retention, allergen, or micronutrient model is claimed.
