"""No-dependency editorial/data integrity checks for public Thai Pollution Atlas."""
from pathlib import Path
import json
from collections import Counter
from urllib.parse import urlparse

ROOT = Path(__file__).resolve().parents[1]
obj = json.loads((ROOT / 'data' / 'incidents.json').read_text(encoding='utf-8'))
items = obj['incidents']
registry = obj['provinces']
assert obj['dataset_version'] == '2026-11-21'
assert len(registry) == 77, 'Need all 77 provinces in the registry'
codes = [p['province_code'] for p in registry]
assert len(set(codes)) == 77, 'Duplicate province in registry'
names = [p['province'] for p in registry]
assert len(set(names)) == 77
assert all(len(s) == 2 and s.isdigit() for s in codes)
assert next(p for p in registry if p['province_code'] == '10')['province'] == 'กรุงเทพมหานคร'
assert len(items) >= 12
seen = set()
for item in items:
    for key in ('id', 'province_code', 'province', 'area', 'headline', 'status',
                'category', 'substance', 'sample_date', 'report_date', 'finding',
                'limitation', 'source_name', 'source_type', 'source_url', 'layer'):
        assert item.get(key), f'Missing {key} in {item.get("id")}'
    assert item['id'] not in seen, f'Duplicate id: {item["id"]}'
    seen.add(item['id'])
    assert item['province_code'] in codes, item['id']
    assert names[codes.index(item['province_code'])] == item['province'], item['id']
    assert item['layer'] in ('water', 'air')
    assert item['status'] in ('exceeded', 'watch', 'reported')
    url = urlparse(item['source_url'])
    assert url.scheme == 'https' and url.netloc, item['id']

pm = [x for x in items if x['layer'] == 'air']
water = [x for x in items if x['layer'] == 'water']
assert len(pm) == 57, 'Exact list of 57 DOH report provinces required'
assert len({x['province_code'] for x in pm}) == 57
assert all(x['status'] == 'exceeded' and '2568' in x['sample_date'] for x in pm)
assert all(x['source_url'] == obj['provenance']['air_2568_source_url'] for x in pm)
assert len(water) == 12
assert any(x['province_code'] == '10' for x in water), 'BKK must have evidenced water records'
for p in registry:
    assert p['air_case_count'] == sum(x['province_code'] == p['province_code'] for x in pm)
    assert p['water_case_count'] == sum(x['province_code'] == p['province_code'] for x in water)
    assert p['pm25_2568_red_list'] == (p['air_case_count'] == 1)
    assert len(p['monitoring_sources']) >= 2
print(f'Valid: {len(registry)} province directory entries, {len(pm)} historical PM2.5 entries and {len(water)} water/waste cases; {len({x["province_code"] for x in items})} provinces with at least one record')