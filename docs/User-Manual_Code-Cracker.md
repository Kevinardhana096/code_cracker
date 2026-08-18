# User Manual

## Code Cracker: The Investigation Ladder

Panduan ini digunakan oleh peserta/tim dan panitia, mulai dari login sampai
hasil akhir pertandingan.

Dokumen terkait:

- [Panduan menjalankan server](how-to-run.md)
- [Laporan UAT frontend](UAT_Frontend_Playwright_MCP.md)
- [Laporan UAT lengkap](UAT_Code_Cracker.md)

## 1. Gambaran Permainan

Urutan permainan:

```text
LOBBY -> CASE FILE -> LEVEL 1 -> CLUE 1 -> LEVEL 2 -> CLUE 2
      -> LEVEL 3 -> CLUE 3 -> FINAL CASE RESOLUTION -> FINISHED
```

| Babak | Isi | Nilai |
|---|---|---:|
| Case File | Membaca informasi awal | 2 menit |
| Level 1 | 5 soal | 10 poin per jawaban benar |
| Level 2 | 5 soal | 20 poin per jawaban benar |
| Level 3 | 5 soal | 30 poin per jawaban benar |
| Final Resolution | Pilih 1 kandidat | Bonus 30 poin jika benar |

## 2. Persiapan Peserta

1. Hubungkan HP ke Wi-Fi hotspot panitia.
2. Buka browser modern.
3. Buka URL permainan atau scan QR code.
4. Siapkan kode tim yang diberikan panitia.
5. Jangan membagikan kode tim kepada tim lain.

| Kode | Nama Tim | Kode | Nama Tim | Kode | Nama Tim |
|---|---|---|---|---|---|
Kode tim dibuat acak saat inisialisasi. Ambil daftar sementara dari
`server/data/team-login-codes.txt`, distribusikan secara privat, lalu hapus file tersebut.

## 3. Panduan Peserta

### 3.1 Login

1. Masukkan kode tim pada **Masuk pertandingan**.
2. Tekan **Bergabung**.
3. Pastikan nama tim pada header sudah benar.
4. Jika muncul **Menunggu babak dimulai**, tunggu panitia.

![Layar peserta menunggu](uat-screenshots/01-participant-waiting.png)

### 3.2 Mengerjakan Level

1. Perhatikan level, topik, nilai soal, dan timer.
2. Pilih salah satu opsi A--D.
3. Gunakan tombol nomor 1--5 untuk berpindah soal.
4. Kembali ke soal sebelumnya jika ingin mengganti pilihan.
5. Pilihan dapat diubah selama timer level masih berjalan.
6. Saat timer habis, sistem mengunci draft dan menilai lima pilihan sekaligus.

Tidak ada tombol submit final per soal. Draft disimpan sebagai satu paket level,
dan peserta dapat mengganti pilihan selama timer masih aktif. Skor, jumlah benar,
salah, dan kosong baru dikonfirmasi setelah server memfinalisasi level; aplikasi
tidak menampilkan feedback benar/salah sementara pada soal yang masih dapat diubah.

![Halaman soal Level 1](uat-screenshots/04-participant-level1.png)

Skor peserta yang ditampilkan adalah skor yang sudah dikonfirmasi setelah level
difinalisasi server. Sistem tidak menampilkan benar/salah saat peserta masih
mengubah pilihan.

### 3.3 Clue Board

Ketika timer level habis, pilihan otomatis terkunci dan server memfinalisasi
kelima jawaban. Halaman berpindah ke **Papan Petunjuk // Clue Board** selama
30 detik, lalu server otomatis membuka fase berikutnya.

![Clue board](uat-screenshots/07-fullcycle-level2.png)

### 3.4 Final Resolution

1. Baca seluruh clue.
2. Baca deskripsi empat kandidat.
3. Pilih satu kandidat Champion.
4. Pilihan langsung dikunci setelah dikirim; periksa feedback bonus dan hasil akhir.

![Final resolution](uat-screenshots/09-final-resolution.png)

![Feedback final resolution](uat-screenshots/11-resolution-feedback.png)

### 3.5 Hasil Akhir

Halaman hasil menampilkan rincian skor setiap level, bonus resolution, total
skor, dan kode verifikasi server. Simpan atau foto kode verifikasi jika
diminta panitia.

## 4. Panduan Admin/Panitia

### 4.1 Membuka Panel Admin

1. Buka:

   ```text
   http://<IP_SERVER>:3000/?admin=1
   ```

2. Masukkan password admin.
3. Tekan **Otorisasi**.
4. Pastikan mode dan fase pada panel sudah benar.

