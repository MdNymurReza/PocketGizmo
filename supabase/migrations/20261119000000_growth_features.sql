-- Deals, pre-orders and back-in-stock alerts, gift options, occasion collections,
-- loyalty points, SMS log and courier booking.

------------------------------------------------------------------ settings
alter table settings
  add column if not exists gift_enabled boolean not null default true,
  add column if not exists gift_wrap_fee numeric(10,2) not null default 30 check (gift_wrap_fee >= 0),
  add column if not exists sms_enabled boolean not null default false,
  add column if not exists sms_events text[] not null default '{placed,confirmed,shipped,delivered,cancelled,back_in_stock}',
  add column if not exists whatsapp_number text,
  add column if not exists messenger_url text,
  add column if not exists points_enabled boolean not null default true,
  add column if not exists points_spend_per_point numeric(10,2) not null default 100 check (points_spend_per_point > 0),
  add column if not exists points_review integer not null default 20 check (points_review >= 0),
  add column if not exists points_max_pct integer not null default 20 check (points_max_pct between 0 and 100);

------------------------------------------------------------------ products / orders
alter table products
  add column if not exists preorder_enabled boolean not null default false,
  add column if not exists preorder_note text;

alter table orders
  add column if not exists deal_id uuid,
  add column if not exists deal_name text,
  add column if not exists deal_discount numeric(10,2) not null default 0,
  add column if not exists gift_wrap boolean not null default false,
  add column if not exists gift_message text,
  add column if not exists gift_hide_prices boolean not null default false,
  add column if not exists gift_fee numeric(10,2) not null default 0,
  add column if not exists points_used integer not null default 0,
  add column if not exists points_discount numeric(10,2) not null default 0,
  add column if not exists consignment_id text;

alter table order_items add column if not exists preorder_qty integer not null default 0 check (preorder_qty >= 0);

------------------------------------------------------------------ deals
do $$ begin
  create type deal_kind as enum ('buy_x_get_y', 'n_for_price');
exception when duplicate_object then null; end $$;

create table if not exists deals (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(trim(name)) between 1 and 80),
  kind deal_kind not null,
  buy_qty integer check (buy_qty between 1 and 20),
  get_qty integer check (get_qty between 1 and 20),
  bundle_qty integer check (bundle_qty between 2 and 20),
  bundle_price numeric(10,2) check (bundle_price >= 0),
  category_id uuid references categories(id) on delete cascade,
  product_ids uuid[] not null default '{}',
  starts_at timestamptz,
  ends_at timestamptz,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  check (kind <> 'buy_x_get_y' or (buy_qty is not null and get_qty is not null)),
  check (kind <> 'n_for_price' or (bundle_qty is not null and bundle_price is not null))
);
alter table deals enable row level security;
drop policy if exists "deals read" on deals;
create policy "deals read" on deals for select using (active or is_admin());
drop policy if exists "deals admin" on deals;
create policy "deals admin" on deals for all using (is_admin()) with check (is_admin());

alter table orders drop constraint if exists orders_deal_id_fkey;
alter table orders add constraint orders_deal_id_fkey foreign key (deal_id) references deals(id) on delete set null;

/** The single best deal for these items, and how much it takes off. */
create or replace function compute_deal_discount(p_items jsonb)
returns table (deal_id uuid, deal_name text, discount numeric)
language plpgsql stable security definer set search_path = public as $$
declare d deals; prices numeric[]; n int; g int; k int; i int; disc numeric; grp numeric;
  best_id uuid; best_name text; best numeric := 0;
