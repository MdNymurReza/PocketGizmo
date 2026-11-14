-- Orders taken by hand at a stall: free-text items, own order numbers (ST-1001, ...), payments and status.

create type stall_order_status as enum ('new', 'printing', 'ready', 'delivered', 'cancelled');
create sequence if not exists stall_order_seq start 1001;

create table stall_orders (
  id uuid primary key default gen_random_uuid(),
  order_number text not null unique default ('ST-' || nextval('stall_order_seq')),
  -- The day of the stall the order was taken at, and where that stall was.
  event_date date not null default ((now() at time zone 'Asia/Dhaka')::date),
  stall_location text not null default '',
  customer_name text not null,
  customer_phone text not null,
  -- pickup: the customer collects it (e.g. at the next stall). delivery: it is sent to an address.
  fulfilment text not null default 'pickup' check (fulfilment in ('pickup', 'delivery')),
  delivery_address text,
  delivery_charge numeric(10,2) not null default 0 check (delivery_charge >= 0),
  subtotal numeric(12,2) not null default 0,
  discount numeric(10,2) not null default 0 check (discount >= 0),
  total numeric(12,2) not null default 0,
  paid_amount numeric(12,2) not null default 0 check (paid_amount >= 0),
  payment_method text,
  status stall_order_status not null default 'new',
  due_date date,
  note text,
  delivered_at timestamptz,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index stall_orders_event_idx on stall_orders(event_date desc, created_at desc);
create index stall_orders_status_idx on stall_orders(status);
create trigger t_stall_orders before update on stall_orders for each row execute function touch_updated_at();

create table stall_order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references stall_orders(id) on delete cascade,
  name text not null,
  details text,
  quantity int not null check (quantity > 0),
  unit_price numeric(10,2) not null check (unit_price >= 0),
  line_total numeric(12,2) not null
);
create index stall_order_items_order_idx on stall_order_items(order_id);

alter table stall_orders enable row level security;
alter table stall_order_items enable row level security;
create policy "admin manages stall orders" on stall_orders for all to authenticated using ((select is_admin())) with check ((select is_admin()));
create policy "admin manages stall order items" on stall_order_items for all to authenticated using ((select is_admin())) with check ((select is_admin()));
revoke all on stall_orders, stall_order_items from anon;

-- Print jobs made from a stall order point back to it.
alter table print_jobs add column if not exists stall_order_id uuid references stall_orders(id) on delete set null;
create index if not exists print_jobs_stall_order_idx on print_jobs(stall_order_id);

-- Create an order with its items in one step. Prices are added up here, not in the browser.
create or replace function stall_create_order(p jsonb, p_send_to_print boolean default true)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  o stall_orders; it jsonb; v_sub numeric := 0; v_disc numeric; v_charge numeric; v_paid numeric;
  v_name text; v_qty int; v_price numeric; v_fulfil text;
