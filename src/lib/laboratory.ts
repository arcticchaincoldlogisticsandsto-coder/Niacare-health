import { supabase } from './supabaseClient';

export interface LabOrderRow {
  id: string;
  patient_id: string;
  doctor_profile_id: string | null;
  provider_id: string | null;
  test_name: string;
  notes: string | null;
  status: string;
  created_at: string;
  patientName?: string;
}

export interface LabResultRow {
  id: string;
  lab_order_id: string;
  result_value: string | null;
  reference_range: string | null;
  interpretation: string;
  summary: string | null;
  created_at: string;
}

const namesFor = async (userIds: string[]): Promise<Map<string, string>> => {
  const unique = Array.from(new Set(userIds.filter(Boolean)));
  const map = new Map<string, string>();
  if (unique.length === 0) return map;
  const { data } = await supabase.from('profiles').select('id, full_name').in('id', unique);
  for (const row of data || []) map.set(row.id, row.full_name);
  return map;
};

export const createLabOrder = async (
  patientId: string,
  doctorProfileId: string,
  providerId: string | null,
  encounterId: string | null,
  testName: string,
  notes: string
): Promise<{ error?: string }> => {
  const { error } = await supabase.from('lab_orders').insert({
    patient_id: patientId,
    doctor_profile_id: doctorProfileId,
    provider_id: providerId,
    encounter_id: encounterId,
    test_name: testName,
    notes,
    created_by: (await supabase.auth.getUser()).data.user?.id,
  });
  return { error: error?.message };
};

export const fetchDoctorLabOrders = async (doctorProfileId: string): Promise<{ orders: LabOrderRow[]; error?: string }> => {
  const { data, error } = await supabase
    .from('lab_orders')
    .select('id, patient_id, doctor_profile_id, provider_id, test_name, notes, status, created_at')
    .eq('doctor_profile_id', doctorProfileId)
    .order('created_at', { ascending: false });
  if (error) return { orders: [], error: error.message };
  const rows = data || [];
  const names = await namesFor(rows.map((r) => r.patient_id));
  return { orders: rows.map((r) => ({ ...r, patientName: names.get(r.patient_id) || 'Patient' })) };
};

export const fetchProviderLabOrders = async (providerId: string): Promise<{ orders: LabOrderRow[]; error?: string }> => {
  const { data, error } = await supabase
    .from('lab_orders')
    .select('id, patient_id, doctor_profile_id, provider_id, test_name, notes, status, created_at')
    .eq('provider_id', providerId)
    .order('created_at', { ascending: false });
  if (error) return { orders: [], error: error.message };
  const rows = data || [];
  const names = await namesFor(rows.map((r) => r.patient_id));
  return { orders: rows.map((r) => ({ ...r, patientName: names.get(r.patient_id) || 'Patient' })) };
};

export const updateLabOrderStatus = async (id: string, status: string): Promise<{ error?: string }> => {
  const { error } = await supabase.from('lab_orders').update({ status }).eq('id', id);
  return { error: error?.message };
};

export const enterLabResult = async (
  labOrderId: string,
  patientId: string,
  resultValue: string,
  referenceRange: string,
  interpretation: 'normal' | 'abnormal' | 'critical',
  summary: string
): Promise<{ error?: string }> => {
  const { error } = await supabase.from('lab_results').insert({
    lab_order_id: labOrderId,
    patient_id: patientId,
    result_value: resultValue,
    reference_range: referenceRange,
    interpretation,
    summary,
    entered_by: (await supabase.auth.getUser()).data.user?.id,
  });
  return { error: error?.message };
};

export const fetchPatientLabOrders = async (patientId: string): Promise<{ orders: (LabOrderRow & { result?: LabResultRow })[]; error?: string }> => {
  const { data, error } = await supabase
    .from('lab_orders')
    .select('id, patient_id, doctor_profile_id, provider_id, test_name, notes, status, created_at')
    .eq('patient_id', patientId)
    .order('created_at', { ascending: false });
  if (error) return { orders: [], error: error.message };
  const rows = data || [];
  const ids = rows.map((r) => r.id);
  let results: LabResultRow[] = [];
  if (ids.length > 0) {
    const { data: resultRows } = await supabase.from('lab_results').select('*').in('lab_order_id', ids);
    results = (resultRows || []) as LabResultRow[];
  }
  const byOrderId = new Map(results.map((r) => [r.lab_order_id, r]));
  return { orders: rows.map((r) => ({ ...r, result: byOrderId.get(r.id) })) };
};
