# PRD: Lumi-POS
**Status:** Draft | **Owner:** Dimas | **Last updated:** 13 Juli 2026 | **Version:** 0.1

## 1. Summary
Lumi-POS adalah aplikasi POS berbasis web untuk kafe/resto dengan model take-away (tanpa dine-in/manajemen meja), dilengkapi Kitchen Display System (KDS) real-time dan manajemen stok bahan baku berbasis resep. Dibangun sebagai project belajar & portfolio, sepenuhnya lewat Claude Code, dengan stack Next.js + Supabase + Vercel.

## 2. Problem
Ini bukan produk untuk masalah operasional nyata (bukan usaha yang sedang berjalan), melainkan simulasi kebutuhan POS kafe/resto pada umumnya: kasir perlu mencatat pesanan & pembayaran dengan cepat, dapur perlu tahu pesanan masuk tanpa bolak-balik kertas, dan owner perlu tahu stok bahan baku & performa penjualan tanpa hitung manual. Status quo yang disimulasikan: pencatatan manual (nota kertas, komunikasi lisan kasir-dapur, stok dihitung manual) — yang notabene rawan salah hitung dan lambat.

## 3. Goals & Success Metrics
| Goal | Metric | Baseline | Target |
|---|---|---|---|
| Semua fitur v1 berfungsi solid | Bug kritikal saat simulasi pemakaian harian | N/A (belum ada) | 0 bug kritikal (bug yang bikin transaksi/stok salah atau KDS gagal sync) |
| Layak jadi portfolio | Aplikasi bisa didemokan end-to-end (order → dapur → laporan) tanpa workaround manual | N/A | Demo penuh berjalan tanpa intervensi manual di database |
| Akurasi stok | Stok bahan baku tidak pernah minus akibat race condition | N/A | 0 kejadian stok negatif dalam testing concurrent order |

*Catatan: metrik "portfolio solid" bersifat direksional/kualitatif (dari user: "cukup solid untuk ditunjukkan ke recruiter/klien") — tidak ada angka objektif untuk ini, dicatat apa adanya, bukan dipaksakan jadi angka palsu.*

## 4. Non-Goals
Berikut yang **sengaja tidak ada** di v1 (bukan lupa, tapi keputusan sadar untuk menjaga scope):
- **Payment gateway (Midtrans/dll)** — v1 pakai cash manual saja. Alasan: kompleksitas webhook, verifikasi signature, dan state sinkronisasi pembayaran-ke-KDS terlalu berisiko digabung dengan build KDS+stok yang sudah kompleks. Disusulkan ke v2.
- **Manajemen meja / dine-in** — model bisnis v1 murni take-away (pesan-bayar-ambil).
- **Customer-facing self-order app** — hanya kasir yang input order, bukan customer langsung.
- **Multi-cabang/multi-outlet** — v1 single lokasi.
- **Promo/diskon/voucher** — harga produk flat, tanpa mekanisme potongan harga.
- **Refund/adjustment setelah order confirmed** — begitu order confirmed (stok terpotong, masuk KDS), tidak ada jalur pembatalan resmi di v1 (lihat FR-3 untuk batasan void).

## 5. Users & Use Cases
**Persona:**
- **Owner** (Dimas) — akses penuh: kelola produk, resep, stok, lihat laporan.
- **Kasir** — akses terbatas: input order, konfirmasi bayar, void order (sebelum confirmed).
- **Dapur** — akses terbatas: lihat KDS, update status masak.

**Use case utama:**
1. Kasir menerima pesanan customer walk-in, input ke sistem, terima uang cash, cetak/tampilkan struk sederhana.
2. Dapur melihat pesanan baru muncul otomatis di layar KDS begitu kasir konfirmasi bayar, lalu update status seiring progres masak.
3. Owner mengecek di akhir hari: berapa omzet, produk apa yang paling laku, bahan baku apa yang menipis.
4. Owner menambah produk menu baru beserta resepnya (bahan baku + takaran) sebelum dijual.

## 6. User Flows

