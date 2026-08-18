# Rencana Implementasi — Code Cracker: The Investigation Ladder

> **Battle of Champions (BOC) 2026 — Detective Division**
> Versi 1.0 · 21 Juli 2026

> **Catatan status:** Dokumen ini adalah blueprint awal/legacy. Baseline
> implementasi dan keputusan terbaru ada di [Rencana Tahap III Code Cracker](Rencana_Tahap_III_Code_Cracker.md).
> Bagian 15 menjadi catatan aktual apabila blueprint awal di bawah ini berbeda.

---

## 1. Ringkasan Teknologi

| Lapisan | Pilihan | Alasan |
|---|---|---|
| **Backend** | Node.js + Express | Rekomendasi PRD, ringan, ekosistem luas |
| **Komunikasi Real-time** | Socket.IO | Kirim timer, leaderboard, dan status level secara live ke semua tim |
| **Database** | SQLite-compatible `sql.js` | Satu file database lokal, ideal untuk operasi offline |
| **Frontend** | HTML + CSS + JavaScript murni (SPA) | Tidak perlu build step, ukuran kecil, kompatibel dengan semua browser HP, tidak bergantung CDN internet |
| **Admin Panel** | Bagian dari SPA yang sama, tampilan khusus admin | Dijalankan dari server yang sama, akses via password |

---

## 2. Struktur Folder

```
code_cracker/
├── docs/
│   └── implementation-plan.md    ← File ini
├── server/                       ← Backend
│   ├── src/
│   │   ├── index.js              ← Titik masuk: nyalakan Express + Socket.IO + DB
│   │   ├── config.js             ← Port, path database, durasi tiap level, dll.
│   │   ├── db/
│   │   │   ├── db.js             ← Koneksi database (singleton)
│   │   │   ├── schema.js         ← Struktur tabel (CREATE TABLE)
│   │   │   └── seed.js           ← Data awal: 15 tim, soal, clue
│   │   ├── services/
│   │   │   ├── game.js           ← Mesin status permainan (start/stop level, transisi)
│   │   │   ├── timer.js          ← Hitung mundur berbasis server (setInterval)
│   │   │   ├── scoring.js        ← Hitung skor total, tie-breaker
│   │   │   ├── clues.js          ← Logika buka clue berdasarkan ambang batas
│   │   │   └── verify.js         ← Kode verifikasi hash SHA256
│   │   ├── routes/
│   │   │   ├── auth.js           ← POST /api/login (validasi kode tim)
│   │   │   ├── game.js           ← GET /api/questions, POST /api/level-draft
│   │   │   └── admin.js          ← POST /api/admin/* (mulai level, reset, dll.)
│   │   ├── socket/
│   │   │   └── index.js          ← Setup Socket.IO + event handler
│   │   └── utils/
│   │       └── network.js        ← Deteksi IP lokal untuk QR code
│   ├── public/                   ← Frontend (file statis, disajikan Express)
│   │   ├── index.html            ← Satu halaman SPA (semua tampilan)
│   │   ├── css/
│   │   │   └── style.css         ← Tampilan responsif mobile-first
│   │   └── js/
│   │       ├── app.js            ← Kontroler utama SPA + router tampilan
│   │       ├── socket.js         ← Pembungkus Socket.IO client
│   │       ├── views/
│   │       │   ├── login.js      ← Tampilan login (input kode tim)
│   │       │   ├── waiting.js    ← Tampilan menunggu sebelum level dimulai
│   │       │   ├── game.js       ← Tampilan soal + timer + draft jawaban
│   │       │   ├── investigation.js ← Investigation Board (daftar clue terbuka)
│   │       │   ├── resolution.js ← Final Case Resolution (pilih kandidat)
│   │       │   ├── results.js    ← Hasil akhir: breakdown skor + kode verifikasi
│   │       │   ├── leaderboard.js← Leaderboard live (untuk proyektor)
│   │       │   └── admin.js      ← Panel admin (kontrol permainan)
│   ├── data/
│   │   ├── questions.json        ← Bank soal (15+ soal placeholder)
│   │   └── clues.json            ← Definisi clue per level
│   ├── package.json
│   └── start.bat                 ← Peluncur satu klik untuk Windows
└── PRD_Code_Cracker_BOC2026.md
```

---

## 3. Skema Database

### 3.1 Tabel `teams`

| Kolom | Tipe | Deskripsi |
|---|---|---|
| `id` | INTEGER PK | ID unik tim |
| `name` | TEXT UNIQUE | Nama tim |
| `login_code` | TEXT UNIQUE | Kode login (dibagikan sebelum acara) |
| `created_at` | DATETIME | Waktu pendaftaran |

