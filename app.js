/* ============================================================================
 * Evaluasi Kinerja Ekspedisi — app.js
 * VERSION: v21 (2026-07-06) — PERUBAHAN ARSITEKTUR BESAR: generate PPTX
 *          dipindah TOTAL dari browser (pptxgenjs) ke SERVER (Google Slides
 *          API via Code.gs). Setelah pptxgenjs terbukti punya 4 bug bawaan
 *          berbeda yang berturut-turut bikin PowerPoint minta "Repair"
 *          (Content_Types phantom refs, chart relationship path absolut,
 *          orphan axId, ID shape bentrok) — dan bahkan setelah SEMUA itu
 *          diperbaiki & diverifikasi lolos 18 kategori pengecekan, tetap
 *          masih ada laporan "Repair" — diputuskan pindah total ke mesin
 *          resmi Google (Slides API + export ke .pptx via Drive), yang jauh
 *          lebih andal drpd library pihak ketiga.
 *          Efek samping bagus: file app.js sekarang jauh lebih KECIL (dari
 *          ~585 KB jadi ~35 KB) karena tidak perlu lagi nyimpen gambar
 *          background/logo dalam base64 — ini juga bikin file lebih gampang
 *          dibuka di editor teks biasa (dulu sering gagal dibuka Notepad).
 *          Perlu Code.gs v16 (backend baru dgn action=pptx).
 * VERSION HISTORY:
 *   v20 — fix bug ke-4: ID shape bentrok
 *   v19 — fix bug ke-3: axId hantu di chart kombo + target FAM jadi 100%
 *   v18 — formula Mutu dipastikan, missDetail dipisah jadi 3 objek independen
 *   v17 — slide PPTX Mutu tidak tampilkan kolom Miss
 *   v16 — Mutu punya array bulanan sendiri (copy independen dari FAM)
 *   v15 — tabel miss tampilkan kolom Komponen + data komplain Reliability
 *   v14 — fix 2 bug PPTX: Content_Types.xml phantom refs + chart
 *        relationship path absolut
 *   v13 — tambah "Analisa Pencapaian" (ringkasan naratif otomatis)
 *   v12 — fix formula: Mutu = persentase Hit Tiba di FAM
 *   v11 — kartu ranking kedua pakai data Tiba di FAM (bukan Reliability)
 *   v10 — ranking dipisah per kategori (Truck/Darat vs Kontener/Laut)
 *   v9 — tambah tabel data mentah (Bulan|Hit|Miss|Plan|%) di bawah tiap
 *        chart + kartu ranking
 *   v8 — fix Content_Types.xml phantom slideMaster refs
 *   v7 — rewrite writeFile jadi re-zip manual (fix folder kosong & kompresi)
 *   v6 — fix null values in chart + dynamic axis scale + long name overlap
 *   v5 — fix timezone bug fmtDate() + cache-busting fetch()
 *   v4 — ganti jalur utama fetch data dari JSONP ke fetch() langsung
 *   v3 — tambah tombol "Tes Koneksi" (fetch + JSONP diagnostik)
 *   v2 — dropdown pilih ekspedisi langsung, data label di chart, mock miss
 *        detail bervariasi, tambah slide penutup "Terima Kasih" di PPTX
 *   v1 — rilis awal: dashboard, generate PPTX, mode Data Contoh
 *   FIX PENTING: gradeColor() dulu ada bug format warna (grade C beda format,
 *        bikin PPTX korup) — sudah diperbaiki sejak v2.
 *   FIX PENTING: constructor pptxgenjs browser adalah `PptxGenJS` (bukan
 *        `pptxgen`) — sudah diperbaiki sejak v2.
 * Frontend logic: fetch dari GAS Web App (JSONP), render dashboard,
 * generate PPTX persis format Volt Exp/TSA (background & logo dari
 * template PT. UNIFAM "Bangkit Bersama").
 * ============================================================================ */

const COLORS = {
  navy: '21295C', deep: '065A82', teal: '1C7293', mint: '5FC9A8',
  green: '1E8F5F', red: 'C0392B', grey: '5B6B79', light: 'F4F8FA', white: 'FFFFFF'
};
const TARGETS = { mutu: 100, fam: 100, distributor: 98, reliability: 100 };
const WEIGHTS = { mutu: 0.10, fam: 0.20, distributor: 0.50, reliability: 0.20 };

let apiUrl = localStorage.getItem('evalEkspedisi_apiUrl') || '';
let currentDetail = null;
let currentList = []; // daftar lengkap semua ekspedisi (dari action=list terakhir), dipakai utk hitung ranking
let jsonpCounter = 0;

// ---------------------------------------------------------------------------
// Settings panel
// ---------------------------------------------------------------------------
document.getElementById('settingsBtn').onclick = () => {
  const p = document.getElementById('settingsPanel');
  p.style.display = p.style.display === 'none' ? 'block' : 'none';
  document.getElementById('apiUrlInput').value = apiUrl;
};
document.getElementById('saveApiUrl').onclick = () => {
  apiUrl = document.getElementById('apiUrlInput').value.trim();
  localStorage.setItem('evalEkspedisi_apiUrl', apiUrl);
  alert('URL tersimpan.');
};

