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
  unknown: { label: 'ไม่มีข้อมูลในชุดนี้', color: '#dce5eb', rank: 0, short: 'ไม่มีข้อมูล' }
};
const state = { events: [], provinces: [], byCode: new Map(), features: [], selected: null, filter: 'all', category: 'all', query: '' };
const el = (id) => document.getElementById(id);
const escapeHtml = (v) => String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const norm = (v) => String(v ?? '').toLocaleLowerCase('th-TH').replace(/\s+/g, '').trim();
const svgNS = 'http://www.w3.org/2000/svg';

function getStatus(code) {
  const events = state.byCode.get(String(code)) || [];
  return events.reduce((best, event) => STATUS[event.status].rank > STATUS[best].rank ? event.status : best, 'unknown');
}
function eventsFor(code) { return state.byCode.get(String(code)) || []; }
function getProvince(code) { return state.provinces.find(x => String(x.code) === String(code)); }
function getFilteredCodes() {
  const codes = new Set();
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
  const counts = { exceeded: 0, watch: 0, reported: 0, unknown: 0 };
  state.provinces.forEach(p => counts[getStatus(p.code)]++);
  el('count-all').textContent = String(state.provinces.length || 77);
  el('count-covered').textContent = String(state.provinces.filter(p => eventsFor(p.code).length).length);
  el('count-exceeded').textContent = String(counts.exceeded);
  el('count-reports').textContent = String(state.events.length);
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
  if (province) { const url = new URL(location.href); url.searchParams.set('province', province.code); history.replaceState(null, '', url); }
  if (window.matchMedia('(max-width: 850px)').matches) el('detail-title').scrollIntoView({ behavior: 'smooth', block: 'center' });
}
function statusLabel(status) { return `<span class="detail-status ${escapeHtml(status)}">● ${escapeHtml(STATUS[status].short)}</span>`; }
function renderDetails() {
  const province = getProvince(state.selected);
  el('detail-code').textContent = province ? `TH-${province.code}` : 'TH';
  el('detail-title').textContent = province ? province.name : 'ประเทศไทย';
  if (!province) { el('detail-content').innerHTML = '<p class="detail-intro">เลือกจังหวัดบนแผนที่ หรือค้นหาจากชื่อพื้นที่ เพื่ออ่านรายงานและหลักฐานที่มีอยู่</p><div class="detail-empty"><b>คลิกจังหวัดเพื่อสำรวจ</b>ข้อมูลแยกตามพื้นที่ พร้อมวันที่เก็บตัวอย่างและแหล่งอ้างอิง</div>'; return; }
  const list = eventsFor(province.code);
  if (!list.length) {
    el('detail-content').innerHTML = `${statusLabel('unknown')}<p class="detail-hint">ชุดข้อมูลตัวอย่างยังไม่มีรายงานที่บันทึกสำหรับจังหวัดนี้ <strong>ไม่ใช่ผลยืนยันว่าพื้นที่ปลอดภัย</strong></p><div class="detail-empty"><b>ยังไม่มีข้อมูลในชุดนี้</b>ตรวจสอบผลตรวจล่าสุดจากกรมควบคุมมลพิษได้ที่ลิงก์ด้านล่าง</div><a class="source-button" target="_blank" rel="noopener noreferrer" href="https://iwis.pcd.go.th/dashboard">เปิดแดชบอร์ดกรมควบคุมมลพิษ ↗</a>`;
    return;
  }
  el('detail-content').innerHTML = `${statusLabel(getStatus(province.code))}<p class="detail-hint">บันทึกกรณีศึกษา ${list.length} รายการสำหรับจังหวัดนี้ · กรุณาดูวันที่และข้อจำกัดของหลักฐานแต่ละกรณี</p>` + list.map((e, i) => `<article class="detail-event"><div class="event-topline">CASE ${String(i + 1).padStart(2, '0')} · ${escapeHtml(e.category)}</div><h4>${escapeHtml(e.headline)}</h4><p>${escapeHtml(e.finding)}</p><div class="detail-metadata"><div><small>พื้นที่ / จุดที่ระบุ</small><b>${escapeHtml(e.area)}</b></div><div><small>ช่วงเวลาตรวจ/เหตุการณ์</small><b>${escapeHtml(e.sample_date)}</b></div><div><small>สาร / ประเด็น</small><b>${escapeHtml(e.substance)}</b></div><div><small>วันที่รายงาน</small><b>${escapeHtml(e.report_date)}</b></div></div><a class="source-button" href="${escapeHtml(e.source_url)}" target="_blank" rel="noopener noreferrer">อ่านแหล่งข้อมูลต้นทาง ↗</a><div class="detail-caution"><strong>ข้อจำกัด:</strong> ${escapeHtml(e.limitation)}</div></article>`).join('');
}
function renderRecords() {
  const codes = getFilteredCodes();
  const records = state.events.filter(e => codes.has(e.province_code) && (state.filter === 'all' || state.filter === getStatus(e.province_code)) && (state.category === 'all' || e.category === state.category) && (!state.query || norm([e.province, e.area, e.headline, e.substance, e.finding].join(' ')).includes(norm(state.query))));
  el('results-count').textContent = `แสดง ${records.length} จาก ${state.events.length} รายการ`;
  el('record-list').innerHTML = records.length ? records.map(e => `<article class="record-card"><div class="record-card-top"><span class="record-province">${escapeHtml(e.province)}</span>${statusLabel(e.status)}</div><h4>${escapeHtml(e.headline)}</h4><p>${escapeHtml(e.area)} · ${escapeHtml(e.substance)}</p><div class="record-card-bottom"><span class="record-date">รายงาน ${escapeHtml(e.report_date)}</span><a href="${escapeHtml(e.source_url)}" target="_blank" rel="noopener noreferrer">ดูแหล่งข้อมูล ↗</a></div></article>`).join('') : '<div class="empty-results">ไม่พบรายงานที่ตรงกับตัวกรองนี้ ลองเปลี่ยนสถานะ ประเภท หรือคำค้นหา</div>';
}
function update() { updateMapColors(); renderDetails(); renderRecords(); }
function attachFilters() {
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
    state.features = geo.features;
    for (const e of state.events) {
      e.province_code = String(e.province_code).padStart(2, '0');
      if (!STATUS[e.status]) throw new Error(`ไม่รู้จักสถานะ ${e.status}`);
      if (!/^https:\/\//.test(e.source_url)) throw new Error(`ไม่รองรับ URL แหล่งข้อมูล ${e.id}`);
      const list = state.byCode.get(e.province_code) || []; list.push(e); state.byCode.set(e.province_code, list);
    }
    state.provinces = geo.features.map(f => ({ code: String(f.properties.code ?? f.properties.pro_code ?? '').padStart(2, '0'), name: String(f.properties.name_th ?? f.properties.pro_th ?? '') }));
    state.provinces.sort((a,b) => a.name.localeCompare(b.name, 'th'));
    if (new Set(state.provinces.map(p => p.code)).size !== 77) throw new Error('รหัสจังหวัดใน GeoJSON ไม่ครบ 77');
    for (const code of state.byCode.keys()) if (!getProvince(code)) throw new Error(`ไม่พบรหัสจังหวัด ${code} ในแผนที่`);
    drawMap(); updateStats();
    const requested = new URL(location.href).searchParams.get('province');
    if (requested && getProvince(requested)) state.selected = requested;
    renderDetails(); renderRecords(); updateMapColors();
    el('map-loading').hidden = true;
  } catch (err) {
    console.error('Initialize failed', err);
    el('map-loading').textContent = 'โหลดแผนที่หรือข้อมูลไม่สำเร็จ กรุณาเช็กอินเทอร์เน็ตและรีเฟรชหน้าเว็บ';
    el('results-count').textContent = 'เกิดข้อผิดพลาดในการโหลดข้อมูล';
    el('record-list').innerHTML = '<div class="empty-results">ไม่สามารถเปิดข้อมูลได้ โปรดลองอีกครั้งเมื่อออนไลน์</div>';
  }
}
initialize();
