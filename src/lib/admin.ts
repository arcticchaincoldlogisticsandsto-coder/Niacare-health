import { supabase } from './supabaseClient';
import { logAuditEvent } from './audit';

/**
 * Shared helper: several admin-facing tables (bills, emergency_dispatches,
 * audit_logs) reference auth.users(id) directly rather than public.profiles,
 * so there's no FK for PostgREST to embed a name on — fetch names for a set
 * of user ids in one extra query and merge client-side.
 */
const namesFor = async (userIds: string[]): Promise<Map<string, string>> => {
  const unique = Array.from(new Set(userIds.filter(Boolean)));
  const map = new Map<string, string>();
  if (unique.length === 0) return map;
  const { data } = await supabase.from('profiles').select('id, full_name').in('id', unique);
  for (const row of data || []) map.set(row.id, row.full_name);
  return map;
};

export interface ProviderRow {
  id: string;
  name: string;
  region: string;
  type: string;
  address: string | null;
  phone: string | null;
  emergency_phone: string | null;
  email: string | null;
  is_active: boolean;
  nhif_enabled: boolean;
  lat: number | null;
  lng: number | null;
}

export const fetchProviders = async (): Promise<{ providers: ProviderRow[]; error?: string }> => {
  const { data, error } = await supabase
    .from('providers')
    .select('id, name, region, type, address, phone, emergency_phone, email, is_active, nhif_enabled, lat, lng')
    .order('name');
  if (error) return { providers: [], error: error.message };
  return { providers: (data || []) as ProviderRow[] };
};

export interface ProviderUpsertInput {
  name: string;
  region: string;
  type: string;
  address?: string | null;
  phone?: string | null;
  emergency_phone?: string | null;
  email?: string | null;
  nhif_enabled: boolean;
  is_active: boolean;
  // Real gap fixed here: src/lib/facilityMap.ts's fetchMapFacilities()
  // already reads lat/lng and excludes any row missing either — a facility
  // created through this admin form previously had no way to ever get
  // coordinates set, so it would silently never appear on the Facility Map.
  lat?: number | null;
  lng?: number | null;
}

export const createProvider = async (payload: ProviderUpsertInput): Promise<{ error?: string }> => {
  const { data, error } = await supabase.from('providers').insert(payload).select('id').single();
  if (!error && data) logAuditEvent('FACILITY_CREATED', 'providers', data.id, undefined, { name: payload.name, region: payload.region }, data.id);
  return { error: error?.message };
};

export const updateProvider = async (id: string, payload: ProviderUpsertInput): Promise<{ error?: string }> => {
  const { error } = await supabase.from('providers').update(payload).eq('id', id);
  if (!error) logAuditEvent('FACILITY_UPDATED', 'providers', id, undefined, { name: payload.name }, id);
  return { error: error?.message };
};

export const setProviderActive = async (id: string, isActive: boolean): Promise<{ error?: string }> => {
  const { error } = await supabase.from('providers').update({ is_active: isActive }).eq('id', id);
  if (!error) logAuditEvent(isActive ? 'FACILITY_ACTIVATED' : 'FACILITY_DEACTIVATED', 'providers', id, undefined, {}, id);
  return { error: error?.message };
};

// Spec rule: "Only verified doctors should receive the public verified
// badge... do not display verification claims without actual verification."
// doctor_profiles.is_verified defaults to false and, until this, had no
// admin action anywhere in the app that could ever set it true — the badge
// logic already existed in the UI but the switch that turns it on didn't.
export const setDoctorVerified = async (doctorProfileId: string, verified: boolean): Promise<{ error?: string }> => {
  const { error } = await supabase.from('doctor_profiles').update({ is_verified: verified }).eq('id', doctorProfileId);
  if (!error) logAuditEvent(verified ? 'DOCTOR_VERIFIED' : 'DOCTOR_UNVERIFIED', 'doctor_profiles', doctorProfileId);
  return { error: error?.message };
};

// No DOCTOR_ACTIVATED/DOCTOR_DEACTIVATED action exists in the established
// convention (see supabase/schema.sql's other log_audit_event calls) —
// reusing DOCTOR_PROFILE_UPDATED with a metadata marker rather than
// inventing a new top-level action name, matching how
// assign_doctor_department() already does the same thing server-side.
export const setDoctorActive = async (doctorProfileId: string, isActive: boolean): Promise<{ error?: string }> => {
  const { error } = await supabase.from('doctor_profiles').update({ is_active: isActive }).eq('id', doctorProfileId);
  if (!error) logAuditEvent('DOCTOR_PROFILE_UPDATED', 'doctor_profiles', doctorProfileId, undefined, { action: isActive ? 'activated' : 'deactivated' });
  return { error: error?.message };
};

export interface DoctorProfileEditInput {
  sub_specialty: string | null;
  bio: string | null;
  languages: string[];
  consultation_fee_tzs: number;
  telehealth_fee_tzs: number;
  home_visit_fee_tzs: number;
  experience_years: number | null;
}

