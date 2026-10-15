/**
 * Advanced Clinical Data Management & Pandas DataFrame Engine (Steps 1, 2, 3, 4)
 * Health Archive Intelligence
 * 
 * Specifically designed for hospital paper forms and records:
 * 1. Outpatient Consultation (GOPD Cards)
 * 2. Laboratory Investigation & Pathology Reports (Chemical Pathology, Haematology, Microbiology)
 * 3. Pharmacy Prescriptions & Drug Dispensing Records
 * 4. Inpatient Ward Progress & Observation Charts
 * 5. Antenatal Care (ANC) & Maternity Cards
 * 
 * Pipeline:
 * STEP 1 - JSON Cleaning & Noise Filtering (Strip conf < 0.40, fillers, OCR shadow duplicates, watermarks)
 * STEP 2 - Strict Whitelist Enforcement (Categorized hospital clinical entities)
 * STEP 3 - Pandas DataFrame Conversion (Pattern-based extraction, title-casing, deduplication, empty pruning)
 * STEP 4 - Multi-Sheet Hospital Excel Workbook & CSV Export
 */

import * as XLSX from 'xlsx';
import {
  HospitalFormType,
  detectHospitalFormType,
  extractHospitalName,
  HOSPITAL_FORM_DEFINITIONS,
} from './hospitalFormsSchema';
import { storageService, StoredPatient } from './storageService';

export const IMPORTANT_COLUMNS = [
  'File_Name',
  'Form_Type',
  'Hospital_Name',
  'Patient_Name',
  'Age',
  'Gender',
  'Hospital_Number',
  'Card_Number',
  'Date_of_Visit',
  'Blood_Pressure',
  'Temperature',
  'Pulse_Rate',
  'Respiratory_Rate',
  'Weight',
  'Complaint',
  'Diagnosis',
  'Secondary_Diagnosis',
  'Specimen_Type',
  'Lab_Test_Name',
  'Lab_Result',
  'Result_Value',
  'Unit',
  'Reference_Range',
  'Lab_Flag',
  'Drug_Name',
  'Dosage',
  'Route',
  'Frequency',
  'Duration',
  'Prescription',
  'Ward_Bed_Number',
  'Gravida_Parity',
  'Gestational_Age',
  'Clinical_Notes',
  'Doctor_Name',
  'Department',
  'Confidence_Score',
] as const;

export type ImportantColumnKey = typeof IMPORTANT_COLUMNS[number];

export interface CleanDataFrameRow {
  File_Name: string;
  Form_Type: string;
  Hospital_Name: string;
  Patient_Name: string;
  Age: string;
  Gender: string;
  Hospital_Number: string;
  Card_Number: string;
  Date_of_Visit: string;
  Blood_Pressure: string;
  Temperature: string;
  Pulse_Rate: string;
  Respiratory_Rate: string;
  Weight: string;
  Complaint: string;
  Diagnosis: string;
  Secondary_Diagnosis: string;
  Specimen_Type: string;
  Lab_Test_Name: string;
  Lab_Result: string;
  Result_Value: string;
  Unit: string;
  Reference_Range: string;
  Lab_Flag: string;
  Drug_Name: string;
  Dosage: string;
  Route: string;
  Frequency: string;
  Duration: string;
  Prescription: string;
  Ward_Bed_Number: string;
  Gravida_Parity: string;
  Gestational_Age: string;
  Clinical_Notes: string;
  Doctor_Name: string;
  Department: string;
  Confidence_Score: string;
  [key: string]: string; // For dynamic indexing
}

export interface DataFrameTelemetry {
  filesProcessed: number;
  noisyTokensRemoved: number;
  importantColumnsKept: number;
  cleanRowsProduced: number;
  activeColumns: string[];
  detectedFormTypes: Record<string, number>;
}

export interface DataFrameResult {
  rows: CleanDataFrameRow[];
  activeColumns: string[];
  telemetry: DataFrameTelemetry;
  rawJsonCleaned: boolean;
}

/**
 * Step 1: Clean and Filter raw OCR JSON / Text
 * Removes:
 * - Tokens with confidence < 0.40 (noise)
 * - Fillers: "____", "....", "xxx", "---"
 * - OCR shadow duplicate words
 * - Irrelevant page/brand headers ("Page 1", "Rite Foods")
 */