document.getElementById('testApiBtn').onclick = async () => {
  const out = document.getElementById('testApiResult');
  const testUrl = document.getElementById('apiUrlInput').value.trim();
  out.textContent = 'Menguji koneksi...';

  if (!testUrl) { out.textContent = '⚠ URL kosong.'; return; }

  // 1) Coba fetch() biasa dulu — kalau CORS diblokir, errornya jelas kelihatan
  try {
    const res = await fetch(testUrl + (testUrl.includes('?') ? '&' : '?') + 'action=expeditions', { mode: 'cors' });
    const text = await res.text();
    out.textContent = '✅ fetch() BERHASIL (status ' + res.status + ')\n' + text.slice(0, 300);
    return;
  } catch (fetchErr) {
    out.textContent = '⚠ fetch() gagal (' + fetchErr.message + ').\nMencoba JSONP...\n';
  }

  // 2) Fallback: JSONP dengan diagnostik lebih detail
  try {
    const cbName = 'jsonp_test_' + Date.now();
    const result = await new Promise((resolve, reject) => {
      const script = document.createElement('script');
      const sep = testUrl.includes('?') ? '&' : '?';
      const fullUrl = testUrl + sep + 'action=expeditions&callback=' + cbName;
      const timeout = setTimeout(() => { cleanup(); reject(new Error('Timeout 15 detik — script tidak pernah selesai load. URL yang dicoba:\n' + fullUrl)); }, 15000);
      function cleanup() { clearTimeout(timeout); delete window[cbName]; if (script.parentNode) script.parentNode.removeChild(script); }
      window[cbName] = (data) => { cleanup(); resolve(data); };
      script.onerror = (ev) => { cleanup(); reject(new Error('Script gagal dimuat (network-level error). URL:\n' + fullUrl)); };
      script.src = fullUrl;
      document.body.appendChild(script);
    });
    out.textContent += '✅ JSONP BERHASIL:\n' + JSON.stringify(result).slice(0, 300);
  } catch (jsonpErr) {
    out.textContent += '❌ JSONP GAGAL: ' + jsonpErr.message;
  }
};

// Default periode: Q berjalan (3 bulan terakhir termasuk bulan ini)
(function setDefaultPeriod() {
  const now = new Date();
  const from = new Date(now.getFullYear(), now.getMonth() - 2, 1);
  document.getElementById('fromMonth').value = from.toISOString().slice(0, 7);
  document.getElementById('toMonth').value = now.toISOString().slice(0, 7);
})();

// ---------------------------------------------------------------------------
// Fetch helper — pakai fetch() langsung (sudah terkonfirmasi jalan begitu
// deployment Apps Script di-set "Who has access: Anyone"). JSONP disimpan
// sbg fallback kalau suatu saat fetch() diblokir (mis. browser/proxy aneh).
// ---------------------------------------------------------------------------
async function apiFetch(url) {
  if (!apiUrl) throw new Error('URL Web App belum diatur. Tekan ⚙︎ di kanan atas.');
  // Cache-busting: browser bisa nyimpen cache hasil fetch() berdasarkan URL,
  // dan kalau ada percobaan sebelumnya yang gagal/parsial ke-cache, request
  // berikutnya bisa dapat hasil basi. Tambahkan param unik tiap panggilan +
  // cache:'no-store' supaya SELALU ambil data segar dari server.
  const sep = url.includes('?') ? '&' : '?';
  const bustedUrl = url + sep + '_ts=' + Date.now();
  try {
    const res = await fetch(bustedUrl, { mode: 'cors', cache: 'no-store' });
    if (!res.ok) throw new Error('HTTP ' + res.status);
    return await res.json();
  } catch (fetchErr) {
    // Fallback ke JSONP kalau fetch() gagal (mis. CORS diblokir sesuatu)
    return jsonpFetch(bustedUrl);
  }
}
function jsonpFetch(url) {
  return new Promise((resolve, reject) => {
    if (!apiUrl) { reject(new Error('URL Web App belum diatur. Tekan ⚙︎ di kanan atas.')); return; }
    const cbName = 'jsonp_cb_' + (jsonpCounter++);
    const script = document.createElement('script');
    const timeout = setTimeout(() => { cleanup(); reject(new Error('Timeout memuat data (30 detik).')); }, 30000);
    function cleanup() {
      clearTimeout(timeout);
      delete window[cbName];
      if (script.parentNode) script.parentNode.removeChild(script);
    }
    window[cbName] = (data) => { cleanup(); resolve(data); };
    const sep = url.indexOf('?') === -1 ? '?' : '&';
    script.src = url + sep + 'callback=' + cbName;
    script.onerror = () => { cleanup(); reject(new Error('Gagal memuat script dari Web App.')); };
    document.body.appendChild(script);
  });
}

