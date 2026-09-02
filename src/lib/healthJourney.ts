import { supabase } from './supabaseClient';
import { fetchPatientLabOrders } from './laboratory';

export interface HealthJourneyEntry {
  id: string;
  date: string;
  type: 'encounter' | 'referral' | 'imaging' | 'lab';
  title: string;
  facilityName: string;
  doctorName: string;
  specialty: string;
  subItems: string[];
  /** Only set for type 'imaging' — the medical_records.id to open in the Imaging detail view. */
  recordId?: string;
  /** doctor_profiles.id — only set when the underlying encounter/referral actually recorded one. Never inferred for imaging (medical_records has no doctor relationship column) or lab (lab_orders has one, but there's no per-result detail view to deep-link into yet — see onViewLabResults). */
  doctorProfileId?: string;
  /** Only set for type 'encounter' — encounters.follow_up_note, written by the doctor when completing the visit. Never auto-books anything; the patient still confirms through the normal booking flow. */
  followUpNote?: string;
  /** Only set for type 'lab' — lab_results.interpretation, when a result has actually been entered. */
  labInterpretation?: 'normal' | 'abnormal' | 'critical';
  /** providers.id — set for encounter/referral/lab entries (all have a real provider_id column). Never set for imaging: medical_records has no provider FK, only free-text hospital_name. */
  facilityId?: string;
  /** Set only when the underlying record actually carries an anatomical tag — imaging's own body_region, or (for encounters) the first tagged diagnosis from that visit. Never inferred or defaulted; most entries have none, which is correct. Pass to bodyMapRegionKey() for a Body Map deep link. */
  bodyRegion?: string;
  bodySide?: 'left' | 'right' | 'bilateral' | 'midline' | null;
}

interface EncounterRow {
  id: string;
  chief_complaint: string | null;
  status: string;
  started_at: string;
  doctor_profile_id: string | null;
  provider_id: string | null;
  follow_up_note: string | null;
}

interface ImagingRecordRow {
  id: string;
  title: string;
  hospital_name: string;
  doctor_name: string;
  record_date: string;
  body_region: string | null;
  body_side: 'left' | 'right' | 'bilateral' | 'midline' | null;
}

