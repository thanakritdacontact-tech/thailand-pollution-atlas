/* Thai Pollution Atlas: static, auditable frontend; no secret keys or tracking. */
'use strict';
const GEOJSON_URLS = [
  'https://cdn.jsdelivr.net/gh/GeoThai/boundaries@v2026.10.23/provinces.geojson',
  'https://raw.githubusercontent.com/GeoThai/boundaries/v2026.10.23/provinces.geojson'
];
const STATUS = {
  exceeded: { label: 'มีผลตรวจเกินเกณฑ์บางจุด', color: '#e77878', rank: 3, short: 'ผลตรวจเกินเกณฑ์' },
  watch: { label: 'พื้นที่เฝ้าระวัง', color: '#76a2da', rank: 2, short: 'เฝ้าระวัง' },
  reported: { label: 'มีรายงานเหตุการณ์', color: '#eaba76', rank: 1, short: 'รายงานเหตุการณ์' },
  airExcellent: { label: 'PM2.5 ดีมาก (ค่าเฉลี่ย 24 ชม.)', color: '#2d8bd4', rank: 1, short: 'ดีมาก' },
  airGood: { label: 'PM2.5 ดี (ค่าเฉลี่ย 24 ชม.)', color: '#60bd8d', rank: 2, short: 'ดี' },
  airModerate: { label: 'PM2.5 ปานกลาง (ค่าเฉลี่ย 24 ชม.)', color: '#edcb62', rank: 3, short: 'ปานกลาง' },
  airImpact: { label: 'PM2.5 เริ่มมีผลกระทบต่อสุขภาพ (ค่าเฉลี่ย 24 ชม.)', color: '#ec9d52', rank: 4, short: 'เริ่มกระทบสุขภาพ' },
  airSevere: { label: 'PM2.5 มีผลกระทบต่อสุขภาพ (ค่าเฉลี่ย 24 ชม.)', color: '#e77878', rank: 5, short: 'กระทบสุขภาพ' },
  unknown: { label: 'ไม่มีข้อมูลในชุดนี้', color: '#dce5eb', rank: 0, short: 'ไม่มีข้อมูล' }
};
const state = { events: [], provinces: [], byCode: new Map(), features: [], selected: null, filter: 'all', category: 'all', query: '', layer: 'water', latest: new Map(), latestMeta: null, latestError: null, latestStale: false };
const el = (id) => document.getElementById(id);
const escapeHtml = (v) => String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const norm = (v) => String(v ?? '').toLocaleLowerCase('th-TH').replace(/\s+/g, '').trim();
const svgNS = 'http://www.w3.org/2000/svg';

