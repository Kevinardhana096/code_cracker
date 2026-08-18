# Rencana Implementasi dan Mitigasi Tahap III Code Cracker

## 1. Status Dokumen

Dokumen ini menjadi rencana kerja untuk menyesuaikan aplikasi Code Cracker
dengan aturan Tahap III yang ditetapkan panitia.

- Status: Baseline implementasi; validasi dokumen 28 Juli 2026
- Sumber aturan utama: ketentuan Tahap III dari panitia
- Mode permainan: simulasi dan resmi
- Infrastruktur: server lokal tanpa koneksi internet
- Peserta: 15 tim, masing-masing menggunakan 1 akun dan 1 perangkat

### Progres implementasi saat ini

- [x] Game engine: Case File, timer resmi, clue 30 detik, dan transisi otomatis.
- [x] Draft MC per level, perubahan pilihan, finalisasi server, dan scoring resmi.
- [x] Gambar/MathLaTeX lokal serta opsi gambar pada pilihan ganda.
- [x] Panel admin dengan timer dan layar leaderboard read-only terpisah.
- [x] Pemulihan session/draft/fase setelah reload atau reconnect.
- [x] Automated backend UAT: 96/96 skenario lulus; UAT kompetisi dan asset gambar juga lulus.
- [x] Tie-break/play-off/diskualifikasi dan audit trail.
- [ ] Dataset resmi final, UAT visual khusus layar leaderboard, dan dry run 15 perangkat.

Aturan Tahap III dari panitia menjadi sumber kebenaran utama. Dokumen PRD,
seed data, dan UAT lama harus diselaraskan apabila berbeda dengan dokumen ini.

## 2. Tujuan

Sistem akhir harus mampu:

1. Menjalankan permainan secara serentak untuk 15 tim.
2. Mengunci timer, jawaban, dan skor di server.
3. Menghitung skor benar, salah, dan kosong sesuai aturan resmi.
4. Membagikan clue otomatis dan menyimpannya di Investigation Board.
5. Menampilkan panel admin terpisah dari leaderboard layar tancap.
6. Memulihkan tampilan peserta ketika perangkat reload atau reconnect.
7. Menyediakan bukti hasil, audit, tie-break, dan diskualifikasi.
8. Berjalan penuh melalui jaringan lokal tanpa internet.

## 3. Keputusan Desain yang Disepakati

### 3.1 Alur fase permainan

Alur resmi yang ditargetkan:

```text
LOBBY
  -> CASE FILE (2 menit)
  -> LEVEL 1 (5 menit)
  -> CLUE 1 (30 detik)
  -> LEVEL 2 (7 menit)
  -> CLUE 2 (30 detik)
  -> LEVEL 3 (8 menit)
  -> CLUE 3 (30 detik)
  -> FINAL CASE RESOLUTION (3 menit)
  -> FINISHED
```

Timer Case File dan timer clue bersifat global untuk semua tim. Setelah timer
berakhir, server otomatis berpindah ke fase berikutnya. Admin tetap dapat
memantau seluruh fase dari panel kontrol.

Durasi clue ditetapkan 30 detik sebagai default resmi dan dibuat configurable
sebelum pertandingan.

### 3.2 Case File

Case File dibagikan secara fisik oleh panitia. Sistem menyediakan fase timer
2 menit agar waktu membaca seragam untuk semua tim. Case File tidak boleh
memuat kunci jawaban yang dikirim ke client.

Sebelum fase Case File dimulai, sistem memeriksa bahwa seluruh 15 tim telah
berhasil masuk atau ditandai siap oleh admin. Setelah permainan dimulai,
koneksi tim yang terputus tidak menghentikan timer global.

### 3.3 Scoring resmi

| Fase | Benar | Salah | Tidak menjawab |
|---|---:|---:|---:|
| Level 1 | +10 | -2 | -1 |
| Level 2 | +20 | -4 | -2 |
| Level 3 | +30 | -6 | -3 |
| Final Case Resolution benar | +30 | 0 | 0 |

