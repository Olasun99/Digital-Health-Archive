import React, { useState, useEffect } from 'react';
import {
  Database,
  Table as TableIcon,
  Download,
  Filter,
  Search,
  Sparkles,
  CheckCircle2,
  Trash2,
  RefreshCw,
  Plus,
  SlidersHorizontal,
  Layers,
  ArrowRight,
  ShieldCheck,
  Check,
  FileSpreadsheet,
  FileText,
  Activity,
  AlertCircle,
  FlaskConical,
  Pill,
  UserCheck,
  BedDouble,
  HeartHandshake,
  Eye,
  Scissors
} from 'lucide-react';
import { storageService, StoredDocument } from '../services/storageService';
import {
  jsonListToCleanDataFrame,
  CleanDataFrameRow,
  DataFrameTelemetry,
  IMPORTANT_COLUMNS,
  downloadHospitalMultiSheetExcel,
  downloadDataFrameCsv
} from '../services/dataFrameEngine';
import {
  HospitalFormType,
  HOSPITAL_FORM_DEFINITIONS,
  detectHospitalFormType
} from '../services/hospitalFormsSchema';
import { DataFrameTable } from '../components/DataFrameTable';

interface DataFrameStudioViewProps {
  onNavigate: (path: string) => void;
}

export const DataFrameStudioView: React.FC<DataFrameStudioViewProps> = ({ onNavigate }) => {
  const [documents, setDocuments] = useState<StoredDocument[]>([]);
  const [dataFrameRows, setDataFrameRows] = useState<CleanDataFrameRow[]>([]);
  const [activeColumns, setActiveColumns] = useState<string[]>([]);
  const [telemetry, setTelemetry] = useState<DataFrameTelemetry | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedFormType, setSelectedFormType] = useState<HospitalFormType>('all_master');
  const [isProcessing, setIsProcessing] = useState(false);
  const [showFhirPreview, setShowFhirPreview] = useState(false);
  const [showColumnCustomizer, setShowColumnCustomizer] = useState(false);
  const [saveBanner, setSaveBanner] = useState(false);

  useEffect(() => {
    loadAndTransformData(selectedFormType);
    const handleUpdate = () => loadAndTransformData(selectedFormType);
    window.addEventListener('hai_data_updated', handleUpdate);
    return () => window.removeEventListener('hai_data_updated', handleUpdate);
  }, []);

  const loadAndTransformData = (formType: HospitalFormType = selectedFormType) => {
    setIsProcessing(true);
    const docs = storageService.getDocuments();
    setDocuments(docs);

    if (docs.length > 0) {
      // Map stored documents into raw JSON items expected by the pandas transformation pipeline
      const jsonList = docs.map((d) => ({
        file: d.filename,
        filename: d.filename,
        raw_text: d.rawOcrText,
        confidence: d.ocrConfidence ?? undefined,
        pages: d.pages,
      }));

      // Execute Steps 1, 2, 3: Clean JSON → Form Detection → Whitelist Extraction → Pandas DataFrame
      const result = jsonListToCleanDataFrame(jsonList, formType);
      setDataFrameRows(result.rows);
      setActiveColumns(result.activeColumns);
      setTelemetry(result.telemetry);
    } else {
      setDataFrameRows([]);
      const defaultCols = HOSPITAL_FORM_DEFINITIONS[formType].targetColumns;
      setActiveColumns([...defaultCols]);
      setTelemetry({
        filesProcessed: 0,
        noisyTokensRemoved: 0,
        importantColumnsKept: defaultCols.length,
        cleanRowsProduced: 0,
        activeColumns: [...defaultCols],
        detectedFormTypes: {},
      });
    }
    setIsProcessing(false);
  };

  const handleFormTypeChange = (newType: HospitalFormType) => {
    setSelectedFormType(newType);
    loadAndTransformData(newType);
  };

  const handleCellEdit = (rowIndex: number, columnKey: string, newValue: string) => {
    setDataFrameRows((prev) => {
      const updated = [...prev];
      updated[rowIndex] = {
        ...updated[rowIndex],
        [columnKey]: newValue,
      };
      return updated;
    });
  };

  const handleDeleteRow = (rowIndex: number) => {
    setDataFrameRows((prev) => prev.filter((_, idx) => idx !== rowIndex));
    setSaveBanner(true);
    setTimeout(() => setSaveBanner(false), 2000);
  };

  const toggleColumnVisibility = (col: string) => {
    setActiveColumns((prev) =>
      prev.includes(col) ? prev.filter((c) => c !== col) : [...prev, col]
    );
  };

  /**
   * Helper to load 5 specific hospital forms to showcase end-to-end form ingestion
   */
  const handleLoadSpecificHospitalForms = () => {
    const specificHospitalScans = [
      {
        id: `DOC-HOSP-GOPD-${Date.now()}`,
        filename: 'luth_gopd_card_001.jpg',
        fileSize: 245000,
        fileType: 'image/jpeg',
        dateProcessed: new Date().toLocaleString(),
        pages: 1,
        status: 'Completed' as const,
        ocrEngine: 'docTR (Hospital Ingest)',
        ocrConfidence: 0.95,
        processingTimeSeconds: 2.1,
        rawOcrText: `LAGOS UNIVERSITY TEACHING HOSPITAL
GENERAL OUTPATIENT DEPARTMENT (GOPD) CLINIC CARD
Date Seen: 12/10/2026   Hospital No: LUTH-98421   Card No: GOPD-1044
Patient Name: Babatunde Olawale Adeleke    Age: 52 yrs    Sex: Male
Address: 14 Surulere Crescent, Lagos State
Vital Signs: BP 145/95 mmHg   Pulse: 82 bpm   Temp: 36.8 C   Wt: 78 kg
Chief Complaint: 3 weeks history of recurrent occipital throbbing headache and easy fatigability.
History: Known hypertensive for 5 years with poor drug adherence. No chest pain, no blurred vision.
Provisional Diagnosis: Essential Hypertension - Stage 2, Uncontrolled. Secondary: Tension Headache.
Rx / Plan:
1. Tab Amlodipine 10mg daily x 30 days
2. Tab Lisinopril 10mg daily x 30 days
3. Tab Paracetamol 1g tds x 3 days
Attending Clinician: Dr. A. K. Balogun (MBBS, FMCFM)   Dept: Family Medicine / GOPD`,
      },
      {
        id: `DOC-HOSP-LAB-${Date.now() + 1}`,
        filename: 'uch_chemical_pathology_sheet.png',
        fileSize: 310000,
        fileType: 'image/png',
        dateProcessed: new Date().toLocaleString(),
        pages: 1,
        status: 'Completed' as const,
        ocrEngine: 'docTR (Hospital Ingest)',
        ocrConfidence: 0.96,
        processingTimeSeconds: 2.4,
        rawOcrText: `UNIVERSITY COLLEGE HOSPITAL, IBADAN
DEPARTMENT OF CHEMICAL PATHOLOGY - INVESTIGATION REPORT
Date: 14/10/2026   Hosp No: UCH-44821   Specimen: Venous Blood
Patient Name: Mrs. Ngozi Mary Okonkwo   Age: 46   Gender: Female
Clinical Indication: Routine follow-up / Type 2 Diabetes Mellitus
INVESTIGATION RESULTS:
Fasting Blood Sugar: 7.8 mmol/L  Ref: 3.9 - 6.1
Serum Urea: 4.8 mmol/L  Ref: 2.5 - 6.7
Serum Creatinine: 115 umol/L  Ref: 60 - 110
Sodium (Na+): 138 mmol/L  Ref: 135 - 145
Potassium (K+): 4.1 mmol/L  Ref: 3.5 - 5.0
Total Cholesterol: 5.9 mmol/L  Ref: < 5.2
Triglycerides: 2.1 mmol/L  Ref: < 1.7
Pathologist: Dr. O. E. Alabi (FWACP)   Lab Reg No: LAB-CHEM-2026-904`,
      },
      {
        id: `DOC-HOSP-FBC-${Date.now() + 2}`,
        filename: 'akth_haematology_fbc_report.jpg',
        fileSize: 220000,
        fileType: 'image/jpeg',
        dateProcessed: new Date().toLocaleString(),
        pages: 1,
        status: 'Completed' as const,
        ocrEngine: 'docTR (Hospital Ingest)',
        ocrConfidence: 0.94,
        processingTimeSeconds: 1.9,
        rawOcrText: `AMINU KANO TEACHING HOSPITAL (AKTH)
HAEMATOLOGY AND BLOOD TRANSFUSION DEPARTMENT
Date: 13/10/2026   Hospital No: AKTH-77215
Patient Name: Ibrahim Mustapha   Age: 29   Gender: Male
Specimen: EDTA Whole Blood   Diagnosis: Acute Febrile Illness / Query Malaria
HAEMATOLOGY TEST PANEL:
Packed Cell Volume (PCV): 34 %  Ref: 40 - 52
Haemoglobin (Hb): 11.2 g/dL  Ref: 13.0 - 17.0
White Blood Cells (WBC): 8.4 x10^9/L  Ref: 4.0 - 11.0
Platelets Count: 140 x10^9/L  Ref: 150 - 450
Malaria Parasite Smear: Positive (++) Trophozoites seen
Medical Lab Scientist: MLS K. B. Danjuma`,
      },
      {
        id: `DOC-HOSP-RX-${Date.now() + 3}`,
        filename: 'national_hospital_pharmacy_dispensing.jpg',
        fileSize: 180000,
        fileType: 'image/jpeg',
        dateProcessed: new Date().toLocaleString(),
        pages: 1,
        status: 'Completed' as const,
        ocrEngine: 'docTR (Hospital Ingest)',
        ocrConfidence: 0.93,
        processingTimeSeconds: 1.7,
        rawOcrText: `NATIONAL HOSPITAL ABUJA - PHARMACY DEPARTMENT
PRESCRIPTION & DRUG DISPENSING ORDER
Date: 14/10/2026   Hosp No: NHA-10928
Patient Name: Amina Bello   Age: 38   Sex: Female
Prescribing Doctor: Dr. Fatima Yusuf   Clinic: GOPD
Diagnosis: Severe Acute Uncomplicated P. Falciparum Malaria & Peptic Ulcer Disease
PRESCRIPTION:
1. Artemether / Lumefantrine 80/480mg Oral BD x 3 days
2. Tab Paracetamol 1000mg Oral TDS x 3 days
3. Cap Omeprazole 20mg Oral Daily (Morning) x 14 days
Pharmacist Dispensed By: Pharm. E. O. Chinedu`,
      },
      {
        id: `DOC-HOSP-ANC-${Date.now() + 4}`,
        filename: 'ubth_antenatal_maternity_card.jpg',
        fileSize: 260000,
        fileType: 'image/jpeg',
        dateProcessed: new Date().toLocaleString(),
        pages: 1,
        status: 'Completed' as const,
        ocrEngine: 'docTR (Hospital Ingest)',
        ocrConfidence: 0.95,
        processingTimeSeconds: 2.2,
        rawOcrText: `UNIVERSITY OF BENIN TEACHING HOSPITAL (UBTH)
MATERNITY & ANTENATAL CARE (ANC) CLINIC RECORD
Visit Date: 14/10/2026   Hospital No: UBTH-50291   Card No: ANC-2026-441
Patient Name: Blessing Osasere   Age: 31   Parity: G3 P2+0
EGA (Gestational Age): 28 wks   Fundal Height: 28 cm
Fetal Heart Rate (FHR): 142 bpm (Regular)   Presentation: Cephalic
Blood Pressure: 110/70 mmHg   Weight: 68 kg
Urinalysis: Protein: Nil, Sugar: Nil
Diagnosis: Normal Singleton Intrauterine Pregnancy at 28 weeks
Routine Antenatal Rx:
1. Tab Ferrous Sulphate 200mg Oral BD x 30 days
2. Tab Folic Acid 5mg Oral Daily x 30 days
3. Sulphadoxine/Pyrimethamine (IPTp-SP) 3 tabs STAT
Attending Midwife/Obstetrician: Dr. E. I. Osagie   Dept: Obstetrics & Gynaecology`,
      },
    ];

    specificHospitalScans.forEach((doc) => {
      storageService.saveDocument(doc as any);
    });

    loadAndTransformData(selectedFormType);
    setSaveBanner(true);
    setTimeout(() => setSaveBanner(false), 3000);
  };

  const filteredRows = dataFrameRows.filter((row) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return Object.values(row).some(
      (val) => typeof val === 'string' && val.toLowerCase().includes(q)
    );
  });

  return (
    <div className="p-4 md:p-8 space-y-6 max-w-[1750px] mx-auto min-h-screen flex flex-col font-sans">
      {/* Figma-Style Header & Action Center */}
      <div className="bg-white rounded-3xl border border-slate-200/90 p-5 md:p-6 shadow-xs flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4">
        <div className="flex items-center gap-3.5">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-[#0F172A] via-[#0F4C5C] to-teal-600 flex items-center justify-center text-white shadow-md shrink-0">
            <Database className="w-6 h-6 text-teal-300" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-lg md:text-xl font-extrabold text-slate-900 tracking-tight">
                Hospital Clinical Data Management & DataFrame Studio
              </h1>
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-teal-100 text-teal-900 border border-teal-300 uppercase tracking-wider">
                Pandas DataFrame Pipeline
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-1">
              From scanned paper hospital forms (GOPD cards, Lab investigation sheets, Prescriptions, Ward charts) → Clean JSON → Structured Dataset Columns.
            </p>
          </div>
        </div>

        {/* Primary Action Buttons */}
        <div className="flex items-center gap-2 flex-wrap w-full lg:w-auto justify-end">
          <button
            onClick={handleLoadSpecificHospitalForms}
            disabled={isProcessing}
            className="px-3.5 py-2 rounded-xl bg-teal-50 border border-teal-200 text-teal-900 hover:bg-teal-100 text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer shadow-2xs"
            title="Load 5 specific hospital paper form examples (GOPD, Chem Path Lab, FBC Haematology, Pharmacy Rx, Antenatal ANC)"
          >
            <Plus className="w-3.5 h-3.5 text-teal-700" />
            <span>Load 5 Sample Hospital Forms</span>
          </button>

          <button
            onClick={() => setShowColumnCustomizer(!showColumnCustomizer)}
            className={`px-3 py-2 rounded-xl border text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer ${
              showColumnCustomizer
                ? 'bg-slate-900 text-white border-slate-900'
                : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50'
            }`}
          >
            <SlidersHorizontal className="w-3.5 h-3.5" />
            <span>Columns ({activeColumns.length})</span>
          </button>

          <button
            onClick={() => setShowFhirPreview(!showFhirPreview)}
            className={`px-3 py-2 rounded-xl border text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer ${
              showFhirPreview
                ? 'bg-purple-700 text-white border-purple-700 shadow-xs'
                : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50'
            }`}
          >
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>{showFhirPreview ? 'Hide FHIR Schema' : 'FHIR / DHIS2 Ready'}</span>
          </button>

          <button
            onClick={() => downloadHospitalMultiSheetExcel(filteredRows, activeColumns)}
            disabled={filteredRows.length === 0}
            className="px-4 py-2 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold shadow-xs flex items-center gap-1.5 transition-all cursor-pointer disabled:opacity-50"
            title="Download multi-sheet hospital workbook: Master, Laboratory Panel, Prescriptions, and Encounters"
          >
            <FileSpreadsheet className="w-4 h-4 text-emerald-200" />
            <span>Download Multi-Sheet Excel</span>
          </button>

          <button
            onClick={() => downloadDataFrameCsv(filteredRows, activeColumns)}
            disabled={filteredRows.length === 0}
            className="px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold shadow-xs flex items-center gap-1.5 transition-all cursor-pointer disabled:opacity-50"
            title="Download clean CSV"
          >
            <Download className="w-4 h-4 text-slate-300" />
            <span>Download CSV</span>
          </button>
        </div>
      </div>

      {/* Hospital Form Type Selector Tabs */}
      <div className="bg-white rounded-2xl border border-slate-200/90 p-2 shadow-xs flex items-center gap-1.5 overflow-x-auto text-xs">
        <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider px-3 whitespace-nowrap">
          Hospital Form View:
        </span>
        {(Object.keys(HOSPITAL_FORM_DEFINITIONS) as HospitalFormType[]).map((fType) => {
          const def = HOSPITAL_FORM_DEFINITIONS[fType];
          const isSelected = selectedFormType === fType;
          return (
            <button
              key={fType}
              onClick={() => handleFormTypeChange(fType)}
              className={`px-3.5 py-1.5 rounded-xl font-bold text-xs whitespace-nowrap transition-all flex items-center gap-1.5 cursor-pointer ${
                isSelected
                  ? 'bg-[#0F4C5C] text-white shadow-xs'
                  : 'bg-slate-50 text-slate-600 hover:bg-slate-100 hover:text-slate-900'
              }`}
            >
              {fType === 'laboratory_report' && <FlaskConical className="w-3.5 h-3.5 text-teal-300" />}
              {fType === 'pharmacy_prescription' && <Pill className="w-3.5 h-3.5 text-amber-300" />}
              {fType === 'outpatient_card' && <UserCheck className="w-3.5 h-3.5 text-blue-300" />}
              {fType === 'inpatient_ward' && <BedDouble className="w-3.5 h-3.5 text-indigo-300" />}
              {fType === 'antenatal_maternity' && <HeartHandshake className="w-3.5 h-3.5 text-rose-300" />}
              {fType === 'all_master' && <Layers className="w-3.5 h-3.5 text-teal-300" />}
              <span>{def.label}</span>
            </button>
          );
        })}
      </div>

      {/* Column Customizer Drawer (Collapsible) */}
      {showColumnCustomizer && (
        <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm space-y-3 animate-fade-in">
          <div className="flex items-center justify-between border-b border-slate-100 pb-2">
            <div className="flex items-center gap-2">
              <SlidersHorizontal className="w-4 h-4 text-teal-700" />
              <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                Active Dataset Column Builder ({activeColumns.length} Selected)
              </h3>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setActiveColumns([...IMPORTANT_COLUMNS])}
                className="text-[11px] text-teal-700 hover:underline font-semibold cursor-pointer"
              >
                Select All
              </button>
              <span className="text-slate-300">•</span>
              <button
                onClick={() =>
                  setActiveColumns(HOSPITAL_FORM_DEFINITIONS[selectedFormType].targetColumns)
                }
                className="text-[11px] text-teal-700 hover:underline font-semibold cursor-pointer"
              >
                Reset to Form Template
              </button>
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-2 pt-1">
            {IMPORTANT_COLUMNS.map((col) => {
              const isActive = activeColumns.includes(col);
              return (
                <label
                  key={col}
                  className={`flex items-center gap-2 p-2 rounded-xl border text-[11px] cursor-pointer transition-colors ${
                    isActive
                      ? 'bg-teal-50 border-teal-300 text-teal-900 font-semibold'
                      : 'bg-slate-50 border-slate-200 text-slate-500 hover:bg-slate-100'
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={isActive}
                    onChange={() => toggleColumnVisibility(col)}
                    className="rounded border-slate-300 text-teal-600 focus:ring-teal-500"
                  />
                  <span className="truncate">{col.replace(/_/g, ' ')}</span>
                </label>
              );
            })}
          </div>
        </div>
      )}

      {/* 4-Step Telemetry Bar */}
      {telemetry && (
        <div className="bg-gradient-to-r from-teal-50 via-slate-50 to-indigo-50 border border-teal-200/90 rounded-2xl p-4 md:p-5 shadow-xs flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-teal-700 text-white flex items-center justify-center shrink-0 shadow-xs">
              <Sparkles className="w-4 h-4 text-teal-200" />
            </div>
            <div>
              <div className="text-[11px] font-bold text-teal-900 uppercase tracking-wider">
                Automated 4-Step Hospital Pipeline Telemetry
              </div>
              <div className="text-xs md:text-sm font-semibold text-slate-800 flex items-center gap-2 flex-wrap mt-0.5">
                <span className="font-mono bg-white px-2 py-0.5 rounded border border-teal-200 text-slate-900 font-bold">
                  1. Ingested {telemetry.filesProcessed} hospital files
                </span>
                <span className="text-teal-600 font-bold">→</span>
                <span className="font-mono bg-white px-2 py-0.5 rounded border border-rose-200 text-rose-800 font-bold">
                  2. Stripped {telemetry.noisyTokensRemoved} noise tokens (&lt; 0.40 conf / fillers)
                </span>
                <span className="text-teal-600 font-bold">→</span>
                <span className="font-mono bg-white px-2 py-0.5 rounded border border-purple-200 text-purple-900 font-bold">
                  3. Extracted {telemetry.importantColumnsKept} whitelist columns
                </span>
                <span className="text-teal-600 font-bold">→</span>
                <span className="font-mono bg-white px-2 py-0.5 rounded border border-emerald-200 text-emerald-900 font-bold">
                  4. {telemetry.cleanRowsProduced} clean rows ready
                </span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 text-xs text-slate-500 shrink-0">
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-800 font-bold text-[11px]">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" /> Whitelist Enforced • No Junk
            </span>
          </div>
        </div>
      )}

      {/* FHIR / DHIS2 Interoperability Preview Card (Collapsible) */}
      {showFhirPreview && (
        <div className="bg-purple-900 text-white rounded-2xl p-5 shadow-lg border border-purple-800 space-y-3 animate-fade-in">
          <div className="flex items-center justify-between border-b border-purple-800/80 pb-2">
            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-purple-200">
              <ShieldCheck className="w-4 h-4 text-teal-400" />
              <span>National Health Standards Alignment: FHIR R4 & DHIS2 Schema Ready</span>
            </div>
            <span className="text-[10px] bg-purple-800 px-2 py-0.5 rounded text-purple-200 font-mono">
              Federal Ministry of Health Interoperability Target
            </span>
          </div>
          <p className="text-xs text-purple-200 leading-relaxed max-w-4xl">
            This clean DataFrame maps hospital paper data directly into FHIR R4 resources:
            <code className="text-teal-300 font-mono ml-1">Patient</code> (Demographics),{' '}
            <code className="text-teal-300 font-mono">Observation</code> (Lab tests with values, units, reference ranges, and abnormal flags),{' '}
            <code className="text-teal-300 font-mono">Condition</code> (Primary and secondary diagnoses), and{' '}
            <code className="text-teal-300 font-mono">MedicationRequest</code> (Prescriptions with dosage, route, and frequency).
          </p>
        </div>
      )}

      {/* High-Fidelity Clinical DataFrame Table Grid */}
      <DataFrameTable
        rows={dataFrameRows}
        activeColumns={activeColumns}
        onCellEdit={handleCellEdit}
        onDeleteRow={handleDeleteRow}
        onRowsUpdate={setDataFrameRows}
        onNavigate={onNavigate}
        title={`${HOSPITAL_FORM_DEFINITIONS[selectedFormType].label} Grid`}
        subtitle="Sticky headers, column-level sorting, instant click-to-edit verification & patient duplicate prevention"
      />
    </div>
  );
};
