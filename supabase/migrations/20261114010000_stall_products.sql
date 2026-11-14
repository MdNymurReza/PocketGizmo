-- The list of products sold at the stall, prepared before the stall day.
-- The order form shows them as a grid; a click adds the product to the order.
create table stall_products (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(trim(name)) > 0),
  price numeric(10,2) not null check (price >= 0),
  image text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index stall_products_name_key on stall_products (lower(trim(name)));
create trigger t_stall_products before update on stall_products for each row execute function touch_updated_at();
alter table stall_products enable row level security;
create policy "admin manages stall products" on stall_products for all to authenticated using ((select is_admin())) with check ((select is_admin()));
revoke all on stall_products from anon;