### 3.2 Tabel `questions`

| Kolom | Tipe | Deskripsi |
|---|---|---|
| `id` | INTEGER PK | ID unik soal |
| `level` | INTEGER CHECK(1-3) | Level soal: 1 = easy, 2 = medium, 3 = hard/HOTS |
| `topic` | TEXT | Topik/materi soal |
| `question_text` | TEXT | Teks soal lengkap |
| `answer_key` | TEXT | Kunci jawaban (disimpan di server saja) |
| `points` | INTEGER | Poin per soal (10/20/30) |

### 3.3 Tabel `team_question_order`

| Kolom | Tipe | Deskripsi |
|---|---|---|
| `team_id` | INTEGER FK → teams | Referensi tim |
| `question_id` | INTEGER FK → questions | Referensi soal |
| `display_order` | INTEGER | Urutan tampil (1-5), sudah diacak |

> **Composite primary key**: `(team_id, question_id)`

### 3.4 Tabel `submissions`

| Kolom | Tipe | Deskripsi |
|---|---|---|
| `id` | INTEGER PK | ID unik pengiriman |
| `team_id` | INTEGER FK → teams | Tim yang mengirim |
| `question_id` | INTEGER FK → questions | Soal yang dijawab |
| `answer` | TEXT | Jawaban peserta (apa adanya) |
| `is_correct` | INTEGER (0/1) | Apakah jawaban benar? |
| `points_awarded` | INTEGER | Poin yang didapat (0 jika salah) |
| `submitted_at` | DATETIME | Waktu submit |

> **Unique constraint**: `(team_id, question_id)` — satu soal hanya bisa dijawab sekali

### 3.5 Tabel `clues`

| Kolom | Tipe | Deskripsi |
|---|---|---|
| `id` | INTEGER PK | ID unik clue |
| `level` | INTEGER | Level terkait (1/2/3) |
| `min_correct` | INTEGER | Batas bawah jawaban benar |
| `max_correct` | INTEGER | Batas atas jawaban benar |
| `clue_text` | TEXT | Isi teks clue |

> **Ambang batas (threshold)**: tim dengan `min_correct ≤ jumlah_benar ≤ max_correct` mendapatkan clue ini.  
> Contoh: 5 benar → clue terbaik, 4 benar → clue sedang, 3 benar → clue minimal, <3 benar → clue parsial.

### 3.6 Tabel `clues_unlocked`

| Kolom | Tipe | Deskripsi |
|---|---|---|
| `id` | INTEGER PK | ID unik |
| `team_id` | INTEGER FK → teams | Tim penerima |
| `clue_id` | INTEGER FK → clues | Clue yang terbuka |
| `unlocked_at` | DATETIME | Waktu terbuka |

### 3.7 Tabel `final_resolutions`

| Kolom | Tipe | Deskripsi |
|---|---|---|
| `id` | INTEGER PK | ID unik |
| `team_id` | INTEGER UNIQUE FK → teams | Tim (maks 1 jawaban per tim) |
| `chosen_candidate` | TEXT | Nama kandidat yang dipilih |
| `is_correct` | INTEGER (0/1) | Apakah benar? |
| `bonus_points` | INTEGER | 30 jika benar, 0 jika salah |
| `submitted_at` | DATETIME | Waktu submit |

### 3.8 Tabel `game_state`

| Kolom | Tipe | Deskripsi |
|---|---|---|
| `id` | INTEGER PK CHECK(id=1) | Hanya boleh 1 baris |
| `phase` | TEXT | Fase permainan saat ini |
| `level_started_at` | INTEGER (UNIX ts) | Kapan level dimulai (null jika tidak ada level aktif) |
| `level_duration_seconds` | INTEGER | Durasi level aktif dalam detik (null jika tidak ada level aktif) |

---

## 4. Mesin Status Permainan (Game State Machine)

```
┌─────────┐    ┌──────────┐    ┌────────┐    ┌──────────┐    ┌────────┐
│  LOBBY  │───→│ LEVEL_1  │───→│ CLUE_1 │───→│ LEVEL_2  │───→│ CLUE_2 │
└─────────┘    └──────────┘    └────────┘    └──────────┘    └────────┘
  (admin        (5 soal,        (buka          (5 soal,        (buka
   klik         5 menit,        clue)          7 menit,        clue)
   mulai)       10 poin/soal)                  20 poin/soal)

     ┌──────────┐    ┌────────┐    ┌─────────────┐    ┌──────────┐
     │ LEVEL_3  │───→│ CLUE_3 │───→│  RESOLUTION  │───→│ FINISHED │
     └──────────┘    └────────┘    └─────────────┘    └──────────┘
       (5 soal,        (buka        (3 menit,          (leaderboard
       8 menit,        clue)        pilih kandidat,    final)
       30 poin/soal)                bonus 30 poin)
```

