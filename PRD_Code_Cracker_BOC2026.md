# Product Requirements Document (PRD)
## Code Cracker: The Investigation Ladder
### Battle of Champions (BOC) 2026 — Detective Division

| | |
|---|---|
| **Versi** | 1.2 |
| **Status** | Baseline implementasi Tahap III; dataset resmi belum final |
| **Tanggal** | 28 Juli 2026 |
| **Pemilik Produk** | Panitia Battle of Champions 2026 |

---

## 1. Latar Belakang

Code Cracker: The Investigation Ladder adalah babak kompetisi matematika berbasis gamifikasi investigasi. Peserta berperan sebagai tim investigator yang menyelesaikan soal matematika bertingkat untuk mengumpulkan petunjuk (clue) dan mengungkap kasus fiksi "The Lost Champion". Penilaian utama tetap berbasis poin matematika; hasil investigasi hanya memberi bonus poin.

Babak ini membutuhkan sebuah **platform digital** yang menjalankan soal, timer, sistem skor, sistem clue, dan leaderboard secara otomatis dan adil untuk 15 tim peserta secara bersamaan, **tanpa akses internet** di lokasi acara.

## 2. Tujuan

- Menyediakan platform digital yang menjalankan seluruh alur Code Cracker (3 level soal + Final Case Resolution) secara otomatis, adil, dan real-time antar tim.
- Memastikan sistem tetap berjalan penuh **tanpa koneksi internet**, menggunakan jaringan lokal (hotspot) di lokasi acara.
- Meminimalkan risiko kecurangan (manipulasi jawaban, skor, atau timer) melalui validasi di sisi server.
- Menyediakan leaderboard yang bisa dipakai untuk menentukan 5 tim yang lolos ke babak berikutnya.

## 3. Ruang Lingkup

### 3.1 Termasuk (In Scope)
- Aplikasi client (web app) yang diakses peserta lewat browser HP masing-masing (BYOD).
- Server backend lokal (berjalan di laptop panitia) yang menangani soal, jawaban, skor, timer, dan clue.
- Database lokal untuk menyimpan seluruh data pertandingan.
- Dashboard/layar leaderboard untuk ditampilkan ke seluruh peserta.
- Mekanisme jaringan lokal tanpa internet (hotspot HP + USB tethering).

### 3.2 Tidak Termasuk (Out of Scope)
- Akses dari luar lokasi acara (remote/online).
- Sistem pembayaran atau pendaftaran peserta.
- Manajemen babak-babak lain di luar Code Cracker.
- Aplikasi mobile native (cukup web app berbasis browser).

## 4. Target Pengguna

| Peran | Deskripsi |
|---|---|
| **Peserta (Tim Investigator)** | 15 tim, masing-masing 1 device yang connect ke server, mengerjakan soal dan melihat clue. |
| **Panitia / Admin** | Mengontrol jalannya babak, memulai/mengakhiri level, memonitor leaderboard, menyiapkan jaringan lokal. |
| **Pengawas** | Mengawasi tim secara fisik untuk memastikan tidak ada kecurangan (komunikasi antar tim, bantuan luar). |

## 5. Alur Permainan (Functional Flow)

1. **Briefing & Case File** — Panitia membagikan Case File fisik berisi data 4 kandidat Champion.
2. **Login/Join** — Tim mengakses server via browser (scan QR yang mengarah ke IP lokal server) dan masuk dengan kode tim.
3. **Level 1 — Crime Scene Analysis**: 5 soal easy, durasi 5 menit, 10 poin/soal benar.
4. **Clue 1** dibuka otomatis berdasarkan jumlah jawaban benar tim.
5. **Level 2 — Evidence Decoding**: 5 soal medium, durasi 7 menit, 20 poin/soal benar.
6. **Clue 2** dibuka otomatis.
7. **Level 3 — Final Deduction**: 5 soal hard/HOTS, durasi 8 menit, 30 poin/soal benar.
8. **Clue 3** dibuka otomatis.
9. **Final Case Resolution** — Tim memilih 1 dari 4 kandidat Champion, durasi 3 menit, bonus 30 poin jika benar.
10. **Leaderboard Final** — Sistem menghitung total skor (poin matematika + bonus investigasi) dan menampilkan peringkat 15 tim. Top 5 dinyatakan lolos.

## 6. Functional Requirements

### 6.1 Manajemen Soal & Jawaban
- Sistem menyimpan bank soal per level (easy/medium/hard) beserta kunci jawaban di **server**, bukan di client.
- Setiap tim menerima soal dalam urutan/variasi yang bisa diacak (untuk mencegah screen-sharing antar tim).
- Peserta memilih opsi A-D dan menyimpannya sebagai satu draft level.
- Draft dapat diubah selama level aktif; server memvalidasi opsi dan tidak menghitung skor dari draft.
- Saat timer habis, server memfinalisasi lima pilihan secara atomik, termasuk jawaban kosong, lalu menghitung skor.

