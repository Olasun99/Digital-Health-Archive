/**
 * Application State and Local Persistence Layer
 * Health Archive Intelligence
 * 
 * Manages:
 * - Documents (Raw OCR, Metadata, Status, File blobs)
 * - Batches
 * - Structured Health Records (AI Extracted & Human Approved)
 * - Human Review tracking (corrections, before/after diffs, approvals)
 * - Patient Registry & Longitudinal Timelines
 * - Encounters, Labs, Medications
 */

import { ClinicalExtractionResult } from './geminiExtraction';

export interface StoredDocument {
  id: string;
  filename: string;
  fileSize: number;
  fileType: string;
  fileDataUrl?: string; // Preview image / PDF representation
  dateProcessed: string;
  pages: number;
  status: 'Queued' | 'Processing' | 'Completed' | 'Failed';
  ocrEngine: string;
  rawOcrText: string;
  ocrConfidence: number | null;
  processingTimeSeconds?: number;
  extractedRecordId?: string;
  isSynthetic?: boolean;
}

export interface HumanCorrection {
  fieldPath: string;
  originalValue: any;
  correctedValue: any;
  reviewer: string;
  timestamp: string;
  reason?: string;
}

export interface StoredHealthRecord {
  id: string;
  documentId: string;
  filename: string;
  patientId: string | null;
  hospitalNumber: string | null;
  extractedAt: string;
  status: 'under_review' | 'approved' | 'rejected' | 'send_back';
  extractedData: ClinicalExtractionResult;
  reviewedData: ClinicalExtractionResult; // Includes human modifications
  corrections: HumanCorrection[];
  reviewedBy: string | null;
  reviewedAt: string | null;
  isSynthetic?: boolean;
}

export interface StoredPatient {
  hospitalNumber: string;
  name: string;
  dateOfBirth: string | null;
  age: string | number | null;
  sex: string | null;
  address: string | null;
  documentIds: string[];
  recordIds: string[];
  firstSeen: string;
  lastVisit: string;
}

export interface StoredBatch {
  id: string;
  createdAt: string;
  status: 'Queued' | 'Processing' | 'Completed' | 'Failed';
  total: number;
  completed: number;
  processing: number;
  failed: number;
  documentIds: string[];
}

const STORAGE_KEY_DOCS = 'HAI_STORED_DOCUMENTS';
const STORAGE_KEY_RECORDS = 'HAI_STORED_RECORDS';
const STORAGE_KEY_BATCHES = 'HAI_STORED_BATCHES';
const STORAGE_KEY_DEMO_MODE = 'HAI_DEMO_MODE_ACTIVE';

export function isDemoModeActive(): boolean {
  if (typeof window === 'undefined') return false;
  return localStorage.getItem(STORAGE_KEY_DEMO_MODE) === 'true';
}

export function setDemoModeActive(active: boolean): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(STORAGE_KEY_DEMO_MODE, active ? 'true' : 'false');
  if (active) {
    seedSyntheticDataIfEmpty();
  }
  window.dispatchEvent(new Event('hai_data_updated'));
}

