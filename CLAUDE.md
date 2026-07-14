# CLAUDE.md

## Project Overview
Lumi-POS — sistem POS web untuk kafe/resto model take-away (bukan dine-in). Tiga role: Kasir (input pesanan & bayar cash), Dapur (Kitchen Display System real-time), Owner (kelola produk, resep, stok bahan baku, laporan). Project belajar & portfolio, dibangun sepenuhnya lewat Claude Code. Stack: Next.js (App Router) + Supabase + Vercel.

## Dokumentasi (baca berurutan sebelum mulai kerja)
1. `@docs/prd-lumi-pos.md` — requirement, scope, non-goals, edge cases. Sumber kebenaran untuk "apa yang harus dibangun".
2. `@docs/erd-lumi-pos.md` — skema database, matriks akses RLS, kontrak function `confirm_order`.
3. `@docs/user-flow-ia-lumi-pos.md` — site map, navigasi per role, rincian tiap layar.
4. `@docs/design-system-lumi-pos.md` — token warna/tipografi/layout, hasil generate dari Claude Design.
5. `@docs/technical-architecture-lumi-pos.md` — struktur folder, routing, implementasi SQL `confirm_order`, strategi testing.

Kalau ada requirement yang tidak jelas atau tampak bertentangan antar dokumen, **berhenti dan tanya ke Dimas** — jangan menebak atau mengambil asumsi sendiri untuk keputusan bisnis (beda dengan keputusan implementasi teknis kecil yang boleh diputuskan sendiri).

## Tech Stack
- Next.js (App Router), TypeScript
- Supabase (Postgres, Auth via `@supabase/ssr`, Realtime)
- Tailwind + shadcn/ui
- Zustand (client/UI state) + TanStack Query (server state)
- IBM Plex Sans + IBM Plex Mono
- `@react-pdf/renderer` untuk struk PDF
- Vitest (unit) + Playwright (smoke test)
- Deploy: Vercel

## Aturan Keras (Non-Negotiable)

Ini bukan preferensi gaya — ini hal yang kalau dilanggar bikin bug produksi yang sudah spesifik diantisipasi di PRD/ERD. Jangan diubah tanpa diskusi eksplisit dengan Dimas:

1. **Pemotongan stok WAJIB lewat function `confirm_order`** (lihat `technical-architecture-lumi-pos.md` Section 6). Jangan pernah UPDATE `ingredients.current_stock` langsung dari kode aplikasi (client maupun server action biasa) — ini mitigasi utama untuk race condition (Risiko #1 di PRD), yang jadi risiko terbesar di seluruh project ini.
2. **RLS ditegakkan di level database, bukan cuma disembunyikan di UI.** Kasir/Dapur tidak boleh punya akses tabel `ingredients`/`stock_movements`/`recipes` sama sekali (lihat matriks akses di `erd-lumi-pos.md` Section 4).
3. **Void order hanya valid saat status `draft`.** Begitu status `confirmed`, tidak ada jalur pembatalan di v1 (lihat PRD FR-3 & Non-Goals).
4. **`SUPABASE_SERVICE_ROLE_KEY` tidak boleh pernah punya prefix `NEXT_PUBLIC_`** dan tidak boleh dipanggil dari Client Component — hanya dari Server Component/Route Handler.
5. **Event Supabase Realtime cuma sinyal, bukan sumber data.** Saat event masuk, invalidate query & refetch — jangan langsung `setState` dari payload event (lihat `technical-architecture-lumi-pos.md` Section 5).
6. **Semua file dokumentasi di `/docs` pakai kebab-case.** Konsisten dengan konvensi yang sudah dipakai kelima dokumen di atas.

## Non-Goals v1 (JANGAN dibangun tanpa persetujuan eksplisit)
Ini keputusan sadar untuk menjaga scope, bukan kelupaan — kalau tergoda menambahkan salah satu ini "biar lengkap", jangan, tanya dulu:
- Payment gateway (Midtrans, dll) — v1 cash manual saja
- Manajemen meja / dine-in
- Customer-facing self-order app
- Multi-cabang/multi-outlet
- Promo/diskon/voucher
- Refund/adjustment setelah order `confirmed`

## Prinsip Development
- **Document-first**: jangan mulai coding fitur baru sebelum requirement-nya jelas ada di salah satu dokumen `/docs`. Kalau belum ada, itu sinyal untuk tanya dulu, bukan improvisasi.
- **Proven library untuk hal sensitif**: auth pakai Supabase Auth (jangan custom JWT/session handling sendiri), validasi pakai library teruji (misal Zod), jangan reinvent.
- **Validasi di client DAN server**: validasi di client untuk UX, tapi validasi ulang di server/database (constraint, RLS, function) — jangan percaya input client sepenuhnya.
- **Git dari hari pertama**: commit kecil & sering, bukan satu commit raksasa per milestone.
- **Review kritis kode hasil AI**: setelah tiap fitur "selesai", baca ulang kode yang dihasilkan sebelum lanjut — terutama bagian yang menyentuh Aturan Keras di atas.

## Plugin Claude Code

Plugin berikut dipakai secara sadar per fase kerja — bukan sekadar tersedia, tapi punya alasan spesifik terkait risiko project ini. Jangan invoke plugin di luar daftar ini tanpa alasan jelas (terutama yang berhubungan dengan tim/incident/user research — tidak relevan untuk solo project ini).

| Fase | Plugin | Kapan dipakai |
|---|---|---|
| Perencanaan tiap milestone | `superpowers:writing-plans` | Sebelum mulai coding milestone apa pun — turunkan jadi implementation plan konkret dulu, jangan langsung eksekusi dari deskripsi milestone yang masih singkat |
| Requirement yang kurang jelas | `superpowers:brainstorming` | Kalau ada detail fitur yang ternyata belum kecover di `/docs` — jaring pengaman, seharusnya jarang terpakai karena kita sudah document-first |
| Implementasi fitur kritis (khususnya M3) | `superpowers:test-driven-development` | **Wajib** untuk function `confirm_order` dan logic hitung total/kembalian — tulis test dulu sebelum implementasi, karena ini area risiko tertinggi (Risiko #1) |
| Implementasi umum | `andrej-karpathy-skills:karpathy-guidelines` | Sepanjang coding — jaga perubahan tetap surgical, cegah over-engineering/scope creep di luar apa yang diminta milestone |
| Sebelum klaim milestone selesai | `superpowers:verification-before-completion` | **Wajib**, di semua milestone — jalankan verification command dulu (test, build, lint) sebelum bilang "sudah selesai". Jangan percaya klaim sukses tanpa bukti eksekusi |
| Saat ada bug/perilaku aneh | `superpowers:systematic-debugging` | Terutama untuk gejala yang sifatnya *silent*/kadang-muncul (indikasi race condition) — pendekatan terstruktur, bukan tebak-tebakan |
| M6 — Deploy | `engineering:deploy-checklist` | Sebelum deploy production — cek migration Supabase sudah jalan, environment variables Vercel sudah lengkap, tidak ada yang kelewat |
| Setelah hasil visual dari Claude Design | `design:design-handoff` | Menerjemahkan hasil Claude Design jadi spec komponen (props, state, layout token) yang siap diimplementasi |
| Sebelum M6, terutama layar KDS | `design:accessibility-review` | Audit kontras & keterbacaan — KDS harus jelas terbaca dari jarak di dapur, sudah dicatat manual di design system, ini formalisasi ceknya |

## Milestone & Definition of Done

| Milestone | Isi | Definition of Done |
|---|---|---|
| M1 — Setup & Auth | Scaffold project, schema Supabase (migration dari ERD), RLS dasar, login per role, FR-12 (manajemen akun) | Login 3 role berhasil, redirect sesuai role benar, kasir/dapur TIDAK bisa akses tabel di luar izinnya (dites langsung lewat Supabase client, bukan cuma dites lewat UI) |
| M2 — Produk & Resep | CRUD produk, ingredient, resep (FR-4, FR-5, FR-6) | Owner bisa CRUD penuh, badge "stok tidak terlacak" & "stok menipis" muncul benar sesuai aturan di ERD |
| M3 — Kasir Core Flow | Order, void, konfirmasi bayar, struk PDF (FR-1, FR-2, FR-3, FR-13) | Function `confirm_order` lulus unit test termasuk skenario 2 request bersamaan saat stok pas-pasan; void tidak bisa dilakukan setelah confirmed |
| M4 — KDS Real-time | Layar dapur, sinkronisasi real-time (FR-7) | Order baru muncul di KDS <5 detik tanpa refresh; disconnect & reconnect diuji manual, order tidak hilang |
| M5 — Laporan & Audit | Dashboard laporan, StockMovement log (FR-8, FR-11) | Filter tanggal berfungsi, hanya order `completed` yang dihitung |
| M6 — Polish & Deploy | Testing lintas device, deploy Vercel | Playwright smoke test lulus, dicoba manual di HP asli (bukan cuma emulator), environment variables production sudah diset di Vercel |

Jangan lanjut ke milestone berikutnya kalau Definition of Done milestone sebelumnya belum terpenuhi — terutama M3, karena itu fondasi paling kritis (stok & concurrency).

## Testing
Fokus effort testing ke area risiko tertinggi (lihat `technical-architecture-lumi-pos.md` Section 10), bukan coverage merata:
- **Wajib** unit test: `confirm_order` (termasuk concurrent scenario), logic hitung total & kembalian
- **Wajib** smoke test: alur end-to-end login → order → bayar → muncul di KDS → completed

## Environment Setup
Lihat `.env.local.example` di root (buat file ini sebagai referensi, JANGAN commit `.env.local` asli). Variabel yang dibutuhkan: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `NEXT_PUBLIC_SITE_URL`. Pastikan `.env.local` ada di `.gitignore` sejak commit pertama.
