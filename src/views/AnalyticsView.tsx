import React, { useState, useEffect } from 'react';
import { BarChart3, Users, FileText, FlaskConical, Pill, Activity, AlertCircle } from 'lucide-react';
import { storageService, StoredHealthRecord, StoredDocument } from '../services/storageService';

export const AnalyticsView: React.FC = () => {
  const [documents, setDocuments] = useState<StoredDocument[]>([]);
  const [records, setRecords] = useState<StoredHealthRecord[]>([]);

  useEffect(() => {
    setDocuments(storageService.getDocuments());
    setRecords(storageService.getRecords());
  }, []);

  const totalPatients = storageService.getPatients().length;
  const totalEncounters = records.length;
  const processedDocs = documents.filter((d) => d.status === 'Completed').length;

  // Aggregate diagnoses
  const diagnosisCounts: Record<string, number> = {};
  let totalDiagnoses = 0;
  let totalLabs = 0;
  let totalMeds = 0;

  // Document types
  const docTypeCounts: Record<string, number> = {};

  records.forEach((rec) => {
    const data = rec.reviewedData || rec.extractedData;
    const docType = data.document_metadata?.document_type || 'Unclassified';
    docTypeCounts[docType] = (docTypeCounts[docType] || 0) + 1;

    (data.clinical_information.diagnoses || []).forEach((dx) => {
      totalDiagnoses++;
      diagnosisCounts[dx] = (diagnosisCounts[dx] || 0) + 1;
    });

    totalLabs += (data.laboratory || []).length;
    totalMeds += (data.medications || []).length;
  });

  const topDiagnoses = Object.entries(diagnosisCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5);

  const docTypesList = Object.entries(docTypeCounts);

  return (
    <div className="p-6 md:p-8 space-y-6 max-w-7xl mx-auto">
      <div>
        <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">Clinical Archive Analytics</h1>
        <p className="text-xs text-slate-500">
          Population health indicators and archive digitization throughput calculated purely from stored structured data.
        </p>
      </div>

      {/* Metrics Row */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
        <div className="p-4 rounded-xl bg-white border border-slate-200 shadow-xs">
          <span className="text-[10px] font-semibold text-slate-500 uppercase">Total Patients</span>
          <div className="text-2xl font-bold text-slate-900 mt-1">{totalPatients}</div>
        </div>
        <div className="p-4 rounded-xl bg-white border border-slate-200 shadow-xs">
          <span className="text-[10px] font-semibold text-slate-500 uppercase">Documents Ingested</span>
          <div className="text-2xl font-bold text-teal-800 mt-1">{processedDocs}</div>
        </div>
        <div className="p-4 rounded-xl bg-white border border-slate-200 shadow-xs">
          <span className="text-[10px] font-semibold text-slate-500 uppercase">Encounters</span>
          <div className="text-2xl font-bold text-indigo-800 mt-1">{totalEncounters}</div>
        </div>
        <div className="p-4 rounded-xl bg-white border border-slate-200 shadow-xs">
          <span className="text-[10px] font-semibold text-slate-500 uppercase">Diagnoses</span>
          <div className="text-2xl font-bold text-slate-900 mt-1">{totalDiagnoses}</div>
        </div>
        <div className="p-4 rounded-xl bg-white border border-slate-200 shadow-xs">
          <span className="text-[10px] font-semibold text-slate-500 uppercase">Lab Tests</span>
          <div className="text-2xl font-bold text-teal-800 mt-1">{totalLabs}</div>
        </div>
        <div className="p-4 rounded-xl bg-white border border-slate-200 shadow-xs">
          <span className="text-[10px] font-semibold text-slate-500 uppercase">Prescriptions</span>
          <div className="text-2xl font-bold text-amber-700 mt-1">{totalMeds}</div>
        </div>
      </div>

      {records.length === 0 ? (
        <div className="p-12 bg-white rounded-2xl border border-slate-200 text-center space-y-2">
          <BarChart3 className="w-10 h-10 text-slate-300 mx-auto" />
          <p className="text-sm font-semibold text-slate-800">Not enough structured data to generate analytics.</p>
          <p className="text-xs text-slate-500">
            Analytics populate automatically as clinical documents are extracted and approved.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Top Diagnoses Chart / Bar representation */}
          <div className="p-6 rounded-2xl bg-white border border-slate-200 shadow-xs space-y-4">
            <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
              Most Frequently Recorded Diagnoses
            </h3>

            {topDiagnoses.length === 0 ? (
              <p className="text-xs text-slate-400 italic">Not enough data for this visualization.</p>
            ) : (
              <div className="space-y-3">
                {topDiagnoses.map(([dx, count]) => {
                  const percent = Math.min(100, Math.round((count / totalDiagnoses) * 100));
                  return (
                    <div key={dx} className="space-y-1 text-xs">
                      <div className="flex justify-between font-medium text-slate-800">
                        <span>{dx}</span>
                        <span className="font-bold text-teal-800">{count} ({percent}%)</span>
                      </div>
                      <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden">
                        <div
                          className="bg-teal-600 h-2 rounded-full transition-all"
                          style={{ width: `${percent}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Document Types Distribution */}
          <div className="p-6 rounded-2xl bg-white border border-slate-200 shadow-xs space-y-4">
            <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
              Document Categories Extracted
            </h3>

            {docTypesList.length === 0 ? (
              <p className="text-xs text-slate-400 italic">Not enough data for this visualization.</p>
            ) : (
              <div className="space-y-3">
                {docTypesList.map(([type, count]) => {
                  const percent = Math.min(100, Math.round((count / records.length) * 100));
                  return (
                    <div key={type} className="space-y-1 text-xs">
                      <div className="flex justify-between font-medium text-slate-800">
                        <span>{type}</span>
                        <span className="font-bold text-slate-900">{count} ({percent}%)</span>
                      </div>
                      <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden">
                        <div
                          className="bg-slate-800 h-2 rounded-full transition-all"
                          style={{ width: `${percent}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