Skor maksimum:

```text
Level 1: 5 x 10  = 50
Level 2: 5 x 20  = 100
Level 3: 5 x 30  = 150
Bonus resolution = 30
Total maksimum   = 330 poin
```

Jawaban kosong harus tetap direkam atau difinalisasi server saat fase
berakhir, sehingga penalti tidak dapat dihindari dengan tidak menekan tombol
submit.

### 3.4 Clue

Jumlah jawaban benar pada level yang selesai dipetakan sebagai berikut:

| Jawaban benar | Clue |
|---:|---|
| 5 | Lengkap |
| 4 | Parsial |
| 3 | Dasar |
| 0–2 | Tidak mendapat clue sesuai ketentuan panitia |

Clue disimpan permanen pada Investigation Board tim. Clue tidak boleh
tercampur antar mode simulasi dan resmi.

### 3.5 Tie-break dan play-off

Peringkat ditentukan dengan urutan:

1. Total poin tertinggi.
2. Jumlah jawaban benar terbanyak.
3. Jumlah jawaban benar Level 3 terbanyak.
4. Waktu penyelesaian tercepat berdasarkan timestamp server.
5. Play-off manual jika seluruh kriteria masih sama.

Definisi waktu penyelesaian yang digunakan sistem adalah waktu server saat tim
berhasil mengirim jawaban Final Case Resolution. Tim yang tidak mengirim
jawaban akhir dicatat sebagai selesai pada batas waktu fase tersebut.

Jika masih seri, sistem menandai tim sebagai `TIED` dan menyediakan kontrol
admin untuk mencatat hasil play-off, pemenang, waktu, serta alasan keputusan.

## 4. Pemisahan Tampilan dan Akses

### 4.1 Tampilan peserta

Peserta menggunakan halaman permainan biasa untuk:

- login dengan kode tim;
- melihat soal dan timer;
- memilih opsi untuk lima soal dalam level;
- kembali ke soal lain dan mengganti pilihan selama level masih aktif;
- membaca clue;
- mengirim satu jawaban Final Case Resolution;
- melihat hasil tim sendiri.

Pada layar peserta, skor yang ditampilkan adalah skor terkonfirmasi dari level
yang sudah selesai dan bonus resolution yang sudah tercatat. Pilihan pada level
aktif tidak mengubah skor sampai timer level berakhir dan server memfinalisasi
kelima jawaban. Setelah finalisasi, peserta melihat breakdown level, penalti
jawaban salah/kosong, skor total terbaru, dan clue yang diperoleh.

Selama level aktif, sistem tidak menampilkan feedback benar/salah per soal agar
peserta tetap dapat mengganti pilihan tanpa dipengaruhi feedback sementara.

Peserta tidak menerima kunci jawaban, data tim lain, kontrol fase, atau
fungsi diskualifikasi.

### 4.2 Panel admin

Panel admin menggunakan akses khusus, misalnya `/?admin=1`, dengan autentikasi
admin. Panel ini berisi:

- mode simulasi/resmi;
- fase aktif dan timer server;
- status kesiapan 15 tim;
- status koneksi tiap tim;
- tombol mulai/reset sesuai fase;
- kontrol diskualifikasi dan alasan;
- kontrol pencatatan play-off;
- preview leaderboard;
- katalog soal dan status asset;
- status database dan backup operasional.

Timer admin menampilkan fase, sisa waktu, durasi total, progress bar, dan
indikator waktu kritis. Timer mengambil waktu otoritatif dari server.

### 4.3 Leaderboard layar tancap

Leaderboard menggunakan akses khusus, misalnya `/?screen=leaderboard`, dan
tidak memerlukan login tim atau token admin.

Tampilan ini dibuat fullscreen dan read-only, dengan:

- seluruh 15 tim;
- peringkat dan total skor;
- penanda 5 besar;
- status `TIED` jika diperlukan;
- fase permainan dan timer;
- update real-time melalui jaringan lokal;
- pemulihan otomatis setelah layar reconnect.

