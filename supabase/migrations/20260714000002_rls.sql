-- Lumi-POS M1 — Row Level Security (from docs/erd-lumi-pos.md §4 access matrix)
-- Load-bearing: this is the mitigation for PRD Risk #1 (misconfigured RLS).
-- Review every policy by hand before considering M1 done.

-- Role helper. SECURITY DEFINER so it bypasses RLS on public.users — without this,
-- a policy ON users that reads users would recurse infinitely.
create or replace function public.current_user_role()
returns user_role
language sql
stable
security definer
set search_path = public
as $$
  select role from public.users where id = auth.uid();
$$;

-- Table privileges for the authenticated role. Supabase usually auto-grants
-- these, but granting explicitly makes the migration self-sufficient. RLS is
-- still the real gate: a grant without a matching policy yields zero rows on
-- SELECT and an error on write. anon gets nothing (login is via auth endpoints,
-- not table access).
grant usage on schema public to authenticated;
grant select, insert, update, delete on all tables in schema public to authenticated;

-- Enable RLS on all tables. With RLS on and no permissive policy for a role,
-- access is denied by default — that is exactly how kasir/dapur get ZERO access
-- to ingredients / recipes / stock_movements (M1 Definition of Done).
alter table public.users           enable row level security;
alter table public.products        enable row level security;
alter table public.ingredients     enable row level security;
alter table public.recipes         enable row level security;
alter table public.orders          enable row level security;
alter table public.order_items     enable row level security;
alter table public.stock_movements enable row level security;

-- ── users ──────────────────────────────────────────────────────────────────
-- Owner: full CRUD. Kasir/Dapur: read own row only.
create policy users_select_self on public.users
  for select to authenticated
  using (id = auth.uid());

create policy users_owner_all on public.users
  for all to authenticated
  using (current_user_role() = 'owner')
  with check (current_user_role() = 'owner');

-- ── products ───────────────────────────────────────────────────────────────
-- Owner: full CRUD. Kasir/Dapur (and owner): read active products.
create policy products_read_active on public.products
  for select to authenticated
  using (is_active);

create policy products_owner_all on public.products
  for all to authenticated
  using (current_user_role() = 'owner')
  with check (current_user_role() = 'owner');

-- ── ingredients ────────────────────────────────────────────────────────────
-- Owner only. No policy for kasir/dapur → denied (M1 DoD).
create policy ingredients_owner_all on public.ingredients
  for all to authenticated
  using (current_user_role() = 'owner')
  with check (current_user_role() = 'owner');

-- ── recipes ────────────────────────────────────────────────────────────────
-- Owner only. No policy for kasir/dapur → denied (M1 DoD).
create policy recipes_owner_all on public.recipes
  for all to authenticated
  using (current_user_role() = 'owner')
  with check (current_user_role() = 'owner');

-- ── stock_movements ────────────────────────────────────────────────────────
-- Owner: read only. Nobody has direct write — all inserts go through the M3
-- confirm_order() SECURITY DEFINER function, which bypasses RLS. Dapur: denied.
create policy stock_movements_owner_read on public.stock_movements
  for select to authenticated
  using (current_user_role() = 'owner');

-- ── orders ─────────────────────────────────────────────────────────────────
-- Owner: full CRUD.
create policy orders_owner_all on public.orders
  for all to authenticated
  using (current_user_role() = 'owner')
  with check (current_user_role() = 'owner');

-- Kasir: create own orders, read all, and update only draft orders.
-- Note: kasir CANNOT set status='confirmed' directly (WITH CHECK excludes it) —
-- confirmation is exclusively via confirm_order() (Aturan Keras #1). Void is a
-- draft→voided direct update, allowed here (Aturan Keras #3: void only at draft).
create policy orders_kasir_insert on public.orders
  for insert to authenticated
  with check (current_user_role() = 'kasir' and cashier_id = auth.uid());

create policy orders_kasir_select on public.orders
  for select to authenticated
  using (current_user_role() = 'kasir');

create policy orders_kasir_update_draft on public.orders
  for update to authenticated
  using (current_user_role() = 'kasir' and status = 'draft')
  with check (current_user_role() = 'kasir' and status in ('draft', 'voided'));

-- Dapur: read confirmed/in_kitchen/ready; advance status in_kitchen/ready/completed.
create policy orders_dapur_select on public.orders
  for select to authenticated
  using (current_user_role() = 'dapur' and status in ('confirmed', 'in_kitchen', 'ready'));

create policy orders_dapur_update_status on public.orders
  for update to authenticated
  using (current_user_role() = 'dapur' and status in ('confirmed', 'in_kitchen', 'ready'))
  with check (current_user_role() = 'dapur' and status in ('in_kitchen', 'ready', 'completed'));

-- ── order_items ────────────────────────────────────────────────────────────
-- Owner: full CRUD.
create policy order_items_owner_all on public.order_items
  for all to authenticated
  using (current_user_role() = 'owner')
  with check (current_user_role() = 'owner');

-- Kasir: read all; insert only into own draft order.
create policy order_items_kasir_select on public.order_items
  for select to authenticated
  using (current_user_role() = 'kasir');

create policy order_items_kasir_insert on public.order_items
  for insert to authenticated
  with check (
    current_user_role() = 'kasir'
    and exists (
      select 1 from public.orders o
      where o.id = order_id and o.status = 'draft' and o.cashier_id = auth.uid()
    )
  );

-- Dapur: read items of orders it can see.
create policy order_items_dapur_select on public.order_items
  for select to authenticated
  using (
    current_user_role() = 'dapur'
    and exists (
      select 1 from public.orders o
      where o.id = order_id and o.status in ('confirmed', 'in_kitchen', 'ready')
    )
  );
