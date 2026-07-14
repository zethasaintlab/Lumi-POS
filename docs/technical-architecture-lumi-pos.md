# Technical Architecture: Lumi-POS
**Status:** Draft | **Owner:** Dimas | **Last updated:** 13 Juli 2026 | **Version:** 0.1
**Turunan dari:** `prd-lumi-pos.md`, `erd-lumi-pos.md`, `design-system-lumi-pos.md`

## 0. Asumsi & Keputusan yang Diwarisi

Beberapa keputusan di bawah sudah final dari diskusi sebelumnya, saya list ulang di sini supaya dokumen ini self-contained:
- **Stack:** Next.js (App Router) + Supabase (Postgres, Auth, Realtime) + Vercel — final dari awal project
- **State management:** Zustand (client/UI state) + TanStack Query (server state/caching) — sempat dibahas, belum ada revisi
- **UI:** Tailwind + shadcn/ui — dipilih karena selaras dengan output Claude Design
- **Font:** IBM Plex Sans + IBM Plex Mono (Google Fonts, dari `design-system-lumi-pos.md`)

Yang **belum eksplisit diputuskan**, saya ambil default yang wajar (tandai kalau perlu dikoreksi):
- **PDF generation:** `@react-pdf/renderer` — dipilih karena bisa jalan di server (Route Handler) tanpa headless browser, cocok untuk struk sederhana (FR-13)
- **Testing:** Vitest untuk unit test (logic stok/resep, yang jadi risiko terbesar di PRD) + Playwright untuk smoke test alur order end-to-end. Tidak full TDD untuk semua fitur — fokus coverage di FR-2 & function `confirm_order` karena itu bagian paling kritis
- **Realtime channel:** satu Supabase Realtime channel per tabel `orders`, di-scope dengan filter status, bukan channel terpisah per order

## 1. Struktur Folder

```
lumi-pos/
├── docs/                          # PRD, ERD, User Flow/IA, Design System, Technical Architecture
├── app/
│   ├── (auth)/
│   │   └── login/
│   ├── (kasir)/
│   │   └── kasir/                 # layar kasir, dilindungi middleware role=kasir
│   ├── (dapur)/
│   │   └── dapur/                 # KDS board, dilindungi middleware role=dapur
│   ├── (owner)/
│   │   └── owner/
│   │       ├── dashboard/
│   │       ├── produk/
│   │       ├── stok/
│   │       ├── laporan/
│   │       └── akun/
│   └── api/
│       └── orders/[id]/receipt/   # Route Handler generate struk PDF on-demand
├── components/
│   ├── ui/                        # shadcn/ui primitives
│   ├── kasir/
│   ├── kds/
│   └── owner/
├── lib/
│   ├── supabase/
│   │   ├── client.ts               # browser client
│   │   ├── server.ts               # server client (@supabase/ssr)
│   │   └── middleware.ts
│   ├── stores/                     # Zustand stores (cart/order draft)
│   └── queries/                    # TanStack Query hooks per entitas
├── supabase/
│   ├── migrations/                 # schema dari erd-lumi-pos.md
│   └── functions/                  # confirm_order.sql, dsb (lihat Section 5)
├── middleware.ts                   # proteksi route per role
└── CLAUDE.md
```

Route groups `(kasir)`, `(dapur)`, `(owner)` dipilih supaya proteksi akses & layout berbeda per role bisa dipisah bersih tanpa saling ganggu, konsisten dengan matriks akses di `erd-lumi-pos.md` Section 4.

## 2. Routing & Proteksi per Role

`middleware.ts` mengecek sesi Supabase Auth di tiap request, baca `role` dari tabel `users` (bukan dari JWT custom claim untuk v1 — lebih sederhana meski nambah satu query per request; optimisasi custom claim bisa nyusul kalau perlu):

| Route group | Role diizinkan | Redirect kalau tidak sesuai |
|---|---|---|
| `/kasir/*` | `kasir`, `owner` | → `/login` |
| `/dapur/*` | `dapur`, `owner` | → `/login` |
| `/owner/*` | `owner` | → `/login` |
| `/login` | Semua (belum login) | Kalau sudah login → redirect otomatis sesuai role |