function liveStatus(value) {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) return 'unknown';
  if (value <= 15) return 'airExcellent';
  if (value <= 25) return 'airGood';
  if (value <= 37.5) return 'airModerate';
  if (value <= 75) return 'airImpact';
  return 'airSevere';
}
function getStatus(code) {
  if (state.layer === 'air-live') return state.latestStale ? 'unknown' : liveStatus(state.latest.get(String(code))?.pm25Avg24hr);
  const events = eventsFor(code);
  return events.reduce((best, event) => STATUS[event.status].rank > STATUS[best].rank ? event.status : best, 'unknown');
}
function eventsFor(code) { return (state.byCode.get(String(code)) || []).filter(e => e.layer === state.layer); }
function getProvince(code) { return state.provinces.find(x => String(x.code) === String(code)); }
function getFilteredCodes() {
  const codes = new Set();
  if (state.layer === 'air-live') {
    state.provinces.forEach(prov => { if (!state.query || norm(prov.name).includes(norm(state.query))) codes.add(prov.code); });
    return codes;
  }
  state.provinces.forEach(prov => {
    const list = eventsFor(prov.code);
    const status = getStatus(prov.code);
    if (state.filter !== 'all' && status !== state.filter) return;
    if (state.category !== 'all' && !list.some(e => e.category === state.category)) return;
    if (state.query && !norm([prov.name, ...list.flatMap(e => [e.area, e.headline, e.substance, e.finding])].join(' ')).includes(norm(state.query))) return;
    codes.add(prov.code);
  });
  return codes;
}
function updateStats() {
  if (state.layer === 'air-live') {
    const valid = [...state.latest.values()].filter(x => typeof x.pm25Avg24hr === 'number' && Number.isFinite(x.pm25Avg24hr));
    el('count-all').textContent = String(state.provinces.length || 77);
    el('count-covered').textContent = String(state.latestStale ? 0 : valid.length);
    el('count-exceeded').textContent = String(state.latestStale ? 0 : valid.filter(x => x.pm25Avg24hr > 37.5).length);
    el('count-reports').textContent = String(state.latestStale ? 0 : valid.length);
    el('stat-covered-title').textContent = 'จังหวัดที่มีค่า PM2.5 ล่าสุด';
    el('stat-exceeded-title').textContent = 'ค่าเฉลี่ย 24 ชม. > 37.5';
    el('stat-report-title').textContent = 'รายการตัวเลขจาก GISTDA';
    el('tab-all').textContent = String(state.provinces.length || 77);
    return;
  }
  const counts = { exceeded: 0, watch: 0, reported: 0, unknown: 0 };
  state.provinces.forEach(p => counts[getStatus(p.code)]++);
  el('count-all').textContent = String(state.provinces.length || 77);
  el('count-covered').textContent = String(state.provinces.filter(p => eventsFor(p.code).length).length);
  el('count-exceeded').textContent = String(counts.exceeded);
  el('count-reports').textContent = String(state.events.filter(e => e.layer === state.layer).length);
  el('stat-covered-title').textContent = state.layer === 'air' ? 'จังหวัดในรายงาน PM2.5' : 'มีข้อมูลรายงานน้ำ/กาก';
  el('stat-exceeded-title').textContent = state.layer === 'air' ? 'เคยถึงระดับสีแดง' : 'เคยตรวจพบเกินเกณฑ์';
  el('stat-report-title').textContent = state.layer === 'air' ? 'รายการจากรายงานฉบับเดียว' : 'รายงานที่บันทึก';
  el('tab-all').textContent = String(state.provinces.length || 77);
  for (const type of Object.keys(counts)) el('tab-' + type).textContent = String(counts[type]);
}
function getGeometryBounds(features) {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  function visit(c) {
    if (typeof c[0] === 'number') { minX = Math.min(minX, c[0]); maxX = Math.max(maxX, c[0]); minY = Math.min(minY, c[1]); maxY = Math.max(maxY, c[1]); }
    else c.forEach(visit);
  }
  features.forEach(f => visit(f.geometry.coordinates));
  return { minX, maxX, minY, maxY };
}
function drawMap() {
  const layer = el('province-layer'); layer.replaceChildren();
  if (!state.features.length) return;
  const bounds = getGeometryBounds(state.features);
  const width = 720, height = 850, margin = 35;
  const scale = Math.min((width - margin * 2) / (bounds.maxX - bounds.minX), (height - margin * 2) / (bounds.maxY - bounds.minY));
  const extraX = (width - (bounds.maxX - bounds.minX) * scale) / 2;
  const extraY = (height - (bounds.maxY - bounds.minY) * scale) / 2;
  const p = ([lon, lat]) => [(extraX + (lon - bounds.minX) * scale).toFixed(2), (extraY + (bounds.maxY - lat) * scale).toFixed(2)];
  function polygonPath(polygon) {
    return polygon.map(ring => ring.map((pt, i) => `${i ? 'L' : 'M'}${p(pt).join(',')}`).join(' ') + 'Z').join(' ');
  }
  state.features.forEach(feature => {
    const code = String(feature.properties.code ?? feature.properties.pro_code ?? '').padStart(2, '0');
    const shape = document.createElementNS(svgNS, 'path');
    const polygons = feature.geometry.type === 'Polygon' ? [feature.geometry.coordinates] : feature.geometry.coordinates;
    shape.setAttribute('d', polygons.map(polygonPath).join(' '));
    shape.classList.add('province-shape');
    shape.dataset.provinceCode = code;
    shape.setAttribute('tabindex', '0');
    shape.setAttribute('role', 'button');
    shape.setAttribute('aria-label', `ดูข้อมูลจังหวัด${feature.properties.name_th || feature.properties.pro_th || code}`);
    const title = document.createElementNS(svgNS, 'title');
    title.textContent = `${feature.properties.name_th || feature.properties.pro_th || code}: ${STATUS[getStatus(code)].label}`;
    shape.appendChild(title);
    shape.addEventListener('click', () => selectProvince(code));
    shape.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); selectProvince(code); } });
    layer.appendChild(shape);
  });
  updateMapColors();
}
function updateMapColors() {
  const codes = getFilteredCodes();
  document.querySelectorAll('.province-shape').forEach(shape => {
    const code = shape.dataset.provinceCode;
    shape.setAttribute('fill', STATUS[getStatus(code)].color);
    shape.classList.toggle('selected', state.selected === code);
    shape.classList.toggle('dimmed', !codes.has(code));
  });
}
function selectProvince(code) {
  state.selected = String(code);
  updateMapColors(); renderDetails();
  const province = getProvince(code);
  if (el('province-picker')) el('province-picker').value = String(code);
  if (province) { const url = new URL(location.href); url.searchParams.set('province', province.code); history.replaceState(null, '', url); }
  if (window.matchMedia('(max-width: 850px)').matches) el('detail-title').scrollIntoView({ behavior: 'smooth', block: 'center' });
}
function statusLabel(status) { const text = state.layer === 'air' && status === 'exceeded' ? 'เคยถึงระดับสีแดง (2568)' : STATUS[status].short; return `<span class="detail-status ${escapeHtml(status)}">● ${escapeHtml(text)}</span>`; }
function provinceLinks() {
  return `<div class="registry-links"><b>ตรวจแหล่งข้อมูลเพิ่มเติม (มีให้ค้นทุกจังหวัด แต่ไม่ได้หมายความว่ามีสถานีทุกแห่ง)</b>
     <a href="https://iwis.pcd.go.th/dashboard" rel="noopener noreferrer" target="_blank">กรมควบคุมมลพิษ — IWIS ↗</a>
     <a href="https://pcdweb.pcd.go.th/water-quality/data" rel="noopener noreferrer" target="_blank">ข้อมูลสถานีคุณภาพน้ำ ↗</a>
     <a href="https://www.air4thai.com/" rel="noopener noreferrer" target="_blank">Air4Thai ตรวจฝุ่นล่าสุด ↗</a>
     <a href="https://data.go.th/" rel="noopener noreferrer" target="_blank">Open Government Data ↗</a></div>`;
}
function liveTimeText() {
  const m = state.latestMeta;
  return m ? `${escapeHtml(m.source_date_thai || 'ไม่ระบุวันที่')} ${escapeHtml(m.source_time_thai || 'ไม่ระบุเวลา')}` : 'ยังไม่ทราบเวลา';
}
function renderLiveDetails(province) {
  const reading = state.latest.get(province.code);
  if (!reading || state.latestStale) {
    const detail = state.latestStale ? 'ข้อมูลจากรอบดึงล่าสุดเก่ากว่า 12 ชั่วโมง จึงไม่แสดงเป็นค่าปัจจุบัน' : 'ยังไม่มีข้อมูลฉบับล่าสุดจาก GISTDA บนเว็บไซต์นี้';
    return `${statusLabel('unknown')}<p class="detail-hint">${escapeHtml(detail)} · ไม่ใช่หลักฐานว่าจังหวัดนี้มีอากาศดี</p><a class="source-button" target="_blank" rel="noopener noreferrer" href="https://pm25.gistda.or.th/">ตรวจ GISTDA ต้นทาง ↗</a>` + provinceLinks();
  }
  const num = (x) => Number(x).toFixed(1);
  const cls = liveStatus(reading.pm25Avg24hr);
  return `${statusLabel(cls)}<p class="detail-hint">GISTDA เช็คฝุ่น · ข้อมูลภาพรวมจังหวัดจากดาวเทียมผสานข้อมูลภาคพื้นดิน ไม่ใช่การวัดจากทุกถนนหรือทุกบ้าน</p>
   <div class="live-reading"><small>PM2.5 เฉลี่ย 24 ชั่วโมง</small><strong>${num(reading.pm25Avg24hr)}</strong><span>µg/m³</span></div>
   <div class="detail-metadata"><div><small>ค่ารายงาน PM2.5 อีกช่องของ API</small><b>${num(reading.pm25)} µg/m³</b></div><div><small>เวลาอ้างอิงที่ GISTDA ระบุ (ไทย)</small><b>${liveTimeText()}</b></div></div>
   <p class="detail-hint"><strong>เกณฑ์มาตรฐานเฉลี่ย 24 ชม. ของไทย:</strong> ไม่เกิน 37.5 µg/m³ · สถานะสีประเมินจากค่าเฉลี่ย 24 ชม. เท่านั้น ไม่ใช่ค่า AQI ที่คำนวณจากสารอื่น</p>
   <a class="source-button" target="_blank" rel="noopener noreferrer" href="https://pm25.gistda.or.th/rest/getPm25byProvince">เปิดข้อมูล JSON ต้นทาง ↗</a>
   <div class="detail-caution"><strong>ข้อจำกัด:</strong> ค่า PM2.5 ที่เผยแพร่โดย GISTDA อาศัยการวิเคราะห์ข้อมูลดาวเทียมประกอบสถานีภาคพื้นดิน ใช้ดูภาพรวม ไม่ใช่หลักฐานสารหนู/ปรอท/สารพิษในน้ำ และไม่ใช่การตรวจทุกจุดในจังหวัด</div>` + provinceLinks();
}
function renderDetails() {
  const province = getProvince(state.selected);
  el('detail-code').textContent = province ? `TH-${province.code}` : 'TH';
  el('detail-title').textContent = province ? province.name : 'ประเทศไทย';
  if (!province) {
    el('detail-content').innerHTML = '<p class="detail-intro">เลือกจังหวัดบนแผนที่ หรือในรายการ 77 จังหวัด เพื่อดูหลักฐานในชั้นข้อมูลที่เลือก</p><div class="detail-empty"><b>คลิกจังหวัดเพื่อสำรวจ</b>ข้อมูลพร้อมวันที่และลิงก์ตรวจสอบ</div>';
    return;
  }
  if (state.layer === 'air-live') { el('detail-content').innerHTML = renderLiveDetails(province); return; }
  const list = eventsFor(province.code);
  const otherLayer = state.layer === 'water' ? 'air' : 'water';
  const otherCount = (state.byCode.get(province.code) || []).filter(e => e.layer === otherLayer).length;
  const otherLabel = otherLayer === 'air' ? 'ฝุ่น PM2.5 ย้อนหลัง' : 'คุณภาพน้ำ/กากอุตสาหกรรม';
  const context = state.layer === 'air' ? 'สถิติย้อนหลังปี 2568 ไม่ใช่ค่าฝุ่นวันนี้' : 'รายงานน้ำ/กากอุตสาหกรรมตามจุดและวันที่ ไม่ใช่ผลตรวจทั้งจังหวัด';
  if (!list.length) {
    el('detail-content').innerHTML = `${statusLabel('unknown')}<p class="detail-hint">ไม่พบรายการที่บันทึกในชั้นข้อมูลนี้สำหรับ ${escapeHtml(province.name)} — <strong>ไม่ใช่คำยืนยันว่าปลอดภัยหรือไม่มีมลพิษ</strong> ${otherCount ? `มีข้อมูลอีกชั้น (${escapeHtml(otherLabel)}) ${otherCount} รายการ` : ''}</p><div class="detail-empty"><b>ยังไม่มีหลักฐานในชั้นข้อมูลนี้</b>แหล่งตรวจวัดราชการอาจมีข้อมูลเพิ่ม หรือยังไม่มีสถานีครอบคลุม</div>${provinceLinks()}`;
    return;
  }
  el('detail-content').innerHTML = `${statusLabel(getStatus(province.code))}<p class="detail-hint">${escapeHtml(context)} · พบ ${list.length} รายการ ${otherCount ? `· อีกชั้นข้อมูลมี ${otherCount} รายการ` : ''}</p>` + list.map((e, i) => `<article class="detail-event"><div class="event-topline">SOURCE RECORD ${String(i + 1).padStart(2, '0')} · ${escapeHtml(e.category)}</div><h4>${escapeHtml(e.headline)}</h4><p>${escapeHtml(e.finding)}</p><div class="detail-metadata"><div><small>พื้นที่ / ขอบเขตข้อมูล</small><b>${escapeHtml(e.area)}</b></div><div><small>ช่วงเวลาตรวจ/เหตุการณ์</small><b>${escapeHtml(e.sample_date)}</b></div><div><small>พารามิเตอร์</small><b>${escapeHtml(e.substance)}</b></div><div><small>วันที่รายงาน</small><b>${escapeHtml(e.report_date)}</b></div></div><a class="source-button" href="${escapeHtml(e.source_url)}" target="_blank" rel="noopener noreferrer">เปิดเอกสารต้นทาง ↗</a><div class="detail-caution"><strong>ข้อจำกัดการใช้ข้อมูล:</strong> ${escapeHtml(e.limitation)}</div></article>`).join('') + provinceLinks();
}
function renderRecords() {
  if (state.layer === 'air-live') {
    const records = state.provinces.map(p => ({...p, reading:state.latest.get(p.code)}))
       .filter(p => !state.query || norm(p.name).includes(norm(state.query)))
       .sort((a,b) => ((b.reading?.pm25Avg24hr ?? -1) - (a.reading?.pm25Avg24hr ?? -1)));
    const valid = records.filter(p => p.reading && Number.isFinite(p.reading.pm25Avg24hr));
    el('results-count').textContent = `มีค่าจาก API ${state.latest.size}/77 จังหวัด · ${state.latestStale ? 'ข้อมูลเก่า ไม่แสดงสี' : liveTimeText()}`;
    el('record-list').innerHTML = state.latestStale || !valid.length
       ? `<div class="empty-results">${state.latestStale ? 'ข้อมูลดึงล่าสุดเก่ากว่า 12 ชั่วโมง' : 'ข้อมูล PM2.5 ล่าสุดยังไม่พร้อม'} — เปิดตรวจ <a href="https://pm25.gistda.or.th/" target="_blank" rel="noopener noreferrer">ระบบ GISTDA ↗</a></div>`
       : records.map(p => `<article class="record-card"><div class="record-card-top"><span class="record-province">${escapeHtml(p.name)}</span>${p.reading ? statusLabel(liveStatus(p.reading.pm25Avg24hr)) : statusLabel('unknown')}</div><h4>${p.reading ? `${Number(p.reading.pm25Avg24hr).toFixed(1)} µg/m³` : 'ยังไม่มีค่า'}</h4><p>PM2.5 เฉลี่ย 24 ชม. · GISTDA เช็คฝุ่น</p><div class="record-card-bottom"><span class="record-date">${liveTimeText()}</span><a href="?layer=air-live&province=${encodeURIComponent(p.code)}">ดูรายละเอียด ↗</a></div></article>`).join('');
    return;
  }
  const codes = getFilteredCodes();
  const records = state.events.filter(e => e.layer === state.layer && codes.has(e.province_code) && (state.filter === 'all' || state.filter === getStatus(e.province_code)) && (state.category === 'all' || e.category === state.category) && (!state.query || norm([e.province, e.area, e.headline, e.substance, e.finding].join(' ')).includes(norm(state.query))));
  const size = state.events.filter(e => e.layer === state.layer).length;
  el('results-count').textContent = `แสดง ${records.length} จาก ${size} รายการในชั้นนี้`;
  el('record-list').innerHTML = records.length ? records.map(e => `<article class="record-card"><div class="record-card-top"><span class="record-province">${escapeHtml(e.province)}</span>${statusLabel(e.status)}</div><h4>${escapeHtml(e.headline)}</h4><p>${escapeHtml(e.area)} · ${escapeHtml(e.substance)}</p><div class="record-card-bottom"><span class="record-date">รายงาน ${escapeHtml(e.report_date)}</span><a href="${escapeHtml(e.source_url)}" target="_blank" rel="noopener noreferrer">ดูแหล่งข้อมูล ↗</a></div></article>`).join('') : '<div class="empty-results">ไม่พบรายงานที่ตรงกับตัวกรองนี้ ลองเปลี่ยนสถานะ ประเภท หรือคำค้นหา</div>';
}
function updateLiveBanner() {
  if (state.layer !== 'air-live') return;
  const label = state.latestMeta ? `ข้อมูล GISTDA: ${liveTimeText()} · ดึงโดย GitHub Pages ตามรอบเวลา` : 'กำลังตรวจชุดข้อมูล GISTDA ล่าสุด...';
  el('live-time-banner').textContent = state.latestError ? `ไม่สามารถดึงข้อมูลล่าสุดได้: ${state.latestError}. เปิดดูที่ GISTDA ต้นทาง` : state.latestStale ? `คำเตือน: ข้อมูลเก่ากว่า 12 ชั่วโมง · ${label} · ไม่แสดงสีปัจจุบัน` : label;
}
function update() { updateStats(); updateLiveBanner(); updateMapColors(); renderDetails(); renderRecords(); }
async function loadLatestAir() {
  try {
    const res = await fetch('data/pm25-latest.json', {cache:'no-store'});
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    if (!Array.isArray(data.data) || data.data.length !== 77 || !data.fetched_at_utc) throw new Error('ข้อมูลไม่ครบ 77 จังหวัด');
    const map = new Map();
    for (const r of data.data) {
      const code = String(r.pv_idn).padStart(2,'0');
      if (map.has(code) || !getProvince(code) || !Number.isFinite(r.pm25Avg24hr) || !Number.isFinite(r.pm25)) throw new Error(`ข้อมูลไม่ถูกต้อง: ${code}`);
      map.set(code, r);
    }
    const age = Date.now() - Date.parse(data.fetched_at_utc);
    if (!Number.isFinite(age)) throw new Error('เวลาการดึงข้อมูลไม่ถูกต้อง');
    state.latest = map;
    state.latestMeta = data;
    state.latestStale = age > 12 * 3600000 || age < -30 * 60000;
    state.latestError = null;
  } catch(err) {
    state.latest.clear(); state.latestMeta = null; state.latestStale = false;
    state.latestError = String(err.message || err).slice(0,100);
  }
  if (state.layer === 'air-live') update();
}

