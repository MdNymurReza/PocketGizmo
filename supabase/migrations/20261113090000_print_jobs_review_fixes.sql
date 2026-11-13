-- Fixes from the code review of the supplier / print jobs feature.

-- 1. Remember that an order was already sent to print, so a job the admin deleted
--    does not come back when the order later moves from confirmed to printing.
alter table orders add column if not exists print_queued_at timestamptz;
update orders o set print_queued_at = now()
  where print_queued_at is null and exists (select 1 from print_jobs j where j.order_id = o.id);

-- 2. One place that turns an order's items into print jobs (used by the trigger and by "Send to print").
create or replace function enqueue_print_jobs(p_order uuid)
returns int language plpgsql security definer set search_path = public as $$
declare n int;
begin
  insert into print_jobs (order_id, order_item_id, order_number, title, variant, details, image, quantity)
  select o.id, oi.id, o.order_number, oi.product_name,
    nullif((select string_agg(e.value, ' / ') from jsonb_each_text(oi.variant_options) e), ''),
    oi.details, oi.image, oi.quantity
  from orders o join order_items oi on oi.order_id = o.id
  where o.id = p_order
  on conflict (order_item_id) do nothing;
  get diagnostics n = row_count;
  update orders set print_queued_at = coalesce(print_queued_at, now()) where id = p_order;
  return n;
end $$;

create or replace function sync_print_jobs() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.status = old.status then return new; end if;
  -- A confirmed order goes to the supplier once. Later status changes do not add jobs again.
  if new.status in ('confirmed', 'printing') and new.print_queued_at is null then
    perform enqueue_print_jobs(new.id);
  end if;
  -- A cancelled order stops the jobs that have not been printed yet.
  if new.status = 'cancelled' then
    update print_jobs set status = 'cancelled'
      where order_id = new.id and status in ('to_print', 'printing') and not paid;
  end if;
  return new;
end $$;

create or replace function admin_send_order_to_print(p_order uuid)
returns int language plpgsql security definer set search_path = public as $$
declare v_status order_status;
begin
  if not is_admin() then raise exception 'forbidden'; end if;
  select status into v_status from orders where id = p_order;
  if not found then raise exception 'Order not found'; end if;
  if v_status = 'cancelled' then raise exception 'This order is cancelled, so it cannot be sent to print'; end if;
  return enqueue_print_jobs(p_order);
end $$;

-- 3. Supplier updates: a cost can now be cleared, and a cancelled job is locked for the supplier
--    in the database too (before, only the status was locked).
drop function if exists supplier_update_job(uuid, print_job_status, numeric, text);
create or replace function supplier_update_job(
  p_job uuid, p_status print_job_status, p_unit_cost numeric, p_note text, p_clear_cost boolean default false
) returns void language plpgsql security definer set search_path = public as $$
declare j print_jobs; v_admin boolean := is_admin(); v_cost numeric;
begin
  if not (v_admin or is_supplier()) then raise exception 'forbidden'; end if;
  select * into j from print_jobs where id = p_job for update;
  if not found then raise exception 'Job not found'; end if;
  if not v_admin and j.status = 'cancelled' then raise exception 'This job was cancelled and cannot be changed'; end if;

  if p_status is not null and p_status <> j.status then
    if not v_admin then
      if j.status = 'received' then raise exception 'This job is closed and cannot be changed'; end if;
      if p_status not in ('to_print', 'printing', 'printed') then raise exception 'You cannot set that status'; end if;
    end if;
    j.printed_at := case
      when p_status in ('printed', 'received') then coalesce(j.printed_at, now())
      when p_status in ('to_print', 'printing') then null
      else j.printed_at end;
    j.status := p_status;
  end if;

  v_cost := case when p_clear_cost then null else coalesce(round(p_unit_cost, 2), j.unit_cost) end;
  if v_cost is distinct from j.unit_cost then
    if v_cost < 0 then raise exception 'Cost cannot be negative'; end if;
    if j.paid and not v_admin then raise exception 'This job is already paid, so its cost cannot be changed'; end if;
    if j.paid and v_cost is null then raise exception 'Mark this job as not paid before you remove its cost'; end if;
    j.unit_cost := v_cost;
  end if;

  if p_note is not null then j.supplier_note := nullif(left(trim(p_note), 500), ''); end if;

  update print_jobs set status = j.status, printed_at = j.printed_at, unit_cost = j.unit_cost, supplier_note = j.supplier_note
    where id = p_job;
