import React, { useState, useEffect } from 'react';
import {
  Users,
  Search,
  Calendar,
  FileText,
  Clock,
  ArrowRight,
  User,
  Heart,
  Pill,
  FlaskConical,
  AlertTriangle,
  ChevronRight,
  ShieldAlert
} from 'lucide-react';
import { storageService, StoredPatient, StoredHealthRecord } from '../services/storageService';

interface PatientsViewProps {
  onNavigate: (path: string) => void;
  selectedPatientId?: string;
}

export const PatientsView: React.FC<PatientsViewProps> = ({ onNavigate, selectedPatientId }) => {
  const [patients, setPatients] = useState<StoredPatient[]>([]);
  const [activePatient, setActivePatient] = useState<StoredPatient | null>(null);
  const [patientRecords, setPatientRecords] = useState<StoredHealthRecord[]>([]);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    loadPatients();
    const handleUpdate = () => loadPatients();
    window.addEventListener('hai_data_updated', handleUpdate);
    return () => window.removeEventListener('hai_data_updated', handleUpdate);
  }, [selectedPatientId]);

  const loadPatients = () => {
    const list = storageService.getPatients();
    setPatients(list);

    if (selectedPatientId) {
      const match = list.find((p) => p.hospitalNumber === selectedPatientId);
      if (match) {
        selectPatient(match);
        return;
      }
    }

    if (list.length > 0 && !activePatient) {
      selectPatient(list[0]);
    }
  };

  const selectPatient = (p: StoredPatient) => {
    setActivePatient(p);
    const allRecords = storageService.getRecords();
    const recordsForPat = allRecords.filter(
      (r) =>
        r.hospitalNumber === p.hospitalNumber ||
        r.patientId === p.hospitalNumber ||
        p.recordIds.includes(r.id)
    );
    // Sort chronologically
    recordsForPat.sort((a, b) => {
      const dateA = a.reviewedData?.encounter?.encounter_date || a.extractedAt;
      const dateB = b.reviewedData?.encounter?.encounter_date || b.extractedAt;
      return dateA.localeCompare(dateB);
    });
    setPatientRecords(recordsForPat);
  };

  const filteredPatients = patients.filter((p) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      p.hospitalNumber.toLowerCase().includes(q) ||
      p.name.toLowerCase().includes(q) ||
      (p.address && p.address.toLowerCase().includes(q))
    );
  });

  return (
    <div className="p-6 md:p-8 space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">Patient Clinical Records</h1>
        <p className="text-xs text-slate-500">
          Unified longitudinal timelines linking multi-year paper archives across hospital departments.
        </p>
      </div>

      {patients.length === 0 ? (
        <div className="p-12 bg-white rounded-2xl border border-slate-200 text-center space-y-3">
          <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center text-slate-400 mx-auto">
            <Users className="w-6 h-6" />
          </div>
          <p className="text-sm font-semibold text-slate-800">No structured patient records available yet.</p>
          <p className="text-xs text-slate-500">
            Digitise and review hospital documents containing hospital numbers to create patient entities.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Patients Directory List */}
          <div className="lg:col-span-4 space-y-4">
            <div className="p-4 bg-white rounded-2xl border border-slate-200 shadow-xs space-y-3">
              <div className="relative">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Filter patients by MRN or name..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-9 pr-3 py-1.5 rounded-lg bg-slate-50 border border-slate-200 text-xs focus:ring-1 focus:ring-teal-500"
                />
              </div>

              <div className="space-y-2 max-h-[600px] overflow-y-auto pr-1">
                {filteredPatients.map((pat) => {
                  const isSelected = activePatient?.hospitalNumber === pat.hospitalNumber;
                  return (
                    <div
                      key={pat.hospitalNumber}
                      onClick={() => selectPatient(pat)}
                      className={`p-3 rounded-xl border text-xs cursor-pointer transition-all ${
                        isSelected
                          ? 'border-teal-500 bg-teal-50/50 shadow-xs ring-1 ring-teal-500'
                          : 'border-slate-200 bg-slate-50/50 hover:bg-white'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-mono font-bold text-teal-800">{pat.hospitalNumber}</span>
                        <span className="text-[10px] bg-slate-200 text-slate-700 px-1.5 py-0.5 rounded font-semibold">
                          {pat.documentIds.length} doc{pat.documentIds.length > 1 ? 's' : ''}
                        </span>
                      </div>
                      <div className="font-bold text-slate-900 mt-1">{pat.name}</div>
                      <div className="text-[11px] text-slate-500 mt-0.5">
                        {pat.age ? `${pat.age} yrs` : 'Age: —'} • {pat.sex || '—'}
                      </div>
                      <div className="text-[10px] text-slate-400 mt-1">
                        Timeline: {pat.firstSeen} to {pat.lastVisit}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Patient Timeline & Longitudinal Clinical Dossier */}
          {activePatient && (
            <div className="lg:col-span-8 space-y-5">
              {/* Patient Profile Card */}
              <div className="p-6 rounded-2xl bg-white border border-slate-200 shadow-xs space-y-4">
                <div className="flex flex-wrap items-start justify-between gap-4 border-b border-slate-100 pb-4">
                  <div className="flex items-start gap-3">
                    <div className="w-12 h-12 rounded-xl bg-teal-50 border border-teal-200 text-teal-800 flex items-center justify-center font-bold text-base">
                      {activePatient.name.slice(0, 2).toUpperCase()}
                    </div>
                    <div>
                      <h2 className="text-xl font-bold text-slate-900">{activePatient.name}</h2>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="font-mono text-xs font-bold text-teal-800 bg-teal-50 px-2 py-0.5 rounded border border-teal-200">
                          MRN: {activePatient.hospitalNumber}
                        </span>
                        <span className="text-xs text-slate-500">
                          {activePatient.sex} • {activePatient.age ? `${activePatient.age} Years Old` : 'Age: —'}
                        </span>
                      </div>
                      {activePatient.address && (
                        <p className="text-xs text-slate-500 mt-1">{activePatient.address}</p>
                      )}
                    </div>
                  </div>

                  <div className="text-right text-xs">
                    <span className="text-slate-400 block text-[10px] uppercase font-semibold">Digitised Archive</span>
                    <span className="text-slate-700 font-bold">{activePatient.documentIds.length} Linked Hospital Records</span>
                  </div>
                </div>

                {/* Longitudinal Clinical Timeline */}
                <div className="space-y-4 pt-2">
                  <div className="flex items-center justify-between">
                    <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
                      <Clock className="w-4 h-4 text-teal-700" /> Longitudinal Clinical Timeline
                    </h3>
                    <span className="text-[11px] text-slate-500">
                      Fragmented paper records unified into a chronological dossier
                    </span>
                  </div>

                  {patientRecords.length === 0 ? (
                    <div className="p-6 bg-slate-50 rounded-xl text-center text-xs text-slate-500">
                      No encounters recorded for this patient.
                    </div>
                  ) : (
                    <div className="relative pl-6 space-y-6 before:content-[''] before:absolute before:left-2 before:top-2 before:bottom-2 before:w-0.5 before:bg-teal-200">
                      {patientRecords.map((rec, idx) => {
                        const data = rec.reviewedData || rec.extractedData;
                        const enc = data.encounter;
                        const vitals = data.vital_signs;
                        const diagnoses = data.clinical_information.diagnoses || [];
                        const meds = data.medications || [];
                        const labs = data.laboratory || [];

                        return (
                          <div key={rec.id} className="relative group">
                            {/* Timeline Node Dot */}
                            <div className="absolute -left-6 top-1.5 w-3.5 h-3.5 rounded-full bg-teal-600 ring-4 ring-teal-100" />

                            <div className="p-4 rounded-xl bg-slate-50 hover:bg-white border border-slate-200 transition-all space-y-3 shadow-2xs">
                              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200/80 pb-2">
                                <div className="flex items-center gap-2">
                                  <span className="font-bold text-xs text-slate-900">
                                    {enc?.encounter_date || rec.extractedAt.slice(0, 10)}
                                  </span>
                                  <span className="px-2 py-0.5 rounded bg-slate-200 text-slate-700 text-[10px] font-semibold">
                                    {enc?.encounter_type || 'Clinical Encounter'}
                                  </span>
                                  <span className="text-[11px] text-slate-500">{enc?.department}</span>
                                </div>
                                <div className="flex items-center gap-2 text-xs">
                                  <span className="font-mono text-[10px] text-slate-400">{rec.documentId}</span>
                                  <button
                                    onClick={() => onNavigate(`/documents/${rec.documentId}`)}
                                    className="text-teal-700 font-semibold hover:underline text-[11px]"
                                  >
                                    View Source Scan
                                  </button>
                                </div>
                              </div>

                              {/* Clinical Diagnoses in encounter */}
                              {diagnoses.length > 0 && (
                                <div className="text-xs">
                                  <span className="text-[11px] text-slate-500 uppercase font-semibold">Diagnoses: </span>
                                  <span className="font-bold text-slate-900">{diagnoses.join(', ')}</span>
                                </div>
                              )}

                              {/* Vitals summary */}
                              {vitals && vitals.blood_pressure && (
                                <div className="flex items-center gap-3 text-xs text-slate-600">
                                  <span className="font-semibold text-slate-800">BP:</span> {vitals.blood_pressure}
                                  {vitals.heart_rate && <span>• Pulse: {vitals.heart_rate}</span>}
                                  {vitals.temperature && <span>• Temp: {vitals.temperature}</span>}
                                </div>
                              )}

                              {/* Meds in encounter */}
                              {meds.length > 0 && (
                                <div className="text-xs text-slate-600 flex items-center gap-1.5 flex-wrap">
                                  <Pill className="w-3.5 h-3.5 text-amber-600" />
                                  <span className="font-semibold text-slate-700">Prescribed:</span>
                                  {meds.map((m, mIdx) => (
                                    <span key={mIdx} className="bg-amber-50 border border-amber-200 px-1.5 py-0.5 rounded text-[10px] text-amber-900 font-medium">
                                      {m.medication_name} ({m.dose || ''})
                                    </span>
                                  ))}
                                </div>
                              )}

                              {/* Labs in encounter */}
                              {labs.length > 0 && (
                                <div className="text-xs text-slate-600 flex items-center gap-1.5 flex-wrap">
                                  <FlaskConical className="w-3.5 h-3.5 text-teal-600" />
                                  <span className="font-semibold text-slate-700">Investigations:</span>
                                  {labs.map((l, lIdx) => (
                                    <span key={lIdx} className="bg-teal-50 border border-teal-200 px-1.5 py-0.5 rounded text-[10px] text-teal-900 font-medium">
                                      {l.test_name}: {l.result} {l.unit || ''}
                                    </span>
                                  ))}
                                </div>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