### Aturan Transisi

- **lobby → level_1**: Admin klik "Mulai Level 1"
- **level_1 → clue_1**: Otomatis saat timer habis (5 menit)
- **clue_1 → level_2**: Admin klik "Mulai Level 2"
- **level_2 → clue_2**: Otomatis saat timer habis (7 menit)
- **clue_2 → level_3**: Admin klik "Mulai Level 3"
- **level_3 → clue_3**: Otomatis saat timer habis (8 menit)
- **clue_3 → resolution**: Admin klik "Mulai Final Resolution"
- **resolution → finished**: Otomatis saat timer habis (3 menit)

> **Catatan**: Admin mengontrol kapan tiap level dimulai untuk memberi jeda briefing/clue reading. Timer berjalan otomatis dan mengunci submit saat habis.

### Daftar Fase

| Fase | Kode | Durasi | Deskripsi |
|---|---|---|---|
| Lobby | `lobby` | — | Tim login dan menunggu |
| Level 1 | `level_1` | 5 menit | 5 soal easy, 10 poin/soal |
| Clue 1 | `clue_1` | — | Distribusi clue Level 1 |
| Level 2 | `level_2` | 7 menit | 5 soal medium, 20 poin/soal |
| Clue 2 | `clue_2` | — | Distribusi clue Level 2 |
| Level 3 | `level_3` | 8 menit | 5 soal hard/HOTS, 30 poin/soal |
| Clue 3 | `clue_3` | — | Distribusi clue Level 3 |
| Final Resolution | `resolution` | 3 menit | Pilih 1 dari 4 kandidat, bonus 30 poin |
| Selesai | `finished` | — | Tampilkan leaderboard final |

---

## 5. Spesifikasi Fitur

### 5.0 Mode Permainan

Sistem memiliki dua mode terisolasi: `simulation` untuk dry run dan `official`
untuk pertandingan sebenarnya. Setiap mode memiliki dataset soal/clue, urutan
soal, submission, clue terbuka, resolution, dan leaderboard sendiri.

### 5.1 Otentikasi Tim

- Tim memasukkan **kode login** yang sudah dibagikan sebelum acara
- Server validasi kode di tabel `teams`
- Jika valid: buat sesi, kirim `team_id` + `team_name` ke client
- Socket.IO otomatis mengasosiasikan koneksi dengan `team_id`
- Satu kode login = satu sesi aktif (reconnect diperbolehkan)

### 5.2 Pengacakan Soal

- Setiap kali level dimulai (transisi ke `level_1`/`level_2`/`level_3`):
  - Ambil 5 soal untuk level tersebut
  - Generate urutan acak (shuffle) untuk **setiap tim**
  - Simpan di tabel `team_question_order`
- Hasil: semua tim dapat soal yang sama, tapi urutan berbeda → cegah screen-sharing

### 5.3 Timer Server-Side (implementasi aktual)

- Timer dihitung oleh server (bukan device peserta)
- Setiap detik, server broadcast `timer:tick` dengan `remaining_seconds` ke semua client via Socket.IO
- Client hanya menampilkan — tidak menghitung sendiri
- Saat `remaining_seconds == 0`:
  - Server menolak penyimpanan draft baru (`POST /api/level-draft` return error)
  - Server memfinalisasi lima pilihan setiap tim, termasuk jawaban kosong
  - Server broadcast `phase:changed` ke fase berikutnya
  - Semua client mengunci pilihan secara serentak

### 5.4 Draft dan Finalisasi Jawaban

- Client menyimpan seluruh pilihan level melalui `POST /api/level-draft` dengan
  `{ answers: { question_id: "A" } }`.
- Server memvalidasi fase, timer, token, dan bahwa setiap pilihan berasal dari
  opsi A-D yang tersedia.
- Pilihan boleh diganti selama fase level aktif dan tidak langsung mengubah skor.
- Saat timer habis, server membuat satu `level_results` per tim/mode/level.
- Jawaban yang tidak dipilih dicatat sebagai `unanswered` dan mendapat penalti
  sesuai level. Setelah finalisasi, draft tidak dapat diubah.

### 5.5 Sistem Clue

