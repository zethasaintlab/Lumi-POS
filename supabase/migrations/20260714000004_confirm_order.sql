-- Lumi-POS M3 — order numbering + atomic confirm/checkout.
-- confirm_order is the mitigation for PRD Risk #1 (race condition on tight stock).
-- Aturan Keras #1: stock deduction ONLY through confirm_order.

-- ── Order numbering: date-based YYMMDD-NNN, resets at local (WIB) midnight ────
create table public.order_counters (
  order_date date primary key,
  last_seq   integer not null
);
alter table public.order_counters enable row level security;
-- No policies: only next_order_number() (SECURITY DEFINER) ever touches this.

create or replace function public.next_order_number()
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_date date := (now() at time zone 'Asia/Jakarta')::date;
  v_seq  integer;
begin
  insert into public.order_counters (order_date, last_seq)
    values (v_date, 1)
  on conflict (order_date)
    do update set last_seq = public.order_counters.last_seq + 1
  returning last_seq into v_seq;

  return to_char(v_date, 'YYMMDD') || '-' || lpad(v_seq::text, 3, '0');
end;
$$;

create or replace function public.set_order_number()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.order_number is null or new.order_number = '' then
    new.order_number := public.next_order_number();
  end if;
  return new;
end;
$$;

create trigger orders_set_order_number
  before insert on public.orders
  for each row execute function public.set_order_number();

-- ── confirm_order: atomic stock deduction (technical-architecture §6, reviewed) ─
create or replace function public.confirm_order(p_order_id uuid, p_amount_paid numeric)
returns public.orders
language plpgsql
security definer
set search_path = public
as $$
declare
  v_order        public.orders%rowtype;
  v_total        numeric;
  v_insufficient text;
begin
  if current_user_role() not in ('kasir', 'owner') then
    raise exception 'Hanya kasir atau owner yang bisa konfirmasi order.';
  end if;

  -- 1. Lock the order row so it can't be confirmed twice concurrently.
  select * into v_order from public.orders where id = p_order_id for update;
  if not found then
    raise exception 'Order tidak ditemukan.';
  end if;
  if v_order.status <> 'draft' then
    raise exception 'Order sudah diproses atau bukan draft.';
  end if;

  select coalesce(sum(qty * price_at_order_time), 0) into v_total
  from public.order_items where order_id = p_order_id;

  if p_amount_paid < v_total then
    raise exception 'Jumlah bayar kurang dari total.';
  end if;

  -- 2. Lock all affected ingredients, ordered by id for a consistent lock order
  --    (prevents deadlock when two orders share ingredients). This blocks until a
  --    concurrent confirm on the same ingredient commits, so step 3 reads fresh stock.
  perform 1 from public.ingredients i
  where i.id in (
    select distinct r.ingredient_id
    from public.order_items oi
    join public.recipes r on r.product_id = oi.product_id
    where oi.order_id = p_order_id
  )
  order by i.id
  for update;

  -- 3. Validate ALL ingredients are sufficient before deducting anything.
  select string_agg(i.name, ', ') into v_insufficient
  from (
    select r.ingredient_id, sum(r.qty_needed * oi.qty) as needed
    from public.order_items oi
    join public.recipes r on r.product_id = oi.product_id
    where oi.order_id = p_order_id
    group by r.ingredient_id
  ) req
  join public.ingredients i on i.id = req.ingredient_id
  where i.current_stock < req.needed;

  if v_insufficient is not null then
    raise exception 'Stok tidak cukup: %', v_insufficient;
  end if;

  -- 4. Deduct + log a stock_movement per ingredient, same transaction.
  update public.ingredients i
    set current_stock = i.current_stock - req.needed
  from (
    select r.ingredient_id, sum(r.qty_needed * oi.qty) as needed
    from public.order_items oi
    join public.recipes r on r.product_id = oi.product_id
    where oi.order_id = p_order_id
    group by r.ingredient_id
  ) req
  where i.id = req.ingredient_id;

  insert into public.stock_movements (ingredient_id, order_id, qty_changed, source, created_by)
  select r.ingredient_id, p_order_id, -sum(r.qty_needed * oi.qty), 'order', v_order.cashier_id
  from public.order_items oi
  join public.recipes r on r.product_id = oi.product_id
  where oi.order_id = p_order_id
  group by r.ingredient_id;

  -- 5. Confirm the order. total is written back (M5 reports read orders.total).
  update public.orders
    set status = 'confirmed',
        total = v_total,
        amount_paid = p_amount_paid,
        change_amount = p_amount_paid - v_total,
        confirmed_at = now()
  where id = p_order_id
  returning * into v_order;

  return v_order;
end;
$$;

-- ── checkout_order: create the order from the cart + confirm, atomically ───────
-- Cart lives client-side (Zustand); this persists it only at payment. If stock is
-- insufficient, confirm_order raises and the whole transaction rolls back — no
-- leaked draft, and no kasir DELETE policy needed. Prices are re-read server-side.
create or replace function public.checkout_order(p_items jsonb, p_amount_paid numeric)
returns public.orders
language plpgsql
security definer
set search_path = public
as $$
declare
  v_order_id uuid;
  v_inserted integer;
begin
  if current_user_role() not in ('kasir', 'owner') then
    raise exception 'Hanya kasir atau owner yang bisa membuat order.';
  end if;
  if p_items is null or jsonb_array_length(p_items) = 0 then
    raise exception 'Order kosong.';
  end if;

  insert into public.orders (status, cashier_id, payment_method)
    values ('draft', auth.uid(), 'cash')
  returning id into v_order_id;

  -- Snapshot price from the ACTIVE product; qty>0 enforced by the table CHECK.
  insert into public.order_items (order_id, product_id, qty, price_at_order_time)
  select v_order_id, (item->>'product_id')::uuid, (item->>'qty')::integer, p.price
  from jsonb_array_elements(p_items) as item
  join public.products p on p.id = (item->>'product_id')::uuid and p.is_active;

  get diagnostics v_inserted = row_count;
  if v_inserted <> jsonb_array_length(p_items) then
    raise exception 'Ada produk tidak aktif atau tidak ditemukan.';
  end if;

  return public.confirm_order(v_order_id, p_amount_paid);
end;
$$;

grant execute on function public.confirm_order(uuid, numeric) to authenticated;
grant execute on function public.checkout_order(jsonb, numeric) to authenticated;
