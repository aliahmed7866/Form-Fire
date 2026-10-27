"""Read-only, independent comparison against the official CoFID 2021 workbook.
Usage: python scripts/validate-cofid.py SOURCE.xlsx [--report report.json]
Requires openpyxl for this optional source audit; runtime and CI use Node only.
"""
import argparse
import hashlib
import json
import math
from pathlib import Path
import openpyxl

ROOT = Path(__file__).resolve().parents[1]
SOURCE_SHA = '436e9445ef2adb2a75f3d7edd51302de3adad25385f9795fc94ba58bd030e97d'


def numeric(value):
    if value == 'Tr':
        return 0
    if value is None or value == 'N':
        return None
    try:
        result = float(value)
    except (ValueError, TypeError):
        raise ValueError(f'Unexpected source value: {value!r}')
    if not math.isfinite(result) or result < 0:
        raise ValueError(f'Invalid source value: {value!r}')
    return result


def validate(workbook_path):
    checksum = hashlib.sha256(workbook_path.read_bytes()).hexdigest()
    if checksum != SOURCE_SHA:
        raise ValueError('Source workbook checksum changed; review before validating.')
    workbook = openpyxl.load_workbook(workbook_path, read_only=True, data_only=True)
    try:
        rows = iter(workbook['1.3 Proximates'].values)
        headers = next(rows)
        next(rows)
        next(rows)
        columns = {name: headers.index(name) for name in ['Food Code', 'Food Name', 'Group',
                   'Protein (g)', 'Fat (g)', 'Carbohydrate (g)', 'Energy (kcal) (kcal)',
                   'Alcohol (g)', 'AOAC fibre (g)']}
        expected = {}
        excluded = 0
        traces = 0
        for row in rows:
            code = row[columns['Food Code']]
            if not code:
                continue
            values = {key: numeric(row[columns[col]]) for key, col in
                      [('kcal', 'Energy (kcal) (kcal)'), ('protein_g', 'Protein (g)'),
                       ('carbs_g', 'Carbohydrate (g)'), ('fat_g', 'Fat (g)'),
                       ('fibre_g', 'AOAC fibre (g)')]}
            if any(values[key] is None for key in ['kcal', 'protein_g', 'carbs_g', 'fat_g']) or (numeric(row[columns['Alcohol (g)']]) or 0) > 0 or str(row[columns['Group']]).startswith('OA'):
                excluded += 1
                continue
            identity = (code, row[columns['Food Name']])
            if identity in expected:
                raise ValueError(f'Duplicate source code {code}')
            traces += sum(row[columns[col]] == 'Tr' for col in ['Energy (kcal) (kcal)', 'Protein (g)', 'Carbohydrate (g)', 'Fat (g)', 'AOAC fibre (g)'])
            expected[identity] = dict(name=row[columns['Food Name']],
                                  group=row[columns['Group']], source_code=code, basis='100g', **values)
        bundled_path = ROOT / 'data-sources/cofid-2021.json'
        bundled = json.loads(bundled_path.read_text())
        if len({food['id'] for food in bundled}) != len(bundled):
            raise ValueError('Duplicate app food IDs')
        actual = {(food['source_code'], food['name']): {k:v for k,v in food.items() if k != 'id'} for food in bundled}
        if len(actual) != len(bundled):
            raise ValueError('Duplicate bundled food codes')
        differences = [code for code in set(expected) | set(actual) if expected.get(code) != actual.get(code)]
        if differences:
            raise ValueError(f'{len(differences)} mismatches: {differences[:20]}')
        return dict(source='UK CoFID 2021', workbook_sha256=checksum,
                    catalogue_sha256=hashlib.sha256(bundled_path.read_bytes()).hexdigest(),
                    source_code_collisions={'13-669': ['Aubergine, flesh and skin, roasted in rapeseed oil', 'Watercress, raw']},
                    foods_compared=len(bundled), nutrient_values_compared=5*len(bundled),
                    mismatches=0, excluded_source_rows=excluded, trace_values_as_zero=traces,
                    unknown_fibre=sum(food['fibre_g'] is None for food in bundled),
                    method='Named source columns; exact values, names, codes, groups and 100g basis')
    finally:
        workbook.close()


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('workbook', type=Path)
    parser.add_argument('--report', type=Path)
    args = parser.parse_args()
    report = validate(args.workbook)
    output = json.dumps(report, indent=2) + '\n'
    if args.report:
        args.report.write_text(output)
    print(output)
