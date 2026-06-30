const DISEASE_COLORS = {
  Measles:'#378ADD', Dengue:'#D85A30', Malaria:'#1D9E75',
  Cholera:'#D4537E', AWD:'#BA7517', TB:'#7F77DD'
};
const HOSP_COLORS = {
  BU:'#378ADD',HG:'#D85A30',EG:'#1D9E75',GH:'#D4537E',
  MC:'#BA7517',BO:'#7F77DD',BE:'#639922',BA:'#888780',SL:'#533AB7'
};

let currentDisease = 'Measles', selectedHospital = null, charts = {};
let RAW = {}; // 原本寫死的資料，現在從 CSV 動態載入

// 載入與解析 CSV
fetch('data.csv')
  .then(res => res.text())
  .then(text => {
    RAW = parseCSV(text);
    buildDiseaseButtons();
    buildFilters();
    renderAll();
  })
  .catch(err => console.error("Error loading CSV:", err));

function parseCSV(text) {
  const data = {};
  const lines = text.trim().split('\n');
  
  for (let i = 1; i < lines.length; i++) {
    if (!lines[i].trim()) continue;
    const [type, disease, key1, key2, countStr] = lines[i].split(',');
    const count = parseInt(countStr, 10);

    if (!data[disease]) {
      data[disease] = { total: 0, weekly_by_hospital: [], monthly: [], by_hospital: [], by_gender: [], by_age: [] };
    }

    if (type === 'Total') data[disease].total = count;
    else if (type === 'Weekly') data[disease].weekly_by_hospital.push({ week: key1, "Hospital Name": key2, count: count });
    else if (type === 'Monthly') data[disease].monthly.push({ month: key1, count: count });
    else if (type === 'Hospital') data[disease].by_hospital.push({ "Hospital Name": key1, count: count });
    else if (type === 'Gender') data[disease].by_gender.push({ Gender: key1, count: count });
    else if (type === 'Age') data[disease].by_age.push({ age_group: key1, count: count });
  }
  return data;
}

function buildDiseaseButtons() {
  const row = document.getElementById('diseaseRow');
  row.innerHTML = '';
  Object.keys(RAW).forEach(d => {
    const b = document.createElement('button');
    b.className = 'd-btn' + (d === currentDisease ? ' active' : '');
    b.textContent = d;
    if (d === currentDisease) b.style.background = DISEASE_COLORS[d];
    b.onclick = () => setDisease(d);
    row.appendChild(b);
  });
}

function setDisease(d) {
  currentDisease = d; selectedHospital = null;
  document.querySelectorAll('.d-btn').forEach(b => {
    const active = b.textContent === d;
    b.classList.toggle('active', active);
    b.style.background = active ? DISEASE_COLORS[d] : '';
  });
  buildFilters(); renderAll();
}

function getHospitals() {
  const s = new Set();
  RAW[currentDisease].weekly_by_hospital.forEach(r => s.add(r['Hospital Name']));
  return [...s].sort();
}

function buildFilters() {
  const row = document.getElementById('filterRow');
  row.innerHTML = '<span class="pill-label">Hospital:</span>';
  const all = document.createElement('button');
  all.className = 'pill active'; all.textContent = 'All';
  all.onclick = () => { selectedHospital = null; updatePills(); renderAll(); };
  row.appendChild(all);
  getHospitals().forEach(h => {
    const p = document.createElement('button');
    p.className = 'pill'; p.textContent = h;
    p.style.borderLeft = '3px solid ' + (HOSP_COLORS[h] || '#888');
    p.onclick = () => { selectedHospital = (selectedHospital === h) ? null : h; updatePills(); renderAll(); };
    row.appendChild(p);
  });
}

function updatePills() {
  document.querySelectorAll('#filterRow .pill').forEach((p, i) => {
    if (i === 0) p.classList.toggle('active', !selectedHospital);
    else p.classList.toggle('active', p.textContent === selectedHospital);
  });
}

function renderStats() {
  const d = RAW[currentDisease];
  let total = d.total, peak = '', peakVal = 0;
  if (selectedHospital) {
    const rows = d.weekly_by_hospital.filter(r => r['Hospital Name'] === selectedHospital);
    total = rows.reduce((s, r) => s + r.count, 0);
    rows.forEach(r => { if (r.count > peakVal) { peakVal = r.count; peak = r.week; } });
  } else {
    const wm = {};
    d.weekly_by_hospital.forEach(r => { wm[r.week] = (wm[r.week] || 0) + r.count; });
    Object.entries(wm).forEach(([w, c]) => { if (c > peakVal) { peakVal = c; peak = w; } });
  }
  const g = d.by_gender, mRow = g.find(x => x.Gender === 'M');
  const mRatio = mRow ? Math.round(mRow.count / g.reduce((s, x) => s + x.count, 0) * 100) : 0;
  const topAge = [...d.by_age].sort((a, b) => b.count - a.count)[0];
  const months = d.monthly;
  const trend = months.length >= 2 ? (months[months.length-1].count > months[months.length-2].count ? 'Rising' : 'Falling') : 'N/A';
  const tColor = trend === 'Rising' ? '#E24B4A' : '#1D9E75';
  const accentColor = DISEASE_COLORS[currentDisease];
  document.getElementById('statsRow').innerHTML = `
    <div class="stat"><div class="stat-label">Total cases</div><div class="stat-value" style="color:${accentColor}">${total.toLocaleString()}</div><div class="stat-sub">${selectedHospital || 'All hospitals'}</div></div>
    <div class="stat"><div class="stat-label">Peak week</div><div class="stat-value" style="font-size:15px">${peak || '—'}</div><div class="stat-sub">${peakVal} cases</div></div>
    <div class="stat"><div class="stat-label">Male ratio</div><div class="stat-value">${mRatio}%</div><div class="stat-sub">of total cases</div></div>
    <div class="stat"><div class="stat-label">Top age group</div><div class="stat-value" style="font-size:16px">${topAge ? topAge.age_group : '—'}</div><div class="stat-sub">${topAge ? topAge.count + ' cases' : ''}</div></div>
    <div class="stat"><div class="stat-label">Monthly trend</div><div class="stat-value" style="font-size:18px;color:${tColor}">${trend}</div><div class="stat-sub">vs previous month</div></div>`;
}