Leaderboard tidak menampilkan jawaban peserta, kunci jawaban, clue rahasia,
password, token, atau kontrol admin.

## 5. Pemulihan Perangkat dan Koneksi

### 5.1 Reload atau tampilan kembali ke lobby

Risiko utama adalah browser peserta reload sehingga tampilan kembali ke login
atau lobby. Mitigasinya:

1. Sesi tim disimpan secara lokal pada browser perangkat.
2. Saat halaman dibuka kembali, client mencoba memulihkan sesi.
3. Client meminta fase aktif dan sisa waktu dari server.
4. Client diarahkan ke fase sebenarnya, bukan otomatis dianggap lobby.
5. Pilihan draft level dan status finalisasi level dipulihkan.
6. Clue yang sudah dibuka dimuat kembali dari Investigation Board.
7. Jika token kedaluwarsa, peserta login ulang dengan kode tim yang sama.
8. Login ulang tidak menghapus jawaban, skor, clue, atau hasil resolution.

### 5.2 Koneksi terputus

- Timer tetap berjalan di server.
- Socket.IO mencoba reconnect secara otomatis.
- Admin melihat status terputus dan tersambung kembali.
- Peserta tidak mendapat penalti tambahan karena kehilangan koneksi.
- Perubahan pilihan setelah deadline tetap ditolak oleh server.
- Sistem tidak melakukan reset level akibat satu perangkat terputus.

### 5.3 Server restart

`game_state` menyimpan fase, waktu mulai, dan durasi fase. Submissions, clue,
resolution, dan skor disimpan ke database lokal. Setelah server restart:

- fase aktif dilanjutkan dari timestamp server;
- timer tidak dimulai ulang dari nol;
- peserta dapat login ulang bila sesi memory sebelumnya hilang;
- hasil pertandingan tetap dapat dipulihkan.

### 5.4 Penyimpanan jawaban per level

Jawaban soal matematika tidak difinalisasi satu per satu. Peserta dapat
memilih, kembali, dan mengganti opsi A–D kapan saja selama timer level masih
berjalan.

Alurnya:

1. Client memuat lima soal untuk level aktif.
2. Peserta memilih opsi pada masing-masing soal.
3. Pilihan disimpan sebagai satu `level draft`, bukan sebagai submission final
   per soal.
4. Peserta dapat mengubah seluruh pilihan selama level belum berakhir.
5. Saat timer habis, server mengambil draft terakhir dan memfinalisasi kelima
   pilihan secara atomik.
6. Opsi yang tidak dipilih difinalisasi sebagai `unanswered` dan mendapat
   penalti kosong sesuai level.
7. Server baru menghitung skor dan jumlah benar setelah finalisasi level.
8. Setelah finalisasi, pilihan level dikunci dan tidak dapat diubah.

Level draft boleh disimpan di client untuk pemulihan cepat dan disinkronkan
sebagai satu object draft ke server. Draft tidak memiliki nilai skor. Sumber
skor tetap hasil finalisasi server saat level berakhir.

Struktur penyimpanan target adalah satu record per tim, mode, dan level,
misalnya `level_drafts` atau `level_results`, dengan peta lima `question_id`
ke pilihan A–D, status finalisasi, skor, jumlah benar, dan timestamp server.
Tidak ada tombol atau endpoint `submit` final per soal.

Setelah reload atau reconnect, client meminta draft level aktif dari server.
Peserta dapat melanjutkan dan mengganti pilihan selama deadline belum tercapai.
Setelah level difinalisasi, client hanya menampilkan hasil final dan tidak
membuka kembali pilihan.

Finalisasi level, resolution, dan hasil skor disimpan terpisah berdasarkan mode
`simulation` atau `official`. Backup database dilakukan sebelum pertandingan,
berkala selama operasi, dan setelah pertandingan selesai.

## 6. Arsitektur Offline

Sistem tidak membutuhkan internet saat pertandingan.