**Flow utama — Order sampai selesai:**
```
Kasir login
   ↓
Pilih produk → tambah ke order (status: draft)
   ↓
Review order → pilih bayar cash → input jumlah bayar
   ↓
[Sistem cek: jumlah bayar >= total?] --tidak--> tampilkan error, kasir ulang input
   ↓ ya
Konfirmasi pembayaran
   ↓
Status order → confirmed
   ├─→ Stok bahan baku terpotong otomatis (atomic, sesuai resep tiap item)
   └─→ Order muncul real-time di KDS
   ↓
Dapur: update status → diterima → sedang dimasak → siap diambil
   ↓
Kasir/Dapur tandai "completed" setelah customer ambil
   ↓
Order masuk riwayat transaksi & laporan
```

**Flow alternatif — Void order:**
```
Kasir buat order (draft) → sadar salah input
   ↓
[Order masih draft?] --tidak (sudah confirmed)--> void tidak tersedia, tidak ada jalur v1
   ↓ ya
Kasir tekan void → order dibatalkan, stok TIDAK terpotong (karena belum sempat dipotong)
```

## 7. Functional Requirements

**FR-1 [P0] — Kasir: Buat Order Baru**
- Deskripsi: Kasir memilih produk aktif dari menu, menambahkannya ke order dalam status `draft`.
- Acceptance criteria:
  - [ ] Kasir bisa menambah/mengubah qty/menghapus item selama order masih `draft`
  - [ ] Subtotal & total dihitung otomatis setiap kali item berubah
  - [ ] Produk berstatus `inactive` tidak muncul di daftar pilihan kasir

**FR-2 [P0] — Kasir: Konfirmasi Pembayaran (Cash)**
- Deskripsi: Kasir input jumlah uang diterima; sistem hitung kembalian dan mengonfirmasi order.
- Acceptance criteria:
  - [ ] Sistem menolak konfirmasi jika jumlah bayar < total order
  - [ ] Kembalian dihitung & ditampilkan otomatis
  - [ ] Setelah confirmed, item order tidak bisa diubah lagi
  - [ ] Pemotongan stok dieksekusi sebagai satu operasi atomic di level database (bukan read-then-write dari client) — lihat Risiko #1

**FR-3 [P0] — Kasir: Void Order**
- Deskripsi: Kasir bisa membatalkan order **hanya** selama status masih `draft`.
- Acceptance criteria:
  - [ ] Aksi void tidak tersedia/disabled untuk order berstatus selain `draft`
  - [ ] Order yang di-void tidak memotong stok dan tidak tercatat sebagai transaksi di laporan

**FR-4 [P0] — Manajemen Produk/Menu (Owner)**
- Deskripsi: CRUD produk — nama, harga, kategori, status aktif/nonaktif, foto (opsional).
- Acceptance criteria:
  - [ ] Owner bisa tambah/edit/nonaktifkan produk
  - [ ] Kasir hanya melihat produk berstatus aktif
  - [ ] Menonaktifkan produk tidak menghapus riwayat order yang sudah memakainya

**FR-5 [P0] — Manajemen Resep (Owner)**
- Deskripsi: Owner mendefinisikan resep per produk — daftar bahan baku beserta takaran yang dibutuhkan.
- Acceptance criteria:
  - [ ] Satu produk bisa punya 0 atau lebih bahan baku terkait
  - [ ] Produk tanpa resep terdefinisi tetap bisa dipesan kasir seperti biasa, tapi tidak memotong stok apapun saat dipesan
  - [ ] Produk tanpa resep ditandai dengan badge/label visual (misal "stok tidak terlacak") di halaman manajemen produk (Owner) — supaya Owner sadar produk ini belum lengkap datanya, bukan silent gap

**FR-6 [P0] — Manajemen Stok Bahan Baku (Owner)**
- Deskripsi: CRUD ingredient (nama, unit, stok saat ini) + kemampuan restock manual.
- Acceptance criteria:
  - [ ] Owner bisa melihat & mengubah stok bahan baku
  - [ ] Setiap perubahan stok (dari order maupun restock manual) tercatat di StockMovement (lihat FR-11)
  - [ ] Stok tidak pernah bernilai negatif (constraint di level database)
  - [ ] Setiap ingredient punya ambang "stok menipis" (`min_stock_threshold`), default otomatis 20% dari stok awal saat dibuat, bisa diubah manual oleh Owner
  - [ ] Ingredient dengan `current_stock <= min_stock_threshold` ditandai badge "stok menipis" di daftar ingredient dan muncul di ringkasan Dashboard Owner

