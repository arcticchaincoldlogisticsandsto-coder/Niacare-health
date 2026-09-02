import { supabase } from './supabaseClient';

export type ClaimStatus = 'submitted' | 'under_review' | 'approved' | 'rejected' | 'paid';

export interface Claim {
  id: string;
  billId: string;
  insuranceProvider: string;
  claimAmountTzs: number;
  status: ClaimStatus;
  referenceNumber: string | null;
  submittedAt: string;
}

interface ClaimRow {
  id: string;
  bill_id: string;
  insurance_provider: string;
  claim_amount_tzs: number;
  status: ClaimStatus;
  reference_number: string | null;
  submitted_at: string;
}

const mapRow = (row: ClaimRow): Claim => ({
  id: row.id,
  billId: row.bill_id,
  insuranceProvider: row.insurance_provider,
  claimAmountTzs: row.claim_amount_tzs,
  status: row.status,
  referenceNumber: row.reference_number,
  submittedAt: row.submitted_at,
});

export const fetchClaimsForPatient = async (
  patientId: string
): Promise<{ claims: Claim[]; error?: string }> => {
  const { data, error } = await supabase
    .from('claims')
    .select('*')
    .eq('patient_id', patientId)
    .order('submitted_at', { ascending: false });

  if (error) return { claims: [], error: error.message };
  return { claims: (data as ClaimRow[]).map(mapRow) };
};

// Billing-staff action — submitting a claim to the patient's insurer for an
// insurance-covered bill. RLS scopes this to staff at the bill's own
// facility (see supabase/schema.sql); no dedicated UI ships for this yet,
// but the table/policies are ready for one.
export const submitClaim = async (
  billId: string,
  patientId: string,
  insuranceProvider: string,
  claimAmountTzs: number
): Promise<{ success: boolean; error?: string }> => {
  const { error } = await supabase.from('claims').insert({
    bill_id: billId,
    patient_id: patientId,
    insurance_provider: insuranceProvider,
    claim_amount_tzs: claimAmountTzs,
  });
  if (error) return { success: false, error: error.message };
  return { success: true };
};

export interface InsuranceBillRow {
  billId: string;
  invoiceNumber: string;
  patientId: string;
  patientName: string;
  totalTzs: number;
  insuranceProvider: string;
  existingClaim: Claim | null;
}

// Facility billing staff's worklist: insurance-covered bills at their own
// facility, joined against any claim already submitted for each one (so the
// UI can offer "Submit Claim" only where one doesn't exist yet).
export const fetchInsuranceBillsForProvider = async (
  providerId: string
): Promise<{ rows: InsuranceBillRow[]; error?: string }> => {
  const { data: appts, error: apptErr } = await supabase
    .from('appointments')
    .select('id, insurance_provider, patient_id, patient_name')
    .eq('provider_id', providerId)
    .eq('insurance_covered', true);
  if (apptErr) return { rows: [], error: apptErr.message };

  const apptIds = (appts || []).map((a) => a.id);
  if (apptIds.length === 0) return { rows: [] };

  const apptById = new Map(
    (appts || []).map((a) => [a.id, { insuranceProvider: a.insurance_provider || '', patientId: a.patient_id, patientName: a.patient_name || 'Patient' }])
  );

  const { data: bills, error: billErr } = await supabase
    .from('bills')
    .select('id, invoice_number, appointment_id, total_tzs')
    .in('appointment_id', apptIds);
  if (billErr) return { rows: [], error: billErr.message };

  const billIds = (bills || []).map((b) => b.id);
  const claimsByBillId = new Map<string, Claim>();
  if (billIds.length > 0) {
    const { data: claimRows } = await supabase.from('claims').select('*').in('bill_id', billIds);
    for (const row of (claimRows || []) as ClaimRow[]) claimsByBillId.set(row.bill_id, mapRow(row));
  }

  return {
    rows: (bills || []).map((b) => {
      const appt = apptById.get(b.appointment_id!);
      return {
        billId: b.id,
        invoiceNumber: b.invoice_number,
        patientId: appt?.patientId || '',
        patientName: appt?.patientName || 'Patient',
        totalTzs: b.total_tzs,
        insuranceProvider: appt?.insuranceProvider || '',
        existingClaim: claimsByBillId.get(b.id) || null,
      };
    }),
  };
};

export const updateClaimStatus = async (
  claimId: string,
  status: ClaimStatus,
  referenceNumber?: string
): Promise<{ success: boolean; error?: string }> => {
  const { error } = await supabase
    .from('claims')
    .update({ status, ...(referenceNumber ? { reference_number: referenceNumber } : {}) })
    .eq('id', claimId);
  if (error) return { success: false, error: error.message };
  return { success: true };
};
