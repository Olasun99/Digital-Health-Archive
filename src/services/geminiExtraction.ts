/**
 * Gemini Clinical Information Extraction Service
 * Health Archive Intelligence
 * 
 * Takes raw OCR text and structures it into clinical health information.
 * Strictly separates OCR ("What text is present?") from Gemini ("What does this text represent?").
 */

export interface StructuredPatient {
  patient_name: string | null;
  hospital_number: string | null;
  date_of_birth: string | null;
  age: string | number | null;
  sex: 'Male' | 'Female' | 'Other' | null;
  address: string | null;
}

export interface StructuredEncounter {
  encounter_date: string | null;
  encounter_type: 'Outpatient' | 'Inpatient' | 'Emergency' | 'Laboratory' | 'Pharmacy' | 'Other' | null;
  department: string | null;
  attending_clinician: string | null;
}

export interface StructuredClinicalInfo {
  chief_complaint: string | null;
  history_of_present_illness: string | null;
  symptoms: string[] | null;
  clinical_observations: string[] | null;
  diagnoses: string[] | null;
}

export interface StructuredVitalSigns {
  blood_pressure: string | null;
  heart_rate: string | null;
  respiratory_rate: string | null;
  temperature: string | null;
  oxygen_saturation: string | null;
  weight: string | null;
  height: string | null;
}

export interface StructuredLabTest {
  test_name: string;
  result: string;
  unit: string | null;
  reference_range: string | null;
  test_date: string | null;
}

export interface StructuredMedication {
  medication_name: string;
  dose: string | null;
  route: string | null;
  frequency: string | null;
  duration: string | null;
}

export interface StructuredDoctorNotes {
  clinical_notes: string | null;
}

export interface StructuredMetadata {
  document_type: string;
  document_date: string | null;
  source_document_id: string;
  source_page: number;
}

export interface StructuredConfidenceReview {
  extraction_confidence: number;
  requires_review: boolean;
  uncertainties: string[];
}

export interface ClinicalExtractionResult {
  patient: StructuredPatient;
  encounter: StructuredEncounter;
  clinical_information: StructuredClinicalInfo;
  vital_signs: StructuredVitalSigns;
  laboratory: StructuredLabTest[];
  medications: StructuredMedication[];
  doctor_notes: StructuredDoctorNotes;
  document_metadata: StructuredMetadata;
  confidence_review: StructuredConfidenceReview;
}

export async function extractClinicalInformation(
  ocrText: string,
  documentId: string,
  pagesCount: number = 1
): Promise<ClinicalExtractionResult> {
  const response = await fetch('/api/extract', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      ocrText,
      documentId,
      pages: pagesCount,
    }),
  });

  if (!response.ok) {
    const errorBody = await response.json().catch(() => ({}));
    throw new Error(errorBody.error || `Failed to extract clinical information (HTTP ${response.status})`);
  }

  const result = (await response.json()) as ClinicalExtractionResult;
  return result;
}