// A patient's own chronological healthcare timeline — every encounter they
// were part of (any doctor, any facility, not scoped to one doctor's own
// view the way fetchDoctorPatientHistory is), with diagnoses/prescriptions/
// lab orders from that same visit folded in as sub-items, plus referrals as
// their own timeline entries. Pure aggregation over existing RLS-protected
// reads — no new table, this patient already has SELECT on all of it.
export const fetchHealthJourney = async (
  patientId: string
): Promise<{ entries: HealthJourneyEntry[]; error?: string }> => {
  const [encountersRes, diagnosesRes, prescriptionsRes, labOrdersRes, referralsRes, imagingRes, patientLabOrders] = await Promise.all([
    supabase
      .from('encounters')
      .select('id, chief_complaint, status, started_at, doctor_profile_id, provider_id, follow_up_note')
      .eq('patient_id', patientId)
      .order('started_at', { ascending: false })
      .limit(30),
    supabase.from('diagnoses').select('encounter_id, diagnosis, body_region, body_side').eq('patient_id', patientId),
    supabase.from('prescriptions').select('encounter_id, medication_name').eq('patient_id', patientId).not('encounter_id', 'is', null),
    supabase.from('lab_orders').select('encounter_id, test_name').eq('patient_id', patientId).not('encounter_id', 'is', null),
    supabase
      .from('referrals')
      .select('id, destination_specialty, destination_provider_id, referring_doctor_profile_id, reason, created_at')
      .eq('patient_id', patientId)
      .order('created_at', { ascending: false })
      .limit(20),
    supabase
      .from('medical_records')
      .select('id, title, hospital_name, doctor_name, record_date, body_region, body_side')
      .eq('patient_id', patientId)
      .eq('category', 'radiology')
      .order('record_date', { ascending: false })
      .limit(30),
    // Reuses the same patient-facing lab fetch LaboratoryModal already uses
    // — no separate query logic for the Journey's lab timeline entries.
    fetchPatientLabOrders(patientId),
  ]);

  const failure =
    encountersRes.error?.message || diagnosesRes.error?.message || prescriptionsRes.error?.message ||
    labOrdersRes.error?.message || referralsRes.error?.message || imagingRes.error?.message || patientLabOrders.error;
  if (failure) return { entries: [], error: failure };

  const encounters = (encountersRes.data || []) as EncounterRow[];
  const referrals = referralsRes.data || [];
  const imagingRecords = (imagingRes.data || []) as ImagingRecordRow[];

  const diagnosesByEncounter = new Map<string, string[]>();
  // First body-region-tagged diagnosis per encounter, if any — most
  // diagnoses (e.g. "malaria") carry no region at all, which is correct;
  // only encounters with a genuinely anatomically-locatable diagnosis get a
  // Body Map deep link.
  const bodyRegionByEncounter = new Map<string, { region: string; side: HealthJourneyEntry['bodySide'] }>();
  for (const d of diagnosesRes.data || []) {
    if (!d.encounter_id) continue;
    diagnosesByEncounter.set(d.encounter_id, [...(diagnosesByEncounter.get(d.encounter_id) || []), d.diagnosis]);
    if (d.body_region && !bodyRegionByEncounter.has(d.encounter_id)) {
      bodyRegionByEncounter.set(d.encounter_id, { region: d.body_region, side: d.body_side });
    }
  }
  const hasPrescriptionByEncounter = new Set((prescriptionsRes.data || []).map((p) => p.encounter_id as string));
  const hasLabByEncounter = new Set((labOrdersRes.data || []).map((l) => l.encounter_id as string));

  const labOrders = patientLabOrders.orders || [];

  const doctorProfileIds = [
    ...new Set([
      ...encounters.map((e) => e.doctor_profile_id).filter((id): id is string => !!id),
      ...referrals.map((r) => r.referring_doctor_profile_id).filter((id): id is string => !!id),
      ...labOrders.map((l) => l.doctor_profile_id).filter((id): id is string => !!id),
    ]),
  ];
  const doctorInfo = new Map<string, { userId: string; specialty: string }>();
  if (doctorProfileIds.length > 0) {
    const { data: docs } = await supabase.from('doctor_profiles').select('id, user_id, specialty').in('id', doctorProfileIds);
    for (const d of docs || []) doctorInfo.set(d.id, { userId: d.user_id, specialty: d.specialty });
  }
  const userIds = [...doctorInfo.values()].map((d) => d.userId);
  const namesByUserId = new Map<string, string>();
  if (userIds.length > 0) {
    const { data: profileRows } = await supabase.from('profiles').select('id, full_name').in('id', userIds);
    for (const p of profileRows || []) namesByUserId.set(p.id, p.full_name);
  }

  const providerIds = [
    ...new Set([
      ...encounters.map((e) => e.provider_id).filter((id): id is string => !!id),
      ...referrals.map((r) => r.destination_provider_id).filter((id): id is string => !!id),
      ...labOrders.map((l) => l.provider_id).filter((id): id is string => !!id),
    ]),
  ];
  const providerNames = new Map<string, string>();
  if (providerIds.length > 0) {
    const { data: providerRows } = await supabase.from('providers').select('id, name').in('id', providerIds);
    for (const p of providerRows || []) providerNames.set(p.id, p.name);
  }

  const doctorLabel = (doctorProfileId: string | null) => {
    if (!doctorProfileId) return { name: 'Doctor', specialty: '' };
    const info = doctorInfo.get(doctorProfileId);
    return { name: (info && namesByUserId.get(info.userId)) || 'Doctor', specialty: info?.specialty || '' };
  };

  const encounterEntries: HealthJourneyEntry[] = encounters.map((e) => {
    const { name, specialty } = doctorLabel(e.doctor_profile_id);
    const subItems = [...(diagnosesByEncounter.get(e.id) || [])];
    if (hasPrescriptionByEncounter.has(e.id)) subItems.push('Prescription added');
    if (hasLabByEncounter.has(e.id)) subItems.push('Lab test requested');
    const bodyTag = bodyRegionByEncounter.get(e.id);
    return {
      id: `encounter-${e.id}`,
      date: e.started_at,
      type: 'encounter',
      title: e.chief_complaint || (specialty ? `${specialty} Consultation` : 'Consultation'),
      facilityName: (e.provider_id && providerNames.get(e.provider_id)) || '',
      facilityId: e.provider_id || undefined,
      doctorName: name,
      doctorProfileId: e.doctor_profile_id || undefined,
      specialty,
      subItems,
      followUpNote: e.follow_up_note || undefined,
      bodyRegion: bodyTag?.region,
      bodySide: bodyTag?.side,
    };
  });

  const referralEntries: HealthJourneyEntry[] = referrals.map((r) => {
    const { name } = doctorLabel(r.referring_doctor_profile_id);
    return {
      id: `referral-${r.id}`,
      date: r.created_at,
      type: 'referral',
      title: `Referral to ${r.destination_specialty}`,
      facilityName: (r.destination_provider_id && providerNames.get(r.destination_provider_id)) || '',
      facilityId: r.destination_provider_id || undefined,
      doctorName: name,
      doctorProfileId: r.referring_doctor_profile_id || undefined,
      specialty: r.destination_specialty,
      subItems: [r.reason],
    };
  });

  const imagingEntries: HealthJourneyEntry[] = imagingRecords.map((r) => ({
    id: `imaging-${r.id}`,
    date: r.record_date,
    type: 'imaging',
    title: r.title,
    facilityName: r.hospital_name || '',
    doctorName: r.doctor_name || '',
    specialty: '',
    subItems: r.body_region ? [r.body_region] : [],
    recordId: r.id,
    bodyRegion: r.body_region || undefined,
    bodySide: r.body_side,
  }));

  const labEntries: HealthJourneyEntry[] = labOrders.map((l) => {
    const { name } = doctorLabel(l.doctor_profile_id);
    return {
      id: `lab-${l.id}`,
      date: l.created_at,
      type: 'lab',
      title: l.test_name,
      facilityName: (l.provider_id && providerNames.get(l.provider_id)) || '',
      facilityId: l.provider_id || undefined,
      doctorName: name,
      doctorProfileId: l.doctor_profile_id || undefined,
      specialty: '',
      subItems: l.result?.summary ? [l.result.summary] : [],
      labInterpretation: l.result?.interpretation as HealthJourneyEntry['labInterpretation'],
    };
  });

  const entries = [...encounterEntries, ...referralEntries, ...imagingEntries, ...labEntries].sort(
    (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
  );

  return { entries };
};
