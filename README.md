# Thai Pollution Atlas 🗺️

เว็บภาษาไทยแบบ static สำหรับแสดง **รายงานมลพิษรายจังหวัด** บนขอบเขตแผนที่ประเทศไทย 77 จังหวัด โดยแยกผลตรวจเกินเกณฑ์เฉพาะจุด การเฝ้าระวัง ข่าวเหตุการณ์ และจังหวัดที่ไม่มีข้อมูลในชุดตัวอย่าง

> **สำคัญ:** เว็บนี้ **ไม่ใช่ระบบตรวจวัดเรียลไทม์**, ไม่ใช่การจัดอันดับจังหวัดอันตราย และสีเทา **ไม่แปลว่าปลอดภัย** สถานะอ้างอิงจากเฉพาะกรณีศึกษาที่บันทึกและต้องดูร่วมกับวันตรวจ พื้นที่ตรวจ และข้อจำกัดของหลักฐาน

## ฟีเจอร์

- แผนที่ขอบเขต 77 จังหวัดแบบ SVG คลิกหรือใช้แป้นพิมพ์เพื่ออ่านรายละเอียด
- ค้นหาชื่อจังหวัด พื้นที่ สารหรือเหตุการณ์
- กรองประเภทมลพิษและชนิดหลักฐาน พร้อมจำนวนจังหวัดในแต่ละสถานะ
- แสดงช่วงเวลาเก็บตัวอย่าง วันรายงาน สารที่ตรวจ และข้อจำกัด
- ลิงก์อ้างอิงกลับต้นทางสำหรับทุกรายการ พร้อมแหล่งข้อมูลทางการที่ควรตรวจสอบเพิ่ม
- เว็บ responsive ใช้งานได้ทั้งโทรศัพท์และเดสก์ท็อป ไม่มี API keys และไม่ส่งข้อมูลผู้ใช้เข้า server

## วิธีเผยแพร่ผ่าน GitHub Pages

1. ลงชื่อเข้า GitHub แล้วสร้าง repository แบบ **Public** ที่ <https://github.com/new> ตั้งชื่อ `thailand-pollution-atlas` และเลือก `Add a README` = **ไม่ต้องเลือก** (เพราะมีไฟล์ README นี้แล้ว)
2. นำ **เนื้อหาทั้งหมดภายในโฟลเดอร์** `thailand-pollution-atlas` (รวม `index.html`, `assets/`, `data/`, `.nojekyll`) ขึ้นไปที่ **root** ของ repo ผ่าน GitHub → `Add file` → `Upload files` หรือใช้ `git` ด้านล่าง
3. เปิด repo → **Settings → Pages → Build and deployment → Source: GitHub Actions** (ต้องเลือกครั้งแรกด้วยตนเอง เพราะ `GITHUB_TOKEN` สร้าง GitHub Pages site ใหม่ไม่ได้)
4. Workflow `.github/workflows/deploy.yml` จะ deploy อัตโนมัติทุกครั้งที่ push ไป `main`; สามารถสั่ง `Run workflow` ในแท็บ Actions ได้หลังเปิด Pages
5. GitHub จะเผยแพร่ที่ `https://<username>.github.io/thailand-pollution-atlas/` เมื่อ deployment สำเร็จ (ตรวจ URL จริงที่ Settings → Pages)

ถ้าใช้ Git CLI:

```bash
git init
git add .
git commit -m "Initial Thai Pollution Atlas"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/thailand-pollution-atlas.git
git push -u origin main
```

## รันในเครื่อง

```bash
python3 -m http.server 8000
# เปิด http://localhost:8000
```

ไม่ควรเปิด `index.html` ผ่าน `file://` โดยตรง เนื่องจากเบราว์เซอร์อาจไม่อนุญาตให้ fetch ไฟล์ JSON ในเครื่อง

## แก้ไข/เพิ่มข้อมูล

ไฟล์ `data/incidents.json` มี `incidents` array โดยแต่ละรายการมีฟิลด์