export const storageService = {
  getDocuments(): StoredDocument[] {
    if (typeof window === 'undefined') return [];
    const raw = localStorage.getItem(STORAGE_KEY_DOCS);
    let list: StoredDocument[] = raw ? JSON.parse(raw) : [];
    if (list.length === 0 && isDemoModeActive()) {
      seedSyntheticDataIfEmpty();
      const updated = localStorage.getItem(STORAGE_KEY_DOCS);
      list = updated ? JSON.parse(updated) : [];
    }
    return list;
  },

  getDocumentById(id: string): StoredDocument | undefined {
    return this.getDocuments().find((d) => d.id === id);
  },

  saveDocument(doc: StoredDocument): void {
    const docs = this.getDocuments().filter((d) => d.id !== doc.id);
    docs.unshift(doc);
    localStorage.setItem(STORAGE_KEY_DOCS, JSON.stringify(docs));
    window.dispatchEvent(new Event('hai_data_updated'));
  },

  saveDocuments(newDocs: StoredDocument[]): void {
    const existing = this.getDocuments();
    const existingIds = new Set(newDocs.map((d) => d.id));
    const filtered = existing.filter((d) => !existingIds.has(d.id));
    const merged = [...newDocs, ...filtered];
    localStorage.setItem(STORAGE_KEY_DOCS, JSON.stringify(merged));
    window.dispatchEvent(new Event('hai_data_updated'));
  },

  getBatches(): StoredBatch[] {
    if (typeof window === 'undefined') return [];
    const raw = localStorage.getItem(STORAGE_KEY_BATCHES);
    return raw ? JSON.parse(raw) : [];
  },

  saveBatch(batch: StoredBatch): void {
    const batches = this.getBatches().filter((b) => b.id !== batch.id);
    batches.unshift(batch);
    localStorage.setItem(STORAGE_KEY_BATCHES, JSON.stringify(batches));
    window.dispatchEvent(new Event('hai_data_updated'));
  },

  getRecords(): StoredHealthRecord[] {
    if (typeof window === 'undefined') return [];
    const raw = localStorage.getItem(STORAGE_KEY_RECORDS);
    let list: StoredHealthRecord[] = raw ? JSON.parse(raw) : [];
    if (list.length === 0 && isDemoModeActive()) {
      seedSyntheticDataIfEmpty();
      const updated = localStorage.getItem(STORAGE_KEY_RECORDS);
      list = updated ? JSON.parse(updated) : [];
    }
    return list;
  },

  getRecordByDocumentId(documentId: string): StoredHealthRecord | undefined {
    return this.getRecords().find((r) => r.documentId === documentId);
  },

  getRecordById(recordId: string): StoredHealthRecord | undefined {
    return this.getRecords().find((r) => r.id === recordId);
  },

  saveRecord(record: StoredHealthRecord): void {
    const records = this.getRecords().filter((r) => r.id !== record.id);
    records.unshift(record);
    localStorage.setItem(STORAGE_KEY_RECORDS, JSON.stringify(records));
    window.dispatchEvent(new Event('hai_data_updated'));
  },

  /**
   * Builds the Patient Registry dynamically from verified or approved records
   */
  getPatients(): StoredPatient[] {
    const records = this.getRecords();
    const patientMap = new Map<string, StoredPatient>();

    records.forEach((rec) => {
      const data = rec.reviewedData || rec.extractedData;
      const hospitalNo = data.patient?.hospital_number?.trim();
      if (!hospitalNo) return;

      const existing = patientMap.get(hospitalNo);
      const encDate = data.encounter?.encounter_date || rec.extractedAt.slice(0, 10);

      if (!existing) {
        patientMap.set(hospitalNo, {
          hospitalNumber: hospitalNo,
          name: data.patient?.patient_name || 'Unnamed Patient',
          dateOfBirth: data.patient?.date_of_birth || null,
          age: data.patient?.age || null,
          sex: data.patient?.sex || null,
          address: data.patient?.address || null,
          documentIds: [rec.documentId],
          recordIds: [rec.id],
          firstSeen: encDate,
          lastVisit: encDate,
        });
      } else {
        if (!existing.documentIds.includes(rec.documentId)) {
          existing.documentIds.push(rec.documentId);
        }
        if (!existing.recordIds.includes(rec.id)) {
          existing.recordIds.push(rec.id);
        }
        if (encDate > existing.lastVisit) existing.lastVisit = encDate;
        if (encDate < existing.firstSeen) existing.firstSeen = encDate;
      }
    });

    return Array.from(patientMap.values());
  },

  clearAllData(): void {
    localStorage.removeItem(STORAGE_KEY_DOCS);
    localStorage.removeItem(STORAGE_KEY_RECORDS);
    localStorage.removeItem(STORAGE_KEY_BATCHES);
    window.dispatchEvent(new Event('hai_data_updated'));
  },
};

/**
 * Seed synthetic Nigerian hospital records for Demo Mode
 */
