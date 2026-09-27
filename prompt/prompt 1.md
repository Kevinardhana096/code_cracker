# Prompt 1 — Transkrip Sesi Chat Code Cracker

> Transkrip percakapan sesi kerja pada project Code Cracker (BOC 2026), 21 Agustus 2026.

---

## 1. Cara menjalankan project

**User:** bagaiamana cara jalankan project ini

**Claude:** Berikut cara menjalankan project **Code Cracker**:

### Cara Cepat (Server Game)

```bat
cd C:\project\code_cracker\server
npm install        ← hanya pertama kali
npm start
```

Atau double-click `server\start.bat`.

Lalu buka browser:
- **Peserta:** `http://localhost:3000` → masukkan kode tim
- **Admin (panitia):** `http://localhost:3000/?admin=1` → butuh password admin
- **Layar leaderboard:** `http://localhost:3000/?screen=leaderboard`

> Sebelum jalan, set dulu environment variable `CODE_CRACKER_ADMIN_PASSWORD` (min. 12 karakter) dan `CODE_CRACKER_VERIFICATION_SECRET` (min. 32 karakter).

### Script lain

| Perintah | Fungsi |
|---|---|
| `npm run dev` (di `server/`) | Server dengan auto-restart |
| `npm run test:uat` | Simulasi UAT |
| `npm run test:competition` | Tes logika kompetisi |
| `npm run mcp:playwright` (di root) | Playwright MCP untuk UAT frontend |

### Alur permainan

`Lobby → Case File (2 mnt) → Level 1 (5 mnt) → Clue → Level 2 (7 mnt) → Clue → Level 3 (8 mnt) → Clue → Resolution (3 mnt) → Leaderboard`

---

## 2. Ide menjalankan dengan mudah di terminal

**User:** apakah anda ada ide untuk menjalankannya dengan sangat mudah di terminal??

**Claude (penjelasan opsi):**

- **Opsi 1 — Script npm di root (rekomendasi):** tambah script di root `package.json` agar cukup `npm start` dari folder project tanpa `cd server`. Cara kerja: `npm --prefix server start`.
- **Opsi 2 — File `start.bat` di root** untuk double-click.
- **Opsi 3 — PowerShell alias/function** di `$PROFILE` (paling fleksibel tapi setup ribet).

**User:** okay, opsi 1

**Claude (diterapkan):** Edit `package.json` root:

```json
"scripts": {
  "start": "npm --prefix server start",
  "dev": "npm --prefix server run dev",
  "setup": "npm --prefix server install",
  "mcp:playwright": "npx @playwright/mcp --browser chromium"
}
```

---

## 3. Error konfigurasi keamanan

**User:** (menjalankan `npm start`, mendapat error)

```
Error: Konfigurasi keamanan belum lengkap: CODE_CRACKER_ADMIN_PASSWORD (minimal 12 karakter), CODE_CRACKER_VERIFICATION_SECRET (minimal 32 karakter)
```

**Claude:** Server menolak jalan karena 2 environment variable belum di-set (proteksi di `index.js:22`).

### Cara set di Git Bash

```bash
export CODE_CRACKER_ADMIN_PASSWORD='password-rahasia-anda'
export CODE_CRACKER_VERIFICATION_SECRET='secret-acak-minimal-32-karakter-123456'
npm start
```

### Opsi

- **(a)** `export` manual setiap sesi
- **(b)** dukungan file `.env` — sekali setting selamanya

**User:** apa rekomendasi anda?

**Claude:** Rekomendasi **opsi (b) — file `.env`**:
1. Sekali setting, selamanya jalan — sesuai tujuan "sangat mudah"
2. Aman — `.env` di-gitignore, tidak ikut ter-commit
3. Tanpa dependency baru — project tetap offline-ready untuk hari-H
4. `export` manual mudah lupa; `~/.bashrc` menyimpan password di file global yang tidak terlihat

**User:** terapkan

**Claude (diterapkan):**
1. Buat `server/src/load-env.js` — loader `.env` minimal tanpa dependency (tidak menimpa env yang sudah ada)
2. Panggil `require('./load-env')` di baris pertama `server/src/index.js`
3. Generate `server/.env` dengan nilai acak aman:
   - `CODE_CRACKER_ADMIN_PASSWORD=nZO7l51FftXns-Ks`
   - `CODE_CRACKER_VERIFICATION_SECRET=<43 karakter acak>`
4. Tambahkan `server/.env` ke `.gitignore`
5. Tes: server berhasil start dengan `npm start`

---

## 4. Tampilkan info IP di terminal

**User:** bisakah saat di npm start, di terminalnya muncul informasi ip untuk admin/panitian dan peserta?? Jelaskan

