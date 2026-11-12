create or replace function protect_role() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  -- API callers (with a JWT) must be admin to change roles; direct DB/service access is allowed.
  if new.role <> old.role and auth.uid() is not null and not is_admin() then
    raise exception 'not allowed to change role';
  end if;
  return new;
end $$;

-- To promote an admin, run in the SQL editor:
--   update profiles set role = 'admin' where id = (select id from auth.users where email = 'you@example.com');