- Saat transisi ke fase `clue_1`/`clue_2`/`clue_3`:
  - Server hitung jumlah jawaban benar tim pada level yang baru selesai
  - Cari clue yang cocok di tabel `clues` berdasarkan ambang batas
  - Simpan ke `clues_unlocked` untuk tim tersebut
  - Broadcast `clue:unlocked` ke tim via Socket.IO
- Clue yang sudah terbuka **permanen** dan bisa diakses ulang di Investigation Board

#### Skema Ambang Batas (Contoh)

| Jawaban Benar | Clue yang Didapat |
|---|---|
| 5 dari 5 | Clue lengkap (detail) |
| 4 dari 5 | Clue baik |
| 3 dari 5 | Clue standar |
| < 3 dari 5 | Clue parsial/minimal |

### 5.6 Final Case Resolution

- Fase `resolution`: 4 kandidat Champion ditampilkan
- Setiap tim memilih **1 kandidat**
- Timer 3 menit
- Hanya 1 jawaban per tim (submit final)
- Jika jawaban benar → bonus **30 poin**
- Transisi ke `finished` saat timer habis

### 5.7 Leaderboard & Tie-Breaker

- Leaderboard dihitung ulang setiap kali skor berubah
- Total skor = akumulasi poin matematika (Level 1+2+3) + bonus Final Resolution
- Broadcast `leaderboard:update` via Socket.IO ke semua client (termasuk layar proyektor)

#### Aturan Tie-Breaker (berurutan)

| Prioritas | Kriteria |
|---|---|
| 1 | Total skor tertinggi |
| 2 | Jumlah jawaban benar terbanyak (total semua level) |
| 3 | Jumlah jawaban benar Level 3 terbanyak |
| 4 | Timestamp server saat tim mengirim Final Case Resolution; tim tanpa resolution memakai batas waktu fase |
| 5 | Tandai "TIED" — play-off manual oleh panitia |

### 5.8 Kode Verifikasi (Hash)

- Setelah permainan selesai, generate HMAC-SHA256 dari (menggunakan secret server):
  ```
  "{team_id}|{team_name}|{total_score}|{level1_score}|{level2_score}|{level3_score}|{bonus}"
  ```
- Ambil 8 karakter pertama sebagai **kode verifikasi**
- Tampilkan di halaman hasil akhir tiap tim
- Tujuan: bukti integritas jika ada sengketa skor (panitia bisa verifikasi ulang)

### 5.9 Admin Dashboard

- Akses via password admin (disimpan di `config.js`)
- Fitur admin:
  - **Mulai Fase/Mode**: kontrol transisi yang valid dan reset mode tujuan
  - **Pantau Tim**: daftar 15 tim, status koneksi, skor, dan jumlah benar
  - **Leaderboard Live**: preview leaderboard dan status `TIED`/`DISQUALIFIED`
  - **Keputusan Kompetisi**: diskualifikasi, pemulihan status, dan play-off
  - **Audit Trail**: riwayat fase, status kompetisi, dan keputusan panitia
  - **Katalog Soal**: ID soal dan status asset gambar per mode
  - **Reset**: mengembalikan mode aktif ke lobby setelah konfirmasi

---

## 6. Arsitektur Jaringan — Dual Hotspot

```
┌──────────────┐              ┌──────────────┐
│  HP Hotspot 1 │              │  HP Hotspot 2 │
│  (WiFi, no    │              │  (WiFi, no    │
│   internet)   │              │   internet)   │
└──────┬───────┘              └──────┬───────┘
       │ USB tethering              │ USB tethering
       │                            │
┌──────┴────────────┬───────────────┴──────────┐
│              LAPTOP SERVER                    │
│  Interface 1:     Interface 2:                │
│  192.168.42.x     192.168.43.x                │
│                                               │
│  Node.js bind → 0.0.0.0:3000                  │
│                                               │
│  QR 1: http://192.168.42.x:3000               │
│  QR 2: http://192.168.43.x:3000               │
└───────────────────────────────────────────────┘
```

- **2 HP hotspot** menyediakan WiFi tanpa internet
- Laptop terhubung ke **kedua HP via kabel USB** secara bersamaan
- Server bind ke `0.0.0.0` agar bisa diakses dari kedua jaringan
- **2 QR code** berbeda, satu per grup hotspot (~8 tim per hotspot)
- Pada startup, server deteksi IP lokal dan print QR code ke console

---

## 7. API Endpoints

### 7.1 Public (Peserta)

