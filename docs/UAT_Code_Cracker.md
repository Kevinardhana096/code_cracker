# User Acceptance Test (UAT)

## Code Cracker: The Investigation Ladder

**Baseline implementasi:** Tahap III — 28 Juli 2026  
**Status automated:** **PASS (96/96)**

Dokumen ini digunakan untuk memvalidasi alur permainan dari sudut pandang
panitia dan peserta, khususnya sebelum soal resmi dimasukkan.

## 1. Tujuan

- Memastikan mode simulasi dapat digunakan untuk dry run.
- Memastikan 15 tim dapat login dan mengerjakan soal bersamaan.
- Memastikan timer, draft level, skor, clue, resolution, dan leaderboard berjalan.
- Memastikan data simulasi tidak masuk ke mode resmi.
- Menjadi dasar keputusan **Go / No-Go** sebelum hari-H.

## 2. Ruang Lingkup

Termasuk: autentikasi tim, autentikasi admin, mode simulasi, mode resmi,
15 tim, tiga level, timer, draft jawaban per level, pilihan ganda, clue,
final resolution, skor, leaderboard, validasi perubahan pilihan, validasi
token, isolasi data, status kompetisi, dan audit trail. Pemisahan participant
view, admin view, dan leaderboard screen divalidasi pada UAT browser terpisah.

Tidak termasuk dalam automated UAT: jangkauan WiFi fisik, QR code dengan HP
sebenarnya, firewall Windows, dan tampilan lintas jenis perangkat. Hal tersebut
tetap harus dilakukan dalam dry run manual.

## 3. Lingkungan UAT Otomatis

- Server: Node.js lokal
- Database: file sementara `uat_simulation.db`
- Port: `3297`
- Tim: 15 tim (`TIM01`–`TIM15`)
- Durasi test: 10 detik per fase agar test selesai cepat
- Runner: `server/test/uat-simulation.js`

Database produksi tidak digunakan dan dihapus setelah test selesai.

## 4. Kriteria Penerimaan

UAT dinyatakan **PASS** jika seluruh kondisi berikut terpenuhi:

1. 15 tim berhasil login.
2. Request tanpa token dan token lintas tim ditolak.
3. Setiap level mengirim 5 soal pilihan ganda per tim.
4. Draft lima pilihan per level dapat disimpan dan diubah sebelum timer habis.
5. Timer memfinalisasi jawaban level satu kali dan menghitung penalti kosong.
6. Timer berpindah otomatis ke fase clue.
7. Clue terbuka berdasarkan jumlah jawaban benar.
8. Final resolution hanya menerima kandidat yang valid.
9. Skor dan leaderboard sesuai perhitungan.
10. Mode resmi dimulai tanpa skor simulasi.
11. Dataset resmi dapat diakses secara terpisah.
12. Skor tidak berubah sebelum draft level difinalisasi server.
13. Tim terdiskualifikasi tidak dapat mengubah jawaban dan tidak mendapat peringkat.

## 5. Skenario UAT

| ID | Skenario | Hasil yang Diharapkan |
|---|---|---|
| AUTH-01 | Login 15 tim | Semua tim berhasil login |
| AUTH-02 | Request tanpa token | Server mengembalikan 401 |
| AUTH-03 | Token dipakai oleh tim lain | Server mengembalikan 401 |
| GAME-01 | Mulai Case File | Case File 2 menit aktif dan fase berikutnya berjalan otomatis |
| GAME-02 | Ambil soal | Setiap tim mendapat 5 soal sesuai mode |
| GAME-03 | Simpan draft level | Lima pilihan tersimpan sebagai satu draft level |
| GAME-04 | Ubah pilihan | Pilihan lama dapat diganti sebelum timer habis |
| GAME-05 | Timer habis | Sistem berpindah ke clue otomatis |
| GAME-06 | Finalisasi level | Jawaban difinalisasi satu kali dan skor dihitung |
| CLUE-01 | Clue terbuka | Setiap tim menerima clue sesuai skor level |
| RES-01 | Kandidat tidak valid | Submit ditolak |
| RES-02 | Resolution 15 tim | Setiap tim hanya dapat memilih sekali |
| SCORE-01 | Leaderboard simulasi | Skor dan jumlah tim benar |
| MODE-01 | Masuk mode resmi | Leaderboard resmi dimulai dari nol |
| MODE-02 | Ambil soal resmi | Dataset resmi terpisah dari simulasi |
| COMP-01 | Diskualifikasi tim | Status DQ, peringkat, dan submit diperbarui |
| COMP-02 | Pulihkan status tim | Status kembali aktif dan tercatat |
| COMP-03 | Tie-break/play-off | Seri, hasil play-off, dan audit tercatat |
| VIEW-01 | View terpisah | Participant, admin, dan leaderboard memakai akses/tampilan terpisah |
| VIEW-02 | Leaderboard publik | Layar leaderboard dapat dibuka tanpa login dan bersifat read-only |
| VIEW-03 | Timer admin | Admin melihat fase dan sisa waktu dari state server |