function monthInputToDate(val, endOfMonth) {
  const [y, m] = val.split('-').map(Number);
  return endOfMonth ? new Date(y, m, 0) : new Date(y, m - 1, 1);
}

function fmtDate(d) {
  // PENTING: jangan pakai toISOString() di sini — itu konversi ke UTC dan bisa
  // menggeser tanggal mundur/maju 1 hari tergantung timezone browser (mis. WIB
  // = UTC+7), yang bisa memotong data di batas awal/akhir bulan.
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

// ---------------------------------------------------------------------------
// LIST VIEW
// ---------------------------------------------------------------------------
document.getElementById('loadBtn').onclick = loadList;

async function loadList() {
  const fromVal = document.getElementById('fromMonth').value;
  const toVal = document.getElementById('toMonth').value;
  if (!fromVal || !toVal) { alert('Isi periode dari-sampai dulu.'); return; }
  const from = fmtDate(monthInputToDate(fromVal, false));
  const to = fmtDate(monthInputToDate(toVal, true));

  const statusEl = document.getElementById('listStatus');
  const container = document.getElementById('listContainer');
  statusEl.style.display = 'block';
  statusEl.textContent = 'Memuat data dari Google Sheets...';
  container.innerHTML = '';

  try {
    const url = `${apiUrl}?action=list&from=${from}&to=${to}`;
    const res = await apiFetch(url);
    if (res.error) throw new Error(res.error);
    statusEl.style.display = 'none';
    renderList(res.data, fromVal, toVal);
  } catch (e) {
    statusEl.textContent = '⚠ ' + e.message;
  }
}

function gradeColor(grade) {
  return { A: COLORS.green, B: COLORS.teal, C: 'B8860B', D: COLORS.red }[grade] || COLORS.grey;
}

function renderList(list, fromVal, toVal) {
  currentList = list || [];
  const container = document.getElementById('listContainer');
  if (!list || !list.length) {
    container.innerHTML = '<div class="empty">Tidak ada data ekspedisi pada periode ini.</div>';
    populateExpedisiSelect([]);
    return;
  }
  container.innerHTML = list.map(item => `
    <div class="card" data-nama="${escapeHtml(item.ekspedisi)}" data-from="${fromVal}" data-to="${toVal}">
      <div class="grade-badge" style="background:#${gradeColor(item.grade)}">${item.grade || '-'}</div>
      <div class="card-body">
        <div class="card-title">${escapeHtml(item.ekspedisi)}</div>
        <div class="card-sub">Mutu ${fmtPct(item.mutu)} · Distributor ${fmtPct(item.distributor)} · Reliability ${fmtPct(item.reliability)}</div>
        <span class="chip">${escapeHtml(item.kategori || '-')}</span>
      </div>
      <div class="card-score">${item.totalSementara != null ? item.totalSementara.toFixed(2) + '%' : '-'}</div>
    </div>
  `).join('');

  container.querySelectorAll('.card').forEach(card => {
    card.onclick = () => openDetail(card.dataset.nama, card.dataset.from, card.dataset.to);
  });

  populateExpedisiSelect(list.map(item => item.ekspedisi), fromVal, toVal);
}

function populateExpedisiSelect(names, fromVal, toVal) {
  const sel = document.getElementById('expedisiSelect');
  sel.innerHTML = '<option value="">Pilih ekspedisi langsung...</option>' +
    names.map(n => `<option value="${escapeHtml(n)}">${escapeHtml(n)}</option>`).join('');
  sel.dataset.from = fromVal || '';
  sel.dataset.to = toVal || '';
}

document.getElementById('goExpedisiBtn').onclick = () => {
  const sel = document.getElementById('expedisiSelect');
  const nama = sel.value;
  if (!nama) { alert('Pilih ekspedisi dulu dari daftar dropdown (muat data / data contoh dulu kalau dropdown masih kosong).'); return; }
  openDetail(nama, sel.dataset.from, sel.dataset.to);
};

function fmtPct(v) { return v == null ? '-' : v.toFixed(1) + '%'; }
function escapeHtml(s) { return String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }

// ---------------------------------------------------------------------------
// DETAIL VIEW
// ---------------------------------------------------------------------------
document.getElementById('backBtn').onclick = () => {
  document.getElementById('detailView').style.display = 'none';
  document.getElementById('listView').style.display = 'block';
};

async function openDetail(nama, fromVal, toVal) {
  const from = fmtDate(monthInputToDate(fromVal, false));
  const to = fmtDate(monthInputToDate(toVal, true));

  document.getElementById('listView').style.display = 'none';
  document.getElementById('detailView').style.display = 'block';
  document.getElementById('detailNama').textContent = 'Memuat...';

  try {
    const url = `${apiUrl}?action=detail&expedisi=${encodeURIComponent(nama)}&from=${from}&to=${to}`;
    const res = await apiFetch(url);
    if (res.error) throw new Error(res.error);
    currentDetail = res;
    renderDetail(res);
  } catch (e) {
    document.getElementById('detailNama').textContent = nama;
    document.getElementById('detailPeriode').textContent = '⚠ ' + e.message;
  }
}

function kpiColor(pct, target) {
  if (pct == null) return COLORS.grey;
  return pct >= target ? COLORS.green : COLORS.red;
}

function renderDetail(d) {
  const r = d.ringkasan;
  document.getElementById('detailNama').textContent = d.ekspedisi;
  document.getElementById('detailKategori').textContent = periodeLabel(d.periode);
  document.getElementById('detailPeriode').textContent = periodeLabel(d.periode);

  const gradeBadge = document.getElementById('detailGradeBadge');
  gradeBadge.style.background = '#' + gradeColor(r.grade);
  gradeBadge.querySelector('span').textContent = r.grade || '-';

  setKpi('kMutu', 'tMutu', r.mutu.pct, r.mutu.target);
  setKpi('kFam', 'tFam', r.fam.pct, r.fam.target);
  setKpi('kDist', 'tDist', r.distributor.pct, r.distributor.target);
  setKpi('kRel', 'tRel', r.reliability.pct, r.reliability.target);

  drawTrendChart('chartFam', d.bulanan.fam, r.fam.target);
  drawTrendChart('chartDist', d.bulanan.distributor, r.distributor.target);
  drawTrendChart('chartRel', d.bulanan.reliability, r.reliability.target);

  fillDataTable('tableFam', d.bulanan.fam);
  fillDataTable('tableDist', d.bulanan.distributor);
  fillDataTable('tableRel', d.bulanan.reliability);

  renderRanking(d.ekspedisi, d.kategori || findKategoriInList(d.ekspedisi));
  renderAnalysis(d, r);

  fillMissTable('missTableFam', 'missEmptyFam', d.missDetail && d.missDetail.fam);
  fillMissTable('missTableDist', 'missEmptyDist', d.missDetail && d.missDetail.distributor);
  fillMissTable('missTableRel', 'missEmptyRel', d.missDetail && d.missDetail.reliability);
}

// Render 1 tabel detail-miss utk 1 komponen SAJA (tidak digabung dgn komponen lain)
function fillMissTable(tableId, emptyId, rows) {
  const tbody = document.querySelector(`#${tableId} tbody`);
  const emptyEl = document.getElementById(emptyId);
  if (rows && rows.length) {
    tbody.innerHTML = rows.map(m => `
      <tr>
        <td>${escapeHtml(m.bulan)}</td>
        <td>${escapeHtml(m.tujuan)}</td>
        <td>${escapeHtml(m.eta)}</td>
        <td>${escapeHtml(m.ata)}</td>
        <td>${escapeHtml(m.keterangan)}</td>
      </tr>`).join('');
    document.getElementById(tableId).style.display = 'table';
    emptyEl.style.display = 'none';
  } else {
    document.getElementById(tableId).style.display = 'none';
    emptyEl.style.display = 'block';
  }
}

function findKategoriInList(ekspedisiName) {
  const found = (currentList || []).find(item => item.ekspedisi === ekspedisiName);
  return found ? found.kategori : null;
}

function renderAnalysis(d, r) {
  const container = document.getElementById('analysisContent');
  const points = [];

  // 1) Verdict keseluruhan
  const gradeVerdict = { A: 'sangat baik', B: 'baik', C: 'cukup, perlu perhatian', D: 'kurang, perlu tindak lanjut segera' }[r.grade] || 'belum bisa dinilai (data belum lengkap)';
  if (r.totalSkor != null) {
    points.push(`Secara keseluruhan, performa <b>${escapeHtml(d.ekspedisi)}</b> pada periode ini <b>${gradeVerdict}</b> dengan skor total <b>${r.totalSkor.toFixed(2)}%</b> (Grade ${r.grade}).`);
  } else {
    points.push(`Skor total belum bisa dihitung karena ada komponen yang datanya belum lengkap.`);
  }

  // 2) Komponen yang capai target vs tidak
  const components = [
    { label: 'Mutu', pct: r.mutu.pct, target: r.mutu.target },
    { label: 'Tiba di FAM', pct: r.fam.pct, target: r.fam.target },
    { label: 'Tiba di Distributor', pct: r.distributor.pct, target: r.distributor.target },
    { label: 'Reliability', pct: r.reliability.pct, target: r.reliability.target }
  ];
  const tercapai = components.filter(c => c.pct != null && c.pct >= c.target);
  const belumTercapai = components.filter(c => c.pct != null && c.pct < c.target);
  const tanpaData = components.filter(c => c.pct == null);

  if (tercapai.length) {
    points.push(`Komponen yang <b>sudah mencapai target</b>: ${tercapai.map(c => `${c.label} (${c.pct.toFixed(2)}%)`).join(', ')}.`);
  }
  if (belumTercapai.length) {
    const sorted = [...belumTercapai].sort((a, b) => (a.pct - a.target) - (b.pct - b.target));
    const worst = sorted[0];
    points.push(`Komponen yang <b style="color:#${COLORS.red};">belum mencapai target</b>: ${belumTercapai.map(c => `${c.label} (${c.pct.toFixed(2)}% dari target ${c.target}%)`).join(', ')}. Yang paling perlu diperhatikan: <b>${worst.label}</b>, selisih ${(worst.target - worst.pct).toFixed(2)} poin di bawah target.`);
  }
  if (tanpaData.length) {
    points.push(`Data ${tanpaData.map(c => c.label).join(', ')} belum tersedia utk periode ini.`);
  }

  // 3) Tren bulanan (naik/turun) utk FAM & Distributor
  function trendNote(label, monthly) {
    const withData = (monthly || []).filter(m => m.pct != null);
    if (withData.length < 2) return null;
    const first = withData[0].pct, last = withData[withData.length - 1].pct;
    const diff = last - first;
    if (Math.abs(diff) < 0.5) return `${label} relatif stabil sepanjang periode (${first.toFixed(1)}% → ${last.toFixed(1)}%).`;
    if (diff > 0) return `${label} <b style="color:#${COLORS.green};">membaik</b> dari ${first.toFixed(1)}% (${withData[0].bulan}) menjadi ${last.toFixed(1)}% (${withData[withData.length-1].bulan}).`;
    return `${label} <b style="color:#${COLORS.red};">menurun</b> dari ${first.toFixed(1)}% (${withData[0].bulan}) menjadi ${last.toFixed(1)}% (${withData[withData.length-1].bulan}).`;
  }
  const trendFam = trendNote('Tiba di FAM', d.bulanan.fam);
  const trendDist = trendNote('Tiba di Distributor', d.bulanan.distributor);
  if (trendFam) points.push(trendFam);
  if (trendDist) points.push(trendDist);

  // 4) Root cause paling sering, dihitung per komponen (data terpisah, tidak digabung)
  const missFam = (d.missDetail && d.missDetail.fam) || [];
  const missDist = (d.missDetail && d.missDetail.distributor) || [];
  const missRel = (d.missDetail && d.missDetail.reliability) || [];
  const totalMissCount = missFam.length + missDist.length + missRel.length;

  if (totalMissCount) {
    const parts = [];
    if (missDist.length) parts.push(`${missDist.length} miss Tiba di Distributor`);
    if (missFam.length) parts.push(`${missFam.length} miss Tiba di FAM`);
    if (missRel.length) parts.push(`${missRel.length} komplain Reliability`);
    points.push(`Tercatat total <b>${totalMissCount} kejadian</b> pada periode ini: ${parts.join(', ')}.`);

    function topCauseOf(rows) {
      if (!rows.length) return null;
      const counts = {};
      rows.forEach(m => {
        const key = (m.kategoriIssue || m.keterangan || 'Lainnya').trim() || 'Lainnya';
        counts[key] = (counts[key] || 0) + 1;
      });
      const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1]);
      return sorted[0];
    }
    const topDist = topCauseOf(missDist);
    if (topDist) points.push(`Penyebab miss Distributor paling sering: <b>${escapeHtml(topDist[0])}</b> (${topDist[1]} kejadian).`);
  } else {
    points.push(`Tidak ada kejadian miss tercatat pada periode ini — performa Delivery Time & Reliability bersih dari insiden.`);
  }

  container.innerHTML = '<ul style="margin:0;padding-left:18px;">' + points.map(p => `<li style="margin-bottom:8px;">${p}</li>`).join('') + '</ul>';
}