| ฟิลด์ | ความหมาย |
| --- | --- |
| `id` | ตัวระบุเหตุการณ์ไม่ซ้ำ |
| `province_code` | รหัส DOPA จังหวัด 2 หลัก เช่น `57` = เชียงราย |
| `province`, `area` | จังหวัดและพื้นที่เฉพาะที่อ้างถึง |
| `headline` | ประเด็นสรุปอย่างระมัดระวัง |
| `status` | `exceeded`, `watch`, หรือ `reported` |
| `category`, `substance` | ประเภทและชนิดสาร/ปัญหา |
| `sample_date` | วันที่หรือช่วงเก็บตัวอย่าง/เหตุการณ์ |
| `report_date` | วันเผยแพร่รายงาน |
| `finding` | ข้อค้นพบพร้อมบริบท |
| `limitation` | ข้อจำกัด/สิ่งที่ห้ามอนุมาน |
| `source_name`, `source_url`, `source_type` | ที่มาและชนิดของหลักฐาน |

**อย่า** ตั้งสถานะ `exceeded` จากข่าวที่เพียงรายงานความกังวล หรือจากการตรวจพบซึ่งไม่เกินเกณฑ์ ค่าโลหะหนักในดิน/น้ำ/ผลิตผลไม่ใช่หลักฐานเดียวกัน เก็บวันตรวจแต่ละครั้งและมาตรฐานที่ใช้ให้ครบ หากมีรายงานใหม่ ควรแก้ไขหรือเพิ่มรายการโดยไม่ลบประวัติเดิม

`status` เป็นเพียงหมวดหมู่หลักฐานในชุดข้อมูลนี้ **ไม่ใช่ความรุนแรงของจังหวัด** ถ้าจังหวัดมีหลายรายการ ระบบใช้ลำดับ `exceeded > watch > reported` เพื่อเลือกสี จึงต้องอ่านรายละเอียดแยกกรณี

## แหล่งข้อมูลและสิทธิ์ใช้งาน

- กรมควบคุมมลพิษ IWIS: <https://iwis.pcd.go.th/dashboard> — หน้าเว็บข้อมูลตรวจสถานี; **ไม่ได้มีการดึงค่านี้เป็น real-time feed**
- กรมควบคุมมลพิษ ฐานข้อมูลคุณภาพน้ำ: <https://pcdweb.pcd.go.th/water-quality/data>
- Thai PBS The Active (5 พ.ย. 2569): <https://theactive.thaipbs.or.th/data/toxic-land>
- Thai PBS ข่าวปราจีนบุรี (13 พ.ย. 2569): <https://www.thaipbs.or.th/org/corporate/69097/>
- GeoThai boundaries release `v2026.10.23`: <https://github.com/GeoThai/boundaries>. Boundary geometry มาจาก OCHA COD-AB / Royal Thai Survey Department ภายใต้ **CC BY 3.0 IGO**, ชื่อ/รหัสจังหวัดมาจาก GeoThai/data ภายใต้ **CC BY 4.0**. เครดิต: **GeoThai, from OCHA COD-AB and the Royal Thai Survey Department**. การโหลดผ่าน jsDelivr CDN ทำให้ต้องออนไลน์

กรณีศึกษาใน `incidents.json` เป็น **การสรุปย่อและอ้างอิงแหล่งข่าว** ไม่ใช่การยืนยันโดยทีมผู้จัดทำว่าได้เห็นผลตรวจห้องปฏิบัติการต้นฉบับทุกรายการ ใช้ประเมินภาพรวมเพื่อไปอ่านเอกสารเต็มเท่านั้น

## การพัฒนาต่อ

- ออกแบบ ETL แยกจาก frontend ดึงไฟล์ open data ที่มีสิทธิ์ใช้และมี schema ชัดเจน
- เพิ่มชุดผลตรวจแบบระดับสถานี, เวลา, พารามิเตอร์, หน่วย, เกณฑ์ และ provenance
- จัดทำ CI ทดสอบข้อมูลและแจ้งเตือนแหล่งข้อมูลเปลี่ยน โดยไม่อัปเดตสีอัตโนมัติจากข่าวที่ไม่ได้ผ่านการตรวจทาน
- สร้างหน้าจัดการ data review และประวัติการแก้ไขในอนาคต

## License ของโค้ด

ตัวอย่างโค้ดเว็บไซต์ภายใต้ MIT License (ดู `LICENSE`) **ไม่ครอบคลุมการเปลี่ยนใบอนุญาตของข้อมูลแผนที่/บทความจากเจ้าของต้นทาง**
