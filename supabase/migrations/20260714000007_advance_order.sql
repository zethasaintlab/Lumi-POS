-- Lumi-POS M4 — advance_order: forward the KDS status one step.
-- Why an RPC and not a plain dapur UPDATE: dapur's SELECT scope is
-- confirmed/in_kitchen/ready (ERD access matrix). Marking an order 'completed'
-- produces a row dapur can no longer SELECT, and Postgres rejects such an UPDATE
-- (new-row-invisible-under-RLS). SECURITY DEFINER bypasses RLS for this
-- privileged transition (same pattern as confirm_order) while keeping dapur's
-- read matrix unchanged. Target is derived server-side (forward-only).
create or replace function public.advance_order(p_order_id uuid)
returns public.orders
language plpgsql
security definer
set search_path = public
as $$
declare
  v_order public.orders%rowtype;
  v_next  order_status;
begin
  if current_user_role() not in ('dapur', 'owner') then
    raise exception 'Hanya dapur atau owner yang bisa update status masak.';
  end if;

  select * into v_order from public.orders where id = p_order_id for update;
  if not found then
    raise exception 'Order tidak ditemukan.';
  end if;

  v_next := case v_order.status
    when 'confirmed' then 'in_kitchen'
    when 'in_kitchen' then 'ready'
    when 'ready' then 'completed'
    else null
  end;
  if v_next is null then
    raise exception 'Order tidak bisa dimajukan dari status %.', v_order.status;
  end if;

  -- completed_at is stamped by the orders_set_completed_at trigger.
  update public.orders set status = v_next where id = p_order_id returning * into v_order;
  return v_order;
end;
$$;

grant execute on function public.advance_order(uuid) to authenticated;
