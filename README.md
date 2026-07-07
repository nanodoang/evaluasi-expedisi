# Evaluasi Kinerja Ekspedisi — Web App

Dashboard multi-ekspedisi + generate PPTX otomatis, terhubung ke spreadsheet
**"Evaluasi expedisi 2026"**.

## Cek Versi File (PENTING)

| File | Versi seharusnya |
|---|---|
| `Code.gs` | `VERSION: v16` |
| `index.html` | `VERSION: v21` (lihat komentar di app.js, index.html tidak selalu naik bareng) |
| `app.js` | `VERSION: v21` — ukurannya sekarang **~35 KB** (jauh lebih kecil dari versi lama yang ~585 KB, karena gambar background sudah tidak di-embed lagi) |

## Perubahan Besar Terbaru: PPTX Sekarang Dibuat di Server

Setelah PPTX yang dibuat di browser (pakai library `pptxgenjs`) berkali-kali
gagal dibuka PowerPoint ("found a problem, click Repair") karena beberapa bug
bawaan library itu sendiri, generate PPTX **dipindah total ke backend**
(`Code.gs`), pakai **Google Slides API** — mesin resmi Google, jauh lebih
andal. Prosesnya:
1. `Code.gs` bikin Google Slides presentation sementara
2. Isi semua slide (tabel, teks, bar chart digambar manual pakai kotak)
3. Export ke `.pptx` lewat Drive
4. Kirim hasilnya (base64) ke dashboard, file sementara di Drive dihapus otomatis
5. Dashboard decode base64 → trigger download

Desainnya sedikit lebih sederhana dari versi lama (tanpa foto background di
cover, chart pakai kotak warna bukan native chart) — tapi jauh lebih **andal**.

## Cara Deploy (sekali saja)

### 1. Pasang backend (Code.gs)
1. Buka spreadsheet **Evaluasi expedisi 2026** di Google Sheets.
2. Menu **Extensions → Apps Script**.
3. Hapus isi default, lalu paste seluruh isi file `Code.gs`.
4. Klik **Deploy → New deployment** (atau kalau update: **Manage deployments
   → ikon pensil → Version: New version**).
   - Type: **Web app**
   - Execute as: **Me**
   - Who has access: **Anyone** ⚠️ (WAJIB "Anyone", bukan "Anyone with
     Google account")
5. Klik **Deploy**, izinkan akses (Authorize) — kali ini mungkin minta izin
   tambahan karena pakai Google Slides & Drive, klik **Allow**.
6. Copy URL Web App (formatnya `https://script.google.com/macros/s/XXXXX/exec`).

**Sebelum deploy**, jalankan dulu fungsi-fungsi ini dari editor Apps Script
(pilih dari dropdown di atas, klik ▶), cek **Execution log**:
- `testConnection` — cek daftar ekspedisi & skor
- `testDetail` — cek detail 1 ekspedisi
- `testGeneratePptx` — **PENTING**: cek generate PPTX bekerja. Hasilnya
  otomatis tersimpan di Google Drive (folder root akun Google Nano) — buka
  Drive utk cek filenya langsung bisa dibuka PowerPoint atau tidak, SEBELUM
  dites lewat dashboard.
- `debugDot`, `debugComplain`, `debugDataMissPa` — kalau ada angka yang aneh

### 2. Pasang frontend (dashboard)
1. Upload `index.html` dan `app.js` ke repo GitHub Pages — **timpa file lama**.
   Cara paling aman: buka file di GitHub → ikon pensil (Edit) → select-all →
   hapus → paste isi baru → Commit. Setelah upload, cek di halaman repo GitHub
   bahwa kedua file menunjukkan waktu commit yang baru (bukan yang lama).
2. Tunggu 1-2 menit sampai GitHub Pages selesai deploy.
3. Buka halamannya, **hard refresh** (Ctrl+Shift+R).
4. Cek tulisan kecil **"app v21"** muncul di sebelah judul.
5. Klik ⚙︎ → paste URL Web App → **Simpan**.

## Cara Pakai
- **Data Contoh**: preview dashboard tanpa Web App (5 ekspedisi contoh).
  ⚠️ Tombol Download PPTX di mode ini akan menolak dgn pesan jelas — PPTX
  cuma bisa dibuat dari data asli (**Muat Data**).
- **Muat Data**: pilih periode, ambil data asli dari Google Sheets.
- Tap kartu atau pakai dropdown **"Pilih ekspedisi langsung"** utk buka detail.
- Di halaman detail: **Analisa Pencapaian**, **Peringkat** (per kategori
  Truck/Darat vs Kontener/Laut), 3 chart tren + tabel data mentah, 3 tabel
  detail miss terpisah (FAM/Distributor/Reliability), dan tombol
  **⬇ Download PPTX**.

## Struktur Perhitungan (final, sudah dikonfirmasi Nano)

| Komponen | Bobot | Target | Formula |
|---|---|---|---|
| Mutu | 10% | 100% | = Hit Tiba di FAM apa adanya, Miss selalu 0 (terpisah dari Miss FAM) |
| Tiba di FAM | 20% | 100% | Hit: tab `rtc` · Miss: tab `data miss pa` |
| Tiba di Distributor | 50% | 98% | tab `Dot` (Expedition Id + HIT/MISSS) |
| Reliability | 20% | 100% | Hit DOT dikurangi complain, dibagi Hit DOT (terpisah dari Miss DOT) |

Grade: **A** 97-100% · **B** 94-96,99% · **C** 91-93,99% · **D** <91%

Master daftar ekspedisi (Kode → Nama → Kategori Truck/Kontener): tab
`database expedisi`. Reliability dikurangi komplain dari tab
`complain brg kurang`.

## Kalau Ada yang Meleset

- **Angka aneh**: jalankan `debugDot`, `debugComplain`, atau
  `debugDataMissPa`, kirim log-nya.
- **PPTX bermasalah lagi**: jalankan `testGeneratePptx` dulu dari editor,
  cek file di Drive. Kalau di situ sudah kebuka normal di PowerPoint tapi
  yang dari dashboard tetap gagal, kemungkinan soal proses download di
  browser (bukan isi filenya) — cek Console browser (F12) buat error detail.
- **Loading lambat**: tab `rtc`/`data miss pa`/`Dot` sudah di-cache per
  request (dibaca sekali, dipakai berulang) — kalau masih lambat, kemungkinan
  sheet-nya memang besar, kabari biar dicari cara lain (mis. CacheService).
