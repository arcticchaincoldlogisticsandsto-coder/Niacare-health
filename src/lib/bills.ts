import { supabase } from './supabaseClient';
import { MedicalBill } from '../components/CheckoutProcedureModal';

interface BillRow {
  id: string;
  invoice_number: string;
  facility: string;
  department: string | null;
  bill_date: string;
  status: MedicalBill['status'];
  items: MedicalBill['items'];
  total_tzs: number;
  total_usd: number;
}

const mapRowToBill = (row: BillRow): MedicalBill => ({
  id: row.id,
  invoiceNumber: row.invoice_number,
  facility: row.facility,
  department: row.department || '',
  date: row.bill_date,
  status: row.status,
  items: row.items,
  totalTzs: row.total_tzs,
  totalUsd: row.total_usd,
});

export const fetchBills = async (
  patientId: string
): Promise<{ bills: MedicalBill[]; error?: string }> => {
  const { data, error } = await supabase
    .from('bills')
    .select('*')
    .eq('patient_id', patientId)
    .order('created_at', { ascending: false });

  if (error) return { bills: [], error: error.message };
  return { bills: (data as BillRow[]).map(mapRowToBill) };
};

export const insertBill = async (
  patientId: string,
  appointmentId: string | null,
  bill: Omit<MedicalBill, 'id' | 'status'>
): Promise<{ bill?: MedicalBill; error?: string }> => {
  const { data, error } = await supabase
    .from('bills')
    .insert({
      patient_id: patientId,
      appointment_id: appointmentId,
      invoice_number: bill.invoiceNumber,
      facility: bill.facility,
      department: bill.department,
      bill_date: bill.date,
      status: 'pending',
      items: bill.items,
      total_tzs: bill.totalTzs,
      total_usd: bill.totalUsd,
    })
    .select('*')
    .single();

  if (error) return { error: error.message };
  return { bill: mapRowToBill(data as BillRow) };
};

// Settlement is no longer a raw client UPDATE (RLS no longer grants patients
// direct write access to bills — see supabase/schema.sql). This calls a
// SECURITY DEFINER function that validates the bill belongs to the caller
// and isn't already settled, then records it as a real payment. Still
// simulated in the sense that no real payment gateway sits behind it yet,
// but the trust boundary is now a server-side function, not an open column.
export type PaymentMethod = 'insurance' | 'cash' | 'mobile_money' | 'bank_transfer' | 'card';

export const settleBill = async (
  id: string,
  settlementMethod: PaymentMethod,
  settlementRef: string
): Promise<{ success: boolean; error?: string }> => {
  const { error } = await supabase.rpc('settle_bill_as_patient', {
    p_bill_id: id,
    p_method: settlementMethod,
    p_ref: settlementRef,
  });

  if (error) return { success: false, error: error.message };
  return { success: true };
};
