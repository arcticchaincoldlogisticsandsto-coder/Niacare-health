# Pending migrations — deployment guide

Three migrations exist in this directory, **none applied to the live
database yet**. See each section below. `fetch_patient_record_access_log()`
and `fetch_queue_position()` were added directly to `supabase/schema.sql`
(not as standalone files here) in earlier passes — they remain pending too;
see the bottom of this document.

---

## Migration file 1: appointment pipeline

File: `20260901142812_appointment_pipeline.sql`

**Status as of writing: NOT applied to the live database.** This directory
holds one migration, extracted verbatim from `supabase/schema.sql`, so it can
be reviewed and applied independently of the rest of that file. Nothing in
this repository executes it automatically — applying it is a manual step a
human with Supabase project access must take.

## 1. What it changes

- Adds `appointments_doctor_slot_unique`, a partial unique index closing a
  double-booking gap that exists outside `book_appointment()`.
- Adds 9 nullable timestamp/actor columns to `public.appointments`.
- Extends `appointments_status_check` from 4 allowed status values to 8
  (`arrived`, `called`, `in_consultation`, `no_show` added; the original 4 —
  `confirmed`, `in_queue`, `completed`, `cancelled` — kept unchanged).
- Adds `patient_arrive_appointment()`.
- Replaces `check_in_appointment()` with an updated body (same name, same
  signature — now also accepts an `'arrived'` appointment, not only
  `'confirmed'`).
- Adds `call_patient()`, `start_consultation()`, `complete_appointment_visit()`,
  `mark_appointment_no_show()`.

Nothing is dropped, renamed, or has its signature changed. `book_appointment()`
is not touched by this migration at all.

## 2. Why it's safe

- Every `ADD COLUMN` uses `IF NOT EXISTS`.
- The status constraint is dropped and re-added **by its known name**
  (`appointments_status_check`), so re-running the file a second time is a
  no-op rather than an error.
- The unique index uses `IF NOT EXISTS` and is **partial** — it only applies
  to non-cancelled appointments with a real `doctor_profile_id`, so a
  cancel-and-rebook is never blocked, and it simply won't apply to legacy
  rows with no real doctor.
- Every function is `SECURITY DEFINER` with `SET search_path = public` and an
  explicit authorization check as its first real statement — see the
  per-function comments in the migration file itself.
- Pre-flight data (below) was checked read-only against the live database
  while writing this: **2 total appointment rows**, both already
  `confirmed`/`cancelled`, and **zero** non-cancelled appointments with a
  real `doctor_profile_id`. Neither the constraint change nor the unique
  index had any conflicting row at that time. **Re-run the pre-flight
  queries below immediately before applying** — data may have changed since.

## 3. Pre-flight checks — run these first, in the SQL Editor

All read-only. None of these modify data.

```sql
-- A) Every status currently in use — everything here must already be one of
--    the 8 values the new constraint allows (it will be, since the new set
--    is a superset of the old one — this just confirms nothing unexpected
--    snuck in, e.g. from a manual data fix).
select status, count(*) from public.appointments group by status order by 1;

-- B) Would the new partial unique index reject any existing row? A
--    non-empty result means real duplicate data exists and must be resolved
--    (see "what to do if this returns rows" below) before the index can be
--    created.
select doctor_profile_id, appointment_date, time_slot, count(*), array_agg(id) as appointment_ids
from public.appointments
where status <> 'cancelled' and doctor_profile_id is not null
group by doctor_profile_id, appointment_date, time_slot
having count(*) > 1;

-- C) Do any of the 5 new function names already exist (e.g. from a partial
--    prior deployment attempt)? CREATE OR REPLACE handles same-signature
--    collisions safely, but a same-name/different-signature function would
--    need to be dropped first — this tells you if that's the case.
select p.proname, pg_get_function_identity_arguments(p.oid) as args
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and p.proname in (
    'patient_arrive_appointment', 'check_in_appointment', 'call_patient',
    'start_consultation', 'complete_appointment_visit', 'mark_appointment_no_show'
  )
order by 1;

-- D) Confirm the shared dependencies this migration's functions call
--    already exist (they should — they're used by other already-live
--    functions such as the current check_in_appointment() and
--    book_appointment()).
select proname from pg_proc
where pronamespace = 'public'::regnamespace
  and proname in ('log_audit_event', 'create_notification', 'is_admin');
```

**What to do if query (B) returns rows:** do not proceed. Those are genuine
duplicate active bookings for the same doctor/date/time — decide per-row
whether one should be cancelled (a human/clinical judgment call, not
something to automate) before the unique index can be created. Do not delete
or modify that data as part of applying this migration.

**What to do if query (C) shows an unexpected signature:** `CREATE OR
REPLACE FUNCTION` fails loudly (does not silently corrupt anything) if an
existing function has the same name but a different argument list. If that
happens, the conflicting function must be dropped manually first — do not
add a blind `drop function` to this migration without knowing what that
existing function is and who depends on it.

## 4. How to apply

1. Open the Supabase project's dashboard → **SQL Editor**.
2. Run the four pre-flight queries above. Confirm (B) is empty and (C)/(D)
   look as expected.
3. Paste the full contents of `20260901142812_appointment_pipeline.sql` into
   a new query and run it.
4. Run the post-deploy verification queries below and confirm every one
   matches the expected result.

There is no Supabase CLI project link configured in this repository (no
`supabase/config.toml`, no linked project ref), so `supabase db push` is not
available here — the SQL Editor (or `psql` against the project's connection
string, if available to whoever is deploying) is the applicable path.

## 5. Post-deploy verification — run these after applying