function fillDataTable(tableId, monthly) {
  const tbody = document.querySelector(`#${tableId} tbody`);
  if (!monthly || !monthly.length) {
    tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;color:var(--grey);">Tidak ada data</td></tr>';
    return;
  }
  let sumHit = 0, sumMiss = 0, sumPlan = 0;
  const rows = monthly.map(m => {
    sumHit += m.hit || 0; sumMiss += m.miss || 0; sumPlan += m.plan || 0;
    return `<tr>
      <td>${escapeHtml(m.bulan)}</td>
      <td>${m.hit}</td>
      <td style="color:${m.miss > 0 ? '#' + COLORS.red : 'inherit'};font-weight:${m.miss > 0 ? '700' : '400'};">${m.miss}</td>
      <td>${m.plan}</td>
      <td style="font-weight:700;">${m.pct != null ? m.pct.toFixed(2) + '%' : '-'}</td>
    </tr>`;
  }).join('');
  const totalPct = sumPlan ? ((sumHit / sumPlan) * 100).toFixed(2) + '%' : '-';
  tbody.innerHTML = rows + `<tr style="background:var(--light);font-weight:700;">
    <td>Jumlah</td><td>${sumHit}</td><td>${sumMiss}</td><td>${sumPlan}</td><td>${totalPct}</td>
  </tr>`;
}