| Method | Path | Deskripsi |
|---|---|---|
| `POST` | `/api/login` | Login dengan kode tim. Return: `{ team_id, name, code, token }` |
| `GET` | `/api/questions` | Ambil lima soal level aktif sesuai mode dan urutan tim; kunci jawaban tidak dikirim |
| `POST` | `/api/level-draft` | Simpan/ganti draft level. Body: `{ answers: { question_id: "A" } }` |
| `GET` | `/api/clues` | Ambil clue yang sudah dibuka untuk tim dan mode aktif |
| `POST` | `/api/submit-resolution` | Pilih satu kandidat final; hanya satu kali per tim/mode |
| `GET` | `/api/results` | Ambil breakdown hasil tim dan kode verifikasi |
| `GET` | `/api/leaderboard` | Ambil leaderboard read-only tanpa autentikasi |

### 7.2 Admin

| Method | Path | Deskripsi |
|---|---|---|
| `POST` | `/api/admin/login` | Login admin. Body: `{ password }` |
| `POST` | `/api/admin/start/:phase` | Mulai transisi fase yang valid, termasuk Case File |
| `GET` | `/api/admin/state` | State fase/mode, timestamp, durasi, dan sisa timer |
| `GET` | `/api/admin/competition` | Leaderboard, status tim, dan audit trail |
| `GET` | `/api/admin/questions?mode=...` | Katalog ID soal dan status asset gambar |
| `POST` | `/api/admin/mode` | Ganti mode dan reset hasil mode tujuan |
| `POST` | `/api/admin/disqualify` / `/api/admin/reinstate` | Kelola status kompetisi tim |
| `POST` | `/api/admin/playoff` | Catat urutan hasil play-off setelah fase selesai |
| `POST` | `/api/admin/reset` | Reset mode aktif ke `lobby` |

---

## 8. Event Socket.IO

### Server → Client

| Event | Data | Deskripsi |
|---|---|---|
| `phase:changed` | `{ phase, message }` | Fase permainan berubah |
| `timer:tick` | `{ remaining_seconds, total_seconds }` | Update timer setiap detik |
| `timer:expired` | `{ phase, mode }` | Timer habis; draft level dikunci dan finalisasi diproses |
| `score:updated` | `{ team_id, team_name, is_correct, bonus, mode }` | Resolution mengubah skor tim |
| `leaderboard:update` | `{ leaderboard }` | Leaderboard lengkap untuk admin/screen |
| `team:connected` / `team:disconnected` | `{ team_id, name? }` | Status koneksi tim untuk admin |

### Client → Server

| Event | Data | Deskripsi |
|---|---|---|
| `auth` | `{ team_id, token }` | Otentikasi koneksi Socket |

---

## 9. Urutan Pengerjaan (Fase Implementasi)

### Fase 1: Server Skeleton
- [ ] `npm init`, install dependencies (`express`, `socket.io`, `sql.js`)
- [ ] Buat `package.json` dengan script `start` dan `dev`
- [ ] Buat `config.js` — port, path DB, durasi level, password admin
- [ ] Buat `db/db.js` — koneksi SQLite singleton
- [ ] Buat `db/schema.js` — semua `CREATE TABLE` statement
- [ ] Buat `index.js` — Express server, static file serving dari `public/`, bind ke `0.0.0.0`
- [ ] Setup Socket.IO server di `index.js`
- [ ] Buat `start.bat` — satu klik untuk menjalankan server
- [ ] Verifikasi: server berjalan, bisa diakses via `http://localhost:3000`

### Fase 2: Database — Schema & Seed
- [ ] Buat `db/seed.js`:
  - 15 tim dengan nama dan kode login (contoh: `TIM01`, `TIM02`, ...)
  - 15 soal matematika placeholder (5 easy + 5 medium + 5 hard)
  - Clue definisi per level (masing-masing 4 ambang batas)
  - Reset state ke `lobby`
- [ ] Jalankan seed saat server pertama kali start (jika DB kosong)
- [ ] Verifikasi: query database, data ada semua

### Fase 3: Otentikasi Tim
- [ ] Buat `routes/auth.js`:
  - `POST /api/login` — validasi kode, return info tim + token sederhana
- [ ] Buat `socket/index.js`:
  - Handler event `auth` — asosiasikan socket dengan `team_id`
  - Middleware validasi token untuk semua event berikutnya
- [ ] Buat frontend `views/login.js` — form input kode tim
- [ ] Verifikasi: bisa login dengan kode tim, socket terautentikasi

### Fase 4: Game Engine — State Machine & Timer
- [ ] Buat `services/game.js`:
  - Fungsi `getState()` — baca fase saat ini dari DB
  - Fungsi `transition(phase)` — ubah fase, validasi transisi yang diizinkan
  - Fungsi `startLevel(phase, duration)` — set `level_started_at`, hidupkan timer
