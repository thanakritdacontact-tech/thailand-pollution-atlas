"""Validate GISTDA PM2.5 importer and that the unit/region matches."""
from pathlib import Path
import sys
from datetime import datetime, timezone
sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'scripts'))
from update_pm25 import validate_and_reformat
from zoneinfo import ZoneInfo

clock = datetime(2026,11,21,15,30,tzinfo=timezone.utc)
local = clock.astimezone(ZoneInfo('Asia/Bangkok'))
# Test only: synthetic data is NEVER published.
base = [p.split(' ',1) for p in '''10 กรุงเทพมหานคร
11 สมุทรปราการ
12 นนทบุรี
13 ปทุมธานี
14 พระนครศรีอยุธยา
15 อ่างทอง
16 ลพบุรี
17 สิงห์บุรี
18 ชัยนาท
19 สระบุรี
20 ชลบุรี
21 ระยอง
22 จันทบุรี
23 ตราด
24 ฉะเชิงเทรา
25 ปราจีนบุรี
26 นครนายก
27 สระแก้ว
30 นครราชสีมา
31 บุรีรัมย์
32 สุรินทร์
33 ศรีสะเกษ
34 อุบลราชธานี
35 ยโสธร
36 ชัยภูมิ
37 อำนาจเจริญ
38 บึงกาฬ
39 หนองบัวลำภู
40 ขอนแก่น
41 อุดรธานี
42 เลย
43 หนองคาย
44 มหาสารคาม
45 ร้อยเอ็ด
46 กาฬสินธุ์
47 สกลนคร
48 นครพนม
49 มุกดาหาร
50 เชียงใหม่
51 ลำพูน
52 ลำปาง
53 อุตรดิตถ์
54 แพร่
55 น่าน
56 พะเยา
57 เชียงราย
58 แม่ฮ่องสอน
60 นครสวรรค์
61 อุทัยธานี
62 กำแพงเพชร
63 ตาก
64 สุโขทัย
65 พิษณุโลก
66 พิจิตร
67 เพชรบูรณ์
70 ราชบุรี
71 กาญจนบุรี
72 สุพรรณบุรี
73 นครปฐม
74 สมุทรสาคร
75 สมุทรสงคราม
76 เพชรบุรี
77 ประจวบคีรีขันธ์
80 นครศรีธรรมราช
81 กระบี่
82 พังงา
83 ภูเก็ต
84 สุราษฎร์ธานี
85 ระนอง
86 ชุมพร
90 สงขลา
91 สตูล
92 ตรัง
93 พัทลุง
94 ปัตตานี
95 ยะลา
96 นราธิวาส'''.splitlines()]
assert len(base) == 77
payload={'status':200,'data':[{'pv_idn':int(code),'pv_tn':name,'pm25':18.5,'pm25Avg24hr':22.4} for code,name in base],
         'datetimeEng':{'dateEng':local.strftime('%A %d %B %Y'),'timeEng':local.strftime('%H:%M')},
         'datetimeThai':{'dateThai':'วันเสาร์ที่ 21 พฤศจิกายน 2569','timeThai':'เวลา 22:30 น.'}}
r=validate_and_reformat(payload,clock)
assert len(r['data'])==77 and r['unit']=='µg/m³'
for change in [lambda x:x['data'].pop(),lambda x:x['data'][0].update({'pm25Avg24hr':float('nan')}),lambda x:x.update({'status':500})]:
 import copy
 broken=copy.deepcopy(payload);change(broken)
 try:validate_and_reformat(broken,clock)
 except (ValueError,KeyError):pass
 else:raise AssertionError('Bad API payload not rejected')
print('PASS GISTDA importer: all 77 province readings validated; incomplete/invalid/failed rejected')