**Claude (penjelasan):** Bisa. Saat ini banner hanya menampilkan IP mentah, panitia masih harus mengingat sendiri bahwa admin pakai `/?admin=1` dst. Usulan: untuk setiap IP jaringan, cetak 3 URL siap pakai (Peserta, Admin, Leaderboard). Detail teknis:
1. Sumber IP sudah ada via `os.networkInterfaces()`
2. URL hanya tempelan string — tidak ada route baru
3. Password tidak ditampilkan demi keamanan

Perubahan hanya di bagian cetak banner `index.js`/`network.js` (~15-20 baris).

**User:** serta credential bisa gak??

**Claude:** Bisa secara teknis, tapi ada trade-off keamanan:

- **Pro:** laptop hanya dipegang panitia; tidak perlu buka `.env`
- **Risiko:** siapa pun yang melihat layar (foto, screen-share) bisa login admin — kredensial paling sensitif

Rekomendasi: flag `-s` (secret) — default disamarkan, `npm start -- -s` menampilkan. Opsi: (1) flag `-s`, (2) selalu tampil, (3) jangan tampilkan.

**User:** selalu tampil

**Claude (diterapkan):** Ubah `printQRInfo` di `server/src/utils/network.js`:

```
Localhost (laptop server):
  Peserta:      http://localhost:3000
  Admin:        http://localhost:3000/?admin=1
  Leaderboard:  http://localhost:3000/?screen=leaderboard

Network interfaces:
  Wi-Fi (192.168.114.212):
    Peserta / Admin / Leaderboard ...

============================================
  Kredensial Admin (rahasia, jangan sebar):
    Password: nZO7l51FftXns-Ks

  Kode login tim: server/data/team-login-codes.txt
============================================
```

---

## 5. Tampilan admin satu page

**User:** tampilan admin emang di satu page aja yah?? jelaskan

**Claude:** Ya, seluruh aplikasi adalah **SPA (Single Page Application)** satu file HTML (`server/public/index.html`):

1. **Satu file HTML** berisi semua tampilan (login, lobby, game, admin, leaderboard) sebagai section yang disembunyikan/ditampilkan
2. **Pembeda peran lewat query string** (`app.js:95`):
   - `/` → peserta, `/?admin=1` → admin, `/?screen=leaderboard` → layar
3. **Pergantian tampilan via JS** (`showView('admin')`), tanpa reload
4. **Update real-time via Socket.IO**

Kenapa didesain begini:
- **Offline-ready** — penting untuk jaringan hotspot tanpa internet
- **Satu port, satu proses** — meminimalkan masalah firewall hari-H
- **State sinkron** — admin menekan "Mulai" langsung terlihat di semua perangkat

Panel admin (`admin.js`, 326 baris) mencakup: kontrol mulai/reset, timer, mode simulasi vs resmi, monitoring 15 tim, play-off, diskualifikasi, audit trail.

---

## 6. Kontrol fase yang tidak membingungkan

**User:** saya ingin bagian kontrol fase pertandingan itu tidak membuat saya kebingungan

**Claude (analisis masalah):** Di `admin.js:86-123` ada **4 tombol sekaligus yang kelihatannya setara**:

```
[ Mulai Simulasi ] [ Mulai Pertandingan Resmi ] [ Mulai Case File ] [ Reset ]
```

Padahal beda tingkat: dua tombol pertama **ganti mode** (menghapus hasil!), "Mulai Case File" adalah **satu-satunya tombol yang benar-benar perlu ditekan**, dan "Reset" tombol darurat. Padahal alurnya: mode dipilih sekali → tekan Mulai Case File sekali → sisanya otomatis.

**Usulan:** panduan langkah bertingkat — hanya tampilkan aksi relevan:
- Di lobby: LANGKAH 1 pilih mode (radio-style) → LANGKAH 2 tombol besar "▶ MULAI CASE FILE" + catatan fase otomatis; Reset kecil di pojok
- Saat berjalan: status "SEDANG BERJALAN: Level 2 — fase berikutnya otomatis"
- Saat selesai: pesan selesai + petunjuk sesi baru

**User:** ya

**Claude (diterapkan):**
- Tulis ulang `renderControls` di `admin.js` dengan `PHASE_LABELS`, `PHASE_FLOW`, `nextPhaseLabel`, `buildResetButton`
- CSS baru di `style.css`: `.control-step`, `.btn-mode.active`, `.btn-primary-action`, `.control-status`, `.btn-reset-small`
- Tes: server start normal

---

## 7. Metode input soal

**User:** untuk input soalnya metodenya gimana?

**Claude:** Saat ini **hardcode di file seed** (`server/src/db/seed.js:63`) — tidak ada UI upload. Format per soal:

```js
{ level: 1, topic: 'Aritmatika',
  question_text: 'Berapakah hasil dari 125 + 375 - 200?',
  answer_key: 'A',
  options: [{ id: 'A', text: '300' }, ...],
  points: 10 }
```

Aturan:
- 15 soal: L1 (5×10 poin), L2 (5×20), L3 (5×30)
- 2 dataset: `simulation` dan `official` (official masih placeholder, harus diganti sebelum hari-H)
- Soal masuk DB **hanya saat DB baru dibuat** — edit seed.js tidak mengubah soal kecuali hapus `server/data/code_cracker.db` dulu
- Gambar soal opsional di `server/public/uploads/questions/<mode>/q_<id>.png`
- Clue juga di-seed dengan cara sama

Kelemahan: rawan salah (lupa hapus DB), tidak ada validasi format, soal rahasia ikut ter-commit.

Opsi perbaikan:
1. **File JSON terpisah** (di-gitignore) — paling simpel
2. **JSON + auto-reload** — deteksi perubahan file
3. **UI admin untuk input soal** — paling nyaman tapi paling banyak kerja

**User:** kalau yang opsi 3 itu gimana?

**Claude (penjelasan):** Manajemen soal langsung dari panel admin — kartu "Manajemen Soal" dengan tabel per level, tombol Tambah/Edit/Hapus, form (level, topik, teks, 4 opsi, kunci radio, poin, upload gambar).

Yang harus dibangun:
- **Backend:** `GET questions/full`, `POST`, `PUT /:id`, `DELETE /:id` + validasi (kunci A–D, 4 opsi, poin > 0, maks 5 soal/level)
- **Frontend:** tabel + form + konfirmasi (~300–400 baris, bagian terbesar)

Pengamanan wajib: kunci edit saat pertandingan berjalan, konfirmasi mode official, audit trail, risiko kredensial admin bocor = kunci jawaban bocor, tombol ekspor JSON untuk backup.

**User:** lanjut opsi 3 sih, namun gak usah terlalu dipentingn soal keamanan

**Claude (diterapkan):**

### Backend — `server/src/routes/admin.js`
- `validateQuestionPayload()` — validasi level 1-3, kunci A-D, 4 opsi terisi, poin > 0
- `questionEditGuard()` — kunci edit saat fase bukan lobby (HTTP 409)
- `GET /api/admin/questions/full` — daftar lengkap dengan kunci + flag `locked`
- `POST /api/admin/questions` — tambah (maks 5 soal/level)
- `PUT /api/admin/questions/:id` — edit
- `DELETE /api/admin/questions/:id` — hapus
- Semua perubahan tercatat di audit trail (`QUESTION_ADDED/UPDATED/DELETED`)

### Frontend
- `index.html` — kartu baru "Manajemen Soal" (`#admin-qbank`)
- `admin.js` — `adminFetch`, `loadQuestionBank`, `renderQuestionBank`, `showQuestionForm`, `deleteQuestion`; daftar per level dengan info ID/topik/poin/kunci/preview; tombol + Tambah (hilang saat 5 soal), Edit, Hapus (konfirmasi); form dengan radio kunci jawaban; notice saat terkunci
- `style.css` — style `.qbank-*`

### Hasil uji end-to-end (semua lolos)

| Tes | Hasil |
|---|---|
| Daftar soal lengkap | ✅ 15 soal, locked=false |
| Tambah saat level penuh | ✅ Ditolak: "sudah memiliki 5 soal (maksimal)" |
| Hapus + tambah | ✅ |
| Edit (topik/kunci/poin) | ✅ Tersimpan |
| Kunci tidak valid (Z) | ✅ Ditolak |
| Edit saat pertandingan jalan | ✅ Dikunci (409) |

Database di-reset setelah testing; soal seed asli dibuat ulang saat start berikutnya.

---

## Ringkasan file yang diubah/dibuat dalam sesi ini

| File | Perubahan |
|---|---|
| `package.json` (root) | Script `start`, `dev`, `setup` |
| `server/src/load-env.js` | **Baru** — loader `.env` |
| `server/src/index.js` | Panggil `load-env` paling atas |
| `server/.env` | **Baru** — kredensial acak (di-gitignore) |
| `.gitignore` | Tambah `server/.env` |
| `server/src/utils/network.js` | Banner URL per-peran + kredensial admin |
| `server/public/js/views/admin.js` | Kontrol fase langkah-bertingkat + UI manajemen soal |
| `server/public/css/style.css` | Style kontrol langkah + manajemen soal |
| `server/public/index.html` | Kartu "Manajemen Soal" |
| `server/src/routes/admin.js` | Endpoint CRUD soal + validasi + kunci fase |
