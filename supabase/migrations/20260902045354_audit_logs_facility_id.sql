-- ============================================================================
-- NiaCare — audit_logs.facility_id + log_audit_event() facility parameter
--
-- STATUS: NOT YET APPLIED to the live database as of this file's creation.
--
-- IMPORTANT — same category as the book_appointment() migration, NOT the
-- purely-additive ones: this REPLACES an already-live function,
-- log_audit_event(text, text, uuid, uuid, jsonb), which is in active use
-- throughout this schema (referrals, record access requests, role changes,
-- and — once deployed — the appointment pipeline). It is dropped and
-- recreated with a 6th, optional, defaulted parameter (p_facility_id).
--
-- WHY DROP + CREATE, NOT PLAIN CREATE OR REPLACE: Postgres identifies a
-- function by name AND parameter list — CREATE OR REPLACE with a different
-- parameter list does not replace an existing function, it adds a second,
-- overloaded one. Two overloads whose only difference is a trailing
-- default parameter break PostgREST's RPC dispatch (PGRST203, "could not
-- choose the best candidate function") for calls that omit that parameter
-- — which is every existing call site in this app. Dropping the old 5-arg
-- signature first avoids that entirely: exactly one function exists
-- afterward, and every existing caller (positional SQL calls throughout
-- schema.sql, and the frontend's named-argument logAuditEvent() calls)
-- keeps working unchanged, since the new parameter defaults to null.
--
-- WHY: found while extending the admin Audit panel with a facility filter.
-- The existing approach would have been parsing metadata.provider_id
-- (already present on some, not all, audit_logs rows) client-side, with no
-- index — fragile and explicitly against this phase's own instruction to
-- introduce a real column instead. facility_id is a plain nullable FK, not
-- required on any event (most audit events — record access, role changes —
-- aren't facility-scoped at all).
--
-- WHAT IS NOT CHANGED: audit_logs' existing columns, its admin-only RLS
-- policy (re-stated here only because it sits between the two changes in
-- schema.sql, not because it's different), and every other function in
-- this schema. Existing rows are untouched — facility_id is simply null on
-- all of them until new events populate it.
--
-- DEPENDENCY: none on the other 4 pending migrations — independent.
--
-- PRE-FLIGHT (read-only, run first):
--   select count(*) from information_schema.columns
--   where table_schema = 'public' and table_name = 'audit_logs' and column_name = 'facility_id';
--   -- expect 0 (column doesn't exist yet).
--   select count(*) from pg_proc p join pg_namespace n on n.oid = p.pronamespace
--   where n.nspname = 'public' and p.proname = 'log_audit_event';
--   -- expect 1 (the current 5-arg version) — confirms there isn't already
--   -- an unexpected overload before this migration adds its own.
--
-- POST-DEPLOY VERIFICATION:
--   select column_name from information_schema.columns
--   where table_schema = 'public' and table_name = 'audit_logs' and column_name = 'facility_id';
--   -- expect 1 row.
--   select p.proname, pg_get_function_identity_arguments(p.oid) as args
--   from pg_proc p join pg_namespace n on n.oid = p.pronamespace
--   where n.nspname = 'public' and p.proname = 'log_audit_event';
--   -- expect exactly 1 row, args ending in "... jsonb, facility_id uuid".
--   -- If 2 rows appear, the DROP did not take effect — investigate before
--   -- relying on this function; do not leave two overloads live.
--   select indexname from pg_indexes where schemaname = 'public' and indexname = 'audit_logs_facility_id_idx';
--   -- expect 1 row.
-- ============================================================================

-- facility_id: a real column, not fragile client-side metadata.provider_id
-- parsing (which some but not all existing log_audit_event() calls happen
-- to set, inconsistently, inside a jsonb blob with no index). Nullable —
-- most audit events (record access, role changes) aren't facility-scoped
-- at all, so this is never mandatory.
alter table public.audit_logs
  add column if not exists facility_id uuid references public.providers(id) on delete set null;

create index if not exists audit_logs_facility_id_idx on public.audit_logs(facility_id);

alter table public.audit_logs enable row level security;

drop policy if exists "Audit logs are viewable by admins only" on public.audit_logs;
create policy "Audit logs are viewable by admins only"
  on public.audit_logs for select
  using (public.is_admin());

-- p_facility_id appended as a new, optional, defaulted last parameter.
-- IMPORTANT: this must be a DROP + CREATE, not a plain CREATE OR REPLACE —
-- log_audit_event(text, text, uuid, uuid, jsonb) is already live and in
-- active use throughout this schema. Postgres treats a different
-- parameter LIST as a different function identity, so CREATE OR REPLACE
-- alone would leave the old 5-arg version in place and add this as a
-- second, overloaded function — which breaks PostgREST's RPC dispatch
-- (it cannot choose between two overloads whose only difference is a
-- trailing default parameter, and returns PGRST203 "could not choose the
-- best candidate function" for exactly the calls this app already makes).
-- Dropping the old 5-arg signature first, then creating the 6-arg
-- replacement, leaves exactly one function — every existing 5-argument
-- caller (positional SQL calls throughout this file, and the frontend's
-- named-argument logAuditEvent() calls) continues to work unchanged
-- because the 6th parameter defaults to null.
drop function if exists public.log_audit_event(text, text, uuid, uuid, jsonb);

create or replace function public.log_audit_event(
  p_action text,
  p_resource_type text,
  p_resource_id uuid default null,
  p_patient_id uuid default null,
  p_metadata jsonb default '{}'::jsonb,
  p_facility_id uuid default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.audit_logs (actor_id, action, resource_type, resource_id, patient_id, metadata, facility_id)
  values (auth.uid(), p_action, p_resource_type, p_resource_id, p_patient_id, p_metadata, p_facility_id);
end;
$$;

revoke all on function public.log_audit_event(text, text, uuid, uuid, jsonb, uuid) from public;
grant execute on function public.log_audit_event(text, text, uuid, uuid, jsonb, uuid) to authenticated;