- [ ] Buat `services/timer.js`:
  - `setInterval` 1 detik
  - Hitung sisa waktu dari `level_started_at + duration - now`
  - Broadcast `timer:tick` ke semua client
  - Saat `≤ 0`: matikan timer, panggil `game.transition` ke fase clue
- [ ] Buat `socket/index.js`:
  - Broadcast `phase:changed` setiap kali fase berubah
  - Broadcast `timer:tick` setiap detik
- [ ] Buat frontend `views/waiting.js` — tampilan lobby
- [ ] Verifikasi: start level via kode → timer jalan → timer habis → auto transisi

### Fase 5: Bank Soal & Endpoint
- [ ] Buat `data/questions.json` — 15 soal placeholder (5 per level)
- [ ] Buat `routes/game.js` — `GET /api/questions`:
  - Validasi fase saat ini cocok dengan level yang diminta
  - Cek `team_question_order` — jika belum ada, generate urutan acak
  - Return daftar soal (tanpa `answer_key`!)
- [ ] Buat frontend `views/game.js` — tampilan soal, navigasi antar soal
- [ ] Verifikasi: client bisa ambil soal, urutan acak per tim, `answer_key` tidak bocor

### Fase 6: Draft dan Finalisasi Jawaban (selesai)
- [x] Buat `POST /api/level-draft` di `routes/game.js`.
- [x] Izinkan perubahan opsi selama level aktif.
- [x] Finalisasi lima jawaban per tim secara atomik saat timer habis.
- [x] Terapkan penalti salah/kosong di server dan simpan `level_results`.
- [x] Verifikasi: draft berubah sebelum deadline dan tidak mengubah skor sebelum finalisasi.

### Fase 7: Sistem Clue
- [ ] Buat `data/clues.json` — clue per level dengan ambang batas
- [ ] Buat `services/clues.js`:
  - `unlockClues(teamId, level)` — hitung jawaban benar → cocokkan threshold → simpan + broadcast
  - Dipanggil otomatis saat transisi ke fase `clue_1`/`clue_2`/`clue_3`
- [ ] Update `services/game.js` — panggil `unlockClues` untuk setiap tim saat transisi clue
- [ ] Buat frontend `views/investigation.js` — tampilkan semua clue yang sudah terbuka
- [ ] Verifikasi: level selesai → clue muncul → Investigation Board terisi

### Fase 8: Final Case Resolution
- [ ] Buat `POST /api/submit-resolution` di `routes/game.js`:
  - Validasi fase `resolution`, timer belum habis, belum submit
  - Cocokkan kandidat yang dipilih dengan kunci jawaban
  - Simpan ke `final_resolutions`, beri bonus 30 poin jika benar
- [ ] Buat frontend `views/resolution.js`:
  - Tampilkan 4 kandidat (dari Case File)
  - Timer 3 menit
  - Form pilih kandidat
- [ ] Verifikasi: pilih kandidat benar → bonus 30 poin; fase selesai → transisi ke `finished`

### Fase 9: Leaderboard & Hasil Akhir (selesai)
- Catatan: implementasi kode verifikasi menggunakan HMAC-SHA256 dengan secret server dan mengambil 8 karakter pertama.
- [x] Buat `services/scoring.js` — fungsi leaderboard dengan tie-breaker berlapis
- [x] Broadcast `leaderboard:update` setiap kali hasil level/resolution berubah
- [ ] Buat `services/verify.js` — generate hash SHA256, ambil 8 karakter pertama
- [x] Buat frontend `views/leaderboard.js` — tampilan leaderboard live read-only
- [x] Buat frontend `views/results.js` — breakdown skor per level + bonus + kode verifikasi
- [x] Verifikasi: leaderboard akurat, tie-breaker, play-off, dan kode verifikasi

### Fase 10: Admin Dashboard (selesai)
- [ ] Buat `routes/admin.js`:
  - `POST /api/admin/login` — validasi password
  - `POST /api/admin/start/:phase` — trigger transisi fase
  - `GET /api/admin/teams` — status semua tim
  - `GET /api/admin/export` — download JSON
  - `POST /api/admin/reset` — reset ke `lobby`
- [ ] Buat frontend `views/admin.js`:
  - Login admin
  - Panel kontrol dengan tombol mulai level
  - Tabel monitoring tim (nama, skor, progress soal, status koneksi)
  - Tombol ekspor hasil
- [x] Verifikasi: fungsi admin dan endpoint terlindungi token admin