function dc(id) { if (charts[id]) { charts[id].destroy(); delete charts[id]; } }

function renderWeekly() {
  dc('weekly');
  let rows = RAW[currentDisease].weekly_by_hospital;
  if (selectedHospital) rows = rows.filter(r => r['Hospital Name'] === selectedHospital);
  const weeks = [...new Set(rows.map(r => r.week))].sort();
  const hosps = [...new Set(rows.map(r => r['Hospital Name']))].sort();
  const datasets = hosps.map(h => {
    const data = weeks.map(w => { const r = rows.find(x => x.week === w && x['Hospital Name'] === h); return r ? r.count : 0; });
    const dashes = {HG:[5,3],EG:[2,2],BO:[4,2],BE:[6,2]};
    return { label:h, data, borderColor:HOSP_COLORS[h]||'#888', backgroundColor:(HOSP_COLORS[h]||'#888')+'22',
      fill: hosps.length===1, tension:0.3, pointRadius:2, borderWidth:2, borderDash:dashes[h]||[] };
  });
  document.getElementById('legendWeekly').innerHTML = hosps.map(h =>
    `<span class="legend-item"><span class="legend-dot" style="background:${HOSP_COLORS[h]||'#888'}"></span>${h}</span>`).join('');
  charts['weekly'] = new Chart(document.getElementById('chartWeekly'), {
    type:'line', data:{ labels:weeks.map(w=>w.slice(5)), datasets },
    options:{ responsive:true, maintainAspectRatio:false, interaction:{mode:'index',intersect:false},
      plugins:{legend:{display:false}},
      scales:{ x:{ticks:{font:{size:10},autoSkip:true,maxTicksLimit:12}}, y:{ticks:{font:{size:10}}} } }
  });
}

function renderHospital() {
  dc('hosp');
  let rows = RAW[currentDisease].by_hospital;
  if (selectedHospital) rows = rows.filter(r => r['Hospital Name'] === selectedHospital);
  if (!rows.length) { document.getElementById('chartHosp').parentElement.innerHTML = '<div class="zero-msg">No data</div>'; return; }
  const labels = rows.map(r => r['Hospital Name']);
  charts['hosp'] = new Chart(document.getElementById('chartHosp'), {
    type:'bar',
    data:{ labels, datasets:[{ data:rows.map(r=>r.count), backgroundColor:labels.map(l=>HOSP_COLORS[l]||'#888'), borderWidth:0, borderRadius:3 }] },
    options:{ indexAxis:'y', responsive:true, maintainAspectRatio:false,
      plugins:{legend:{display:false}}, scales:{ x:{ticks:{font:{size:10}}}, y:{ticks:{font:{size:11}}} } }
  });
}

function renderAge() {
  dc('age');
  const ages = RAW[currentDisease].by_age;
  const color = DISEASE_COLORS[currentDisease];
  charts['age'] = new Chart(document.getElementById('chartAge'), {
    type:'bar',
    data:{ labels:ages.map(a=>a.age_group), datasets:[{ data:ages.map(a=>a.count), backgroundColor:color+'99', borderColor:color, borderWidth:1, borderRadius:3 }] },
    options:{ responsive:true, maintainAspectRatio:false,
      plugins:{legend:{display:false}}, scales:{ x:{ticks:{font:{size:11}}}, y:{ticks:{font:{size:10}}} } }
  });
}

function renderMonthly() {
  dc('monthly');
  const months = RAW[currentDisease].monthly;
  const color = DISEASE_COLORS[currentDisease];
  charts['monthly'] = new Chart(document.getElementById('chartMonthly'), {
    type:'bar',
    data:{ labels:months.map(m=>m.month), datasets:[{ data:months.map(m=>m.count), backgroundColor:color+'99', borderColor:color, borderWidth:1, borderRadius:4 }] },
    options:{ responsive:true, maintainAspectRatio:false,
      plugins:{legend:{display:false}, tooltip:{callbacks:{label:ctx=>' '+ctx.parsed.y+' cases'}}},
      scales:{ x:{ticks:{font:{size:12}}}, y:{ticks:{font:{size:10}}} } }
  });
}

function renderAll() { renderStats(); renderWeekly(); renderHospital(); renderAge(); renderMonthly(); }