### 6.2 Timer & Auto-Lock
- Timer dihitung dan dikontrol oleh server (bukan device peserta), dikirim ke client via koneksi real-time.
- Saat waktu level habis, server otomatis mengunci draft dan memfinalisasi level untuk seluruh tim secara serentak.

### 6.3 Sistem Poin
- Level 1: benar +10, salah -2, kosong -1. Level 2: benar +20, salah -4, kosong -2. Level 3: benar +30, salah -6, kosong -3.
- Bonus Final Case Resolution: 30 poin jika jawaban akhir benar.
- Total skor = akumulasi poin matematika + bonus investigasi.

### 6.4 Sistem Clue & Investigation Board
- Setelah tiap level ditutup, server menghitung jumlah jawaban benar tim dan memetakan ke aturan clue yang sesuai (skema bertingkat: 5 benar / 4 benar / 3 benar / <3 benar).
- Clue yang diperoleh tim tersimpan permanen di **Investigation Board** milik tim tersebut, bisa diakses ulang selama sesi berlangsung.

### 6.5 Leaderboard
- Leaderboard menampilkan peringkat real-time berdasarkan total skor.
- Tie-breaker otomatis berdasarkan urutan: total poin → jumlah jawaban benar
  terbanyak → jumlah jawaban benar Level 3 → timestamp server saat Final Case
  Resolution dikirim. Jika seluruh kriteria sama, tim diberi status `TIED` dan
  panitia mencatat hasil play-off.
- Layar leaderboard publik dibuka melalui `/?screen=leaderboard`, tanpa login,
  dan bersifat read-only. Panel admin tetap menggunakan `/?admin=1`.

### 6.6 Halaman Hasil Akhir
- Menampilkan skor total, breakdown per level, dan bonus investigasi tiap tim.
- Menampilkan **kode verifikasi** (hash singkat dari data skor tim) sebagai bukti integritas hasil.

## 7. Non-Functional Requirements

### 7.1 Ketersediaan Jaringan (Offline-First)
- Sistem harus berjalan penuh **tanpa akses internet**.
- Jaringan menggunakan **hotspot WiFi dari HP panitia** (bukan router), dengan laptop server terhubung via **USB tethering** ke tiap HP hotspot.
- Kapasitas: 15 tim @ 1 device → dibutuhkan **2 HP hotspot** (pembagian ±8 dan ±7 tim), dengan laptop tersambung ke kedua HP via kabel USB secara bersamaan.
- Server (Node.js) di-bind ke `0.0.0.0` agar dapat diakses dari kedua jaringan hotspot sekaligus.
- Disediakan 2 QR code berbeda (satu per grup hotspot) yang mengarah ke alamat IP lokal server yang sesuai.

### 7.2 Performa
- Sistem harus mampu menangani penyimpanan draft dan finalisasi jawaban dari hingga 15 tim secara bersamaan tanpa lag signifikan, terutama saat mendekati akhir waktu tiap level.

### 7.3 Keamanan & Anti-Kecurangan
- Kunci jawaban, logika skor, dan logika clue **hanya ada di server**, tidak pernah dikirim ke client dalam bentuk yang bisa dibaca langsung.
- Timer dihitung berbasis timestamp server, tidak bergantung pada jam device peserta.
- Kode verifikasi (hash) ditampilkan di halaman hasil akhir untuk mendeteksi ketidaksesuaian data jika terjadi sengketa skor.
- Kontrol prosedural (tanggung jawab pengawas): melarang komunikasi antar tim, penggunaan alat bantu luar, dan HP mode pesawat selama sesi berlangsung.
- **Batasan yang diketahui**: karena jaringan lokal tanpa HTTPS, ada risiko residual penyadapan traffic oleh peserta dengan kemampuan teknis tinggi — risiko ini diterima sebagai low-probability untuk konteks kompetisi ini.

### 7.4 Kompatibilitas
- Client harus berjalan di browser HP standar (Chrome/Safari) tanpa instalasi aplikasi tambahan.

## 8. Arsitektur Sistem

**Client (Web App)** — memiliki participant view, admin view, dan leaderboard screen
yang dipilih melalui URL. Participant view menampilkan soal/timer/clue/hasil;
leaderboard screen bersifat publik dan read-only. Seluruh logika penilaian tetap
divalidasi oleh server.

**Backend Server (Laptop Panitia)** — terdiri dari:
- *Game Engine*: mengatur timer, validasi jawaban, penghitungan skor, logika pembukaan clue.
- *Realtime Server*: mendorong update timer dan leaderboard ke seluruh client secara live (WebSocket).

**Database** — menyimpan data tim, bank soal, draft dan hasil finalisasi level,
clue yang terbuka, hasil Final Case Resolution, status kompetisi, play-off, dan
audit trail.

**Jaringan** — 2 HP hotspot WiFi (tanpa internet), laptop server terhubung ke keduanya via USB tethering.

## 9. Data Model (Ringkasan Tabel)

