import React, { useEffect, useState } from 'react';
import {
  UploadCloud,
  FolderArchive,
  Cpu,
  FileCheck2,
  FileText,
  AlertCircle,
  Clock,
  ArrowRight,
  Database,
  Search,
  Sparkles,
  RefreshCw,
  ExternalLink,
  ChevronRight,
  Layers,
  Server,
  Network,
  Download,
  CalendarCheck,
  CheckCircle2
} from 'lucide-react';
import { ocrService, BackendStatsResponse } from '../services/ocrApi';
import { storageService, StoredDocument } from '../services/storageService';

interface DashboardViewProps {
  onNavigate: (path: string) => void;
  apiConnected: boolean;
}

export const DashboardView: React.FC<DashboardViewProps> = ({ onNavigate, apiConnected }) => {
  const [stats, setStats] = useState<BackendStatsResponse | null>(null);
  const [documents, setDocuments] = useState<StoredDocument[]>([]);
  const [loadingStats, setLoadingStats] = useState(false);

  useEffect(() => {
    loadData();
    const handleUpdate = () => loadData();
    window.addEventListener('hai_data_updated', handleUpdate);
    return () => window.removeEventListener('hai_data_updated', handleUpdate);
  }, [apiConnected]);

  const loadData = async () => {
    const storedDocs = storageService.getDocuments();
    setDocuments(storedDocs);

    if (apiConnected) {
      setLoadingStats(true);
      try {
        const res = await ocrService.getStats();
        setStats(res);
      } catch {
        // Fallback gracefully
      } finally {
        setLoadingStats(false);
      }
    }
  };

  const totalDocs = stats?.total_documents ?? (documents.length > 0 ? documents.length : 0);
  const processedDocs = stats?.processed ?? documents.filter((d) => d.status === 'Completed').length;
  const reviewRequired =
    stats?.review_required ??
    storageService.getRecords().filter((r) => r.status === 'under_review').length;
  const failedDocs = stats?.failed ?? documents.filter((d) => d.status === 'Failed').length;

  return (
    <div className="p-6 md:p-8 space-y-8 max-w-7xl mx-auto">
      {/* Visual Hero Section */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-[#0B192C] via-[#0F4C5C] to-[#072431] text-white p-8 md:p-10 shadow-lg border border-slate-800">
        <div className="relative z-10 max-w-3xl space-y-4">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-teal-500/20 border border-teal-400/30 text-teal-300 text-xs font-semibold">
            <Sparkles className="w-3.5 h-3.5 text-teal-300" />
            <span>AI-Powered Hospital Archive Digitisation & Health Intelligence</span>
          </div>

          <h1 className="text-3xl md:text-4xl font-extrabold tracking-tight text-white leading-tight">
            From Paper Archives to <span className="text-teal-300">Health Intelligence</span>
          </h1>

          <p className="text-sm md:text-base text-slate-300 leading-relaxed max-w-2xl">
            Convert paper-based clinical archives into searchable, structured health data.
            Transform decades of unsearchable physical records into linked patient dossiers, longitudinal timelines,
            and research-ready datasets with rigorous human verification.
          </p>

          <div className="pt-2 flex flex-wrap items-center gap-4">
            <button
              onClick={() => onNavigate('/upload')}
              className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-teal-500 hover:bg-teal-400 text-slate-950 font-bold text-sm shadow-md transition-all cursor-pointer"
            >
              <UploadCloud className="w-5 h-5 text-slate-950" />
              <span>+ Digitise Documents</span>
            </button>

            <button
              onClick={() => onNavigate('/archive')}
              className="inline-flex items-center gap-2 px-5 py-3 rounded-xl bg-white/10 hover:bg-white/15 text-white font-semibold text-sm border border-white/20 transition-all cursor-pointer"
            >
              <FolderArchive className="w-4 h-4 text-teal-300" />
              <span>Explore Archive</span>
            </button>

            <button
              onClick={() => onNavigate('/review')}
              className="inline-flex items-center gap-2 px-5 py-3 rounded-xl bg-white/10 hover:bg-white/15 text-white font-semibold text-sm border border-white/20 transition-all cursor-pointer"
            >
              <FileCheck2 className="w-4 h-4 text-amber-300" />
              <span>Review Queue ({reviewRequired})</span>
            </button>
          </div>
        </div>

        {/* Abstract Architectural Diagram Graphics in background */}
        <div className="hidden lg:block absolute right-8 top-1/2 -translate-y-1/2 opacity-15 pointer-events-none">
          <div className="w-72 h-72 border-2 border-dashed border-teal-400 rounded-full flex items-center justify-center animate-spin-slow">
            <Database className="w-24 h-24 text-teal-300" />
          </div>
        </div>
      </div>

      {/* Backend Status Notice if Colab Tunnel is sleeping */}
      {!apiConnected && (
        <div className="p-4 rounded-xl bg-amber-50 border border-amber-200 flex items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
            <div className="space-y-1 text-xs">
              <span className="font-semibold text-amber-900 block text-sm">
                Colab OCR Backend Offline or Tunnel Asleep
              </span>
              <p className="text-amber-800 leading-relaxed">
                The Colab OCR server may be offline or the Localtunnel URL has changed. You can still inspect
                previously digitised records, run clinical extraction on existing OCR texts, or enable{' '}
                <strong>Demo Mode</strong> in Settings to explore synthetic Nigerian hospital archive cases.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={() => onNavigate('/api-status')}
              className="px-3 py-1.5 rounded-lg bg-white border border-amber-300 text-xs font-semibold text-amber-900 hover:bg-amber-100 transition-colors cursor-pointer"
            >
              Check API
            </button>
            <button
              onClick={() => onNavigate('/settings')}
              className="px-3 py-1.5 rounded-lg bg-amber-600 text-white text-xs font-semibold hover:bg-amber-700 transition-colors cursor-pointer"
            >
              Settings
            </button>
          </div>
        </div>
      )}

      {/* Top Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        <div className="p-5 rounded-xl bg-white border border-slate-200 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider">Total Documents</span>
            <FileText className="w-4 h-4 text-slate-400" />
          </div>
          <div className="text-2xl md:text-3xl font-extrabold text-slate-900">
            {totalDocs}
          </div>
          <div className="mt-2 text-[11px] text-slate-500">
            Ingested from hospital paper archives
          </div>
        </div>

        <div className="p-5 rounded-xl bg-white border border-slate-200 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider">Processed (docTR)</span>
            <Cpu className="w-4 h-4 text-teal-600" />
          </div>
          <div className="text-2xl md:text-3xl font-extrabold text-teal-700">
            {processedDocs}
          </div>
          <div className="mt-2 text-[11px] text-teal-600">
            OCR normalized & indexed
          </div>
        </div>

        <div className="p-5 rounded-xl bg-white border border-slate-200 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider">Review Required</span>
            <Clock className="w-4 h-4 text-amber-500" />
          </div>
          <div className="text-2xl md:text-3xl font-extrabold text-amber-600">
            {reviewRequired}
          </div>
          <div className="mt-2 text-[11px] text-amber-600">
            Awaiting human verification
          </div>
        </div>

        <div className="p-5 rounded-xl bg-white border border-slate-200 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider">Failed / Flagged</span>
            <AlertCircle className="w-4 h-4 text-rose-500" />
          </div>
          <div className="text-2xl md:text-3xl font-extrabold text-rose-600">
            {failedDocs}
          </div>
          <div className="mt-2 text-[11px] text-slate-500">
            Blurry, corrupt, or rejected
          </div>
        </div>
      </div>

      {/* Visual System Architecture Diagram (Exact Representation of Innovation Concept) */}
      <div className="p-6 md:p-8 rounded-2xl bg-white border border-slate-200 shadow-xs space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-4">
          <div>
            <h2 className="text-base font-bold text-slate-900 tracking-tight flex items-center gap-2">
              <Network className="w-5 h-5 text-teal-700" />
              <span>Full System Architecture & Workflow Pipeline</span>
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Strict separation of concerns: Physical Ingestion → docTR Optical Recognition → Gemini Semantic Structuring → Human Verification
            </p>
          </div>
          <span className="text-[11px] px-2.5 py-1 rounded-full bg-slate-100 text-slate-700 font-semibold font-mono">
            Interactive Architecture
          </span>
        </div>

        {/* Visual Architecture Schematic Nodes */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 relative">
          {/* Node 1: Ingestion */}
          <div className="p-4 rounded-xl border border-slate-200 bg-slate-50 hover:bg-white hover:border-teal-400 transition-all space-y-3 flex flex-col justify-between">
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Step 1</span>
                <span className="w-2 h-2 rounded-full bg-teal-500" />
              </div>
              <h3 className="font-bold text-xs text-slate-900 flex items-center gap-1.5">
                <UploadCloud className="w-4 h-4 text-teal-600" /> Document Ingestion
              </h3>
              <p className="text-[11px] text-slate-600 leading-relaxed">
                Single or bulk ingestion of 1 to 100 historical hospital cards (JPG, PNG, PDF).
              </p>
            </div>
            <button
              onClick={() => onNavigate('/upload')}
              className="w-full py-1.5 text-[11px] font-semibold text-teal-800 bg-teal-50 hover:bg-teal-100 rounded-lg transition-colors cursor-pointer"
            >
              Open Ingest Portal →
            </button>
          </div>

          {/* Node 2: Colab docTR Backend */}
          <div className="p-4 rounded-xl border border-slate-200 bg-slate-50 hover:bg-white hover:border-teal-400 transition-all space-y-3 flex flex-col justify-between">
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Step 2</span>
                <span className="w-2 h-2 rounded-full bg-blue-500" />
              </div>
              <h3 className="font-bold text-xs text-slate-900 flex items-center gap-1.5">
                <Cpu className="w-4 h-4 text-blue-600" /> docTR OCR Pipeline
              </h3>
              <p className="text-[11px] text-slate-600 leading-relaxed">
                FastAPI in Google Colab performs text detection and recognition: <em>"What text is present?"</em>
              </p>
            </div>
            <button
              onClick={() => onNavigate('/api-status')}
              className="w-full py-1.5 text-[11px] font-semibold text-blue-800 bg-blue-50 hover:bg-blue-100 rounded-lg transition-colors cursor-pointer"
            >
              Inspect OCR API Status →
            </button>
          </div>

          {/* Node 3: Gemini Clinical Structuring */}
          <div className="p-4 rounded-xl border border-slate-200 bg-slate-50 hover:bg-white hover:border-teal-400 transition-all space-y-3 flex flex-col justify-between">
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Step 3</span>
                <span className="w-2 h-2 rounded-full bg-purple-500" />
              </div>
              <h3 className="font-bold text-xs text-slate-900 flex items-center gap-1.5">
                <Sparkles className="w-4 h-4 text-purple-600" /> Gemini Clinical Layer
              </h3>
              <p className="text-[11px] text-slate-600 leading-relaxed">
                Extracts demographics, vitals, labs, diagnoses, and meds conservatively without hallucination.
              </p>
            </div>
            <button
              onClick={() => onNavigate('/archive')}
              className="w-full py-1.5 text-[11px] font-semibold text-purple-800 bg-purple-50 hover:bg-purple-100 rounded-lg transition-colors cursor-pointer"
            >
              View Clinical Extractions →
            </button>
          </div>

          {/* Node 4: Human Review & Digital Record */}
          <div className="p-4 rounded-xl border border-slate-200 bg-slate-50 hover:bg-white hover:border-teal-400 transition-all space-y-3 flex flex-col justify-between">
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Step 4</span>
                <span className="w-2 h-2 rounded-full bg-amber-500" />
              </div>
              <h3 className="font-bold text-xs text-slate-900 flex items-center gap-1.5">
                <FileCheck2 className="w-4 h-4 text-amber-600" /> Human Review & Commit
              </h3>
              <p className="text-[11px] text-slate-600 leading-relaxed">
                Authorized clinicians approve or correct values with full before/after audit tracking.
              </p>
            </div>
            <button
              onClick={() => onNavigate('/review')}
              className="w-full py-1.5 text-[11px] font-semibold text-amber-900 bg-amber-50 hover:bg-amber-100 rounded-lg transition-colors cursor-pointer"
            >
              Open Verification Workspace →
            </button>
          </div>
        </div>

        {/* Downstream Clinical Consumers Grid */}
        <div className="pt-2 border-t border-slate-100">
          <div className="text-[11px] font-bold text-slate-400 uppercase mb-3 tracking-wider">
            Step 5: Digital Health Intelligence Consumers
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <button
              onClick={() => onNavigate('/patients')}
              className="p-3 rounded-xl bg-slate-50 hover:bg-white border border-slate-200 text-left transition-all cursor-pointer flex items-center justify-between"
            >
              <div>
                <div className="font-bold text-xs text-slate-900">Patient Timelines</div>
                <div className="text-[10px] text-slate-500">Longitudinal multi-year records</div>
              </div>
              <ChevronRight className="w-4 h-4 text-slate-400" />
            </button>

            <button
              onClick={() => onNavigate('/search')}
              className="p-3 rounded-xl bg-slate-50 hover:bg-white border border-slate-200 text-left transition-all cursor-pointer flex items-center justify-between"
            >
              <div>
                <div className="font-bold text-xs text-slate-900">Global Search</div>
                <div className="text-[10px] text-slate-500">MRN, diagnosis & OCR search</div>
              </div>
              <ChevronRight className="w-4 h-4 text-slate-400" />
            </button>

            <button
              onClick={() => onNavigate('/analytics')}
              className="p-3 rounded-xl bg-slate-50 hover:bg-white border border-slate-200 text-left transition-all cursor-pointer flex items-center justify-between"
            >
              <div>
                <div className="font-bold text-xs text-slate-900">Archive Analytics</div>
                <div className="text-[10px] text-slate-500">Epidemiological & throughput</div>
              </div>
              <ChevronRight className="w-4 h-4 text-slate-400" />
            </button>

            <button
              onClick={() => onNavigate('/exports')}
              className="p-3 rounded-xl bg-slate-50 hover:bg-white border border-slate-200 text-left transition-all cursor-pointer flex items-center justify-between"
            >
              <div>
                <div className="font-bold text-xs text-slate-900">Research Exports</div>
                <div className="text-[10px] text-slate-500">CSV, JSON & docTR exports</div>
              </div>
              <ChevronRight className="w-4 h-4 text-slate-400" />
            </button>
          </div>
        </div>
      </div>

      {/* Recent Digitised Documents Table */}
      <div className="p-6 rounded-2xl bg-white border border-slate-200 shadow-xs space-y-4">
        <div className="flex items-center justify-between">
          <div className="space-y-0.5">
            <h2 className="text-base font-bold text-slate-900">Recent Digitised Hospital Documents</h2>
            <p className="text-xs text-slate-500">Physical records processed through docTR and indexed in the digital archive</p>
          </div>
          <button
            onClick={() => onNavigate('/archive')}
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-teal-700 hover:text-teal-800 cursor-pointer"
          >
            <span>View Full Archive</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>

        {documents.length === 0 ? (
          <div className="py-12 flex flex-col items-center justify-center text-center space-y-3">
            <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center text-slate-400">
              <FolderArchive className="w-6 h-6" />
            </div>
            <div className="space-y-1">
              <p className="text-sm font-semibold text-slate-800">No hospital documents have been digitised yet.</p>
              <p className="text-xs text-slate-500">Upload paper scans or clinical photographs to begin processing.</p>
            </div>
            <button
              onClick={() => onNavigate('/upload')}
              className="mt-2 px-4 py-2 rounded-lg bg-[#0F4C5C] text-white text-xs font-semibold hover:bg-[#0c3c49] cursor-pointer"
            >
              Digitise your first document
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-500 font-semibold border-b border-slate-200">
                <tr>
                  <th className="py-3 px-4">Document ID</th>
                  <th className="py-3 px-4">Filename</th>
                  <th className="py-3 px-4">Date Processed</th>
                  <th className="py-3 px-4">Pages</th>
                  <th className="py-3 px-4">OCR Status</th>
                  <th className="py-3 px-4">Confidence</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {documents.slice(0, 5).map((doc) => (
                  <tr key={doc.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="py-3 px-4 font-mono font-medium text-slate-900">{doc.id}</td>
                    <td className="py-3 px-4 font-medium text-slate-800">{doc.filename}</td>
                    <td className="py-3 px-4 text-slate-500">{doc.dateProcessed}</td>
                    <td className="py-3 px-4 text-slate-600">{doc.pages}</td>
                    <td className="py-3 px-4">
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                          doc.status === 'Completed'
                            ? 'bg-emerald-100 text-emerald-800'
                            : doc.status === 'Processing'
                            ? 'bg-blue-100 text-blue-800 animate-pulse'
                            : 'bg-rose-100 text-rose-800'
                        }`}
                      >
                        {doc.status}
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      {doc.ocrConfidence !== null ? (
                        <span
                          className={`font-semibold ${
                            doc.ocrConfidence >= 0.9
                              ? 'text-emerald-600'
                              : doc.ocrConfidence >= 0.7
                              ? 'text-amber-600'
                              : 'text-rose-600'
                          }`}
                        >
                          {(doc.ocrConfidence * 100).toFixed(0)}%
                        </span>
                      ) : (
                        <span className="text-slate-400">Not provided</span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-right space-x-2">
                      <button
                        onClick={() => onNavigate(`/documents/${doc.id}`)}
                        className="text-teal-700 hover:text-teal-900 font-semibold cursor-pointer"
                      >
                        View OCR
                      </button>
                      <button
                        onClick={() => onNavigate(`/review/${doc.id}`)}
                        className="text-indigo-600 hover:text-indigo-800 font-semibold cursor-pointer"
                      >
                        Review
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
