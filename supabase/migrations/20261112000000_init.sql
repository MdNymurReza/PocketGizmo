-- PocketGizmo initial schema
create extension if not exists pgcrypto;

-- ============ ENUMS ============
create type user_role as enum ('customer', 'admin');
create type payment_method as enum ('cod', 'bkash', 'nagad', 'rocket');
create type payment_status as enum ('unpaid', 'pending_verification', 'paid', 'rejected', 'refunded');
create type order_status as enum ('pending', 'confirmed', 'printing', 'shipped', 'delivered', 'cancelled');
create type coupon_type as enum ('percent', 'fixed');
create type inventory_reason as enum ('order', 'restock', 'adjust', 'cancel');
create type custom_request_status as enum ('new', 'quoted', 'accepted', 'rejected', 'done');
create type shipping_zone as enum ('inside_dhaka', 'outside_dhaka');

-- ============ PROFILES ============
create table profiles (
  id uuid primary key references auth.users on delete cascade,
  full_name text,
  phone text,
  role user_role not null default 'customer',
  created_at timestamptz not null default now()
);

create or replace function is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from profiles where id = auth.uid() and role = 'admin');
$$;

create or replace function handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into profiles (id, full_name, phone)
  values (new.id, new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'phone');
  return new;
end $$;

create trigger on_auth_user_created after insert on auth.users
  for each row execute function handle_new_user();

-- Prevent customers from promoting themselves
create or replace function protect_role() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.role <> old.role and not is_admin() then
    raise exception 'not allowed to change role';
  end if;
  return new;
end $$;
create trigger profiles_protect_role before update on profiles
  for each row execute function protect_role();

-- ============ ADDRESSES ============
create table addresses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users on delete cascade,
  name text not null,
  phone text not null,
  district text not null,
  area text not null,
  line text not null,
  zone shipping_zone not null default 'inside_dhaka',
  is_default boolean not null default false,
  created_at timestamptz not null default now()
);
create index on addresses (user_id);

-- ============ CATALOG ============
create table categories (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  image text,
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);

