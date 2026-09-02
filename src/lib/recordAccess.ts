import { supabase } from './supabaseClient';

export type AccessScope = 'medical_records' | 'prescriptions' | 'lab_results' | 'diagnoses';
export type AccessRequestStatus = 'pending' | 'approved' | 'declined' | 'revoked' | 'expired';

export interface AccessRequest {
  id: string;
  patientId: string;
  requestedBy: string;
  requesterName: string;
  requesterSpecialty: string;
  requesterFacility: string;
  reason: string;
  scopes: AccessScope[];
  status: AccessRequestStatus;
  respondedAt: string | null;
  expiresAt: string | null;
  createdAt: string;
  /** Client-side check — an 'approved' row past its expiry reads as expired even before the server-side status catches up. */
  isActive: boolean;
}

interface AccessRequestRow {
  id: string;
  patient_id: string;
  requested_by: string;
  requester_doctor_profile_id: string | null;
  reason: string;
  scopes: string[];
  status: AccessRequestStatus;
  responded_at: string | null;
  expires_at: string | null;
  created_at: string;
}

// A doctor requests access using an identifier the patient shared with them
// directly (NIDA or phone, shown on their own Digital Health Passport) —
// never a search across the patient directory. See request_record_access()
// in supabase/schema.sql for why this can't be a raw insert.
export const requestRecordAccess = async (
  identifierType: 'nida' | 'phone',
  identifierValue: string,
  reason: string,
  scopes: AccessScope[]
): Promise<{ success: boolean; error?: string }> => {
  const { error } = await supabase.rpc('request_record_access', {
    p_identifier_type: identifierType,
    p_identifier_value: identifierValue,
    p_reason: reason,
    p_scopes: scopes,
  });
  if (error) return { success: false, error: error.message };
  return { success: true };
};

// Fetches requests naming this patient, resolving the requesting doctor's
// name/specialty/facility for display (all publicly readable to an
// authenticated user — see "Clinical staff profiles are publicly viewable"
// and "Doctor profiles are publicly viewable" in supabase/schema.sql).
export const fetchAccessRequestsForPatient = async (
  patientId: string
): Promise<{ requests: AccessRequest[]; error?: string }> => {
  const { data, error } = await supabase
    .from('record_access_requests')
    .select('*')
    .eq('patient_id', patientId)
    .order('created_at', { ascending: false });

  if (error) return { requests: [], error: error.message };
  const rows = (data || []) as AccessRequestRow[];

  const doctorProfileIds = rows.map((r) => r.requester_doctor_profile_id).filter((id): id is string => !!id);
  const doctorInfo = new Map<string, { userId: string; specialty: string; providerId: string | null }>();
  if (doctorProfileIds.length > 0) {
    const { data: docs } = await supabase
      .from('doctor_profiles')
      .select('id, user_id, specialty, provider_id')
      .in('id', doctorProfileIds);
    for (const d of docs || []) doctorInfo.set(d.id, { userId: d.user_id, specialty: d.specialty, providerId: d.provider_id });
  }

  const userIds = [...doctorInfo.values()].map((d) => d.userId);
  const namesByUserId = new Map<string, string>();
  if (userIds.length > 0) {
    const { data: profileRows } = await supabase.from('profiles').select('id, full_name').in('id', userIds);
    for (const p of profileRows || []) namesByUserId.set(p.id, p.full_name);
  }

  const providerIds = [...doctorInfo.values()].map((d) => d.providerId).filter((id): id is string => !!id);
  const facilityByProviderId = new Map<string, string>();
  if (providerIds.length > 0) {
    const { data: providerRows } = await supabase.from('providers').select('id, name').in('id', providerIds);
    for (const p of providerRows || []) facilityByProviderId.set(p.id, p.name);
  }

  const requests: AccessRequest[] = rows.map((row) => {
    const info = row.requester_doctor_profile_id ? doctorInfo.get(row.requester_doctor_profile_id) : undefined;
    const now = Date.now();
    const notExpired = !row.expires_at || new Date(row.expires_at).getTime() > now;
    return {
      id: row.id,
      patientId: row.patient_id,
      requestedBy: row.requested_by,
      requesterName: (info && namesByUserId.get(info.userId)) || 'Doctor',
      requesterSpecialty: info?.specialty || '',
      requesterFacility: (info?.providerId && facilityByProviderId.get(info.providerId)) || '',
      reason: row.reason,
      scopes: (row.scopes || []) as AccessScope[],
      status: row.status,
      respondedAt: row.responded_at,
      expiresAt: row.expires_at,
      createdAt: row.created_at,
      isActive: row.status === 'approved' && notExpired,
    };
  });

  return { requests };
};

export const fetchMyAccessRequests = async (
  doctorAuthUserId: string
): Promise<{ requests: AccessRequest[]; error?: string }> => {
  const { data, error } = await supabase
    .from('record_access_requests')
    .select('*')
    .eq('requested_by', doctorAuthUserId)
    .order('created_at', { ascending: false });

  if (error) return { requests: [], error: error.message };
  const rows = (data || []) as AccessRequestRow[];
  const now = Date.now();
  return {
    requests: rows.map((row) => ({
      id: row.id,
      patientId: row.patient_id,
      requestedBy: row.requested_by,
      requesterName: '',
      requesterSpecialty: '',
      requesterFacility: '',
      reason: row.reason,
      scopes: (row.scopes || []) as AccessScope[],
      status: row.status,
      respondedAt: row.responded_at,
      expiresAt: row.expires_at,
      createdAt: row.created_at,
      isActive: row.status === 'approved' && (!row.expires_at || new Date(row.expires_at).getTime() > now),
    })),
  };
};

export const respondToAccessRequest = async (
  requestId: string,
  approve: boolean,
  days: number = 7
): Promise<{ success: boolean; error?: string }> => {
  const { error } = await supabase.rpc('respond_to_access_request', {
    p_request_id: requestId,
    p_approve: approve,
    p_days: days,
  });
  if (error) return { success: false, error: error.message };
  return { success: true };
};

export const revokeAccessGrant = async (requestId: string): Promise<{ success: boolean; error?: string }> => {
  const { error } = await supabase.rpc('revoke_access_grant', { p_request_id: requestId });
  if (error) return { success: false, error: error.message };
  return { success: true };
};

export interface RecordAccessLogEntry {
  id: string;
  actorName: string;
  action: string;
  accessedAt: string;
}

// A minimal, patient-safe read of audit_logs via fetch_patient_record_access_log()
// — audit_logs itself stays admin-only; see that function in schema.sql for
// exactly which action types and rows this can ever return (always the
// caller's own patient_id, never another patient's).
export const fetchPatientRecordAccessLog = async (
  limit = 30
): Promise<{ entries: RecordAccessLogEntry[]; error?: string }> => {
  const { data, error } = await supabase.rpc('fetch_patient_record_access_log', { p_limit: limit });
  if (error) return { entries: [], error: error.message };
  return {
    entries: ((data || []) as { id: string; actor_name: string; action: string; accessed_at: string }[]).map((row) => ({
      id: row.id,
      actorName: row.actor_name,
      action: row.action,
      accessedAt: row.accessed_at,
    })),
  };
};