### Fase 11: Frontend SPA — Integrasi Penuh
- [ ] Buat `app.js` — router tampilan berbasis fase permainan:
  - `lobby` → tampilan login
  - `level_*` → tampilan soal + timer
  - `clue_*` → tampilan clue + Investigation Board
  - `resolution` → tampilan pilih kandidat
  - `finished` → tampilan hasil + leaderboard
- [ ] Buat `socket.js` — wrapper Socket.IO client, reconnect logic
- [ ] Buat `style.css` — desain mobile-first, responsif, jelas
- [ ] Pastikan semua view terintegrasi dengan Socket event
- [ ] Verifikasi: alur permainan lengkap dari login sampai hasil akhir

### Fase 12: Jaringan & QR Code
- [ ] Buat `utils/network.js`:
  - Deteksi semua IP address lokal (exclude `127.0.0.1`)
  - Print URL ke console dengan format yang mudah disalin
  - Generate QR code ASCII di console (atau file PNG opsional)
- [ ] Panggil di `index.js` saat startup
- [ ] Verifikasi: bisa akses server dari HP yang terhubung ke hotspot yang sama

### Fase 13: Uji Coba & Dry Run
- [ ] Buka 15 tab browser (atau gunakan script bot) untuk simulasi 15 tim
- [ ] Jalankan alur lengkap: login → level 1 → submit → clue → level 2 → ... → finished
- [ ] Verifikasi:
  - Timer sinkron di semua client
  - Submit terkunci bersamaan saat timer habis
  - Leaderboard akurat
  - Clue terbuka sesuai threshold
  - Kode verifikasi konsisten
- [ ] Catat dan perbaiki bug
- [ ] Dokumentasikan cara setup dan menjalankan di hari-H

---

## 10. Spesifikasi Soal Placeholder

### Level 1 — Easy (10 poin/soal)

| # | Topik | Tipe Soal |
|---|---|---|
| 1 | Aritmatika | Operasi bilangan bulat sederhana |
| 2 | Aljabar | Persamaan linear satu variabel |
| 3 | Geometri | Luas bangun datar sederhana |
| 4 | Logika | Pola bilangan sederhana |
| 5 | Aritmatika | Persentase dan perbandingan |

### Level 2 — Medium (20 poin/soal)

| # | Topik | Tipe Soal |
|---|---|---|
| 1 | Aljabar | Sistem persamaan linear dua variabel |
| 2 | Geometri | Teorema Pythagoras |
| 3 | Statistika | Mean, median, modus |
| 4 | Logika | Pola bilangan kompleks |
| 5 | Aritmatika | Deret aritmatika/geometri |

### Level 3 — Hard/HOTS (30 poin/soal)

| # | Topik | Tipe Soal |
|---|---|---|
| 1 | Aljabar | Fungsi komposisi dan invers |
| 2 | Kombinatorik | Permutasi dan kombinasi |
| 3 | Geometri | Kesebangunan dan kongruensi |
| 4 | Peluang | Probabilitas kejadian majemuk |
| 5 | Logika | Penalaran deduktif kompleks |

---

## 11. File Konfigurasi (`config.js`)

```js
module.exports = {
  // Server
  PORT: 3000,
  HOST: '0.0.0.0',

  // Database
  DB_PATH: './data/code_cracker.db',

  // Durasi Level (dalam detik)
  LEVEL_1_DURATION: 5 * 60,    // 5 menit
  LEVEL_2_DURATION: 7 * 60,    // 7 menit
  LEVEL_3_DURATION: 8 * 60,    // 8 menit
  RESOLUTION_DURATION: 3 * 60, // 3 menit

  // Admin
  ADMIN_PASSWORD: 'changeme',
  VERIFICATION_SECRET: process.env.CODE_CRACKER_VERIFICATION_SECRET || 'change-this-verification-secret',

  // Final Resolution — kandidat Champion
  CHAMPION_CANDIDATES: [
    { id: 'A', name: 'Candidate Alpha', description: '...' },
    { id: 'B', name: 'Candidate Beta', description: '...' },
    { id: 'C', name: 'Candidate Charlie', description: '...' },
    { id: 'D', name: 'Candidate Delta', description: '...' },
  ],
  CORRECT_CHAMPION: 'C',
};
```

---

## 12. Dependensi (`package.json`)

```json
{
  "name": "code-cracker",
  "version": "1.0.0",
  "description": "Battle of Champions 2026 — Code Cracker: The Investigation Ladder",
  "main": "server/src/index.js",
  "scripts": {
    "start": "node server/src/index.js",
    "dev": "node --watch server/src/index.js"
  },
  "dependencies": {
    "sql.js": "^1.12.0",
    "express": "^4.21.0",
    "socket.io": "^4.8.0",
    "uuid": "^10.0.0"
  }
}
```