// Hitung ranking 1 ekspedisi HANYA dibanding ekspedisi lain dalam kategori
// yang sama (Truck/Darat vs Kontener/Laut) — biar adil, karena skor kedua
// kategori ini biasanya beda karakteristik.
function computeRank(list, ekspedisiName, field, kategori) {
  const sameCategory = kategori
    ? list.filter(item => normalizeKategori(item.kategori) === normalizeKategori(kategori))
    : list;
  const valid = sameCategory.filter(item => item[field] != null);
  if (!valid.length) return null;
  const sorted = [...valid].sort((a, b) => b[field] - a[field]);
  const idx = sorted.findIndex(item => item.ekspedisi === ekspedisiName);
  if (idx === -1) return null;
  return { rank: idx + 1, total: sorted.length, value: sorted[idx][field] };
}

// Samakan variasi penulisan kategori (Truck/Darat, Kontener/Laut, dll) jadi
// satu bentuk baku, supaya "Truck" dan "Darat" dianggap kategori yang sama.
function normalizeKategori(kategori) {
  const k = String(kategori || '').trim().toLowerCase();
  if (k.includes('truck') || k.includes('darat')) return 'darat';
  if (k.includes('kontener') || k.includes('container') || k.includes('laut')) return 'laut';
  return k;
}