create table products (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  description text not null default '',
  category_id uuid references categories on delete set null,
  base_price numeric(10,2) not null check (base_price >= 0),
  compare_at_price numeric(10,2),
  images text[] not null default '{}',
  is_active boolean not null default true,
  featured boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index on products (category_id);
create index on products (is_active, featured);

create table product_variants (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references products on delete cascade,
  sku text unique,
  options jsonb not null default '{}',
  price numeric(10,2) not null check (price >= 0),
  stock int not null default 0 check (stock >= 0),
  low_stock_threshold int not null default 3,
  is_active boolean not null default true,
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);
create index on product_variants (product_id);

-- ============ COUPONS ============
create table coupons (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  type coupon_type not null,
  value numeric(10,2) not null check (value > 0),
  min_order numeric(10,2) not null default 0,
  max_discount numeric(10,2),
  usage_limit int,
  used_count int not null default 0,
  per_user_limit int,
  starts_at timestamptz,
  ends_at timestamptz,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

-- ============ SETTINGS (singleton) ============
create table settings (
  id int primary key default 1 check (id = 1),
  store_name text not null default 'PocketGizmo',
  shipping_inside_dhaka numeric(10,2) not null default 70,
  shipping_outside_dhaka numeric(10,2) not null default 130,
  free_shipping_over numeric(10,2),
  bkash_number text,
  nagad_number text,
  rocket_number text,
  payment_instructions text not null default 'Send Money to the number above, then enter your sender number and Transaction ID.',
  contact_phone text,
  contact_email text,
  facebook_url text,
  updated_at timestamptz not null default now()
);
insert into settings (id) values (1);

-- ============ ORDERS ============
create sequence order_number_seq start 10001;

create table orders (
  id uuid primary key default gen_random_uuid(),
  order_number text not null unique default ('PG-' || nextval('order_number_seq')),
  tracking_token uuid not null default gen_random_uuid(),
  user_id uuid references auth.users on delete set null,
  customer_name text not null,
  customer_phone text not null,
  customer_email text,
  ship_district text not null,
  ship_area text not null,
  ship_line text not null,
  ship_zone shipping_zone not null,
  note text,
  subtotal numeric(10,2) not null,
  discount numeric(10,2) not null default 0,
  shipping_fee numeric(10,2) not null,
  total numeric(10,2) not null,
  coupon_id uuid references coupons on delete set null,
  coupon_code text,
  payment_method payment_method not null,
  payment_status payment_status not null,
  sender_number text,
  trx_id text,
  status order_status not null default 'pending',
  courier text,
  tracking_code text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index on orders (user_id);
create index on orders (created_at);
create index on orders (status);
create index on orders (coupon_id);
create unique index orders_trx_unique on orders (payment_method, trx_id) where trx_id is not null;

create table order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references orders on delete cascade,
  product_id uuid references products on delete set null,
  variant_id uuid references product_variants on delete set null,
  product_name text not null,
  variant_options jsonb not null default '{}',
  image text,
  unit_price numeric(10,2) not null,
  quantity int not null check (quantity > 0),
  line_total numeric(10,2) not null
);
create index on order_items (order_id);
create index on order_items (variant_id);
create index on order_items (product_id);

create table order_status_history (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references orders on delete cascade,
  status order_status not null,
  note text,
  created_at timestamptz not null default now()
);
create index on order_status_history (order_id);

create table inventory_movements (
  id uuid primary key default gen_random_uuid(),
  variant_id uuid not null references product_variants on delete cascade,
  delta int not null,
  reason inventory_reason not null,
  order_id uuid references orders on delete set null,
  note text,
  created_by uuid references auth.users on delete set null,
  created_at timestamptz not null default now()
);
create index on inventory_movements (variant_id);
create index on inventory_movements (order_id);
create index on inventory_movements (created_by);

-- ============ CUSTOM REQUESTS ============
create table custom_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users on delete set null,
  name text not null,
  phone text not null,
  email text,
  description text not null,
  files text[] not null default '{}',
  color text,
  material text,
  quantity int not null default 1 check (quantity > 0),
  status custom_request_status not null default 'new',
  quoted_price numeric(10,2),
  admin_note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index on custom_requests (user_id);

-- ============ updated_at triggers ============
create or replace function touch_updated_at() returns trigger language plpgsql set search_path = public as $$
begin new.updated_at = now(); return new; end $$;
create trigger t_products before update on products for each row execute function touch_updated_at();
create trigger t_orders before update on orders for each row execute function touch_updated_at();
create trigger t_custom before update on custom_requests for each row execute function touch_updated_at();
create trigger t_settings before update on settings for each row execute function touch_updated_at();

-- ============ RLS ============
alter table profiles enable row level security;
alter table addresses enable row level security;
alter table categories enable row level security;
alter table products enable row level security;
alter table product_variants enable row level security;
alter table coupons enable row level security;
alter table settings enable row level security;
alter table orders enable row level security;
alter table order_items enable row level security;
alter table order_status_history enable row level security;
alter table inventory_movements enable row level security;
alter table custom_requests enable row level security;

create policy "own profile read" on profiles for select using (id = (select auth.uid()) or is_admin());
create policy "own profile update" on profiles for update using (id = (select auth.uid()) or is_admin());

create policy "own addresses" on addresses for all using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

create policy "public categories" on categories for select using (true);
create policy "admin categories insert" on categories for insert with check (is_admin());
create policy "admin categories update" on categories for update using (is_admin()) with check (is_admin());
create policy "admin categories delete" on categories for delete using (is_admin());

create policy "public products" on products for select using (is_active or is_admin());
create policy "admin products insert" on products for insert with check (is_admin());
create policy "admin products update" on products for update using (is_admin()) with check (is_admin());
create policy "admin products delete" on products for delete using (is_admin());

create policy "public variants" on product_variants for select using (true);
create policy "admin variants insert" on product_variants for insert with check (is_admin());
create policy "admin variants update" on product_variants for update using (is_admin()) with check (is_admin());
create policy "admin variants delete" on product_variants for delete using (is_admin());

create policy "admin coupons" on coupons for all using (is_admin()) with check (is_admin());

create policy "public settings" on settings for select using (true);
create policy "admin settings" on settings for update using (is_admin()) with check (is_admin());

-- Orders are created only via place_order(); customers read their own
create policy "own orders read" on orders for select using (user_id = (select auth.uid()) or is_admin());
create policy "admin orders update" on orders for update using (is_admin()) with check (is_admin());

create policy "own order items" on order_items for select using (
  is_admin() or exists (select 1 from orders o where o.id = order_id and o.user_id = (select auth.uid())));
create policy "own order history" on order_status_history for select using (
  is_admin() or exists (select 1 from orders o where o.id = order_id and o.user_id = (select auth.uid())));
create policy "admin order history" on order_status_history for insert with check (is_admin());

create policy "admin inventory" on inventory_movements for all using (is_admin()) with check (is_admin());

create policy "custom insert" on custom_requests for insert with check (user_id is null or user_id = (select auth.uid()));
create policy "custom read" on custom_requests for select using (user_id = (select auth.uid()) or is_admin());
create policy "custom admin update" on custom_requests for update using (is_admin()) with check (is_admin());

-- ============ COUPON VALIDATION ============
create or replace function compute_coupon_discount(p_code text, p_subtotal numeric, p_user uuid)
returns table (coupon_id uuid, discount numeric, error text)
language plpgsql stable security definer set search_path = public as $$
declare c coupons; d numeric; uses int;
begin
  select * into c from coupons where upper(code) = upper(trim(p_code));
  if not found or not c.active then
    return query select null::uuid, 0::numeric, 'Invalid coupon code'; return;
  end if;
  if c.starts_at is not null and now() < c.starts_at then
    return query select null::uuid, 0::numeric, 'This coupon is not active yet'; return;
  end if;
  if c.ends_at is not null and now() > c.ends_at then
    return query select null::uuid, 0::numeric, 'This coupon has expired'; return;
  end if;
  if c.usage_limit is not null and c.used_count >= c.usage_limit then
    return query select null::uuid, 0::numeric, 'This coupon has reached its usage limit'; return;
  end if;
  if p_subtotal < c.min_order then
    return query select null::uuid, 0::numeric, format('Minimum order ৳%s required', c.min_order); return;
  end if;
  if c.per_user_limit is not null and p_user is not null then
    select count(*) into uses from orders o where o.coupon_id = c.id and o.user_id = p_user and o.status <> 'cancelled';
    if uses >= c.per_user_limit then
      return query select null::uuid, 0::numeric, 'You have already used this coupon'; return;
    end if;
  end if;
  if c.type = 'percent' then d := round(p_subtotal * c.value / 100, 2);
  else d := c.value; end if;
  if c.max_discount is not null then d := least(d, c.max_discount); end if;
  d := least(d, p_subtotal);
  return query select c.id, d, null::text;
end $$;

-- Public preview for the checkout page (does not reveal coupon list)
create or replace function validate_coupon(p_code text, p_subtotal numeric)
returns table (discount numeric, error text)
language sql stable security definer set search_path = public as $$
  select discount, error from compute_coupon_discount(p_code, p_subtotal, auth.uid());
$$;

-- ============ PLACE ORDER ============
-- p_items: [{"variant_id": "...", "quantity": 2}, ...]
create or replace function place_order(
  p_items jsonb,
  p_customer_name text,
  p_customer_phone text,
  p_customer_email text,
  p_district text,
  p_area text,
  p_line text,
  p_zone shipping_zone,
  p_note text,
  p_coupon_code text,
  p_payment_method payment_method,
  p_sender_number text,
  p_trx_id text
) returns table (order_number text, tracking_token uuid)
language plpgsql security definer set search_path = public as $$
declare
  it jsonb; v record; s settings;
  v_sub numeric := 0; v_disc numeric := 0; v_ship numeric; v_coupon uuid; v_err text;
  v_order orders; v_qty int;
begin
  if jsonb_array_length(coalesce(p_items, '[]')) = 0 then raise exception 'Cart is empty'; end if;
  if length(trim(coalesce(p_customer_name,''))) = 0 or length(trim(coalesce(p_customer_phone,''))) = 0 then
    raise exception 'Name and phone are required';
  end if;
  if p_payment_method <> 'cod' and (coalesce(trim(p_trx_id),'') = '' or coalesce(trim(p_sender_number),'') = '') then
    raise exception 'Sender number and Transaction ID are required';
  end if;

  select * into s from settings where id = 1;

  -- lock variants & compute subtotal
  for it in select * from jsonb_array_elements(p_items) loop
    v_qty := (it->>'quantity')::int;
    if v_qty is null or v_qty < 1 or v_qty > 99 then raise exception 'Invalid quantity'; end if;
    select pv.id, pv.price, pv.stock, pv.is_active, p.name, p.is_active as p_active
      into v from product_variants pv join products p on p.id = pv.product_id
      where pv.id = (it->>'variant_id')::uuid for update of pv;
    if not found or not v.is_active or not v.p_active then raise exception 'A product in your cart is no longer available'; end if;
    if v.stock < v_qty then raise exception 'Only % left of %', v.stock, v.name; end if;
    v_sub := v_sub + v.price * v_qty;
  end loop;

  if coalesce(trim(p_coupon_code),'') <> '' then
    select c.coupon_id, c.discount, c.error into v_coupon, v_disc, v_err
      from compute_coupon_discount(p_coupon_code, v_sub, auth.uid()) c;
    if v_err is not null then raise exception '%', v_err; end if;
    update coupons set used_count = used_count + 1 where id = v_coupon;
  end if;

  v_ship := case when p_zone = 'inside_dhaka' then s.shipping_inside_dhaka else s.shipping_outside_dhaka end;
  if s.free_shipping_over is not null and v_sub - v_disc >= s.free_shipping_over then v_ship := 0; end if;

  insert into orders (user_id, customer_name, customer_phone, customer_email, ship_district, ship_area, ship_line,
    ship_zone, note, subtotal, discount, shipping_fee, total, coupon_id, coupon_code, payment_method,
    payment_status, sender_number, trx_id)
  values (auth.uid(), trim(p_customer_name), trim(p_customer_phone), nullif(trim(p_customer_email),''),
    p_district, p_area, p_line, p_zone, nullif(trim(p_note),''), v_sub, v_disc, v_ship, v_sub - v_disc + v_ship,
    v_coupon, case when v_coupon is null then null else upper(trim(p_coupon_code)) end, p_payment_method,
    case when p_payment_method = 'cod' then 'unpaid'::payment_status else 'pending_verification'::payment_status end,
    nullif(trim(p_sender_number),''), nullif(upper(trim(p_trx_id)),''))
  returning * into v_order;

  for it in select * from jsonb_array_elements(p_items) loop
    v_qty := (it->>'quantity')::int;
    insert into order_items (order_id, product_id, variant_id, product_name, variant_options, image, unit_price, quantity, line_total)
    select v_order.id, p.id, pv.id, p.name, pv.options, p.images[1], pv.price, v_qty, pv.price * v_qty
      from product_variants pv join products p on p.id = pv.product_id where pv.id = (it->>'variant_id')::uuid;
    update product_variants set stock = stock - v_qty where id = (it->>'variant_id')::uuid;
    insert into inventory_movements (variant_id, delta, reason, order_id)
      values ((it->>'variant_id')::uuid, -v_qty, 'order', v_order.id);
  end loop;

  insert into order_status_history (order_id, status, note) values (v_order.id, 'pending', 'Order placed');
  return query select v_order.order_number, v_order.tracking_token;
exception when unique_violation then
  raise exception 'This Transaction ID has already been used';
end $$;

-- ============ ADMIN: STATUS / CANCEL ============
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
    for r in select variant_id, quantity from order_items where order_id = p_order and variant_id is not null loop
      update product_variants set stock = stock + r.quantity where id = r.variant_id;
      insert into inventory_movements (variant_id, delta, reason, order_id, created_by)
        values (r.variant_id, r.quantity, 'cancel', p_order, auth.uid());
    end loop;
    if o.coupon_id is not null then
      update coupons set used_count = greatest(used_count - 1, 0) where id = o.coupon_id;
    end if;
  end if;

  update orders set status = p_status where id = p_order;
  insert into order_status_history (order_id, status, note) values (p_order, p_status, nullif(trim(p_note),''));
end $$;

create or replace function admin_adjust_stock(p_variant uuid, p_delta int, p_reason inventory_reason, p_note text)
returns int language plpgsql security definer set search_path = public as $$
declare new_stock int;
begin
  if not is_admin() then raise exception 'forbidden'; end if;
  update product_variants set stock = stock + p_delta where id = p_variant returning stock into new_stock;
  if new_stock is null then raise exception 'Variant not found'; end if;
  if new_stock < 0 then raise exception 'Stock cannot go below zero'; end if;
  insert into inventory_movements (variant_id, delta, reason, note, created_by)
    values (p_variant, p_delta, p_reason, nullif(trim(p_note),''), auth.uid());
  return new_stock;
end $$;

-- ============ PUBLIC TRACKING ============
create or replace function track_order(p_order_number text, p_phone text, p_token uuid)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare o orders;
begin
  select * into o from orders
   where upper(order_number) = upper(trim(p_order_number))
     and ((p_token is not null and tracking_token = p_token)
       or (p_phone is not null and length(regexp_replace(p_phone,'\D','','g')) >= 10
           and right(regexp_replace(customer_phone,'\D','','g'),10) = right(regexp_replace(p_phone,'\D','','g'),10)));
  if not found then return null; end if;
  return jsonb_build_object(
    'order_number', o.order_number, 'status', o.status, 'payment_method', o.payment_method,
    'payment_status', o.payment_status, 'subtotal', o.subtotal, 'discount', o.discount,
    'shipping_fee', o.shipping_fee, 'total', o.total, 'courier', o.courier, 'tracking_code', o.tracking_code,
    'customer_name', o.customer_name, 'ship_area', o.ship_area, 'ship_district', o.ship_district,
    'created_at', o.created_at,
    'items', (select coalesce(jsonb_agg(jsonb_build_object('name', product_name, 'options', variant_options,
        'image', image, 'unit_price', unit_price, 'quantity', quantity, 'line_total', line_total)), '[]')
      from order_items where order_id = o.id),
    'history', (select coalesce(jsonb_agg(jsonb_build_object('status', status, 'note', note, 'created_at', created_at)
        order by created_at), '[]') from order_status_history where order_id = o.id));
end $$;

-- ============ SALES SUMMARY ============
create or replace function sales_summary(p_from timestamptz, p_to timestamptz)
returns jsonb language plpgsql stable security definer set search_path = public as $$
begin
  if not is_admin() then raise exception 'forbidden'; end if;
  return jsonb_build_object(
    'totals', (select jsonb_build_object(
        'revenue', coalesce(sum(total),0), 'orders', count(*),
        'aov', coalesce(round(avg(total),2),0), 'discounts', coalesce(sum(discount),0),
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
    'pending_verification', (select count(*) from orders where payment_status = 'pending_verification' and status <> 'cancelled'),
    'low_stock', (select coalesce(jsonb_agg(jsonb_build_object('variant_id', pv.id, 'product', p.name, 'options', pv.options, 'stock', pv.stock) order by pv.stock), '[]')
        from product_variants pv join products p on p.id = pv.product_id
        where pv.is_active and p.is_active and pv.stock <= pv.low_stock_threshold)
  );
end $$;

-- Function grants
revoke execute on function compute_coupon_discount(text, numeric, uuid) from public, anon, authenticated;
revoke execute on function handle_new_user() from public, anon, authenticated;
revoke execute on function protect_role() from public, anon, authenticated;
revoke execute on function admin_set_order_status(uuid, order_status, text) from public, anon;
revoke execute on function admin_adjust_stock(uuid, int, inventory_reason, text) from public, anon;
revoke execute on function sales_summary(timestamptz, timestamptz) from public, anon;
grant execute on function admin_set_order_status(uuid, order_status, text) to authenticated;
grant execute on function admin_adjust_stock(uuid, int, inventory_reason, text) to authenticated;
grant execute on function sales_summary(timestamptz, timestamptz) to authenticated;
grant execute on function validate_coupon(text, numeric) to anon, authenticated;
grant execute on function place_order(jsonb, text, text, text, text, text, text, shipping_zone, text, text, payment_method, text, text) to anon, authenticated;
grant execute on function track_order(text, text, uuid) to anon, authenticated;

-- ============ STORAGE ============
insert into storage.buckets (id, name, public) values ('product-images', 'product-images', true)
  on conflict (id) do nothing;
insert into storage.buckets (id, name, public, file_size_limit) values ('custom-uploads', 'custom-uploads', false, 52428800)
  on conflict (id) do nothing;

create policy "product images admin write" on storage.objects for insert to authenticated
  with check (bucket_id = 'product-images' and public.is_admin());
create policy "product images admin update" on storage.objects for update to authenticated
  using (bucket_id = 'product-images' and public.is_admin());
create policy "product images admin delete" on storage.objects for delete to authenticated
  using (bucket_id = 'product-images' and public.is_admin());

-- Anyone may upload custom request files into a random folder; only admins can read them
create policy "custom uploads insert" on storage.objects for insert to anon, authenticated
  with check (bucket_id = 'custom-uploads');
create policy "custom uploads admin read" on storage.objects for select to authenticated
  using (bucket_id = 'custom-uploads' and public.is_admin());