## 6. Cara Menjalankan

Dari folder proyek:

```powershell
cd server
npm run test:uat
```

Jika Execution Policy PowerShell memblokir `npm`, gunakan:

```powershell
npm.cmd run test:uat
```

Runner akan mencetak daftar `PASS`/`FAIL` dan menghapus database sementara
setelah selesai.

## 7. Hasil Eksekusi

| Waktu | Hasil | Catatan |
|---|---|---|
| 28 Juli 2026 | PASS | 96/96 skenario lulus; database produksi tidak digunakan |

Ringkasan hasil:

- 15/15 tim berhasil login.
- 45 draft level dari 15 tim dan 3 level berhasil diproses.
- Perubahan pilihan sebelum timer habis berhasil diverifikasi.
- Opsi tidak valid dan token lintas tim ditolak.
- Penalti jawaban salah dan kosong berhasil diverifikasi.
- Case File, timer clue, transisi otomatis antar fase, resolution, dan skor lulus.
- Skor Tim 1 terverifikasi sebesar 330 poin.
- Mode resmi dimulai dengan leaderboard bernilai nol.
- Dataset simulasi dan resmi terbukti terpisah.
- Diskualifikasi, pemblokiran jawaban, pemulihan status, dan audit trail lulus.
- `test:competition` memvalidasi status `TIED`, hasil play-off, diskualifikasi,
  dan audit trail.
- `test:images` memvalidasi asset valid, ekstensi tidak didukung, batas 5 MB,
  dan batas dimensi 4096px.

Pengujian service terpisah:

```powershell
cd server
npm.cmd run test:competition
```

Pengujian ini memvalidasi kondisi seri, status `TIED`, hasil play-off,
diskualifikasi, dan audit trail.

## 8. UAT Manual Setelah Automated Test

- Sambungkan minimal 15 HP ke dua hotspot.
- Bagikan QR code sesuai grup hotspot.
- Login sebagai 15 tim.
- Pada mode awal `simulation/lobby`, klik **Mulai Case File**. Tombol mode hanya
  dipakai untuk berpindah atau mengosongkan mode tujuan.
- Pastikan semua HP menerima perubahan fase secara real-time.
- Uji reload dan reconnect satu HP.
- Uji timer habis saat beberapa tim mengirim jawaban bersamaan.
- Uji leaderboard pada layar proyektor.
- Uji backup dan restart server.
- Setelah semua lulus, ganti dataset placeholder dengan data resmi.

## 9. Keputusan Rilis

- **GO**: seluruh automated test PASS dan dry run manual tidak menemukan blocker.
- **NO-GO**: ada test kritis FAIL, timer tidak sinkron, skor tercampur,
  atau peserta tidak dapat reconnect.

## 10. Setup Playwright MCP

Playwright MCP dipasang sebagai dependency lokal di root proyek. Konfigurasinya
tersedia di `.mcp.json` dan script berikut dapat digunakan untuk menjalankan
server MCP:

```powershell
npm.cmd run mcp:playwright
```

Setelah MCP client direload, server `playwright` dapat digunakan untuk UAT
browser pada `http://localhost:3000`.

## 11. Hasil UAT Frontend Playwright MCP

Laporan lengkap dengan bukti screenshot tersedia di
[`UAT_Frontend_Playwright_MCP.md`](UAT_Frontend_Playwright_MCP.md).

Eksekusi browser headed pada 26 Juli 2026, ditambah follow-up katalog gambar,
berhasil memvalidasi alur dasar. Untuk rilis terkini, perilaku draft level,
finalisasi server, dan skor setelah finalisasi menjadi acuan utama.

Validasi browser yang tercatat:

- Halaman login peserta dan login `TIM01`.
- Label mode `SIMULASI` dan layar menunggu.
- Login admin dan tampilan kontrol mode/fase.
- Transisi real-time ke Level 1.
- Timer Case File/level dan lima tombol navigasi soal pilihan ganda.
- Perubahan pilihan tersimpan sebagai draft level; skor baru tampil setelah finalisasi.
- Tampilan viewport mobile 390×844.
- Panel admin terpisah dengan timer fase, kontrol mode, status tim, katalog soal,
  keputusan kompetisi, dan audit trail.
- Layar leaderboard tersedia melalui `/?screen=leaderboard` tanpa login admin.

Satu error kosmetik `favicon.ico` 404 ditemukan dan diperbaiki dengan
`server/public/favicon.svg`. Siklus penuh sampai leaderboard kemudian berhasil
divalidasi dengan sesi browser headed berdurasi lebih panjang. Mode resmi juga
berhasil dimulai dari lobby dengan skor seluruh tim kembali nol.