begin
  for d in select * from deals
    where active and (starts_at is null or starts_at <= now()) and (ends_at is null or ends_at > now())
  loop
    select coalesce(array_agg(s.price order by s.price desc), '{}') into prices from (
      select pv.price from jsonb_to_recordset(coalesce(p_items, '[]')) as x(variant_id uuid, quantity int)
      join product_variants pv on pv.id = x.variant_id
      join products p on p.id = pv.product_id
      cross join generate_series(1, least(greatest(coalesce(x.quantity, 0), 0), 99))
      where pv.is_active and p.is_active
        and (case when cardinality(d.product_ids) > 0 then p.id = any(d.product_ids)
                  when d.category_id is not null then p.category_id = d.category_id
                  else true end)
    ) s;
    n := coalesce(array_length(prices, 1), 0);
    disc := 0;
    if d.kind = 'buy_x_get_y' then
      g := d.buy_qty + d.get_qty;
      -- Sorted from dearest to cheapest; in each full group the cheapest get_qty items are free.
      for k in 0 .. (n / g) - 1 loop
        for i in (k * g + d.buy_qty + 1) .. (k * g + g) loop
          disc := disc + prices[i];
        end loop;
      end loop;
    else
      for k in 0 .. (n / d.bundle_qty) - 1 loop
        grp := 0;
        for i in (k * d.bundle_qty + 1) .. (k * d.bundle_qty + d.bundle_qty) loop
          grp := grp + prices[i];
        end loop;
        disc := disc + greatest(grp - d.bundle_price, 0);
      end loop;
    end if;
    if disc > best then best := disc; best_id := d.id; best_name := d.name; end if;
  end loop;
  return query select best_id, best_name, round(best, 2);
end $$;

------------------------------------------------------------------ collections
create table if not exists collections (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  title text not null check (length(trim(title)) between 1 and 80),
  subtitle text,
  banner_image text,
  coupon_code text,
  starts_at timestamptz,
  ends_at timestamptz,
  is_active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);
create table if not exists collection_products (
  collection_id uuid not null references collections(id) on delete cascade,
  product_id uuid not null references products(id) on delete cascade,
  sort_order integer not null default 0,
  primary key (collection_id, product_id)
);
alter table collections enable row level security;
alter table collection_products enable row level security;
drop policy if exists "collections read" on collections;
create policy "collections read" on collections for select using (is_active or is_admin());
drop policy if exists "collections admin" on collections;
create policy "collections admin" on collections for all using (is_admin()) with check (is_admin());
drop policy if exists "collection products read" on collection_products;
create policy "collection products read" on collection_products for select using (true);
drop policy if exists "collection products admin" on collection_products;
create policy "collection products admin" on collection_products for all using (is_admin()) with check (is_admin());

------------------------------------------------------------------ back-in-stock alerts
create table if not exists stock_alerts (
  id uuid primary key default gen_random_uuid(),
  variant_id uuid not null references product_variants(id) on delete cascade,
  phone text not null,
  user_id uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  notified_at timestamptz
);
create unique index if not exists stock_alerts_waiting_uniq on stock_alerts (variant_id, phone) where notified_at is null;
create index if not exists stock_alerts_waiting_idx on stock_alerts (variant_id) where notified_at is null;
alter table stock_alerts enable row level security;
drop policy if exists "stock alerts admin" on stock_alerts;
create policy "stock alerts admin" on stock_alerts for all using (is_admin()) with check (is_admin());

/** Anyone can ask to be told by SMS when an out-of-stock item is back. */
create or replace function request_stock_alert(p_variant uuid, p_phone text)
returns void language plpgsql security definer set search_path = public as $$
declare v_phone text := right(regexp_replace(coalesce(p_phone, ''), '\D', '', 'g'), 11);
begin
  if v_phone !~ '^01[3-9][0-9]{8}$' then raise exception 'Enter a valid mobile number (01XXXXXXXXX)'; end if;
  if not exists (select 1 from product_variants pv join products p on p.id = pv.product_id
                 where pv.id = p_variant and pv.is_active and p.is_active) then
    raise exception 'This item is not available';
  end if;
  if (select count(*) from stock_alerts where phone = v_phone and notified_at is null) >= 20 then
    raise exception 'You are already waiting for many items';
  end if;
  insert into stock_alerts (variant_id, phone, user_id) values (p_variant, v_phone, auth.uid())
  on conflict (variant_id, phone) where notified_at is null do nothing;