end $$;

-- 4. Paying: only finished jobs with a cost can be paid, and the total is checked against
--    what the admin saw, so a cost changed in the meantime is not paid unseen.
--    p_ids null means every job that can be paid.
create or replace function admin_pay_jobs(p_ids uuid[], p_expected_total numeric)
returns int language plpgsql security definer set search_path = public as $$
declare v_ids uuid[]; v_total numeric;
begin
  if not is_admin() then raise exception 'forbidden'; end if;
  select array_agg(l.id), coalesce(sum(l.unit_cost * l.quantity), 0) into v_ids, v_total
  from (select id, unit_cost, quantity from print_jobs
        where (p_ids is null or id = any(p_ids))
          and status in ('printed', 'received') and not paid and unit_cost is not null
        for update) l;
  if v_ids is null then raise exception 'Nothing to pay. A job must be printed and have a cost before it can be paid.'; end if;
  if p_expected_total is not null and v_total <> p_expected_total then
    raise exception 'The costs changed since you opened this page. Check the list and try again.';
  end if;
  update print_jobs set paid = true, paid_at = now() where id = any(v_ids);
  return cardinality(v_ids);
end $$;

-- 5. Totals computed in the database over every job, not over the rows one page happens to load.
create or replace function print_job_summary()
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare r jsonb;
begin
  if not (is_admin() or is_supplier()) then raise exception 'forbidden'; end if;
  select jsonb_build_object(
    'to_print', coalesce(sum(quantity) filter (where status = 'to_print'), 0),
    'printing', coalesce(sum(quantity) filter (where status = 'printing'), 0),
    'printed', coalesce(sum(quantity) filter (where status = 'printed'), 0),
    'earned', coalesce(sum(unit_cost * quantity) filter (where status in ('printed', 'received')), 0),
    'paid', coalesce(sum(unit_cost * quantity) filter (where paid), 0),
    'due', coalesce(sum(unit_cost * quantity) filter (where status in ('printed', 'received') and not paid), 0),
    'payable_count', count(*) filter (where status in ('printed', 'received') and not paid and unit_cost is not null),
    'missing_cost', count(*) filter (where status in ('printed', 'received') and unit_cost is null),
    'count_todo', count(*) filter (where status in ('to_print', 'printing')),
    'count_done', count(*) filter (where status in ('printed', 'received')),
    'count_unpaid', count(*) filter (where status in ('printed', 'received') and not paid),
    'count_paid', count(*) filter (where paid),
    'count_all', count(*)
  ) into r from print_jobs;
  return r;
end $$;

revoke execute on function enqueue_print_jobs(uuid) from public, anon, authenticated;
revoke execute on function sync_print_jobs() from public, anon, authenticated;
revoke execute on function admin_send_order_to_print(uuid) from public, anon;
revoke execute on function supplier_update_job(uuid, print_job_status, numeric, text, boolean) from public, anon;
revoke execute on function admin_pay_jobs(uuid[], numeric) from public, anon;
revoke execute on function print_job_summary() from public, anon;
grant execute on function admin_send_order_to_print(uuid) to authenticated;
grant execute on function supplier_update_job(uuid, print_job_status, numeric, text, boolean) to authenticated;
grant execute on function admin_pay_jobs(uuid[], numeric) to authenticated;
grant execute on function print_job_summary() to authenticated;
