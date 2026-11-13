-- Supplier payment history, profit, photos in reviews, and saved items (wishlist).

-- ---------------------------------------------------------------------------
-- 1. Supplier payment history: every "mark as paid" is recorded as one payment.
-- ---------------------------------------------------------------------------
create table if not exists supplier_payments (
  id uuid primary key default gen_random_uuid(),
  amount numeric(12,2) not null,
  job_count int not null,
  method text,
  reference text,
  paid_at timestamptz not null default now(),
  created_by uuid references auth.users(id) on delete set null
);
alter table supplier_payments enable row level security;
drop policy if exists "staff read supplier payments" on supplier_payments;
create policy "staff read supplier payments" on supplier_payments for select to authenticated
  using ((select is_admin()) or (select is_supplier()));

alter table print_jobs add column if not exists payment_id uuid references supplier_payments(id) on delete set null;
create index if not exists print_jobs_payment_id_idx on print_jobs(payment_id);

-- Jobs that were paid before this history existed: one payment per moment they were paid.
with g as (
  select paid_at, coalesce(sum(unit_cost * quantity), 0) amt, count(*) c
  from print_jobs where paid and payment_id is null and paid_at is not null group by paid_at
), ins as (
  insert into supplier_payments (amount, job_count, paid_at) select amt, c, paid_at from g returning id, paid_at
)
update print_jobs j set payment_id = ins.id from ins where j.paid and j.payment_id is null and j.paid_at = ins.paid_at;

drop function if exists admin_pay_jobs(uuid[], numeric);
create or replace function admin_pay_jobs(p_ids uuid[], p_expected_total numeric, p_method text default null, p_reference text default null)
returns int language plpgsql security definer set search_path = public as $$
declare v_ids uuid[]; v_total numeric; v_payment uuid;
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
  insert into supplier_payments (amount, job_count, method, reference, created_by)
  values (v_total, cardinality(v_ids), nullif(left(trim(coalesce(p_method, '')), 40), ''), nullif(left(trim(coalesce(p_reference, '')), 120), ''), auth.uid())
  returning id into v_payment;
  update print_jobs set paid = true, paid_at = now(), payment_id = v_payment where id = any(v_ids);
  return cardinality(v_ids);
end $$;

-- Undo a payment for one job. The payment it belonged to gets smaller, and is removed when it is empty.
create or replace function admin_unpay_job(p_job uuid)
returns void language plpgsql security definer set search_path = public as $$
declare j print_jobs;
begin
  if not is_admin() then raise exception 'forbidden'; end if;
  select * into j from print_jobs where id = p_job for update;
  if not found then raise exception 'Job not found'; end if;
  if not j.paid then return; end if;
  update print_jobs set paid = false, paid_at = null, payment_id = null where id = p_job;
  if j.payment_id is not null then
    update supplier_payments set amount = amount - coalesce(j.unit_cost, 0) * j.quantity, job_count = job_count - 1 where id = j.payment_id;
    delete from supplier_payments where id = j.payment_id and job_count <= 0;
  end if;
end $$;

-- A paid job's cost is part of a recorded payment, so nobody can change it while it is paid.
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
    if j.paid then raise exception 'This job is already paid. Mark it as not paid before you change its cost'; end if;
    j.unit_cost := v_cost;
  end if;

  if p_note is not null then j.supplier_note := nullif(left(trim(p_note), 500), ''); end if;

  update print_jobs set status = j.status, printed_at = j.printed_at, unit_cost = j.unit_cost, supplier_note = j.supplier_note
    where id = p_job;
end $$;

-- ---------------------------------------------------------------------------
-- 2. Profit: what the items sold for (after discounts) minus what printing cost.
--    Only orders whose print jobs all have a cost are counted; the rest are reported as not counted.
--    Delivery charges are left out: the customer pays them and the courier receives them.
-- ---------------------------------------------------------------------------
create or replace function admin_profit_summary(p_from timestamptz, p_to timestamptz)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare r jsonb;
begin
  if not is_admin() then raise exception 'forbidden'; end if;
  with o as (
    select id, subtotal - discount as net from orders where created_at between p_from and p_to and status <> 'cancelled'
  ), c as (
    select o.id, o.net, count(j.id) jobs, count(j.id) filter (where j.unit_cost is null) missing,
           coalesce(sum(j.unit_cost * j.quantity), 0) cost
    from o left join print_jobs j on j.order_id = o.id and j.status <> 'cancelled'
    group by o.id, o.net
  )
  select jsonb_build_object(
    'sales', coalesce(sum(net) filter (where jobs > 0 and missing = 0), 0),
    'cost', coalesce(sum(cost) filter (where jobs > 0 and missing = 0), 0),
    'profit', coalesce(sum(net - cost) filter (where jobs > 0 and missing = 0), 0),
    'counted_orders', count(*) filter (where jobs > 0 and missing = 0),
    'uncounted_orders', count(*) filter (where not (jobs > 0 and missing = 0))
  ) into r from c;
  return r;
