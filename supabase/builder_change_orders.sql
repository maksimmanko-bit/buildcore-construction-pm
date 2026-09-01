drop policy if exists "non builders write change orders" on public.change_orders;
drop policy if exists "active members write change orders" on public.change_orders;

create policy "active members write change orders" on public.change_orders
for all to authenticated
using (company_id = public.current_company_id())
with check (company_id = public.current_company_id());