```text
HP peserta ─┐
HP peserta ─┼── Wi-Fi hotspot/router lokal ── Laptop server
HP peserta ─┘                                  ├── Admin
                                               └── Layar leaderboard
```

Persiapan minimum:

- laptop server dengan Node.js dan dependency yang sudah terpasang;
- database lokal;
- satu atau dua hotspot sesuai hasil uji kapasitas;
- QR code lokal yang mengarah ke alamat IP server;
- laptop atau perangkat layar untuk leaderboard;
- backup laptop dan backup database.

Font atau asset eksternal tidak boleh menjadi dependency wajib. Asset penting
harus tersedia lokal agar tampilan tetap berfungsi tanpa internet.

## 7. Fitur Anti-Kecurangan dan Integritas

### 7.1 Perlindungan teknis

- Kunci jawaban hanya berada di server.
- Skor dihitung dan divalidasi di server.
- Pilihan dapat diubah selama level aktif.
- Satu level hanya dapat difinalisasi satu kali per tim.
- Satu resolution hanya dapat dikirim satu kali per tim.
- Perubahan pilihan setelah timer ditolak.
- Token tim tidak dapat dipakai untuk tim lain.
- Satu akun hanya memiliki satu sesi perangkat aktif.
- Semua perubahan skor dan resolution memiliki timestamp.

### 7.2 Pengawasan fisik

Aplikasi tidak dapat memastikan secara teknis apakah peserta berkomunikasi,
menerima bantuan luar, atau menggunakan sumber informasi. Hal tersebut harus
diawasi panitia dan dicatat melalui prosedur diskualifikasi.

Peran yang tercatat dalam pelaksanaan:

- Pemeriksa soal: Atika, Rara, dan Irun.
- MC: Alya.
- Admin/operator: ditetapkan panitia sebelum hari-H.
- Pengawas lapangan: ditetapkan panitia untuk memantau kecurangan fisik.

### 7.3 Diskualifikasi

Admin dapat mencatat:

- tim yang didiskualifikasi;
- kategori pelanggaran;
- waktu kejadian;
- nama petugas/pengawas;
- catatan dan bukti pendukung.

Tim yang didiskualifikasi dikeluarkan dari peringkat kelolosan dan diberi
status yang terlihat pada panel admin serta audit hasil akhir.

## 8. Dataset dan Konten Resmi

Sebelum pertandingan resmi, panitia harus mengganti seluruh placeholder dengan:

### 8.1 Format multimedia soal

Soal dapat menggunakan kombinasi teks, gambar, dan notasi matematika
MathLaTeX.

- Gambar utama soal disimpan secara lokal per mode permainan.
- Opsi pilihan ganda dapat berisi teks biasa, MathLaTeX, gambar, atau gabungan
  teks dan MathLaTeX.
- Format opsi disimpan terstruktur sebagai opsi A–D, bukan sebagai jawaban
  teks bebas.
- Kunci jawaban hanya disimpan dan dibandingkan di server.
- Renderer MathLaTeX harus dibundel secara lokal, tanpa CDN, agar tetap
  berfungsi tanpa internet. KaTeX dapat digunakan karena ringan untuk tampilan
  soal statis.
- Sintaks yang disepakati dapat menggunakan inline `\( ... \)` dan display
  `$$ ... $$`.
- Gambar diberi alt text dan divalidasi ukuran, dimensi, serta ekstensi.
- Admin mendapat preview soal, gambar, formula, dan seluruh opsi sebelum mode
  resmi dijalankan.

Contoh struktur konten:

```text
Pertanyaan: Hitung nilai \(x^2 + 2x\) untuk \(x = 3\).

A. \(12\)
B. \(15\)
C. \(18\)
D. [gambar opsi]
```

Gambar soal sudah didukung pada implementasi saat ini melalui folder asset
lokal. Dukungan MathLaTeX dan gambar pada opsi pilihan ganda menjadi bagian
dari pekerjaan implementasi berikutnya.

