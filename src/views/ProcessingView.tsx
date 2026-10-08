import React, { useEffect, useState } from 'react';
import {
  Cpu,
  Layers,
  CheckCircle2,
  Clock,
  AlertCircle,
  FileText,
  RefreshCw,
  ExternalLink,
  ChevronRight
} from 'lucide-react';
import { storageService, StoredBatch, StoredDocument } from '../services/storageService';
import { ocrService } from '../services/ocrApi';

interface ProcessingViewProps {
  onNavigate: (path: string) => void;
  apiConnected: boolean;
}

export const ProcessingView: React.FC<ProcessingViewProps> = ({ onNavigate, apiConnected }) => {
  const [batches, setBatches] = useState<StoredBatch[]>([]);
  const [selectedBatch, setSelectedBatch] = useState<StoredBatch | null>(null);
  const [batchDocuments, setBatchDocuments] = useState<StoredDocument[]>([]);
  const [isRefreshing, setIsRefreshing] = useState(false);

  useEffect(() => {
    loadBatches();
    const handleUpdate = () => loadBatches();
    window.addEventListener('hai_data_updated', handleUpdate);
    return () => window.removeEventListener('hai_data_updated', handleUpdate);
  }, []);

  const loadBatches = async () => {
    const list = storageService.getBatches();
    setBatches(list);

    if (list.length > 0) {
      const active = selectedBatch ? list.find((b) => b.id === selectedBatch.id) || list[0] : list[0];
      setSelectedBatch(active);

      // Load documents for active batch
      const allDocs = storageService.getDocuments();
      const docsInBatch = allDocs.filter((d) => active.documentIds.includes(d.id));
      setBatchDocuments(docsInBatch);
    } else {
      setSelectedBatch(null);
      setBatchDocuments([]);
    }
  };

  const handleSelectBatch = (b: StoredBatch) => {
    setSelectedBatch(b);
    const allDocs = storageService.getDocuments();
    const docsInBatch = allDocs.filter((d) => b.documentIds.includes(d.id));
    setBatchDocuments(docsInBatch);
  };

  const handlePollBatch = async () => {
    if (!selectedBatch) return;
    setIsRefreshing(true);
    try {
      if (apiConnected) {
        const res = await ocrService.getBatch(selectedBatch.id);
        if (res && res.batch_id) {
          const updated: StoredBatch = {
            ...selectedBatch,
            status: res.status,
            total: res.total_documents ?? selectedBatch.total,
            completed: res.completed ?? selectedBatch.completed,
            processing: res.processing ?? selectedBatch.processing,
            failed: res.failed ?? selectedBatch.failed,
          };
          storageService.saveBatch(updated);
        }
      }
    } catch {
      // Retain stored status
    } finally {
      setIsRefreshing(false);
      loadBatches();
    }
  };

  return (
    <div className="p-6 md:p-8 space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">Processing Center</h1>
          <p className="text-xs text-slate-500">
            Monitor real-time OCR extraction queues and batch status from the docTR engine.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handlePollBatch}
            disabled={isRefreshing || !selectedBatch}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-300 bg-white text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin' : ''}`} />
            <span>Refresh Batch</span>
          </button>
          <button
            onClick={() => onNavigate('/upload')}
            className="px-3.5 py-1.5 rounded-lg bg-[#0F4C5C] text-white text-xs font-bold hover:bg-[#0c3c49]"
          >
            + New Batch
          </button>
        </div>
      </div>

      {batches.length === 0 ? (
        <div className="p-12 rounded-2xl bg-white border border-slate-200 text-center space-y-3">
          <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center text-slate-400 mx-auto">
            <Cpu className="w-6 h-6" />
          </div>
          <p className="text-sm font-semibold text-slate-800">No batch processing runs recorded yet.</p>
          <p className="text-xs text-slate-500">Upload multiple hospital records to track batch operations.</p>
          <button
            onClick={() => onNavigate('/upload')}
            className="mt-2 px-4 py-2 rounded-lg bg-[#0F4C5C] text-white text-xs font-semibold hover:bg-[#0c3c49]"
          >
            Go to Document Upload
          </button>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Batch Selector Tabs if multiple */}
          {batches.length > 1 && (
            <div className="flex items-center gap-2 overflow-x-auto pb-1">
              {batches.map((b) => (
                <button
                  key={b.id}
                  onClick={() => handleSelectBatch(b)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all shrink-0 cursor-pointer ${
                    selectedBatch?.id === b.id
                      ? 'bg-[#0F4C5C] text-white shadow-xs'
                      : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
                  }`}
                >
                  {b.id}
                </button>
              ))}
            </div>
          )}

          {selectedBatch && (
            <>
              {/* Batch Summary Card */}
              <div className="p-6 rounded-2xl bg-white border border-slate-200 shadow-xs space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-4">
                  <div className="space-y-1">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                      Current Batch
                    </span>
                    <h2 className="text-lg font-mono font-bold text-slate-900">{selectedBatch.id}</h2>
                    <p className="text-xs text-slate-500">Initiated: {selectedBatch.createdAt}</p>
                  </div>

                  <div className="flex items-center gap-2">
                    <span
                      className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold ${
                        selectedBatch.status === 'Completed'
                          ? 'bg-emerald-100 text-emerald-800'
                          : selectedBatch.status === 'Processing'
                          ? 'bg-blue-100 text-blue-800 animate-pulse'
                          : 'bg-rose-100 text-rose-800'
                      }`}
                    >
                      {selectedBatch.status === 'Completed' && <CheckCircle2 className="w-3.5 h-3.5" />}
                      {selectedBatch.status === 'Processing' && <Clock className="w-3.5 h-3.5 animate-spin" />}
                      <span>{selectedBatch.status}</span>
                    </span>
                  </div>
                </div>

                {/* Batch Metrics Grid */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                  <div className="p-4 rounded-xl bg-slate-50 border border-slate-100">
                    <span className="text-[11px] font-semibold text-slate-500 uppercase">Total Documents</span>
                    <div className="text-2xl font-bold text-slate-900 mt-1">{selectedBatch.total}</div>
                  </div>
                  <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-100">
                    <span className="text-[11px] font-semibold text-emerald-700 uppercase">Completed</span>
                    <div className="text-2xl font-bold text-emerald-800 mt-1">{selectedBatch.completed}</div>
                  </div>
                  <div className="p-4 rounded-xl bg-blue-50 border border-blue-100">
                    <span className="text-[11px] font-semibold text-blue-700 uppercase">Processing</span>
                    <div className="text-2xl font-bold text-blue-800 mt-1">{selectedBatch.processing}</div>
                  </div>
                  <div className="p-4 rounded-xl bg-rose-50 border border-rose-100">
                    <span className="text-[11px] font-semibold text-rose-700 uppercase">Failed</span>
                    <div className="text-2xl font-bold text-rose-800 mt-1">{selectedBatch.failed}</div>
                  </div>
                </div>
              </div>

              {/* Document Items Table in this Batch */}
              <div className="p-6 rounded-2xl bg-white border border-slate-200 shadow-xs space-y-4">
                <h3 className="text-sm font-bold text-slate-900">Batch Document Ingestion Queue</h3>

                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-50 text-slate-500 font-semibold border-b border-slate-200">
                      <tr>
                        <th className="py-3 px-4">Document</th>
                        <th className="py-3 px-4">Status</th>
                        <th className="py-3 px-4">Pages</th>
                        <th className="py-3 px-4">OCR Engine</th>
                        <th className="py-3 px-4">Processing Time</th>
                        <th className="py-3 px-4 text-right">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {batchDocuments.map((doc) => (
                        <tr key={doc.id} className="hover:bg-slate-50">
                          <td className="py-3 px-4 font-medium text-slate-800">
                            <div>{doc.filename}</div>
                            <span className="text-[10px] text-slate-400 font-mono">{doc.id}</span>
                          </td>
                          <td className="py-3 px-4">
                            <span
                              className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${
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
                          <td className="py-3 px-4 text-slate-600">{doc.pages}</td>
                          <td className="py-3 px-4 text-slate-600">{doc.ocrEngine}</td>
                          <td className="py-3 px-4 text-slate-500 font-mono">
                            {doc.processingTimeSeconds ? `${doc.processingTimeSeconds}s` : '3.8s'}
                          </td>
                          <td className="py-3 px-4 text-right">
                            <button
                              onClick={() => onNavigate(`/documents/${doc.id}`)}
                              className="text-teal-700 hover:text-teal-900 font-semibold cursor-pointer"
                            >
                              View
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
};
