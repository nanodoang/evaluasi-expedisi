# Evaluasi Kinerja Ekspedisi — Web App

Dashboard multi-ekspedisi + generate PPTX otomatis, terhubung ke spreadsheet
"Evaluasi expedisi 2026".

## Cara Deploy (sekali saja)

### 1. Pasang backend (Code.gs)
1. Buka spreadsheet **Evaluasi expedisi 2026** di Google Sheets.
2. Menu **Extensions → Apps Script**.
3. Hapus isi default, lalu paste seluruh isi file `Code.gs`.
4. Klik **Deploy → New deployment**.
   - Type: **Web app**
   - Execute as: **Me**
   - Who has access: **Anyone** (atau "Anyone with Google account" kalau mau lebih aman)
5. Klik **Deploy**, izinkan akses (Authorize), lalu **copy URL Web App** yang muncul
   (formatnya `https://script.google.com/macros/s/XXXXX/exec`).

> Sebelum deploy, ada baiknya jalankan dulu fungsi `testConnection` dan
> `testDetail` dari editor Apps Script (pilih fungsi di dropdown atas, klik ▶),
> lalu cek **Execution log** — pastikan datanya masuk akal. Kalau ada error
> atau angka `null` terus, kemungkinan nama tab/kolom di `data miss pa` beda
> dari yang saya asumsikan — kirim screenshot header tab itu ke Claude.

### 2. Pasang frontend (dashboard)
1. Upload `index.html` dan `app.js` ke repo GitHub Pages Nano (folder baru,
   misal `evaluasi-ekspedisi/`).
2. Buka halamannya di browser → klik ikon **⚙︎** di kanan atas header →
   paste URL Web App dari langkah 1 → **Simpan**.
3. Selesai. Dashboard akan otomatis connect ke Sheets tiap kali dibuka.

## Cara Pakai
- **Data Contoh**: klik tombol ini untuk lihat tampilan dashboard tanpa perlu
  Web App (pakai 5 ekspedisi contoh) — enak buat cek desain dulu.
- **Muat Data**: pilih periode (bulan dari–sampai) lalu tekan tombol ini untuk
  ambil data asli dari Google Sheets.
- Tap kartu ekspedisi mana pun → masuk ke halaman detail (Mutu, Tiba di FAM,
  Tiba di Distributor, Reliability + tren bulanan + detail kejadian miss).
- Di halaman detail, tombol **⬇ Download PPTX** akan generate laporan lengkap
  7-slide persis format Volt Exp/TSA (background foto + logo Bangkit Bersama,
  warna merah otomatis kalau di bawah target).

## Struktur Perhitungan (sesuai konfirmasi Nano)

| Komponen | Bobot | Target | Sumber Data |
|---|---|---|---|
| Mutu | 10% | 100% | tab `database expedisi` (Pemenuhan Armada) |
| Tiba di FAM | 20% | 98% | Hit: tab `rtc` · Miss: tab `data miss pa` |
| Tiba di Distributor | 50% | 98% | tab `database expedisi` (DOT) |
| Reliability | 20% | 100% | tab `database expedisi` (Pemenuhan Armada) |

Grade: **A** 97-100% · **B** 94-96,99% · **C** 91-93,99% · **D** <91%

## Kalau Ada yang Meleset

Bagian paling rawan adalah pembacaan tab `data miss pa` (saya belum sempat
lihat isinya langsung — parsernya saya buat baca header secara otomatis,
bukan hardcode posisi kolom). Kalau di `testDetail()` hasil `fam.miss` selalu
0 padahal harusnya ada, kemungkinan nama kolom di tab itu beda dari yang saya
duga (Expedisi/Ekspedisi, Bulan, Tujuan, ETA, ATA, Keterangan). Kirim saja
screenshot baris header tab itu, saya sesuaikan `readDataMissPa_()` di Code.gs.
