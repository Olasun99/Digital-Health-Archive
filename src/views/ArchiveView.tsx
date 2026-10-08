import React, { useState, useEffect } from 'react';
import {
  FolderArchive,
  Search,
  Filter,
  FileText,
  CheckCircle2,
  AlertCircle,
  Eye,
  FileCheck2,
  Sparkles,
  Download,
  UploadCloud,
  ChevronRight,
  Scan
} from 'lucide-react';
import { storageService, StoredDocument, StoredHealthRecord } from '../services/storageService';
import { ocrService } from '../services/ocrApi';

interface ArchiveViewProps {
  onNavigate: (path: string) => void;
  apiConnected: boolean;
}

export const ArchiveView: React.FC<ArchiveViewProps> = ({ onNavigate, apiConnected }) => {
  const [documents, setDocuments] = useState<StoredDocument[]>([]);
  const [records, setRecords] = useState<StoredHealthRecord[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedFilter, setSelectedFilter] = useState<string>('All');
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    loadArchive();
    const handleUpdate = () => loadArchive();
    window.addEventListener('hai_data_updated', handleUpdate);
    return () => window.removeEventListener('hai_data_updated', handleUpdate);
  }, []);

  const loadArchive = async () => {
    setIsLoading(true);
    try {
      const localDocs = storageService.getDocuments();
      const localRecs = storageService.getRecords();
      setRecords(localRecs);

      // Attempt syncing with remote /documents if backend is connected
      if (apiConnected) {
        try {
          const remoteDocs = await ocrService.getDocuments();
          if (remoteDocs && remoteDocs.length > 0) {
            const mapped = remoteDocs.map((r) => ({
              id: r.document_id,
              filename: r.filename,
              fileSize: 1500000,
              fileType: 'image/jpeg',
              dateProcessed: r.created_at || new Date().toLocaleString(),
              pages: typeof r.pages === 'number' ? r.pages : 1,
              status: r.status,
              ocrEngine: r.ocr_engine || 'docTR',
              rawOcrText: r.full_text || r.raw_text || '',
              ocrConfidence: r.confidence ?? 0.9,
            }));
            storageService.saveDocuments(mapped);
          }
        } catch {
          // Keep local documents
        }
      }
      setDocuments(storageService.getDocuments());
    } finally {
      setIsLoading(false);
    }
  };

  const filteredDocuments = documents.filter((doc) => {
    // Status filter
    if (selectedFilter === 'Completed' && doc.status !== 'Completed') return false;
    if (selectedFilter === 'Processing' && doc.status !== 'Processing') return false;
    if (selectedFilter === 'Failed' && doc.status !== 'Failed') return false;
    if (selectedFilter === 'Review Required') {
      const rec = records.find((r) => r.documentId === doc.id);
      if (!rec || rec.status !== 'under_review') return false;
    }

    // Search query
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchId = doc.id.toLowerCase().includes(q);
      const matchFile = doc.filename.toLowerCase().includes(q);
      const matchText = doc.rawOcrText.toLowerCase().includes(q);
      return matchId || matchFile || matchText;
    }
    return true;
  });

  const handleDownloadOcr = (doc: StoredDocument) => {
    const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(
      JSON.stringify(
        {
          document_id: doc.id,
          filename: doc.filename,
          date_processed: doc.dateProcessed,
          ocr_engine: doc.ocrEngine,
          pages: doc.pages,
          confidence: doc.ocrConfidence,
          raw_ocr_text: doc.rawOcrText,
        },
        null,
        2
      )
    );
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute('href', dataStr);
    downloadAnchor.setAttribute('download', `${doc.id}_docTR_OCR.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };

  return (
    <div className="p-6 md:p-8 space-y-6 max-w-7xl mx-auto">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">Hospital Document Archive</h1>
          <p className="text-xs text-slate-500">
            Search, inspect, and run clinical extraction across all paper archives scanned with docTR.
          </p>
        </div>
        <button
          onClick={() => onNavigate('/upload')}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-[#0F4C5C] hover:bg-[#0c3c49] text-white text-xs font-bold shadow-xs cursor-pointer"
        >
          <UploadCloud className="w-4 h-4 text-teal-300" />
          <span>+ Ingest Documents</span>
        </button>
      </div>

      {/* Search and Filters Bar */}
      <div className="p-4 rounded-xl bg-white border border-slate-200 shadow-xs flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
        {/* Search Input */}
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search by Document ID, filename, or clinical keyword in OCR..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-4 py-2 rounded-lg bg-slate-50 border border-slate-200 text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500"
          />
        </div>

        {/* Filter Pills */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 md:pb-0">
          <span className="text-xs text-slate-400 flex items-center gap-1 mr-1">
            <Filter className="w-3.5 h-3.5" /> Filter:
          </span>
          {['All', 'Completed', 'Processing', 'Review Required', 'Failed'].map((filter) => (
            <button
              key={filter}
              onClick={() => setSelectedFilter(filter)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all shrink-0 cursor-pointer ${
                selectedFilter === filter
                  ? 'bg-slate-900 text-white shadow-2xs'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              {filter}
            </button>
          ))}
        </div>
      </div>

      {/* Archive Table */}
      <div className="p-6 rounded-2xl bg-white border border-slate-200 shadow-xs space-y-4">
        {filteredDocuments.length === 0 ? (
          <div className="py-12 flex flex-col items-center justify-center text-center space-y-3">
            <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center text-slate-400">
              <FolderArchive className="w-6 h-6" />
            </div>
            <div className="space-y-1">
              <p className="text-sm font-semibold text-slate-800">
                {searchQuery || selectedFilter !== 'All'
                  ? 'No documents match your query or filter criteria.'
                  : 'No hospital documents have been digitised yet.'}
              </p>
              <p className="text-xs text-slate-500">
                Upload paper records to populate the hospital archive.
              </p>
            </div>
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
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4">OCR Engine</th>
                  <th className="py-3 px-4">Confidence</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredDocuments.map((doc) => {
                  const rec = records.find((r) => r.documentId === doc.id);
                  const isReviewed = rec?.status === 'approved';
                  return (
                    <tr key={doc.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-3 px-4 font-mono font-medium text-slate-900">{doc.id}</td>
                      <td className="py-3 px-4 font-medium text-slate-800">
                        <div className="truncate max-w-xs">{doc.filename}</div>
                        {isReviewed && (
                          <span className="text-[10px] text-emerald-600 font-semibold flex items-center gap-1 mt-0.5">
                            <CheckCircle2 className="w-3 h-3" /> Clinically Approved
                          </span>
                        )}
                      </td>
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
                      <td className="py-3 px-4 text-slate-600">{doc.ocrEngine}</td>
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
                      <td className="py-3 px-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => onNavigate(`/deep-scan/${doc.id}`)}
                            className="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-purple-50 hover:bg-purple-100 text-purple-900 font-semibold text-[11px] cursor-pointer"
                            title="Open Deep Scan & 3-Panel Tabularisation Workspace"
                          >
                            <Scan className="w-3 h-3 text-purple-700" /> Tabularise
                          </button>

                          <button
                            onClick={() => onNavigate(`/documents/${doc.id}`)}
                            className="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-teal-50 hover:bg-teal-100 text-teal-800 font-semibold text-[11px] cursor-pointer"
                            title="View split-screen OCR & Original"
                          >
                            <Eye className="w-3 h-3" /> View
                          </button>

                          <button
                            onClick={() => onNavigate(`/review/${doc.id}`)}
                            className="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-indigo-50 hover:bg-indigo-100 text-indigo-800 font-semibold text-[11px] cursor-pointer"
                            title="Open Human Verification Workspace"
                          >
                            <FileCheck2 className="w-3 h-3" /> Review
                          </button>

                          <button
                            onClick={() => handleDownloadOcr(doc)}
                            className="p-1 rounded text-slate-400 hover:text-slate-700 hover:bg-slate-100 cursor-pointer"
                            title="Download docTR OCR JSON"
                          >
                            <Download className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
