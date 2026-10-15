/**
 * Hospital Forms Schema & Clinical Entity Catalog
 * Health Archive Intelligence
 * 
 * Defines the specific hospital forms, their collected clinical entities,
 * automated form detection heuristics, and schema mappings.
 */

export type HospitalFormType =
  | 'all_master'
  | 'outpatient_card'
  | 'laboratory_report'
  | 'inpatient_ward'
  | 'pharmacy_prescription'
  | 'antenatal_maternity'
  | 'surgical_notes';

export interface FormTypeDefinition {
  id: HospitalFormType;
  label: string;
  badge: string;
  iconName: string;
  description: string;
  targetColumns: string[];
  keywords: string[];
}

export const HOSPITAL_FORM_DEFINITIONS: Record<HospitalFormType, FormTypeDefinition> = {
  all_master: {
    id: 'all_master',
    label: 'Master Consolidated Dataset',
    badge: 'ALL FORMS',
    iconName: 'Database',
    description: 'Unified dataset merging all hospital forms with standardized health data columns.',
    targetColumns: [
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
      'Lab_Test_Name',
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
      'Clinical_Notes',
      'Doctor_Name',
      'Department',
      'Confidence_Score',
    ],
    keywords: [],
  },
  outpatient_card: {
    id: 'outpatient_card',
    label: 'Outpatient Consultation (GOPD / Clinic Card)',
    badge: 'GOPD / CLINIC',
    iconName: 'UserCheck',
    description: 'General Outpatient Department patient cards, clinic notes, and primary consultations.',
    targetColumns: [
      'File_Name',
      'Hospital_Name',
      'Patient_Name',
      'Age',
      'Gender',
      'Hospital_Number',
      'Card_Number',
      'Date_of_Visit',
      'Blood_Pressure',
      'Pulse_Rate',
      'Temperature',
      'Weight',
      'Complaint',
      'Diagnosis',
      'Secondary_Diagnosis',
      'Prescription',
      'Clinical_Notes',
      'Doctor_Name',
      'Department',
      'Confidence_Score',
    ],
    keywords: [
      'gopd',
      'outpatient',
      'clinic card',
      'patient card',
      'general outpatient',
      'consultation',
      'chief complaint',
      'history of present illness',
      'provisional diagnosis',
      'attending physician',
    ],
  },
  laboratory_report: {
    id: 'laboratory_report',
    label: 'Laboratory Investigation & Pathology Panel',
    badge: 'LAB PANEL',
    iconName: 'FlaskConical',
    description: 'Chemical pathology, haematology, microbiology, and parasitology test results.',
    targetColumns: [
      'File_Name',
      'Hospital_Name',
      'Patient_Name',
      'Age',
      'Gender',
      'Hospital_Number',
      'Date_of_Visit',
      'Specimen_Type',
      'Lab_Test_Name',
      'Result_Value',
      'Unit',
      'Reference_Range',
      'Lab_Flag',
      'Diagnosis',
      'Doctor_Name',
      'Confidence_Score',
    ],
    keywords: [
      'pathology',
      'laboratory',
      'haematology',
      'chemical pathology',
      'specimen',
      'fasting blood sugar',
      'fbs',
      'creatinine',
      'urea',
      'electrolytes',
      'full blood count',
      'fbc',
      'pcv',
      'wbc',
      'platelets',
      'urinalysis',
      'malaria parasite',
      'microbiology',
      'reference range',
    ],
  },
  pharmacy_prescription: {
    id: 'pharmacy_prescription',
    label: 'Pharmacy Prescription & Dispensing Record',
    badge: 'PRESCRIPTION',
    iconName: 'Pill',
    description: 'Prescription orders, drug dispensing sheets, dosage, and medication frequency.',
    targetColumns: [
      'File_Name',
      'Hospital_Name',
      'Patient_Name',
      'Age',
      'Gender',
      'Hospital_Number',
      'Date_of_Visit',
      'Diagnosis',
      'Drug_Name',
      'Dosage',
      'Route',
      'Frequency',
      'Duration',
      'Prescription',
      'Doctor_Name',
      'Confidence_Score',
    ],
    keywords: [
      'pharmacy',
      'prescription',
      'rx',
      'dispensary',
      'dispensed',
      'dosage',
      'tabs',
      'caps',
      'syrup',
      'mg',
      'daily',
      'nocte',
      'prn',
      'stat',
      'bd',
      'tds',
      'qds',
    ],
  },
  inpatient_ward: {
    id: 'inpatient_ward',
    label: 'Inpatient Admission & Ward Observation Sheet',
    badge: 'INPATIENT WARD',
    iconName: 'BedDouble',
    description: 'Admission records, daily ward rounds, nursing observation charts, and vitals trend.',
    targetColumns: [
      'File_Name',
      'Hospital_Name',
      'Patient_Name',
      'Age',
      'Gender',
      'Hospital_Number',
      'Ward_Bed_Number',
      'Date_of_Visit',
      'Blood_Pressure',
      'Temperature',
      'Pulse_Rate',
      'Respiratory_Rate',
      'Diagnosis',
      'Clinical_Notes',
      'Doctor_Name',
      'Department',
      'Confidence_Score',
    ],
    keywords: [
      'inpatient',
      'admission',
      'ward',
      'bed no',
      'ward round',
      'discharge',
      'nursing notes',
      'observation chart',
      'consultant in charge',
    ],
  },
  antenatal_maternity: {
    id: 'antenatal_maternity',
    label: 'Antenatal Care (ANC) & Maternity Record',
    badge: 'MATERNITY / ANC',
    iconName: 'HeartHandshake',
    description: 'Maternal health records, parity, gravidity, gestational age, fundal height, and fetal heart rate.',
    targetColumns: [
      'File_Name',
      'Hospital_Name',
      'Patient_Name',
      'Age',
      'Hospital_Number',
      'Card_Number',
      'Date_of_Visit',
      'Gravida_Parity',
      'Gestational_Age',
      'Blood_Pressure',
      'Weight',
      'Diagnosis',
      'Prescription',
      'Clinical_Notes',
      'Doctor_Name',
      'Confidence_Score',
    ],
    keywords: [
      'antenatal',
      'anc',
      'maternity',
      'parity',
      'gravida',
      'gestation',
      'fundal height',
      'fetal heart',
      'fhr',
      'edd',
      'lmp',
      'trimester',
      'folic acid',
      'ferrous',
    ],
  },
  surgical_notes: {
    id: 'surgical_notes',
    label: 'Surgical Operation & Theatre Record',
    badge: 'THEATRE / SURGICAL',
    iconName: 'Scissors',
    description: 'Operation notes, surgeon findings, anesthesia type, and post-operative diagnosis.',
    targetColumns: [
      'File_Name',
      'Hospital_Name',
      'Patient_Name',
      'Age',
      'Gender',
      'Hospital_Number',
      'Date_of_Visit',
      'Diagnosis',
      'Clinical_Notes',
      'Doctor_Name',
      'Department',
      'Confidence_Score',
    ],
    keywords: [
      'theatre',
      'operation',
      'surgeon',
      'anaesthetist',
      'pre-op',
      'post-op',
      'incision',
      'procedure',
      'laparotomy',
      'appendectomy',
      'caesarean',
    ],
  },
};

