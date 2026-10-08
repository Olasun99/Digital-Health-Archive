import React, { useState, useEffect } from 'react';
import { Download, FileSpreadsheet, FileCode, FileText, CheckCircle2 } from 'lucide-react';
import { storageService, StoredHealthRecord, StoredDocument } from '../services/storageService';

export const ExportsView: React.FC = () => {
  const [records, setRecords] = useState<StoredHealthRecord[]>([]);
  const [documents, setDocuments] = useState<StoredDocument[]>([]);
  const [exportFilter, setExportFilter] = useState<'all' | 'approved_only'>('all');

  useEffect(() => {
    setRecords(storageService.getRecords());
    setDocuments(storageService.getDocuments());
  }, []);

  const getFilteredRecords = () => {
    if (exportFilter === 'approved_only') {
      return records.filter((r) => r.status === 'approved');
    }
    return records;
  };

  const downloadFile = (content: string, filename: string, type: string) => {
    const blob = new Blob([content], { type });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  const handleExportStructuredJson = () => {
    const data = getFilteredRecords().map((r) => ({
      record_id: r.id,
      document_id: r.documentId,
      filename: r.filename,
      status: r.status,
      reviewed_by: r.reviewedBy,
      reviewed_at: r.reviewedAt,
      clinical_record: r.reviewedData || r.extractedData,
      corrections_log: r.corrections,
    }));
    downloadFile(JSON.stringify(data, null, 2), 'health_archive_structured_records.json', 'application/json');
  };

  const handleExportOcrJson = () => {
    const data = documents.map((d) => ({
      document_id: d.id,
      filename: d.filename,
      date_processed: d.dateProcessed,
      ocr_engine: d.ocrEngine,
      confidence: d.ocrConfidence,
      raw_ocr_text: d.rawOcrText,
    }));
    downloadFile(JSON.stringify(data, null, 2), 'docTR_hospital_archives_ocr.json', 'application/json');
  };

  const handleExportCsv = () => {
    const recs = getFilteredRecords();
    const headers = [
      'Document_ID',
      'Hospital_Number',
      'Patient_Name',
      'Age',
      'Sex',
      'Encounter_Date',
      'Department',
      'Diagnoses',
      'Blood_Pressure',
      'Heart_Rate',
      'Medications',
      'Review_Status',
      'Reviewed_By',
    ];

    const rows = recs.map((r) => {
      const data = r.reviewedData || r.extractedData;
      return [
        `"${r.documentId}"`,
        `"${data.patient?.hospital_number || ''}"`,
        `"${data.patient?.patient_name || ''}"`,
        `"${data.patient?.age || ''}"`,
        `"${data.patient?.sex || ''}"`,
        `"${data.encounter?.encounter_date || ''}"`,
        `"${data.encounter?.department || ''}"`,
        `"${(data.clinical_information.diagnoses || []).join('; ')}"`,
        `"${data.vital_signs?.blood_pressure || ''}"`,
        `"${data.vital_signs?.heart_rate || ''}"`,
        `"${(data.medications || []).map((m) => m.medication_name).join('; ')}"`,
        `"${r.status}"`,
        `"${r.reviewedBy || ''}"`,
      ].join(',');
    });

    const csvContent = [headers.join(','), ...rows].join('\n');
    downloadFile(csvContent, 'health_archive_intelligence_dataset.csv', 'text/csv');
  };

  return (
    <div className="p-6 md:p-8 space-y-6 max-w-5xl mx-auto">
      <div>
        <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">Data & Research Exports</h1>
        <p className="text-xs text-slate-500">
          Export longitudinal clinical records, raw OCR payloads, and flat tabular datasets for hospital administration and research.
        </p>
      </div>

      {/* Filter Options */}
      <div className="p-4 rounded-xl bg-white border border-slate-200 shadow-xs flex items-center justify-between">
        <span className="text-xs font-semibold text-slate-700">Filter Scope:</span>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setExportFilter('all')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer ${
              exportFilter === 'all'
                ? 'bg-slate-900 text-white'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            All Digitised Records ({records.length})
          </button>
          <button
            onClick={() => setExportFilter('approved_only')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer ${
              exportFilter === 'approved_only'
                ? 'bg-emerald-700 text-white'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            Approved Only ({records.filter((r) => r.status === 'approved').length})
          </button>
        </div>
      </div>

      {/* Export Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        <div className="p-6 rounded-2xl bg-white border border-slate-200 shadow-xs flex flex-col justify-between space-y-4">
          <div className="space-y-2">
            <div className="w-10 h-10 rounded-xl bg-teal-50 border border-teal-200 text-teal-700 flex items-center justify-center">
              <FileSpreadsheet className="w-5 h-5" />
            </div>
            <h3 className="font-bold text-sm text-slate-900">Flat CSV Dataset</h3>
            <p className="text-xs text-slate-500 leading-relaxed">
              Export one row per clinical encounter with patient demographics, diagnoses, vitals, and medication fields.
            </p>
          </div>
          <button
            onClick={handleExportCsv}
            disabled={records.length === 0}
            className="w-full py-2.5 rounded-xl bg-[#0F4C5C] hover:bg-[#0c3c49] text-white text-xs font-bold shadow-xs flex items-center justify-center gap-2 disabled:opacity-50 cursor-pointer"
          >
            <Download className="w-4 h-4 text-teal-300" />
            <span>Download CSV</span>
          </button>
        </div>

        <div className="p-6 rounded-2xl bg-white border border-slate-200 shadow-xs flex flex-col justify-between space-y-4">
          <div className="space-y-2">
            <div className="w-10 h-10 rounded-xl bg-indigo-50 border border-indigo-200 text-indigo-700 flex items-center justify-center">
              <FileCode className="w-5 h-5" />
            </div>
            <h3 className="font-bold text-sm text-slate-900">Structured Clinical JSON</h3>
            <p className="text-xs text-slate-500 leading-relaxed">
              Full nested JSON with patient, encounter, laboratory arrays, medication objects, and human review audit trail.
            </p>
          </div>
          <button
            onClick={handleExportStructuredJson}
            disabled={records.length === 0}
            className="w-full py-2.5 rounded-xl bg-slate-800 hover:bg-slate-900 text-white text-xs font-bold shadow-xs flex items-center justify-center gap-2 disabled:opacity-50 cursor-pointer"
          >
            <Download className="w-4 h-4 text-indigo-300" />
            <span>Download JSON</span>
          </button>
        </div>

        <div className="p-6 rounded-2xl bg-white border border-slate-200 shadow-xs flex flex-col justify-between space-y-4">
          <div className="space-y-2">
            <div className="w-10 h-10 rounded-xl bg-slate-100 border border-slate-200 text-slate-700 flex items-center justify-center">
              <FileText className="w-5 h-5" />
            </div>
            <h3 className="font-bold text-sm text-slate-900">docTR Raw OCR Output</h3>
            <p className="text-xs text-slate-500 leading-relaxed">
              Direct normalized OCR text output and per-document confidence ratings straight from the FastAPI engine.
            </p>
          </div>
          <button
            onClick={handleExportOcrJson}
            disabled={documents.length === 0}
            className="w-full py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-bold border border-slate-300 shadow-2xs flex items-center justify-center gap-2 disabled:opacity-50 cursor-pointer"
          >
            <Download className="w-4 h-4 text-slate-600" />
            <span>Export Raw OCR</span>
          </button>
        </div>
      </div>
    </div>
  );
};