function kategoriLabel(kategori) {
  const norm = normalizeKategori(kategori);
  if (norm === 'darat') return 'Truck/Darat';
  if (norm === 'laut') return 'Kontener/Laut';
  return kategori || '-';
}

function renderRanking(ekspedisiName, kategori) {
  const container = document.getElementById('rankingContent');
  if (!currentList || !currentList.length) {
    container.innerHTML = '<div style="color:var(--grey);font-size:13px;">Muat daftar semua ekspedisi dulu (lewat halaman utama) supaya ranking bisa dihitung.</div>';
    return;
  }
  const rankDist = computeRank(currentList, ekspedisiName, 'distributor', kategori);
  const rankFam = computeRank(currentList, ekspedisiName, 'fam', kategori);
  const catLabel = kategoriLabel(kategori);

  function badge(label, rankInfo) {
    if (!rankInfo) return `<div class="rank-badge"><div class="rank-label">${label}</div><div class="rank-note">Data tidak tersedia</div></div>`;
    const isTop = rankInfo.rank <= Math.ceil(rankInfo.total * 0.25);
    const color = isTop ? COLORS.green : (rankInfo.rank > rankInfo.total * 0.75 ? COLORS.red : COLORS.teal);
    return `<div class="rank-badge">
      <div class="rank-label">${label}</div>
      <div class="rank-value" style="color:#${color};">#${rankInfo.rank} <b>dari ${rankInfo.total} ekspedisi</b></div>
      <div class="rank-note">Skor: ${rankInfo.value.toFixed(2)}% · Kategori: ${escapeHtml(catLabel)}</div>
    </div>`;
  }

  container.innerHTML =
    badge('Tiba di Distributor (DOT)', rankDist) +
    badge('Pemenuhan Armada (Tiba di FAM)', rankFam);
}

function periodeLabel(p) {
  if (!p || !p.from) return '';
  const f = new Date(p.from), t = new Date(p.to);
  const opts = { month: 'long', year: 'numeric' };
  return f.toLocaleDateString('id-ID', opts) + ' – ' + t.toLocaleDateString('id-ID', opts);
}

function setKpi(valId, targetId, pct, target) {
  const el = document.getElementById(valId);
  el.textContent = pct == null ? '-' : pct.toFixed(2) + '%';
  el.style.color = '#' + kpiColor(pct, target);
  document.getElementById(targetId).textContent = 'Target ' + target + '%';
}

let chartInstances = {};
if (window.Chart && window.ChartDataLabels) Chart.register(ChartDataLabels);

function drawTrendChart(canvasId, monthly, target) {
  const ctx = document.getElementById(canvasId).getContext('2d');
  if (chartInstances[canvasId]) chartInstances[canvasId].destroy();
  const labels = monthly.map(m => m.bulan);
  const values = monthly.map(m => m.pct);
  const barColors = values.map(v => '#' + kpiColor(v, target));
  chartInstances[canvasId] = new Chart(ctx, {
    type: 'bar',
    data: {
      labels,
      datasets: [
        { label: 'Pencapaian (%)', data: values, backgroundColor: barColors, borderRadius: 4,
          datalabels: { anchor: 'end', align: 'top', color: '#1A2233', font: { weight: 'bold', size: 11 },
            formatter: (v) => (v == null ? '-' : v.toFixed(2) + '%') } },
        { label: `Target (${target}%)`, data: labels.map(() => target), type: 'line',
          borderColor: '#' + COLORS.grey, borderDash: [6, 4], pointRadius: 0, borderWidth: 1.5,
          datalabels: { display: false } }
      ]
    },
    options: {
      responsive: true,
      layout: { padding: { top: 20 } },
      plugins: {
        legend: { display: true, labels: { font: { size: 10 } } },
        datalabels: { display: true }
      },
      scales: { y: { min: Math.max(0, Math.min(...values, target) - 5), max: 100 } }
    }
  });
}

