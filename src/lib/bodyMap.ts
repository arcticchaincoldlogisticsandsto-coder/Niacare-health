import { supabase } from './supabaseClient';

export interface BodyMapEntry {
  id: string;
  kind: 'diagnosis' | 'imaging';
  diagnosis: string;
  bodyRegion: string;
  bodySide: 'left' | 'right' | 'bilateral' | 'midline' | null;
  notes: string | null;
  doctorName: string;
  createdAt: string;
}

interface DiagnosisRow {
  id: string;
  diagnosis: string;
  body_region: string | null;
  body_side: 'left' | 'right' | 'bilateral' | 'midline' | null;
  notes: string | null;
  doctor_profile_id: string | null;
  created_at: string;
}

interface ImagingRow {
  id: string;
  title: string;
  body_region: string | null;
  body_side: 'left' | 'right' | 'bilateral' | 'midline' | null;
  doctor_name: string | null;
  record_date: string | null;
  created_at: string;
}

// Only diagnoses/imaging a doctor tagged with a body region show up here —
// most diagnoses have no region at all (e.g. "malaria"), which is correct:
// the body map is for anatomically-locatable conditions only, not
// everything. Imaging (medical_records where category='radiology') is
// folded into the same list so "Left Knee X-Ray" and "Orthopedic
// consultation — left knee" appear together under the same region.
export const fetchBodyMapEntries = async (
  patientId: string
): Promise<{ entries: BodyMapEntry[]; error?: string }> => {
  const [diagnosesRes, imagingRes] = await Promise.all([
    supabase
      .from('diagnoses')
      .select('id, diagnosis, body_region, body_side, notes, doctor_profile_id, created_at')
      .eq('patient_id', patientId)
      .not('body_region', 'is', null)
      .order('created_at', { ascending: false }),
    supabase
      .from('medical_records')
      .select('id, title, body_region, body_side, doctor_name, record_date, created_at')
      .eq('patient_id', patientId)
      .eq('category', 'radiology')
      .not('body_region', 'is', null)
      .order('created_at', { ascending: false }),
  ]);

  const failure = diagnosesRes.error || imagingRes.error;
  if (failure) return { entries: [], error: failure.message };

  const diagnosisRows = (diagnosesRes.data || []) as DiagnosisRow[];
  const imagingRows = (imagingRes.data || []) as ImagingRow[];

  const doctorProfileIds = [...new Set(diagnosisRows.map((r) => r.doctor_profile_id).filter((id): id is string => !!id))];
  const doctorNames = new Map<string, string>();
  if (doctorProfileIds.length > 0) {
    const { data: docs } = await supabase.from('doctor_profiles').select('id, user_id').in('id', doctorProfileIds);
    const userIds = (docs || []).map((d) => d.user_id);
    const namesByUserId = new Map<string, string>();
    if (userIds.length > 0) {
      const { data: profileRows } = await supabase.from('profiles').select('id, full_name').in('id', userIds);
      for (const p of profileRows || []) namesByUserId.set(p.id, p.full_name);
    }
    for (const d of docs || []) doctorNames.set(d.id, namesByUserId.get(d.user_id) || 'Doctor');
  }

  const diagnosisEntries: BodyMapEntry[] = diagnosisRows.map((row) => ({
    id: `diagnosis-${row.id}`,
    kind: 'diagnosis',
    diagnosis: row.diagnosis,
    bodyRegion: row.body_region!,
    bodySide: row.body_side,
    notes: row.notes,
    doctorName: (row.doctor_profile_id && doctorNames.get(row.doctor_profile_id)) || 'Doctor',
    createdAt: row.created_at,
  }));

  const imagingEntries: BodyMapEntry[] = imagingRows.map((row) => ({
    id: `imaging-${row.id}`,
    kind: 'imaging',
    diagnosis: row.title,
    bodyRegion: row.body_region!,
    bodySide: row.body_side,
    notes: null,
    doctorName: row.doctor_name || 'Doctor',
    createdAt: row.record_date || row.created_at,
  }));

  return {
    entries: [...diagnosisEntries, ...imagingEntries].sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    ),
  };
};