end $$;

------------------------------------------------------------------ loyalty points
create table if not exists points_ledger (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  delta integer not null,
  reason text not null check (reason in ('earn', 'earn_reversed', 'redeem', 'redeem_refund', 'review', 'adjust')),
  order_id uuid references orders(id) on delete set null,
  review_id uuid references reviews(id) on delete set null,
  note text,
  created_at timestamptz not null default now()
);
create unique index if not exists points_order_reason_uniq on points_ledger (order_id, reason) where order_id is not null;
create unique index if not exists points_review_uniq on points_ledger (review_id) where review_id is not null;
create index if not exists points_user_idx on points_ledger (user_id, created_at desc);
alter table points_ledger enable row level security;
drop policy if exists "points own read" on points_ledger;
create policy "points own read" on points_ledger for select using (user_id = auth.uid() or is_admin());
drop policy if exists "points admin" on points_ledger;
create policy "points admin" on points_ledger for all using (is_admin()) with check (is_admin());

create or replace function points_balance(p_user uuid)
returns integer language sql stable security definer set search_path = public as $$
  select coalesce(sum(delta), 0)::int from points_ledger where user_id = p_user
    and (p_user = auth.uid() or is_admin());
$$;

-- Points come and go with the order: earned on delivery, given back on cancellation.
create or replace function orders_points_trigger()
returns trigger language plpgsql security definer set search_path = public as $$
declare s settings; earned int;
begin
  if new.user_id is null or new.status = old.status then return new; end if;
  select * into s from settings where id = 1;
  if new.status = 'delivered' and s.points_enabled then
    earned := floor(greatest(new.subtotal - new.deal_discount - new.discount - new.points_discount, 0) / s.points_spend_per_point);
    if earned > 0 then
      insert into points_ledger (user_id, delta, reason, order_id, note)
      values (new.user_id, earned, 'earn', new.id, 'Order ' || new.order_number)
      on conflict (order_id, reason) where order_id is not null do nothing;
    end if;
  elsif new.status = 'cancelled' then
    if new.points_used > 0 then
      insert into points_ledger (user_id, delta, reason, order_id, note)
      values (new.user_id, new.points_used, 'redeem_refund', new.id, 'Order ' || new.order_number || ' cancelled')
      on conflict (order_id, reason) where order_id is not null do nothing;
    end if;
    select delta into earned from points_ledger where order_id = new.id and reason = 'earn';
    if earned is not null then
      insert into points_ledger (user_id, delta, reason, order_id, note)
      values (new.user_id, -earned, 'earn_reversed', new.id, 'Order ' || new.order_number || ' cancelled')
      on conflict (order_id, reason) where order_id is not null do nothing;
    end if;
  end if;
  return new;
end $$;
drop trigger if exists orders_points on orders;
create trigger orders_points after update of status on orders for each row execute function orders_points_trigger();

create or replace function reviews_points_trigger()
returns trigger language plpgsql security definer set search_path = public as $$
declare s settings;
begin
  if new.status <> 'approved' or new.user_id is null then return new; end if;
  if tg_op = 'UPDATE' and old.status = 'approved' then return new; end if;
  select * into s from settings where id = 1;
  if not s.points_enabled or s.points_review <= 0 then return new; end if;
  insert into points_ledger (user_id, delta, reason, review_id, note)
  values (new.user_id, s.points_review, 'review', new.id, 'Review approved')
  on conflict (review_id) where review_id is not null do nothing;
  return new;
end $$;
drop trigger if exists reviews_points on reviews;
create trigger reviews_points after insert or update of status on reviews for each row execute function reviews_points_trigger();