// ---------------------------------------------------------------------------
// DEMO MODE — data contoh (tidak perlu Web App) utk preview cepat
// ---------------------------------------------------------------------------
document.getElementById('demoBtn').onclick = loadDemo;

function mockMonthly(hitArr, missArr, bulanArr) {
  return bulanArr.map((b, i) => {
    const hit = hitArr[i], miss = missArr[i], plan = hit + miss;
    return { bulan: b, hit, miss, plan, pct: plan ? Math.round((hit / plan) * 10000) / 100 : null };
  });
}

const MISS_SAMPLES = [
  { tujuan: 'PT. Triyanto Sukses Mandiri – CIAMIS (UF-A)', eta: '17 Apr 26', ata: 'B 9615 KRV', keterangan: 'Mobil trouble' },
  { tujuan: 'CV. Tiga Saudara – YOGYAKARTA (UF-D)', eta: '7 Mei 26', ata: 'DK 8267 DM', keterangan: 'Mobil trouble' },
  { tujuan: 'PT. Sedulur Sukses Sejahtera – BARABAI', eta: '2 Apr 26', ata: 'B 9021 TRC', keterangan: 'Ban pecah di jalan' },
  { tujuan: 'CV. Berkah Jaya – SURABAYA', eta: '14 Mei 26', ata: 'L 8123 KJ', keterangan: 'Macet parah (banjir)' },
  { tujuan: 'PT. Fonusa Distribusi – SEMARANG', eta: '28 Jun 26', ata: 'B 7744 UNF', keterangan: 'Terlambat muat di gudang asal' },
  { tujuan: 'CV. Mitra Logistik – DENPASAR', eta: '9 Apr 26', ata: 'DK 1122 AB', keterangan: 'Kendala penyeberangan Ketapang-Gilimanuk' },
];

function buildMockDetail(nama, kategori, famMiss, distMiss) {
  const bulan = ['April', 'Mei', 'Juni'];
  const hitFam = [33, 34, 31], missFam = famMiss;
  const hitDist = [31, 33, 31], missDist = distMiss;
  const hitPa = [32, 34, 31], missPa = [0, 0, 0];
  const famMonthly = mockMonthly(hitFam, missFam, bulan);
  const distMonthly = mockMonthly(hitDist, missDist, bulan);
  const paMonthly = mockMonthly(hitPa, missPa, bulan);
  const famPct = avgPct(famMonthly), distPct = avgPct(distMonthly), paPct = avgPct(paMonthly);
  const famTotalHit = sumArr(hitFam);
  // Mutu = Hit Tiba di FAM apa adanya, Miss SELALU 0 (terpisah dari Miss FAM)
  const mutuPct = famTotalHit > 0 ? 100 : null;
  const mutuMonthly = famMonthly.map(m => ({ bulan: m.bulan, hit: m.hit, miss: 0, plan: m.hit, pct: m.hit > 0 ? 100 : null }));
  const total = Math.round(((mutuPct || 0) * WEIGHTS.mutu + WEIGHTS.fam * famPct + WEIGHTS.distributor * distPct + WEIGHTS.reliability * paPct) * 100) / 100;

  // Detail miss dipisah per komponen (TIDAK digabung jadi satu array)
  let seed = 0;
  for (let i = 0; i < nama.length; i++) seed += nama.charCodeAt(i); // offset biar variatif per-ekspedisi

  const missDetailFam = [];
  for (let i = 0; i < sumArr(missFam); i++) {
    const sample = MISS_SAMPLES[(seed + i) % MISS_SAMPLES.length];
    missDetailFam.push({ bulan: bulan[i % bulan.length], tujuan: sample.tujuan, eta: sample.eta, ata: sample.ata, keterangan: sample.keterangan });
  }
  const missDetailDist = [];
  for (let i = 0; i < sumArr(missDist); i++) {
    const sample = MISS_SAMPLES[(seed + i + 3) % MISS_SAMPLES.length];
    missDetailDist.push({ bulan: bulan[i % bulan.length], tujuan: sample.tujuan, eta: sample.eta, ata: sample.ata, keterangan: sample.keterangan });
  }
  const missDetailRel = []; // demo: anggap tidak ada komplain reliability drpd bikin data contoh terlalu ramai

  return {
    ekspedisi: nama,
    periode: { from: '2026-04-01', to: '2026-06-30' },
    ringkasan: {
      mutu: { pct: mutuPct, target: TARGETS.mutu },
      fam: { hit: sumArr(hitFam), miss: sumArr(missFam), plan: sumArr(hitFam) + sumArr(missFam), pct: famPct, target: TARGETS.fam },
      distributor: { hit: sumArr(hitDist), miss: sumArr(missDist), plan: sumArr(hitDist) + sumArr(missDist), pct: distPct, target: TARGETS.distributor },
      reliability: { hit: sumArr(hitPa), miss: sumArr(missPa), plan: sumArr(hitPa) + sumArr(missPa), pct: paPct, target: TARGETS.reliability },
      totalSkor: total,
      grade: total >= 97 ? 'A' : total >= 94 ? 'B' : total >= 91 ? 'C' : 'D'
    },
    bulanan: { mutu: mutuMonthly, fam: famMonthly, distributor: distMonthly, reliability: paMonthly },
    missDetail: { fam: missDetailFam, distributor: missDetailDist, reliability: missDetailRel },
    kategori
  };
}
function sumArr(a) { return a.reduce((s, x) => s + x, 0); }
function avgPct(monthly) {
  const h = sumArr(monthly.map(m => m.hit)), p = sumArr(monthly.map(m => m.plan));
  return p ? Math.round((h / p) * 10000) / 100 : null;
}