Owner sengaja diberi akses ke `/kasir` dan `/dapur` juga (bukan cuma `/owner`) — supaya owner bisa turun tangan langsung kalau perlu, konsisten dengan FR-9 di PRD ("Owner: full akses semua").

## 3. Data Layer

**Dua Supabase client terpisah** (pattern standar `@supabase/ssr`):
- `lib/supabase/client.ts` — dipakai di Client Component, untuk interaksi realtime & mutation dari browser
- `lib/supabase/server.ts` — dipakai di Server Component/Route Handler, baca cookie session

**TanStack Query** membungkus semua read dari Supabase (produk, ingredient, laporan) — dengan `staleTime` pendek untuk data yang sering berubah (stok, order aktif) dan lebih panjang untuk data jarang berubah (daftar produk).

**Zustand** khusus untuk state yang murni lokal & sementara: cart/order draft di layar Kasir sebelum dikirim ke server. Begitu order confirmed, source of truth pindah sepenuhnya ke Supabase (tidak didobel-simpan di client state).

## 4. Auth & Session

- Login pakai Supabase Auth (email + password) — sesuai FR-12, akun dibuat manual oleh Owner, tidak ada signup publik
- Session di-manage lewat cookie (`@supabase/ssr`), bukan localStorage — supaya proteksi route di middleware bisa baca session di server side sebelum halaman dirender
- Setelah login, redirect otomatis ke `/kasir`, `/dapur`, atau `/owner/dashboard` sesuai `role` dari tabel `users`

## 5. Realtime Sync (KDS)

Ini implementasi konkret dari FR-7 & mitigasi Risiko #1 (concurrency) di PRD:

```ts
// Konsep, bukan final — di dalam komponen KDS Board
const channel = supabase
  .channel('orders-kds')
  .on('postgres_changes',
    { event: '*', schema: 'public', table: 'orders', filter: 'status=in.(confirmed,in_kitchen,ready)' },
    (payload) => {
      // invalidate TanStack Query cache untuk orders, bukan manual patch state
      queryClient.invalidateQueries({ queryKey: ['orders', 'kds'] })
    }
  )
  .subscribe((status) => {
    if (status === 'CLOSED' || status === 'CHANNEL_ERROR') {
      // reconnect + full resync (bukan cuma delta) — mitigasi order "hilang" saat koneksi putus
    }
  })
```

**Prinsip penting:** saat event realtime masuk, jangan langsung `setState` dari payload event (rawan out-of-sync kalau ada event yang ke-drop) — selalu **invalidate query & refetch dari server**. Realtime event di sini fungsinya cuma "sinyal ada perubahan", bukan sumber data itu sendiri.

## 6. Database Function: `confirm_order` (implementasi dari ERD Section 5)

```sql
CREATE OR REPLACE FUNCTION confirm_order(p_order_id UUID, p_amount_paid NUMERIC)
RETURNS orders
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_order orders%ROWTYPE;
  v_total NUMERIC;
  v_insufficient TEXT;
BEGIN
  -- 1. Lock order row, cegah double-confirm dari request bersamaan
  SELECT * INTO v_order FROM orders WHERE id = p_order_id FOR UPDATE;
  IF v_order.status != 'draft' THEN
    RAISE EXCEPTION 'Order sudah diproses atau bukan draft';
  END IF;

  SELECT COALESCE(SUM(qty * price_at_order_time), 0) INTO v_total
  FROM order_items WHERE order_id = p_order_id;

  IF p_amount_paid < v_total THEN
    RAISE EXCEPTION 'Jumlah bayar kurang dari total';
  END IF;

  -- 2. Lock semua ingredient terkait, URUTKAN by id supaya lock order konsisten
  --    antar transaction (mencegah deadlock kalau 2 order beririsan ingredient)
  PERFORM 1 FROM ingredients i
  WHERE i.id IN (
    SELECT DISTINCT r.ingredient_id FROM order_items oi
    JOIN recipes r ON r.product_id = oi.product_id
    WHERE oi.order_id = p_order_id
  )
  ORDER BY i.id FOR UPDATE;

  -- 3. Validasi stok cukup untuk SEMUA ingredient sebelum motong apapun
  SELECT string_agg(i.name, ', ') INTO v_insufficient
  FROM (
    SELECT r.ingredient_id, SUM(r.qty_needed * oi.qty) AS needed
    FROM order_items oi JOIN recipes r ON r.product_id = oi.product_id
    WHERE oi.order_id = p_order_id GROUP BY r.ingredient_id
  ) req
  JOIN ingredients i ON i.id = req.ingredient_id
  WHERE i.current_stock < req.needed;

  IF v_insufficient IS NOT NULL THEN
    RAISE EXCEPTION 'Stok tidak cukup: %', v_insufficient;
  END IF;

  -- 4. Potong stok + catat StockMovement, sekaligus dalam transaction yang sama
  UPDATE ingredients i SET current_stock = i.current_stock - req.needed
  FROM (
    SELECT r.ingredient_id, SUM(r.qty_needed * oi.qty) AS needed
    FROM order_items oi JOIN recipes r ON r.product_id = oi.product_id
    WHERE oi.order_id = p_order_id GROUP BY r.ingredient_id
  ) req
  WHERE i.id = req.ingredient_id;

  INSERT INTO stock_movements (ingredient_id, order_id, qty_changed, source, created_by)
  SELECT r.ingredient_id, p_order_id, -SUM(r.qty_needed * oi.qty), 'order', v_order.cashier_id
  FROM order_items oi JOIN recipes r ON r.product_id = oi.product_id
  WHERE oi.order_id = p_order_id GROUP BY r.ingredient_id;

  -- 5. Update order jadi confirmed
  UPDATE orders SET status = 'confirmed', amount_paid = p_amount_paid,
    change_amount = p_amount_paid - v_total, confirmed_at = now()
  WHERE id = p_order_id RETURNING * INTO v_order;

  RETURN v_order;
END;
$$;
```