**FR-7 [P0] — Kitchen Display System (KDS)**
- Deskripsi: Layar khusus role Dapur yang menampilkan order `confirmed` secara real-time.
- Acceptance criteria:
  - [ ] Order baru muncul di KDS dalam <5 detik setelah kasir konfirmasi, tanpa refresh manual (Supabase Realtime)
  - [ ] Dapur bisa update status: `diterima` → `sedang dimasak` → `siap diambil`
  - [ ] Update status dapur tersinkron balik ke tampilan kasir secara real-time
  - [ ] Jika koneksi realtime terputus, sistem otomatis reconnect dan menyinkronkan ulang order yang tertinggal (tidak hilang)

**FR-8 [P0] — Laporan Penjualan (Owner)**
- Deskripsi: Ringkasan omzet, jumlah transaksi, dan produk terlaris, dengan filter rentang tanggal.
- Acceptance criteria:
  - [ ] Filter berdasarkan rentang tanggal (harian/mingguan/custom)
  - [ ] Hanya order berstatus `completed` yang dihitung (bukan `draft` atau `void`)

**FR-9 [P1] — Role & Permission**
- Deskripsi: Pembatasan akses fitur berdasarkan role (Owner/Kasir/Dapur) memakai Supabase Auth + Row Level Security.
- Acceptance criteria:
  - [ ] Kasir tidak bisa mengakses halaman manajemen produk/laporan
  - [ ] Dapur hanya bisa mengakses KDS
  - [ ] Pembatasan diberlakukan di level database (RLS), bukan hanya disembunyikan di UI

**FR-10 [P1] — Order Completion**
- Deskripsi: Order ditandai `completed` setelah customer mengambil pesanan.
- Acceptance criteria:
  - [ ] Order berstatus `ready` bisa ditandai `completed` oleh kasir maupun dapur
  - [ ] Order `completed` muncul di riwayat transaksi dan laporan

**FR-11 [P2] — StockMovement Audit Log**
- Deskripsi: Setiap perubahan stok (potongan dari order, restock manual) tercatat sebagai entry log.
- Acceptance criteria:
  - [ ] Owner bisa melihat histori perubahan stok per bahan baku
  - [ ] Tiap entry mencatat: waktu, jumlah perubahan, sumber (order_id atau manual), user yang melakukan (jika manual)

**FR-12 [P0] — Manajemen Akun Kasir & Dapur (Owner)**
- Deskripsi: Owner membuat akun untuk kasir & dapur langsung dari admin panel. Tidak ada alur self-registration publik.
- Acceptance criteria:
  - [ ] Owner bisa membuat akun baru dengan role `kasir` atau `dapur` (set email + password awal, atau kirim invite)
  - [ ] Owner bisa menonaktifkan akun kasir/dapur (misal saat karyawan berhenti)
  - [ ] Tidak ada halaman signup/registrasi publik yang bisa diakses tanpa login sebagai Owner

**FR-13 [P1] — Struk Transaksi (PDF)**
- Deskripsi: Setelah order confirmed, sistem bisa men-generate struk transaksi dalam format PDF yang bisa diunduh.
- Acceptance criteria:
  - [ ] Struk PDF berisi: daftar item & qty, harga satuan, total, metode bayar, jumlah kembalian, waktu transaksi
  - [ ] Kasir bisa mengunduh struk PDF dari halaman order yang sudah confirmed
  - [ ] Proses generate PDF tidak memblokir alur konfirmasi order utama (dibuat on-demand saat diunduh, bukan bagian synchronous dari FR-2)

