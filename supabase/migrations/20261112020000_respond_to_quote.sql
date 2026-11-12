-- Lets a signed-in customer accept or decline a quote on their own custom request.
create or replace function respond_to_quote(p_id uuid, p_accept boolean)
returns void language plpgsql security definer set search_path = public as $$
begin
  update custom_requests
     set status = case when p_accept then 'accepted'::custom_request_status else 'rejected'::custom_request_status end
   where id = p_id and user_id = auth.uid() and status = 'quoted';
  if not found then raise exception 'This quote can no longer be changed'; end if;
end $$;
revoke execute on function respond_to_quote(uuid, boolean) from public, anon;
grant execute on function respond_to_quote(uuid, boolean) to authenticated;
