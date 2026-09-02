import React, { useState, useEffect, useRef } from 'react';
import {
  FileText,
  X,
  Search,
  Download,
  CheckCircle2,
  ShieldCheck,
  ChevronDown,
  ChevronUp,
  FolderLock,
  Upload,
  BookmarkPlus,
  BookmarkCheck,
  Trash2,
  Star,
  FileDown,
  Plus,
  Lock,
  AlertCircle,
} from 'lucide-react';
import { MedicalRecord, PersonalFileItem } from '../data/medicalRecords';
import { Language, Theme } from '../types';
import { generateMedicalRecordPdf, generateCompiledMedicalPassportPdf } from '../utils/pdfGenerator';
import { LoadingSkeleton } from './LoadingSkeleton';
import {
  fetchMedicalRecords,
  fetchPersonalFiles,
  insertPersonalFile,
  deletePersonalFile,
  updatePersonalFileStarred,
  updatePersonalFileNotes,
} from '../lib/records';
import {
  uploadPersonalFile,
  getPersonalFileSignedUrl,
  deleteStoredFile,
  formatFileSize,
  validateUploadFile,
} from '../lib/storage';
import { requestDocumentSummary } from '../lib/documentParsing';

interface MedicalRecordsModalProps {
  isOpen: boolean;
  onClose: () => void;
  language: Language;
  theme: Theme;
  patientName: string;
  patientId: string;
  patientDob?: string;
  patientBloodType?: string;
  patientPhone?: string;
  patientInsurance?: string;
  patientDocType?: string;
  patientDocNumber?: string;
  initialTab?: 'records' | 'personal_files';
  authUserId: string | null;
  onOpenImaging?: () => void;
}

