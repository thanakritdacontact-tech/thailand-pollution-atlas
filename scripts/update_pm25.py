"""Fetch all 77 GISTDA province PM2.5 readings at Pages build time.

The web client reads the generated same-origin JSON. Never publish a partial or
stale province dataset as "latest". No secrets/third-party Python deps.
"""
from __future__ import annotations

import json
import math
from datetime import datetime, timezone
from pathlib import Path
from urllib.request import Request, urlopen
from zoneinfo import ZoneInfo

ROOT = Path(__file__).resolve().parents[1]
API_URL = 'https://pm25.gistda.or.th/rest/getPm25byProvince'
DEST = ROOT / 'data' / 'pm25-latest.json'


def validate_and_reformat(body: dict, clock: datetime | None = None) -> dict:
    clock = clock or datetime.now(timezone.utc)
    province_registry = json.loads((ROOT / 'data' / 'incidents.json').read_text(encoding='utf-8'))['provinces']
    province_by_code = {int(p['province_code']): p['province'] for p in province_registry}
    data = body.get('data')
    if body.get('status') != 200 or not isinstance(data, list) or len(data) != 77:
        raise ValueError('GISTDA response missing 77 readings or status != 200')
    got = set()
    cleaned = []
    for raw in data:
        code = int(raw['pv_idn'])
        if code not in province_by_code or code in got:
            raise ValueError(f'Invalid/duplicate province code {code}')
        got.add(code)
        if raw.get('pv_tn') != province_by_code[code]:
            raise ValueError(f'Mismatched official province name: {code} {raw.get("pv_tn")}')
        vals = []
        for k in ('pm25','pm25Avg24hr'):
            value = raw[k]
            if isinstance(value, bool) or not isinstance(value, (int,float)) or not math.isfinite(value) or not 0 <= value < 2000:
                raise ValueError(f'Invalid {k} reading {code}')
            vals.append(round(value,2))
        cleaned.append({'pv_idn':code,'pv_tn':raw['pv_tn'],'pm25':vals[0],'pm25Avg24hr':vals[1]})
    if got != set(province_by_code):
        raise ValueError('Not all official 77 provinces supplied')
    stamp = body.get('datetimeEng') or {}
    raw_date = stamp.get('dateEng','')
    raw_time = stamp.get('timeEng','')
    try:
        sampled_local = datetime.strptime(f'{raw_date} {raw_time}', '%A %d %B %Y %H:%M').replace(tzinfo=ZoneInfo('Asia/Bangkok'))
    except ValueError as e:
        raise ValueError('Could not parse provider local time') from e
    age_seconds = (clock - sampled_local.astimezone(timezone.utc)).total_seconds()
    if age_seconds < -1800 or age_seconds > 12 * 3600:
        raise ValueError(f'Stale or future provider timestamp, age={age_seconds / 3600:.1f}h')
    date_thai = (body.get('datetimeThai') or {}).get('dateThai')
    time_thai = (body.get('datetimeThai') or {}).get('timeThai')
    if not date_thai or not time_thai:
        raise ValueError('Missing display timestamp from provider')
    return {'provider':'GISTDA เช็คฝุ่น', 'source_url':API_URL,
            'method':'ข้อมูลวิเคราะห์ดาวเทียมร่วมสถานีภาคพื้นดิน (GISTDA); ภาพรวมรายจังหวัด ไม่ใช่ค่าจากทุกจุด',
            'metric':'pm25Avg24hr', 'unit':'µg/m³',
            'fetched_at_utc':clock.isoformat(timespec='seconds'),
            'source_date_thai':date_thai,'source_time_thai':time_thai,
            'source_time_iso_bangkok':sampled_local.isoformat(),
            'province_count':len(cleaned),
            'data':sorted(cleaned,key=lambda x:x['pv_idn'])}


def main() -> None:
    request = Request(API_URL, headers={'User-Agent':'Thai-Pollution-Atlas/1.1 (public environmental dashboard; GISTDA source linked)','Accept':'application/json'})
    with urlopen(request,timeout=25) as res:
        body = json.load(res)
    data = validate_and_reformat(body)
    DEST.parent.mkdir(parents=True,exist_ok=True)
    # Atomic replace, never leave a partial file after failure.
    tmp = DEST.with_suffix('.json.tmp')
    tmp.write_text(json.dumps(data,ensure_ascii=False,separators=(',',':'))+'\n',encoding='utf-8')
    tmp.replace(DEST)
    print(f'Wrote GISTDA PM2.5 for {len(data["data"])} provinces; source: {data["source_date_thai"]} {data["source_time_thai"]}')


if __name__ == '__main__':
    main()