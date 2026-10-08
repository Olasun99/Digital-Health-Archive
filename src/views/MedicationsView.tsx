import React, { useState, useEffect } from 'react';
import { Pill, Search } from 'lucide-react';
import { storageService, StoredHealthRecord } from '../services/storageService';

interface MedicationsViewProps {
  onNavigate: (path: string) => void;
}

export const MedicationsView: React.FC<MedicationsViewProps> = ({ onNavigate }) => {
  const [medRows, setMedRows] = useState<any[]>([]);
  const [search, setSearch] = useState('');

  useEffect(() => {
    const records = storageService.getRecords();
    const rows: any[] = [];

    records.forEach((rec) => {
      const data = rec.reviewedData || rec.extractedData;
      const meds = data.medications || [];
      const patName = data.patient?.patient_name || 'Unnamed';
      const hospNo = data.patient?.hospital_number || '—';
      const encDate = data.encounter?.encounter_date || rec.extractedAt.slice(0, 10);

      meds.forEach((m, idx) => {
        rows.push({
          id: `${rec.id}_med_${idx}`,
          date: encDate,
          patientName: patName,
          hospitalNumber: hospNo,
          medicationName: m.medication_name,
          dose: m.dose || '—',
          route: m.route || 'Oral',
          frequency: m.frequency || '—',
          duration: m.duration || '—',
          sourceDocumentId: rec.documentId,
        });
      });
    });

    setMedRows(rows);
  }, []);

  const filtered = medRows.filter((row) => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (
      row.medicationName.toLowerCase().includes(q) ||
      row.patientName.toLowerCase().includes(q) ||
      row.hospitalNumber.toLowerCase().includes(q)
    );
  });

  return (
    <div className="p-6 md:p-8 space-y-6 max-w-7xl mx-auto">
      <div>
        <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">Medication Records</h1>
        <p className="text-xs text-slate-500">
          Pharmaceutical prescriptions extracted and verified from hospital paper registers.
        </p>
      </div>

      <div className="p-4 rounded-xl bg-white border border-slate-200 shadow-xs flex items-center">
        <Search className="w-4 h-4 text-slate-400 mr-2" />
        <input
          type="text"
          placeholder="Search by drug name (e.g. Amlodipine, Lisinopril, Fansidar), patient, or MRN..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full text-xs bg-transparent focus:outline-none text-slate-800"
        />
      </div>

      <div className="p-6 rounded-2xl bg-white border border-slate-200 shadow-xs">
        {filtered.length === 0 ? (
          <div className="py-12 text-center text-slate-500 text-xs">
            No medication records extracted yet.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-500 font-semibold border-b border-slate-200">
                <tr>
                  <th className="py-3 px-4">Date</th>
                  <th className="py-3 px-4">Patient</th>
                  <th className="py-3 px-4">MRN</th>
                  <th className="py-3 px-4">Medication</th>
                  <th className="py-3 px-4">Dose</th>
                  <th className="py-3 px-4">Route</th>
                  <th className="py-3 px-4">Frequency</th>
                  <th className="py-3 px-4">Duration</th>
                  <th className="py-3 px-4 text-right">Source Document</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filtered.map((row) => (
                  <tr key={row.id} className="hover:bg-slate-50">
                    <td className="py-3 px-4 font-semibold text-slate-900">{row.date}</td>
                    <td className="py-3 px-4 font-medium text-slate-800">{row.patientName}</td>
                    <td className="py-3 px-4 font-mono text-teal-800">{row.hospitalNumber}</td>
                    <td className="py-3 px-4 font-bold text-slate-900">{row.medicationName}</td>
                    <td className="py-3 px-4 font-semibold text-slate-700">{row.dose}</td>
                    <td className="py-3 px-4 text-slate-600">{row.route}</td>
                    <td className="py-3 px-4 text-slate-600">{row.frequency}</td>
                    <td className="py-3 px-4 text-slate-500">{row.duration}</td>
                    <td className="py-3 px-4 text-right">
                      <button
                        onClick={() => onNavigate(`/documents/${row.sourceDocumentId}`)}
                        className="text-teal-700 font-semibold hover:underline"
                      >
                        {row.sourceDocumentId}
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
