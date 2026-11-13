-- Lets the admin put an order's items on the print list by hand, without waiting for the order to be confirmed.
-- Returns how many jobs were added (items already on the list are skipped).
create or replace function admin_send_order_to_print(p_order uuid)
returns int language plpgsql security definer set search_path = public as $$
declare o orders; n int;
begin
  if not is_admin() then raise exception 'forbidden'; end if;
  select * into o from orders where id = p_order;
  if not found then raise exception 'Order not found'; end if;
  if o.status = 'cancelled' then raise exception 'This order is cancelled, so it cannot be sent to print'; end if;

  insert into print_jobs (order_id, order_item_id, order_number, title, variant, details, image, quantity)
  select o.id, oi.id, o.order_number, oi.product_name,
    nullif((select string_agg(e.value, ' / ') from jsonb_each_text(oi.variant_options) e), ''),
    oi.details, oi.image, oi.quantity
  from order_items oi where oi.order_id = o.id
  on conflict (order_item_id) do nothing;
  get diagnostics n = row_count;
  return n;
end $$;

revoke execute on function admin_send_order_to_print(uuid) from public, anon;
grant execute on function admin_send_order_to_print(uuid) to authenticated;
