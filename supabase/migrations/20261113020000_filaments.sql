-- Filament list managed in the admin panel and shown on the custom order page,
-- plus how many colors one order can use (one per printer).

alter table settings
  add column max_print_colors int not null default 4 check (max_print_colors between 1 and 16);

create table filaments (
  id uuid primary key default gen_random_uuid(),
  material text not null check (length(trim(material)) between 1 and 40),
  color text not null check (length(trim(color)) between 1 and 40),
  hex text check (hex ~ '^#[0-9a-fA-F]{6}$'),
  in_stock boolean not null default true,
  created_at timestamptz not null default now(),
  unique (material, color)
);

alter table filaments enable row level security;
create policy "filaments are public" on filaments for select using (true);
create policy "admin adds filaments" on filaments for insert to authenticated with check ((select is_admin()));
create policy "admin edits filaments" on filaments for update to authenticated using ((select is_admin())) with check ((select is_admin()));
create policy "admin removes filaments" on filaments for delete to authenticated using ((select is_admin()));
