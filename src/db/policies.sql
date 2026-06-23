-- ============================================================================
-- Set — Row Level Security backstop
--
-- This is defence in depth. The DAL (src/lib/dal.ts) is the primary guard for
-- every route and action (CLAUDE.md rule 1); these policies make the database
-- itself refuse to leak member PII or let the audit trail be rewritten, even if
-- application code has a bug.
--
-- HOW TO RUN
--   Apply in the Supabase SQL editor AS THE TABLE OWNER, AFTER migrations.
--   This script is idempotent — safe to re-run.
--
-- PRODUCTION WIRING
--   * DATABASE_URL (runtime, Supavisor transaction pooler :6543) connects as the
--     `app_user` role created here. NOT the default postgres/owner role, and NOT
--     the Supabase service key.
--   * DIRECT_URL (:5432, owner/session) is used only for migrations and the
--     one-off seed bootstrap.
--
-- IDENTITY
--   The DAL sets two transaction-local GUCs on every request, which the policies
--   below read:
--     select set_config('app.user_id', '<user uuid>', true);
--     select set_config('app.role',    '<member|exco|super_admin>', true);
-- ============================================================================

-- 1) Runtime role: can log in, never bypasses RLS, and is not the table owner.
do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'app_user') then
    create role app_user with login nobypassrls;
  end if;
end
$$;

-- Set the password out of band (never commit it), e.g. in the Supabase editor:
--   alter role app_user with password '<from your secret manager>';

-- 2) Privileges: schema usage + DML on everything that currently exists.
grant usage on schema public to app_user;
grant select, insert, update, delete on all tables in schema public to app_user;
grant usage, select on all sequences in schema public to app_user;

-- 3) Enable RLS on the two sensitive tables.
alter table members   enable row level security;
alter table audit_log enable row level security;

-- 4) members: readable AND writable when the row is the caller's own
--    (user_id = app.user_id) or the caller is exco/super_admin.
drop policy if exists members_access on members;
create policy members_access on members
  for all
  using (
    user_id = nullif(current_setting('app.user_id', true), '')::uuid
    or current_setting('app.role', true) in ('exco', 'super_admin')
  )
  with check (
    user_id = nullif(current_setting('app.user_id', true), '')::uuid
    or current_setting('app.role', true) in ('exco', 'super_admin')
  );

-- 4b) members directory read: any signed-in member may read non-deleted
--     profiles whose visibility is public/members. Private profiles stay
--     restricted to self + exco/super_admin (the policy above). Per-field
--     privacy (email/phone) is applied in app code by getMemberWithPrivacy().
drop policy if exists members_directory_select on members;
create policy members_directory_select on members
  for select
  using (
    nullif(current_setting('app.user_id', true), '') is not null
    and deleted_at is null
    and profile_visibility in ('public', 'members')
  );

-- 5) audit_log: append-only.
--    app_user may INSERT; only super_admin may SELECT; nobody may UPDATE/DELETE.
drop policy if exists audit_log_insert on audit_log;
create policy audit_log_insert on audit_log
  for insert
  with check (true);

drop policy if exists audit_log_select on audit_log;
create policy audit_log_select on audit_log
  for select
  using (current_setting('app.role', true) = 'super_admin');

-- Deny UPDATE/DELETE at the privilege level for app_user.
revoke update, delete on audit_log from app_user;

-- Immutability backstop: raise on ANY update/delete, even by the table owner.
create or replace function audit_log_immutable() returns trigger
  language plpgsql as $$
begin
  raise exception 'audit_log is append-only; % is not permitted', tg_op;
end;
$$;

drop trigger if exists audit_log_no_mutate on audit_log;
create trigger audit_log_no_mutate
  before update or delete on audit_log
  for each row execute function audit_log_immutable();