---

## 13. Batasan yang Diterima (Accepted Risks)

| Risiko | Mitigasi |
|---|---|
| Sniffing traffic oleh peserta teknis (karena HTTP, bukan HTTPS) | Diterima sebagai low-probability untuk konteks kompetisi. Pengawas memantau aktivitas mencurigakan. |
| Kapasitas hotspot WiFi HP terbatas | Maks 8-9 tim per hotspot, sisakan headroom dari batas 10 |
| Laptop server crash saat lomba | Siapkan laptop backup + salinan DB periodik |
| Koneksi WiFi tidak menjangkau seluruh venue | Uji jangkauan sebelum hari-H, siapkan HP hotspot cadangan |

---

## 14. Checklist Persiapan Hari-H

- [ ] Pastikan `node_modules` sudah terinstall (tidak perlu internet saat hari-H)
- [ ] Uji server berjalan tanpa internet (mode pesawat + hotspot)
- [ ] Cetak/tampilkan QR code untuk 2 grup hotspot
- [ ] Siapkan laptop + 2 HP + 2 kabel USB
- [ ] Uji jangkauan WiFi di venue sebelum acara
- [ ] Siapkan laptop backup dengan DB tersinkron
- [ ] Briefing panitia: cara start Case File, cara reset, cara membaca audit trail
- [ ] Briefing peserta: larangan komunikasi, HP mode pesawat + WiFi only

---

## 15. Catatan Implementasi Aktual

Bagian awal dokumen ini adalah blueprint awal. Struktur aktual yang sudah
diterapkan memiliki catatan berikut:

### 15.1 Workflow Soal Bergambar

Asset gambar diletakkan pada:

    server/public/uploads/questions/simulation/
    server/public/uploads/questions/official/

Nama file menggunakan question_id, misalnya q_1.png atau q_17.jpg. Urutan
soal pada tombol peserta tetap dapat diacak karena pemetaan tidak menggunakan
nomor urut tampilan.

Resolver berada di server/src/services/questionImages.js dan mengirim field
image_url pada GET /api/questions. Frontend menampilkan gambar jika tersedia
dan kembali ke soal teks jika asset tidak valid atau tidak ditemukan.

### 15.2 Validasi dan Katalog Admin

- Format yang diterima: png, jpg, jpeg, webp, gif, avif.
- Batas file: 5 MB.
- Batas dimensi yang dapat dibaca: 4096px.
- Endpoint katalog admin: GET /api/admin/questions?mode=simulation atau
  mode=official.
- Panel admin menampilkan ID soal, level, topik, dan status asset gambar.

### 15.3 Pengujian Aktual

- test:images memvalidasi resolver, file tidak valid, batas ukuran, dan batas
  dimensi.
- test:uat menjalankan 96 skenario backend dan pada validasi 28 Juli 2026
  menghasilkan 96/96 PASS.
- test:competition memvalidasi tie-break, play-off, diskualifikasi, dan audit
  trail; test:images memvalidasi resolver dan batas asset.
- Browser UAT headed memvalidasi katalog admin dan rendering PNG nyata pada
  halaman peserta. UAT visual leaderboard dengan build terakhir masih menjadi
  item sebelum hari-H.

### 15.4 Status Konten

Kode dan workflow sudah siap untuk dry run. Dataset official pada seed masih
bersifat placeholder dan wajib diganti dengan soal, clue, kunci jawaban, serta
gambar final sebelum pertandingan resmi.

### 15.5 Tahap III yang Sudah Diimplementasikan

- Participant view, admin view, dan leaderboard screen dipisahkan melalui
  `/?admin=1` dan `/?screen=leaderboard`.
- Admin memperoleh timer fase dari server, status koneksi tim, katalog soal,
  kontrol mode, keputusan diskualifikasi/play-off, dan audit trail.
- Leaderboard screen tidak membutuhkan login dan hanya menampilkan peringkat,
  skor, fase, dan timer.
- Sesi tim, draft level, fase, dan deadline dipulihkan saat reload/reconnect;
  restart server melanjutkan timer dari database, tetapi peserta perlu login
  ulang karena token sesi memory dibuat ulang.
- Untuk perubahan perilaku dari blueprint lama, gunakan `level_drafts` dan
  `level_results`; endpoint `POST /api/submit` bukan alur aktif.

> **End of Implementation Plan**