## 8. Non-Functional Requirements
- **Responsiveness:** UI harus berfungsi baik di layar HP (kasir/dapur mobile), tablet, dan desktop (owner). Layout tidak boleh rusak/unusable di viewport ≤375px.
- **Realtime latency:** Order baru harus tampil di KDS dalam <5 detik dari konfirmasi (lihat FR-7).
- **Data integrity:** Stok bahan baku tidak boleh pernah bernilai negatif, termasuk dalam kondisi 2+ order dikonfirmasi bersamaan (concurrency-safe).
- **Security:** Pembatasan akses per role ditegakkan di level database (RLS), bukan cuma di frontend.
- **Browser support:** Browser modern (Chrome, Safari, Edge versi terbaru) — tidak perlu dukungan browser lawas.
- **Offline behavior:** Tidak didukung di v1 (assumption: koneksi internet lokasi stabil — lihat Section 11).
- **i18n:** Bahasa Indonesia saja, tidak perlu multi-bahasa.

## 9. Data Model

| Entitas | Field kunci | Relasi |
|---|---|---|
| `User` | id, name, role (`owner`/`kasir`/`dapur`) | — |
| `Product` | id, name, price, category, is_active | 1—N ke `Recipe`, `OrderItem` |
| `Ingredient` | id, name, unit, current_stock | 1—N ke `Recipe`, `StockMovement` |
| `Recipe` | product_id, ingredient_id, qty_needed | Junction: `Product` ↔ `Ingredient` |
| `Order` | id, status, total, payment_method, cashier_id, created_at, confirmed_at, completed_at | 1—N ke `OrderItem` |
| `OrderItem` | order_id, product_id, qty, price_at_order_time | N—1 ke `Order`, `Product` |
| `StockMovement` | ingredient_id, order_id (nullable), qty_changed, source (`order`/`manual`), created_by, created_at | N—1 ke `Ingredient` |

**State machine `Order.status`:**
`draft` → `confirmed` → `in_kitchen` → `ready` → `completed`
(atau `draft` → `voided`, jalur keluar satu-satunya sebelum `confirmed`)

Sumber kebenaran stok adalah `Ingredient.current_stock` (bukan hasil hitung dari `StockMovement` — StockMovement murni log/audit trail, bukan yang dibaca untuk cek stok real-time, supaya tidak perlu agregasi tiap kali cek stok).

## 10. Edge Cases & Error States

