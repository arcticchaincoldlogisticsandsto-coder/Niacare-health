import React, { useState, useEffect, useRef } from 'react';
import {
  FileText,
  X,
  Search,
  Download,
  Share2,
  CheckCircle2,
  Calendar,
  Building2,
  User,
  ShieldCheck,
  Activity,
  Printer,
  ChevronDown,
  ChevronUp,
  FileCheck2,
  Sparkles,
  Filter,
  FolderLock,
  Upload,
  BookmarkPlus,
  BookmarkCheck,
  Trash2,
  Star,
  FileDown,
  Plus,
  Eye,
  Lock,
  Check,
  AlertCircle,
  FileSpreadsheet,
  Layers,
} from 'lucide-react';
import { MedicalRecord, PersonalFileItem } from '../data/medicalRecords';
import { Language, Theme } from '../types';
import { generateMedicalRecordPdf, generateCompiledMedicalPassportPdf } from '../utils/pdfGenerator';
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
}) => {
  const isDark = theme === 'dark';
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

  useEffect(() => {
    if (!isOpen || !authUserId) return;
    let active = true;
    fetchMedicalRecords(authUserId).then(({ records: fetched }) => {
      if (active) setRecords(fetched);
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

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-xs animate-in fade-in">
      <div
        className={`w-full max-w-3xl rounded-2xl p-4 sm:p-6 border relative max-h-[94vh] flex flex-col shadow-2xl ${
          isDark ? 'bg-[#0E1B2C] border-slate-700 text-white' : 'bg-white border-slate-200 text-slate-900'
        }`}
      >
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-slate-800 flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-primary/10 text-primary dark:text-primary-light flex items-center justify-center font-semibold shadow-inner">
              <FolderLock className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base sm:text-lg font-semibold tracking-tight">
                  {isSwahili ? 'Rekodi za Matibabu & Faili Binafsi' : 'Medical Records & Personal Files Vault'}
                </h3>
                <span className="text-[10px] font-mono font-bold bg-primary/10 text-primary dark:text-primary-light px-2 py-0.5 rounded-full">
                  {activeTab === 'records' ? `${filteredRecords.length} Reports` : `${filteredPersonalFiles.length} Stored Files`}
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {isSwahili ? `Mgonjwa: ${patientName} • ID: ${patientId}` : `Patient: ${patientName} • ID: ${patientId}`}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleExportCompletePassport}
              className={`hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-bold transition-all cursor-pointer shadow-xs ${
                isDark
                  ? 'bg-primary/10 border-primary/30 text-primary-light hover:bg-primary/15'
                  : 'bg-primary/5 border-primary/20 text-primary hover:bg-primary/10'
              }`}
              title="Download Complete Health Passport PDF"
            >
              <FileDown className="w-3.5 h-3.5" />
              <span>{isSwahili ? 'Pakua Pasipoti Zote (PDF)' : 'Download All as PDF'}</span>
            </button>

            <button
              type="button"
              onClick={onClose}
              className="p-2 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-700 dark:hover:text-white cursor-pointer transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Primary View Switcher: Hospital Records vs. Personal Files Vault */}
        <div className="pt-3 pb-2 flex-shrink-0 flex items-center justify-between gap-2 border-b border-slate-200/80 dark:border-slate-800">
          <div className="flex items-center gap-2 bg-slate-100 dark:bg-slate-900/90 p-1 rounded-2xl border border-slate-200 dark:border-slate-800 w-full sm:w-auto">
            <button
              type="button"
              onClick={() => setActiveTab('records')}
              className={`flex-1 sm:flex-initial px-4 py-2 rounded-xl text-xs font-semibold flex items-center justify-center gap-2 cursor-pointer transition-all ${
                activeTab === 'records'
                  ? isDark
                    ? 'bg-primary text-white shadow-md'
                    : 'bg-primary-dark text-white shadow-md'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <FileText className="w-3.5 h-3.5" />
              <span>{isSwahili ? 'Rekodi za Hospitali & Vipimo' : 'Hospital Records & Lab Tests'}</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('personal_files')}
              className={`flex-1 sm:flex-initial px-4 py-2 rounded-xl text-xs font-semibold flex items-center justify-center gap-2 cursor-pointer transition-all ${
                activeTab === 'personal_files'
                  ? isDark
                    ? 'bg-primary text-white shadow-md'
                    : 'bg-primary text-white shadow-md'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <FolderLock className="w-3.5 h-3.5" />
              <span>{isSwahili ? 'Faili Zangu Binafsi' : 'My Personal Files'}</span>
              <span
                className={`text-[10px] font-mono px-1.5 py-0.2 rounded-full font-semibold ${
                  activeTab === 'personal_files'
                    ? isDark
                      ? 'bg-white/10 text-white'
                      : 'bg-white text-primary'
                    : 'bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300'
                }`}
              >
                {personalFiles.length}
              </span>
            </button>
          </div>

          {activeTab === 'personal_files' && (
            <button
              type="button"
              onClick={() => setIsUploadOpen(true)}
              className="px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs flex items-center gap-1.5 shadow-sm cursor-pointer transition-all flex-shrink-0"
            >
              <Upload className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">{isSwahili ? 'Weka Faili Jipya' : 'Add Document'}</span>
              <span className="sm:hidden">{isSwahili ? 'Ongeza' : 'Upload'}</span>
            </button>
          )}
        </div>

        {/* Global Action Toast */}
        {actionNotice && (
          <div
            className={`my-2 p-3 rounded-2xl text-xs font-bold flex items-center justify-between shadow-lg animate-in slide-in-from-top duration-200 flex-shrink-0 ${
              actionNotice.type === 'success'
                ? 'bg-emerald-600 text-white'
                : isDark
                ? 'bg-primary/15 text-primary-light border border-primary/30'
                : 'bg-primary text-white'
            }`}
          >
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4" />
              <span>{actionNotice.text}</span>
            </div>
            <span className="text-[10px] font-mono bg-black/20 px-2 py-0.5 rounded">PDF Stored</span>
          </div>
        )}

        {/* ========================================================================= */}
        {/* VIEW 1: HOSPITAL MEDICAL RECORDS */}
        {/* ========================================================================= */}
        {activeTab === 'records' && (
          <div className="flex flex-col flex-1 min-h-0">
            {/* Filter Tabs & Search Bar */}
            <div className="py-2.5 space-y-2 flex-shrink-0">
              <div className="flex items-center gap-2">
                <div className="relative flex-1">
                  <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    placeholder={isSwahili ? 'Tafuta kipimo, daktari au hospitali...' : 'Search test, doctor, or hospital...'}
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className={`w-full pl-9 pr-3 py-2 rounded-xl text-xs border outline-none transition-all ${
                      isDark
                        ? 'bg-slate-900 border-slate-700/80 text-white focus:border-primary'
                        : 'bg-slate-50 border-slate-200 text-slate-900 focus:border-primary'
                    }`}
                  />
                  {searchQuery && (
                    <button
                      type="button"
                      onClick={() => setSearchQuery('')}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-white text-xs"
                    >
                      ✕
                    </button>
                  )}
                </div>
              </div>

              {/* Category Pills */}
              <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs scrollbar-none">
                {[
                  { id: 'all', labelSw: 'Zote (All)', labelEn: 'All Records' },
                  { id: 'lab', labelSw: 'Maabara (Lab)', labelEn: 'Lab Tests' },
                  { id: 'radiology', labelSw: 'Mionzi (Radiology)', labelEn: 'Radiology' },
                  { id: 'consultation', labelSw: 'Daktari (Clinical)', labelEn: 'Clinical' },
                  { id: 'vaccine', labelSw: 'Chanjo (Vaccines)', labelEn: 'Vaccines' },
                ].map((cat) => (
                  <button
                    key={cat.id}
                    type="button"
                    onClick={() => setSelectedCategory(cat.id as any)}
                    className={`px-3 py-1.5 rounded-xl font-bold whitespace-nowrap text-xs transition-all cursor-pointer ${
                      selectedCategory === cat.id
                        ? isDark
                          ? 'bg-primary text-white shadow-md'
                          : 'bg-primary-dark text-white shadow-md'
                        : isDark
                        ? 'bg-slate-900 border border-slate-800 text-slate-400 hover:text-slate-200'
                        : 'bg-slate-100 border border-slate-200 text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    {isSwahili ? cat.labelSw : cat.labelEn}
                  </button>
                ))}
              </div>
            </div>

            {/* Records List (Scrollable Area) */}
            <div className="flex-1 overflow-y-auto pr-1 space-y-3 min-h-0">
              {filteredRecords.length === 0 ? (
                <div className="text-center py-12 space-y-2">
                  <FileText className="w-10 h-10 text-slate-400 mx-auto opacity-50" />
                  <p className="text-xs font-bold text-slate-500">
                    {isSwahili ? 'Hakuna rekodi zilizopatikana kwa utafutaji huu.' : 'No medical records matching your search.'}
                  </p>
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedCategory('all');
                      setSearchQuery('');
                    }}
                    className="text-xs text-primary font-semibold hover:underline cursor-pointer"
                  >
                    {isSwahili ? 'Onyesha Rekodi Zote' : 'Reset Filters'}
                  </button>
                </div>
              ) : (
                filteredRecords.map((record) => {
                  const isExpanded = expandedRecordId === record.id;
                  const isStoredInPersonalFiles = personalFiles.some((f) => f.recordId === record.id);

                  return (
                    <div
                      key={record.id}
                      className={`rounded-2xl border transition-all overflow-hidden ${
                        isExpanded
                          ? isDark
                            ? 'bg-[#091422] border-primary/40 shadow-lg'
                            : 'bg-primary/5 border-primary/30 shadow-md'
                          : isDark
                          ? 'bg-slate-900/90 border-slate-800 hover:border-slate-700'
                          : 'bg-slate-50 border-slate-200/80 hover:border-slate-300'
                      }`}
                    >
                      {/* Record Summary Header */}
                      <div
                        onClick={() => setExpandedRecordId(isExpanded ? null : record.id)}
                        className="p-3.5 sm:p-4 flex items-start justify-between gap-3 cursor-pointer select-none"
                      >
                        <div className="space-y-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-primary/10 text-primary dark:text-primary-light font-mono">
                              {record.id}
                            </span>
                            <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 flex items-center gap-1">
                              <Calendar className="w-3 h-3" />
                              <span>{record.date}</span>
                            </span>
                            <span className="text-[10px] font-semibold text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                              <ShieldCheck className="w-3 h-3" />
                              <span>{record.status === 'verified' ? 'Verified (MoH)' : 'Certified'}</span>
                            </span>
                            {isStoredInPersonalFiles && (
                              <span className="text-[10px] font-bold bg-primary/10 text-primary dark:text-primary-light px-2 py-0.2 rounded-md flex items-center gap-1">
                                <BookmarkCheck className="w-3 h-3 text-primary" />
                                <span>{isSwahili ? 'Imehifadhiwa' : 'In Vault'}</span>
                              </span>
                            )}
                          </div>

                          <h4 className="font-semibold text-xs sm:text-sm text-slate-900 dark:text-white leading-tight">
                            {record.title}
                          </h4>

                          <p className="text-[11px] text-slate-500 dark:text-slate-400 flex items-center gap-1.5 truncate">
                            <Building2 className="w-3.5 h-3.5 flex-shrink-0" />
                            <span className="truncate">{record.hospitalName}</span>
                          </p>
                        </div>

                        <div className="flex items-center gap-2 flex-shrink-0">
                          <span className="text-[10px] font-bold px-2 py-1 rounded-xl bg-primary/10 dark:bg-primary/15 text-primary dark:text-primary-light hidden sm:inline-block">
                            {isSwahili ? record.categoryLabel.sw : record.categoryLabel.en}
                          </span>
                          <div className="p-1 rounded-full text-slate-400">
                            {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                          </div>
                        </div>
                      </div>

                      {/* Expanded Medical Details */}
                      {isExpanded && (
                        <div className="px-3.5 sm:px-4 pb-4 pt-1 border-t border-slate-200/80 dark:border-slate-800 space-y-3">
                          {/* Doctor / Department Banner */}
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs p-2.5 rounded-xl bg-black/5 dark:bg-black/30 border border-slate-200 dark:border-slate-800/80">
                            <div>
                              <span className="text-[10px] text-slate-500 dark:text-slate-400 font-bold uppercase block">
                                {isSwahili ? 'Daktari Bingwa / Mtaalamu' : 'Doctor / Specialist'}
                              </span>
                              <span className="font-bold text-slate-900 dark:text-white">{record.doctorName}</span>
                            </div>
                            <div>
                              <span className="text-[10px] text-slate-500 dark:text-slate-400 font-bold uppercase block">
                                {isSwahili ? 'Idara ya Hospitali' : 'Department'}
                              </span>
                              <span className="font-bold text-slate-900 dark:text-white">{record.department}</span>
                            </div>
                          </div>

                          {/* Summary */}
                          <div className="text-xs">
                            <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block mb-1">
                              {isSwahili ? 'Muhtasari wa Majibu' : 'Clinical Summary'}
                            </span>
                            <p className="text-slate-700 dark:text-slate-300 leading-relaxed font-medium bg-white/40 dark:bg-slate-950/40 p-2.5 rounded-xl border border-slate-200 dark:border-slate-800">
                              {isSwahili ? record.summary.sw : record.summary.en}
                            </p>
                          </div>

                          {/* Detailed Lab Test Parameter Table if available */}
                          {record.details?.labParams && (
                            <div className="space-y-1.5">
                              <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">
                                {isSwahili ? 'Matokeo ya Vipimo (Lab Indices)' : 'Detailed Lab Indices'}
                              </span>
                              <div className="rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden font-mono text-[11px]">
                                <div className="grid grid-cols-4 p-2 bg-slate-100 dark:bg-slate-800/80 font-bold text-[10px] text-slate-500 dark:text-slate-400 uppercase">
                                  <span className="col-span-2">{isSwahili ? 'Kipimo' : 'Test'}</span>
                                  <span>{isSwahili ? 'Matokeo' : 'Result'}</span>
                                  <span>{isSwahili ? 'Kiwango cha Kawaida' : 'Reference'}</span>
                                </div>
                                {record.details.labParams.map((param, idx) => (
                                  <div
                                    key={idx}
                                    className={`grid grid-cols-4 p-2 items-center border-t border-slate-200 dark:border-slate-800 ${
                                      idx % 2 === 0 ? 'bg-transparent' : 'bg-slate-50/50 dark:bg-slate-900/40'
                                    }`}
                                  >
                                    <span className="col-span-2 font-bold text-slate-900 dark:text-white">
                                      {param.name}
                                    </span>
                                    <span className="font-semibold text-emerald-600 dark:text-emerald-400">
                                      {param.value} {param.unit}
                                    </span>
                                    <span className="text-[10px] text-slate-500 dark:text-slate-400">
                                      {param.referenceRange}
                                    </span>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}

                          {/* Radiology Findings if available */}
                          {record.details?.radiologyFindings && (
                            <div className="p-2.5 rounded-xl bg-primary/10 dark:bg-primary/15 border border-primary/20 dark:border-primary-dark text-xs">
                              <span className="text-[10px] text-primary dark:text-primary-light font-bold uppercase block mb-0.5">
                                {isSwahili ? 'Taarifa ya Mionzi (Radiologist Findings)' : 'Radiologist Findings'}
                              </span>
                              <p className="text-slate-700 dark:text-slate-300">
                                {isSwahili ? record.details.radiologyFindings.sw : record.details.radiologyFindings.en}
                              </p>
                            </div>
                          )}

                          {/* Certificate info if available */}
                          {record.details?.certificateNumber && (
                            <div className="p-2.5 rounded-xl bg-amber-50/60 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900 text-xs flex items-center justify-between">
                              <div>
                                <span className="text-[10px] text-amber-600 dark:text-amber-400 font-bold uppercase block">
                                  {isSwahili ? 'Nambari ya Cheti cha Kimataifa' : 'Official Certificate No.'}
                                </span>
                                <span className="font-mono font-semibold text-slate-900 dark:text-white">
                                  {record.details.certificateNumber}
                                </span>
                              </div>
                              <span className="text-[10px] font-bold bg-amber-500/20 text-amber-600 dark:text-amber-300 px-2 py-0.5 rounded">
                                {record.details.validity}
                              </span>
                            </div>
                          )}

                          {/* Action buttons: Download PDF & Save to Personal Files */}
                          <div className="pt-2 flex flex-wrap items-center justify-end gap-2">
                            {/* Save / Store to Personal Files button */}
                            <button
                              type="button"
                              onClick={() => handleSaveToPersonalFiles(record)}
                              className={`px-3.5 py-2 rounded-xl font-bold text-xs flex items-center gap-1.5 cursor-pointer transition-all ${
                                isStoredInPersonalFiles
                                  ? 'bg-primary/10 text-primary dark:text-primary-light border border-primary/30'
                                  : isDark
                                  ? 'bg-primary/10 text-primary-light hover:bg-primary/15 border border-primary/30'
                                  : 'bg-primary/5 text-primary hover:bg-primary/10 border border-primary/20'
                              }`}
                            >
                              {isStoredInPersonalFiles ? (
                                <>
                                  <BookmarkCheck className="w-3.5 h-3.5 text-primary" />
                                  <span>{isSwahili ? 'Imehifadhiwa kwenye Faili Zangu' : 'Saved in Personal Files'}</span>
                                </>
                              ) : (
                                <>
                                  <BookmarkPlus className="w-3.5 h-3.5" />
                                  <span>{isSwahili ? 'Hifadhi kwenye Faili Zangu' : 'Save to Personal Files'}</span>
                                </>
                              )}
                            </button>

                            {/* Download PDF Button */}
                            <button
                              type="button"
                              onClick={() => handleDownloadPdf(record)}
                              className="px-3.5 py-2 rounded-xl bg-primary hover:bg-primary-light text-white font-semibold text-xs flex items-center gap-1.5 cursor-pointer transition-all shadow-xs"
                            >
                              <Download className="w-3.5 h-3.5" />
                              <span>{isSwahili ? 'Pakua Ripoti (PDF)' : 'Download PDF'}</span>
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
            <div className="py-2.5 space-y-2 flex-shrink-0">
              <div className="flex items-center gap-2">
                <div className="relative flex-1">
                  <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    placeholder={isSwahili ? 'Tafuta faili, dokezo au hospitali...' : 'Search your saved personal documents...'}
                    value={personalFileSearch}
                    onChange={(e) => setPersonalFileSearch(e.target.value)}
                    className={`w-full pl-9 pr-3 py-2 rounded-xl text-xs border outline-none transition-all ${
                      isDark
                        ? 'bg-slate-900 border-slate-700/80 text-white focus:border-primary-light'
                        : 'bg-slate-50 border-slate-200 text-slate-900 focus:border-primary'
                    }`}
                  />
                  {personalFileSearch && (
                    <button
                      type="button"
                      onClick={() => setPersonalFileSearch('')}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 text-xs"
                    >
                      ✕
                    </button>
                  )}
                </div>
              </div>

              {/* Category Filter Pills */}
              <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs scrollbar-none">
                {[
                  { id: 'all', labelSw: 'Faili Zote', labelEn: 'All Files' },
                  { id: 'hospital_report', labelSw: '📋 Ripoti za Daktari', labelEn: '📋 Clinical Reports' },
                  { id: 'lab_result', labelSw: 'Vipimo vya Damu', labelEn: 'Lab Results' },
                  { id: 'vaccine_cert', labelSw: 'Vyeti vya Chanjo', labelEn: 'Vaccine Passports' },
                  { id: 'scan_image', labelSw: 'Picha za Mionzi', labelEn: 'Scans / X-Ray' },
                  { id: 'custom_upload', labelSw: '📁 Nyaraka Nilizoweka', labelEn: '📁 My Uploads' },
                ].map((cat) => (
                  <button
                    key={cat.id}
                    type="button"
                    onClick={() => setPersonalFileCategory(cat.id as any)}
                    className={`px-3 py-1.5 rounded-xl font-bold whitespace-nowrap text-xs transition-all cursor-pointer ${
                      personalFileCategory === cat.id
                        ? isDark
                          ? 'bg-primary text-white shadow-md'
                          : 'bg-primary text-white shadow-md'
                        : isDark
                        ? 'bg-slate-900 border border-slate-800 text-slate-400 hover:text-slate-200'
                        : 'bg-slate-100 border border-slate-200 text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    {isSwahili ? cat.labelSw : cat.labelEn}
                  </button>
                ))}
              </div>
            </div>

            {/* Personal Files Vault List */}
            <div className="flex-1 overflow-y-auto pr-1 space-y-2.5 min-h-0">
              {filteredPersonalFiles.length === 0 ? (
                <div className="text-center py-12 space-y-3">
                  <FolderLock className="w-12 h-12 text-slate-400 mx-auto opacity-50" />
                  <p className="text-xs font-bold text-slate-500">
                    {isSwahili
                      ? 'Huna nyaraka zilizohifadhiwa kwenye kundi hili.'
                      : 'No saved documents matching your search in your personal files vault.'}
                  </p>
                  <button
                    type="button"
                    onClick={() => setIsUploadOpen(true)}
                    className="px-4 py-2 rounded-xl bg-primary text-white text-xs font-semibold inline-flex items-center gap-1.5 shadow-sm cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>{isSwahili ? 'Weka Faili au Picha Sasa' : 'Upload Medical Document Now'}</span>
                  </button>
                </div>
              ) : (
                filteredPersonalFiles.map((file) => (
                  <div
                    key={file.id}
                    className={`p-3.5 rounded-2xl border transition-all flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 ${
                      isDark
                        ? 'bg-[#091422] border-slate-800/90 hover:border-primary/50'
                        : 'bg-slate-50 border-slate-200 hover:border-primary/40'
                    }`}
                  >
                    <div className="flex items-start gap-3 min-w-0 flex-1">
                      <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary dark:text-primary-light flex items-center justify-center flex-shrink-0 mt-0.5">
                        <FileText className="w-5 h-5" />
                      </div>

                      <div className="space-y-1 min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-[10px] font-bold font-mono px-2 py-0.2 rounded bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                            {file.fileSize} • PDF
                          </span>
                          <span className="text-[10px] text-slate-500 dark:text-slate-400 flex items-center gap-1">
                            <Calendar className="w-3 h-3" />
                            <span>{file.dateAdded}</span>
                          </span>
                          {file.isEncrypted && (
                            <span className="text-[9px] font-bold text-emerald-600 dark:text-emerald-400 flex items-center gap-0.5">
                              <Lock className="w-2.5 h-2.5" />
                              <span>Encrypted</span>
                            </span>
                          )}
                        </div>

                        <h4 className="font-bold text-xs sm:text-sm text-slate-900 dark:text-white leading-tight">
                          {file.title}
                        </h4>

                        <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                          {file.facility} {file.notes ? `• ${file.notes}` : ''}
                        </p>
                      </div>
                    </div>

                    {/* Actions on this personal file */}
                    <div className="flex items-center gap-1.5 self-end sm:self-center flex-shrink-0">
                      {/* Star Button */}
                      <button
                        type="button"
                        onClick={() => handleToggleStar(file.id)}
                        className={`p-2 rounded-xl transition-colors cursor-pointer ${
                          file.starred
                            ? 'text-amber-400 hover:text-amber-300 bg-amber-400/10'
                            : 'text-slate-400 hover:text-slate-600 dark:hover:text-white'
                        }`}
                        title={file.starred ? 'Starred Favorite' : 'Mark Favorite'}
                      >
                        <Star className="w-4 h-4 fill-current" />
                      </button>

                      {/* Download Single PDF button */}
                      <button
                        type="button"
                        onClick={() => handleDownloadPersonalFile(file)}
                        className="px-3 py-2 rounded-xl bg-primary hover:bg-primary-light text-white font-semibold text-xs flex items-center gap-1.5 cursor-pointer transition-all shadow-xs"
                        title="Download this PDF to local storage"
                      >
                        <Download className="w-3.5 h-3.5" />
                        <span>{isSwahili ? 'Pakua PDF' : 'Download PDF'}</span>
                      </button>

                      {/* Delete / Remove button */}
                      <button
                        type="button"
                        onClick={() => handleRemovePersonalFile(file.id, file.title)}
                        className="p-2 rounded-xl text-slate-400 hover:text-rose-500 hover:bg-rose-500/10 transition-colors cursor-pointer"
                        title={isSwahili ? 'Ondoa kwenye faili zangu' : 'Remove from personal files'}
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
          <div className="absolute inset-0 z-20 bg-black/80 backdrop-blur-xs rounded-2xl p-4 sm:p-6 flex flex-col justify-center animate-in fade-in">
            <div
              className={`w-full max-w-lg mx-auto rounded-2xl p-5 sm:p-6 border space-y-4 shadow-2xl ${
                isDark ? 'bg-[#0F2238] border-primary/30 text-white' : 'bg-white border-slate-200 text-slate-900'
              }`}
            >
              <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3">
                <div className="flex items-center gap-2">
                  <Upload className="w-5 h-5 text-emerald-500" />
                  <h4 className="font-semibold text-sm sm:text-base">
                    {isSwahili ? 'Hifadhi Nyaraka Kwenye Faili Binafsi' : 'Upload Document to Personal Vault'}
                  </h4>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    if (isUploading) return;
                    setIsUploadOpen(false);
                    setSelectedFile(null);
                    setSelectedFileName('');
                    setUploadError('');
                  }}
                  className="p-1 rounded-full text-slate-400 hover:text-white"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Form Fields */}
              <div className="space-y-3 text-xs">
                {/* File picker button */}
                <div>
                  <label className="font-bold block mb-1 text-slate-600 dark:text-slate-300">
                    {isSwahili ? 'Chagua Faili kutoka kwenye Simu/Kompyuta (PDF au Picha):' : 'Select File (PDF, Image, or Scan):'}
                  </label>
                  <input
                    type="file"
                    ref={fileInputRef}
                    onChange={handleFileUpload}
                    accept=".pdf,.png,.jpg,.jpeg,.doc,.docx"
                    className="hidden"
                  />
                  <div
                    onClick={() => fileInputRef.current?.click()}
                    className={`border-2 border-dashed rounded-2xl p-4 text-center cursor-pointer transition-all ${
                      isDark
                        ? 'border-slate-700 bg-slate-900/60 hover:border-primary-light'
                        : 'border-slate-300 bg-slate-50 hover:border-primary'
                    }`}
                  >
                    <Upload className="w-6 h-6 mx-auto text-primary mb-1" />
                    <p className="font-bold">
                      {selectedFileName ? `✓ ${selectedFileName}` : isSwahili ? 'Bofya au Vuta Faili Hapa' : 'Click to browse or drop file here'}
                    </p>
                    <span className="text-[10px] text-slate-400">PDF, JPG, PNG hadi 25MB</span>
                  </div>
                  {uploadError && (
                    <p className="mt-1.5 text-[11px] font-bold text-red-500 flex items-center gap-1">
                      <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
                      {uploadError}
                    </p>
                  )}
                </div>

                {/* Title */}
                <div>
                  <label className="font-bold block mb-1 text-slate-600 dark:text-slate-300">
                    {isSwahili ? 'Jina la Hati / Kipimo:' : 'Document Title:'}
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Kipimo cha Macho, Bima Card Copy..."
                    value={uploadTitle}
                    onChange={(e) => setUploadTitle(e.target.value)}
                    className={`w-full p-2.5 rounded-xl border outline-none ${
                      isDark ? 'bg-slate-900 border-slate-700 text-white' : 'bg-slate-50 border-slate-200'
                    }`}
                  />
                </div>

                {/* Category */}
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="font-bold block mb-1 text-slate-600 dark:text-slate-300">
                      {isSwahili ? 'Aina ya Nyaraka:' : 'Category:'}
                    </label>
                    <select
                      value={uploadCategory}
                      onChange={(e) => setUploadCategory(e.target.value as any)}
                      className={`w-full p-2.5 rounded-xl border outline-none ${
                        isDark ? 'bg-slate-900 border-slate-700 text-white' : 'bg-slate-50 border-slate-200'
                      }`}
                    >
                      <option value="custom_upload">Nyaraka Binafsi (General)</option>
                      <option value="hospital_report">Ripoti ya Daktari (Clinical)</option>
                      <option value="lab_result">Vipimo vya Maabara (Lab)</option>
                      <option value="vaccine_cert">Cheti cha Chanjo (Vaccine)</option>
                      <option value="scan_image">Picha ya Mionzi (Scan/X-Ray)</option>
                      <option value="prescription">Karatasi ya Dawa (Prescription)</option>
                    </select>
                  </div>

                  <div>
                    <label className="font-bold block mb-1 text-slate-600 dark:text-slate-300">
                      {isSwahili ? 'Hospitali / Kituo:' : 'Facility / Issuer:'}
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. Muhimbili, Aga Khan..."
                      value={uploadFacility}
                      onChange={(e) => setUploadFacility(e.target.value)}
                      className={`w-full p-2.5 rounded-xl border outline-none ${
                        isDark ? 'bg-slate-900 border-slate-700 text-white' : 'bg-slate-50 border-slate-200'
                      }`}
                    />
                  </div>
                </div>

                {/* Notes */}
                <div>
                  <label className="font-bold block mb-1 text-slate-600 dark:text-slate-300">
                    {isSwahili ? 'Maelezo / Dokezo (Hiari):' : 'Notes / Clinical Impression (Optional):'}
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Kipimo kiko salama, dozi ya miezi 3..."
                    value={uploadNotes}
                    onChange={(e) => setUploadNotes(e.target.value)}
                    className={`w-full p-2.5 rounded-xl border outline-none ${
                      isDark ? 'bg-slate-900 border-slate-700 text-white' : 'bg-slate-50 border-slate-200'
                    }`}
                  />
                </div>
              </div>

              {/* Action buttons */}
              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-200 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => {
                    setIsUploadOpen(false);
                    setSelectedFile(null);
                    setSelectedFileName('');
                    setUploadError('');
                  }}
                  disabled={isUploading}
                  className="px-4 py-2 rounded-xl bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-200 font-bold text-xs cursor-pointer disabled:opacity-50"
                >
                  {isSwahili ? 'Ghairi' : 'Cancel'}
                </button>

                <button
                  type="button"
                  onClick={handleSaveUpload}
                  disabled={!uploadTitle.trim() || !selectedFile || isUploading}
                  className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-semibold text-xs cursor-pointer shadow-md"
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
        <div className="pt-3 mt-2 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between flex-shrink-0 text-xs">
          <span className="text-[11px] text-slate-500 dark:text-slate-400 flex items-center gap-1">
            <ShieldCheck className="w-4 h-4 text-emerald-500" />
            <span>{isSwahili ? 'Nyaraka zote zimehifadhiwa kwa usalama chini ya PDPA 2022' : 'Protected & encrypted under Tanzania PDPA Act 2022'}</span>
          </span>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleExportCompletePassport}
              className="px-3 py-2 rounded-xl bg-primary/10 text-primary dark:text-primary-light font-semibold text-xs flex items-center gap-1.5 cursor-pointer hover:bg-primary/15 transition-all sm:hidden"
            >
              <Download className="w-3.5 h-3.5" />
              <span>PDF</span>
            </button>

            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl bg-slate-200 dark:bg-slate-800 hover:bg-slate-300 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 font-bold text-xs cursor-pointer transition-all"
            >
              {isSwahili ? 'Funga' : 'Close'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
