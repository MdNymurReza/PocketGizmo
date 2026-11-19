-- place_order: reject a repeated item, and only pre-order products can be ordered past stock.
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

  -- Each item once: the stock check below is per line, so a repeated item could get past it.
  if (select count(*) <> count(distinct x->>'variant_id') from jsonb_array_elements(p_items) x) then
    raise exception 'Each item can only be in the cart once';
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
    select case when p.preorder_enabled then greatest(v_qty - greatest(pv.stock, 0), 0) else 0 end into v_pre
      from product_variants pv join products p on p.id = pv.product_id where pv.id = (it->>'variant_id')::uuid;
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
