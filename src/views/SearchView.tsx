import React, { useState, useEffect } from 'react';
import {
  Search as SearchIcon,
  User,
  FileText,
  Activity,
  FlaskConical,
  Pill,
  ArrowRight,
  ExternalLink
} from 'lucide-react';
import { storageService, StoredHealthRecord, StoredDocument } from '../services/storageService';

interface SearchViewProps {
  onNavigate: (path: string) => void;
}

export const SearchView: React.FC<SearchViewProps> = ({ onNavigate }) => {
  const [query, setQuery] = useState('hypertension');
  const [records, setRecords] = useState<StoredHealthRecord[]>([]);
  const [documents, setDocuments] = useState<StoredDocument[]>([]);

  useEffect(() => {
    setRecords(storageService.getRecords());
    setDocuments(storageService.getDocuments());
  }, []);

  const trimmed = query.trim().toLowerCase();

  // Search matches
  const matchedPatients = trimmed
    ? storageService.getPatients().filter((p) =>
        p.name.toLowerCase().includes(trimmed) ||
        p.hospitalNumber.toLowerCase().includes(trimmed) ||
        (p.address && p.address.toLowerCase().includes(trimmed))
      )
    : [];

  const matchedDocuments = trimmed
    ? documents.filter((d) =>
        d.id.toLowerCase().includes(trimmed) ||
        d.filename.toLowerCase().includes(trimmed) ||
        d.rawOcrText.toLowerCase().includes(trimmed)
      )
    : [];

  const matchedDiagnoses: any[] = [];
  const matchedMeds: any[] = [];
  const matchedLabs: any[] = [];

  if (trimmed) {
    records.forEach((rec) => {
      const data = rec.reviewedData || rec.extractedData;
      // Diagnoses
      (data.clinical_information.diagnoses || []).forEach((dx) => {
        if (dx.toLowerCase().includes(trimmed)) {
          matchedDiagnoses.push({
            diagnosis: dx,
            patient: data.patient?.patient_name || 'Unnamed',
            hospNo: data.patient?.hospital_number || '—',
            documentId: rec.documentId,
            date: data.encounter?.encounter_date || rec.extractedAt.slice(0, 10),
          });
        }
      });
      // Medications
      (data.medications || []).forEach((m) => {
        if (m.medication_name.toLowerCase().includes(trimmed)) {
          matchedMeds.push({
            medication: m.medication_name,
            dose: m.dose,
            patient: data.patient?.patient_name || 'Unnamed',
            documentId: rec.documentId,
          });
        }
      });
      // Lab
      (data.laboratory || []).forEach((lab) => {
        if (lab.test_name.toLowerCase().includes(trimmed)) {
          matchedLabs.push({
            test: lab.test_name,
            result: lab.result,
            unit: lab.unit,
            patient: data.patient?.patient_name || 'Unnamed',
            documentId: rec.documentId,
          });
        }
      });
    });
  }

  const totalResults =
    matchedPatients.length +
    matchedDocuments.length +
    matchedDiagnoses.length +
    matchedMeds.length +
    matchedLabs.length;

  return (
    <div className="p-6 md:p-8 space-y-6 max-w-7xl mx-auto">
      <div>
        <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">Global Clinical Search</h1>
        <p className="text-xs text-slate-500">
          Search across patient IDs, names, diagnoses, lab investigations, medications, and raw OCR text.
        </p>
      </div>

      {/* Main Search Input */}
      <div className="p-3 bg-white rounded-2xl border border-slate-200 shadow-xs flex items-center gap-3">
        <SearchIcon className="w-5 h-5 text-teal-700 ml-2 shrink-0" />
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Try searching 'hypertension', 'Adeleke', 'UH-00125', 'docTR', 'Amlodipine', 'Glucose'..."
          className="w-full text-sm bg-transparent focus:outline-none text-slate-900 font-medium placeholder-slate-400"
        />
        {query && (
          <button
            onClick={() => setQuery('')}
            className="px-2.5 py-1 rounded bg-slate-100 text-xs font-semibold text-slate-600 hover:bg-slate-200"
          >
            Clear
          </button>
        )}
      </div>

      {query.trim() === '' ? (
        <div className="p-12 text-center text-xs text-slate-500">
          Enter a clinical term, patient identifier, or document ID above.
        </div>
      ) : totalResults === 0 ? (
        <div className="p-12 bg-white rounded-2xl border border-slate-200 text-center text-xs text-slate-500">
          No matching records found for "{query}".
        </div>
      ) : (
        <div className="space-y-6">
          {/* Patients Results */}
          {matchedPatients.length > 0 && (
            <div className="p-5 bg-white rounded-2xl border border-slate-200 shadow-xs space-y-3">
              <div className="flex items-center gap-2">
                <User className="w-4 h-4 text-teal-700" />
                <h3 className="text-xs font-bold text-slate-900 uppercase">
                  Matching Patients ({matchedPatients.length})
                </h3>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {matchedPatients.map((p) => (
                  <div
                    key={p.hospitalNumber}
                    onClick={() => onNavigate(`/patients`)}
                    className="p-3 rounded-xl border border-slate-200 bg-slate-50 hover:bg-teal-50/50 cursor-pointer transition-all flex items-center justify-between"
                  >
                    <div>
                      <div className="font-bold text-xs text-slate-900">{p.name}</div>
                      <div className="text-[11px] font-mono text-teal-800">MRN: {p.hospitalNumber}</div>
                    </div>
                    <ArrowRight className="w-4 h-4 text-slate-400" />
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Diagnoses Results */}
          {matchedDiagnoses.length > 0 && (
            <div className="p-5 bg-white rounded-2xl border border-slate-200 shadow-xs space-y-3">
              <div className="flex items-center gap-2">
                <Activity className="w-4 h-4 text-indigo-700" />
                <h3 className="text-xs font-bold text-slate-900 uppercase">
                  Matching Diagnoses ({matchedDiagnoses.length})
                </h3>
              </div>
              <div className="divide-y divide-slate-100 text-xs">
                {matchedDiagnoses.map((dx, i) => (
                  <div key={i} className="py-2.5 flex items-center justify-between">
                    <div>
                      <span className="font-bold text-slate-900">{dx.diagnosis}</span>
                      <span className="text-slate-500 ml-2">
                        Patient: {dx.patient} (MRN: {dx.hospNo}) • {dx.date}
                      </span>
                    </div>
                    <button
                      onClick={() => onNavigate(`/documents/${dx.documentId}`)}
                      className="text-teal-700 font-semibold hover:underline text-[11px]"
                    >
                      {dx.documentId}
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Documents Results */}
          {matchedDocuments.length > 0 && (
            <div className="p-5 bg-white rounded-2xl border border-slate-200 shadow-xs space-y-3">
              <div className="flex items-center gap-2">
                <FileText className="w-4 h-4 text-slate-700" />
                <h3 className="text-xs font-bold text-slate-900 uppercase">
                  Matching Hospital Documents ({matchedDocuments.length})
                </h3>
              </div>
              <div className="divide-y divide-slate-100 text-xs">
                {matchedDocuments.map((doc) => (
                  <div key={doc.id} className="py-2.5 flex items-center justify-between">
                    <div>
                      <span className="font-mono font-bold text-slate-900">{doc.id}</span>
                      <span className="text-slate-600 ml-2">{doc.filename}</span>
                    </div>
                    <button
                      onClick={() => onNavigate(`/documents/${doc.id}`)}
                      className="text-teal-700 font-semibold hover:underline"
                    >
                      View Document OCR
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Medications Results */}
          {matchedMeds.length > 0 && (
            <div className="p-5 bg-white rounded-2xl border border-slate-200 shadow-xs space-y-3">
              <div className="flex items-center gap-2">
                <Pill className="w-4 h-4 text-amber-600" />
                <h3 className="text-xs font-bold text-slate-900 uppercase">
                  Prescriptions ({matchedMeds.length})
                </h3>
              </div>
              <div className="divide-y divide-slate-100 text-xs">
                {matchedMeds.map((m, i) => (
                  <div key={i} className="py-2 flex items-center justify-between">
                    <div>
                      <span className="font-bold text-slate-900">{m.medication}</span>
                      <span className="text-slate-500 ml-2">{m.dose} • Patient: {m.patient}</span>
                    </div>
                    <button
                      onClick={() => onNavigate(`/documents/${m.documentId}`)}
                      className="text-teal-700 font-semibold hover:underline text-[11px]"
                    >
                      {m.documentId}
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
