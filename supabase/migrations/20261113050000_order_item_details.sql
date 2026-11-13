-- Optional customer details per ordered item (e.g. the name and number to print on a jersey).
alter table order_items add column if not exists details text
  check (details is null or char_length(details) <= 300);

-- place_order: same as before, but stores each item's "details" from the cart.
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
  p_trx_id text,
  p_advance_method payment_method default null
) returns table (order_number text, tracking_token uuid)
language plpgsql security definer set search_path = public as $$
declare
  it jsonb; v record; s settings;
  v_sub numeric := 0; v_disc numeric := 0; v_ship numeric; v_coupon uuid; v_err text;
  v_order orders; v_qty int; v_advance boolean; v_wallet payment_method;
begin
  if jsonb_array_length(coalesce(p_items, '[]')) = 0 then raise exception 'Cart is empty'; end if;
  if length(trim(coalesce(p_customer_name,''))) = 0 or length(trim(coalesce(p_customer_phone,''))) = 0 then
    raise exception 'Name and phone are required';
  end if;
  if exists (select 1 from blocked_phones where phone = phone_key(p_customer_phone)) then
    raise exception 'We can''t accept online orders from this number. Please contact us to order.';
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
    payment_status, sender_number, trx_id, advance_amount, advance_method, advance_status)
  values (auth.uid(), trim(p_customer_name), trim(p_customer_phone), nullif(trim(p_customer_email),''),
    p_district, p_area, p_line, p_zone, nullif(trim(p_note),''), v_sub, v_disc, v_ship, v_sub - v_disc + v_ship,
    v_coupon, case when v_coupon is null then null else upper(trim(p_coupon_code)) end, p_payment_method,
    case when p_payment_method = 'cod' then 'unpaid'::payment_status else 'pending_verification'::payment_status end,
    case when v_wallet is null then null else nullif(trim(p_sender_number),'') end,
    case when v_wallet is null then null else nullif(upper(trim(p_trx_id)),'') end,
    case when v_advance then v_ship else 0 end,
    case when v_advance then p_advance_method else null end,
    case when v_advance then 'pending' else 'none' end)
  returning * into v_order;

  for it in select * from jsonb_array_elements(p_items) loop
    v_qty := (it->>'quantity')::int;
    insert into order_items (order_id, product_id, variant_id, product_name, variant_options, image, unit_price, quantity, line_total, details)
    select v_order.id, p.id, pv.id, p.name, pv.options, p.images[1], pv.price, v_qty, pv.price * v_qty,
      nullif(left(trim(coalesce(it->>'details','')), 300), '')
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

-- track_order: include item details.
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
    'items', (select coalesce(jsonb_agg(jsonb_build_object('name', product_name, 'options', variant_options,
        'image', image, 'unit_price', unit_price, 'quantity', quantity, 'line_total', line_total, 'details', details)), '[]')
      from order_items where order_id = o.id),
    'history', (select coalesce(jsonb_agg(jsonb_build_object('status', status, 'note', note, 'created_at', created_at)
        order by created_at), '[]') from order_status_history where order_id = o.id));
end $$;