export const MedicalRecordsModal: React.FC<MedicalRecordsModalProps> = ({
  isOpen,
  onClose,
  language,
  theme,
  patientName,
  patientId,
  patientDob = '12 Apr 1995',
  patientBloodType = 'O+',
  patientPhone = '+255 754 829 140',
  patientInsurance = 'NHIF (Mfuko wa Taifa)',
  patientDocType = 'NIDA / NIN',
  patientDocNumber = '19950412111020000421',
  initialTab = 'records',
  authUserId,
  onOpenImaging,
}) => {
  const isSwahili = language === 'sw';

  // Primary active tab: 'records' | 'personal_files'
  const [activeTab, setActiveTab] = useState<'records' | 'personal_files'>(initialTab);

  // Medical Records State — loaded from Supabase per patient
  const [records, setRecords] = useState<MedicalRecord[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<'all' | 'lab' | 'radiology' | 'consultation' | 'vaccine'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedRecordId, setExpandedRecordId] = useState<string | null>(null);

  // Personal Files State — loaded from Supabase per patient
  const [personalFiles, setPersonalFiles] = useState<PersonalFileItem[]>([]);
  const [recordsLoading, setRecordsLoading] = useState(true);

  useEffect(() => {
    if (!isOpen) return;
    if (!authUserId) { setRecordsLoading(false); return; }
    let active = true;
    setRecordsLoading(true);
    fetchMedicalRecords(authUserId).then(({ records: fetched }) => {
      if (active) { setRecords(fetched); setRecordsLoading(false); }
    });
    fetchPersonalFiles(authUserId).then(({ files }) => {
      if (active) setPersonalFiles(files);
    });
    return () => {
      active = false;
    };
  }, [isOpen, authUserId]);

  const [personalFileSearch, setPersonalFileSearch] = useState('');
  const [personalFileCategory, setPersonalFileCategory] = useState<'all' | 'hospital_report' | 'lab_result' | 'vaccine_cert' | 'scan_image' | 'custom_upload'>('all');
  
  // Feedback alerts
  const [actionNotice, setActionNotice] = useState<{ text: string; type: 'success' | 'info' } | null>(null);

  // Upload modal / drawer inside personal files
  const [isUploadOpen, setIsUploadOpen] = useState(false);
  const [uploadTitle, setUploadTitle] = useState('');
  const [uploadFacility, setUploadFacility] = useState('');
  const [uploadCategory, setUploadCategory] = useState<PersonalFileItem['category']>('custom_upload');
  const [uploadNotes, setUploadNotes] = useState('');
  const [selectedFileName, setSelectedFileName] = useState('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Set initial tab on open
  useEffect(() => {
    if (isOpen) {
      setActiveTab(initialTab);
    }
  }, [isOpen, initialTab]);

  if (!isOpen) return null;

  const patientMeta = {
    name: patientName,
    id: patientId,
    dob: patientDob,
    bloodType: patientBloodType,
    phone: patientPhone,
    insurance: patientInsurance,
    docType: patientDocType,
    docNumber: patientDocNumber,
  };

  // Filtered Hospital Records
  const filteredRecords = records.filter((r) => {
    const matchesCategory = selectedCategory === 'all' || r.category === selectedCategory;
    const matchesSearch =
      r.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      r.hospitalName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      r.doctorName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      r.department.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  // Filtered Personal Files
  const filteredPersonalFiles = personalFiles.filter((f) => {
    const matchesCategory = personalFileCategory === 'all' || f.category === personalFileCategory;
    const matchesSearch =
      f.title.toLowerCase().includes(personalFileSearch.toLowerCase()) ||
      f.facility.toLowerCase().includes(personalFileSearch.toLowerCase()) ||
      (f.notes && f.notes.toLowerCase().includes(personalFileSearch.toLowerCase()));
    return matchesCategory && matchesSearch;
  });

  // Handle Download Single PDF
  const handleDownloadPdf = (record: MedicalRecord) => {
    try {
      generateMedicalRecordPdf(record, patientMeta, language);
      setActionNotice({
        text: isSwahili
          ? `Ripoti ya "${record.title}" imepakuliwa kama PDF kwenye simu/kompyuta yako!`
          : `Report "${record.title}" downloaded as a verified PDF to your device!`,
        type: 'success',
      });
      setTimeout(() => setActionNotice(null), 4500);
    } catch (err) {
      console.error(err);
    }
  };

  // Handle Download from Personal Files list
  const handleDownloadPersonalFile = async (file: PersonalFileItem) => {
    // Real user-uploaded bytes live in Supabase Storage — fetch a short-lived
    // signed URL (bucket is private) and open the actual file the patient uploaded.
    if (file.source === 'user_upload' && file.fileUrl) {
      const { url, error } = await getPersonalFileSignedUrl(file.fileUrl);
      if (error || !url) {
        setActionNotice({
          text: isSwahili
            ? 'Imeshindikana kupakua faili. Jaribu tena.'
            : 'Could not download the file. Please try again.',
          type: 'info',
        });
        setTimeout(() => setActionNotice(null), 4000);
        return;
      }
      const link = document.createElement('a');
      link.href = url;
      link.download = file.title;
      link.target = '_blank';
      document.body.appendChild(link);
      link.click();
      link.remove();

      setActionNotice({
        text: isSwahili
          ? `Faili la "${file.title}" linapakuliwa!`
          : `Downloading "${file.title}"!`,
        type: 'success',
      });
      setTimeout(() => setActionNotice(null), 4500);
      return;
    }

    // Hospital-synced records (and legacy entries with no stored bytes) fall
    // back to generating the official record PDF.
    const matchedRecord = records.find((r) => r.id === file.recordId);
    if (matchedRecord) {
      generateMedicalRecordPdf(matchedRecord, patientMeta, language);
    } else {
      const customRecord: MedicalRecord = {
        id: file.id,
        title: file.title,
        category: 'consultation',
        categoryLabel: file.categoryLabel,
        hospitalName: file.facility || 'NiaCare Personal Vault',
        doctorName: 'Certified Personal Record',
        date: file.dateAdded,
        department: 'Personal Health Records Archive',
        status: 'verified',
        summary: {
          sw: file.notes || 'Hati binafsi ya afya iliyohifadhiwa salama kwenye mfumo wa NiaCare.',
          en: file.notes || 'Securely archived personal medical document in NiaCare digital vault.',
        },
        pdfFileName: file.pdfFileName || `${file.title.replace(/\s+/g, '_')}.pdf`,
      };
      generateMedicalRecordPdf(customRecord, patientMeta, language);
    }

    setActionNotice({
      text: isSwahili
        ? `Faili la "${file.title}" limepakuliwa kama PDF!`
        : `Personal file "${file.title}" downloaded as PDF!`,
      type: 'success',
    });
    setTimeout(() => setActionNotice(null), 4500);
  };

  // Handle Save / Store Record to Personal Files Vault
  const handleSaveToPersonalFiles = async (record: MedicalRecord) => {
    if (!authUserId) return;
    const exists = personalFiles.some((f) => f.recordId === record.id);
    if (exists) {
      setActionNotice({
        text: isSwahili
          ? `Rekodi ya "${record.title}" tayari imo kwenye Faili Zako Binafsi.`
          : `"${record.title}" is already stored in your Personal Files vault.`,
        type: 'info',
      });
      setTimeout(() => setActionNotice(null), 4000);
      return;
    }

    const newFileData: Omit<PersonalFileItem, 'id'> = {
      title: `${record.title}.pdf`,
      category:
        record.category === 'lab'
          ? 'lab_result'
          : record.category === 'vaccine'
          ? 'vaccine_cert'
          : record.category === 'radiology'
          ? 'scan_image'
          : 'hospital_report',
      categoryLabel: record.categoryLabel,
      dateAdded: record.date,
      facility: record.hospitalName,
      source: 'hospital_sync',
      fileSize: `${(Math.random() * (1.2 - 0.3) + 0.3).toFixed(1)} MB`,
      recordId: record.id,
      pdfFileName: record.pdfFileName,
      notes: isSwahili ? record.summary.sw : record.summary.en,
      isEncrypted: true,
      starred: false,
    };

    const { file, error } = await insertPersonalFile(authUserId, newFileData);
    if (error || !file) return;

    setPersonalFiles([file, ...personalFiles]);
    setActionNotice({
      text: isSwahili
        ? `Rekodi ya "${record.title}" imehifadhiwa kikamilifu kwenye Faili Zako Binafsi!`
        : `"${record.title}" has been saved to your Personal Files vault!`,
      type: 'success',
    });
    setTimeout(() => setActionNotice(null), 4500);
  };

  // Handle Remove from Personal Files
  const handleRemovePersonalFile = async (id: string, title: string) => {
    const target = personalFiles.find((f) => f.id === id);
    setPersonalFiles((prev) => prev.filter((f) => f.id !== id));
    await deletePersonalFile(id);
    if (target?.source === 'user_upload' && target.fileUrl) {
      await deleteStoredFile(target.fileUrl);
    }
    setActionNotice({
      text: isSwahili
        ? `Faili la "${title}" limeondolewa kwenye faili zako binafsi.`
        : `File "${title}" removed from your personal vault.`,
      type: 'info',
    });
    setTimeout(() => setActionNotice(null), 3500);
  };

  // Toggle Star / Favorite
  const handleToggleStar = (id: string) => {
    const target = personalFiles.find((f) => f.id === id);
    if (!target) return;
    const nextStarred = !target.starred;
    setPersonalFiles((prev) =>
      prev.map((f) => (f.id === id ? { ...f, starred: nextStarred } : f))
    );
    updatePersonalFileStarred(id, nextStarred);
  };

  // Handle Export Complete Medical Passport Archive PDF
  const handleExportCompletePassport = () => {
    try {
      generateCompiledMedicalPassportPdf(records, patientMeta, language);
      setActionNotice({
        text: isSwahili
          ? 'Pasipoti Kamili ya Afya (NiaCare Health Passport) imepakuliwa kama PDF!'
          : 'Complete NiaCare Health Passport downloaded as compiled PDF!',
        type: 'success',
      });
      setTimeout(() => setActionNotice(null), 5000);
    } catch (err) {
      console.error(err);
    }
  };

  // Handle Custom File Upload into Personal Files
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const validationError = validateUploadFile(file, isSwahili);
    if (validationError) {
      setUploadError(validationError);
      setSelectedFile(null);
      setSelectedFileName('');
      e.target.value = '';
      return;
    }

    setUploadError('');
    setSelectedFile(file);
    setSelectedFileName(file.name);
    if (!uploadTitle) {
      setUploadTitle(file.name.replace(/\.[^/.]+$/, ''));
    }
  };

  const handleSaveUpload = async () => {
    if (!uploadTitle.trim() || !authUserId || !selectedFile || isUploading) {
      if (!selectedFile) {
        setUploadError(isSwahili ? 'Tafadhali chagua faili kwanza.' : 'Please select a file first.');
      }
      return;
    }

    setIsUploading(true);
    setUploadError('');

    // Upload the actual file bytes to Supabase Storage, scoped to this patient's folder.
    const { path, error: uploadErr } = await uploadPersonalFile(authUserId, selectedFile);
    if (uploadErr || !path) {
      setUploadError(
        isSwahili
          ? `Imeshindikana kupakia faili: ${uploadErr}`
          : `Failed to upload file: ${uploadErr}`
      );
      setIsUploading(false);
      return;
    }

    const originalExt = selectedFile.name.includes('.') ? selectedFile.name.split('.').pop() : 'pdf';
    const title = uploadTitle.endsWith(`.${originalExt}`) ? uploadTitle : `${uploadTitle}.${originalExt}`;
    const newCustomFileData: Omit<PersonalFileItem, 'id'> = {
      title,
      category: uploadCategory,
      categoryLabel: {
        sw:
          uploadCategory === 'prescription'
            ? 'Karatasi ya Dawa'
            : uploadCategory === 'lab_result'
            ? 'Vipimo Binafsi'
            : uploadCategory === 'scan_image'
            ? 'Picha ya Mionzi'
            : 'Faili Binafsi',
        en:
          uploadCategory === 'prescription'
            ? 'Prescription Slip'
            : uploadCategory === 'lab_result'
            ? 'Personal Lab'
            : uploadCategory === 'scan_image'
            ? 'Medical Scan'
            : 'Personal Document',
      },
      dateAdded: new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }),
      facility: uploadFacility.trim() || 'Personal Upload (Mgonjwa)',
      source: 'user_upload',
      fileSize: formatFileSize(selectedFile.size),
      pdfFileName: `${uploadTitle.replace(/\s+/g, '_')}.${originalExt}`,
      notes: uploadNotes.trim() || 'Nyaraka ya afya iliyopakiwa na mgonjwa.',
      fileUrl: path,
      isEncrypted: true,
      starred: true,
    };

    const { file, error } = await insertPersonalFile(authUserId, newCustomFileData);
    setIsUploading(false);
    if (error || !file) {
      // Metadata insert failed after a successful upload — clean up the orphaned object.
      await deleteStoredFile(path);
      setUploadError(
        isSwahili ? `Imeshindikana kuhifadhi: ${error}` : `Failed to save record: ${error}`
      );
      return;
    }

    setPersonalFiles([file, ...personalFiles]);
    setIsUploadOpen(false);
    const hadManualNotes = !!uploadNotes.trim();
    setUploadTitle('');
    setUploadFacility('');
    setUploadNotes('');
    setSelectedFileName('');
    setSelectedFile(null);

    setActionNotice({
      text: isSwahili
        ? `Nyaraka ya "${title}" imehifadhiwa kwenye Faili Zako Binafsi!`
        : `Document "${title}" successfully added to your Personal Files!`,
      type: 'success',
    });
    setTimeout(() => setActionNotice(null), 4500);

    // Best-effort, non-blocking: for a PDF with no manually-typed notes, ask
    // the server to extract the real text and summarize it via Groq. Image
    // uploads and scanned PDFs with no text layer simply come back null —
    // there's no vision model on this Groq account to fall back to.
    if (originalExt === 'pdf' && !hadManualNotes) {
      requestDocumentSummary(file.id, language).then(({ summary }) => {
        if (!summary) return;
        setPersonalFiles((prev) => prev.map((f) => (f.id === file.id ? { ...f, notes: summary } : f)));
        updatePersonalFileNotes(file.id, summary);
        setActionNotice({
          text: isSwahili
            ? `Muhtasari wa AI umeongezwa kwa "${title}"!`
            : `AI summary added to "${title}"!`,
          type: 'success',
        });
        setTimeout(() => setActionNotice(null), 4500);
      });
    }
  };

  const categorySummary: { id: 'lab' | 'radiology' | 'consultation' | 'vaccine'; label: string; count: number }[] = [
    { id: 'lab', label: isSwahili ? 'Maabara' : 'Lab', count: records.filter((r) => r.category === 'lab').length },
    { id: 'radiology', label: isSwahili ? 'Mionzi' : 'Imaging', count: records.filter((r) => r.category === 'radiology').length },
    { id: 'consultation', label: isSwahili ? 'Kliniki' : 'Encounters', count: records.filter((r) => r.category === 'consultation').length },
    { id: 'vaccine', label: isSwahili ? 'Chanjo' : 'Vaccines', count: records.filter((r) => r.category === 'vaccine').length },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-xs animate-in fade-in">
      <div className="nc-card w-full max-w-3xl p-4 sm:p-5 relative max-h-[94vh] flex flex-col nc-text">
        {/* Header */}
        <div className="flex items-start justify-between gap-3 pb-3 border-b nc-border flex-shrink-0">
          <div className="min-w-0">
            <h3 className="text-lg font-semibold tracking-tight nc-text">
              {isSwahili ? 'Rekodi za Matibabu' : 'Medical Records'}
            </h3>
            <p className="text-[13px] nc-text-muted truncate">
              {patientName} · ID: {patientId}
            </p>
          </div>

          <div className="flex items-center gap-1.5 flex-shrink-0">
            {onOpenImaging && (
              <button type="button" onClick={onOpenImaging} className="nc-btn-ghost px-2.5 py-1.5 hidden sm:inline-flex">
                {isSwahili ? 'Radiolojia' : 'Imaging'}
              </button>
            )}
            <button type="button" onClick={onClose} className="nc-btn-icon" aria-label={isSwahili ? 'Funga' : 'Close'}>
              <X className="w-4.5 h-4.5" />
            </button>
          </div>
        </div>

        {/* Primary Navigation: Records vs. Files */}
        <div className="pt-3 pb-2.5 flex-shrink-0 flex items-center justify-between gap-2 border-b nc-border">
          <div className="overflow-x-auto scrollbar-none min-w-0">
            <div className="inline-flex items-center gap-1" role="tablist">
              <button
                type="button"
                role="tab"
                aria-selected={activeTab === 'records'}
                onClick={() => setActiveTab('records')}
                className={`px-3 py-1.5 rounded-full text-sm font-semibold cursor-pointer transition-colors whitespace-nowrap ${
                  activeTab === 'records' ? 'bg-primary text-white' : 'nc-text-muted hover:text-primary'
                }`}
              >
                {isSwahili ? 'Rekodi' : 'Records'}
              </button>

              <button
                type="button"
                role="tab"
                aria-selected={activeTab === 'personal_files'}
                onClick={() => setActiveTab('personal_files')}
                className={`px-3 py-1.5 rounded-full text-sm font-semibold cursor-pointer transition-colors whitespace-nowrap flex items-center gap-1 ${
                  activeTab === 'personal_files' ? 'bg-primary text-white' : 'nc-text-muted hover:text-primary'
                }`}
              >
                <span>{isSwahili ? 'Faili' : 'Files'}</span>
                <span className={activeTab === 'personal_files' ? 'text-white/80' : 'nc-text-muted'}>{personalFiles.length}</span>
              </button>
            </div>
          </div>

          {activeTab === 'personal_files' && (
            <button type="button" onClick={() => setIsUploadOpen(true)} className="nc-btn-primary px-3 py-1.5 flex items-center gap-1.5 flex-shrink-0">
              <Upload className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">{isSwahili ? 'Weka Faili Jipya' : 'Add Document'}</span>
              <span className="sm:hidden">{isSwahili ? 'Ongeza' : 'Upload'}</span>
            </button>
          )}
        </div>

        {/* Global Action Toast */}
        {actionNotice && (
          <div
            className={`my-2 px-3 py-2 rounded-lg text-xs font-medium flex items-center gap-2 flex-shrink-0 ${
              actionNotice.type === 'success' ? 'bg-success-subtle text-success' : 'bg-info-subtle text-info'
            }`}
          >
            <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
            <span>{actionNotice.text}</span>
          </div>
        )}

        {/* ========================================================================= */}
        {/* VIEW 1: HOSPITAL MEDICAL RECORDS */}
        {/* ========================================================================= */}
        {activeTab === 'records' && (
          <div className="flex flex-col flex-1 min-h-0">
            {/* Search & Category Navigation */}
            <div className="pt-2.5 pb-2 space-y-2 flex-shrink-0">
              <div className="relative">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 nc-text-muted" />
                <input
                  type="text"
                  placeholder={isSwahili ? 'Tafuta kipimo, daktari au hospitali...' : 'Search test, doctor, or hospital...'}
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="nc-input pl-9 pr-8 py-2"
                />
                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => setSearchQuery('')}
                    aria-label={isSwahili ? 'Futa utafutaji' : 'Clear search'}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 nc-text-muted hover:text-primary text-xs p-1"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              {/* Category filter — plain horizontal nav, blue only on the active item */}
              <div className="overflow-x-auto scrollbar-none">
                <div className="inline-flex items-center gap-1" role="tablist">
                  {[
                    { id: 'all', labelSw: 'Zote', labelEn: 'All' },
                    { id: 'lab', labelSw: 'Maabara', labelEn: 'Lab' },
                    { id: 'radiology', labelSw: 'Mionzi', labelEn: 'Imaging' },
                    { id: 'consultation', labelSw: 'Kliniki', labelEn: 'Encounters' },
                    { id: 'vaccine', labelSw: 'Chanjo', labelEn: 'Vaccines' },
                  ].map((cat) => (
                    <button
                      key={cat.id}
                      type="button"
                      role="tab"
                      aria-selected={selectedCategory === cat.id}
                      onClick={() => setSelectedCategory(cat.id as any)}
                      className={`px-2.5 py-1 rounded-full font-medium whitespace-nowrap text-xs transition-colors cursor-pointer ${
                        selectedCategory === cat.id ? 'bg-primary text-white' : 'nc-text-muted hover:text-primary'
                      }`}
                    >
                      {isSwahili ? cat.labelSw : cat.labelEn}
                    </button>
                  ))}
                </div>
              </div>

              {/* Compact record summary row */}
              {!recordsLoading && records.length > 0 && (
                <div className="flex items-center gap-4 overflow-x-auto text-xs scrollbar-none">
                  <div className="flex items-baseline gap-1 flex-shrink-0">
                    <span className="font-semibold nc-text">{records.length}</span>
                    <span className="nc-text-muted">{isSwahili ? 'Jumla' : 'Total'}</span>
                  </div>
                  {categorySummary.map((c) => (
                    <div key={c.id} className="flex items-baseline gap-1 flex-shrink-0">
                      <span className="font-semibold nc-text">{c.count}</span>
                      <span className="nc-text-muted">{c.label}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Records List (Scrollable Area) */}
            <div className="flex-1 overflow-y-auto pr-1 min-h-0">
              {recordsLoading ? (
                <LoadingSkeleton rows={4} />
              ) : filteredRecords.length === 0 ? (
                <div className="text-center py-10 space-y-1.5">
                  <FileText className="w-7 h-7 nc-text-muted mx-auto" />
                  <p className="text-sm font-medium nc-text">{isSwahili ? 'Hakuna rekodi za matibabu' : 'No medical records'}</p>
                  <p className="text-xs nc-text-muted max-w-xs mx-auto">
                    {isSwahili ? 'Hakuna rekodi zilizopatikana kwa utafutaji huu.' : 'No records match your current search or filter.'}
                  </p>
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedCategory('all');
                      setSearchQuery('');
                    }}
                    className="text-xs text-primary font-semibold hover:underline cursor-pointer"
                  >
                    {isSwahili ? 'Onyesha Rekodi Zote' : 'Reset filters'}
                  </button>
                </div>
              ) : (
                filteredRecords.map((record) => {
                  const isExpanded = expandedRecordId === record.id;
                  const isStoredInPersonalFiles = personalFiles.some((f) => f.recordId === record.id);

                  return (
                    <div key={record.id} className="nc-list-row">
                      {/* Record Row */}
                      <button
                        type="button"
                        onClick={() => setExpandedRecordId(isExpanded ? null : record.id)}
                        aria-expanded={isExpanded}
                        className="w-full py-3 flex items-start justify-between gap-3 cursor-pointer text-left"
                      >
                        <div className="min-w-0">
                          <h4 className="font-semibold text-[15px] nc-text leading-snug">{record.title}</h4>

                          <p className="text-xs nc-text-secondary truncate mt-0.5">{record.hospitalName}</p>

                          <div className="flex items-center gap-x-2.5 gap-y-1 flex-wrap text-[11px] nc-text-muted mt-1">
                            <span>
                              {record.date} · {isSwahili ? record.categoryLabel.sw : record.categoryLabel.en}
                            </span>
                            {record.status === 'verified' && (
                              <span className="flex items-center gap-1 text-success">
                                <ShieldCheck className="w-3 h-3" />
                                <span>{isSwahili ? 'Imethibitishwa' : 'Verified'}</span>
                              </span>
                            )}
                            {isStoredInPersonalFiles && (
                              <span className="flex items-center gap-1 text-primary dark:text-primary-light">
                                <BookmarkCheck className="w-3 h-3" />
                                <span>{isSwahili ? 'Imehifadhiwa' : 'In Vault'}</span>
                              </span>
                            )}
                          </div>
                        </div>

                        <div className="flex-shrink-0 nc-text-muted mt-1">
                          {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                        </div>
                      </button>

                      {/* Expanded Medical Details */}
                      {isExpanded && (
                        <div className="pb-4 pt-2 border-t nc-border space-y-3 text-xs">
                          {/* Doctor / Department */}
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            <div>
                              <span className="text-[10px] nc-text-muted font-semibold uppercase block">
                                {isSwahili ? 'Daktari Bingwa / Mtaalamu' : 'Doctor / Specialist'}
                              </span>
                              <span className="font-medium nc-text">{record.doctorName}</span>
                            </div>
                            <div>
                              <span className="text-[10px] nc-text-muted font-semibold uppercase block">
                                {isSwahili ? 'Idara ya Hospitali' : 'Department'}
                              </span>
                              <span className="font-medium nc-text">{record.department}</span>
                            </div>
                          </div>

                          {/* Summary */}
                          <div>
                            <span className="text-[10px] nc-text-muted font-semibold uppercase tracking-wide block mb-1">
                              {isSwahili ? 'Muhtasari wa Majibu' : 'Clinical Summary'}
                            </span>
                            <p className="nc-text-secondary leading-relaxed">
                              {isSwahili ? record.summary.sw : record.summary.en}
                            </p>
                          </div>

                          {/* Detailed Lab Test Parameter Table if available */}
                          {record.details?.labParams && (
                            <div className="space-y-1.5">
                              <span className="text-[10px] nc-text-muted font-semibold uppercase tracking-wide block">
                                {isSwahili ? 'Matokeo ya Vipimo (Lab Indices)' : 'Detailed Lab Indices'}
                              </span>
                              <div className="rounded-lg border nc-border overflow-hidden text-[11px]">
                                <div className="grid grid-cols-4 p-2 nc-surface-elevated font-semibold text-[10px] nc-text-muted uppercase">
                                  <span className="col-span-2">{isSwahili ? 'Kipimo' : 'Test'}</span>
                                  <span>{isSwahili ? 'Matokeo' : 'Result'}</span>
                                  <span>{isSwahili ? 'Kiwango' : 'Reference'}</span>
                                </div>
                                {record.details.labParams.map((param, idx) => {
                                  const flagged = ['high', 'low', 'positive'].includes(param.status);
                                  return (
                                    <div key={idx} className="grid grid-cols-4 p-2 items-center border-t nc-border">
                                      <span className="col-span-2 font-medium nc-text">{param.name}</span>
                                      <span className={`font-medium ${flagged ? 'text-warning' : 'nc-text-secondary'}`}>
                                        {param.value} {param.unit}
                                        {flagged && (
                                          <span className="ml-1 text-[9px] uppercase font-semibold">
                                            ({param.status})
                                          </span>
                                        )}
                                      </span>
                                      <span className="text-[10px] nc-text-muted">{param.referenceRange}</span>
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          )}

                          {/* Radiology Findings if available */}
                          {record.details?.radiologyFindings && (
                            <div>
                              <span className="text-[10px] nc-text-muted font-semibold uppercase tracking-wide block mb-1">
                                {isSwahili ? 'Taarifa ya Mionzi (Radiologist Findings)' : 'Radiologist Findings'}
                              </span>
                              <p className="nc-text-secondary leading-relaxed">
                                {isSwahili ? record.details.radiologyFindings.sw : record.details.radiologyFindings.en}
                              </p>
                            </div>
                          )}

                          {/* Certificate info if available */}
                          {record.details?.certificateNumber && (
                            <div className="flex items-center justify-between gap-2 pt-2 border-t nc-border">
                              <div>
                                <span className="text-[10px] nc-text-muted font-semibold uppercase block">
                                  {isSwahili ? 'Nambari ya Cheti cha Kimataifa' : 'Official Certificate No.'}
                                </span>
                                <span className="font-mono font-medium nc-text">{record.details.certificateNumber}</span>
                              </div>
                              <span className="nc-status nc-status-neutral flex-shrink-0">{record.details.validity}</span>
                            </div>
                          )}

                          {/* Actions: Save to Personal Files & Download PDF */}
                          <div className="pt-2 flex items-center justify-between gap-2 border-t nc-border">
                            <button
                              type="button"
                              onClick={() => handleSaveToPersonalFiles(record)}
                              className="nc-btn-ghost px-2 py-1.5 flex items-center gap-1.5 -ml-2"
                            >
                              {isStoredInPersonalFiles ? (
                                <>
                                  <BookmarkCheck className="w-3.5 h-3.5" />
                                  <span>{isSwahili ? 'Imehifadhiwa' : 'Saved to Personal Files'}</span>
                                </>
                              ) : (
                                <>
                                  <BookmarkPlus className="w-3.5 h-3.5" />
                                  <span>{isSwahili ? 'Hifadhi kwenye Faili Zangu' : 'Save to Personal Files'}</span>
                                </>
                              )}
                            </button>

                            <button type="button" onClick={() => handleDownloadPdf(record)} className="nc-btn-primary px-3 py-1.5 flex items-center gap-1.5 flex-shrink-0">
                              <Download className="w-3.5 h-3.5" />
                              <span>{isSwahili ? 'Pakua PDF' : 'Download PDF'}</span>
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* VIEW 2: PERSONAL FILES VAULT (FAILI ZANGU BINAFSI) */}
        {/* ========================================================================= */}
        {activeTab === 'personal_files' && (
          <div className="flex flex-col flex-1 min-h-0">
            {/* Vault Search & Category Filter */}
            <div className="pt-2.5 pb-2 space-y-2 flex-shrink-0">
              <div className="relative">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 nc-text-muted" />
                <input
                  type="text"
                  placeholder={isSwahili ? 'Tafuta faili, dokezo au hospitali...' : 'Search your saved personal documents...'}
                  value={personalFileSearch}
                  onChange={(e) => setPersonalFileSearch(e.target.value)}
                  className="nc-input pl-9 pr-8 py-2"
                />
                {personalFileSearch && (
                  <button
                    type="button"
                    onClick={() => setPersonalFileSearch('')}
                    aria-label={isSwahili ? 'Futa utafutaji' : 'Clear search'}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 nc-text-muted hover:text-primary p-1"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              {/* Category filter — plain horizontal nav, blue only on the active item */}
              <div className="overflow-x-auto scrollbar-none">
                <div className="inline-flex items-center gap-1" role="tablist">
                  {[
                    { id: 'all', labelSw: 'Faili Zote', labelEn: 'All Files' },
                    { id: 'hospital_report', labelSw: 'Ripoti za Daktari', labelEn: 'Clinical Reports' },
                    { id: 'lab_result', labelSw: 'Vipimo vya Damu', labelEn: 'Lab Results' },
                    { id: 'vaccine_cert', labelSw: 'Vyeti vya Chanjo', labelEn: 'Vaccine Passports' },
                    { id: 'scan_image', labelSw: 'Picha za Mionzi', labelEn: 'Scans / X-Ray' },
                    { id: 'custom_upload', labelSw: 'Nyaraka Nilizoweka', labelEn: 'My Uploads' },
                  ].map((cat) => (
                    <button
                      key={cat.id}
                      type="button"
                      role="tab"
                      aria-selected={personalFileCategory === cat.id}
                      onClick={() => setPersonalFileCategory(cat.id as any)}
                      className={`px-2.5 py-1 rounded-full font-medium whitespace-nowrap text-xs transition-colors cursor-pointer ${
                        personalFileCategory === cat.id ? 'bg-primary text-white' : 'nc-text-muted hover:text-primary'
                      }`}
                    >
                      {isSwahili ? cat.labelSw : cat.labelEn}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Personal Files Vault List */}
            <div className="flex-1 overflow-y-auto pr-1 min-h-0">
              {filteredPersonalFiles.length === 0 ? (
                <div className="text-center py-10 space-y-1.5">
                  <FolderLock className="w-7 h-7 nc-text-muted mx-auto" />
                  <p className="text-sm font-medium nc-text">{isSwahili ? 'Hakuna nyaraka' : 'No personal files'}</p>
                  <p className="text-xs nc-text-muted max-w-xs mx-auto">
                    {isSwahili
                      ? 'Huna nyaraka zilizohifadhiwa kwenye kundi hili.'
                      : 'No saved documents match your current search or filter.'}
                  </p>
                  <button
                    type="button"
                    onClick={() => setIsUploadOpen(true)}
                    className="nc-btn-primary px-3.5 py-1.5 inline-flex items-center gap-1.5"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>{isSwahili ? 'Weka Faili au Picha Sasa' : 'Upload Document'}</span>
                  </button>
                </div>
              ) : (
                filteredPersonalFiles.map((file) => (
                  <div key={file.id} className="nc-list-row py-3 flex items-center justify-between gap-3">
                    <div className="flex items-start gap-3 min-w-0 flex-1">
                      <div className="w-8 h-8 rounded-lg bg-primary/10 text-primary dark:text-primary-light flex items-center justify-center flex-shrink-0 mt-0.5">
                        <FileText className="w-4 h-4" />
                      </div>

                      <div className="min-w-0 flex-1">
                        <h4 className="font-semibold text-[15px] nc-text leading-snug truncate">{file.title}</h4>
                        <p className="text-xs nc-text-secondary truncate mt-0.5">
                          {file.facility}
                          {file.notes ? ` · ${file.notes}` : ''}
                        </p>
                        <div className="flex items-center gap-1 text-[11px] nc-text-muted mt-1 min-w-0">
                          <span className="truncate">
                            {file.fileSize} · {file.dateAdded}
                          </span>
                          {file.isEncrypted && (
                            <span className="flex items-center gap-0.5 text-success flex-shrink-0">
                              <span>·</span>
                              <Lock className="w-2.5 h-2.5" />
                              <span>{isSwahili ? 'Imefungwa' : 'Encrypted'}</span>
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Actions on this personal file — icon-only to stay compact */}
                    <div className="flex items-center gap-0.5 flex-shrink-0">
                      <button
                        type="button"
                        onClick={() => handleToggleStar(file.id)}
                        aria-pressed={file.starred}
                        aria-label={file.starred ? (isSwahili ? 'Ondoa alama' : 'Remove favorite') : (isSwahili ? 'Weka alama' : 'Mark favorite')}
                        className={`nc-btn-icon ${file.starred ? 'text-warning' : ''}`}
                      >
                        <Star className={`w-4 h-4 ${file.starred ? 'fill-current' : ''}`} />
                      </button>

                      <button
                        type="button"
                        onClick={() => handleDownloadPersonalFile(file)}
                        aria-label={isSwahili ? 'Pakua PDF' : 'Download PDF'}
                        className="nc-btn-icon"
                      >
                        <Download className="w-4 h-4" />
                      </button>

                      <button
                        type="button"
                        onClick={() => handleRemovePersonalFile(file.id, file.title)}
                        aria-label={isSwahili ? 'Ondoa kwenye faili zangu' : 'Remove from personal files'}
                        className="w-8 h-8 rounded-lg inline-flex items-center justify-center flex-shrink-0 transition-colors cursor-pointer nc-text-muted hover:text-danger hover:bg-danger-subtle"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* MODAL / DRAWER: ADD / UPLOAD PERSONAL MEDICAL DOCUMENT */}
        {/* ========================================================================= */}
        {isUploadOpen && (
          <div className="absolute inset-0 z-20 bg-black/70 backdrop-blur-xs rounded-xl p-4 sm:p-6 flex flex-col justify-center animate-in fade-in">
            <div className="nc-card w-full max-w-lg mx-auto p-5 space-y-4 nc-text">
              <div className="flex items-center justify-between border-b nc-border pb-3">
                <h4 className="font-semibold text-sm">
                  {isSwahili ? 'Hifadhi Nyaraka Kwenye Faili Binafsi' : 'Upload Document to Personal Vault'}
                </h4>
                <button
                  type="button"
                  onClick={() => {
                    if (isUploading) return;
                    setIsUploadOpen(false);
                    setSelectedFile(null);
                    setSelectedFileName('');
                    setUploadError('');
                  }}
                  aria-label={isSwahili ? 'Funga' : 'Close'}
                  className="nc-btn-icon"
                >
                  <X className="w-4.5 h-4.5" />
                </button>
              </div>

              {/* Form Fields */}
              <div className="space-y-3 text-xs">
                {/* Compact file picker module */}
                <div>
                  <label className="font-semibold block mb-1 nc-text-secondary">
                    {isSwahili ? 'Chagua Faili:' : 'Select File:'}
                  </label>
                  <input
                    type="file"
                    ref={fileInputRef}
                    onChange={handleFileUpload}
                    accept=".pdf,.png,.jpg,.jpeg,.doc,.docx"
                    className="hidden"
                  />
                  <div className="border nc-border rounded-lg p-3 flex items-center gap-3">
                    <div className="w-9 h-9 rounded-lg bg-primary/10 text-primary dark:text-primary-light flex items-center justify-center flex-shrink-0">
                      <Upload className="w-4 h-4" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="font-medium nc-text truncate">
                        {selectedFileName || (isSwahili ? 'Upload medical document' : 'Upload medical document')}
                      </p>
                      <p className="text-[11px] nc-text-muted">
                        {isSwahili ? 'PDF, picha, au hati inayotumika, hadi 25MB' : 'PDF, image, or supported document, up to 25MB'}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="nc-btn-secondary px-3 py-1.5 flex-shrink-0"
                    >
                      {selectedFileName ? (isSwahili ? 'Badilisha' : 'Change') : isSwahili ? 'Chagua' : 'Choose File'}
                    </button>
                  </div>
                  {uploadError && (
                    <p className="mt-1.5 text-[11px] font-medium text-danger flex items-center gap-1">
                      <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
                      {uploadError}
                    </p>
                  )}
                </div>

                {/* Title */}
                <div>
                  <label className="font-semibold block mb-1 nc-text-secondary">
                    {isSwahili ? 'Jina la Hati / Kipimo:' : 'Document Title:'}
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Kipimo cha Macho, Bima Card Copy..."
                    value={uploadTitle}
                    onChange={(e) => setUploadTitle(e.target.value)}
                    className="nc-input p-2.5"
                  />
                </div>

                {/* Category */}
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="font-semibold block mb-1 nc-text-secondary">
                      {isSwahili ? 'Aina ya Nyaraka:' : 'Category:'}
                    </label>
                    <select value={uploadCategory} onChange={(e) => setUploadCategory(e.target.value as any)} className="nc-input p-2.5">
                      <option value="custom_upload">Nyaraka Binafsi (General)</option>
                      <option value="hospital_report">Ripoti ya Daktari (Clinical)</option>
                      <option value="lab_result">Vipimo vya Maabara (Lab)</option>
                      <option value="vaccine_cert">Cheti cha Chanjo (Vaccine)</option>
                      <option value="scan_image">Picha ya Mionzi (Scan/X-Ray)</option>
                      <option value="prescription">Karatasi ya Dawa (Prescription)</option>
                    </select>
                  </div>

                  <div>
                    <label className="font-semibold block mb-1 nc-text-secondary">
                      {isSwahili ? 'Hospitali / Kituo:' : 'Facility / Issuer:'}
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. Muhimbili, Aga Khan..."
                      value={uploadFacility}
                      onChange={(e) => setUploadFacility(e.target.value)}
                      className="nc-input p-2.5"
                    />
                  </div>
                </div>

                {/* Notes */}
                <div>
                  <label className="font-semibold block mb-1 nc-text-secondary">
                    {isSwahili ? 'Maelezo / Dokezo (Hiari):' : 'Notes / Clinical Impression (Optional):'}
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Kipimo kiko salama, dozi ya miezi 3..."
                    value={uploadNotes}
                    onChange={(e) => setUploadNotes(e.target.value)}
                    className="nc-input p-2.5"
                  />
                </div>
              </div>

              {/* Action buttons */}
              <div className="flex items-center justify-end gap-2 pt-2 border-t nc-border">
                <button
                  type="button"
                  onClick={() => {
                    setIsUploadOpen(false);
                    setSelectedFile(null);
                    setSelectedFileName('');
                    setUploadError('');
                  }}
                  disabled={isUploading}
                  className="nc-btn-secondary px-4 py-2"
                >
                  {isSwahili ? 'Ghairi' : 'Cancel'}
                </button>

                <button
                  type="button"
                  onClick={handleSaveUpload}
                  disabled={!uploadTitle.trim() || !selectedFile || isUploading}
                  className="nc-btn-primary px-4 py-2"
                >
                  {isUploading
                    ? isSwahili
                      ? 'Inapakia...'
                      : 'Uploading...'
                    : isSwahili
                    ? 'Hifadhi kwenye Faili Zangu'
                    : 'Save to Vault'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="pt-3 mt-2 border-t nc-border flex items-center justify-between gap-2 flex-shrink-0 text-xs">
          <span className="text-[11px] nc-text-muted">PDPA 2022</span>

          <button type="button" onClick={handleExportCompletePassport} className="nc-btn-primary px-3.5 py-1.5 flex items-center gap-1.5 flex-shrink-0">
            <FileDown className="w-3.5 h-3.5" />
            <span>{isSwahili ? 'Pakua Zote (PDF)' : 'Export PDF'}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
