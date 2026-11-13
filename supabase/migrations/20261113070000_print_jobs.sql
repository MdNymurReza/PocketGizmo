-- Print jobs: the shared list between the store owner (admin) and the print supplier.
-- A job is created for every item of an order when the order is confirmed.
-- The supplier updates the print status and the cost; the admin marks jobs as received and paid.
-- Jobs hold no customer name, phone or address.

create or replace function is_supplier() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from profiles where id = auth.uid() and role = 'supplier');
$$;

create table print_jobs (
  id uuid primary key default gen_random_uuid(),
  order_id uuid references orders(id) on delete set null,
  order_item_id uuid unique references order_items(id) on delete set null,
  order_number text,
  title text not null check (char_length(title) between 1 and 200),
  variant text check (variant is null or char_length(variant) <= 200),
  details text check (details is null or char_length(details) <= 500),
  image text,
  quantity int not null check (quantity between 1 and 9999),
  unit_cost numeric(10,2) check (unit_cost is null or (unit_cost >= 0 and unit_cost <= 1000000)),
  status print_job_status not null default 'to_print',
  supplier_note text check (supplier_note is null or char_length(supplier_note) <= 500),
  paid boolean not null default false,
  paid_at timestamptz,
  printed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index print_jobs_status_idx on print_jobs (status, created_at desc);
create index print_jobs_order_idx on print_jobs (order_id);
create trigger t_print_jobs before update on print_jobs for each row execute function touch_updated_at();

alter table print_jobs enable row level security;
create policy "staff read print jobs" on print_jobs for select to authenticated
  using ((select is_admin()) or (select is_supplier()));
create policy "admin adds print jobs" on print_jobs for insert to authenticated with check ((select is_admin()));
create policy "admin edits print jobs" on print_jobs for update to authenticated
  using ((select is_admin())) with check ((select is_admin()));
create policy "admin removes print jobs" on print_jobs for delete to authenticated using ((select is_admin()));

-- ---------- orders -> print jobs ----------
create or replace function sync_print_jobs() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.status = old.status then return new; end if;

  -- A confirmed order goes to the supplier, one job per item.
  if new.status in ('confirmed', 'printing') then
    insert into print_jobs (order_id, order_item_id, order_number, title, variant, details, image, quantity)
    select new.id, oi.id, new.order_number, oi.product_name,
      nullif((select string_agg(e.value, ' / ') from jsonb_each_text(oi.variant_options) e), ''),
      oi.details, oi.image, oi.quantity
    from order_items oi where oi.order_id = new.id
    on conflict (order_item_id) do nothing;
  end if;

  -- A cancelled order stops the jobs that have not been printed yet.
  if new.status = 'cancelled' then
    update print_jobs set status = 'cancelled'
      where order_id = new.id and status in ('to_print', 'printing') and not paid;
  end if;
  return new;
end $$;

create trigger orders_sync_print_jobs after update of status on orders
  for each row execute function sync_print_jobs();

-- Orders that were already confirmed before this feature existed.
insert into print_jobs (order_id, order_item_id, order_number, title, variant, details, image, quantity)
select o.id, oi.id, o.order_number, oi.product_name,
  nullif((select string_agg(e.value, ' / ') from jsonb_each_text(oi.variant_options) e), ''),
  oi.details, oi.image, oi.quantity
from orders o join order_items oi on oi.order_id = o.id
where o.status in ('confirmed', 'printing')
on conflict (order_item_id) do nothing;

-- ---------- supplier updates ----------
-- The supplier may only move a job between to_print / printing / printed, set its cost and leave a note.
-- Null arguments leave that value unchanged. Paid jobs keep their cost.
create or replace function supplier_update_job(p_job uuid, p_status print_job_status, p_unit_cost numeric, p_note text)
returns void language plpgsql security definer set search_path = public as $$
declare j print_jobs; v_admin boolean := is_admin();
begin
  if not (v_admin or is_supplier()) then raise exception 'forbidden'; end if;
  select * into j from print_jobs where id = p_job for update;
  if not found then raise exception 'Job not found'; end if;

  if p_status is not null and p_status <> j.status then
    if not v_admin then
      if j.status in ('received', 'cancelled') then raise exception 'This job is closed and cannot be changed'; end if;
      if p_status not in ('to_print', 'printing', 'printed') then raise exception 'You cannot set that status'; end if;
    end if;
    j.printed_at := case
      when p_status in ('printed', 'received') then coalesce(j.printed_at, now())
      when p_status in ('to_print', 'printing') then null
      else j.printed_at end;
    j.status := p_status;
  end if;

  if p_unit_cost is not null and p_unit_cost is distinct from j.unit_cost then
    if p_unit_cost < 0 then raise exception 'Cost cannot be negative'; end if;
    if j.paid and not v_admin then raise exception 'This job is already paid, so its cost cannot be changed'; end if;
    j.unit_cost := p_unit_cost;
  end if;

  if p_note is not null then j.supplier_note := nullif(left(trim(p_note), 500), ''); end if;

  update print_jobs set status = j.status, printed_at = j.printed_at, unit_cost = j.unit_cost, supplier_note = j.supplier_note
    where id = p_job;
end $$;

-- ---------- supplier accounts (admin) ----------
create or replace function admin_set_supplier(p_email text, p_on boolean)
returns void language plpgsql security definer set search_path = public as $$
declare v_id uuid; v_role user_role;
begin
  if not is_admin() then raise exception 'forbidden'; end if;
  select u.id into v_id from auth.users u where lower(u.email) = lower(trim(p_email));
  if v_id is null then raise exception 'No account with that email. Ask them to sign up on the store first.'; end if;
  select role into v_role from profiles where id = v_id;
  if v_role = 'admin' then raise exception 'That account is an admin and cannot be a supplier'; end if;
  update profiles set role = case when p_on then 'supplier'::user_role else 'customer'::user_role end where id = v_id;
end $$;

create or replace function admin_list_suppliers()
returns table (id uuid, email text, full_name text)
language plpgsql stable security definer set search_path = public as $$
begin
  if not is_admin() then raise exception 'forbidden'; end if;
  return query select p.id, u.email::text, p.full_name from profiles p join auth.users u on u.id = p.id
    where p.role = 'supplier' order by p.created_at;
end $$;

-- ---------- grants ----------
revoke execute on function sync_print_jobs() from public, anon, authenticated;
revoke execute on function supplier_update_job(uuid, print_job_status, numeric, text) from public, anon;
revoke execute on function admin_set_supplier(text, boolean) from public, anon;
revoke execute on function admin_list_suppliers() from public, anon;
grant execute on function supplier_update_job(uuid, print_job_status, numeric, text) to authenticated;
grant execute on function admin_set_supplier(text, boolean) to authenticated;
grant execute on function admin_list_suppliers() to authenticated;