Password admin wajib diatur melalui `CODE_CRACKER_ADMIN_PASSWORD`. Atur
`ADMIN_PASSWORD` pada `server/src/config.js` sebelum hari-H dan jangan
membagikan password kepada peserta.

![Panel admin lobby](uat-screenshots/02-admin-lobby.png)

### 4.2 Menambahkan Soal Bergambar

Panitia cukup menaruh file gambar pada folder mode yang sesuai. Sistem membaca
file tersebut ketika peserta membuka soal.

```text
server/public/uploads/questions/
├── simulation/
│   └── q_<question_id>.<ekstensi>
└── official/
    └── q_<question_id>.<ekstensi>
```

Contoh:

```text
simulation/q_1.png
official/q_17.jpg
```

Aturan:

- gunakan nama `q_<question_id>`, bukan nomor urut tombol soal;
- gunakan ekstensi `png`, `jpg`, `jpeg`, `webp`, `gif`, atau `avif`;
- gunakan folder `simulation` untuk gambar simulasi dan `official` untuk gambar
  pertandingan resmi;
- tidak perlu mengubah database atau me-restart server;
- jika file tidak ditemukan atau nama salah, soal tetap tampil sebagai soal teks.

ID soal dapat dilihat dari data/API soal atau seed database. Jangan gunakan
nomor 1--5 pada tombol navigasi karena urutan soal diacak untuk setiap tim.

Panel admin juga menampilkan daftar ID soal dan status gambar pada bagian
**Daftar Soal & Status Gambar**. Status yang mungkin muncul adalah **Belum
ada**, nama file dan dimensinya, atau **Tidak valid**.

Batas validasi saat ini adalah maksimum 5 MB dan maksimum 4096px. Gambar yang
tidak valid tidak dikirim ke peserta; soal tetap tampil sebagai soal teks.

![Katalog ID soal dan status gambar](uat-screenshots/14-admin-question-catalog.png)

![Soal bergambar pada halaman peserta](uat-screenshots/15-participant-image-question.png)

### 4.3 Memilih Mode

- Pada kondisi awal `SIMULATION / LOBBY`, admin langsung menekan **Mulai Case File**.
- **Mulai Simulasi** digunakan untuk berpindah atau mengulang mode simulasi.
- **Mulai Pertandingan Resmi** mengosongkan hasil mode resmi dan mengembalikan fase
  ke lobby sebelum pertandingan sebenarnya.

Perpindahan mode akan memulai ulang hasil mode tujuan. Skor, jawaban, clue,
dan resolution simulasi tidak masuk ke mode resmi.

![Mode resmi dengan leaderboard nol](uat-screenshots/13-official-lobby-isolated.png)

### 4.4 Mengendalikan Fase

| Fase | Tombol admin | Durasi resmi | Setelah timer habis |
|---|---|---:|---|
| Lobby | **Mulai Case File** | 2 menit | Level 1 otomatis |
| Case File | Tidak ada tombol | 2 menit | Level 1 otomatis |
| Level 1 | Tidak ada tombol | 5 menit | Clue 1 selama 30 detik |
| Clue 1 | Tidak ada tombol | 30 detik | Level 2 otomatis |
| Level 2 | Tidak ada tombol | 7 menit | Clue 2 selama 30 detik |
| Clue 2 | Tidak ada tombol | 30 detik | Level 3 otomatis |
| Level 3 | Tidak ada tombol | 8 menit | Clue 3 selama 30 detik |
| Clue 3 | Tidak ada tombol | 30 detik | Final Case Resolution otomatis |
| Final Case Resolution | Tidak ada tombol | 3 menit | Hasil akhir |

Urutan operasional:

1. Pastikan semua tim sudah login.
2. Klik **Mulai Case File**.
3. Pantau timer dan tabel status tim; seluruh level, clue, dan resolution berpindah otomatis.
4. Setelah permainan selesai, simpan bukti leaderboard dan kode verifikasi.

![Kontrol admin Level 1](uat-screenshots/03-admin-level1.png)

Admin tidak perlu memindahkan fase saat timer berjalan. Timer, penguncian draft,
finalisasi jawaban, pembukaan clue, dan transisi fase berjalan otomatis.

### 4.5 Leaderboard dan Reset

Admin menampilkan preview peringkat, koneksi, total skor, dan jumlah jawaban
benar Level 1--3. Layar tancap menggunakan URL terpisah:

```text
http://<IP_SERVER>:3000/?screen=leaderboard
```

