export interface LabTestParam {
  name: string;
  value: string;
  unit: string;
  referenceRange: string;
  status: 'normal' | 'low' | 'high' | 'negative' | 'positive';
}

export interface MedicalRecord {
  id: string;
  title: string;
  category: 'lab' | 'radiology' | 'consultation' | 'vaccine' | 'prescription';
  categoryLabel: { sw: string; en: string };
  hospitalName: string;
  doctorName: string;
  date: string;
  department: string;
  status: 'verified' | 'clear' | 'normal' | 'pending';
  summary: { sw: string; en: string };
  details?: {
    labParams?: LabTestParam[];
    clinicalImpression?: { sw: string; en: string };
    radiologyFindings?: { sw: string; en: string };
    recommendation?: { sw: string; en: string };
    certificateNumber?: string;
    validity?: string;
  };
  pdfFileName: string;
}

export interface PersonalFileItem {
  id: string;
  title: string;
  category: 'hospital_report' | 'lab_result' | 'vaccine_cert' | 'prescription' | 'scan_image' | 'custom_upload';
  categoryLabel: { sw: string; en: string };
  dateAdded: string;
  facility: string;
  source: 'hospital_sync' | 'user_upload' | 'downloaded_pdf';
  fileSize: string;
  recordId?: string;
  pdfFileName: string;
  notes?: string;
  fileUrl?: string;
  isEncrypted: boolean;
  starred?: boolean;
}

export const INITIAL_PERSONAL_FILES: PersonalFileItem[] = [
  {
    id: 'FILE-PF-001',
    title: 'Kipimo cha Damu Kamili (Full Blood Picture & CBC).pdf',
    category: 'lab_result',
    categoryLabel: { sw: 'Majibu ya Maabara', en: 'Lab Report' },
    dateAdded: '12 Agosti 2026',
    facility: 'The Aga Khan Hospital, Dar es Salaam',
    source: 'hospital_sync',
    fileSize: '482 KB',
    recordId: 'REC-TZ-2026-881',
    pdfFileName: 'AgaKhan_Full_Blood_Picture_Report_881.pdf',
    notes: 'Kipimo cha damu kiko kawaida. Hemoglobin 13.8 g/dL.',
    isEncrypted: true,
    starred: true,
  },
  {
    id: 'FILE-PF-002',
    title: 'Cheti cha Chanjo ya Homa ya Manjano (WHO Yellow Fever).pdf',
    category: 'vaccine_cert',
    categoryLabel: { sw: 'Cheti cha Chanjo', en: 'Vaccine Passport' },
    dateAdded: '04 Mei 2026',
    facility: 'Tanzania Port Health Authority (MoH)',
    source: 'hospital_sync',
    fileSize: '620 KB',
    recordId: 'REC-TZ-2026-490',
    pdfFileName: 'WHO_Yellow_Fever_Certificate_TZ_490.pdf',
    notes: 'Cheti halali cha kimataifa cha safari (Valid for life).',
    isEncrypted: true,
    starred: true,
  },
  {
    id: 'FILE-PF-003',
    title: 'Ushauri wa Moyo na Grafu ya ECG (JKCI Cardiology).pdf',
    category: 'hospital_report',
    categoryLabel: { sw: 'Ripoti ya Daktari', en: 'Clinical Summary' },
    dateAdded: '15 Juni 2026',
    facility: 'Jakaya Kikwete Cardiac Institute (JKCI)',
    source: 'hospital_sync',
    fileSize: '512 KB',
    recordId: 'REC-TZ-2026-619',
    pdfFileName: 'JKCI_Cardiology_Consultation_ECG_619.pdf',
    notes: 'Shinikizo la damu 120/80 mmHg, mdundo wa kawaida 72 bpm.',
    isEncrypted: true,
    starred: false,
  },
  {
    id: 'FILE-PF-004',
    title: 'Picha ya X-Ray ya Kifua (Muhimbili Radiology).pdf',
    category: 'scan_image',
    categoryLabel: { sw: 'Picha ya Mionzi', en: 'Radiology Scan' },
    dateAdded: '28 Julai 2026',
    facility: 'Muhimbili National Hospital (MNH)',
    source: 'hospital_sync',
    fileSize: '1.4 MB',
    recordId: 'REC-TZ-2026-742',
    pdfFileName: 'MNH_Chest_XRay_Digital_742.pdf',
    notes: 'Picha ya mapafu safi bila dalili za maambukizi au TB.',
    isEncrypted: true,
    starred: false,
  },
];