------------------------------------------------------------------ SMS log
create table if not exists sms_log (
  id uuid primary key default gen_random_uuid(),
  phone text not null,
  event text not null,
  order_id uuid references orders(id) on delete set null,
  message text not null,
  ok boolean not null,
  error text,
  created_at timestamptz not null default now()
);
create index if not exists sms_log_created_idx on sms_log (created_at desc);
alter table sms_log enable row level security;
drop policy if exists "sms log admin" on sms_log;
create policy "sms log admin" on sms_log for all using (is_admin()) with check (is_admin());

/** Lets the checkout record the "order placed" SMS; only someone holding the order's tracking token can. */
create or replace function log_order_sms(p_token uuid, p_phone text, p_message text, p_ok boolean, p_error text)
returns void language plpgsql security definer set search_path = public as $$
declare v_id uuid;
begin
  select id into v_id from orders where tracking_token = p_token and created_at > now() - interval '10 minutes';
  if v_id is null then return; end if;
  if exists (select 1 from sms_log where order_id = v_id and event = 'placed') then return; end if;
  insert into sms_log (phone, event, order_id, message, ok, error)
  values (left(p_phone, 20), 'placed', v_id, left(p_message, 500), p_ok, left(p_error, 300));
end $$;

------------------------------------------------------------------ pricing
/** Everything the cart and checkout show, priced the same way place_order charges it. */
create or replace function quote_order(p_items jsonb, p_coupon_code text, p_zone shipping_zone, p_points integer, p_gift boolean)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare s settings; it jsonb; v record; v_sub numeric := 0; v_deal_id uuid; v_deal_name text; v_deal numeric := 0;
  v_coupon uuid; v_disc numeric := 0; v_coupon_err text; v_ship numeric; v_gift numeric := 0;
  v_balance int := 0; v_max_points int := 0; v_points int := 0; v_qty int;
begin
  select * into s from settings where id = 1;
  for it in select * from jsonb_array_elements(coalesce(p_items, '[]')) loop
    v_qty := least(greatest(coalesce((it->>'quantity')::int, 0), 0), 99);
    select pv.price into v from product_variants pv join products p on p.id = pv.product_id
      where pv.id = (it->>'variant_id')::uuid and pv.is_active and p.is_active;
    if found then v_sub := v_sub + v.price * v_qty; end if;
  end loop;

  select d.deal_id, d.deal_name, d.discount into v_deal_id, v_deal_name, v_deal from compute_deal_discount(p_items) d;
  v_deal := least(coalesce(v_deal, 0), v_sub);

  if coalesce(trim(p_coupon_code), '') <> '' then
    select c.coupon_id, c.discount, c.error into v_coupon, v_disc, v_coupon_err
      from compute_coupon_discount(p_coupon_code, v_sub - v_deal, auth.uid()) c;
    v_disc := coalesce(v_disc, 0);
  end if;

  v_ship := case when p_zone = 'inside_dhaka' then s.shipping_inside_dhaka else s.shipping_outside_dhaka end;
  if s.free_shipping_over is not null and v_sub - v_deal - v_disc >= s.free_shipping_over then v_ship := 0; end if;
  if coalesce(p_gift, false) and s.gift_enabled then v_gift := s.gift_wrap_fee; end if;

  if auth.uid() is not null and s.points_enabled then
    v_balance := points_balance(auth.uid());
    v_max_points := greatest(least(v_balance, floor((v_sub - v_deal - v_disc) * s.points_max_pct / 100)::int), 0);
    v_points := least(greatest(coalesce(p_points, 0), 0), v_max_points);
  end if;

  return jsonb_build_object(
    'subtotal', v_sub, 'deal_name', v_deal_name, 'deal_discount', v_deal,
    'coupon_discount', v_disc, 'coupon_error', v_coupon_err,
    'shipping', v_ship, 'gift_fee', v_gift,
    'points_balance', v_balance, 'points_max', v_max_points, 'points_used', v_points,
    'total', v_sub - v_deal - v_disc - v_points + v_ship + v_gift,
    'earn_points', case when s.points_enabled then floor(greatest(v_sub - v_deal - v_disc - v_points, 0) / s.points_spend_per_point)::int else 0 end);
