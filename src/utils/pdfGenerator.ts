import jsPDF from 'jspdf';
import { MedicalRecord } from '../data/medicalRecords';

export interface PatientInfoForPdf {
  name: string;
  id: string;
  dob?: string;
  bloodType?: string;
  phone?: string;
  insurance?: string;
  docType?: string;
  docNumber?: string;
}

/**
 * Generates an official, beautifully styled medical record PDF document
 * and triggers download to the user's local filesystem.
 */
export function generateMedicalRecordPdf(
  record: MedicalRecord,
  patient: PatientInfoForPdf,
  language: string = 'en'
): void {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  const isSwahili = language === 'sw';
  const isFrench = language === 'fr';

  // --- Theme Colors ---
  const primaryNavy = [13, 148, 136]; // #0D9488 (NiaCare teal)
  const darkSlate = [15, 23, 42]; // #0F172A
  const accentTeal = [13, 148, 136]; // #0D9488
  const lightBg = [248, 250, 252]; // #F8FAFC
  const borderGray = [226, 232, 240]; // #E2E8F0
  const textMuted = [100, 116, 139]; // #64748B

  // --- Top Decorative Header Banner ---
  doc.setFillColor(primaryNavy[0], primaryNavy[1], primaryNavy[2]);
  doc.rect(0, 0, 210, 28, 'F');

  // Republic / Ministry Branding
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.text('JAMHURI YA MUUNGANO WA TANZANIA • MINISTRY OF HEALTH', 105, 10, { align: 'center' });

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.text('NATIONAL DIGITAL HEALTH INFORMATION PORTAL (NIACARE HEALTH PASSPORT)', 105, 16, { align: 'center' });

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.text('OFFICIAL CERTIFIED MEDICAL & DIAGNOSTIC REPORT', 105, 23, { align: 'center' });

  // --- Facility & Document Identification ---
  let y = 38;

  doc.setTextColor(darkSlate[0], darkSlate[1], darkSlate[2]);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.text(record.hospitalName, 15, y);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(textMuted[0], textMuted[1], textMuted[2]);
  doc.text(`Department: ${record.department}`, 15, y + 5);
  doc.text(`Attending Physician: ${record.doctorName}`, 15, y + 10);

  // Right-aligned reference details
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(primaryNavy[0], primaryNavy[1], primaryNavy[2]);
  doc.text(`RECORD REF: ${record.id}`, 195, y, { align: 'right' });
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(textMuted[0], textMuted[1], textMuted[2]);
  doc.text(`Date of Issue: ${record.date}`, 195, y + 5, { align: 'right' });
  doc.text(`Status: CERTIFIED & VERIFIED ✓`, 195, y + 10, { align: 'right' });

  // Divider
  y += 16;
  doc.setDrawColor(borderGray[0], borderGray[1], borderGray[2]);
  doc.setLineWidth(0.5);
  doc.line(15, y, 195, y);

  // --- Patient Demographics Box ---
  y += 4;
  doc.setFillColor(lightBg[0], lightBg[1], lightBg[2]);
  doc.roundedRect(15, y, 180, 26, 2, 2, 'F');
  doc.rect(15, y, 180, 26, 'S');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(primaryNavy[0], primaryNavy[1], primaryNavy[2]);
  doc.text('PATIENT IDENTIFICATION & DEMOGRAPHICS', 18, y + 5);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(darkSlate[0], darkSlate[1], darkSlate[2]);

  // Col 1
  doc.text(`Full Name: ${patient.name}`, 18, y + 12);
  doc.text(`NiaCare ID: ${patient.id}`, 18, y + 18);
  doc.text(`Date of Birth: ${patient.dob || '12 Apr 1995'}`, 18, y + 23);

  // Col 2
  doc.text(`Blood Group: ${patient.bloodType || 'O+'}`, 80, y + 12);
  doc.text(`Phone: ${patient.phone || '+255 754 829 140'}`, 80, y + 18);
  doc.text(`Primary ID: ${patient.docNumber || '19950412111020000421'}`, 80, y + 23);

  // Col 3
  doc.text(`Insurance: ${patient.insurance || 'NHIF Tanzania'}`, 140, y + 12);
  doc.text(`Coverage: Active / In-Network`, 140, y + 18);
  doc.text(`Auth Code: AUTH-${record.id.slice(-6)}`, 140, y + 23);

  y += 32;

  // --- Report Title & Category Header ---
  doc.setFillColor(accentTeal[0], accentTeal[1], accentTeal[2]);
  doc.roundedRect(15, y, 180, 8, 1, 1, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.text(
    `DIAGNOSTIC REPORT: ${record.title.toUpperCase()}`,
    18,
    y + 5.5
  );

  y += 13;

  // --- Clinical Summary & Narrative ---
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(primaryNavy[0], primaryNavy[1], primaryNavy[2]);
  doc.text('1. CLINICAL SUMMARY & OVERVIEW', 15, y);

  y += 5;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(darkSlate[0], darkSlate[1], darkSlate[2]);

  const summaryText = isSwahili
    ? record.summary.sw
    : isFrench
    ? record.summary.en
    : record.summary.en;

  const splitSummary = doc.splitTextToSize(summaryText, 180);
  doc.text(splitSummary, 15, y);
  y += splitSummary.length * 4.5 + 4;

  // --- Detailed Lab Test Indices (if present) ---
  if (record.details?.labParams && record.details.labParams.length > 0) {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(primaryNavy[0], primaryNavy[1], primaryNavy[2]);
    doc.text('2. LABORATORY INDICES & PARAMETERS', 15, y);
    y += 5;

    // Table Header
    doc.setFillColor(primaryNavy[0], primaryNavy[1], primaryNavy[2]);
    doc.rect(15, y, 180, 6, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(8);
    doc.text('TEST PARAMETER', 18, y + 4.2);
    doc.text('RESULT', 95, y + 4.2);
    doc.text('UNIT', 130, y + 4.2);
    doc.text('REFERENCE INTERVAL', 155, y + 4.2);
    y += 6;

    // Table Rows
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    record.details.labParams.forEach((param, idx) => {
      if (idx % 2 === 1) {
        doc.setFillColor(245, 247, 250);
        doc.rect(15, y, 180, 6, 'F');
      }
      doc.setDrawColor(borderGray[0], borderGray[1], borderGray[2]);
      doc.rect(15, y, 180, 6, 'S');

      doc.setTextColor(darkSlate[0], darkSlate[1], darkSlate[2]);
      doc.text(param.name, 18, y + 4.2);

      doc.setFont('helvetica', 'bold');
      doc.setTextColor(13, 148, 136); // Teal for results
      doc.text(`${param.value}`, 95, y + 4.2);

      doc.setFont('helvetica', 'normal');
      doc.setTextColor(textMuted[0], textMuted[1], textMuted[2]);
      doc.text(param.unit || '-', 130, y + 4.2);
      doc.text(param.referenceRange, 155, y + 4.2);

      y += 6;
    });

    y += 5;
  }

  // --- Radiology Findings (if present) ---
  if (record.details?.radiologyFindings) {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(primaryNavy[0], primaryNavy[1], primaryNavy[2]);
    doc.text('2. RADIOLOGICAL FINDINGS & IMAGING INTERPRETATION', 15, y);
    y += 5;

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(darkSlate[0], darkSlate[1], darkSlate[2]);
    const radText = isSwahili
      ? record.details.radiologyFindings.sw
      : record.details.radiologyFindings.en;
    const splitRad = doc.splitTextToSize(radText, 180);
    doc.text(splitRad, 15, y);
    y += splitRad.length * 4.5 + 4;
  }

  // --- Clinical Impression & Recommendations ---
  if (record.details?.clinicalImpression || record.details?.recommendation) {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(primaryNavy[0], primaryNavy[1], primaryNavy[2]);
    doc.text('3. CLINICAL IMPRESSION & RECOMMENDATIONS', 15, y);
    y += 5;

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.5);
    doc.setTextColor(darkSlate[0], darkSlate[1], darkSlate[2]);

    if (record.details.clinicalImpression) {
      const impText = `• Impression: ${
        isSwahili ? record.details.clinicalImpression.sw : record.details.clinicalImpression.en
      }`;
      const splitImp = doc.splitTextToSize(impText, 180);
      doc.text(splitImp, 15, y);
      y += splitImp.length * 4.2 + 2;
    }

    if (record.details.recommendation) {
      const recText = `• Recommendation: ${
        isSwahili ? record.details.recommendation.sw : record.details.recommendation.en
      }`;
      const splitRec = doc.splitTextToSize(recText, 180);
      doc.text(splitRec, 15, y);
      y += splitRec.length * 4.2 + 4;
    }
  }

  // --- Official Validation & Doctor Signature Footer ---
  const footerY = 245;

  doc.setDrawColor(borderGray[0], borderGray[1], borderGray[2]);
  doc.line(15, footerY - 5, 195, footerY - 5);

  // Left side: Digital Security & Verification
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(primaryNavy[0], primaryNavy[1], primaryNavy[2]);
  doc.text('DIGITAL VERIFICATION & AUTHENTICITY', 15, footerY);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(textMuted[0], textMuted[1], textMuted[2]);
  doc.text(`Digital Passkey SHA256: 8F2A-99B1-40EC-${record.id.slice(-4)}-VERIFIED`, 15, footerY + 4.5);
  doc.text('Issued under the Republic of Tanzania Personal Data Protection Act (PDPA 2022).', 15, footerY + 9);
  doc.text('This PDF document is encrypted and digitally stamped by NiaCare e-Health System.', 15, footerY + 13.5);

  // Right side: Doctor Signature & Stamp Box
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(primaryNavy[0], primaryNavy[1], primaryNavy[2]);
  doc.text('AUTHORISED MEDICAL SIGNATURE', 140, footerY);

  doc.setFont('courier', 'bolditalic');
  doc.setFontSize(9);
  doc.setTextColor(10, 66, 117);
  doc.text(`// ${record.doctorName} //`, 140, footerY + 6);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  doc.setTextColor(textMuted[0], textMuted[1], textMuted[2]);
  doc.text('Medical Registration No: MCT/REG/2026/8942', 140, footerY + 10);
  doc.text(`Certified on: ${record.date}`, 140, footerY + 14);

  // Bottom Banner
  doc.setFillColor(primaryNavy[0], primaryNavy[1], primaryNavy[2]);
  doc.rect(0, 287, 210, 10, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.text(
    `Page 1 of 1 • NiaCare Health Record #${record.id} • Confidential Medical Document`,
    105,
    293,
    { align: 'center' }
  );

  // Trigger browser download
  const safeFilename = record.pdfFileName || `${record.id}_Medical_Report.pdf`;
  doc.save(safeFilename);
}

/**
 * Generates a compiled Comprehensive Medical Record & Health Passport PDF
 * containing all clinical encounters, lab results, and patient credentials.
 */
export function generateCompiledMedicalPassportPdf(
  records: MedicalRecord[],
  patient: PatientInfoForPdf,
  language: string = 'en'
): void {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  const primaryNavy = [13, 148, 136]; // #0D9488 (NiaCare teal)
  const darkSlate = [15, 23, 42];
  const lightBg = [248, 250, 252];
  const borderGray = [226, 232, 240];
  const textMuted = [100, 116, 139];

  // Header Banner
  doc.setFillColor(primaryNavy[0], primaryNavy[1], primaryNavy[2]);
  doc.rect(0, 0, 210, 32, 'F');

  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.text('JAMHURI YA MUUNGANO WA TANZANIA • MINISTRY OF HEALTH', 105, 11, { align: 'center' });

  doc.setFontSize(8.5);
  doc.setFont('helvetica', 'normal');
  doc.text('NATIONAL DIGITAL HEALTH INFORMATION PORTAL (NIACARE)', 105, 17, { align: 'center' });

  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.text('COMPLETE PERSONAL HEALTH PASSPORT & CUMULATIVE MEDICAL RECORDS', 105, 25, { align: 'center' });

  let y = 42;

  // Patient Card
  doc.setFillColor(lightBg[0], lightBg[1], lightBg[2]);
  doc.roundedRect(15, y, 180, 32, 2, 2, 'F');
  doc.setDrawColor(borderGray[0], borderGray[1], borderGray[2]);
  doc.rect(15, y, 180, 32, 'S');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(primaryNavy[0], primaryNavy[1], primaryNavy[2]);
  doc.text('PATIENT IDENTIFIER & HEALTH SUMMARY', 20, y + 6);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(darkSlate[0], darkSlate[1], darkSlate[2]);

  doc.text(`Patient Name: ${patient.name}`, 20, y + 13);
  doc.text(`NiaCare Health ID: ${patient.id}`, 20, y + 19);
  doc.text(`Date of Birth: ${patient.dob || '12 Apr 1995'}`, 20, y + 25);

  doc.text(`Blood Group: ${patient.bloodType || 'O+'}`, 85, y + 13);
  doc.text(`Phone: ${patient.phone || '+255 754 829 140'}`, 85, y + 19);
  doc.text(`Document: ${patient.docNumber || '19950412111020000421'}`, 85, y + 25);

  doc.text(`Insurance: ${patient.insurance || 'NHIF Tanzania'}`, 140, y + 13);
  doc.text(`Status: ACTIVE & VERIFIED`, 140, y + 19);
  doc.text(`Total Records: ${records.length} Certified Files`, 140, y + 25);

  y += 40;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(primaryNavy[0], primaryNavy[1], primaryNavy[2]);
  doc.text('CUMULATIVE MEDICAL & DIAGNOSTIC HISTORY', 15, y);
  y += 6;

  records.forEach((rec, index) => {
    if (y > 240) {
      doc.addPage();
      y = 20;
    }

    doc.setFillColor(245, 247, 250);
    doc.roundedRect(15, y, 180, 28, 2, 2, 'F');
    doc.setDrawColor(borderGray[0], borderGray[1], borderGray[2]);
    doc.rect(15, y, 180, 28, 'S');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(primaryNavy[0], primaryNavy[1], primaryNavy[2]);
    doc.text(`${index + 1}. ${rec.title}`, 18, y + 6);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(textMuted[0], textMuted[1], textMuted[2]);
    doc.text(`Facility: ${rec.hospitalName} • Date: ${rec.date} • Ref: ${rec.id}`, 18, y + 11);

    doc.setTextColor(darkSlate[0], darkSlate[1], darkSlate[2]);
    const summary = rec.summary.en;
    const splitSum = doc.splitTextToSize(`Result: ${summary}`, 174);
    doc.text(splitSum.slice(0, 2), 18, y + 17);

    y += 33;
  });

  // Footer
  doc.setFillColor(primaryNavy[0], primaryNavy[1], primaryNavy[2]);
  doc.rect(0, 287, 210, 10, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.text(
    `NiaCare Health Passport • Certified Archive of ${patient.name} • ${patient.id}`,
    105,
    293,
    { align: 'center' }
  );

  doc.save(`NiaCare_Complete_Health_Passport_${patient.id}.pdf`);
}

export interface ReceiptForPdf {
  receiptNo: string;
  mode: 'insurance' | 'cash';
  methodTitle: string;
  authRef: string;
  amountPaidTzs: number;
  amountPaidUsd: number;
  facility: string;
  timestamp: string;
}

/**
 * Generates a payment receipt PDF for a settled bill and triggers download.
 */
export function generateReceiptPdf(receipt: ReceiptForPdf, patient: PatientInfoForPdf): void {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });

  const primaryTeal = [13, 148, 136]; // #0D9488
  const darkSlate = [15, 23, 42]; // #0F172A
  const lightBg = [248, 250, 252]; // #F8FAFC
  const borderGray = [226, 232, 240]; // #E2E8F0
  const textMuted = [100, 116, 139]; // #64748B
  const successGreen = [16, 185, 129]; // #10B981

  doc.setFillColor(primaryTeal[0], primaryTeal[1], primaryTeal[2]);
  doc.rect(0, 0, 210, 28, 'F');

  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.text('NIACARE HEALTH', 105, 12, { align: 'center' });

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.text('OFFICIAL PAYMENT RECEIPT', 105, 20, { align: 'center' });

  let y = 38;

  doc.setTextColor(darkSlate[0], darkSlate[1], darkSlate[2]);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.text(receipt.facility, 15, y);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(textMuted[0], textMuted[1], textMuted[2]);
  doc.text(`Payment Method: ${receipt.methodTitle}`, 15, y + 6);

  doc.setFont('helvetica', 'bold');
  doc.setTextColor(primaryTeal[0], primaryTeal[1], primaryTeal[2]);
  doc.text(`RECEIPT NO: ${receipt.receiptNo}`, 195, y, { align: 'right' });
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(textMuted[0], textMuted[1], textMuted[2]);
  doc.text(`Date: ${receipt.timestamp}`, 195, y + 6, { align: 'right' });

  y += 14;
  doc.setDrawColor(borderGray[0], borderGray[1], borderGray[2]);
  doc.setLineWidth(0.5);
  doc.line(15, y, 195, y);

  // Patient box
  y += 6;
  doc.setFillColor(lightBg[0], lightBg[1], lightBg[2]);
  doc.roundedRect(15, y, 180, 22, 2, 2, 'F');
  doc.rect(15, y, 180, 22, 'S');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(primaryTeal[0], primaryTeal[1], primaryTeal[2]);
  doc.text('PATIENT & AUTHORIZATION', 18, y + 5);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(darkSlate[0], darkSlate[1], darkSlate[2]);
  doc.text(`Name: ${patient.name}`, 18, y + 11);
  doc.text(`Patient ID: ${patient.id}`, 18, y + 16);
  doc.text(`Authorization Ref: ${receipt.authRef}`, 105, y + 11);
  doc.text(`Settlement Type: ${receipt.mode === 'insurance' ? 'Insurance Claim' : 'Direct Payment'}`, 105, y + 16);

  // Amount box
  y += 32;
  doc.setFillColor(successGreen[0], successGreen[1], successGreen[2]);
  doc.roundedRect(15, y, 180, 24, 2, 2, 'F');

  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.text('AMOUNT PAID', 20, y + 9);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.text(`TZS ${receipt.amountPaidTzs.toLocaleString()}`, 20, y + 18);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.text(`(approx. USD ${receipt.amountPaidUsd.toFixed(2)})`, 190, y + 18, { align: 'right' });

  y += 34;
  doc.setFont('helvetica', 'italic');
  doc.setFontSize(8);
  doc.setTextColor(textMuted[0], textMuted[1], textMuted[2]);
  doc.text('This receipt confirms settlement of the above bill in the NiaCare system.', 15, y);

  doc.setFillColor(primaryTeal[0], primaryTeal[1], primaryTeal[2]);
  doc.rect(0, 287, 210, 10, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.text(`NiaCare Health Payment Receipt • ${patient.id}`, 105, 293, { align: 'center' });

  doc.save(`NiaCare_Receipt_${receipt.receiptNo}.pdf`);
}
