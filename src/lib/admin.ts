import { supabase } from './supabaseClient';

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
}

export const fetchProviders = async (): Promise<{ providers: ProviderRow[]; error?: string }> => {
  const { data, error } = await supabase
    .from('providers')
    .select('id, name, region, type, address, phone, emergency_phone, email, is_active, nhif_enabled')
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
}

export const createProvider = async (payload: ProviderUpsertInput): Promise<{ error?: string }> => {
  const { error } = await supabase.from('providers').insert(payload);
  return { error: error?.message };
};

export const updateProvider = async (id: string, payload: ProviderUpsertInput): Promise<{ error?: string }> => {
  const { error } = await supabase.from('providers').update(payload).eq('id', id);
  return { error: error?.message };
};

export const setProviderActive = async (id: string, isActive: boolean): Promise<{ error?: string }> => {
  const { error } = await supabase.from('providers').update({ is_active: isActive }).eq('id', id);
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
      .select('id, user_id, specialty, sub_specialty, is_verified, is_active')
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
}

export const fetchAuditLogs = async (): Promise<{ logs: AuditLogRow[]; error?: string }> => {
  const { data, error } = await supabase
    .from('audit_logs')
    .select('id, actor_id, action, resource_type, resource_id, patient_id, metadata, created_at')
    .order('created_at', { ascending: false })
    .limit(300);
  if (error) return { logs: [], error: error.message };
  const rows = data || [];
  const names = await namesFor([...rows.map((r) => r.actor_id), ...rows.map((r) => r.patient_id)].filter(Boolean) as string[]);
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
    })),
  };
};