const MOCK_EXPEDITIONS = [
  buildMockDetail('Volt Exp', 'Truck', [0, 0, 0], [1, 1, 0]),
  buildMockDetail('Bangka Jaya Line', 'Kontener', [0, 0, 0], [0, 0, 0]),
  buildMockDetail('TSA', 'Truck', [0, 0, 0], [0, 1, 0]),
  buildMockDetail('KKL', 'Kontener', [1, 0, 1], [2, 1, 0]),
  buildMockDetail('Alexindo', 'Kontener', [2, 3, 1], [3, 2, 2]),
];

function loadDemo() {
  document.getElementById('fromMonth').value = '2026-04';
  document.getElementById('toMonth').value = '2026-06';
  document.getElementById('listStatus').style.display = 'none';
  const list = MOCK_EXPEDITIONS.map(d => ({
    ekspedisi: d.ekspedisi,
    kategori: d.kategori,
    mutu: d.ringkasan.mutu.pct,
    fam: d.ringkasan.fam.pct,
    distributor: d.ringkasan.distributor.pct,
    reliability: d.ringkasan.reliability.pct,
    totalSementara: d.ringkasan.totalSkor,
    grade: d.ringkasan.grade
  })).sort((a, b) => b.totalSementara - a.totalSementara);
  renderList(list, '2026-04', '2026-06');
  window.__mockLookup = {};
  MOCK_EXPEDITIONS.forEach(d => window.__mockLookup[d.ekspedisi] = d);
}

// Override openDetail utk pakai data mock kalau tersedia
const _origOpenDetail = openDetail;
openDetail = async function (nama, fromVal, toVal) {
  if (window.__mockLookup && window.__mockLookup[nama]) {
    document.getElementById('listView').style.display = 'none';
    document.getElementById('detailView').style.display = 'block';
    currentDetail = window.__mockLookup[nama];
    renderDetail(currentDetail);
    return;
  }
  return _origOpenDetail(nama, fromVal, toVal);
};

document.getElementById('printBtn').onclick = () => window.print();

// ---------------------------------------------------------------------------
// PPTX EXPORT — sekarang di-generate di SERVER (Google Slides API via
// Code.gs), BUKAN di browser pakai pptxgenjs lagi. Setelah pptxgenjs
// terbukti punya banyak bug bawaan (Content_Types phantom refs, chart
// relationship path absolut, orphan axId, ID shape bentrok) yang bikin
// PowerPoint terus minta "Repair", generate PPTX dipindah ke backend yang
// pakai mesin resmi Google (lebih andal). Frontend di sini cuma minta hasil
// base64-nya lalu memicu download.
// ---------------------------------------------------------------------------
document.getElementById('pptxBtn').onclick = () => generatePptx(currentDetail);

async function generatePptx(d) {
  if (!d) return;
  const btn = document.getElementById('pptxBtn');
  btn.textContent = 'Membuat PPTX di server...';
  btn.disabled = true;

  try {
    if (window.__mockLookup && window.__mockLookup[d.ekspedisi]) {
      throw new Error('Mode "Data Contoh" tidak bisa generate PPTX asli (perlu data dari Google Sheets). Coba pakai "Muat Data" dulu.');
    }
    const from = d.periode.from ? d.periode.from.slice(0, 10) : '';
    const to = d.periode.to ? d.periode.to.slice(0, 10) : '';
    const url = `${apiUrl}?action=pptx&expedisi=${encodeURIComponent(d.ekspedisi)}&from=${from}&to=${to}`;
    const res = await apiFetch(url);
    if (res.error) throw new Error(res.error);
    if (!res.base64 || !res.fileName) throw new Error('Response server tidak lengkap (base64/fileName kosong).');

    // Decode base64 -> Blob -> trigger download
    const byteChars = atob(res.base64);
    const byteNumbers = new Array(byteChars.length);
    for (let i = 0; i < byteChars.length; i++) byteNumbers[i] = byteChars.charCodeAt(i);
    const byteArray = new Uint8Array(byteNumbers);
    const blob = new Blob([byteArray], { type: 'application/vnd.openxmlformats-officedocument.presentationml.presentation' });

    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = res.fileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(a.href), 5000);
  } catch (e) {
    alert('Gagal membuat PPTX: ' + e.message);
    console.error(e);
  } finally {
    btn.textContent = '⬇ Download PPTX';
    btn.disabled = false;
  }
}
