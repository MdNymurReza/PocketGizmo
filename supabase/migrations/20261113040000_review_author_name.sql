-- Public reviewer name: skip prefixes such as "MD." or "Mr." so "MD. Nymur Reza" shows as "Nymur R."
create or replace function review_display_name(p_full_name text) returns text
language sql immutable set search_path = '' as $$
  with n as (
    select trim(regexp_replace(trim(coalesce(p_full_name, '')), '^((md|mohd|mr|mrs|ms|mst|dr|engr)\.?\s+)+', '', 'i')) as v
  )
  select case
    when v = '' then 'Customer'
    when position(' ' in v) = 0 then v
    else split_part(v, ' ', 1) || ' ' || upper(left(regexp_replace(v, '^.*\s', ''), 1)) || '.'
  end from n
$$;

create or replace function submit_review(p_product uuid, p_rating int, p_comment text)
returns review_status language plpgsql security definer set search_path = public as $$
declare v_name text; v_status review_status;
begin
  if auth.uid() is null then raise exception 'Please log in to write a review'; end if;
  if p_rating is null or p_rating < 1 or p_rating > 5 then raise exception 'Choose a rating from 1 to 5 stars'; end if;
  if length(coalesce(p_comment, '')) > 1500 then raise exception 'Your review is too long'; end if;
  if not can_review(p_product) then raise exception 'You can review a product after your order is delivered'; end if;

  select review_display_name(full_name) into v_name from profiles where id = auth.uid();

  insert into reviews (product_id, user_id, author_name, rating, comment)
  values (p_product, auth.uid(), coalesce(v_name, 'Customer'), p_rating, trim(coalesce(p_comment, '')))
  on conflict (product_id, user_id) do update
    set rating = excluded.rating, comment = excluded.comment, author_name = excluded.author_name, status = 'pending'
  returning status into v_status;
  return v_status;
end $$;

revoke execute on function review_display_name(text) from public, anon, authenticated;