export function cleanRawOcrText(
  rawText: string,
  ocrBlocks?: any[]
): { cleanedText: string; tokensRemoved: number } {
  let tokensRemoved = 0;
  if (!rawText) return { cleanedText: '', tokensRemoved: 0 };

  const lines = rawText.split('\n');
  const cleanedLines: string[] = [];

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    // Filter out common non-medical watermarks and headers
    if (
      /^(page\s*\d+(\s*of\s*\d+)?|rite foods|confidential scan|document scan\s*\d+|photocopy center|scan center)$/i.test(
        trimmed
      )
    ) {
      tokensRemoved += trimmed.split(/\s+/).length;
      continue;
    }

    // Filter out filler lines with dashes, underscores, dots, or 'xxx'
    if (/^[_\.\-xX\s]{3,}$/.test(trimmed)) {
      tokensRemoved += 1;
      continue;
    }

    // Token-level cleaning
    const words = trimmed.split(/\s+/);
    const cleanedWords: string[] = [];

    for (let i = 0; i < words.length; i++) {
      const word = words[i].trim();

      // Filter filler symbols
      if (/^[_\.\-xX]+$/.test(word) || word === '___' || word === '...' || word.toLowerCase() === 'xxx') {
        tokensRemoved++;
        continue;
      }

      // Filter duplicate adjacent words (OCR shadow artifact)
      if (cleanedWords.length > 0 && cleanedWords[cleanedWords.length - 1].toLowerCase() === word.toLowerCase()) {
        tokensRemoved++;
        continue;
      }

      cleanedWords.push(word);
    }

    if (cleanedWords.length > 0) {
      cleanedLines.push(cleanedWords.join(' '));
    }
  }

  return {
    cleanedText: cleanedLines.join('\n'),
    tokensRemoved,
  };
}

/**
 * Helper to determine if a numeric lab result is high, low, or normal based on reference range
 */
export function determineLabFlag(valStr: string, refStr: string): string {
  const val = parseFloat(valStr);
  if (isNaN(val) || !refStr) return '';

  const rangeMatch = refStr.match(/([0-9.]+)\s*[-–—]\s*([0-9.]+)/);
  if (rangeMatch) {
    const low = parseFloat(rangeMatch[1]);
    const high = parseFloat(rangeMatch[2]);
    if (!isNaN(low) && val < low) return 'Low';
    if (!isNaN(high) && val > high) return 'High';
    return 'Normal';
  }

  const lessMatch = refStr.match(/<\s*([0-9.]+)/);
  if (lessMatch) {
    const threshold = parseFloat(lessMatch[1]);
    if (!isNaN(threshold)) return val > threshold ? 'High' : 'Normal';
  }

  return 'Normal';
}

/**
 * Step 2 & 3: Transform OCR item list into a cleaned Pandas-equivalent DataFrame
 * Specifically designed for hospital form types:
 * - Outpatient Consultation Cards (GOPD)
 * - Laboratory Investigation Sheets (with multi-row test expansion)
 * - Pharmacy Prescriptions (with drug, dose, route, freq)
 * - Inpatient & Vitals Charts
 * - Antenatal & Maternity Cards
 */
