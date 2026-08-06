-- No end-user login exists: the single operator accesses leo.* data only
-- through the AI agent, using the service_role key, which bypasses RLS.
-- Drop the authenticated-role placeholder instead of leaving a standing
-- grant nobody is meant to use -- RLS stays enabled with zero policies,
-- which denies anon/authenticated by default while service_role is
-- unaffected.

do $$
declare
  t text;
begin
  for t in
    select unnest(array[
      'pets', 'documents', 'health_records', 'medical_history',
      'reminders', 'assistance_dog_profile', 'assistance_dog_tasks'
    ])
  loop
    execute format('drop policy if exists "authenticated_full_access" on leo.%I', t);
  end loop;
end $$;

revoke all on all tables in schema leo from authenticated, anon;
alter default privileges in schema leo revoke all on tables from authenticated, anon;
revoke usage on schema leo from authenticated, anon;
