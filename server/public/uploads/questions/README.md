# Folder Soal Bergambar

Letakkan gambar soal di folder mode yang sesuai:

```text
simulation/q_<question_id>.<ekstensi>
official/q_<question_id>.<ekstensi>
```

Contoh:

```text
simulation/q_1.png
official/q_17.jpg
```

Ekstensi yang didukung: `png`, `jpg`, `jpeg`, `webp`, `gif`, dan `avif`.

Batas validasi: maksimum 5 MB per file dan maksimum 4096px untuk lebar atau
tinggi gambar yang dapat dibaca sistem.

Sistem membaca file saat peserta membuka soal. Tidak perlu mengubah database
atau me-restart server setelah file ditambahkan. Jika file belum tersedia atau
format namanya salah, soal tetap tampil sebagai soal teks.
