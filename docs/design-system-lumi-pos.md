# Design System Brief: Lumi-POS
**Status:** Draft | **Untuk:** Input Claude Design | **Last updated:** 13 Juli 2026

## Design Read
Dashboard operasional multi-role (Kasir/Dapur/Owner) untuk POS kafe, dipakai berulang sepanjang hari di HP/tablet/desktop. Bahasa visual: fungsional-taktil, digali dari materialitas dunia POS/dapur yang sebenarnya (tiket dapur, struk, kertas thermal) — bukan tema "kafe hangat" generik.

## Kenapa bukan default AI
Dua pola paling umum muncul di desain AI untuk produk F&B: (1) krem hangat `#F4F1EA` + aksen terracotta `#D97757`, dan (2) glassmorphism/gradient dekoratif. Lumi-POS sengaja menghindari keduanya — subjeknya adalah alat kerja cepat-baca untuk kasir & dapur, bukan halaman marketing kafe.

## Signature Element
**Estetika tiket dapur (Kitchen Order Ticket) & kertas thermal printer.** Nomor order tampil seperti tercetak thermal printer (monospace, tegas). Card order di KDS punya sentuhan "tiket robek" di bagian atas. Badge status meniru cap stempel (stamp), bukan pill gradient generik.

## Token System

### Warna (6 warna bernama)
| Nama | Hex | Peran |
|---|---|---|
| `paper` | `#E8EBE9` | Surface/background utama — abu-abu sejuk seperti kertas thermal asli (bukan krem hangat) |
| `ink` | `#1C1E1D` | Teks primer — hitam netral/sejuk seperti cetakan thermal printer |
| `ink-muted` | `#686D6A` | Teks sekunder/caption |
| `stamp-red` | `#B23A2E` | Danger/void/urgent — seperti cap "batal" |
| `stamp-green` | `#3F6B4F` | Success/siap — seperti cap "approved" |
| `stamp-amber` | `#D6800A` | Warning/stok menipis — lebih vivid/saturated, bukan brass/ochre teredam |

**Catatan validasi (13 Juli 2026):** Palet awal (`paper #EFEEE9`, `ink #211E1A`, `stamp-amber #B8792A`) diaudit pakai daftar warna terlarang dari skill `design-taste-frontend` (Section 4.2 — "Premium-Consumer Palette Ban") dan ternyata sangat dekat dengan family warm-cream/espresso/brass yang jadi tell paling umum di desain AI, meski kita sudah sengaja hindari kombo krem+terracotta spesifik. Direvisi ke arah abu-abu sejuk — yang kebetulan juga lebih akurat secara material (kertas thermal asli memang cenderung abu-abu, bukan krem).

Catatan: `stamp-*` dipakai untuk badge status & alert, BUKAN untuk elemen dekoratif luas — supaya tetap terasa seperti cap fungsional, bukan warna brand yang di-splash ke mana-mana.

### Tipografi
- **Display/angka (order number, harga, timer, waktu):** IBM Plex Mono — evokes digit thermal printer, dipakai tegas & besar di tempat yang butuh dibaca cepat sekilas (KDS, total belanja)
- **UI/label/body:** IBM Plex Sans — satu keluarga dengan Plex Mono (pasangan yang disengaja, bukan Inter+slate default), dipakai untuk tombol, label, navigasi
- Skala: label 12px, body 14px, angka penting 20-28px (lebih besar dari UI biasa — prioritas keterbacaan cepat dari jarak, terutama KDS)

### Layout
- Kasir & KDS: **single-screen, zero navigasi tambahan** (sudah ditetapkan di User Flow/IA) — layout jadi soal density & hierarchy, bukan storytelling
- Card order/tiket: sudut atas dengan efek "sobekan" halus (bisa pakai `clip-path` bergerigi tipis atau border dashed di top, jangan berlebihan)
- Spacing generous di elemen yang sering di-tap (tombol Bayar, kolom KDS) — target tap minimal 44px demi mobile/tablet
- Grid produk kasir: 2 kolom di mobile, auto-fit di layar lebih lebar
- **Shape consistency lock:** satu skala radius untuk seluruh produk — card 12px, tombol 8px (sengaja tidak full-pill, supaya konsisten dengan kesan "kertas kaku" bukan lembut/playful), input 6px. Motif "sobekan tiket" di card order adalah pengecualian yang didokumentasikan (bukan inkonsistensi tak sengaja), berlaku hanya di top-edge card order

### Motion
Minim & fungsional saja — bukan dekoratif:
- Order baru muncul di KDS: fade + slight slide dari atas (~200ms), seperti tiket baru "keluar dari printer" — bukan animasi loop
- Transisi status di KDS: transisi warna badge halus, tanpa bounce berlebihan
- Hormati `prefers-reduced-motion`

## Komponen Kunci (turunan dari wireframe sebelumnya)
- **Product card (Kasir):** `paper` bg, `ink` text, tap state jelas (border/scale halus)
- **Order ticket card (KDS):** border dashed tipis di top (motif sobekan), nomor order pakai Plex Mono besar, elapsed time di kanan atas — warna elapsed time berubah ke `stamp-amber` kalau order sudah lama (>10 menit, angka ini masih asumsi, boleh disesuaikan)
- **Status badge:** bentuk stempel — sudut sedikit tidak sempurna/rotasi ringan (1-2°), bukan pill sempurna, memperkuat motif "cap tinta"
- **Tombol Bayar (Kasir):** paling menonjol di layar — satu-satunya elemen solid-fill besar, sisanya outline/flat. Wajib dicek kontras teks-vs-background saat implementasi (minimal WCAG AA 4.5:1) — jangan sampai warna `on-primary` dan `fill-primary` terlalu dekat

## Catatan Validasi: `design-taste-frontend`

Skill ini secara eksplisit menyatakan bukan untuk "dashboards, data tables, multi-step product UI" — jadi divalidasi **selektif**, bukan dijalankan penuh:

**Dipakai (format-agnostic, tetap relevan untuk product UI):**
- Section 4.2 Color Calibration (daftar hex "terlarang") → menemukan palet awal terlalu dekat dengan family warm-cream/espresso/brass, sudah direvisi ke cool-gray (lihat catatan di tabel warna)
- Prinsip Shape Consistency Lock → ditambahkan aturan radius eksplisit
- Prinsip Button Contrast Check (a11y) → ditambahkan sebagai reminder implementasi

**Sengaja TIDAK dipakai (mekanisme landing-page/marketing-specific, tidak relevan):**
- Dial VARIANCE/MOTION/DENSITY dan preset "page kind" (landing/portfolio/editorial)
- Aturan anti-center-bias hero, sticky-stack scroll, horizontal-pan, marquee
- Rekomendasi font display "creative brief" (Kasir/KDS butuh keterbacaan cepat, bukan personality display type)

## Yang belum diputuskan (untuk didiskusikan langsung di Claude Design)
- Dark mode — apakah dibutuhkan untuk layar Kasir/KDS yang dipakai lama (potensi bagus untuk kurangi silau di dapur), atau cukup light mode saja untuk v1
- Ikon set spesifik (rekomendasi awal: Phosphor atau Tabler, konsisten satu keluarga)
- Elapsed time threshold di KDS (saat ini asumsi >10 menit = warning, perlu divalidasi Owner)