begin
  if not is_admin() then raise exception 'forbidden'; end if;
  if coalesce(trim(p->>'customer_name'), '') = '' then raise exception 'Enter the customer''s name'; end if;
  if coalesce(trim(p->>'customer_phone'), '') = '' then raise exception 'Enter the customer''s phone number'; end if;
  if jsonb_typeof(p->'items') <> 'array' or jsonb_array_length(p->'items') = 0 then raise exception 'Add at least one item'; end if;
  if jsonb_array_length(p->'items') > 50 then raise exception 'An order can have up to 50 items'; end if;

  v_fulfil := case when p->>'fulfilment' = 'delivery' then 'delivery' else 'pickup' end;
  for it in select * from jsonb_array_elements(p->'items') loop
    v_name := trim(coalesce(it->>'name', ''));
    v_qty := coalesce((it->>'quantity')::int, 0);
    v_price := coalesce((it->>'unit_price')::numeric, -1);
    if v_name = '' then raise exception 'Every item needs a name'; end if;
    if v_qty < 1 or v_qty > 9999 then raise exception 'Quantity must be between 1 and 9999'; end if;
    if v_price < 0 or v_price > 1000000 then raise exception 'Enter a price for every item'; end if;
    v_sub := v_sub + round(v_price, 2) * v_qty;
  end loop;

  v_disc := round(coalesce((p->>'discount')::numeric, 0), 2);
  v_charge := case when v_fulfil = 'delivery' then round(coalesce((p->>'delivery_charge')::numeric, 0), 2) else 0 end;
  v_paid := round(coalesce((p->>'paid_amount')::numeric, 0), 2);
  if v_disc < 0 or v_disc > v_sub then raise exception 'The discount cannot be more than the items total'; end if;
  if v_charge < 0 then raise exception 'The delivery charge cannot be negative'; end if;
  if v_paid < 0 or v_paid > v_sub - v_disc + v_charge then raise exception 'The amount paid cannot be more than the total'; end if;

  insert into stall_orders (event_date, stall_location, customer_name, customer_phone, fulfilment, delivery_address, delivery_charge,
    subtotal, discount, total, paid_amount, payment_method, due_date, note, created_by)
  values (
    coalesce((p->>'event_date')::date, (now() at time zone 'Asia/Dhaka')::date),
    left(trim(coalesce(p->>'stall_location', '')), 120),
    left(trim(p->>'customer_name'), 120),
    left(trim(p->>'customer_phone'), 20),
    v_fulfil,
    case when v_fulfil = 'delivery' then nullif(left(trim(coalesce(p->>'delivery_address', '')), 300), '') end,
    v_charge, v_sub, v_disc, v_sub - v_disc + v_charge, v_paid,
    nullif(left(trim(coalesce(p->>'payment_method', '')), 40), ''),
    nullif(p->>'due_date', '')::date,
    nullif(left(trim(coalesce(p->>'note', '')), 500), ''),
    auth.uid()
  ) returning * into o;

  insert into stall_order_items (order_id, name, details, quantity, unit_price, line_total)
  select o.id, left(trim(e->>'name'), 200), nullif(left(trim(coalesce(e->>'details', '')), 500), ''),
         (e->>'quantity')::int, round((e->>'unit_price')::numeric, 2), round((e->>'unit_price')::numeric, 2) * (e->>'quantity')::int
  from jsonb_array_elements(p->'items') e;

  if p_send_to_print then
    insert into print_jobs (stall_order_id, order_number, title, details, quantity)
    select o.id, o.order_number, i.name, i.details, i.quantity from stall_order_items i where i.order_id = o.id;
  end if;

  return jsonb_build_object('id', o.id, 'order_number', o.order_number);
end $$;

create or replace function stall_set_status(p_order uuid, p_status stall_order_status)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not is_admin() then raise exception 'forbidden'; end if;
  update stall_orders set status = p_status,
    delivered_at = case when p_status = 'delivered' then coalesce(delivered_at, now()) else null end
  where id = p_order;
  if not found then raise exception 'Order not found'; end if;
  -- A cancelled order stops the print jobs that are not printed yet.
  if p_status = 'cancelled' then
    update print_jobs set status = 'cancelled' where stall_order_id = p_order and status in ('to_print', 'printing') and not paid;
  end if;
end $$;

-- Add money the customer paid (or a negative amount to correct a mistake).
create or replace function stall_record_payment(p_order uuid, p_amount numeric, p_method text default null)
returns numeric language plpgsql security definer set search_path = public as $$
declare o stall_orders; v_new numeric;
begin
  if not is_admin() then raise exception 'forbidden'; end if;
  select * into o from stall_orders where id = p_order for update;
  if not found then raise exception 'Order not found'; end if;
  v_new := o.paid_amount + round(coalesce(p_amount, 0), 2);
  if v_new < 0 then raise exception 'The amount paid cannot go below zero'; end if;
  if v_new > o.total then raise exception 'That is more than the customer still has to pay'; end if;
  update stall_orders set paid_amount = v_new,
    payment_method = coalesce(nullif(left(trim(coalesce(p_method, '')), 40), ''), payment_method)
  where id = p_order;
  return v_new;
end $$;

