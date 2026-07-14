# User Flow & Information Architecture: Lumi-POS
**Status:** Draft | **Owner:** Dimas | **Last updated:** 13 Juli 2026 | **Version:** 0.1
**Turunan dari:** `prd-lumi-pos.md` (Section 5, 6) dan `erd-lumi-pos.md` (Section 4 — matriks akses)

## 1. Site Map per Role

```
Login (satu pintu masuk untuk semua role, redirect otomatis sesuai role)
│
├── OWNER
│   ├── Dashboard (ringkasan cepat: omzet hari ini, order aktif, stok menipis)
│   ├── Kelola Produk & Resep
│   │   ├── Daftar Produk (list + badge "stok tidak terlacak" utk produk tanpa resep)
│   │   └── Form Produk (create/edit) → sub-bagian: definisi resep (bahan baku + qty)
│   ├── Kelola Stok Bahan Baku
│   │   ├── Daftar Ingredient (+ current_stock)
│   │   └── Form Restock manual
│   ├── Laporan Penjualan (filter tanggal, produk terlaris)
│   ├── Riwayat Stok (StockMovement log)
│   └── Kelola Akun (buat/nonaktifkan akun kasir & dapur)
│
├── KASIR
│   └── Layar Kasir (satu layar utama, mobile-first)
│       ├── Grid produk (tap untuk tambah ke order)
│       ├── Panel order berjalan (cart) — qty, void, total
│       └── Modal Konfirmasi Bayar → hasil: struk PDF
│
└── DAPUR
    └── KDS Board (satu layar, landscape-friendly untuk tablet)
        └── 3 kolom: Diterima / Sedang Dimasak / Siap Diambil
```

**Catatan struktur:** Kasir & Dapur sengaja dibuat **single-screen** (bukan multi-halaman dengan navigasi) — konsisten dengan sifat kerja mereka yang harus cepat & minim klik saat sibuk. Owner dapat navigasi multi-halaman karena aksesnya lebih eksploratif (cek laporan, atur produk sewaktu-waktu, bukan dikejar waktu real-time).

## 2. Navigasi per Role

| Role | Pola navigasi | Alasan |
|---|---|---|
| Kasir | Tidak ada sidebar/menu — satu layar penuh + modal pembayaran | Kasir kerja cepat berulang (order → bayar → order lagi), navigasi tambahan cuma bikin lambat |
| Dapur | Tidak ada navigasi sama sekali — KDS Board adalah satu-satunya layar | Dapur nggak butuh akses lain, layar ini biasanya menyala terus di tablet dekat kompor |
| Owner | Sidebar navigasi standar (Dashboard, Produk, Stok, Laporan, Akun) | Owner butuh berpindah antar fungsi manajemen kapan saja |

## 3. Rincian Layar Kunci

### 3.1 Layar Kasir (mobile-first, prioritas tertinggi)
**Tujuan:** input order secepat mungkin, minim salah tap.
**Elemen wajib:**
- Grid/list produk aktif, dikelompokkan per kategori, harga terlihat langsung
- Panel order berjalan — bisa collapse jadi bar ringkas di mobile (slide-up saat ada item), permanent sidebar di layar lebar
- Setiap baris item di panel order: qty stepper (+/-), subtotal
- Tombol "Void" hanya muncul selama status masih draft (FR-3)
- Tombol utama "Bayar" — memicu modal konfirmasi (input jumlah bayar → kembalian otomatis → konfirmasi)
- Setelah confirmed: opsi unduh struk PDF (FR-13), lalu kembali ke layar kosong siap order baru

### 3.2 KDS Board (tablet, landscape)
**Tujuan:** dapur tahu apa yang harus dimasak tanpa bolak-balik kertas, update status dalam 1 tap.
**Elemen wajib:**
- 3 kolom sesuai status: Diterima / Sedang Dimasak / Siap Diambil
- Tiap order = card berisi: nomor order, daftar item + qty, waktu sejak masuk (elapsed time — penting untuk prioritas)
- Tap/swipe card untuk pindah ke kolom berikutnya (bukan drag-drop rumit — device tablet dapur sering dipegang tangan basah/kotor, interaksi harus toleran)
- Card baru muncul otomatis (real-time, FR-7) dengan indikator visual halus (bukan animasi berlebihan yang mengganggu fokus masak)

### 3.3 Dashboard Owner
**Tujuan:** owner tahu kondisi bisnis dalam sekali lihat, sebelum masuk ke detail.
**Elemen wajib:**
- Metric cards: omzet hari ini, jumlah transaksi hari ini, order aktif (belum completed)
- Daftar ringkas ingredient dengan stok menipis (`current_stock <= min_stock_threshold`, ambang default 20% dari stok awal — lihat ERD Section 2 `ingredients`)
- Akses cepat ke Laporan Penjualan lengkap

## 4. Pertimbangan Lintas Device

Konsisten dengan requirement "diakses dari berbagai device" di awal project:

| Role | Device utama | Implikasi desain |
|---|---|---|
| Kasir | HP (utama), bisa juga tablet/desktop | Layar kasir harus 100% usable satu tangan di layar ≤375px lebar — ini prioritas tertinggi karena paling sering dipakai di kondisi tergesa |
| Dapur | Tablet, orientasi landscape | Target tap besar (jari, bukan mouse), kontras tinggi supaya terbaca dari jarak agak jauh di dapur |
| Owner | Desktop/laptop (utama), kadang HP untuk cek cepat | Layar admin boleh lebih padat informasi karena diakses saat owner punya waktu duduk, bukan di tengah keramaian |

## 5. Wireframe Low-Fidelity

Wireframe visual untuk Layar Kasir dan KDS Board (dua layar paling kritis) ditunjukkan terpisah di percakapan — ini murni untuk validasi struktur/hierarchy, styling detail (warna, tipografi) baru ditentukan di tahap Design System.
