import React, { useState, useEffect } from 'react';
import { CalendarCheck, Eye, Search, FileText } from 'lucide-react';
import { storageService, StoredHealthRecord } from '../services/storageService';

interface EncountersViewProps {
  onNavigate: (path: string) => void;
}

export const EncountersView: React.FC<EncountersViewProps> = ({ onNavigate }) => {
  const [records, setRecords] = useState<StoredHealthRecord[]>([]);
  const [search, setSearch] = useState('');

  useEffect(() => {
    setRecords(storageService.getRecords());
  }, []);

  const encountersList = records.map((rec) => {
    const data = rec.reviewedData || rec.extractedData;
    return {
      recordId: rec.id,
      documentId: rec.documentId,
      patientName: data.patient?.patient_name || 'Unnamed',
      hospitalNumber: data.patient?.hospital_number || '—',
      date: data.encounter?.encounter_date || rec.extractedAt.slice(0, 10),
      type: data.encounter?.encounter_type || 'Outpatient',
      department: data.encounter?.department || 'General',
      clinician: data.encounter?.attending_clinician || '—',
      diagnoses: data.clinical_information.diagnoses?.join(', ') || '—',
    };
  });

  const filtered = encountersList.filter((enc) => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (
      enc.patientName.toLowerCase().includes(q) ||
      enc.hospitalNumber.toLowerCase().includes(q) ||
      enc.department.toLowerCase().includes(q) ||
      enc.diagnoses.toLowerCase().includes(q)
    );
  });

  return (
    <div className="p-6 md:p-8 space-y-6 max-w-7xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">Clinical Encounters</h1>
          <p className="text-xs text-slate-500">
            Chronological register of outpatient visits, admissions, and consultations from paper archives.
          </p>
        </div>
      </div>

      <div className="p-4 rounded-xl bg-white border border-slate-200 shadow-xs flex items-center">
        <Search className="w-4 h-4 text-slate-400 mr-2" />
        <input
          type="text"
          placeholder="Search encounters by patient name, MRN, department, or diagnosis..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full text-xs bg-transparent focus:outline-none text-slate-800"
        />
      </div>

      <div className="p-6 rounded-2xl bg-white border border-slate-200 shadow-xs">
        {filtered.length === 0 ? (
          <div className="py-12 text-center text-slate-500 text-xs">
            No clinical encounters recorded yet.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-500 font-semibold border-b border-slate-200">
                <tr>
                  <th className="py-3 px-4">Date</th>
                  <th className="py-3 px-4">Patient</th>
                  <th className="py-3 px-4">Hosp No</th>
                  <th className="py-3 px-4">Encounter Type</th>
                  <th className="py-3 px-4">Department</th>
                  <th className="py-3 px-4">Clinician</th>
                  <th className="py-3 px-4">Diagnoses</th>
                  <th className="py-3 px-4 text-right">Source</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filtered.map((enc) => (
                  <tr key={enc.recordId} className="hover:bg-slate-50">
                    <td className="py-3 px-4 font-semibold text-slate-900">{enc.date}</td>
                    <td className="py-3 px-4 font-medium text-slate-800">{enc.patientName}</td>
                    <td className="py-3 px-4 font-mono text-teal-800">{enc.hospitalNumber}</td>
                    <td className="py-3 px-4">
                      <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-700 font-medium">
                        {enc.type}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-slate-600">{enc.department}</td>
                    <td className="py-3 px-4 text-slate-600">{enc.clinician}</td>
                    <td className="py-3 px-4 font-medium text-slate-800">{enc.diagnoses}</td>
                    <td className="py-3 px-4 text-right">
                      <button
                        onClick={() => onNavigate(`/documents/${enc.documentId}`)}
                        className="text-teal-700 font-semibold hover:underline"
                      >
                        {enc.documentId}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
