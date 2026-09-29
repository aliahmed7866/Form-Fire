"""Rebuild the bundled food catalogue from the official CoFID 2021 workbook.

Data preparation only: Python/openpyxl are not needed to run Form & Fire.
Usage: python scripts/extract-cofid.py /path/to/cofid.xlsx
"""
import json
import sys
from pathlib import Path
import openpyxl

def number(value):
    if value == 'Tr':
        return 0
    if value is not None and str(value).replace('.', '', 1).isdigit():
        return float(value)
    return None

workbook = openpyxl.load_workbook(sys.argv[1], read_only=True, data_only=True)
foods = []
for row in list(workbook['1.3 Proximates'].values)[3:]:
    if not row[0] or any(number(row[i]) is None for i in [9, 10, 11, 12]):
        continue
    # Alcoholic beverages have a different mass/volume basis. Leave them out.
    if (number(row[23]) or 0) > 0 or str(row[3]).startswith('OA'):
        continue
    foods.append(dict(id='cofid-'+row[0], name=row[1], group=row[3],
                      kcal=number(row[12]), protein_g=number(row[9]),
                      fat_g=number(row[10]), carbs_g=number(row[11]),
                      fibre_g=number(row[25]), source_code=row[0], basis='100g'))
destination = Path(__file__).resolve().parents[1] / 'data-sources/cofid-2021.json'
destination.write_text(json.dumps(foods, separators=(',', ':')))
print(f'Extracted {len(foods)} foods to {destination}')
