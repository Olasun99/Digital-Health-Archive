import React, { useState, useEffect } from 'react';
import {
  FileCheck2,
  CheckCircle2,
  XCircle,
  RotateCcw,
  Edit3,
  Save,
  AlertTriangle,
  FileText,
  User,
  Activity,
  Heart,
  FlaskConical,
  Pill,
  Clock,
  Sparkles,
  ArrowLeft,
  ShieldCheck,
  Check,
  ChevronDown,
  Info
} from 'lucide-react';
import {
  storageService,
  StoredHealthRecord,
  StoredDocument,
  HumanCorrection
} from '../services/storageService';
import { ClinicalExtractionResult } from '../services/geminiExtraction';

interface ReviewViewProps {
  documentId?: string;
  onNavigate: (path: string) => void;
}

export const ReviewView: React.FC<ReviewViewProps> = ({ documentId, onNavigate }) => {
  const [allRecords, setAllRecords] = useState<StoredHealthRecord[]>([]);
  const [selectedRecord, setSelectedRecord] = useState<StoredHealthRecord | null>(null);
  const [associatedDoc, setAssociatedDoc] = useState<StoredDocument | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [editableData, setEditableData] = useState<ClinicalExtractionResult | null>(null);
  const [reviewerName, setReviewerName] = useState('Records Officer (A. Musa)');
  const [saveSuccess, setSaveSuccess] = useState(false);

  useEffect(() => {
    loadRecords();
    const handleUpdate = () => loadRecords();
    window.addEventListener('hai_data_updated', handleUpdate);
    return () => window.removeEventListener('hai_data_updated', handleUpdate);
  }, [documentId]);

  const loadRecords = () => {
    const list = storageService.getRecords();
    setAllRecords(list);

    if (documentId) {
      const match = list.find((r) => r.documentId === documentId);
      if (match) {
        setSelectedRecord(match);
        setEditableData(JSON.parse(JSON.stringify(match.reviewedData || match.extractedData)));
        const doc = storageService.getDocumentById(match.documentId);
        if (doc) setAssociatedDoc(doc);
      }
    } else if (list.length > 0) {
      // Pick first record requiring review or any record
      const underReview = list.find((r) => r.status === 'under_review') || list[0];
      setSelectedRecord(underReview);
      setEditableData(JSON.parse(JSON.stringify(underReview.reviewedData || underReview.extractedData)));
      const doc = storageService.getDocumentById(underReview.documentId);
      if (doc) setAssociatedDoc(doc);
    }
  };

  const handleSelectRecord = (rec: StoredHealthRecord) => {
    setSelectedRecord(rec);
    setEditableData(JSON.parse(JSON.stringify(rec.reviewedData || rec.extractedData)));
    const doc = storageService.getDocumentById(rec.documentId);
    if (doc) setAssociatedDoc(doc);
    setIsEditing(false);
  };

  /**
   * Save human corrections and update record status
   */
  const handleUpdateField = (section: string, field: string, value: any) => {
    if (!editableData) return;
    const updated = { ...editableData };
    (updated as any)[section][field] = value;
    setEditableData(updated);
  };

  const handleSaveCorrections = (newStatus: 'under_review' | 'approved' | 'rejected' | 'send_back') => {
    if (!selectedRecord || !editableData) return;

    // Detect diffs between original AI extraction and human reviewed values
    const newCorrections: HumanCorrection[] = [...selectedRecord.corrections];
    const original = selectedRecord.extractedData;

    // Check patient diffs
    if (original.patient?.patient_name !== editableData.patient?.patient_name) {
      newCorrections.push({
        fieldPath: 'patient.patient_name',
        originalValue: original.patient?.patient_name,
        correctedValue: editableData.patient?.patient_name,
        reviewer: reviewerName,
        timestamp: new Date().toLocaleString(),
      });
    }

    if (original.patient?.hospital_number !== editableData.patient?.hospital_number) {
      newCorrections.push({
        fieldPath: 'patient.hospital_number',
        originalValue: original.patient?.hospital_number,
        correctedValue: editableData.patient?.hospital_number,
        reviewer: reviewerName,
        timestamp: new Date().toLocaleString(),
      });
    }

    if (original.patient?.age !== editableData.patient?.age) {
      newCorrections.push({
        fieldPath: 'patient.age',
        originalValue: original.patient?.age,
        correctedValue: editableData.patient?.age,
        reviewer: reviewerName,
        timestamp: new Date().toLocaleString(),
      });
    }

    const updatedRecord: StoredHealthRecord = {
      ...selectedRecord,
      reviewedData: editableData,
      status: newStatus,
      reviewedBy: reviewerName,
      reviewedAt: new Date().toLocaleString(),
      corrections: newCorrections,
      hospitalNumber: editableData.patient?.hospital_number || selectedRecord.hospitalNumber,
      patientId: editableData.patient?.hospital_number || selectedRecord.patientId,
    };

    storageService.saveRecord(updatedRecord);
    setSelectedRecord(updatedRecord);
    setIsEditing(false);
    setSaveSuccess(true);
    setTimeout(() => setSaveSuccess(false), 3000);
  };

  return (
    <div className="p-6 md:p-8 space-y-6 max-w-7xl mx-auto">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">
            Human Verification Workspace
          </h1>
          <p className="text-xs text-slate-500">
            Mandatory clinical review layer: AI suggests, rules validate, authorized staff approve.
          </p>
        </div>

        {/* Verification Progress Tracker */}
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-teal-50 border border-teal-200 text-xs font-semibold text-teal-900">
            <span>AI Extraction</span>
            <span className="text-teal-400">→</span>
            <span className="text-amber-700 font-bold">Human Review</span>
            <span className="text-teal-400">→</span>
            <span className="text-emerald-700">Approved Record</span>
          </div>
        </div>
      </div>

      {allRecords.length === 0 ? (
        <div className="p-12 bg-white rounded-2xl border border-slate-200 text-center space-y-3">
          <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center text-slate-400 mx-auto">
            <FileCheck2 className="w-6 h-6" />
          </div>
          <p className="text-sm font-semibold text-slate-800">No records currently pending human verification.</p>
          <p className="text-xs text-slate-500">
            Extract clinical information from an ingested document in the archive to begin review.
          </p>
          <button
            onClick={() => onNavigate('/archive')}
            className="mt-2 px-4 py-2 rounded-lg bg-[#0F4C5C] text-white text-xs font-semibold hover:bg-[#0c3c49]"
          >
            Explore Archive
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Left Column: Review Queue List */}
          <div className="lg:col-span-4 space-y-4">
            <div className="p-4 bg-white rounded-2xl border border-slate-200 shadow-xs space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                  Review Queue ({allRecords.length})
                </h3>
                <span className="text-[10px] text-slate-400">Select document to verify</span>
              </div>

              <div className="space-y-2 max-h-[600px] overflow-y-auto pr-1">
                {allRecords.map((rec) => {
                  const isSelected = selectedRecord?.id === rec.id;
                  const patName = rec.reviewedData?.patient?.patient_name || rec.extractedData.patient?.patient_name || 'Unnamed';
                  const hospNo = rec.reviewedData?.patient?.hospital_number || rec.extractedData.patient?.hospital_number || 'No MRN';

                  return (
                    <div
                      key={rec.id}
                      onClick={() => handleSelectRecord(rec)}
                      className={`p-3 rounded-xl border text-xs cursor-pointer transition-all ${
                        isSelected
                          ? 'border-teal-500 bg-teal-50/50 shadow-xs ring-1 ring-teal-500'
                          : 'border-slate-200 bg-slate-50/60 hover:bg-white hover:border-slate-300'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-mono font-bold text-slate-900">{rec.documentId}</span>
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                            rec.status === 'approved'
                              ? 'bg-emerald-100 text-emerald-800'
                              : rec.status === 'under_review'
                              ? 'bg-amber-100 text-amber-800'
                              : 'bg-rose-100 text-rose-800'
                          }`}
                        >
                          {rec.status === 'approved' ? 'Approved' : 'Review Required'}
                        </span>
                      </div>

                      <div className="mt-1 font-semibold text-slate-800">{patName}</div>
                      <div className="text-[11px] text-slate-500">Hosp No: {hospNo}</div>
                      <div className="mt-1 text-[10px] text-slate-400">Extracted: {rec.extractedAt.slice(0, 16)}</div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Right Column: Interactive Verification Workspace */}
          {selectedRecord && editableData && (
            <div className="lg:col-span-8 space-y-5">
              {/* Mandatory AI Verification Disclaimer Banner */}
              <div className="p-4 rounded-xl bg-amber-50 border border-amber-300 flex items-start justify-between gap-3 shadow-xs">
                <div className="flex items-start gap-2.5">
                  <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                  <div className="space-y-0.5 text-xs text-amber-950">
                    <span className="font-bold">
                      AI-generated — Requires human verification before digital health registry commit.
                    </span>
                    <p className="text-amber-800">
                      Do not imply that AI extraction is automatically medically authoritative. Every clinical field
                      must be reviewed against source document {selectedRecord.documentId}.
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setIsEditing(!isEditing)}
                  className="px-3 py-1 rounded-lg bg-white border border-amber-300 text-xs font-semibold text-amber-900 hover:bg-amber-100 transition-colors shrink-0 flex items-center gap-1.5"
                >
                  <Edit3 className="w-3.5 h-3.5" />
                  <span>{isEditing ? 'Cancel Edit' : 'Edit Fields'}</span>
                </button>
              </div>

              {saveSuccess && (
                <div className="p-3 rounded-lg bg-emerald-50 border border-emerald-300 text-emerald-800 text-xs flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                  <span>Record verification successfully updated and logged in clinical registry.</span>
                </div>
              )}

              {/* Patient Identification Card */}
              <div className="p-5 rounded-2xl bg-white border border-slate-200 shadow-xs space-y-4">
                <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                  <div className="flex items-center gap-2">
                    <User className="w-4 h-4 text-teal-700" />
                    <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                      Patient Identification & Demographics
                    </h3>
                  </div>
                  <span className="text-[11px] font-mono text-slate-400">
                    Source: {selectedRecord.documentId}
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
                  <div>
                    <label className="text-[11px] font-semibold text-slate-500 uppercase">Patient Name</label>
                    {isEditing ? (
                      <input
                        type="text"
                        value={editableData.patient.patient_name || ''}
                        onChange={(e) => handleUpdateField('patient', 'patient_name', e.target.value)}
                        className="w-full mt-1 px-3 py-1.5 rounded-lg border border-slate-300 text-xs font-medium focus:ring-1 focus:ring-teal-500"
                      />
                    ) : (
                      <div className="mt-1 font-bold text-slate-900 text-sm">
                        {editableData.patient.patient_name || <span className="text-slate-400 italic">Unidentified</span>}
                      </div>
                    )}
                  </div>

                  <div>
                    <label className="text-[11px] font-semibold text-slate-500 uppercase">Hospital Number (MRN)</label>
                    {isEditing ? (
                      <input
                        type="text"
                        value={editableData.patient.hospital_number || ''}
                        onChange={(e) => handleUpdateField('patient', 'hospital_number', e.target.value)}
                        className="w-full mt-1 px-3 py-1.5 rounded-lg border border-slate-300 text-xs font-medium focus:ring-1 focus:ring-teal-500"
                      />
                    ) : (
                      <div className="mt-1 font-mono font-bold text-teal-800 text-sm">
                        {editableData.patient.hospital_number || <span className="text-slate-400 italic">None</span>}
                      </div>
                    )}
                  </div>

                  <div>
                    <label className="text-[11px] font-semibold text-slate-500 uppercase">Age / Sex</label>
                    {isEditing ? (
                      <div className="flex gap-2 mt-1">
                        <input
                          type="text"
                          placeholder="Age"
                          value={editableData.patient.age || ''}
                          onChange={(e) => handleUpdateField('patient', 'age', e.target.value)}
                          className="w-1/2 px-2 py-1.5 rounded-lg border border-slate-300 text-xs"
                        />
                        <select
                          value={editableData.patient.sex || ''}
                          onChange={(e) => handleUpdateField('patient', 'sex', e.target.value as any)}
                          className="w-1/2 px-2 py-1.5 rounded-lg border border-slate-300 text-xs"
                        >
                          <option value="">Select</option>
                          <option value="Male">Male</option>
                          <option value="Female">Female</option>
                          <option value="Other">Other</option>
                        </select>
                      </div>
                    ) : (
                      <div className="mt-1 font-medium text-slate-800">
                        {editableData.patient.age ? `${editableData.patient.age} yrs` : 'Age: —'} •{' '}
                        {editableData.patient.sex || '—'}
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Encounter & Clinical Diagnoses Card */}
              <div className="p-5 rounded-2xl bg-white border border-slate-200 shadow-xs space-y-4">
                <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                  <div className="flex items-center gap-2">
                    <Activity className="w-4 h-4 text-indigo-700" />
                    <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                      Encounter & Clinical Diagnoses
                    </h3>
                  </div>
                  <span className="text-[11px] text-slate-500">
                    Date: {editableData.encounter.encounter_date || 'Unknown'} • Dept: {editableData.encounter.department || '—'}
                  </span>
                </div>

                <div className="space-y-3 text-xs">
                  <div>
                    <label className="text-[11px] font-semibold text-slate-500 uppercase">Chief Complaint</label>
                    <p className="mt-1 text-slate-800 font-medium">
                      {editableData.clinical_information.chief_complaint || <span className="text-slate-400 italic">None stated</span>}
                    </p>
                  </div>

                  <div>
                    <label className="text-[11px] font-semibold text-slate-500 uppercase">Explicit Diagnoses</label>
                    <div className="mt-1 flex flex-wrap gap-2">
                      {editableData.clinical_information.diagnoses && editableData.clinical_information.diagnoses.length > 0 ? (
                        editableData.clinical_information.diagnoses.map((dx, i) => (
                          <span
                            key={i}
                            className="px-2.5 py-1 rounded-lg bg-teal-50 border border-teal-200 text-teal-900 font-semibold text-xs"
                          >
                            {dx}
                          </span>
                        ))
                      ) : (
                        <span className="text-slate-400 italic">No formal diagnosis documented</span>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* Vital Signs Grid */}
              <div className="p-5 rounded-2xl bg-white border border-slate-200 shadow-xs space-y-3">
                <div className="flex items-center gap-2 border-b border-slate-100 pb-2">
                  <Heart className="w-4 h-4 text-rose-600" />
                  <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                    Vital Signs
                  </h3>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                  <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-100">
                    <span className="text-[10px] text-slate-500 uppercase">Blood Pressure</span>
                    <div className="font-bold text-slate-900 mt-0.5">
                      {editableData.vital_signs.blood_pressure || '—'}
                    </div>
                  </div>
                  <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-100">
                    <span className="text-[10px] text-slate-500 uppercase">Heart Rate</span>
                    <div className="font-bold text-slate-900 mt-0.5">
                      {editableData.vital_signs.heart_rate || '—'}
                    </div>
                  </div>
                  <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-100">
                    <span className="text-[10px] text-slate-500 uppercase">Temperature</span>
                    <div className="font-bold text-slate-900 mt-0.5">
                      {editableData.vital_signs.temperature || '—'}
                    </div>
                  </div>
                  <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-100">
                    <span className="text-[10px] text-slate-500 uppercase">Weight</span>
                    <div className="font-bold text-slate-900 mt-0.5">
                      {editableData.vital_signs.weight || '—'}
                    </div>
                  </div>
                </div>
              </div>

              {/* Prescribed Medications */}
              {editableData.medications && editableData.medications.length > 0 && (
                <div className="p-5 rounded-2xl bg-white border border-slate-200 shadow-xs space-y-3">
                  <div className="flex items-center gap-2 border-b border-slate-100 pb-2">
                    <Pill className="w-4 h-4 text-amber-600" />
                    <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                      Prescribed Medications
                    </h3>
                  </div>

                  <div className="divide-y divide-slate-100 text-xs">
                    {editableData.medications.map((m, idx) => (
                      <div key={idx} className="py-2 flex items-center justify-between">
                        <div>
                          <span className="font-bold text-slate-900">{m.medication_name}</span>
                          <span className="text-slate-500 ml-2">{m.dose} • {m.frequency}</span>
                        </div>
                        <span className="text-[11px] text-slate-400 font-mono">{m.duration || 'Standard course'}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Laboratory Investigations */}
              {editableData.laboratory && editableData.laboratory.length > 0 && (
                <div className="p-5 rounded-2xl bg-white border border-slate-200 shadow-xs space-y-3">
                  <div className="flex items-center gap-2 border-b border-slate-100 pb-2">
                    <FlaskConical className="w-4 h-4 text-teal-600" />
                    <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                      Laboratory Investigations
                    </h3>
                  </div>

                  <div className="divide-y divide-slate-100 text-xs">
                    {editableData.laboratory.map((lab, idx) => (
                      <div key={idx} className="py-2 flex items-center justify-between">
                        <div>
                          <span className="font-bold text-slate-900">{lab.test_name}</span>
                          <span className="text-slate-500 ml-2">Ref: {lab.reference_range || '—'}</span>
                        </div>
                        <span className="font-mono font-bold text-teal-800">
                          {lab.result} {lab.unit || ''}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Data Provenance & Traceability Panel */}
              <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 text-xs space-y-2">
                <div className="flex items-center justify-between font-semibold text-slate-700">
                  <span className="flex items-center gap-1.5">
                    <ShieldCheck className="w-4 h-4 text-teal-600" /> Source Provenance Traceability
                  </span>
                  <span className="font-mono text-slate-500">{selectedRecord.documentId} (Page 1)</span>
                </div>
                <div className="text-[11px] text-slate-500 leading-relaxed">
                  Every structured value is traceable directly back to original docTR OCR bounding coordinates.
                  {selectedRecord.corrections.length > 0 && (
                    <div className="mt-2 pt-2 border-t border-slate-200 text-amber-900">
                      <strong>Audit Trail:</strong> {selectedRecord.corrections.length} field corrections recorded by {selectedRecord.reviewedBy || 'Reviewer'}.
                    </div>
                  )}
                </div>
              </div>

              {/* Human Review Decision Actions */}
              <div className="p-5 rounded-2xl bg-white border border-slate-200 shadow-xs flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2 text-xs">
                  <span className="text-slate-500">Reviewer ID:</span>
                  <input
                    type="text"
                    value={reviewerName}
                    onChange={(e) => setReviewerName(e.target.value)}
                    className="px-2.5 py-1 rounded border border-slate-200 text-xs font-medium text-slate-800"
                  />
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleSaveCorrections('rejected')}
                    className="px-3 py-1.5 rounded-lg border border-rose-300 text-rose-700 hover:bg-rose-50 text-xs font-semibold cursor-pointer"
                  >
                    Reject Record
                  </button>
                  <button
                    onClick={() => handleSaveCorrections('send_back')}
                    className="px-3 py-1.5 rounded-lg border border-slate-300 text-slate-700 hover:bg-slate-50 text-xs font-semibold cursor-pointer"
                  >
                    Send Back for Review
                  </button>
                  <button
                    onClick={() => handleSaveCorrections('approved')}
                    className="px-5 py-2 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold shadow-xs flex items-center gap-1.5 cursor-pointer"
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    <span>Approve & Verify Record</span>
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