-- Numbers for the stall dashboard. Cancelled orders are not counted as sales.
create or replace function stall_summary(p_from date default null, p_to date default null)
returns jsonb language plpgsql stable security definer set search_path = public as $$
begin
  if not is_admin() then raise exception 'forbidden'; end if;
  return jsonb_build_object(
    'totals', (select jsonb_build_object(
        'orders', count(*) filter (where status <> 'cancelled'),
        'revenue', coalesce(sum(total) filter (where status <> 'cancelled'), 0),
        'collected', coalesce(sum(paid_amount) filter (where status <> 'cancelled'), 0),
        'due', coalesce(sum(total - paid_amount) filter (where status <> 'cancelled'), 0),
        'open', count(*) filter (where status in ('new', 'printing', 'ready')),
        'delivered', count(*) filter (where status = 'delivered'),
        'cancelled', count(*) filter (where status = 'cancelled'))
      from stall_orders where (p_from is null or event_date >= p_from) and (p_to is null or event_date <= p_to)),
    'print_cost', (select coalesce(sum(j.unit_cost * j.quantity), 0) from print_jobs j join stall_orders o on o.id = j.stall_order_id
      where o.status <> 'cancelled' and j.status <> 'cancelled' and (p_from is null or o.event_date >= p_from) and (p_to is null or o.event_date <= p_to)),
    'by_status', (select coalesce(jsonb_object_agg(status, c), '{}') from (
        select status, count(*) c from stall_orders
        where (p_from is null or event_date >= p_from) and (p_to is null or event_date <= p_to) group by 1) x),
    'by_date', (select coalesce(jsonb_agg(jsonb_build_object('date', event_date, 'location', loc, 'orders', c, 'revenue', rev, 'collected', paid) order by event_date desc), '[]') from (
        select event_date, max(stall_location) loc, count(*) c, sum(total) rev, sum(paid_amount) paid from stall_orders
        where status <> 'cancelled' and (p_from is null or event_date >= p_from) and (p_to is null or event_date <= p_to) group by 1) x),
    'top_items', (select coalesce(jsonb_agg(jsonb_build_object('name', name, 'quantity', q, 'revenue', rev) order by rev desc), '[]') from (
        select max(i.name) name, sum(i.quantity) q, sum(i.line_total) rev from stall_order_items i join stall_orders o on o.id = i.order_id
        where o.status <> 'cancelled' and (p_from is null or o.event_date >= p_from) and (p_to is null or o.event_date <= p_to)
        group by lower(trim(i.name)) order by 3 desc limit 8) x)
  );
end $$;

-- Lets a customer check a stall order with its number and the phone number they gave.
create or replace function track_stall_order(p_order_number text, p_phone text)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare o stall_orders; v_digits text := right(regexp_replace(coalesce(p_phone, ''), '\D', '', 'g'), 10);
begin
  if length(v_digits) < 10 then return null; end if;
  select * into o from stall_orders
   where upper(order_number) = upper(trim(p_order_number))
     and right(regexp_replace(customer_phone, '\D', '', 'g'), 10) = v_digits;
  if not found then return null; end if;
  return jsonb_build_object(
    'order_number', o.order_number, 'status', o.status, 'customer_name', o.customer_name, 'fulfilment', o.fulfilment,
    'subtotal', o.subtotal, 'discount', o.discount, 'delivery_charge', o.delivery_charge, 'total', o.total, 'paid_amount', o.paid_amount,
    'due_date', o.due_date, 'created_at', o.created_at, 'delivered_at', o.delivered_at,
    'items', (select coalesce(jsonb_agg(jsonb_build_object('name', name, 'details', details, 'quantity', quantity, 'line_total', line_total)), '[]')
              from stall_order_items where order_id = o.id)
  );
end $$;

revoke execute on function stall_create_order(jsonb, boolean) from public, anon;
revoke execute on function stall_set_status(uuid, stall_order_status) from public, anon;
revoke execute on function stall_record_payment(uuid, numeric, text) from public, anon;
revoke execute on function stall_summary(date, date) from public, anon;
grant execute on function stall_create_order(jsonb, boolean) to authenticated;
grant execute on function stall_set_status(uuid, stall_order_status) to authenticated;
grant execute on function stall_record_payment(uuid, numeric, text) to authenticated;
grant execute on function stall_summary(date, date) to authenticated;
grant execute on function track_stall_order(text, text) to anon, authenticated;