- 15 soal matematika resmi, 5 soal per level;
- opsi pilihan ganda untuk setiap soal;
- kunci jawaban server;
- bobot soal sesuai level;
- clue Level 1, 2, dan 3;
- Case File resmi;
- empat kandidat Final Case Resolution;
- jawaban kandidat yang benar;
- asset gambar soal jika ada.

Dataset simulasi dan resmi harus memiliki mode terpisah. UAT resmi tidak boleh
menggunakan soal placeholder yang sama dengan simulasi.

## 9. Tahapan Implementasi

### Tahap 0 — Pembekuan spesifikasi

- Selaraskan PRD, seed, manual, dan UAT dengan aturan panitia.
- Tetapkan dataset resmi dan penanggung jawab persetujuan konten.
- Tetapkan admin/operator dan pengawas lapangan.

### Tahap 1 — Game engine dan database

- Tambahkan fase Case File.
- Tambahkan timer clue 30 detik.
- Implementasikan transisi otomatis.
- Simpan deadline server secara persisten.
- Finalisasi jawaban kosong saat fase berakhir.
- Simpan satu level draft per tim/mode/level dan pulihkan draft saat
  reload/reconnect.
- Finalisasi lima pilihan level secara atomik ketika timer berakhir.
- Sediakan penyimpanan draft lokal tanpa menjadikannya sumber skor.
- Terapkan scoring resmi di server.

### Tahap 2 — Soal pilihan ganda

- Tambahkan opsi jawaban pada schema dan seed.
- Kirim opsi ke client tanpa mengirim kunci.
- Ganti input teks dengan pilihan A–D.
- Render MathLaTeX secara lokal pada pertanyaan dan opsi.
- Dukung gambar pada pertanyaan dan opsi pilihan ganda.
- Tambahkan preview dan validasi format multimedia di panel admin.
- Validasi bahwa jawaban hanya berasal dari opsi yang tersedia.

### Tahap 3 — Tampilan terpisah (selesai)

- [x] Pisahkan participant view, admin view, dan leaderboard screen.
- [x] Tambahkan timer fase otoritatif pada admin.
- [x] Tambahkan tampilan leaderboard fullscreen/read-only.
- [x] Pastikan leaderboard dapat dibuka tanpa login dan tanpa kontrol admin.

### Tahap 4 — Recovery dan monitoring (implementasi selesai; uji lapangan terbuka)

- [x] Persistensi sesi client.
- [x] Reconnect dan resume fase.
- [x] Status koneksi tim di admin.
- [ ] Uji reload, reconnect, dan server restart pada 15 perangkat di venue.

### Tahap 5 — Tie-break, play-off, dan diskualifikasi (selesai)

- [x] Simpan waktu penyelesaian server.
- [x] Terapkan sorting tie-break resmi.
- [x] Tambahkan status `TIED` dan form hasil play-off.
- [x] Tambahkan status diskualifikasi dan audit trail.

### Tahap 6 — Konten resmi

- Import bank soal resmi.
- Import clue dan Case File resmi.
- Validasi jumlah soal, opsi, kunci, dan asset.
- Kunci mode resmi untuk hari-H.

### Tahap 7 — Verifikasi dan rilis (sebagian selesai)

- [x] Jalankan automated backend UAT.
- [ ] Lengkapi UAT browser pada participant, admin, dan leaderboard screen dengan build terbaru.
- [ ] Jalankan dry run dengan 15 perangkat.
- [ ] Uji jaringan lokal tanpa internet.
- [ ] Uji backup dan pemulihan server.
- [ ] Terbitkan keputusan GO/NO-GO.

## 10. Rencana Pengujian dan Kriteria Penerimaan

### 10.1 Scoring

- 5 benar Level 1 menghasilkan 50 poin.
- 5 benar Level 2 menghasilkan 100 poin.
- 5 benar Level 3 menghasilkan 150 poin.
- Resolution benar menambahkan 30 poin.
- Semua benar menghasilkan 330 poin.
- Semua kosong menghasilkan penalti -30 untuk matematika.
- Semua salah menghasilkan penalti -60 untuk matematika.
- Jawaban salah dan kosong tidak dihitung sebagai jawaban benar untuk clue.
- Skor peserta tidak berubah ketika hanya memilih atau mengganti opsi draft.
- Skor level dan breakdown tampil setelah finalisasi server.

