-- Lumi-POS M4 — enable Realtime on orders (KDS) + completed_at timestamp.

-- postgres_changes on orders for the KDS board (FR-7). RLS still gates which
-- rows each subscriber receives (dapur: confirmed/in_kitchen/ready).
alter publication supabase_realtime add table public.orders;

-- Stamp completed_at when an order is marked completed (mirrors how
-- confirm_order sets confirmed_at). Guarantees it regardless of caller — M5
-- reports read completed orders by time.
create or replace function public.set_completed_at()
returns trigger
language plpgsql
as $$
begin
  if new.status = 'completed' and old.status is distinct from 'completed' then
    new.completed_at = now();
  end if;
  return new;
end;
$$;

create trigger orders_set_completed_at
  before update on public.orders
  for each row execute function public.set_completed_at();