/**
 * Automatically detects the hospital form type from document text and filename
 */
export function detectHospitalFormType(text: string, filename: string = ''): HospitalFormType {
  const combined = `${filename} ${text}`.toLowerCase();

  // 1. Antenatal / Maternity
  if (
    /antenatal|anc\s*card|gravid|parity\s*g\d|gestation|fundal\s*height|fetal\s*heart|intrauterine/i.test(combined)
  ) {
    return 'antenatal_maternity';
  }

  // 2. Laboratory Investigation
  if (
    /chemical pathology|haematology|investigation|lab\s*report|specimen|mmol\/l|umol\/l|fasting blood sugar|full blood count|serum\s*creatinine/i.test(
      combined
    )
  ) {
    return 'laboratory_report';
  }

  // 3. Pharmacy Prescription
  if (
    /prescription|dispens|rx\s*[:\-]|tab\s+[a-z]+|cap\s+[a-z]+|bd\s+x|tds\s+x|daily\s+x\s*\d/i.test(
      combined
    ) &&
    !/investigation|pathology/i.test(combined)
  ) {
    return 'pharmacy_prescription';
  }

  // 4. Inpatient Ward
  if (
    /inpatient|ward\s*[a-z0-9]|admission\s*date|bed\s*no|discharge\s*summary|observation\s*chart/i.test(
      combined
    )
  ) {
    return 'inpatient_ward';
  }

  // 5. Surgical / Theatre
  if (/theatre|surgeon|anaesthe|operation\s*notes|pre-op|post-op/i.test(combined)) {
    return 'surgical_notes';
  }

  // 6. Default to Outpatient Consultation
  return 'outpatient_card';
}

/**
 * Standardized Nigerian and global hospital facility names
 */
export function extractHospitalName(text: string): string {
  const facilityPatterns = [
    /([A-Za-z\s]+(?:Teaching Hospital|Specialist Hospital|General Hospital|Medical Centre|Clinic|Infirmary|Health Centre|Hospital))/i,
    /(LUTH|UCH|AKTH|ABUTH|UBTH|UNTH|FMC\s+[A-Za-z]+|National Hospital\s+Abuja)/i,
  ];

  for (const pattern of facilityPatterns) {
    const match = text.match(pattern);
    if (match && match[1]) {
      return match[1].trim().replace(/\s+/g, ' ');
    }
  }

  return 'General Hospital Archive';
}
