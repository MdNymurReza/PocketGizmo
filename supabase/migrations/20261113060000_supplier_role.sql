-- New enum values must be committed before they can be used, so this is its own migration.
alter type user_role add value if not exists 'supplier';
create type print_job_status as enum ('to_print', 'printing', 'printed', 'received', 'cancelled');