end $$;

------------------------------------------------------------------ place_order
drop function if exists place_order(jsonb, text, text, text, text, text, text, shipping_zone, text, text, payment_method, text, text, payment_method);

create or replace function place_order(
  p_items jsonb, p_customer_name text, p_customer_phone text, p_customer_email text,
  p_district text, p_area text, p_line text, p_zone shipping_zone, p_note text, p_coupon_code text,
  p_payment_method payment_method, p_sender_number text, p_trx_id text,
  p_advance_method payment_method default null,
  p_points integer default 0, p_gift_wrap boolean default false, p_gift_message text default null,
  p_gift_hide_prices boolean default false)
returns table (order_number text, tracking_token uuid)
language plpgsql security definer set search_path = public as $$
declare
  it jsonb; v record; s settings;
  v_sub numeric := 0; v_disc numeric := 0; v_ship numeric; v_coupon uuid; v_err text;
  v_deal_id uuid; v_deal_name text; v_deal numeric := 0; v_gift numeric := 0;
  v_points int := 0; v_balance int; v_max_points int;
  v_order orders; v_qty int; v_pre int; v_advance boolean; v_wallet payment_method; v_gift_on boolean;
begin
  if jsonb_array_length(coalesce(p_items, '[]')) = 0 then raise exception 'Cart is empty'; end if;
  if length(trim(coalesce(p_customer_name,''))) = 0 or length(trim(coalesce(p_customer_phone,''))) = 0 then
    raise exception 'Name and phone are required';
  end if;
  if exists (select 1 from blocked_phones where phone = phone_key(p_customer_phone)) then
    raise exception 'We can''t accept online orders from this number. Please contact us to order.';
  end if;

  select * into s from settings where id = 1;

  -- lock variants & compute subtotal; pre-order products may be ordered beyond stock
  for it in select * from jsonb_array_elements(p_items) loop
    v_qty := (it->>'quantity')::int;
    if v_qty is null or v_qty < 1 or v_qty > 99 then raise exception 'Invalid quantity'; end if;
    select pv.id, pv.price, pv.stock, pv.is_active, p.name, p.is_active as p_active, p.preorder_enabled
      into v from product_variants pv join products p on p.id = pv.product_id
      where pv.id = (it->>'variant_id')::uuid for update of pv;
    if not found or not v.is_active or not v.p_active then raise exception 'A product in your cart is no longer available'; end if;
    if v.stock < v_qty and not v.preorder_enabled then raise exception 'Only % left of %', v.stock, v.name; end if;
    v_sub := v_sub + v.price * v_qty;
  end loop;

  select d.deal_id, d.deal_name, d.discount into v_deal_id, v_deal_name, v_deal from compute_deal_discount(p_items) d;
  v_deal := least(coalesce(v_deal, 0), v_sub);
  if v_deal = 0 then v_deal_id := null; v_deal_name := null; end if;

  if coalesce(trim(p_coupon_code),'') <> '' then
    select c.coupon_id, c.discount, c.error into v_coupon, v_disc, v_err
      from compute_coupon_discount(p_coupon_code, v_sub - v_deal, auth.uid()) c;
    if v_err is not null then raise exception '%', v_err; end if;
    update coupons set used_count = used_count + 1 where id = v_coupon;
  end if;

  v_ship := case when p_zone = 'inside_dhaka' then s.shipping_inside_dhaka else s.shipping_outside_dhaka end;
  if s.free_shipping_over is not null and v_sub - v_deal - v_disc >= s.free_shipping_over then v_ship := 0; end if;

  v_gift_on := coalesce(p_gift_wrap, false) and s.gift_enabled;
  if v_gift_on then v_gift := s.gift_wrap_fee; end if;

  -- Loyalty points: only for logged-in customers, capped by balance and by points_max_pct of the order.
  if coalesce(p_points, 0) > 0 then
    if auth.uid() is null then raise exception 'Log in to use your points'; end if;
    if not s.points_enabled then raise exception 'Points can''t be used right now'; end if;
    perform 1 from profiles where id = auth.uid() for update;
    v_balance := points_balance(auth.uid());
    v_max_points := greatest(least(v_balance, floor((v_sub - v_deal - v_disc) * s.points_max_pct / 100)::int), 0);
    if p_points > v_max_points then raise exception 'You can use up to % points on this order', v_max_points; end if;
    v_points := p_points;
  end if;

  -- Cash on delivery may require the delivery charge to be paid in advance.
  v_advance := p_payment_method = 'cod' and v_ship > 0
    and (s.cod_advance = 'all' or (s.cod_advance = 'outside_dhaka' and p_zone = 'outside_dhaka'));

  if p_payment_method <> 'cod' then
    v_wallet := p_payment_method;
  elsif v_advance then
    if p_advance_method is null or p_advance_method = 'cod' then
      raise exception 'Please pay the delivery charge in advance with bKash, Nagad or Rocket';
    end if;
    v_wallet := p_advance_method;
  end if;

  if v_wallet is not null and (coalesce(trim(p_trx_id),'') = '' or coalesce(trim(p_sender_number),'') = '') then
    raise exception 'Sender number and Transaction ID are required';
  end if;

  insert into orders (user_id, customer_name, customer_phone, customer_email, ship_district, ship_area, ship_line,
    ship_zone, note, subtotal, discount, shipping_fee, total, coupon_id, coupon_code, payment_method,
    payment_status, sender_number, trx_id, advance_amount, advance_method, advance_status,
    deal_id, deal_name, deal_discount, gift_wrap, gift_message, gift_hide_prices, gift_fee, points_used, points_discount)
  values (auth.uid(), trim(p_customer_name), trim(p_customer_phone), nullif(trim(p_customer_email),''),
    p_district, p_area, p_line, p_zone, nullif(trim(p_note),''), v_sub, v_disc, v_ship,
    v_sub - v_deal - v_disc - v_points + v_ship + v_gift,
    v_coupon, case when v_coupon is null then null else upper(trim(p_coupon_code)) end, p_payment_method,
    case when p_payment_method = 'cod' then 'unpaid'::payment_status else 'pending_verification'::payment_status end,
    case when v_wallet is null then null else nullif(trim(p_sender_number),'') end,
    case when v_wallet is null then null else nullif(upper(trim(p_trx_id)),'') end,
    case when v_advance then v_ship else 0 end,
    case when v_advance then p_advance_method else null end,
    case when v_advance then 'pending' else 'none' end,
    v_deal_id, v_deal_name, v_deal, v_gift_on,
    case when v_gift_on then nullif(left(trim(coalesce(p_gift_message, '')), 200), '') end,
    v_gift_on and coalesce(p_gift_hide_prices, false), v_gift, v_points, v_points)
  returning * into v_order;

  if v_points > 0 then
    insert into points_ledger (user_id, delta, reason, order_id, note)
    values (auth.uid(), -v_points, 'redeem', v_order.id, 'Used on order ' || v_order.order_number);
  end if;

  for it in select * from jsonb_array_elements(p_items) loop
    v_qty := (it->>'quantity')::int;
    select greatest(v_qty - greatest(pv.stock, 0), 0) into v_pre from product_variants pv where pv.id = (it->>'variant_id')::uuid;
    insert into order_items (order_id, product_id, variant_id, product_name, variant_options, image, unit_price, quantity, line_total, details, preorder_qty)
    select v_order.id, p.id, pv.id, p.name, pv.options, p.images[1], pv.price, v_qty, pv.price * v_qty,
      nullif(left(trim(coalesce(it->>'details','')), 300), ''), v_pre
      from product_variants pv join products p on p.id = pv.product_id where pv.id = (it->>'variant_id')::uuid;
    if v_qty - v_pre > 0 then
      update product_variants set stock = stock - (v_qty - v_pre) where id = (it->>'variant_id')::uuid;
      insert into inventory_movements (variant_id, delta, reason, order_id)
        values ((it->>'variant_id')::uuid, -(v_qty - v_pre), 'order', v_order.id);
    end if;
  end loop;

  insert into order_status_history (order_id, status, note) values (v_order.id, 'pending', 'Order placed');
  return query select v_order.order_number, v_order.tracking_token;
