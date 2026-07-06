# Evaluasi Kinerja Ekspedisi — Web App

Dashboard multi-ekspedisi + generate PPTX otomatis, terhubung ke spreadsheet
**"Evaluasi expedisi 2026"**.

## Cek Versi File (PENTING)

Sebelum mulai, pastikan file yang dipakai adalah yang TERBARU. Buka file di
editor teks mana saja dan cek baris paling atas:

| File | Versi seharusnya | Ukuran seharusnya |
|---|---|---|
| `Code.gs` | `VERSION: v5` | ~24 KB |
| `index.html` | `VERSION: v3` | ~9 KB |
| `app.js` | `VERSION: v7` | **~570-585 KB** (ada gambar ter-embed) |

Kalau `app.js` ukurannya cuma beberapa KB, itu tandanya file LAMA — jangan
dipakai, download ulang dari chat.

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
     Google account" — kalau salah, dashboard akan gagal connect meskipun
     link-nya benar)
5. Klik **Deploy**, izinkan akses (Authorize), lalu **copy URL Web App**
   (formatnya `https://script.google.com/macros/s/XXXXX/exec`).

Sebelum deploy, jalankan dulu fungsi-fungsi ini dari editor Apps Script
(pilih dari dropdown di atas, klik ▶), lalu cek **Execution log**:
- `testConnection` — cek daftar ekspedisi & skor
- `testDetail` — cek detail 1 ekspedisi (default: kode "VOLT")
- `debugDot` — cek tab "Dot" terbaca dengan benar
- `debugComplain` — cek tab "complain brg kurang"
- `debugDataMissPa` — cek tab "data miss pa" (bagian paling belum pasti)

### 2. Pasang frontend (dashboard)
1. Upload `index.html` dan `app.js` ke repo GitHub Pages.
   **PENTING**: pastikan benar-benar MENIMPA file lama dengan nama yang
   sama persis. Cara paling aman: buka file itu di GitHub → klik ikon
   pensil (Edit) → select-all isi lama → hapus → paste isi baru → Commit.
   Jangan drag-drop upload dari folder Downloads (rawan re-upload file
   browser yang lama kalau nama file bentrok, misal `app (1).js`).
2. Tunggu 1-2 menit sampai GitHub Actions selesai deploy (cek tab
   **Actions** di repo, tunggu tanda centang hijau).
3. Buka halamannya, **hard refresh** (Ctrl+Shift+R / Cmd+Shift+R).
4. Cek tulisan kecil **"app v7"** muncul di sebelah judul — kalau tidak
   ada, berarti masih file lama yang ke-load.
5. Klik ikon **⚙︎** di kanan atas header → paste URL Web App dari langkah 1
   → **Simpan**.
6. Selesai. Dashboard akan otomatis connect ke Sheets tiap kali dibuka.

## Cara Pakai
- **Data Contoh**: klik tombol ini untuk lihat tampilan dashboard tanpa perlu
  Web App (pakai 5 ekspedisi contoh).
- **Muat Data**: pilih periode (bulan dari–sampai) lalu tekan tombol ini untuk
  ambil data asli dari Google Sheets.
- Tap kartu ekspedisi, atau pakai dropdown **"Pilih ekspedisi langsung"**,
  untuk masuk ke halaman detail.
- Di halaman detail, tombol **⬇ Download PPTX** generate laporan 8-slide
  (7 slide analisis + 1 slide penutup "Terima Kasih") sesuai format resmi
  PT. UNIFAM (background & logo dari template "Bangkit Bersama").

## Struktur Perhitungan (sudah diverifikasi dari data asli)

| Komponen | Bobot | Target | Sumber Data |
|---|---|---|---|
| Mutu | 10% | 100% | tab `Dot` dikurangi tab `complain brg kurang` |
| Tiba di FAM | 20% | 98% | Hit: tab `rtc` · Miss: tab `data miss pa` |
| Tiba di Distributor | 50% | 98% | tab `Dot` (kolom Expedition Id + HIT/MISSS) |
| Reliability | 20% | 100% | sama dengan Mutu |

Grade: **A** 97-100% · **B** 94-96,99% · **C** 91-93,99% · **D** <91%

Master daftar ekspedisi (Kode → Nama Lengkap → Kategori Truck/Kontener) ada
di tab `database expedisi`.

## Kalau Ada yang Meleset

Bagian paling rawan adalah pembacaan tab **`data miss pa`** (sumber Miss
untuk Tiba di FAM) — strukturnya belum 100% terverifikasi karena sulit
diintip dari luar. Kalau angka FAM sering kosong/aneh, jalankan
`debugDataMissPa()` di Apps Script dan kirim hasil **Execution log**-nya
(bukan link Sheets — itu tidak reliable dibaca dari luar).

Untuk masalah lain (dashboard gagal connect, PPTX gagal download, dll),
sebutkan pesan error yang muncul persis apa adanya — itu paling cepat
membantu melacak akar masalahnya.