- **Empty:** Menu belum ada produk sama sekali → kasir lihat state kosong dengan pesan jelas, bukan layar blank. Belum ada order hari ini → laporan tampilkan "belum ada transaksi", bukan error.
- **Full/extreme:** Order dengan banyak item (misal 30+ item dalam satu order) → UI tetap scrollable & responsif, tidak lag.
- **Bad input:** Kasir input jumlah bayar berupa teks/negatif → validasi tolak sebelum submit. Jumlah bayar kurang dari total → sistem block konfirmasi dengan pesan jelas.
- **Concurrency (risiko #1):** Dua kasir di device berbeda konfirmasi order yang sama-sama butuh bahan baku yang stoknya nyaris habis, hampir bersamaan → hanya satu yang boleh berhasil memotong stok; yang kedua harus mendapat error "stok tidak cukup" sebelum order-nya ikut confirmed, bukan lolos dan bikin stok minus.
- **Failure:** Koneksi kasir putus tepat setelah klik konfirmasi tapi sebelum server merespons → sistem harus punya cara memastikan tidak terjadi double-deduction atau order stuck di limbo (idealnya idempotent request). Supabase Realtime terputus di KDS → dapur harus tetap bisa lihat order yang sudah masuk sebelumnya (tidak hilang dari layar), dan reconnect otomatis mengambil order yang mungkin terlewat.
- **Boundary:** Stok tepat pas di titik minimum (misal sisa 1 unit, order butuh tepat 1 unit) → order harus tetap bisa diproses normal (bukan false-reject karena strict inequality yang salah).

## 11. Dependencies & Assumptions
- **Confirmed:** Stack teknis Next.js + Supabase + Vercel (keputusan sudah final dari diskusi sebelumnya).
- **Confirmed:** Dibangun sepenuhnya lewat Claude Code, desain visual dari Claude Design.
- **Assumption (perlu divalidasi):** Koneksi internet lokasi kafe/resto stabil — aplikasi ini cloud-based, tidak ada offline fallback di v1. Kalau internet mati, seluruh operasional (kasir + KDS) berhenti total.
- **Assumption:** Single lokasi/outlet (konsisten dengan Non-Goal multi-cabang).
- **Confirmed:** Akun kasir & dapur dibuatkan manual oleh Owner lewat admin panel (bukan self-registration) — lihat FR-12.
- **Dependency:** Struk PDF (FR-13) butuh library generate PDF di sisi client/server (misal `react-pdf` atau `jsPDF`) — pemilihan library spesifik didetailkan nanti di Technical Architecture, bukan di PRD ini.

## 12. Risks & Mitigations

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| **Concurrency conflict pada stok & sinkronisasi real-time KDS** — dua kasir device konfirmasi order bersamaan saat stok tipis, berpotensi bikin stok minus; atau order gagal muncul/telat di KDS akibat koneksi realtime putus | Medium | Tinggi | Gunakan atomic database function (Postgres RPC) untuk pemotongan stok — bukan pola read-then-write dari client. Tambahkan constraint `stock >= 0` di level DB. Implementasikan reconnect + resync otomatis untuk Realtime subscription. Wajib uji skenario 2+ device konfirmasi bersamaan sebelum dianggap "selesai" — jangan cuma tes solo. |
| Scope v1 cukup besar (KDS + stok resep + role-based access) dikerjakan solo meski timeline fleksibel | Medium | Sedang | Prioritas ketat: selesaikan semua P0 (FR-1 s/d FR-8) dulu sampai solid sebelum menyentuh P1/P2 |
| Claude Code over-build fitur di luar scope (misal ikut menambah promo/multi-cabang karena "biar lengkap") | Rendah–Medium | Sedang | `CLAUDE.md` merujuk eksplisit ke Section 4 (Non-Goals); review tiap milestone sebelum lanjut ke berikutnya |
| RLS policy salah konfigurasi → kasir/dapur bisa akses data di luar kewenangan role-nya | Medium | Tinggi | Review manual tiap RLS policy sebelum go-live, jangan cuma percaya hasil auto-generate |
| Tidak ada offline fallback → operasional berhenti total kalau internet mati | Medium | Tinggi | Di luar scope v1 (lihat Section 11), dicatat sebagai known limitation, bukan dibiarkan jadi asumsi tersembunyi |

## 13. Release Plan

| Milestone | Isi | Prioritas |
|---|---|---|
| M1 — Setup & Auth | Project scaffold, schema Supabase, RLS dasar, login per role, manajemen akun kasir/dapur oleh Owner (FR-12) | Fondasi |
| M2 — Manajemen Produk & Resep | CRUD produk, ingredient, resep (Owner) | P0 |
| M3 — Kasir Core Flow | Buat order, void, konfirmasi bayar cash, atomic stock deduction, struk PDF (FR-13) | P0 |
| M4 — KDS Real-time | Layar dapur, sinkronisasi real-time, update status masak | P0 |
| M5 — Laporan & Audit Stok | Dashboard laporan penjualan, StockMovement log | P1/P2 |
| M6 — Polish & Deploy | Testing lintas device (HP/tablet/desktop), deploy ke Vercel | Rilis |

**Rollback plan:** Karena ini project personal tanpa data pelanggan nyata, rollback cukup lewat `git revert` + redeploy versi sebelumnya via Vercel deployment history — tidak perlu strategi migrasi data yang rumit.

## 14. Open Questions

Tidak ada open question aktif saat ini — ketiga pertanyaan sebelumnya (pembuatan akun, format struk, produk tanpa resep) sudah diputuskan dan diintegrasikan ke FR-5, FR-12, dan FR-13. Section ini akan diisi lagi kalau ada keputusan baru yang perlu digantung saat masuk tahap ERD/Technical Architecture (wajar — biasanya detail teknis memunculkan pertanyaan baru).

## 15. Appendix
- Referensi pola data model & alur KOT (Kitchen Order Ticket) yang lazim dipakai sistem POS resto: Vertabelo "Data Model for Restaurants", Tutorials24x7 "Design Database For Restaurant Order System".
- Dokumen terkait yang perlu dibuat setelah PRD ini: ERD detail, User Flow/wireframe, Design System (Claude Design), Technical Architecture, `CLAUDE.md`.