exception when unique_violation then
  raise exception 'This Transaction ID has already been used';
end $$;

grant execute on function place_order(jsonb, text, text, text, text, text, text, shipping_zone, text, text, payment_method, text, text, payment_method, integer, boolean, text, boolean) to anon, authenticated;

------------------------------------------------------------------ cancellation restocks only what came out of stock
create or replace function admin_set_order_status(p_order uuid, p_status order_status, p_note text)
returns void language plpgsql security definer set search_path = public as $$
declare o orders; r record;
begin
  if not is_admin() then raise exception 'forbidden'; end if;
  select * into o from orders where id = p_order for update;
  if not found then raise exception 'Order not found'; end if;
  if o.status = p_status then return; end if;
  if o.status = 'cancelled' then raise exception 'Cancelled orders cannot be changed'; end if;

  if p_status = 'cancelled' then
    for r in select variant_id, quantity - preorder_qty as q from order_items
             where order_id = p_order and variant_id is not null and quantity - preorder_qty > 0 loop
      update product_variants set stock = stock + r.q where id = r.variant_id;
      insert into inventory_movements (variant_id, delta, reason, order_id, created_by)
        values (r.variant_id, r.q, 'cancel', p_order, auth.uid());
    end loop;
    if o.coupon_id is not null then
      update coupons set used_count = greatest(used_count - 1, 0) where id = o.coupon_id;
    end if;
  end if;

  update orders set status = p_status where id = p_order;
  insert into order_status_history (order_id, status, note) values (p_order, p_status, nullif(trim(p_note),''));