export function jsonListToCleanDataFrame(
  jsonList: Array<{
    file?: string;
    filename?: string;
    raw_text?: string;
    text?: string;
    confidence?: number;
    pages?: any;
  }>,
  selectedFormFilter: HospitalFormType = 'all_master'
): DataFrameResult {
  const cleanRows: CleanDataFrameRow[] = [];
  let totalTokensRemoved = 0;
  const formCounts: Record<string, number> = {};

  // Form-aware regex patterns for hospital records
  const patterns: Record<string, RegExp> = {
    Patient_Name: /(?:Name|Patient Name|Pt Name|Name of Patient)\s*[:\-]\s*([A-Za-z ]{3,})/i,
    Age: /\bAge\s*[:\-]?\s*(\d{1,3})(?:\s*(?:yrs|years|y\/o))?/i,
    Gender: /(?:Sex|Gender)\s*[:\-]\s*(Male|Female|M|F)\b/i,
    Hospital_Number: /(?:Hospital No|Hosp No|Card No|Hosp\.?\s*No|MRN|Folder No)\s*[:\-]?\s*([A-Z0-9\-/]+)/i,
    Card_Number: /(?:Card No|Registration No|Reg No)\s*[:\-]?\s*([A-Z0-9\-/]+)/i,
    Date_of_Visit: /(?:Date|Visit Date|Date of Visit|Date Seen)\s*[:\-]?\s*([\d]{1,2}[\/\-][\d]{1,2}[\/\-][\d]{2,4})/i,
    Blood_Pressure: /(?:B\.?P\.?|Blood Pressure)\s*[:\-]?\s*(\d{2,3}\s*\/\s*\d{2,3}(?:\s*mmHg)?)/i,
    Temperature: /(?:Temp|Temperature|T)\s*[:\-]?\s*(\d{2}(?:\.\d)?\s*°?[cC]?)/i,
    Pulse_Rate: /(?:Pulse|P\.?R\.?|Heart Rate|HR)\s*[:\-]?\s*(\d{2,3}(?:\s*bpm|\/min)?)/i,
    Respiratory_Rate: /(?:Resp|R\.?R\.?|Respiratory Rate)\s*[:\-]?\s*(\d{2}(?:\s*cpm|\/min)?)/i,
    Weight: /(?:Wt|Weight)\s*[:\-]?\s*(\d{2,3}(?:\.\d)?\s*kg)/i,
    Complaint: /(?:Chief Complaint|Complaint|C\/O|Presented with)\s*[:\-]?\s*([A-Za-z0-9,\s]+?)(?=\n|History|HPI|Vitals|O\/E|$)/i,
    Diagnosis: /(?:Diagnosis|Impression|Dx|Assessment|Provisional Diagnosis)\s*[:\-]?\s*([A-Za-z0-9,\s\-]+?)(?=\n|Rx|Plan|Vitals|Medication|Secondary|$)/i,
    Secondary_Diagnosis: /(?:Secondary Dx|Other Diagnoses|Co-morbidity)\s*[:\-]?\s*([A-Za-z0-9,\s]+?)(?=\n|Rx|Plan|$)/i,
    Specimen_Type: /(?:Specimen|Sample)\s*[:\-]?\s*(Blood|Serum|Plasma|Urine|Stool|Sputum|CSF|Swab)/i,
    Lab_Test_Name: /(?:Test|Investigation|Lab Test)\s*[:\-]?\s*([A-Za-z0-9\s()]+?)(?=\s*Result|\s*[:\-]|Ref|\n|$)/i,
    Lab_Result: /(?:Result|Lab Result)\s*[:\-]?\s*([A-Za-z0-9.\s]+?)(?=\s*Unit|\s*Ref|\n|$)/i,
    Result_Value: /\b(?:Result|Value)\s*[:\-]?\s*([0-9.]+(?:\s*[A-Za-z/%]+)?)/i,
    Unit: /\b(mmol\/L|mg\/dL|umol\/L|g\/dL|%|IU\/L|mmHg|bpm|kg|cm|cells\/mm3|x10\^9\/L)\b/i,
    Reference_Range: /(?:Ref|Ref Range|Reference|Normal)\s*[:\-]?\s*([A-Za-z0-9.\-\s<>=]+?)(?=\n|$)/i,
    Prescription: /(?:Rx|Prescription|Plan|Medication)\s*[:\-]?\s*([A-Za-z0-9\s.,;+]+?)(?=\n\n|Doctor|Dr|Signed|$)/i,
    Drug_Name: /\b(Amlodipine|Lisinopril|Paracetamol|Metformin|Artemether|Lumefantrine|Amoxicillin|Ciprofloxacin|Omeprazole|Folic Acid|Ferrous Sulphate|Ceftriaxone|Hydrochlorothiazide|Insulin|Glibenclamide|Diclofenac|Ibuprofen)\b/i,
    Dosage: /\b(\d+\s*(?:mg|g|ml|tabs?|caps?|iu))\b/i,
    Route: /\b(Oral|IV|IM|SC|Topical|Sublingual|Inhalation)\b/i,
    Frequency: /\b(OD|BD|TDS|QDS|PRN|STAT|Daily|Nocte|Weekly)\b/i,
    Duration: /\b(\d+\s*(?:days?|weeks?|months?|d|wks?))\b/i,
    Ward_Bed_Number: /(?:Ward|Bed No|Bed)\s*[:\-]?\s*([A-Za-z0-9\s\-/]+?)(?=\n|Date|$)/i,
    Gravida_Parity: /(?:Parity|Gravida|G\/P)\s*[:\-]?\s*([Gg]\d+\s*[Pp]\d+(?:\+\d+)?)/i,
    Gestational_Age: /(?:Gestation|GA|EGA)\s*[:\-]?\s*(\d{1,2}\s*(?:wks?|weeks?))/i,
    Clinical_Notes: /(?:Clinical Notes|Notes|Progress Notes|O\/E)\s*[:\-]?\s*([A-Za-z0-9,\s\-.;]+?)(?=\n\n|Plan|Doctor|$)/i,
    Doctor_Name: /(?:Dr\.?|Doctor|Clinician|Physician|Attending|Consultant)\s*([A-Za-z.\s]+?)(?=\n|\(|$)/i,
    Department: /(?:Dept|Department|Clinic|Ward|Unit)\s*[:\-]?\s*([A-Za-z\s]+?)(?=\n|Date|$)/i,
  };

  for (const item of jsonList) {
    const rawText = item.raw_text || item.text || '';
    const fileName = item.file || item.filename || 'hospital_record_001.jpg';
    const confidence = item.confidence ?? 0.92;

    // Step 1: Clean noise from raw text
    const { cleanedText, tokensRemoved } = cleanRawOcrText(rawText);
    totalTokensRemoved += tokensRemoved;

    // Auto-detect specific hospital form type
    const formType = detectHospitalFormType(cleanedText, fileName);
    const formDef = HOSPITAL_FORM_DEFINITIONS[formType];
    const hospitalName = extractHospitalName(cleanedText);

    formCounts[formDef.label] = (formCounts[formDef.label] || 0) + 1;

    // Build base row for this hospital record
    const baseRow: CleanDataFrameRow = {
      File_Name: fileName,
      Form_Type: formDef.label,
      Hospital_Name: hospitalName,
      Patient_Name: '',
      Age: '',
      Gender: '',
      Hospital_Number: '',
      Card_Number: '',
      Date_of_Visit: '',
      Blood_Pressure: '',
      Temperature: '',
      Pulse_Rate: '',
      Respiratory_Rate: '',
      Weight: '',
      Complaint: '',
      Diagnosis: '',
      Secondary_Diagnosis: '',
      Specimen_Type: '',
      Lab_Test_Name: '',
      Lab_Result: '',
      Result_Value: '',
      Unit: '',
      Reference_Range: '',
      Lab_Flag: '',
      Drug_Name: '',
      Dosage: '',
      Route: '',
      Frequency: '',
      Duration: '',
      Prescription: '',
      Ward_Bed_Number: '',
      Gravida_Parity: '',
      Gestational_Age: '',
      Clinical_Notes: '',
      Doctor_Name: '',
      Department: '',
      Confidence_Score: `${Math.round(confidence * 100)}%`,
    };

    // Apply regex patterns
    Object.keys(patterns).forEach((key) => {
      const match = cleanedText.match(patterns[key]);
      if (match && match[1]) {
        baseRow[key] = match[1].trim().replace(/\s+/g, ' ');
      }
    });

    // Clean & Title Case Patient Name
    if (baseRow.Patient_Name) {
      baseRow.Patient_Name = baseRow.Patient_Name
        .toLowerCase()
        .replace(/\b\w/g, (c) => c.toUpperCase());
    }

    // Gender standardization
    if (baseRow.Gender) {
      const g = baseRow.Gender.toLowerCase();
      baseRow.Gender = g.startsWith('m') ? 'Male' : g.startsWith('f') ? 'Female' : baseRow.Gender;
    }

    // Specialized Multi-Row Expansion for Laboratory Forms
    const isLabForm = formType === 'laboratory_report' || /investigation|pathology|glucose|creatinine|cholesterol|pcv|wbc/i.test(cleanedText);
    const lines = cleanedText.split('\n');

    const labTestLines = lines.filter((l) =>
      /(?:fasting|blood sugar|glucose|serum creatinine|creatinine|urea|potassium|sodium|chloride|cholesterol|pcv|packed cell volume|haemoglobin|hb|wbc|white blood cells|platelets|bilirubin|alt|ast|alp|malaria parasite|urinalysis)/i.test(
        l
      ) && /\d/.test(l)
    );

    if (isLabForm && labTestLines.length > 1) {
      labTestLines.forEach((labLine) => {
        const testMatch = labLine.match(
          /([A-Za-z\s()]+)\s*[:\-]?\s*([0-9.]+)\s*([A-Za-z/%]*)\s*(?:\(?(?:Ref|Ref Range|Reference)?[:\-]?\s*([0-9.\-\s<>=]+)\)?)?/i
        );
        const expandedRow: CleanDataFrameRow = { ...baseRow };
        if (testMatch) {
          expandedRow.Lab_Test_Name = testMatch[1].trim();
          expandedRow.Result_Value = testMatch[2].trim();
          expandedRow.Unit = testMatch[3] ? testMatch[3].trim() : expandedRow.Unit;
          expandedRow.Lab_Result = `${expandedRow.Result_Value} ${expandedRow.Unit}`.trim();
          if (testMatch[4]) {
            expandedRow.Reference_Range = testMatch[4].trim();
            expandedRow.Lab_Flag = determineLabFlag(expandedRow.Result_Value, expandedRow.Reference_Range);
          }
        }
        cleanRows.push(expandedRow);
      });
    } else {
      // If lab test with reference range in single row, compute lab flag
      if (baseRow.Result_Value && baseRow.Reference_Range) {
        baseRow.Lab_Flag = determineLabFlag(baseRow.Result_Value, baseRow.Reference_Range);
      }
      cleanRows.push(baseRow);
    }
  }

  // Pandas Step: df.drop_duplicates()
  const uniqueRows: CleanDataFrameRow[] = [];
  const seenSignatures = new Set<string>();

  for (const row of cleanRows) {
    const signature = `${row.Patient_Name}|${row.Hospital_Number}|${row.Date_of_Visit}|${row.Lab_Test_Name}|${row.Drug_Name}|${row.Diagnosis}`.toLowerCase();
    if (!seenSignatures.has(signature)) {
      seenSignatures.add(signature);
      uniqueRows.push(row);
    }
  }

  // Pandas Step: df.dropna(how='all')
  const nonBlankRows = uniqueRows.filter((r) => {
    return (
      r.Patient_Name !== '' ||
      r.Hospital_Number !== '' ||
      r.Diagnosis !== '' ||
      r.Lab_Test_Name !== '' ||
      r.Drug_Name !== '' ||
      r.Complaint !== ''
    );
  });

  // Filter by selected form type if user requested a specific hospital form schema
  let filteredRows = nonBlankRows;
  if (selectedFormFilter !== 'all_master') {
    const targetDef = HOSPITAL_FORM_DEFINITIONS[selectedFormFilter];
    filteredRows = nonBlankRows.filter((r) => r.Form_Type === targetDef.label);
  }

  // Pandas Step: df.loc[:, (df != "").any(axis=0)]
  // Keep only columns that have at least 1 non-empty value across the rows
  const activeColumns: string[] = [];
  const candidateColumns =
    selectedFormFilter !== 'all_master'
      ? HOSPITAL_FORM_DEFINITIONS[selectedFormFilter].targetColumns
      : [...IMPORTANT_COLUMNS];

  candidateColumns.forEach((col) => {
    const hasData = filteredRows.some((r) => r[col] && r[col].trim() !== '');
    // Always keep File_Name, Patient_Name, Hospital_Number, and Form_Type for context
    if (hasData || ['File_Name', 'Form_Type', 'Hospital_Name', 'Patient_Name', 'Hospital_Number'].includes(col)) {
      activeColumns.push(col);
    }
  });

  const telemetry: DataFrameTelemetry = {
    filesProcessed: jsonList.length,
    noisyTokensRemoved: totalTokensRemoved,
    importantColumnsKept: activeColumns.length,
    cleanRowsProduced: filteredRows.length,
    activeColumns,
    detectedFormTypes: formCounts,
  };

  return {
    rows: filteredRows,
    activeColumns,
    telemetry,
    rawJsonCleaned: true,
  };
}

/**
 * Step 4: Export to Multi-Sheet Hospital Excel Workbook
 * Sheets:
 * - 1. Master_Health_Dataset (All hospital rows)
 * - 2. Laboratory_Investigations (All pathology & lab results with flags)
 * - 3. Pharmacy_Prescriptions (All prescribed medications)
 * - 4. Clinical_Encounters (Outpatient & inpatient consultations)
 */
export function exportHospitalWorkbook(
  rows: CleanDataFrameRow[],
  filename: string = 'hospital_clinical_dataset.xlsx'
) {
  downloadHospitalMultiSheetExcel(rows, IMPORTANT_COLUMNS as any, filename.replace(/\.xlsx$/, ''));
}

export function downloadHospitalMultiSheetExcel(
  rows: CleanDataFrameRow[],
  activeColumns: string[],
  datasetName: string = 'Hospital_Archive_Dataset'
) {
  const wb = XLSX.utils.book_new();

  // 1. Master Sheet
  const masterData = rows.map((r) => {
    const obj: Record<string, string> = {};
    activeColumns.forEach((col) => {
      obj[col] = r[col] || '';
    });
    return obj;
  });
  const masterSheet = XLSX.utils.json_to_sheet(masterData);
  XLSX.utils.book_append_sheet(wb, masterSheet, 'Master_Health_Dataset');

  // 2. Laboratory Panel Sheet
  const labRows = rows
    .filter((r) => r.Lab_Test_Name || r.Lab_Result || r.Result_Value)
    .map((r) => ({
      Hospital_Name: r.Hospital_Name,
      Patient_Name: r.Patient_Name,
      Hospital_Number: r.Hospital_Number,
      Date_of_Visit: r.Date_of_Visit,
      Specimen_Type: r.Specimen_Type,
      Lab_Test_Name: r.Lab_Test_Name,
      Result_Value: r.Result_Value,
      Unit: r.Unit,
      Reference_Range: r.Reference_Range,
      Lab_Flag: r.Lab_Flag,
      Diagnosis: r.Diagnosis,
      Doctor_Name: r.Doctor_Name,
    }));
  if (labRows.length > 0) {
    const labSheet = XLSX.utils.json_to_sheet(labRows);
    XLSX.utils.book_append_sheet(wb, labSheet, 'Laboratory_Panel');
  }

  // 3. Pharmacy & Prescriptions Sheet
  const rxRows = rows
    .filter((r) => r.Drug_Name || r.Prescription)
    .map((r) => ({
      Hospital_Name: r.Hospital_Name,
      Patient_Name: r.Patient_Name,
      Hospital_Number: r.Hospital_Number,
      Date_of_Visit: r.Date_of_Visit,
      Diagnosis: r.Diagnosis,
      Drug_Name: r.Drug_Name,
      Dosage: r.Dosage,
      Route: r.Route,
      Frequency: r.Frequency,
      Duration: r.Duration,
      Prescription: r.Prescription,
      Doctor_Name: r.Doctor_Name,
    }));
  if (rxRows.length > 0) {
    const rxSheet = XLSX.utils.json_to_sheet(rxRows);
    XLSX.utils.book_append_sheet(wb, rxSheet, 'Pharmacy_Prescriptions');
  }

  // 4. Clinical Encounters & Vitals Sheet
  const encounterRows = rows.map((r) => ({
    Hospital_Name: r.Hospital_Name,
    Form_Type: r.Form_Type,
    Patient_Name: r.Patient_Name,
    Age: r.Age,
    Gender: r.Gender,
    Hospital_Number: r.Hospital_Number,
    Date_of_Visit: r.Date_of_Visit,
    Blood_Pressure: r.Blood_Pressure,
    Temperature: r.Temperature,
    Pulse_Rate: r.Pulse_Rate,
    Respiratory_Rate: r.Respiratory_Rate,
    Weight: r.Weight,
    Complaint: r.Complaint,
    Diagnosis: r.Diagnosis,
    Doctor_Name: r.Doctor_Name,
    Department: r.Department,
  }));
  const encounterSheet = XLSX.utils.json_to_sheet(encounterRows);
  XLSX.utils.book_append_sheet(wb, encounterSheet, 'Clinical_Encounters');

  // Trigger download
  const dateStr = new Date().toISOString().slice(0, 10);
  XLSX.writeFile(wb, `${datasetName}_${dateStr}.xlsx`);
}

/**
 * Step 4: Export to CSV
 */
export function downloadDataFrameCsv(
  rows: CleanDataFrameRow[],
  activeColumns: string[],
  filename: string = 'hospital_clinical_dataset.csv'
) {
  const header = activeColumns.join(',');
  const lines = rows.map((row) => {
    return activeColumns
      .map((col) => {
        const val = row[col] || '';
        return `"${val.replace(/"/g, '""')}"`;
      })
      .join(',');
  });

  const csvContent = [header, ...lines].join('\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/**
 * Service Layer: Hospital Number Cross-Referencing & Duplicate Prevention Engine
 * 
 * Automatically cross-references extracted 'Hospital_Number' with existing patient
 * entries in the database to prevent duplicate record creation.
 */

export interface PatientMatchEvaluation {
  status: 'EXACT_MATCH' | 'NORMALIZED_MATCH' | 'DEMOGRAPHIC_CONFLICT' | 'NEW_PATIENT' | 'UNSPECIFIED_MRN';
  matchedHospitalNumber: string;
  matchedPatientName?: string;
  existingPatient?: StoredPatient;
  confidence: number; // 0.0 - 1.0
  isDuplicatePrevented: boolean;
  notes: string;
  suggestedAction: 'ATTACH_TO_EXISTING' | 'CREATE_NEW' | 'FLAG_FOR_AUDIT';
}

/**
 * Normalizes hospital numbers for robust cross-referencing across Nigerian hospital archives:
 * Strips whitespace, delimiters, prefixes (HOSP, NO, MRN, LUTH-, UCH/), and zero-padding.
 * Examples:
 * - "UH-00125" -> "UH125"
 * - "LUTH/2024/0049" -> "LUTH202449"
 * - "MRN: 98421" -> "98421"
 */
export function normalizeHospitalNumber(raw: string): string {
  if (!raw) return '';
  const cleaned = raw
    .trim()
    .toUpperCase()
    .replace(/^HOSP(ITAL)?\s*(NO|NUM|NUMBER)?[.:#\s-]*/i, '')
    .replace(/^MRN[.:#\s-]*/i, '')
    .replace(/^CARD\s*(NO|NUMBER)?[.:#\s-]*/i, '')
    .replace(/[^A-Z0-9]/g, '');

  // Strip leading zeroes in numerical suffix if present
  return cleaned.replace(/([A-Z]+)0+(\d+)/g, '$1$2').replace(/^0+(\d+)/g, '$1');
}

/**
 * Compares two patient names using token-overlap and fuzzy initials
 */
function comparePatientNames(nameA: string, nameB: string): { matches: boolean; confidence: number } {
  if (!nameA || !nameB) return { matches: false, confidence: 0 };
  const cleanA = nameA.toLowerCase().replace(/[^a-z\s]/g, '').trim().split(/\s+/).filter(Boolean);
  const cleanB = nameB.toLowerCase().replace(/[^a-z\s]/g, '').trim().split(/\s+/).filter(Boolean);

  if (cleanA.length === 0 || cleanB.length === 0) return { matches: false, confidence: 0 };

  const exactOverlap = cleanA.filter((token) => cleanB.includes(token));
  if (exactOverlap.length >= 2 || (cleanA.length === 1 && exactOverlap.length === 1 && cleanB.length === 1)) {
    return { matches: true, confidence: 0.95 };
  }

  if (exactOverlap.length === 1 && (cleanA.length > 1 || cleanB.length > 1)) {
    return { matches: true, confidence: 0.75 };
  }

  return { matches: false, confidence: 0.1 };
}

/**
 * Service Layer: Automatically cross-references extracted 'Hospital_Number' with existing
 * patient entries to prevent duplicate record creation in the database.
 */
export function crossReferenceHospitalNumber(
  extractedHospitalNumber: string,
  extractedPatientName?: string,
  existingPatientsList?: StoredPatient[]
): PatientMatchEvaluation {
  const patients = existingPatientsList || (typeof window !== 'undefined' ? storageService.getPatients() : []);
  const rawHospNum = (extractedHospitalNumber || '').trim();

  if (!rawHospNum || rawHospNum === '—' || rawHospNum === 'UNKNOWN') {
    return {
      status: 'UNSPECIFIED_MRN',
      matchedHospitalNumber: '',
      confidence: 0,
      isDuplicatePrevented: false,
      notes: 'No Hospital Number extracted on record; manual clinician verification required.',
      suggestedAction: 'FLAG_FOR_AUDIT',
    };
  }

  const normalizedExtracted = normalizeHospitalNumber(rawHospNum);

  // 1. Direct exact string match on hospitalNumber
  const directMatch = patients.find(
    (p) => (p.hospitalNumber || '').trim().toLowerCase() === rawHospNum.toLowerCase()
  );

  // 2. Normalized alphanumeric match
  const normalizedMatch = directMatch || patients.find(
    (p) => normalizeHospitalNumber(p.hospitalNumber) === normalizedExtracted
  );

  if (normalizedMatch) {
    // Check for demographic alignment or conflict
    const nameCheck = comparePatientNames(extractedPatientName || '', normalizedMatch.name || '');

    if (extractedPatientName && normalizedMatch.name && !nameCheck.matches && nameCheck.confidence < 0.3) {
      // Demographic discrepancy: same hospital number but substantially different name!
      return {
        status: 'DEMOGRAPHIC_CONFLICT',
        matchedHospitalNumber: normalizedMatch.hospitalNumber,
        matchedPatientName: normalizedMatch.name,
        existingPatient: normalizedMatch,
        confidence: 0.45,
        isDuplicatePrevented: true,
        notes: `MRN Collision: Extracted '${extractedPatientName}' conflicts with existing registered patient '${normalizedMatch.name}' (${normalizedMatch.hospitalNumber}).`,
        suggestedAction: 'FLAG_FOR_AUDIT',
      };
    }

    return {
      status: directMatch ? 'EXACT_MATCH' : 'NORMALIZED_MATCH',
      matchedHospitalNumber: normalizedMatch.hospitalNumber,
      matchedPatientName: normalizedMatch.name,
      existingPatient: normalizedMatch,
      confidence: directMatch ? 0.99 : 0.92,
      isDuplicatePrevented: true,
      notes: `Linked to existing patient file: ${normalizedMatch.name} (${normalizedMatch.hospitalNumber}) with ${normalizedMatch.recordIds?.length || 1} previous encounter(s).`,
      suggestedAction: 'ATTACH_TO_EXISTING',
    };
  }

  // 3. Fallback: check if the patient name exactly matches an existing patient whose MRN was missing or formatted differently
  if (extractedPatientName && extractedPatientName.trim().length > 4) {
    const nameMatch = patients.find((p) => {
      const comp = comparePatientNames(extractedPatientName, p.name);
      return comp.matches && comp.confidence >= 0.9;
    });

    if (nameMatch) {
      return {
        status: 'NORMALIZED_MATCH',
        matchedHospitalNumber: nameMatch.hospitalNumber,
        matchedPatientName: nameMatch.name,
        existingPatient: nameMatch,
        confidence: 0.85,
        isDuplicatePrevented: true,
        notes: `Demographic match found with existing patient '${nameMatch.name}' (${nameMatch.hospitalNumber}). Prevented duplicate registration.`,
        suggestedAction: 'ATTACH_TO_EXISTING',
      };
    }
  }

  // 4. No existing match found -> Safe to create new patient
  return {
    status: 'NEW_PATIENT',
    matchedHospitalNumber: rawHospNum,
    confidence: 0.9,
    isDuplicatePrevented: false,
    notes: `Unique Hospital Number '${rawHospNum}'. Clean entry validated for new patient registration.`,
    suggestedAction: 'CREATE_NEW',
  };
}

export interface PatientEnrichedRow {
  row: CleanDataFrameRow;
  patientMatch: PatientMatchEvaluation;
}

/**
 * Service Layer: Batch cross-references entire CleanDataFrame rows with existing patient entries
 */
export function crossReferenceDataFrameBatch(
  rows: CleanDataFrameRow[],
  existingPatientsList?: StoredPatient[]
): {
  enrichedRows: PatientEnrichedRow[];
  deduplicationStats: {
    totalRows: number;
    existingPatientsLinked: number;
    newPatientsCreated: number;
    conflictsFlagged: number;
    duplicatesPrevented: number;
  };
} {
  const patients = existingPatientsList || (typeof window !== 'undefined' ? storageService.getPatients() : []);
  let existingPatientsLinked = 0;
  let newPatientsCreated = 0;
  let conflictsFlagged = 0;

  const enrichedRows: PatientEnrichedRow[] = rows.map((row) => {
    const match = crossReferenceHospitalNumber(
      row.Hospital_Number || row.Card_Number,
      row.Patient_Name,
      patients
    );

    if (match.status === 'EXACT_MATCH' || match.status === 'NORMALIZED_MATCH') {
      existingPatientsLinked++;
    } else if (match.status === 'NEW_PATIENT') {
      newPatientsCreated++;
    } else if (match.status === 'DEMOGRAPHIC_CONFLICT') {
      conflictsFlagged++;
    }

    return {
      row,
      patientMatch: match,
    };
  });

  return {
    enrichedRows,
    deduplicationStats: {
      totalRows: rows.length,
      existingPatientsLinked,
      newPatientsCreated,
      conflictsFlagged,
      duplicatesPrevented: existingPatientsLinked,
    },
  };
}

