-- Emergency Care Phase 1: patient-facing live dispatch status.
--
-- LIVE-BEHAVIOR CHANGES:
--   1. emergency_dispatches gains updated_at (auto-touched on every UPDATE)
--      so the tracking screen can show "last updated" honestly.
--   2. emergency_dispatches gains target_provider_id, best-effort resolved
--      from the free-text target_facility against public.providers.name at
--      insert time. It stays null when no confident match exists — never
--      guessed. This does not change target_facility, which remains the
--      authoritative facility label shown to the patient.
--   3. New RLS: provider_staff can now SELECT dispatches whose
--      target_provider_id matches their own provider — previously only the
--      patient who created a dispatch, or an admin, could see it at all.
--      This is an additive grant, not a narrowing of existing access.
--   4. New RPC cancel_own_dispatch(): lets a signed-in patient cancel their
--      own dispatch, but only while status is still 'dispatched' or
--      'requested' (before a real ambulance has been assigned/en route).
--      Anonymous dispatches (patient_id null — an emergency call made
--      without being logged in) cannot self-cancel this way; that gap is
--      intentional, not an oversight, since there is no account to check
--      ownership against.
--   5. New triggers call the existing public.create_notification(): a real
--      row in public.notifications, not a simulated "notified" state.
--       - On insert, if target_provider_id resolved, every active
--         provider_staff member at that facility gets one notification.
--       - On a genuine status change, the dispatch's own patient (if any)
--         gets one notification.
--      Neither of these sends an SMS/push/email — no such delivery
--      infrastructure exists in this project. See README note below.
--   6. Attempts to add emergency_dispatches to the supabase_realtime
--      publication, guarded so it's a no-op if that publication doesn't
--      exist in this project. The frontend does NOT assume this worked —
--      it only shows a "live" indicator once a realtime subscription
--      actually reports itself connected, and always keeps a conservative
--      poll running underneath regardless.
--
-- NOT DONE HERE (documented, not silently skipped):
--   Actual SMS/push/email delivery to a facility or patient requires a
--   real provider integration (e.g. Africa's Talking for SMS in Tanzania,
--   or a push service) that this project does not have credentials for.
--   The notification ROW is real; the OUTBOUND MESSAGE is not sent anywhere
--   beyond this app's own in-app notification feed.

begin;

alter table public.emergency_dispatches
  add column if not exists updated_at timestamptz not null default now(),
  add column if not exists target_provider_id uuid references public.providers(id);

drop trigger if exists set_emergency_dispatches_updated_at on public.emergency_dispatches;
create trigger set_emergency_dispatches_updated_at
  before update on public.emergency_dispatches
  for each row execute function public.set_updated_at();

-- Widen the notification category vocabulary (additive — every existing
-- category stays valid) so emergency notifications aren't misfiled as
-- 'general'.
alter table public.notifications drop constraint if exists notifications_category_check;
alter table public.notifications add constraint notifications_category_check
  check (category in ('appointments', 'reminders', 'results', 'follow_up', 'payments', 'messages', 'access', 'general', 'emergency'));

-- Best-effort text match from the static hospital list EmergencyBar.tsx
-- dispatches against (src/data/countries.ts NEARBY_HOSPITALS) to a real
-- public.providers row. The two lists are maintained independently and
-- their names can drift (punctuation, "Dar es Salaam" placement, etc.), so
-- this is intentionally forgiving (case/space/punctuation-insensitive) but
-- still an exact-normalized match only — never a fuzzy/partial one that
-- could misroute a notification to the wrong facility.
create or replace function public.resolve_dispatch_provider()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.target_facility is not null then
    select p.id into new.target_provider_id
    from public.providers p
    where regexp_replace(lower(p.name), '[^a-z0-9]', '', 'g')
        = regexp_replace(lower(new.target_facility), '[^a-z0-9]', '', 'g')
    limit 1;
  end if;
  return new;
end;
$$;

drop trigger if exists resolve_emergency_dispatch_provider on public.emergency_dispatches;
create trigger resolve_emergency_dispatch_provider
  before insert on public.emergency_dispatches
  for each row execute function public.resolve_dispatch_provider();

create or replace function public.notify_emergency_dispatch_created()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_staff record;
begin
  if new.target_provider_id is not null then
    for v_staff in
      select user_id from public.provider_staff
      where provider_id = new.target_provider_id and is_active = true
    loop
      perform public.create_notification(
        v_staff.user_id, 'emergency',
        'Incoming emergency dispatch',
        format('%s — ref %s', new.condition, new.dispatch_ref),
        'emergency_dispatches', new.id
      );
    end loop;
  end if;
  return new;
end;
$$;

drop trigger if exists notify_emergency_dispatch_created on public.emergency_dispatches;
create trigger notify_emergency_dispatch_created
  after insert on public.emergency_dispatches
  for each row execute function public.notify_emergency_dispatch_created();

create or replace function public.notify_emergency_dispatch_status_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Guards against firing on a no-op UPDATE (e.g. a client re-saving the
  -- same status), so this stays idempotent under repeated polling/writes.
  if new.status is distinct from old.status and new.patient_id is not null then
    perform public.create_notification(
      new.patient_id, 'emergency',
      'Emergency dispatch update',
      format('Your dispatch %s is now: %s', new.dispatch_ref, new.status),
      'emergency_dispatches', new.id
    );
  end if;
  return new;
end;
$$;

drop trigger if exists notify_emergency_dispatch_status_change on public.emergency_dispatches;
create trigger notify_emergency_dispatch_status_change
  after update on public.emergency_dispatches
  for each row execute function public.notify_emergency_dispatch_status_change();

-- Facility staff can now see dispatches routed to their own facility only
-- — they previously had no visibility into emergency_dispatches at all.
drop policy if exists "Facility staff can view their facility's dispatches" on public.emergency_dispatches;
create policy "Facility staff can view their facility's dispatches"
  on public.emergency_dispatches for select
  using (
    target_provider_id is not null
    and exists (
      select 1 from public.provider_staff ps
      where ps.user_id = auth.uid() and ps.provider_id = emergency_dispatches.target_provider_id and ps.is_active
    )
  );

-- A signed-in patient can cancel their own dispatch, but only before it's
-- been assigned a real ambulance — status is re-checked server-side inside
-- the function, not trusted from the client.
create or replace function public.cancel_own_dispatch(p_dispatch_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.emergency_dispatches
  set status = 'cancelled'
  where id = p_dispatch_id
    and patient_id = auth.uid()
    and status in ('dispatched', 'requested');
end;
$$;

revoke all on function public.cancel_own_dispatch(uuid) from public;
grant execute on function public.cancel_own_dispatch(uuid) to authenticated;

-- Best-effort only: if this project's publication isn't named
-- supabase_realtime (or doesn't exist), this is a no-op rather than a
-- failed migration. The frontend never assumes this succeeded.
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    begin
      alter publication supabase_realtime add table public.emergency_dispatches;
    exception when duplicate_object then
      null;
    end;
  end if;
end $$;

commit;