Ini **draft referensi**, bukan final — perlu direview & ditest oleh Claude Code sebelum dipakai (terutama skenario 2+ request bersamaan, sesuai catatan di ERD Section 4). `SECURITY DEFINER` dipakai supaya function ini yang punya hak akses ke tabel `ingredients`/`stock_movements`, sementara kasir sendiri tidak punya akses langsung ke tabel-tabel itu (sesuai matriks RLS).

## 7. PDF Struk

Route Handler `app/api/orders/[id]/receipt/route.ts` generate PDF on-demand (bukan disimpan permanen) pakai `@react-pdf/renderer`, dipanggil saat kasir klik "Unduh struk" (FR-13). Konten: item, qty, harga, total, metode bayar, kembalian, waktu — data diambil langsung dari tabel `orders`+`order_items` saat request, bukan dari snapshot tersimpan terpisah.

## 8. Environment Variables

```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=       # hanya dipakai server-side, JANGAN pernah expose ke client
```

## 9. Deployment

- **Vercel:** connect repo langsung, environment variables di-set di Vercel dashboard (bukan commit `.env` ke git)
- **Supabase:** migration dijalankan lewat Supabase CLI (`supabase db push`) dari `supabase/migrations/`, bukan diketik manual di dashboard — supaya schema selalu tersinkron dengan yang ada di git
- **Preview deployment:** tiap PR/branch dapat preview URL otomatis dari Vercel — berguna untuk testing sebelum merge, meski karena ini solo project, alurnya bisa disederhanakan (langsung ke branch `main` kalau dirasa kegiatan review formal tidak perlu)

## 10. Testing Strategy (fokus ke area risiko tertinggi)

Sesuai prinsip "critical review of AI-generated code" — testing diprioritaskan ke bagian yang paling gampang salah tanpa ketahuan (bukan coverage 100% merata):
- **Unit test (Vitest):** function `confirm_order` — termasuk skenario "2 request konfirmasi order bersamaan saat stok pas-pasan" (paling kritis, ini risiko #1 di PRD)
- **Unit test:** logic hitung total & kembalian di layar Kasir
- **Smoke test (Playwright):** satu alur end-to-end utuh — login kasir → buat order → konfirmasi bayar → cek muncul di KDS → update status → completed

## 11. Hal yang Perlu Dikonfirmasi Sebelum Mulai Coding

- Konfirmasi pilihan `@react-pdf/renderer` untuk PDF, atau ada preferensi lain
- Konfirmasi Vitest+Playwright untuk testing, atau sudah ada preferensi tools lain
- Supabase project sudah dibuat & `.env.local` sudah siap sebelum sesi Claude Code pertama dimulai