Tabel diperbarui setelah satu level difinalisasi dan setelah resolution.

![Leaderboard setelah resolution](uat-screenshots/12-admin-resolution-leaderboard.png)

Gunakan **Reset** hanya dengan persetujuan koordinator. Reset menghapus hasil
mode aktif dan mengembalikan permainan ke lobby.

### 4.6 Tie-break, Play-off, dan Diskualifikasi

Setelah pertandingan selesai, sistem mengurutkan tim berdasarkan total poin,
jumlah jawaban benar, jumlah benar Level 3, lalu timestamp server saat resolution
dikirim. Tim yang
masih sama ditampilkan sebagai **TIED** dan belum dinyatakan lolos.

Panitia dapat mencatat urutan hasil play-off pada bagian **Keputusan Kompetisi**
di panel admin. Tim yang didiskualifikasi juga dicatat melalui panel tersebut;
statusnya menjadi **DISQUALIFIED**, tidak memiliki peringkat, dan tidak dapat
mengubah jawaban. Semua tindakan tersimpan di **Audit Trail**.

## 5. Checklist Sebelum Hari-H

- [ ] Laptop server terhubung ke hotspot yang akan digunakan.
- [ ] HP peserta dapat membuka URL server.
- [ ] QR code mengarah ke IP server yang benar.
- [ ] Semua 15 kode tim sudah dibagikan.
- [ ] Semua tim sudah muncul di lobby.
- [ ] Password admin sudah diganti.
- [ ] Secret verifikasi sudah dikonfigurasi.
- [ ] Soal dan clue resmi sudah menggantikan placeholder.
- [ ] Backup database kosong sudah dibuat.
- [ ] Mode aktif adalah **PERTANDINGAN RESMI**.
- [ ] Layar/proyektor leaderboard siap.

## 6. Checklist Saat Permainan

- [ ] Pantau fase dan timer pada panel admin.
- [ ] Pastikan skor berubah setelah level difinalisasi server.
- [ ] Jangan menekan Reset tanpa persetujuan koordinator.
- [ ] Jangan mematikan laptop atau hotspot.
- [ ] Catat peserta yang terputus.
- [ ] Pastikan setiap tim memilih satu kandidat pada resolution.

## 7. Gangguan Umum

| Gangguan | Tindakan |
|---|---|
| Halaman tidak terbuka | Pastikan tersambung ke hotspot yang benar, lalu reload. |
| Kode tim ditolak | Periksa kode dan minta panitia mengonfirmasi daftar tim. |
| Timer tidak bergerak | Tunggu beberapa detik, reload, lalu cek fase admin. |
| Pilihan terkunci | Timer level sudah habis atau level sudah difinalisasi server. |
| Soal belum muncul | Admin belum memulai level tersebut. |
| Clue belum tampil | Reload satu kali setelah timer level habis. |
| Koneksi terputus | Sambungkan kembali ke hotspot dan reload halaman. |
| Skor belum terlihat | Tunggu pembaruan real-time atau reload panel admin. |
| Admin gagal login | Periksa password; jangan membagikannya kepada peserta. |

## 8. Restart dan Recovery

1. Jangan hapus `server/data/code_cracker.db` saat pertandingan berjalan.
2. Hentikan server dengan aman.
3. Jalankan kembali `start.bat` atau `npm start`.
4. Pastikan fase dan timer dipulihkan.
5. Minta peserta reload bila koneksi belum tersambung kembali. Jika server sempat
   restart, peserta perlu login ulang dengan kode tim yang sama karena token sesi
   memory server dibuat ulang.

Timer menggunakan timestamp dan durasi yang tersimpan di database, sehingga
restart tidak mengembalikan timer ke awal. Reload biasa memulihkan sesi lokal,
fase aktif, dan draft level selama token server masih berlaku.

## 9. Penutupan Permainan

1. Simpan screenshot atau catatan leaderboard final.
2. Simpan kode verifikasi yang diperlukan.
3. Backup `server/data/code_cracker.db`.
4. Catat waktu selesai dan kejadian khusus.
5. Hentikan server setelah data dipastikan tersimpan.

## 10. Quick Reference

### Peserta

```text
Sambung Wi-Fi -> Buka URL -> Masukkan kode tim -> Bergabung
-> Jawab soal -> Baca clue -> Pilih kandidat -> Simpan hasil
```

### Admin

```text
Buka /?admin=1 -> Otorisasi -> Pilih mode -> Mulai Case File
-> Pantau timer -> Semua fase berpindah otomatis -> Simpan leaderboard -> Backup DB
```