### 10.2 Timer dan fase

- Case File berjalan 2 menit.
- Level 1, 2, 3 berjalan 5, 7, dan 8 menit.
- Clue 1, 2, dan 3 berjalan 30 detik.
- Resolution berjalan 3 menit.
- Perubahan draft setelah deadline selalu ditolak.
- Pilihan dapat diubah selama level aktif dan hanya difinalisasi satu kali.
- Timer tidak kembali ke awal setelah reload atau server restart.

### 10.3 Akses dan perangkat

- 15 tim dapat login.
- Token lintas tim ditolak.
- Login kedua mengakhiri sesi perangkat lama.
- Pilihan jawaban dapat diganti sebelum level difinalisasi.
- Draft satu level dapat dipulihkan setelah reload.
- Reload mengembalikan tim ke fase aktif.
- Reconnect tidak menghapus progres.
- Admin dapat melihat status koneksi.
- Leaderboard dapat dibuka di perangkat terpisah tanpa login.

### 10.4 Clue, leaderboard, dan hasil

- Clue lengkap/parsial/dasar sesuai jumlah benar.
- Clue tersimpan di Investigation Board.
- Leaderboard update setelah finalisasi level, resolution, dan transisi fase.
- Lima besar ditandai.
- Tie-break otomatis sesuai urutan.
- Tim seri ditandai `TIED`.
- Hasil play-off dan diskualifikasi tercatat.

### 10.5 Uji lapangan

- Minimal 15 perangkat peserta.
- Dua grup hotspot jika diperlukan.
- Uji koneksi di seluruh area venue.
- Uji laptop server tanpa internet.
- Uji layar admin dan layar leaderboard secara bersamaan.
- Uji perangkat reload di setiap fase.
- Uji satu perangkat terputus mendekati batas waktu.
- Uji restart server dalam simulasi.

## 11. Risk Register dan Mitigasi

| Risiko | Dampak | Mitigasi | Respons saat terjadi |
|---|---|---|---|
| HP peserta reload dan kembali ke lobby | Peserta mengira progres hilang | Persistensi sesi dan resume fase dari server | Minta reload/login ulang; jangan reset game |
| Koneksi peserta terputus | Peserta tidak menerima update | Reconnect Socket.IO dan timer server | Admin mencatat status; peserta reconnect |
| Submit dekat deadline terlambat | Sengketa waktu | Deadline hanya ditentukan server | Periksa timestamp request dan log server |
| Server crash | Permainan berhenti | DB periodik, backup laptop, timer persisten | Hentikan akses, aktifkan laptop backup, minta reload |
| Hotspot terlalu penuh | Banyak peserta gagal akses | Distribusi maksimal 8–9 tim per hotspot | Pindahkan grup ke hotspot cadangan |
| Jangkauan Wi-Fi lemah | Perangkat sering putus | Uji venue dan posisi hotspot sebelum acara | Pindahkan hotspot/perangkat cadangan |
| Leaderboard gagal tampil | Penonton tidak melihat hasil | Endpoint read-only, initial fetch, reconnect | Refresh layar leaderboard; admin tetap memiliki preview |
| Admin salah menekan kontrol | Fase atau data berubah tidak sengaja | Validasi transisi, konfirmasi reset, role admin | Catat kejadian dan gunakan backup bila perlu |
| Skor salah/kosong keliru | Hasil tidak adil | Unit test scoring dan audit breakdown | Bekukan hasil, ekspor data, koreksi melalui prosedur resmi |
| Kunci jawaban bocor | Kompetisi tidak valid | Kunci hanya server, client tidak menerima answer key | Ganti dataset dan catat insiden |
| Komunikasi atau bantuan luar | Pelanggaran aturan | Pengawas lapangan dan bukti kejadian | Admin mencatat diskualifikasi dengan alasan |
| Dua tim memakai satu sesi | Identitas tim tidak jelas | Satu token dan satu koneksi aktif per akun | Keluarkan sesi lama dan verifikasi tim |
| Tie-break masih sama | Peringkat tidak dapat ditentukan | Timestamp penyelesaian dan play-off admin | Jalankan play-off dan simpan keputusan |
| Dataset resmi masih placeholder | Soal tidak layak hari-H | Checklist konten dan review pemeriksa soal | Status NO-GO sampai konten disetujui |
| Password/secret default | Akses admin atau verifikasi berisiko | Ganti sebelum hari-H dan simpan secara aman | Cabut akses, ganti credential, audit hasil |
| HTTP lokal disadap | Jawaban dapat diamati secara teknis | Jaringan lokal terisolasi dan pengawasan | Catat sebagai insiden keamanan; evaluasi hasil |

