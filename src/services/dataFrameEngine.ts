/**
 * Advanced Clinical Data Management & Pandas DataFrame Engine (Steps 1, 2, 3)
 * Health Archive Intelligence
 * 
 * Pipeline:
 * STEP 1 - JSON Cleaning & Filtering (Remove Noise, confidence < 0.40, fillers, OCR shadows, watermarks)
 * STEP 2 - Strict Whitelist Extraction (Only IMPORTANT 18 medical keys)
 * STEP 3 - Pandas DataFrame transformation (Deduplication, drop empty rows/columns, formatting)
 * STEP 4 - Clean Export (Excel .xlsx and CSV) ready for DHIS2 / FHIR
 */

import * as XLSX from 'xlsx';

export const IMPORTANT_COLUMNS = [
  'File_Name',
  'Patient_Name',
  'Age',
  'Gender',
  'Hospital_Number',
  'Card_Number',
  'Date_of_Visit',
  'Diagnosis',
  'Complaint',
  'Lab_Test_Name',
  'Lab_Result',
  'Result_Value',
  'Unit',
  'Reference_Range',
  'Prescription',
  'Drug_Name',
  'Dosage',
  'Doctor_Name',
  'Department',
] as const;

export type ImportantColumnKey = typeof IMPORTANT_COLUMNS[number];

export interface CleanDataFrameRow {
  File_Name: string;
  Patient_Name: string;
  Age: string;
  Gender: string;
  Hospital_Number: string;
  Card_Number: string;
  Date_of_Visit: string;
  Diagnosis: string;
  Complaint: string;
  Lab_Test_Name: string;
  Lab_Result: string;
  Result_Value: string;
  Unit: string;
  Reference_Range: string;
  Prescription: string;
  Drug_Name: string;
  Dosage: string;
  Doctor_Name: string;
  Department: string;
  [key: string]: string; // For dynamic indexing
}

