import { supabase } from './supabaseClient';
import { MedicalRecord, PersonalFileItem } from '../data/medicalRecords';

const CATEGORY_LABELS: Record<MedicalRecord['category'], { sw: string; en: string }> = {
  lab: { sw: 'Maabara (Lab)', en: 'Laboratory' },
  radiology: { sw: 'Radiolojia (Imaging)', en: 'Radiology' },
  consultation: { sw: 'Muhtasari wa Daktari', en: 'Clinical Summary' },
  vaccine: { sw: 'Chanjo (Vaccine)', en: 'Immunization' },
  prescription: { sw: 'Dawa (Prescription)', en: 'Prescription' },
};

interface MedicalRecordRow {
  id: string;
  title: string;
  category: MedicalRecord['category'];
  hospital_name: string;
  doctor_name: string;
  record_date: string;
  department: string;
  status: MedicalRecord['status'];
  summary_en: string;
  summary_sw: string;
  details: MedicalRecord['details'] | null;
  pdf_file_name: string | null;
}

const mapRowToRecord = (row: MedicalRecordRow): MedicalRecord => ({
  id: row.id,
  title: row.title,
  category: row.category,
  categoryLabel: CATEGORY_LABELS[row.category],
  hospitalName: row.hospital_name,
  doctorName: row.doctor_name,
  date: row.record_date,
  department: row.department,
  status: row.status,
  summary: { sw: row.summary_sw, en: row.summary_en },
  details: row.details || undefined,
  pdfFileName: row.pdf_file_name || `${row.id}_Medical_Report.pdf`,
});

export const fetchMedicalRecords = async (
  patientId: string
): Promise<{ records: MedicalRecord[]; error?: string }> => {
  const { data, error } = await supabase
    .from('medical_records')
    .select('*')
    .eq('patient_id', patientId)
    .order('record_date', { ascending: false });

  if (error) return { records: [], error: error.message };
  return { records: (data as MedicalRecordRow[]).map(mapRowToRecord) };
};

export const insertMedicalRecord = async (
  patientId: string,
  record: {
    title: string;
    category: MedicalRecord['category'];
    hospitalName: string;
    doctorName: string;
    date: string;
    department: string;
    status: MedicalRecord['status'];
    summaryEn: string;
    summarySw: string;
    details?: MedicalRecord['details'];
  }
): Promise<{ record?: MedicalRecord; error?: string }> => {
  const { data, error } = await supabase
    .from('medical_records')
    .insert({
      patient_id: patientId,
      title: record.title,
      category: record.category,
      hospital_name: record.hospitalName,
      doctor_name: record.doctorName,
      record_date: record.date,
      department: record.department,
      status: record.status,
      summary_en: record.summaryEn,
      summary_sw: record.summarySw,
      details: record.details || null,
    })
    .select('*')
    .single();

  if (error) return { error: error.message };
  return { record: mapRowToRecord(data as MedicalRecordRow) };
};

interface PersonalFileRow {
  id: string;
  title: string;
  category: PersonalFileItem['category'];
  date_added: string;
  facility: string;
  source: PersonalFileItem['source'];
  file_size: string;
  record_id: string | null;
  pdf_file_name: string | null;
  notes: string | null;
  file_url: string | null;
  is_encrypted: boolean;
  starred: boolean;
}

const mapRowToPersonalFile = (row: PersonalFileRow): PersonalFileItem => ({
  id: row.id,
  title: row.title,
  category: row.category,
  categoryLabel: { sw: row.title, en: row.title },
  dateAdded: row.date_added,
  facility: row.facility,
  source: row.source,
  fileSize: row.file_size,
  recordId: row.record_id || undefined,
  pdfFileName: row.pdf_file_name || `${row.id}.pdf`,
  notes: row.notes || undefined,
  fileUrl: row.file_url || undefined,
  isEncrypted: row.is_encrypted,
  starred: row.starred,
});

export const fetchPersonalFiles = async (
  patientId: string
): Promise<{ files: PersonalFileItem[]; error?: string }> => {
  const { data, error } = await supabase
    .from('personal_files')
    .select('*')
    .eq('patient_id', patientId)
    .order('created_at', { ascending: false });

  if (error) return { files: [], error: error.message };
  return { files: (data as PersonalFileRow[]).map(mapRowToPersonalFile) };
};

export const insertPersonalFile = async (
  patientId: string,
  file: Omit<PersonalFileItem, 'id'>
): Promise<{ file?: PersonalFileItem; error?: string }> => {
  const { data, error } = await supabase
    .from('personal_files')
    .insert({
      patient_id: patientId,
      title: file.title,
      category: file.category,
      date_added: file.dateAdded,
      facility: file.facility,
      source: file.source,
      file_size: file.fileSize,
      record_id: file.recordId,
      pdf_file_name: file.pdfFileName,
      notes: file.notes,
      file_url: file.fileUrl,
      is_encrypted: file.isEncrypted,
      starred: file.starred || false,
    })
    .select('*')
    .single();

  if (error) return { error: error.message };
  return { file: mapRowToPersonalFile(data as PersonalFileRow) };
};

export const deletePersonalFile = async (id: string): Promise<{ success: boolean; error?: string }> => {
  const { error } = await supabase.from('personal_files').delete().eq('id', id);
  if (error) return { success: false, error: error.message };
  return { success: true };
};

export const updatePersonalFileStarred = async (
  id: string,
  starred: boolean
): Promise<{ success: boolean; error?: string }> => {
  const { error } = await supabase.from('personal_files').update({ starred }).eq('id', id);
  if (error) return { success: false, error: error.message };
  return { success: true };
};

export const updatePersonalFileNotes = async (
  id: string,
  notes: string
): Promise<{ success: boolean; error?: string }> => {
  const { error } = await supabase.from('personal_files').update({ notes }).eq('id', id);
  if (error) return { success: false, error: error.message };
  return { success: true };
};
