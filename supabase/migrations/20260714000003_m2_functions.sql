-- Lumi-POS M2 — atomic stock + recipe functions.
-- Aturan Keras #1: app code must NEVER UPDATE ingredients.current_stock directly.
-- All stock changes go through these SECURITY DEFINER functions, which update
-- current_stock AND log a stock_movement in one transaction. Owner-only.

-- Restock: add stock (manual_restock).
create or replace function public.restock_ingredient(p_ingredient_id uuid, p_qty numeric)
returns public.ingredients
language plpgsql
security definer
set search_path = public
as $$
declare
  v_ingredient public.ingredients;
begin
  if current_user_role() <> 'owner' then
    raise exception 'Hanya owner yang bisa restock.';
  end if;
  if p_qty is null or p_qty <= 0 then
    raise exception 'Jumlah restock harus lebih dari 0.';
  end if;

  select * into v_ingredient from public.ingredients where id = p_ingredient_id for update;
  if not found then
    raise exception 'Bahan baku tidak ditemukan.';
  end if;

  update public.ingredients
    set current_stock = current_stock + p_qty
    where id = p_ingredient_id
    returning * into v_ingredient;

  insert into public.stock_movements (ingredient_id, order_id, qty_changed, source, created_by)
    values (p_ingredient_id, null, p_qty, 'manual_restock', auth.uid());

  return v_ingredient;
end;
$$;

-- Adjust: correct stock to an absolute value (manual_adjustment). Logs the signed
-- delta. The current_stock >= 0 CHECK rejects a negative result.
create or replace function public.adjust_ingredient_stock(p_ingredient_id uuid, p_new_stock numeric)
returns public.ingredients
language plpgsql
security definer
set search_path = public
as $$
declare
  v_ingredient public.ingredients;
  v_delta numeric(12,3);
begin
  if current_user_role() <> 'owner' then
    raise exception 'Hanya owner yang bisa menyesuaikan stok.';
  end if;
  if p_new_stock is null or p_new_stock < 0 then
    raise exception 'Stok baru tidak boleh negatif.';
  end if;

  select * into v_ingredient from public.ingredients where id = p_ingredient_id for update;
  if not found then
    raise exception 'Bahan baku tidak ditemukan.';
  end if;

  v_delta := p_new_stock - v_ingredient.current_stock;
  if v_delta = 0 then
    return v_ingredient; -- no-op, no movement logged
  end if;

  update public.ingredients
    set current_stock = p_new_stock
    where id = p_ingredient_id
    returning * into v_ingredient;

  insert into public.stock_movements (ingredient_id, order_id, qty_changed, source, created_by)
    values (p_ingredient_id, null, v_delta, 'manual_adjustment', auth.uid());

  return v_ingredient;
end;
$$;

-- Replace a product's recipe rows in one transaction (no half-applied edits).
-- p_items = jsonb array of {ingredient_id: uuid, qty_needed: numeric}.
-- UNIQUE(product_id, ingredient_id) and CHECK(qty_needed > 0) are enforced by the
-- table; a violation rolls back the whole call, leaving recipes unchanged.
create or replace function public.set_product_recipes(p_product_id uuid, p_items jsonb)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if current_user_role() <> 'owner' then
    raise exception 'Hanya owner yang bisa mengubah resep.';
  end if;
  if not exists (select 1 from public.products where id = p_product_id) then
    raise exception 'Produk tidak ditemukan.';
  end if;

  delete from public.recipes where product_id = p_product_id;

  insert into public.recipes (product_id, ingredient_id, qty_needed)
  select p_product_id,
         (item->>'ingredient_id')::uuid,
         (item->>'qty_needed')::numeric
  from jsonb_array_elements(coalesce(p_items, '[]'::jsonb)) as item;
end;
$$;

grant execute on function public.restock_ingredient(uuid, numeric) to authenticated;
grant execute on function public.adjust_ingredient_stock(uuid, numeric) to authenticated;
grant execute on function public.set_product_recipes(uuid, jsonb) to authenticated;