// A real, unrelated gap found while inspecting doctor_profiles' RLS: it
// already has an "own profile" UPDATE policy for the doctor (auth.uid() =
// user_id) and a separate admin policy, but nothing in the UI ever called
// either — no screen (doctor-side or admin-side) could edit sub_specialty/
// bio/languages/fees/experience_years after profile creation. This one
// function serves both callers; RLS (not this function) is what decides
// whether a given caller is allowed to update a given row.
export const updateDoctorProfile = async (doctorProfileId: string, payload: DoctorProfileEditInput): Promise<{ error?: string }> => {
  const { error } = await supabase.from('doctor_profiles').update(payload).eq('id', doctorProfileId);
  if (!error) logAuditEvent('DOCTOR_PROFILE_UPDATED', 'doctor_profiles', doctorProfileId);
  return { error: error?.message };
};

export interface ProviderDoctorRow {
  id: string;
  user_id: string;
  full_name: string;
  specialty: string;
  sub_specialty: string | null;
  is_verified: boolean;
  is_active: boolean;
  bio: string | null;
  languages: string[];
  consultation_fee_tzs: number;
  telehealth_fee_tzs: number;
  home_visit_fee_tzs: number;
  experience_years: number | null;
}

export interface ProviderStaffRow {
  id: string;
  user_id: string;
  full_name: string;
  job_title: string;
  department: string | null;
  is_active: boolean;
}

export const fetchProviderDirectory = async (
  providerId: string
): Promise<{ doctors: ProviderDoctorRow[]; staff: ProviderStaffRow[]; error?: string }> => {
  const [{ data: doctorsData, error: doctorsError }, { data: staffData, error: staffError }] = await Promise.all([
    supabase
      .from('doctor_profiles')
      .select('id, user_id, specialty, sub_specialty, is_verified, is_active, bio, languages, consultation_fee_tzs, telehealth_fee_tzs, home_visit_fee_tzs, experience_years')
      .eq('provider_id', providerId)
      .order('specialty'),
    supabase
      .from('provider_staff')
      .select('id, user_id, job_title, department, is_active')
      .eq('provider_id', providerId)
      .order('created_at', { ascending: false }),
  ]);

  if (doctorsError || staffError) {
    return { doctors: [], staff: [], error: doctorsError?.message || staffError?.message };
  }

  const profileNames = await namesFor([
    ...(doctorsData || []).map((row) => row.user_id),
    ...(staffData || []).map((row) => row.user_id),
  ]);

  return {
    doctors: (doctorsData || []).map((row) => ({
      id: row.id,
      user_id: row.user_id,
      full_name: profileNames.get(row.user_id) || 'Doctor',
      specialty: row.specialty,
      sub_specialty: row.sub_specialty,
      is_verified: row.is_verified,
      is_active: row.is_active,
      bio: row.bio,
      languages: row.languages || [],
      consultation_fee_tzs: row.consultation_fee_tzs,
      telehealth_fee_tzs: row.telehealth_fee_tzs,
      home_visit_fee_tzs: row.home_visit_fee_tzs,
      experience_years: row.experience_years,
    })),
    staff: (staffData || []).map((row) => ({
      id: row.id,
      user_id: row.user_id,
      full_name: profileNames.get(row.user_id) || 'Staff member',
      job_title: row.job_title,
      department: row.department,
      is_active: row.is_active,
    })),
  };
};

// provider_staff RLS currently grants UPDATE only to admin ("Admins can
// manage provider staff" — see supabase/schema.sql) or the staff member's
// own row (view-only, not update). There is no "facility admin" role
// distinct from a regular staff member in this schema (job_title is free
// text, not an enum with an admin tier), so a facility-side "edit my
// colleague's role" capability cannot be safely scoped yet — it would need
// either a new role column or reusing job_title as an authorization signal
// (fragile: matching on free text). Documented as a future decision, not
// guessed at here. This function is therefore admin-only, exactly matching
// existing RLS — no policy change.
export const updateStaffRole = async (staffId: string, jobTitle: string, department: string): Promise<{ error?: string }> => {
  const { error } = await supabase.from('provider_staff').update({ job_title: jobTitle.trim(), department: department.trim() || null }).eq('id', staffId);
  if (!error) logAuditEvent('STAFF_ROLE_UPDATED', 'provider_staff', staffId, undefined, { job_title: jobTitle });
  return { error: error?.message };
};

export const setStaffActive = async (staffId: string, isActive: boolean): Promise<{ error?: string }> => {
  const { error } = await supabase.from('provider_staff').update({ is_active: isActive }).eq('id', staffId);
  if (!error) logAuditEvent('STAFF_ROLE_UPDATED', 'provider_staff', staffId, undefined, { action: isActive ? 'activated' : 'deactivated' });
  return { error: error?.message };
};