function setLayer(layer) {
  if (!['water','air','air-live'].includes(layer)) return;
  state.layer = layer; state.filter = 'all'; state.category = 'all'; state.query = '';
  el('province-search').value = ''; el('category-filter').value = 'all';
  el('category-filter').hidden = layer !== 'water';
  document.querySelectorAll('[data-layer]').forEach(btn => { const on = btn.dataset.layer === layer; btn.classList.toggle('selected', on); btn.setAttribute('aria-pressed', String(on)); });
  document.querySelectorAll('.segment').forEach(btn => { const on = btn.dataset.filter === 'all'; btn.classList.toggle('selected', on); btn.setAttribute('aria-pressed', String(on)); });
  el('layer-description').textContent = layer === 'air-live' ? 'GISTDA เช็คฝุ่น: ค่า PM2.5 เฉลี่ย 24 ชั่วโมง รายจังหวัด; โหลดชุดล่าสุดผ่าน GitHub Pages ทุก 3 ชั่วโมง (อาจล่าช้าหรือขัดข้องได้)' : layer === 'air' ? 'PM2.5 ย้อนหลังปี 2568: แดง = อยู่ในรายชื่อ 57 จังหวัดที่เคยถึงระดับกระทบสุขภาพ; เทา = ไม่อยู่ในรายชื่อ ไม่ใช่ปลอดภัย' : 'น้ำ/กากอุตสาหกรรม: สีแสดงเฉพาะรายงานที่บันทึกไว้ ไม่ใช่ผลวัดสารพิษทั้งจังหวัด';
  el('legacy-segments').hidden = layer === 'air-live';
  el('historical-legend').hidden = layer === 'air-live';
  el('live-legend').hidden = layer !== 'air-live';
  el('live-time-banner').hidden = layer !== 'air-live';
  el('tab-exceeded-label').textContent = layer === 'air' ? 'เคยถึงระดับสีแดง' : 'เกินเกณฑ์ที่จุดตรวจ';
  el('tab-watch-button').hidden = layer === 'air';
  el('tab-reported-button').hidden = layer === 'air';
  el('legend-exceeded-label').textContent = layer === 'air' ? 'เคยถึงสีแดงในปี 2568' : 'เกินเกณฑ์บางจุด';
  el('legend-watch').hidden = layer === 'air'; el('legend-reported').hidden = layer === 'air';
  el('legend-unknown-label').textContent = layer === 'air' ? 'ไม่อยู่ในรายชื่อ (ไม่ใช่ปลอดภัย)' : 'ไม่พบข้อมูลในชุดนี้';
  const url = new URL(location.href); url.searchParams.set('layer', layer); history.replaceState(null, '', url);
  updateLiveBanner();
  update();
}
function attachFilters() {
  document.querySelectorAll('[data-layer]').forEach(btn => btn.addEventListener('click', () => setLayer(btn.dataset.layer)));
  el('province-picker').addEventListener('change', e => { if (e.target.value) selectProvince(e.target.value); });
  el('province-search').addEventListener('input', e => { state.query = e.target.value; update(); });
  el('category-filter').addEventListener('change', e => { state.category = e.target.value; update(); });
  document.querySelectorAll('.segment').forEach(btn => btn.addEventListener('click', () => {
    state.filter = btn.dataset.filter;
    document.querySelectorAll('.segment').forEach(b => { b.classList.toggle('selected', b === btn); b.setAttribute('aria-pressed', String(b === btn)); });
    update();
  }));
  el('reset-filter').addEventListener('click', () => {
    state.filter = 'all'; state.category = 'all'; state.query = '';
    el('province-search').value = ''; el('category-filter').value = 'all';
    document.querySelectorAll('.segment').forEach(b => { const active = b.dataset.filter === 'all'; b.classList.toggle('selected', active); b.setAttribute('aria-pressed', String(active)); });
    update();
  });
}
async function fetchGeoJson() {
  let lastError;
  for (const url of GEOJSON_URLS) {
    try { const response = await fetch(url); if (!response.ok) throw Error(`HTTP ${response.status}`);
      const data = await response.json();
      if (!Array.isArray(data.features) || data.features.length !== 77) throw Error('GeoJSON ไม่มี 77 จังหวัด');
      return data;
    } catch (e) { lastError = e; }
  }
  throw lastError || new Error('ไม่สามารถดาวน์โหลดแผนที่');
}
async function initialize() {
  attachFilters();
  try {
    const [data, geo] = await Promise.all([fetch('data/incidents.json').then(r => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json(); }), fetchGeoJson()]);
    state.events = data.incidents;
    if (!Array.isArray(data.provinces) || data.provinces.length !== 77 || new Set(data.provinces.map(p => p.province_code)).size !== 77) throw new Error('ทะเบียนจังหวัดไม่ครบ 77');
    state.features = geo.features;
    for (const e of state.events) {
      e.province_code = String(e.province_code).padStart(2, '0');
      if (!STATUS[e.status]) throw new Error(`ไม่รู้จักสถานะ ${e.status}`);
      if (!['water', 'air'].includes(e.layer)) throw new Error(`ไม่รู้จักชั้นข้อมูล ${e.id}`);
      if (!/^https:\/\//.test(e.source_url)) throw new Error(`ไม่รองรับ URL แหล่งข้อมูล ${e.id}`);
      const list = state.byCode.get(e.province_code) || []; list.push(e); state.byCode.set(e.province_code, list);
    }
    state.provinces = geo.features.map(f => ({ code: String(f.properties.code ?? f.properties.pro_code ?? '').padStart(2, '0'), name: String(f.properties.name_th ?? f.properties.pro_th ?? '') }));
    state.provinces.sort((a,b) => a.name.localeCompare(b.name, 'th'));
    const indexed = new Map(data.provinces.map(x => [x.province_code,x.province]));
    for (const p of state.provinces) { if (!indexed.has(p.code)) throw new Error(`รหัสจังหวัดไม่ตรงทะเบียน: ${p.code}`); p.name = indexed.get(p.code); }
    el('province-picker').innerHTML = '<option value="">เลือกจังหวัด (ครบ 77 จังหวัด)</option>' + state.provinces.map(p => `<option value="${escapeHtml(p.code)}">${escapeHtml(p.name)}</option>`).join('');
    if (new Set(state.provinces.map(p => p.code)).size !== 77) throw new Error('รหัสจังหวัดใน GeoJSON ไม่ครบ 77');
    for (const code of state.byCode.keys()) if (!getProvince(code)) throw new Error(`ไม่พบรหัสจังหวัด ${code} ในแผนที่`);
    drawMap();
    const requestedLayer = new URL(location.href).searchParams.get('layer');
    setLayer(['water','air','air-live'].includes(requestedLayer) ? requestedLayer : 'water');
    const requested = new URL(location.href).searchParams.get('province');
    if (requested && getProvince(requested)) { state.selected = requested; el('province-picker').value = requested; }
    renderDetails(); renderRecords(); updateMapColors();
    el('map-loading').hidden = true;
    loadLatestAir();
  } catch (err) {
    console.error('Initialize failed', err);
    el('map-loading').textContent = 'โหลดแผนที่หรือข้อมูลไม่สำเร็จ กรุณาเช็กอินเทอร์เน็ตและรีเฟรชหน้าเว็บ';
    el('results-count').textContent = 'เกิดข้อผิดพลาดในการโหลดข้อมูล';
    el('record-list').innerHTML = '<div class="empty-results">ไม่สามารถเปิดข้อมูลได้ โปรดลองอีกครั้งเมื่อออนไลน์</div>';
  }
}
initialize();