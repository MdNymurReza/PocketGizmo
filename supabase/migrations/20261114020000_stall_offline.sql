-- Orders taken offline on a device are uploaded later ("Sync").
-- client_id makes an upload safe to repeat: the same order is never saved twice.
-- An offline order brings its own number (e.g. ST-KP12: the device's letters and a counter),
-- because the customer was already told that number at the stall.
alter table stall_orders add column if not exists client_id uuid unique;

create or replace function stall_create_order(p jsonb, p_send_to_print boolean default true)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  o stall_orders; it jsonb; v_sub numeric := 0; v_disc numeric; v_charge numeric; v_paid numeric;
  v_name text; v_qty int; v_price numeric; v_fulfil text;
  v_client uuid := nullif(p->>'client_id', '')::uuid;
  v_number text := upper(nullif(trim(coalesce(p->>'order_number', '')), ''));
  v_created timestamptz := least(coalesce(nullif(p->>'created_at', '')::timestamptz, now()), now());
begin
  if not is_admin() then raise exception 'forbidden'; end if;

  -- Already uploaded before: answer with the saved order instead of saving it again.
  if v_client is not null then
    select * into o from stall_orders where client_id = v_client;
    if found then return jsonb_build_object('id', o.id, 'order_number', o.order_number, 'duplicate', true); end if;
  end if;

  if coalesce(trim(p->>'customer_name'), '') = '' then raise exception 'Enter the customer''s name'; end if;
  if coalesce(trim(p->>'customer_phone'), '') = '' then raise exception 'Enter the customer''s phone number'; end if;
  if jsonb_typeof(p->'items') <> 'array' or jsonb_array_length(p->'items') = 0 then raise exception 'Add at least one item'; end if;
  if jsonb_array_length(p->'items') > 50 then raise exception 'An order can have up to 50 items'; end if;

  -- A device number is used only if it has the right shape and is still free; otherwise the next ST-number is given.
  if v_number is not null and (v_number !~ '^ST-[A-Z]{1,2}[0-9]{1,6}$' or exists (select 1 from stall_orders where order_number = v_number)) then
    v_number := null;
  end if;

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

  insert into stall_orders (order_number, client_id, created_at, event_date, stall_location, customer_name, customer_phone, fulfilment,
    delivery_address, delivery_charge, subtotal, discount, total, paid_amount, payment_method, due_date, note, created_by)
  values (
    coalesce(v_number, 'ST-' || nextval('stall_order_seq')),
    v_client, v_created,
    coalesce(nullif(p->>'event_date', '')::date, (v_created at time zone 'Asia/Dhaka')::date),
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
