-- Dashboard "payments to verify" also counts COD delivery-charge advances awaiting verification.
do $do$
declare d text;
begin
  select pg_get_functiondef('public.sales_summary(timestamptz, timestamptz)'::regprocedure) into d;
  d := replace(d,
    $q$where payment_status = 'pending_verification' and status <> 'cancelled'$q$,
    $q$where (payment_status = 'pending_verification' or advance_status = 'pending') and status <> 'cancelled'$q$);
  execute d;
end
$do$;