function seedSyntheticDataIfEmpty(): void {
  const existingDocs = localStorage.getItem(STORAGE_KEY_DOCS);
  if (existingDocs && JSON.parse(existingDocs).length > 0) return;

  const doc1: StoredDocument = {
    id: 'DOC-202610-001',
    filename: 'luth_opd_card_01824.jpg',
    fileSize: 2451000,
    fileType: 'image/jpeg',
    dateProcessed: '2026-10-06 09:34',
    pages: 1,
    status: 'Completed',
    ocrEngine: 'docTR (FastAPI Colab)',
    ocrConfidence: 0.94,
    processingTimeSeconds: 3.8,
    isSynthetic: true,
    rawOcrText: `LAGOS UNIVERSITY TEACHING HOSPITAL (LUTH), IDI-ARABA
OUTPATIENT CONSULTATION CARD
Hosp No: UH-00125    Date: 12 March 2024    Dept: General Outpatient (GOPD)
Patient Name: Babatunde Adeleke    Sex: Male    Age: 54 Yrs
Address: 14 Akoka Road, Yaba, Lagos

Chief Complaint: Recurrent throbbing occipital headaches, dizziness for 3 weeks
History: Known hypertensive for 4 years, irregular medication compliance. Denies chest pain.
Vitals: BP: 160/100 mmHg   Pulse: 78 bpm   Temp: 36.8 C   Resp: 18 /min   Weight: 82 kg
Clinical Observations: S1 S2 present, no murmurs. Chest clear bilaterally.
Impression/Diagnosis: Poorly Controlled Essential Hypertension, Mild Dehydration
Rx:
1. Tab Amlodipine 10mg daily x 30/7
2. Tab Lisinopril 10mg daily x 30/7
3. Low salt diet counseling
Plan: Check FBS, Fasting Lipid Profile, Creatinine. RTC 2 weeks.
Dr. O. Adelekan (Senior Registrar)`,
  };

  const doc2: StoredDocument = {
    id: 'DOC-202610-002',
    filename: 'uch_lab_investigation_6711.png',
    fileSize: 1820000,
    fileType: 'image/png',
    dateProcessed: '2026-10-07 11:15',
    pages: 1,
    status: 'Completed',
    ocrEngine: 'docTR (FastAPI Colab)',
    ocrConfidence: 0.91,
    processingTimeSeconds: 4.1,
    isSynthetic: true,
    rawOcrText: `UNIVERSITY COLLEGE HOSPITAL (UCH), IBADAN
DEPARTMENT OF CHEMICAL PATHOLOGY - LABORATORY REPORT
Hospital Number: UH-00125
Name: Babatunde Adeleke   Age: 54   Sex: Male
Requesting Clinic: GOPD Clinic   Date of Collection: 14 March 2024

INVESTIGATION:
- Fasting Blood Sugar: 6.2 mmol/L (Ref: 3.9 - 6.1 mmol/L) [Slightly elevated]
- Serum Creatinine: 98 umol/L (Ref: 60 - 110 umol/L)
- Blood Urea: 4.8 mmol/L (Ref: 2.5 - 6.5 mmol/L)
- Serum Potassium: 4.2 mmol/L (Ref: 3.5 - 5.0 mmol/L)
- Total Cholesterol: 5.8 mmol/L (Ref: < 5.2 mmol/L) [Borderline high]

Verified by: Dr. (Mrs) K. Alabi, Consultant Pathologist`,
  };

  const doc3: StoredDocument = {
    id: 'DOC-202610-003',
    filename: 'kano_maternity_antenatal_409.jpg',
    fileSize: 3104000,
    fileType: 'image/jpeg',
    dateProcessed: '2026-10-08 08:20',
    pages: 1,
    status: 'Completed',
    ocrEngine: 'docTR (FastAPI Colab)',
    ocrConfidence: 0.88,
    processingTimeSeconds: 4.5,
    isSynthetic: true,
    rawOcrText: `AMINU KANO TEACHING HOSPITAL, KANO
ANTENATAL CLINIC RECORD
Hospital No: AKTH-98442    Date: 22 Feb 2024
Name: Aisha Ibrahim    Age: 28    Parity: G2 P1+0    LMP: 14/08/2023    EDD: 21/05/2024
Gestational Age: 27 weeks
Vitals: BP: 110/70 mmHg   Weight: 68 kg   Urine Protein: Nil   Urine Sugar: Nil
Fundal Height: 28 cm   Lie: Longitudinal   Presentation: Cephalic   FHR: 144 bpm
Hb / PCV: 33%
Diagnosis: Normal Singleton Intrauterine Pregnancy at 27 Weeks
Medications:
1. Ferrous Sulphate 200mg bd
2. Folic Acid 5mg daily
3. Sulphadoxine-Pyrimethamine (Fansidar) 3 tabs stat (IPTp 2)
Next Visit: 4 weeks
Midwife In-charge: Sister H. Bello`,
  };

  const rec1: StoredHealthRecord = {
    id: 'REC-202610-001',
    documentId: 'DOC-202610-001',
    filename: doc1.filename,
    patientId: 'UH-00125',
    hospitalNumber: 'UH-00125',
    extractedAt: '2026-10-06 09:35',
    status: 'approved',
    reviewedBy: 'Chief Records Officer (A. Musa)',
    reviewedAt: '2026-10-06 09:40',
    isSynthetic: true,
    corrections: [
      {
        fieldPath: 'vital_signs.blood_pressure',
        originalValue: '160/100',
        correctedValue: '160/100 mmHg',
        reviewer: 'Chief Records Officer (A. Musa)',
        timestamp: '2026-10-06 09:38',
        reason: 'Added standard clinical unit',
      },
    ],
    extractedData: {
      patient: {
        patient_name: 'Babatunde Adeleke',
        hospital_number: 'UH-00125',
        date_of_birth: null,
        age: '54',
        sex: 'Male',
        address: '14 Akoka Road, Yaba, Lagos',
      },
      encounter: {
        encounter_date: '2024-03-12',
        encounter_type: 'Outpatient',
        department: 'General Outpatient (GOPD)',
        attending_clinician: 'Dr. O. Adelekan',
      },
      clinical_information: {
        chief_complaint: 'Recurrent throbbing occipital headaches, dizziness for 3 weeks',
        history_of_present_illness: 'Known hypertensive for 4 years with irregular medication compliance',
        symptoms: ['Headache', 'Dizziness'],
        clinical_observations: ['S1 S2 present without murmurs', 'Chest clear bilaterally'],
        diagnoses: ['Poorly Controlled Essential Hypertension', 'Mild Dehydration'],
      },
      vital_signs: {
        blood_pressure: '160/100',
        heart_rate: '78 bpm',
        respiratory_rate: '18 /min',
        temperature: '36.8 C',
        oxygen_saturation: null,
        weight: '82 kg',
        height: null,
      },
      laboratory: [],
      medications: [
        { medication_name: 'Amlodipine', dose: '10mg', route: 'Oral', frequency: 'Daily', duration: '30 days' },
        { medication_name: 'Lisinopril', dose: '10mg', route: 'Oral', frequency: 'Daily', duration: '30 days' },
      ],
      doctor_notes: { clinical_notes: 'Low salt diet counseling given. Check FBS, Fasting Lipid Profile, Creatinine. RTC 2 weeks.' },
      document_metadata: {
        document_type: 'Outpatient Record',
        document_date: '2024-03-12',
        source_document_id: 'DOC-202610-001',
        source_page: 1,
      },
      confidence_review: {
        extraction_confidence: 0.96,
        requires_review: false,
        uncertainties: [],
      },
    },
    reviewedData: {
      patient: {
        patient_name: 'Babatunde Adeleke',
        hospital_number: 'UH-00125',
        date_of_birth: null,
        age: '54',
        sex: 'Male',
        address: '14 Akoka Road, Yaba, Lagos',
      },
      encounter: {
        encounter_date: '2024-03-12',
        encounter_type: 'Outpatient',
        department: 'General Outpatient (GOPD)',
        attending_clinician: 'Dr. O. Adelekan',
      },
      clinical_information: {
        chief_complaint: 'Recurrent throbbing occipital headaches, dizziness for 3 weeks',
        history_of_present_illness: 'Known hypertensive for 4 years with irregular medication compliance',
        symptoms: ['Headache', 'Dizziness'],
        clinical_observations: ['S1 S2 present without murmurs', 'Chest clear bilaterally'],
        diagnoses: ['Poorly Controlled Essential Hypertension', 'Mild Dehydration'],
      },
      vital_signs: {
        blood_pressure: '160/100 mmHg',
        heart_rate: '78 bpm',
        respiratory_rate: '18 /min',
        temperature: '36.8 C',
        oxygen_saturation: null,
        weight: '82 kg',
        height: null,
      },
      laboratory: [],
      medications: [
        { medication_name: 'Amlodipine', dose: '10mg', route: 'Oral', frequency: 'Daily', duration: '30 days' },
        { medication_name: 'Lisinopril', dose: '10mg', route: 'Oral', frequency: 'Daily', duration: '30 days' },
      ],
      doctor_notes: { clinical_notes: 'Low salt diet counseling given. Check FBS, Fasting Lipid Profile, Creatinine. RTC 2 weeks.' },
      document_metadata: {
        document_type: 'Outpatient Record',
        document_date: '2024-03-12',
        source_document_id: 'DOC-202610-001',
        source_page: 1,
      },
      confidence_review: {
        extraction_confidence: 0.96,
        requires_review: false,
        uncertainties: [],
      },
    },
  };

  const rec2: StoredHealthRecord = {
    id: 'REC-202610-002',
    documentId: 'DOC-202610-002',
    filename: doc2.filename,
    patientId: 'UH-00125',
    hospitalNumber: 'UH-00125',
    extractedAt: '2026-10-07 11:18',
    status: 'approved',
    reviewedBy: 'Chief Records Officer (A. Musa)',
    reviewedAt: '2026-10-07 11:22',
    isSynthetic: true,
    corrections: [],
    extractedData: {
      patient: {
        patient_name: 'Babatunde Adeleke',
        hospital_number: 'UH-00125',
        date_of_birth: null,
        age: '54',
        sex: 'Male',
        address: null,
      },
      encounter: {
        encounter_date: '2024-03-14',
        encounter_type: 'Laboratory',
        department: 'Chemical Pathology',
        attending_clinician: 'Dr. (Mrs) K. Alabi',
      },
      clinical_information: {
        chief_complaint: null,
        history_of_present_illness: null,
        symptoms: null,
        clinical_observations: null,
        diagnoses: null,
      },
      vital_signs: {
        blood_pressure: null,
        heart_rate: null,
        respiratory_rate: null,
        temperature: null,
        oxygen_saturation: null,
        weight: null,
        height: null,
      },
      laboratory: [
        { test_name: 'Fasting Blood Sugar (FBS)', result: '6.2', unit: 'mmol/L', reference_range: '3.9 - 6.1', test_date: '2024-03-14' },
        { test_name: 'Serum Creatinine', result: '98', unit: 'umol/L', reference_range: '60 - 110', test_date: '2024-03-14' },
        { test_name: 'Blood Urea', result: '4.8', unit: 'mmol/L', reference_range: '2.5 - 6.5', test_date: '2024-03-14' },
        { test_name: 'Serum Potassium', result: '4.2', unit: 'mmol/L', reference_range: '3.5 - 5.0', test_date: '2024-03-14' },
        { test_name: 'Total Cholesterol', result: '5.8', unit: 'mmol/L', reference_range: '< 5.2', test_date: '2024-03-14' },
      ],
      medications: [],
      doctor_notes: { clinical_notes: null },
      document_metadata: {
        document_type: 'Laboratory Report',
        document_date: '2024-03-14',
        source_document_id: 'DOC-202610-002',
        source_page: 1,
      },
      confidence_review: {
        extraction_confidence: 0.93,
        requires_review: false,
        uncertainties: [],
      },
    },
    reviewedData: {
      patient: {
        patient_name: 'Babatunde Adeleke',
        hospital_number: 'UH-00125',
        date_of_birth: null,
        age: '54',
        sex: 'Male',
        address: null,
      },
      encounter: {
        encounter_date: '2024-03-14',
        encounter_type: 'Laboratory',
        department: 'Chemical Pathology',
        attending_clinician: 'Dr. (Mrs) K. Alabi',
      },
      clinical_information: {
        chief_complaint: null,
        history_of_present_illness: null,
        symptoms: null,
        clinical_observations: null,
        diagnoses: null,
      },
      vital_signs: {
        blood_pressure: null,
        heart_rate: null,
        respiratory_rate: null,
        temperature: null,
        oxygen_saturation: null,
        weight: null,
        height: null,
      },
      laboratory: [
        { test_name: 'Fasting Blood Sugar (FBS)', result: '6.2', unit: 'mmol/L', reference_range: '3.9 - 6.1', test_date: '2024-03-14' },
        { test_name: 'Serum Creatinine', result: '98', unit: 'umol/L', reference_range: '60 - 110', test_date: '2024-03-14' },
        { test_name: 'Blood Urea', result: '4.8', unit: 'mmol/L', reference_range: '2.5 - 6.5', test_date: '2024-03-14' },
        { test_name: 'Serum Potassium', result: '4.2', unit: 'mmol/L', reference_range: '3.5 - 5.0', test_date: '2024-03-14' },
        { test_name: 'Total Cholesterol', result: '5.8', unit: 'mmol/L', reference_range: '< 5.2', test_date: '2024-03-14' },
      ],
      medications: [],
      doctor_notes: { clinical_notes: null },
      document_metadata: {
        document_type: 'Laboratory Report',
        document_date: '2024-03-14',
        source_document_id: 'DOC-202610-002',
        source_page: 1,
      },
      confidence_review: {
        extraction_confidence: 0.93,
        requires_review: false,
        uncertainties: [],
      },
    },
  };

  const batch1: StoredBatch = {
    id: 'BATCH-202610-001',
    createdAt: '2026-10-06 09:30',
    status: 'Completed',
    total: 3,
    completed: 3,
    processing: 0,
    failed: 0,
    documentIds: [doc1.id, doc2.id, doc3.id],
  };

  localStorage.setItem(STORAGE_KEY_DOCS, JSON.stringify([doc1, doc2, doc3]));
  localStorage.setItem(STORAGE_KEY_RECORDS, JSON.stringify([rec1, rec2]));
  localStorage.setItem(STORAGE_KEY_BATCHES, JSON.stringify([batch1]));
}
