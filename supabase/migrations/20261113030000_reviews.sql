-- Product reviews: written by customers who received the product, shown after admin approval.

create type review_status as enum ('pending', 'approved', 'rejected');

create table reviews (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references products on delete cascade,
  user_id uuid not null references auth.users on delete cascade,
  author_name text not null,
  rating int not null check (rating between 1 and 5),
  comment text not null default '' check (length(comment) <= 1500),
  status review_status not null default 'pending',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (product_id, user_id)
);
create index on reviews (product_id, status);
create index on reviews (user_id);
create index on reviews (status);
create trigger t_reviews before update on reviews for each row execute function touch_updated_at();

alter table reviews enable row level security;
-- Everyone sees approved reviews; authors see their own; admins see all.
create policy "read reviews" on reviews for select
  using (status = 'approved' or user_id = (select auth.uid()) or (select is_admin()));
-- Customers write only through submit_review(); admins moderate directly.
create policy "admin moderates reviews" on reviews for update to authenticated
  using ((select is_admin())) with check ((select is_admin()));
create policy "admin removes reviews" on reviews for delete to authenticated
  using ((select is_admin()));
create policy "author removes own review" on reviews for delete to authenticated
  using (user_id = (select auth.uid()));

-- Has the signed-in customer received this product?
create or replace function can_review(p_product uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from orders o join order_items oi on oi.order_id = o.id
     where o.user_id = auth.uid() and o.status = 'delivered' and oi.product_id = p_product
  )
$$;

-- Create or edit the caller's review. Edits go back to "pending" for approval.
create or replace function submit_review(p_product uuid, p_rating int, p_comment text)
returns review_status language plpgsql security definer set search_path = public as $$
declare v_name text; v_status review_status;
begin
  if auth.uid() is null then raise exception 'Please log in to write a review'; end if;
  if p_rating is null or p_rating < 1 or p_rating > 5 then raise exception 'Choose a rating from 1 to 5 stars'; end if;
  if length(coalesce(p_comment, '')) > 1500 then raise exception 'Your review is too long'; end if;
  if not can_review(p_product) then raise exception 'You can review a product after your order is delivered'; end if;

  -- Public name: first name plus last initial, e.g. "Nymur R."
  select trim(full_name) into v_name from profiles where id = auth.uid();
  v_name := case
    when coalesce(v_name, '') = '' then 'Customer'
    when position(' ' in v_name) = 0 then v_name
    else split_part(v_name, ' ', 1) || ' ' || left(regexp_replace(v_name, '^.*\s', ''), 1) || '.'
  end;

  insert into reviews (product_id, user_id, author_name, rating, comment)
  values (p_product, auth.uid(), v_name, p_rating, trim(coalesce(p_comment, '')))
  on conflict (product_id, user_id) do update
    set rating = excluded.rating, comment = excluded.comment, author_name = excluded.author_name, status = 'pending'
  returning status into v_status;
  return v_status;
end $$;

revoke execute on function can_review(uuid) from public, anon;
revoke execute on function submit_review(uuid, int, text) from public, anon;
grant execute on function can_review(uuid) to authenticated;
grant execute on function submit_review(uuid, int, text) to authenticated;