end $$;

------------------------------------------------------------------ tracking shows the new lines
create or replace function track_order(p_order_number text, p_phone text, p_token uuid)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare o orders;
begin
  select * into o from orders
   where upper(order_number) = upper(trim(p_order_number))
     and ((p_token is not null and tracking_token = p_token)
       or (p_phone is not null and length(regexp_replace(p_phone,'\D','','g')) >= 10
           and phone_key(customer_phone) = phone_key(p_phone)));
  if not found then return null; end if;
  return jsonb_build_object(
    'order_number', o.order_number, 'status', o.status, 'payment_method', o.payment_method,
    'payment_status', o.payment_status, 'subtotal', o.subtotal, 'discount', o.discount,
    'shipping_fee', o.shipping_fee, 'total', o.total, 'courier', o.courier, 'tracking_code', o.tracking_code,
    'customer_name', o.customer_name, 'ship_area', o.ship_area, 'ship_district', o.ship_district,
    'created_at', o.created_at,
    'advance_amount', o.advance_amount, 'advance_method', o.advance_method, 'advance_status', o.advance_status,
    'deal_name', o.deal_name, 'deal_discount', o.deal_discount, 'coupon_code', o.coupon_code,
    'gift_wrap', o.gift_wrap, 'gift_message', o.gift_message, 'gift_fee', o.gift_fee,
    'points_used', o.points_used, 'points_discount', o.points_discount,
    'items', (select coalesce(jsonb_agg(jsonb_build_object('name', product_name, 'options', variant_options,
        'image', image, 'unit_price', unit_price, 'quantity', quantity, 'line_total', line_total, 'details', details,
        'preorder_qty', preorder_qty)), '[]')
      from order_items where order_id = o.id),
    'history', (select coalesce(jsonb_agg(jsonb_build_object('status', status, 'note', note, 'created_at', created_at)
        order by created_at), '[]') from order_status_history where order_id = o.id));