export const INITIAL_MEDICAL_RECORDS: MedicalRecord[] = [
  {
    id: 'REC-TZ-2026-881',
    title: 'Kipimo cha Damu Kamili (Full Blood Picture & CBC)',
    category: 'lab',
    categoryLabel: { sw: 'Maabara (Lab)', en: 'Laboratory' },
    hospitalName: 'The Aga Khan Hospital, Dar es Salaam',
    doctorName: 'Dkt. Francis Lyimo (Senior Hematologist)',
    date: '12 Agosti 2026',
    department: 'Maabara Kuu ya Hematolojia',
    status: 'verified',
    summary: {
      sw: 'Viwango vyote vya chembechembe za damu, hemoglobin na platelets viko katika hali ya kawaida na afya nzuri.',
      en: 'Complete blood count indices, hemoglobin and platelets are within optimal physiological parameters.',
    },
    details: {
      labParams: [
        { name: 'Hemoglobin (Hb)', value: '13.8', unit: 'g/dL', referenceRange: '12.0 - 16.0', status: 'normal' },
        { name: 'Red Blood Cells (RBC)', value: '4.72', unit: 'x10^12/L', referenceRange: '4.0 - 5.5', status: 'normal' },
        { name: 'White Blood Cells (WBC)', value: '6.2', unit: 'x10^9/L', referenceRange: '4.0 - 11.0', status: 'normal' },
        { name: 'Platelets Count', value: '240', unit: 'x10^9/L', referenceRange: '150 - 450', status: 'normal' },
        { name: 'Hematocrit (PCV)', value: '41.2', unit: '%', referenceRange: '36.0 - 48.0', status: 'normal' },
        { name: 'Malaria mRDT Antigen', value: 'Negative', unit: '', referenceRange: 'Negative', status: 'negative' },
      ],
      clinicalImpression: {
        sw: 'Hakuna dalili ya upungufu wa damu (Anemia) au maambukizi makali ya bakteria/vimelea vya Malaria.',
        en: 'No evidence of anemia, acute leukocytosis or plasmodium malaria parasitemia.',
      },
      recommendation: {
        sw: 'Endelea na lishe bora, kunywa maji ya kutosha na mazoezi ya kila siku.',
        en: 'Maintain balanced dietary iron intake, adequate hydration and regular physical activity.',
      },
    },
    pdfFileName: 'AgaKhan_Full_Blood_Picture_Report_881.pdf',
  },
  {
    id: 'REC-TZ-2026-742',
    title: 'Kipimo cha X-Ray ya Kifua (Chest X-Ray PA View)',
    category: 'radiology',
    categoryLabel: { sw: 'Radiolojia (Imaging)', en: 'Radiology' },
    hospitalName: 'Muhimbili National Hospital (MNH)',
    doctorName: 'Dkt. Julius Mchome (Consultant Radiologist)',
    date: '28 Julai 2026',
    department: 'Idara Kuu ya Mionzi na Radiolojia',
    status: 'clear',
    summary: {
      sw: 'Picha ya mapafu inaonyesha mapafu safi bila dalili za TB, nimonia au maji kwenye mapafu.',
      en: 'Clear lung parenchyma without consolidation, pneumothorax, effusion or active TB infiltrate.',
    },
    details: {
      radiologyFindings: {
        sw: 'Mapafu yote mawili yamepanuka vizuri, pembe za costophrenic zipo wazi, kivuli cha moyo (cardiac silhouette) kina ukubwa wa kawaida.',
        en: 'Both lung fields are clear with sharp costophrenic angles. Normal cardiothoracic ratio < 0.5 with intact bony thorax.',
      },
      clinicalImpression: {
        sw: 'Kipimo cha kifua ni cha kawaida kabisa (Normal Study).',
        en: 'Normal chest radiograph study.',
      },
      recommendation: {
        sw: 'Hakuna haja ya tiba ya ziada ya mfumo wa upumuaji.',
        en: 'No additional pulmonary interventions needed.',
      },
    },
    pdfFileName: 'MNH_Chest_XRay_Digital_742.pdf',
  },
  {
    id: 'REC-TZ-2026-619',
    title: 'Ushauri wa Moyo & Kipimo cha ECG (Cardiology Consultation)',
    category: 'consultation',
    categoryLabel: { sw: 'Muhtasari wa Daktari', en: 'Clinical Summary' },
    hospitalName: 'Jakaya Kikwete Cardiac Institute (JKCI)',
    doctorName: 'Prof. Peter Kisenge (Interventional Cardiologist)',
    date: '15 Juni 2026',
    department: 'Kitengo cha Moyo na Mishipa ya Damu',
    status: 'normal',
    summary: {
      sw: 'Mdundo wa moyo (Normal Sinus Rhythm) na shinikizo la damu 120/80 mmHg. Afya ya moyo iko imara.',
      en: 'Normal 12-lead Sinus Rhythm at 72 bpm. Blood pressure well controlled at 120/80 mmHg.',
    },
    details: {
      labParams: [
        { name: 'Resting ECG Rate', value: '72', unit: 'bpm', referenceRange: '60 - 100', status: 'normal' },
        { name: 'PR Interval', value: '160', unit: 'ms', referenceRange: '120 - 200', status: 'normal' },
        { name: 'QRS Duration', value: '88', unit: 'ms', referenceRange: '< 120', status: 'normal' },
        { name: 'Resting Blood Pressure', value: '120/80', unit: 'mmHg', referenceRange: '< 130/85', status: 'normal' },
      ],
      clinicalImpression: {
        sw: 'Afya ya mfumo wa moyo na mishipa iko imara bila arrhythmia yoyote.',
        en: 'Cardiovascular structure and electrical conduction within normal parameters.',
      },
      recommendation: {
        sw: 'Ukaguzi wa kawaida baada ya miezi 12.',
        en: 'Routine annual preventive cardiac follow-up.',
      },
    },
    pdfFileName: 'JKCI_Cardiology_Consultation_ECG_619.pdf',
  },
  {
    id: 'REC-TZ-2026-490',
    title: 'Cheti cha Kimataifa cha Chanjo ya Homa ya Manjano (Yellow Fever)',
    category: 'vaccine',
    categoryLabel: { sw: 'Chanjo (Vaccine)', en: 'Immunization' },
    hospitalName: 'Tanzania Port Health Authority (MoH)',
    doctorName: 'Dkt. Grace Msuya (Public Health Officer)',
    date: '04 Mei 2026',
    department: 'Kituo cha Chanjo za Kimataifa - JNIA Airport DSM',
    status: 'verified',
    summary: {
      sw: 'Cheti halali cha kimataifa cha Shirika la Afya Duniani (WHO) chenye uhalali wa maisha yote.',
      en: 'Official WHO International Certificate of Vaccination against Yellow Fever (Valid for life).',
    },
    details: {
      certificateNumber: 'TZ-WHO-2026-994821',
      validity: 'Uhalali: Maisha Yote (Valid for Life - WHO IHR 2005)',
      clinicalImpression: {
        sw: 'Chanjo ya Stamaril Yellow Fever (Batch: YF-88290) imetolewa bila athari zozote mbaya.',
        en: 'Stamaril live attenuated vaccine administered subcutaneous. No adverse immediate reactions.',
      },
      recommendation: {
        sw: 'Weka nakala ya kidijitali kwenye simu kwa ajili ya safari za kikanda na kimataifa.',
        en: 'Keep digital pass handy for regional cross-border travel verification.',
      },
    },
    pdfFileName: 'WHO_Yellow_Fever_Certificate_TZ_490.pdf',
  },
  {
    id: 'REC-TZ-2026-310',
    title: 'Kipimo cha Ultrasound ya Tumbo (Abdominal Sonography)',
    category: 'radiology',
    categoryLabel: { sw: 'Radiolojia (Imaging)', en: 'Radiology' },
    hospitalName: 'KCMC Referral Hospital, Moshi',
    doctorName: 'Dkt. Beatrice Tarimo (Senior Sonographer)',
    date: '18 Machi 2026',
    department: 'Kitengo cha Ultrasound na Uchunguzi',
    status: 'clear',
    summary: {
      sw: 'Viungo vyote vya tumbo (Ini, Figo, Kibofu cha nyongo, Bandama) viko katika hali ya kawaida.',
      en: 'Liver, gallbladder, spleen, kidneys and urinary bladder appear normal in size, shape and echo-texture.',
    },
    details: {
      radiologyFindings: {
        sw: 'Ini lina muundo wa kawaida, hakuna mawe kwenye figo au kibofu (No calculi).',
        en: 'Normal hepatic parenchyma. No focal lesions. Both kidneys demonstrate preserved corticomedullary differentiation.',
      },
      clinicalImpression: {
        sw: 'Kipimo cha ultrasound kiko safi kabisa.',
        en: 'Unremarkable whole abdominal ultrasound.',
      },
    },
    pdfFileName: 'KCMC_Abdominal_Ultrasound_310.pdf',
  },
];
