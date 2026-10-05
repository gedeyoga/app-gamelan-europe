-- Normalisasi email legacy ke lowercase agar lookup case-insensitive & unique konsisten.
-- Asumsi: tidak ada dua baris yang hanya berbeda casing. Bila ada, statement ini gagal
-- keras (benar) — selesaikan manual lalu jalankan ulang.
UPDATE "users" SET "email" = lower("email") WHERE "email" <> lower("email");