## 12. Prosedur Hari-H

### Sebelum peserta masuk

- Pastikan mode resmi aktif.
- Pastikan dataset resmi sudah dimuat.
- Pastikan password admin dan secret verifikasi sudah diganti.
- Backup database kosong dan salinan server ke laptop cadangan.
- Hubungkan laptop ke jaringan lokal.
- Uji akses dari admin dan leaderboard.
- Uji timer singkat dalam mode simulasi sebelumnya.
- Pastikan asset soal tersedia lokal.

### Saat peserta masuk

- Bagikan Case File fisik.
- Bagikan kode tim secara tertutup.
- Pastikan 15 tim login pada perangkat masing-masing.
- Admin memeriksa nama tim dan status koneksi.
- Jangan mulai sebelum seluruh tim siap atau keputusan pengecualian dicatat.

### Saat permainan berlangsung

- Admin memantau fase, timer, koneksi, dan leaderboard.
- Pemeriksa soal menangani klarifikasi konten tanpa memberikan jawaban.
- Pengawas mencatat dugaan pelanggaran.
- Jangan melakukan reset kecuali disetujui koordinator.
- Jika perangkat terputus, minta peserta reconnect tanpa menghentikan timer.

### Saat permainan selesai

- Simpan screenshot leaderboard final.
- Ekspor hasil dan kode verifikasi.
- Catat tim lolos dan tim diskualifikasi.
- Backup database hasil akhir.
- Simpan log insiden dan keputusan play-off.

## 13. Kriteria GO/NO-GO

### GO

- Semua blocker scoring, pilihan ganda, timer, recovery, dan leaderboard lulus.
- Dataset resmi telah disetujui pemeriksa soal.
- UAT otomatis dan dry run 15 perangkat lulus.
- Backup dan prosedur laptop cadangan telah diuji.
- Admin dan pengawas memahami prosedur insiden.

### NO-GO

- Penalti salah/kosong belum akurat.
- Timer tidak seragam atau dapat dimanipulasi client.
- Peserta tidak dapat kembali ke fase aktif setelah reconnect.
- Leaderboard layar tancap tidak dapat update.
- Dataset resmi masih placeholder.
- Tidak tersedia backup server atau database.
- Tie-break atau diskualifikasi tidak dapat dipertanggungjawabkan.

## 14. Input yang Masih Dibutuhkan dari Panitia

- Bank soal resmi dan opsi A–D.
- Kunci jawaban resmi.
- Clue final untuk setiap level.
- Case File final.
- Empat kandidat resolution dan jawaban benar.
- Nama operator admin dan pengawas lapangan.
- Konfirmasi definisi waktu penyelesaian untuk tie-break.
- Konfirmasi apakah fase Case File dimulai setelah 15 tim siap.
- Tata letak dan resolusi layar leaderboard.
- Jumlah serta kapasitas hotspot yang tersedia.

Dokumen ini menjadi acuan implementasi, UAT, mitigasi, dan briefing panitia
sampai seluruh kriteria GO terpenuhi.