export interface BillRow {
  id: string;
  invoice_number: string;
  facility: string;
  status: string;
  total_tzs: number;
  bill_date: string;
  patientName: string;
}

export const fetchBills = async (): Promise<{ bills: BillRow[]; error?: string }> => {
  const { data, error } = await supabase
    .from('bills')
    .select('id, patient_id, invoice_number, facility, status, total_tzs, bill_date')
    .order('bill_date', { ascending: false })
    .limit(500);
  if (error) return { bills: [], error: error.message };
  const rows = data || [];
  const names = await namesFor(rows.map((r) => r.patient_id));
  return {
    bills: rows.map((r) => ({
      id: r.id,
      invoice_number: r.invoice_number,
      facility: r.facility,
      status: r.status,
      total_tzs: r.total_tzs,
      bill_date: r.bill_date,
      patientName: names.get(r.patient_id) || 'Patient',
    })),
  };
};

export interface DispatchRow {
  id: string;
  dispatch_ref: string;
  condition: string;
  address: string | null;
  target_facility: string | null;
  facility_distance_km: number | null;
  facility_eta_min: number | null;
  status: string;
  created_at: string;
  patientName: string;
}

export const DISPATCH_STATUSES = [
  'dispatched', 'requested', 'accepted', 'assigned', 'en_route', 'arrived', 'transporting', 'completed', 'cancelled',
];

export const fetchDispatches = async (): Promise<{ dispatches: DispatchRow[]; error?: string }> => {
  const { data, error } = await supabase
    .from('emergency_dispatches')
    .select('id, dispatch_ref, condition, address, target_facility, facility_distance_km, facility_eta_min, status, created_at, patient_id')
    .order('created_at', { ascending: false })
    .limit(200);
  if (error) return { dispatches: [], error: error.message };
  const rows = data || [];
  const names = await namesFor(rows.map((r) => r.patient_id).filter(Boolean) as string[]);
  return {
    dispatches: rows.map((r) => ({
      id: r.id,
      dispatch_ref: r.dispatch_ref,
      condition: r.condition,
      address: r.address,
      target_facility: r.target_facility,
      facility_distance_km: r.facility_distance_km,
      facility_eta_min: r.facility_eta_min,
      status: r.status,
      created_at: r.created_at,
      patientName: r.patient_id ? names.get(r.patient_id) || 'Patient' : 'Anonymous (bypass-login dispatch)',
    })),
  };
};

export const setDispatchStatus = async (id: string, status: string): Promise<{ error?: string }> => {
  const { error } = await supabase.from('emergency_dispatches').update({ status }).eq('id', id);
  return { error: error?.message };
};

export interface AuditLogRow {
  id: string;
  action: string;
  resource_type: string;
  resource_id: string | null;
  created_at: string;
  metadata: Record<string, unknown>;
  actorName: string;
  patientName: string | null;
  facilityId: string | null;
  facilityName: string | null;
}

// facility_id is a real column (see supabase/schema.sql — added
// specifically so this filter doesn't have to parse metadata.provider_id,
// which only some historical events even set, client-side and unindexed).
// Only the events this phase updated to populate it (facility create/
// update/activate/deactivate, department/service create/update/activate/
// deactivate) will actually have a facility here — doctor/staff-level
// events don't, which shows up as "no facility" in the filter rather than
// a guessed value.
export const fetchAuditLogs = async (): Promise<{ logs: AuditLogRow[]; error?: string }> => {
  const { data, error } = await supabase
    .from('audit_logs')
    .select('id, actor_id, action, resource_type, resource_id, patient_id, metadata, created_at, facility_id')
    .order('created_at', { ascending: false })
    .limit(300);
  if (error) return { logs: [], error: error.message };
  const rows = data || [];
  const names = await namesFor([...rows.map((r) => r.actor_id), ...rows.map((r) => r.patient_id)].filter(Boolean) as string[]);
  const facilityIds = [...new Set(rows.map((r) => r.facility_id).filter(Boolean))] as string[];
  const facilityNames = new Map<string, string>();
  if (facilityIds.length > 0) {
    const { data: providerRows } = await supabase.from('providers').select('id, name').in('id', facilityIds);
    for (const p of providerRows || []) facilityNames.set(p.id, p.name);
  }
  return {
    logs: rows.map((r) => ({
      id: r.id,
      action: r.action,
      resource_type: r.resource_type,
      resource_id: r.resource_id,
      created_at: r.created_at,
      metadata: r.metadata || {},
      actorName: r.actor_id ? names.get(r.actor_id) || r.actor_id.slice(0, 8) : 'System',
      patientName: r.patient_id ? names.get(r.patient_id) || null : null,
      facilityId: r.facility_id,
      facilityName: r.facility_id ? facilityNames.get(r.facility_id) || null : null,
    })),
  };
};