```sql
-- A) The 9 new columns exist.
select column_name from information_schema.columns
where table_schema = 'public' and table_name = 'appointments'
  and column_name in (
    'patient_arrived_at', 'arrival_confirmed_at', 'arrival_confirmed_by',
    'called_at', 'consultation_started_at', 'completed_at',
    'no_show_at', 'no_show_by', 'no_show_reason'
  )
order by 1;
-- expect: all 9 rows.

-- B) The status constraint now allows all 8 values.
select pg_get_constraintdef(oid) from pg_constraint
where conname = 'appointments_status_check' and conrelid = 'public.appointments'::regclass;
-- expect: CHECK ((status = ANY (ARRAY['confirmed'::text, 'arrived'::text,
--   'in_queue'::text, 'called'::text, 'in_consultation'::text,
--   'completed'::text, 'cancelled'::text, 'no_show'::text])))

-- C) The unique index exists and is the partial index described above.
select indexdef from pg_indexes
where indexname = 'appointments_doctor_slot_unique' and schemaname = 'public';
-- expect: one row, definition includes
--   WHERE ((status <> 'cancelled'::text) AND (doctor_profile_id IS NOT NULL))

-- D) All 6 RPCs exist with the expected single-appointment-id signature
--    (mark_appointment_no_show also takes an optional reason).
select p.proname, pg_get_function_identity_arguments(p.oid) as args
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and p.proname in (
    'patient_arrive_appointment', 'check_in_appointment', 'call_patient',
    'start_consultation', 'complete_appointment_visit', 'mark_appointment_no_show'
  )
order by 1;
-- expect: 6 rows.

-- E) check_in_appointment() has the new body (accepts 'arrived', not just
--    'confirmed') — confirm by reading its source rather than calling it.
select prosrc from pg_proc
where pronamespace = 'public'::regnamespace and proname = 'check_in_appointment';
-- expect: the returned text contains "'confirmed', 'arrived'" and
--   "arrival_confirmed_by".

-- F) RLS is still enabled on appointments (this migration never touches
--    RLS, but confirm nothing else changed it out from under this check).
select relrowsecurity from pg_class where oid = 'public.appointments'::regclass;
-- expect: t

-- G) Existing appointment policies are unchanged (same policy names as
--    before this migration).
select polname from pg_policies where schemaname = 'public' and tablename = 'appointments';
-- expect: "Appointments are manageable by owner" (the only policy this
--   table has ever had) — no new or missing policy names.
```

## 6. What this migration deliberately does NOT do

- Does not touch `book_appointment()` — it is preserved exactly as-is.
- Does not touch any RLS policy anywhere.
- Does not invent a minute-based check-in or no-show grace period —
  `time_slot` remains free text (`"10:30 AM"`), not a real time column, so
  `patient_arrive_appointment()` and `mark_appointment_no_show()` both use a
  date-level rule only. This is documented in the migration file itself.
- Does not create a second audit or notification system — every new
  function calls the existing `log_audit_event()` / `create_notification()`.

---

## Migration file 2: facility departments + services

File: `20260902015936_facility_departments_services.sql`

**Status: NOT applied.** Independent of migration file 1 — no shared
dependency, can be applied in either order.

**What it adds:** `facility_departments` and `facility_services` tables
(both RLS-enabled from creation, active rows public, management restricted
to admin or that facility's own active staff), `doctor_profiles.department_id`
(nullable FK), and `assign_doctor_department()` (a narrow function — not a
broadened `doctor_profiles` RLS policy — that only ever changes
`department_id`, and only across a department/doctor pair at the same
facility).

**Pre-flight / post-deploy verification SQL:** included directly in the
migration file's own header comment — copy those blocks into the SQL Editor
before and after applying.

**How to apply:** same as migration file 1 — SQL Editor, no CLI link
configured in this repo.

---

## Migration file 3: book_appointment() active-facility/active-doctor check

File: `20260902041602_book_appointment_active_check.sql`

**Status: NOT applied.** Independent of migration files 1 and 2 — no shared
dependency.

**Important distinction from every other pending migration:** this one
**replaces the body of an already-live function** (`book_appointment()`,
same name and signature — `CREATE OR REPLACE`, no client change needed).
Every other pending migration only adds new, previously-absent objects;
this one changes real, currently-live behavior. Once applied, a booking
attempt against a deactivated facility (`providers.is_active = false`) or a
deactivated doctor (`doctor_profiles.is_active = false`) will start being
rejected with a clear error where it previously succeeded silently.

**Why:** found while auditing facility/doctor activation for this phase —
`providers.is_active` and `doctor_profiles.is_active` already exist and are
already toggle-able from `AdminDashboard`, but nothing enforced that a
deactivated facility/doctor actually stop receiving new bookings; the
existing RLS on `appointments` doesn't check either flag. Enforced inside
the RPC per spec ("implement it at the RPC/database level, not only in the
UI").

**Pre-flight / post-deploy verification SQL:** in the migration file's own
header comment.

---

## All currently pending changes (as of this document's last update)

1. `20260901142812_appointment_pipeline.sql` (this directory).
2. `20260902015936_facility_departments_services.sql` (this directory).
3. `20260902041602_book_appointment_active_check.sql` (this directory) —
   **replaces a live function's body**, not purely additive; see its own
   section above before applying.
4. `fetch_patient_record_access_log(integer)` — added directly to
   `supabase/schema.sql`, not a standalone file here. Read-only patient
   access-history function; no dependency on 1, 2, or 3.
5. `fetch_queue_position(uuid, date, text)` — added directly to
   `supabase/schema.sql`, not a standalone file here. Fixes a real RLS gap
   in queue-position reads; no dependency on 1, 2, 3, or 4.

None of these have been applied to the live Supabase project. Items 1, 2, 4,
and 5 are purely additive; item 3 changes existing live behavior — read its
section above carefully before applying.