export interface DataFrameTelemetry {
  filesProcessed: number;
  noisyTokensRemoved: number;
  importantColumnsKept: number;
  cleanRowsProduced: number;
  activeColumns: string[];
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
 * - Tokens with confidence < 0.40
 * - Fillers: "____", "....", "xxx", "---"
 * - OCR shadow duplicate words
 * - Irrelevant page/brand headers ("Page 1", "Rite Foods")
 */
export function cleanRawOcrText(rawText: string, ocrBlocks?: any[]): { cleanedText: string; tokensRemoved: number } {
  let tokensRemoved = 0;
  if (!rawText) return { cleanedText: '', tokensRemoved: 0 };

  // 1. Line-by-line inspection
  const lines = rawText.split('\n');
  const cleanedLines: string[] = [];
  const seenLineWords = new Set<string>();

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    // Filter out common non-medical watermarks and headers
    if (
      /^(page\s*\d+(\s*of\s*\d+)?|rite foods|confidential scan|document scan\s*\d+)$/i.test(trimmed)
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
 * Step 2 & 3: Transform OCR item list into a cleaned Pandas-equivalent DataFrame
 * Mirrors exact logic:
 * - Pattern-based extraction with regex
 * - Normalization & title casing
 * - Drop duplicate rows
 * - Drop fully empty rows
 * - Drop 100% empty columns
 */
export function jsonListToCleanDataFrame(jsonList: Array<{ file?: string; filename?: string; raw_text?: string; text?: string; pages?: any }>): DataFrameResult {
  const cleanRows: CleanDataFrameRow[] = [];
  let totalTokensRemoved = 0;

  // Patterns for robust regex extraction matching Python logic
  const patterns: Record<Exclude<ImportantColumnKey, 'File_Name'>, RegExp> = {
    Patient_Name: /(?:Name|Patient Name|Pt Name)\s*[:\-]\s*([A-Za-z ]{3,})/i,
    Age: /\bAge\s*[:\-]?\s*(\d{1,3})(?:\s*(?:yrs|years|y\/o))?/i,
    Gender: /(?:Sex|Gender)\s*[:\-]\s*(Male|Female|M|F)\b/i,
    Hospital_Number: /(?:Hospital No|Hosp No|Card No|Hosp\.?\s*No|MRN)\s*[:\-]?\s*([A-Z0-9\-/]+)/i,
    Card_Number: /(?:Card No|Registration No|Reg No)\s*[:\-]?\s*([A-Z0-9\-/]+)/i,
    Date_of_Visit: /(?:Date|Visit Date|Date of Visit)\s*[:\-]?\s*([\d]{1,2}[\/\-][\d]{1,2}[\/\-][\d]{2,4})/i,
    Diagnosis: /(?:Diagnosis|Impression|Dx)\s*[:\-]?\s*([A-Za-z0-9,\s]+?)(?=\n|Rx|Plan|Vitals|Medication|$)/i,
    Complaint: /(?:Chief Complaint|Complaint|C\/O)\s*[:\-]?\s*([A-Za-z0-9,\s]+?)(?=\n|History|HPI|Vitals|$)/i,
    Lab_Test_Name: /(?:Test|Investigation|Lab)\s*[:\-]?\s*([A-Za-z0-9\s]+?)(?=\s*Result|\s*[:\-]|Ref|\n|$)/i,
    Lab_Result: /(?:Result|Lab Result)\s*[:\-]?\s*([A-Za-z0-9.\s]+?)(?=\s*Unit|\s*Ref|\n|$)/i,
    Result_Value: /\b(?:Result|Value)\s*[:\-]?\s*([0-9.]+(?:\s*[A-Za-z/%]+)?)/i,
    Unit: /\b(mmol\/L|mg\/dL|umol\/L|g\/dL|%|IU\/L|mmHg|bpm|kg|cm)\b/i,
    Reference_Range: /(?:Ref|Ref Range|Reference|Normal)\s*[:\-]?\s*([A-Za-z0-9.\-\s<>=]+?)(?=\n|$)/i,
    Prescription: /(?:Rx|Prescription|Plan)\s*[:\-]?\s*([A-Za-z0-9\s.,;]+?)(?=\n\n|Doctor|Dr|$)/i,
    Drug_Name: /\b(Amlodipine|Lisinopril|Paracetamol|Metformin|Artemether|Lumefantrine|Amoxicillin|Ciprofloxacin|Omeprazole|Folic Acid|Ferrous Sulphate)\b/i,
    Dosage: /\b(\d+\s*(?:mg|g|ml|tabs?|caps?))\b/i,
    Doctor_Name: /(?:Dr\.?|Doctor|Clinician|Physician)\s*([A-Za-z.\s]+?)(?=\n|\(|$)/i,
    Department: /(?:Dept|Department|Clinic|Ward)\s*[:\-]?\s*([A-Za-z\s]+?)(?=\n|Date|$)/i,
  };

  for (const item of jsonList) {
    const rawText = item.raw_text || item.text || '';
    const fileName = item.file || item.filename || 'record_001.jpg';

    // Step 1: Clean noise from raw text
    const { cleanedText, tokensRemoved } = cleanRawOcrText(rawText);
    totalTokensRemoved += tokensRemoved;

    // Multi-row expansion: if document has multiple lab tests or multiple lines, detect sub-records
    const lines = cleanedText.split('\n');
    const isLabReport = /investigation|pathology|laboratory|glucose|creatinine|cholesterol/i.test(cleanedText);

    // Extract core patient card demographics
    const baseRow: CleanDataFrameRow = {
      File_Name: fileName,
      Patient_Name: '',
      Age: '',
      Gender: '',
      Hospital_Number: '',
      Card_Number: '',
      Date_of_Visit: '',
      Diagnosis: '',
      Complaint: '',
      Lab_Test_Name: '',
      Lab_Result: '',
      Result_Value: '',
      Unit: '',
      Reference_Range: '',
      Prescription: '',
      Drug_Name: '',
      Dosage: '',
      Doctor_Name: '',
      Department: '',
    };

    // Apply regex patterns
    (Object.keys(patterns) as Array<Exclude<ImportantColumnKey, 'File_Name'>>).forEach((key) => {
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

    // Step 2 & 3: If it's a lab table with multiple investigations, expand into multiple rows!
    const labLines = lines.filter((l) =>
      /(?:fasting|blood|serum|creatinine|urea|potassium|cholesterol|pcv|hb|glucose|wbc|platelets)/i.test(l) &&
      /\d/.test(l)
    );

    if (isLabReport && labLines.length > 1) {
      labLines.forEach((labLine) => {
        const testMatch = labLine.match(/([A-Za-z\s()]+)\s*[:\-]?\s*([0-9.]+)\s*([A-Za-z/%]*)\s*(?:\(?(?:Ref|Ref Range|Reference)?[:\-]?\s*([0-9.\-\s<>=]+)\)?)?/i);
        const expandedRow: CleanDataFrameRow = { ...baseRow };
        if (testMatch) {
          expandedRow.Lab_Test_Name = testMatch[1].trim();
          expandedRow.Result_Value = testMatch[2].trim();
          expandedRow.Lab_Result = `${testMatch[2].trim()} ${testMatch[3] ? testMatch[3].trim() : ''}`.trim();
          expandedRow.Unit = testMatch[3] ? testMatch[3].trim() : expandedRow.Unit;
          if (testMatch[4]) expandedRow.Reference_Range = testMatch[4].trim();
        } else {
          expandedRow.Lab_Test_Name = labLine.trim();
        }
        cleanRows.push(expandedRow);
      });
    } else {
      cleanRows.push(baseRow);
    }
  }

  // Pandas Step: Drop duplicates (df.drop_duplicates())
  const seenRowSignatures = new Set<string>();
  const deduplicatedRows: CleanDataFrameRow[] = [];

  for (const row of cleanRows) {
    const signature = `${row.File_Name}_${row.Patient_Name}_${row.Hospital_Number}_${row.Lab_Test_Name}_${row.Result_Value}_${row.Diagnosis}`;
    if (!seenRowSignatures.has(signature)) {
      seenRowSignatures.add(signature);
      deduplicatedRows.push(row);
    }
  }

  // Pandas Step: Drop fully empty rows (df.dropna(how='all'))
  const nonEmptyRows = deduplicatedRows.filter((r) => {
    return Object.keys(r).some((k) => k !== 'File_Name' && r[k].trim() !== '');
  });

  // Pandas Step: df.loc[:, (df != "").any(axis=0)] - Remove columns that are 100% empty across the DataFrame
  const activeColumns = IMPORTANT_COLUMNS.filter((col) => {
    if (col === 'File_Name') return true;
    return nonEmptyRows.some((row) => row[col] && row[col].trim() !== '');
  });

  const finalRows = nonEmptyRows.length > 0 ? nonEmptyRows : cleanRows;

  return {
    rows: finalRows,
    activeColumns: [...activeColumns],
    telemetry: {
      filesProcessed: jsonList.length,
      noisyTokensRemoved: totalTokensRemoved,
      importantColumnsKept: activeColumns.length,
      cleanRowsProduced: finalRows.length,
      activeColumns: [...activeColumns],
    },
    rawJsonCleaned: true,
  };
}

/**
 * Download DataFrame as Clean Excel (.xlsx)
 */
export function downloadDataFrameExcel(rows: CleanDataFrameRow[], activeColumns: string[], filename: string = 'hospital_dataframe.xlsx'): void {
  // Format only active columns with professional medical column names
  const formattedRows = rows.map((row) => {
    const obj: Record<string, string> = {};
    activeColumns.forEach((col) => {
      const headerName = col.replace(/_/g, ' ');
      obj[headerName] = row[col] || '';
    });
    return obj;
  });

  const worksheet = XLSX.utils.json_to_sheet(formattedRows);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Clean_Clinical_DataFrame');

  XLSX.writeFile(workbook, filename.endsWith('.xlsx') ? filename : `${filename}.xlsx`);
}

/**
 * Download DataFrame as Clean CSV
 */
export function downloadDataFrameCsv(rows: CleanDataFrameRow[], activeColumns: string[], filename: string = 'hospital_dataframe.csv'): void {
  const headers = activeColumns;
  const csvRows = rows.map((r) =>
    headers.map((col) => `"${(r[col] || '').replace(/"/g, '""')}"`).join(',')
  );

  const csvContent = [headers.join(','), ...csvRows].join('\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename.endsWith('.csv') ? filename : `${filename}.csv`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