end $$;

-- ---------------------------------------------------------------------------
-- 3. Photos in reviews (up to 3 per review).
-- ---------------------------------------------------------------------------
alter table reviews add column if not exists photos text[] not null default '{}';

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('review-photos', 'review-photos', true, 5242880, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;

-- A customer uploads into a folder named after their own user id.
drop policy if exists "review photos own upload" on storage.objects;
create policy "review photos own upload" on storage.objects for insert to authenticated
  with check (bucket_id = 'review-photos' and (storage.foldername(name))[1] = (select auth.uid())::text);
drop policy if exists "review photos own or admin delete" on storage.objects;
create policy "review photos own or admin delete" on storage.objects for delete to authenticated
  using (bucket_id = 'review-photos' and ((storage.foldername(name))[1] = (select auth.uid())::text or (select is_admin())));

drop function if exists submit_review(uuid, integer, text);
create or replace function submit_review(p_product uuid, p_rating integer, p_comment text, p_photos text[] default '{}')
returns review_status language plpgsql security definer set search_path = public as $$
declare v_name text; v_status review_status; v_photos text[] := coalesce(p_photos, '{}'); u text;
begin
  if auth.uid() is null then raise exception 'Please log in to write a review'; end if;
  if p_rating is null or p_rating < 1 or p_rating > 5 then raise exception 'Choose a rating from 1 to 5 stars'; end if;
  if length(coalesce(p_comment, '')) > 1500 then raise exception 'Your review is too long'; end if;
  if not can_review(p_product) then raise exception 'You can review a product after your order is delivered'; end if;
  if cardinality(v_photos) > 3 then raise exception 'You can add up to 3 photos'; end if;
  -- Only photos this customer uploaded to the review photos folder are accepted.
  foreach u in array v_photos loop
    if u not like 'https://%/storage/v1/object/public/review-photos/' || auth.uid()::text || '/%' or length(u) > 500 then
      raise exception 'One of the photos could not be used. Please upload it again';
    end if;
  end loop;

  select review_display_name(full_name) into v_name from profiles where id = auth.uid();

  insert into reviews (product_id, user_id, author_name, rating, comment, photos)
  values (p_product, auth.uid(), coalesce(v_name, 'Customer'), p_rating, trim(coalesce(p_comment, '')), v_photos)
  on conflict (product_id, user_id) do update
    set rating = excluded.rating, comment = excluded.comment, author_name = excluded.author_name, photos = excluded.photos, status = 'pending'
  returning status into v_status;
  return v_status;
end $$;

-- ---------------------------------------------------------------------------
-- 4. Saved items (wishlist), for logged-in customers.
-- ---------------------------------------------------------------------------
create table if not exists wishlist_items (
  user_id uuid not null references auth.users(id) on delete cascade,
  product_id uuid not null references products(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, product_id)
);
create index if not exists wishlist_items_product_idx on wishlist_items(product_id);
alter table wishlist_items enable row level security;
drop policy if exists "own wishlist read" on wishlist_items;
create policy "own wishlist read" on wishlist_items for select to authenticated using (user_id = (select auth.uid()));
drop policy if exists "own wishlist add" on wishlist_items;
create policy "own wishlist add" on wishlist_items for insert to authenticated with check (user_id = (select auth.uid()));
drop policy if exists "own wishlist remove" on wishlist_items;
create policy "own wishlist remove" on wishlist_items for delete to authenticated using (user_id = (select auth.uid()));

-- ---------------------------------------------------------------------------
revoke all on supplier_payments from anon;
revoke insert, update, delete on supplier_payments from authenticated;
revoke all on wishlist_items from anon;
revoke execute on function admin_pay_jobs(uuid[], numeric, text, text) from public, anon;
revoke execute on function admin_unpay_job(uuid) from public, anon;
revoke execute on function supplier_update_job(uuid, print_job_status, numeric, text, boolean) from public, anon;
revoke execute on function admin_profit_summary(timestamptz, timestamptz) from public, anon;
revoke execute on function submit_review(uuid, integer, text, text[]) from public, anon;
grant execute on function admin_pay_jobs(uuid[], numeric, text, text) to authenticated;
grant execute on function admin_unpay_job(uuid) to authenticated;
grant execute on function supplier_update_job(uuid, print_job_status, numeric, text, boolean) to authenticated;
grant execute on function admin_profit_summary(timestamptz, timestamptz) to authenticated;
grant execute on function submit_review(uuid, integer, text, text[]) to authenticated;
