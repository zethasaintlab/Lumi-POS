-- Reconcile orders_dapur_update_status. The live policy (applied by migration
-- 000002 during M1) predates 'completed' in its WITH CHECK, so dapur could not
-- mark orders completed (FR-10). Recreate it to match intent. Idempotent: on a
-- fresh DB where 000002 already includes 'completed', this just redefines it.
drop policy if exists orders_dapur_update_status on public.orders;

create policy orders_dapur_update_status on public.orders
  for update to authenticated
  using (current_user_role() = 'dapur' and status in ('confirmed', 'in_kitchen', 'ready'))
  with check (current_user_role() = 'dapur' and status in ('in_kitchen', 'ready', 'completed'));