| Tabel | Kolom Utama |
|---|---|
| `teams` | id, nama_tim, kode_login |
| `questions` | id, level, materi, soal, kunci_jawaban, poin |
| `level_drafts` | team_id, mode, level, answers_json, updated_at |
| `level_results` | team_id, mode, level, answers_json, correct_count, wrong_count, unanswered_count, score, finalized_at |
| `clues_unlocked` | id, team_id, level, isi_clue |
| `final_resolution` | id, team_id, jawaban_dipilih, is_correct, bonus_poin |
| `team_competition_status` / `playoff_results` / `audit_log` | status DQ, hasil play-off, dan jejak keputusan panitia |

## 10. Tech Stack (Rekomendasi)

- **Frontend**: HTML + CSS + JavaScript ringan, diakses via browser dan tanpa CDN wajib.
- **Backend**: Node.js + Express.
- **Realtime**: Socket.IO / WebSocket native.
- **Database**: `sql.js` dengan file database lokal (cukup ringan untuk skala 15 tim).

## 11. Kebutuhan Perangkat Hari-H (Checklist)

- 1 laptop sebagai server (spesifikasi standar, cukup untuk menjalankan Node.js + database lokal).
- 2 unit HP sebagai hotspot WiFi (kapasitas ≥10 device masing-masing).
- 2 kabel USB (untuk USB tethering laptop ke tiap HP hotspot).
- 2 QR code (dicetak/ditampilkan) untuk akses tiap grup hotspot.
- 1 layar/proyektor tambahan untuk menampilkan leaderboard live ke seluruh peserta.

## 12. Risiko & Mitigasi

| Risiko | Mitigasi |
|---|---|
| Kapasitas hotspot terlampaui | Distribusi tim maksimal 8-9 per HP, sisakan headroom dari batas 10 |
| Sinyal WiFi tidak menjangkau seluruh venue | Uji jangkauan sebelum hari-H, siapkan HP hotspot cadangan |
| Manipulasi jawaban/skor oleh peserta | Validasi & kunci jawaban 100% di server, bukan di client |
| Sengketa hasil skor | Kode verifikasi (hash) di layar hasil akhir tiap tim |
| Komunikasi antar tim / kecurangan fisik | Kontrol prosedural oleh pengawas, aturan diskualifikasi |
| Laptop server bermasalah saat lomba | Siapkan backup laptop dengan salinan database ter-sync berkala |

## 13. Metrik Keberhasilan

- Seluruh 15 tim berhasil terhubung dan menyelesaikan babak tanpa kendala teknis signifikan.
- Leaderboard akhir dihasilkan otomatis dan akurat tanpa perlu rekap manual.
- Tidak ada insiden kecurangan yang tidak terdeteksi selama babak berlangsung.

## 14. Asumsi & Pertanyaan Terbuka

- Diasumsikan device peserta (BYOD) mendukung browser modern (Chrome/Safari versi terbaru).
- Perlu konfirmasi lebih lanjut: apakah panitia memiliki laptop dengan minimal 2 port USB aktif untuk tethering ganda, atau perlu hub USB tambahan.
- Perlu uji coba jangkauan sinyal hotspot di lokasi acara sebelum hari-H.

## 15. Addendum: Soal Bergambar dan Status Implementasi

### 15.1 Soal Bergambar

Bank soal mendukung ilustrasi/gambar yang dikelola sebagai static asset di
server. Gambar tidak disimpan sebagai kolom database; sistem memetakannya
berdasarkan ID soal.

Struktur asset:

    server/public/uploads/questions/
    ├── simulation/q_<question_id>.<ekstensi>
    └── official/q_<question_id>.<ekstensi>

Aturan produk:

- file menggunakan pola nama q_<question_id>.<ekstensi>;
- mode simulasi dan resmi memiliki folder asset yang terpisah;
- format yang didukung: PNG, JPG, JPEG, WebP, GIF, dan AVIF;
- ukuran maksimum file adalah 5 MB;
- dimensi maksimum yang dapat divalidasi adalah 4096px;
- gambar yang tidak valid tidak dikirim ke peserta dan soal tetap tampil sebagai
  soal teks;
- panel admin menyediakan katalog question_id dan status gambar.

### 15.2 Status Implementasi

- Alur permainan, autentikasi, timer, skor, clue, resolution, mode simulasi,
  dan mode resmi sudah diimplementasikan.
- Workflow soal bergambar, validasi file, katalog admin, dan fallback teks sudah
  diimplementasikan.
- Automated backend UAT terakhir: 96/96 PASS; UAT kompetisi dan resolver gambar juga PASS.
- Panel admin dengan timer, layar leaderboard terpisah, recovery draft/session, serta
  tie-break/play-off/diskualifikasi sudah diimplementasikan.
- Browser UAT soal bergambar dengan PNG nyata: PASS.
- Dataset pertandingan resmi masih perlu diganti dari placeholder dengan soal,
  clue, dan asset final dari panitia.
