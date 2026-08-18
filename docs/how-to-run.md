# Panduan Menjalankan — Code Cracker: The Investigation Ladder

> **Battle of Champions (BOC) 2026 — Detective Division**

---

Untuk panduan operasional peserta dan panitia, lihat
[User Manual Code Cracker](User-Manual_Code-Cracker.md).

## Daftar Isi

1. [Prasyarat](#1-prasyarat)
2. [Struktur Folder](#2-struktur-folder)
3. [Install Dependensi](#3-install-dependensi)
4. [Menjalankan Server](#4-menjalankan-server)
5. [Akses Client (Peserta)](#5-akses-client-peserta)
6. [Akses Admin (Panitia)](#6-akses-admin-panitia)
7. [Alur Permainan Lengkap](#7-alur-permainan-lengkap)
8. [Setup Jaringan Dual Hotspot (Hari-H)](#8-setup-jaringan-dual-hotspot-hari-h)
9. [Backup & Recovery](#9-backup--recovery)
10. [Troubleshooting](#10-troubleshooting)

---

## 1. Prasyarat

- **Node.js** versi 18+ sudah terinstall di laptop server
- **2 unit HP** sebagai hotspot WiFi
- **2 kabel USB** untuk USB tethering
- **1 layar/proyektor** tambahan untuk leaderboard
- Semua dependensi sudah di-install **sebelum hari-H** (harus offline-ready)

---

## 2. Struktur Folder

```
code_cracker/
├── server/
│   ├── start.bat              ← Klik ini untuk menjalankan
│   ├── package.json
│   ├── src/
│   │   ├── index.js           ← Entry point server
│   │   ├── config.js          ← Konfigurasi (durasi, password, dll.)
│   │   ├── db/                ← Database SQLite
│   │   ├── services/          ← Logika game (timer, skor, clue)
│   │   ├── routes/            ← API endpoint
│   │   └── socket/            ← WebSocket handler
│   ├── public/                ← Frontend (HTML/CSS/JS)
│   └── data/
│       └── code_cracker.db    ← File database
└── docs/
    └── implementation-plan.md
```

---

## 3. Install Dependensi

**Lakukan ini sebelum hari-H!** Saat hari-H tidak boleh ada akses internet.

```bat
cd server
npm install
```

Verifikasi:
```bat
npm start
```

Buka browser ke `http://localhost:3000` — akan muncul halaman login Code Cracker.

---

## 4. Menjalankan Server

### Cara 1: Double-click (Rekomendasi)

Buka folder `server`, double-click file **`start.bat`**

### Cara 2: PowerShell

```powershell
cd C:\project\code_cracker\server
.\start.bat
```

### Cara 3: Command Prompt / PowerShell

```bat
cd C:\project\code_cracker\server
npm start
```

### Cara 4: Command Prompt / PowerShell (Auto-restart)

```bat
cd C:\project\code_cracker\server
npm run dev
```

### Output server yang benar:

```
[DB] Schema initialized
[DB] Seed data inserted: 15 teams, 15 questions, 12 clues

============================================
  Code Cracker — BOC 2026
  The Investigation Ladder
============================================

  Server running on http://0.0.0.0:3000
  Local access:     http://localhost:3000

============================================

  Network interfaces:
    [1] Wi-Fi: http://192.168.1.5:3000
    [2] Ethernet: http://192.168.42.10:3000
```

---

## 5. Akses Client (Peserta)

### 5.1 Cara Bergabung

1. Hubungkan HP ke **WiFi hotspot panitia**
2. Buka browser (Chrome/Safari)
3. Scan QR code yang disediakan panitia, atau ketik manual:  
   `http://<IP_SERVER>:3000`
4. Masukkan **kode tim** unik yang diberikan panitia.
5. Klik **Bergabung**

### 5.2 Daftar Kode Login Tim

| Kode | Nama Tim | | Kode | Nama Tim | | Kode | Nama Tim |
|---|---|---|---|---|---|---|---|
Kode dibuat acak pada inisialisasi pertama dan ditulis sementara ke
`server/data/team-login-codes.txt`. Distribusikan secara privat lalu hapus file tersebut.

> **Catatan**: Kode login menggunakan huruf kapital. Tidak case-sensitive.

### 5.3 Tampilan yang Akan Dilihat Peserta

| Fase | Tampilan | Yang Bisa Dilakukan |
|---|---|---|
| **Login** | Form input kode tim | Masuk ke permainan |
| **Lobby** | "Menunggu Babak Dimulai" | Menunggu admin memulai |
| **Case File** | Timer 2 menit | Membaca Case File fisik dari panitia |
| **Level 1/2/3** | Timer + 5 soal pilihan ganda | Memilih A-D, berpindah soal, mengganti pilihan, dan menunggu finalisasi server |
| **Clue** | Investigation Board + timer 30 detik | Membaca clue yang diperoleh |
| **Resolution** | Pilih kandidat Champion | Memilih 1 dari 4 kandidat |
| **Finished** | Breakdown skor + kode verifikasi | Melihat hasil akhir |

---

## 6. Akses Admin (Panitia)

### 6.1 Cara Masuk

Buka browser, akses URL dengan parameter `admin`:

```
http://<IP_SERVER>:3000/?admin=1
```

Atau dari laptop server:
```
http://localhost:3000/?admin=1
```

Masukkan password admin yang Anda set melalui `CODE_CRACKER_ADMIN_PASSWORD`.

> **Ganti password di `config.js` sebelum hari-H:**  
> Sebelum menjalankan server, set `CODE_CRACKER_ADMIN_PASSWORD` (minimal 12 karakter) dan
> `CODE_CRACKER_VERIFICATION_SECRET` (minimal 32 karakter). Jangan simpan nilainya di repository.

> **Atur secret kode verifikasi sebelum hari-H:**
> gunakan environment variable `CODE_CRACKER_VERIFICATION_SECRET`.

### 6.2 Kontrol Admin

#### Mode Simulasi dan Resmi

Pada kondisi awal `SIMULATION / LOBBY`, admin cukup menekan **Mulai Case File**.
Untuk berpindah mode, pilih **Mulai Simulasi** atau **Mulai Pertandingan Resmi**;
tindakan tersebut mengembalikan mode tujuan ke lobby dan mengosongkan hasil mode
tujuan. Mode simulasi menggunakan data, skor, clue, dan hasil yang terpisah dari
mode resmi.
Gunakan simulasi untuk menguji koneksi 15 perangkat, timer, penyimpanan draft,
Socket.IO, clue, dan leaderboard.

Setelah simulasi selesai, pilih **Mulai Pertandingan Resmi**. Sistem akan memulai
mode resmi dari kondisi bersih. Dataset resmi saat ini masih placeholder dan
harus diganti dengan soal final sebelum hari-H.

Untuk layar tancap, buka URL terpisah berikut tanpa login admin:

```text
http://<IP_SERVER>:3000/?screen=leaderboard
```

| Tombol | Fungsi | Kapan Ditekan |
|---|---|---|
| **Mulai Case File** | Memulai seluruh rangkaian, timer Case File 2 menit | Setelah semua tim siap |
| **Timer admin** | Menampilkan fase dan sisa waktu global | Dipantau sepanjang pertandingan |
| **Reset** | Reset seluruh permainan ke lobby | Hanya jika terjadi masalah serius |

### 6.3 Alur Admin Per Level

1. Pada mode awal `SIMULATION / LOBBY`, klik **Mulai Case File**. Jika perlu
   berpindah mode, pilih mode tujuan terlebih dahulu; tindakan itu mengosongkan
   hasil mode tujuan.
2. Timer habis → sistem otomatis masuk Level 1 selama 5 menit dan memfinalisasi jawaban level saat waktunya habis.
3. Setelah Level 1 → clue 1 tampil 30 detik → sistem otomatis masuk Level 2 selama 7 menit.
4. Setelah Level 2 → clue 2 tampil 30 detik → sistem otomatis masuk Level 3 selama 8 menit.
5. Setelah Level 3 → clue 3 tampil 30 detik → sistem otomatis masuk Final Case Resolution selama 3 menit.
6. Timer Final Case Resolution habis → leaderboard final muncul otomatis.

> **Penting**: Admin hanya perlu memulai Case File satu kali. Admin tidak perlu
> memindahkan level atau clue secara manual. Timer juga terlihat di panel admin.

### 6.4 Keputusan Kompetisi

Setelah fase selesai, leaderboard menerapkan tie-break berurutan: total poin,
jumlah benar, jumlah benar Level 3, lalu waktu penyelesaian. Tim yang masih
seri ditampilkan sebagai **TIED** dan belum ditandai lolos.

Jika play-off diperlukan, admin memasukkan ID tim sesuai urutan hasil play-off
di bagian **Keputusan Kompetisi**. Hasil tersebut menghilangkan status seri dan
dicatat bersama waktu serta catatan panitia.

Untuk diskualifikasi, masukkan ID tim dan alasan. Tim berstatus **DISQUALIFIED**
tidak memiliki peringkat dan tidak dapat mengubah jawaban. Semua diskualifikasi,
pemulihan status, fase mulai, dan hasil play-off tersimpan pada **Audit Trail**.

---

## 7. Alur Permainan Lengkap

```
LOBBY -> CASE FILE (2 menit) -> LEVEL 1 (5 menit) -> CLUE 1 (30 detik)
      -> LEVEL 2 (7 menit) -> CLUE 2 (30 detik) -> LEVEL 3 (8 menit)
      -> CLUE 3 (30 detik) -> FINAL CASE RESOLUTION (3 menit) -> FINISHED
```

### Timeline Total

| Segmen | Durasi | Waktu Real (estimasi) |
|---|---|---|
| Briefing & Login | ~10 menit | 09:00 – 09:10 |
| Case File | 2 menit | 09:10 – 09:12 |
| Level 1 | 5 menit | 09:12 – 09:17 |
| Clue 1 | 30 detik | 09:17 – 09:17:30 |
| Level 2 | 7 menit | 09:17:30 – 09:24:30 |
| Clue 2 | 30 detik | 09:24:30 – 09:25 |
| Level 3 | 8 menit | 09:25 – 09:33 |
| Clue 3 | 30 detik | 09:33 – 09:33:30 |
| Final Case Resolution | 3 menit | 09:33:30 – 09:36:30 |
| Leaderboard Final | — | 09:36:30 |
| **Total permainan** | **26 menit 30 detik** | |

---

## 8. Setup Jaringan Dual Hotspot (Hari-H)

### 8.1 Perangkat yang Dibutuhkan

- 1 laptop (server)
- 2 HP (hotspot WiFi)
- 2 kabel USB
- 1 layar/proyektor untuk leaderboard

### 8.2 Langkah Setup

1. **Aktifkan hotspot** di kedua HP (tanpa internet/data seluler)

2. **Sambungkan laptop ke kedua HP via USB:**
   - Colokkan kabel USB dari HP 1 ke laptop
   - Colokkan kabel USB dari HP 2 ke laptop
   - Aktifkan **USB tethering** di masing-masing HP

3. **Jalankan server** — double-click `start.bat`

4. **Catat IP dari console output:**
   ```
   Network interfaces:
     [1] Ethernet 3: http://192.168.42.x:3000    ← buat QR 1
     [2] Ethernet 4: http://192.168.43.x:3000    ← buat QR 2
   ```

5. **Buat QR code** dari kedua URL tersebut:
   - Gunakan QR code generator (bisa offline: simpan HTML generator di laptop, atau screenshot dari console)
   - Tampilkan/cetak QR code untuk dibagikan ke peserta
   - **QR 1** untuk grup tim yang connect ke hotspot 1 (±8 tim)
   - **QR 2** untuk grup tim yang connect ke hotspot 2 (±7 tim)

6. **Pastikan server bind ke `0.0.0.0`** (sudah default di config)

### 8.3 Diagram Jaringan

```
┌──────────────┐              ┌──────────────┐
│  HP HOTSPOT 1│              │  HP HOTSPOT 2│
│  WiFi:       │              │  WiFi:       │
│  No Internet │              │  No Internet │
└──────┬───────┘              └──────┬───────┘
       │ USB                          │ USB
       │ tethering                    │ tethering
       ▼                              ▼
┌──────────────────────────────────────────┐
│            LAPTOP SERVER                  │
│  192.168.42.x  ─┬─  192.168.43.x         │
│                  │                        │
│          Node.js :3000                    │
│          (bind 0.0.0.0)                  │
└──────────────────────────────────────────┘
       ▲                              ▲
       │ WiFi                         │ WiFi
       ▼                              ▼
  ┌─────────┐                   ┌─────────┐
  │ TIM 01  │                   │ TIM 09  │
  │ TIM 02  │                   │ TIM 10  │
  │ ...     │  (±8 tim)        │ ...     │  (±7 tim)
  │ TIM 08  │                   │ TIM 15  │
  └─────────┘                   └─────────┘
```

### 8.4 Setting IP Statis (Opsional)

Jika IP berubah-ubah tiap restart:
1. Buka **Control Panel → Network and Sharing Center → Change adapter settings**
2. Klik kanan interface USB tethering → **Properties**
3. Pilih **Internet Protocol Version 4 (TCP/IPv4)** → **Properties**
4. Pilih **Use the following IP address**:
   - Interface 1: `192.168.42.100`, subnet `255.255.255.0`
   - Interface 2: `192.168.43.100`, subnet `255.255.255.0`
5. Klik OK

---

## 9. Backup & Recovery

### 9.1 Backup Database

File database ada di: `server/data/code_cracker.db`

Setiap perubahan permainan disimpan ke file database secara langsung. Salin file ini
secara berkala ke lokasi aman sebagai backup:

```bat
copy server\data\code_cracker.db backup\code_cracker_backup_%date:~-4%%date:~4,2%%date:~7,2%_%time:~0,2%%time:~3,2%.db
```

### 9.2 Siapkan Laptop Backup

1. Copy seluruh folder `server/` ke laptop backup
2. Jalankan `npm install` di laptop backup (sebelum hari-H)
3. Saat hari-H, sync database dari laptop utama ke backup secara berkala
4. Jika laptop utama bermasalah:
   - Jalankan server di laptop backup
   - Peserta reconnect (reload halaman)

### 9.3 Reset Database

Jika ingin menghapus semua data dan memulai dari awal:

```bat
del server\data\code_cracker.db
npm start
```

Database akan dibuat ulang dengan data seed baru.

---

## 10. Troubleshooting

| Masalah | Solusi |
|---|---|
| **Server tidak bisa diakses dari HP** | Pastikan HP terhubung ke WiFi hotspot yang sama. Cek IP server di console. Matikan firewall Windows sementara. |
| **Login gagal "Kode tim tidak valid"** | Cek daftar kode tim di atas. Pastikan huruf kapital. Restart server untuk reset DB. |
| **Timer tidak muncul di client** | Cek koneksi Socket.IO — client terhubung jika tidak ada error di console browser. Reload halaman client. |
| **Pilihan tidak bisa diubah** | Timer level sudah habis atau level sudah difinalisasi server. Pilihan dapat diubah selama fase level aktif. |
| **Soal tidak muncul** | Case File belum selesai atau fase level belum aktif. Pastikan fase di admin panel menunjukkan `case_file`/`level_1`/`level_2`/`level_3`. |
| **Clue tidak terbuka** | Clue otomatis terbuka setelah timer level habis. Jika tidak muncul, reload halaman peserta. |
| **Leaderboard tidak update** | Leaderboard diperbarui setelah satu level difinalisasi atau resolution dikirim. Jika stuck, reload halaman leaderboard. |
| **Node.js error saat start** | Jalankan `npm install` ulang. Pastikan tidak ada proses Node.js yang masih berjalan (`taskkill /f /im node.exe`). |
| **PowerShell script diblokir** | Buka PowerShell sebagai admin, jalankan: `Set-ExecutionPolicy -Scope CurrentUser RemoteSigned` |
| **Port 3000 sudah dipakai** | Ubah `PORT` di `config.js` ke port lain (misal 8080). Update QR code. |
| **Server restart saat permainan berlangsung** | Timer dilanjutkan berdasarkan timestamp server yang tersimpan. Peserta perlu login ulang karena token sesi memory server dibuat ulang; draft dan hasil tetap ada di database. |

---

## Ringkasan Cepat Hari-H

1. **Setup**: HP hotspot ON → USB tethering ON → `start.bat` → catat IP → buat QR
2. **Briefing**: Bagikan Case File + QR code ke peserta
3. **Login**: Peserta scan QR → masuk dengan kode tim
4. **Mulai**: Admin buka `/?admin=1` → klik Mulai Case File
5. **Pantau**: Admin monitor timer dan status; layar tancap buka `/?screen=leaderboard`
6. **Selesai**: Leaderboard final muncul otomatis → ambil screenshot → 5 tim teratas lolos

---

> **End of Documentation**
