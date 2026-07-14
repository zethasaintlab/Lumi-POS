-- Lumi-POS M1 — Schema (from docs/erd-lumi-pos.md §1–2, §6)
-- gen_random_uuid() is core Postgres (>=13); no extension needed on Supabase.

-- 1. Enum types (ERD §1)
create type user_role as enum ('owner', 'kasir', 'dapur');

create type order_status as enum (
  'draft', 'confirmed', 'in_kitchen', 'ready', 'completed', 'voided'
);

create type stock_movement_source as enum (
  'order', 'manual_restock', 'manual_adjustment'
);

-- Shared updated_at trigger (self-contained; no moddatetime extension dependency)
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- 2. Tables (ERD §2)

-- users: profile table, 1—1 with auth.users
create table public.users (
  id         uuid primary key references auth.users(id) on delete cascade,
  name       text not null,
  role       user_role not null,
  is_active  boolean not null default true,
  created_at timestamptz not null default now()
);

create table public.products (
  id         uuid primary key default gen_random_uuid(),
  name       text not null,
  price      numeric(12,2) not null check (price >= 0),
  category   text,
  is_active  boolean not null default true,
  image_url  text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger products_set_updated_at
  before update on public.products
  for each row execute function public.set_updated_at();

create table public.ingredients (
  id                  uuid primary key default gen_random_uuid(),
  name                text not null,
  unit                text not null,
  current_stock       numeric(12,3) not null default 0 check (current_stock >= 0),
  min_stock_threshold numeric(12,3) not null check (min_stock_threshold >= 0),
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);
create trigger ingredients_set_updated_at
  before update on public.ingredients
  for each row execute function public.set_updated_at();

-- recipes: junction products <-> ingredients
-- Asymmetric FK deletes are intentional (ERD §2): product CASCADE, ingredient RESTRICT.
create table public.recipes (
  id            uuid primary key default gen_random_uuid(),
  product_id    uuid not null references public.products(id) on delete cascade,
  ingredient_id uuid not null references public.ingredients(id) on delete restrict,
  qty_needed    numeric(12,3) not null check (qty_needed > 0),
  unique (product_id, ingredient_id)
);

create table public.orders (
  id             uuid primary key default gen_random_uuid(),
  order_number   text not null unique,
  status         order_status not null default 'draft',
  total          numeric(12,2) not null default 0 check (total >= 0),
  amount_paid    numeric(12,2),
  change_amount  numeric(12,2),
  payment_method text not null default 'cash',
  cashier_id     uuid not null references public.users(id),
  created_at     timestamptz not null default now(),
  confirmed_at   timestamptz,
  completed_at   timestamptz,
  voided_at      timestamptz
);

create table public.order_items (
  id                  uuid primary key default gen_random_uuid(),
  order_id            uuid not null references public.orders(id) on delete cascade,
  product_id          uuid not null references public.products(id) on delete restrict,
  qty                 integer not null check (qty > 0),
  price_at_order_time numeric(12,2) not null
);

create table public.stock_movements (
  id            uuid primary key default gen_random_uuid(),
  ingredient_id uuid not null references public.ingredients(id),
  order_id      uuid references public.orders(id) on delete set null,
  qty_changed   numeric(12,3) not null,
  source        stock_movement_source not null,
  created_by    uuid not null references public.users(id),
  created_at    timestamptz not null default now()
);

-- 6. Recommended indexes (ERD §6)
create index orders_status_idx           on public.orders (status);
create index orders_created_at_idx       on public.orders (created_at);
create index order_items_order_id_idx    on public.order_items (order_id);
create index stock_movements_ingredient_idx on public.stock_movements (ingredient_id, created_at);
create index recipes_product_id_idx      on public.recipes (product_id);