end $$;

------------------------------------------------------------------ reports count every discount
create or replace function admin_profit_summary(p_from timestamptz, p_to timestamptz)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare r jsonb;
begin
  if not is_admin() then raise exception 'forbidden'; end if;
  with o as (
    select id, subtotal - discount - deal_discount - points_discount + gift_fee as net
    from orders where created_at between p_from and p_to and status <> 'cancelled'
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

create or replace function sales_summary(p_from timestamptz, p_to timestamptz)
returns jsonb language plpgsql stable security definer set search_path = public as $$
begin
  if not is_admin() then raise exception 'forbidden'; end if;
  return jsonb_build_object(
    'totals', (select jsonb_build_object(
        'revenue', coalesce(sum(total),0), 'orders', count(*),
        'aov', coalesce(round(avg(total),2),0),
        'discounts', coalesce(sum(discount + deal_discount + points_discount),0),
        'items', coalesce((select sum(quantity) from order_items oi join orders o2 on o2.id = oi.order_id
           where o2.created_at between p_from and p_to and o2.status <> 'cancelled'),0))
      from orders where created_at between p_from and p_to and status <> 'cancelled'),
    'cancelled', (select count(*) from orders where created_at between p_from and p_to and status = 'cancelled'),
    'daily', (select coalesce(jsonb_agg(jsonb_build_object('day', d, 'revenue', rev, 'orders', cnt) order by d), '[]') from (
        select date_trunc('day', created_at at time zone 'Asia/Dhaka')::date d, sum(total) rev, count(*) cnt
        from orders where created_at between p_from and p_to and status <> 'cancelled' group by 1) x),
    'by_payment', (select coalesce(jsonb_agg(jsonb_build_object('method', payment_method, 'revenue', rev, 'orders', cnt)), '[]') from (
        select payment_method, sum(total) rev, count(*) cnt from orders
        where created_at between p_from and p_to and status <> 'cancelled' group by 1) x),
    'by_status', (select coalesce(jsonb_agg(jsonb_build_object('status', status, 'orders', cnt)), '[]') from (
        select status, count(*) cnt from orders where created_at between p_from and p_to group by 1) x),
    'top_products', (select coalesce(jsonb_agg(jsonb_build_object('name', product_name, 'quantity', q, 'revenue', rev) order by rev desc), '[]') from (
        select oi.product_name, sum(oi.quantity) q, sum(oi.line_total) rev from order_items oi join orders o on o.id = oi.order_id
        where o.created_at between p_from and p_to and o.status <> 'cancelled' group by 1 order by 3 desc limit 5) x),
    'pending_verification', (select count(*) from orders where (payment_status = 'pending_verification' or advance_status = 'pending') and status <> 'cancelled'),
    'low_stock', (select coalesce(jsonb_agg(jsonb_build_object('variant_id', pv.id, 'product', p.name, 'options', pv.options, 'stock', pv.stock) order by pv.stock), '[]')
        from product_variants pv join products p on p.id = pv.product_id
        where pv.is_active and p.is_active and pv.stock <= pv.low_stock_threshold)
  );
end $$;

------------------------------------------------------------------ grants
revoke execute on function compute_deal_discount(jsonb) from public;
grant execute on function compute_deal_discount(jsonb) to anon, authenticated;
grant execute on function quote_order(jsonb, text, shipping_zone, integer, boolean) to anon, authenticated;
grant execute on function request_stock_alert(uuid, text) to anon, authenticated;
grant execute on function log_order_sms(uuid, text, text, boolean, text) to anon, authenticated;
grant execute on function points_balance(uuid) to authenticated;
revoke execute on function orders_points_trigger() from public, anon, authenticated;
revoke execute on function reviews_points_trigger() from public, anon, authenticated;
