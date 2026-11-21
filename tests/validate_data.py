"""No-dependency validation for Thai Pollution Atlas editorial incidents."""
from pathlib import Path
import json
from urllib.parse import urlparse

ROOT = Path(__file__).resolve().parents[1]
data = json.loads((ROOT / 'data' / 'incidents.json').read_text(encoding='utf-8'))
items = data['incidents']
assert isinstance(items, list) and items, 'Dataset needs at least one case'
assert data['dataset_version'], 'Set a dataset_version'
seen = set()
for item in items:
    for key in ('id', 'province_code', 'province', 'area', 'headline', 'status',
                'category', 'substance', 'sample_date', 'report_date', 'finding',
                'limitation', 'source_name', 'source_type', 'source_url'):
        assert item.get(key), f"Missing {key} in {item.get('id')}"
    assert item['id'] not in seen, f"Duplicate case id: {item['id']}"
    seen.add(item['id'])
    assert item['status'] in ('exceeded', 'watch', 'reported'), item['id']
    assert len(item['province_code']) == 2 and item['province_code'].isdigit(), item['id']
    url = urlparse(item['source_url'])
    assert url.scheme == 'https' and url.netloc, item['id']
print(f'Valid: {len(items)} incidents across {len(set(i["province_code"] for i in items))} provinces')
