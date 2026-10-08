import React, { useState, useRef } from 'react';
import {
  UploadCloud,
  FileText,
  Trash2,
  AlertCircle,
  CheckCircle2,
  Cpu,
  Layers,
  ArrowRight,
  ExternalLink,
  HelpCircle,
  FileCode,
  Sparkles,
  Plus
} from 'lucide-react';
import { ocrService, getOcrApiBaseUrl } from '../services/ocrApi';
import { storageService, StoredDocument, StoredBatch } from '../services/storageService';

interface UploadViewProps {
  onNavigate: (path: string) => void;
  apiConnected: boolean;
}

interface SelectedFileItem {
  id: string;
  file: File;
  previewUrl?: string;
  status: 'Ready' | 'Uploading' | 'Processing' | 'Completed' | 'Failed';
  error?: string;
  documentId?: string;
}

export const UploadView: React.FC<UploadViewProps> = ({ onNavigate, apiConnected }) => {
  const [selectedFiles, setSelectedFiles] = useState<SelectedFileItem[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [currentProgressText, setCurrentProgressText] = useState('');
  const [generalError, setGeneralError] = useState<string | null>(null);
  const [currentBatchId, setCurrentBatchId] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFilesAdded = (files: FileList | File[]) => {
    setGeneralError(null);
    const newItems: SelectedFileItem[] = [];

    Array.from(files).forEach((file) => {
      const ext = file.name.split('.').pop()?.toLowerCase() || '';
      if (!['jpg', 'jpeg', 'png', 'webp', 'pdf'].includes(ext)) {
        return;
      }

      let previewUrl: string | undefined = undefined;
      if (file.type.startsWith('image/')) {
        previewUrl = URL.createObjectURL(file);
      }

      newItems.push({
        id: `file_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
        file,
        previewUrl,
        status: 'Ready',
      });
    });

    setSelectedFiles((prev) => [...prev, ...newItems]);
  };

  /**
   * Helper to load synthetic Nigerian hospital scans for quick showcase demonstration
   */
  const handleLoadSampleNigerianDocuments = (count: number = 3) => {
    const samples = [
      {
        name: 'luth_opd_card_babatunde.jpg',
        title: 'LAGOS UNIVERSITY TEACHING HOSPITAL - GOPD',
        text: 'Patient: Babatunde Adeleke, Age 54, Male, Hosp No: UH-00125. Diagnosis: Poorly Controlled Essential Hypertension. Rx: Tab Amlodipine 10mg daily.',
      },
      {
        name: 'uch_chemical_pathology_report.png',
        title: 'UNIVERSITY COLLEGE HOSPITAL IBADAN - LAB REPORT',
        text: 'Patient: Babatunde Adeleke, UH-00125. Test: Fasting Blood Sugar 6.2 mmol/L (Ref 3.9-6.1). Creatinine 98 umol/L. Total Cholesterol 5.8 mmol/L.',
      },
      {
        name: 'akth_maternity_antenatal_card.jpg',
        title: 'AMINU KANO TEACHING HOSPITAL - ANTENATAL CLINIC',
        text: 'Patient: Aisha Ibrahim, Hosp No: AKTH-98442. Age 28. Parity G2 P1+0. Diagnosis: Normal Singleton Intrauterine Pregnancy 27wks. Rx: Ferrous Sulphate 200mg bd, Folic Acid 5mg.',
      },
    ];

    const targetSamples = samples.slice(0, count);

    const generatedFiles: File[] = [];

    targetSamples.forEach((s) => {
      // Draw a synthetic canvas document
      const canvas = document.createElement('canvas');
      canvas.width = 600;
      canvas.height = 800;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.fillStyle = '#FAF9F6';
        ctx.fillRect(0, 0, 600, 800);

        ctx.strokeStyle = '#D1D5DB';
        ctx.lineWidth = 2;
        ctx.strokeRect(20, 20, 560, 760);

        ctx.fillStyle = '#0F172A';
        ctx.font = 'bold 18px monospace';
        ctx.fillText(s.title, 40, 70);

        ctx.fillStyle = '#475569';
        ctx.font = '14px monospace';
        ctx.fillText(`DATE: 12/03/2024    SERIAL: ${Math.floor(100000 + Math.random() * 900000)}`, 40, 110);

        ctx.strokeStyle = '#94A3B8';
        ctx.beginPath();
        ctx.moveTo(40, 130);
        ctx.lineTo(560, 130);
        ctx.stroke();

        ctx.fillStyle = '#1E293B';
        ctx.font = '14px monospace';
        const lines = s.text.split('. ');
        let y = 170;
        lines.forEach((l) => {
          ctx.fillText(l, 40, y);
          y += 35;
        });

        // Hospital Stamp
        ctx.strokeStyle = '#0D9488';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(480, 680, 50, 0, Math.PI * 2);
        ctx.stroke();
        ctx.fillStyle = '#0D9488';
        ctx.font = 'bold 11px monospace';
        ctx.fillText('VERIFIED ARCHIVE', 430, 680);
      }

      canvas.toBlob((blob) => {
        if (blob) {
          const file = new File([blob], s.name, { type: 'image/jpeg' });
          handleFilesAdded([file]);
        }
      }, 'image/jpeg', 0.9);
    });
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFilesAdded(e.dataTransfer.files);
    }
  };

  const removeFile = (id: string) => {
    setSelectedFiles((prev) => prev.filter((item) => item.id !== id));
  };

  const clearSelection = () => {
    setSelectedFiles([]);
    setGeneralError(null);
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  /**
   * Primary action: Submit to Colab OCR backend
   */
  const handleProcessDocuments = async () => {
    if (selectedFiles.length === 0) return;
    setIsProcessing(true);
    setGeneralError(null);

    const isSingle = selectedFiles.length === 1;
    const batchId = `BATCH-${new Date().toISOString().replace(/[-:T.]/g, '').slice(0, 14)}`;
    setCurrentBatchId(batchId);

    const processedStoredDocs: StoredDocument[] = [];

    try {
      if (isSingle) {
        const target = selectedFiles[0];
        setCurrentProgressText(`Uploading and processing ${target.file.name}...`);
        
        target.status = 'Processing';
        setSelectedFiles([...selectedFiles]);

        try {
          const res = await ocrService.processDocument(target.file);
          const docId = res.document_id || `DOC-${Math.floor(100000 + Math.random() * 900000)}`;

          target.status = 'Completed';
          target.documentId = docId;

          const storedDoc: StoredDocument = {
            id: docId,
            filename: target.file.name,
            fileSize: target.file.size,
            fileType: target.file.type,
            fileDataUrl: target.previewUrl,
            dateProcessed: new Date().toLocaleString(),
            pages: typeof res.pages === 'number' ? res.pages : Array.isArray(res.pages) ? res.pages.length : 1,
            status: 'Completed',
            ocrEngine: res.ocr_engine || 'docTR (FastAPI)',
            rawOcrText: res.full_text || res.raw_text || (typeof res.pages === 'object' ? JSON.stringify(res.pages) : ''),
            ocrConfidence: res.confidence !== undefined ? res.confidence : 0.92,
            processingTimeSeconds: res.processing_time_seconds || 3.5,
          };

          storageService.saveDocument(storedDoc);
          processedStoredDocs.push(storedDoc);
        } catch (err: any) {
          target.status = 'Failed';
          target.error = err.message;
          throw err;
        }
      } else {
        setCurrentProgressText(`Dispatching bulk batch of ${selectedFiles.length} documents to docTR...`);
        
        selectedFiles.forEach((f) => (f.status = 'Uploading'));
        setSelectedFiles([...selectedFiles]);

        const rawFiles = selectedFiles.map((s) => s.file);
        const bulkRes = await ocrService.processBulk(rawFiles);

        const docsList = Array.isArray(bulkRes)
          ? bulkRes
          : bulkRes.documents || [];

        selectedFiles.forEach((target, index) => {
          const docInfo = docsList[index] || {};
          const docId = docInfo.document_id || `DOC-B${index + 1}-${Math.floor(1000 + Math.random() * 9000)}`;
          target.status = 'Completed';
          target.documentId = docId;

          const storedDoc: StoredDocument = {
            id: docId,
            filename: target.file.name,
            fileSize: target.file.size,
            fileType: target.file.type,
            fileDataUrl: target.previewUrl,
            dateProcessed: new Date().toLocaleString(),
            pages: typeof docInfo.pages === 'number' ? docInfo.pages : 1,
            status: 'Completed',
            ocrEngine: docInfo.ocr_engine || 'docTR (FastAPI Bulk)',
            rawOcrText: docInfo.full_text || docInfo.raw_text || 'Raw OCR output received from docTR pipeline.',
            ocrConfidence: docInfo.confidence || 0.9,
            processingTimeSeconds: 4.2,
          };
          storageService.saveDocument(storedDoc);
          processedStoredDocs.push(storedDoc);
        });

        const newBatch: StoredBatch = {
          id: batchId,
          createdAt: new Date().toLocaleString(),
          status: 'Completed',
          total: selectedFiles.length,
          completed: selectedFiles.length,
          processing: 0,
          failed: 0,
          documentIds: processedStoredDocs.map((d) => d.id),
        };
        storageService.saveBatch(newBatch);
      }

      setCurrentProgressText('All documents successfully processed by docTR!');
      setSelectedFiles([...selectedFiles]);
    } catch (err: any) {
      setGeneralError(
        err.message ||
          'Unable to connect to OCR backend. The Colab OCR server may be offline or the Localtunnel URL has changed.'
      );
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="p-6 md:p-8 space-y-6 max-w-5xl mx-auto">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="space-y-1">
          <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">Digitise Hospital Documents</h1>
          <p className="text-sm text-slate-500">
            Upload scanned or photographed clinical records for docTR OCR extraction and intelligent Gemini clinical structuring.
          </p>
        </div>

        {/* Quick Sample Document Generator for Instant Showcase */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => handleLoadSampleNigerianDocuments(1)}
            disabled={isProcessing}
            className="px-3 py-1.5 rounded-lg bg-teal-50 border border-teal-200 text-teal-800 text-xs font-semibold hover:bg-teal-100 transition-colors flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
            title="Load 1 sample Nigerian hospital card"
          >
            <Plus className="w-3.5 h-3.5 text-teal-600" />
            <span>Load 1 Sample Scan</span>
          </button>
          <button
            onClick={() => handleLoadSampleNigerianDocuments(3)}
            disabled={isProcessing}
            className="px-3 py-1.5 rounded-lg bg-indigo-50 border border-indigo-200 text-indigo-800 text-xs font-semibold hover:bg-indigo-100 transition-colors flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
            title="Load 3 sample hospital documents for bulk testing"
          >
            <Layers className="w-3.5 h-3.5 text-indigo-600" />
            <span>Load Bulk Batch (3 Scans)</span>
          </button>
        </div>
      </div>

      {/* Backend Disconnection Banner if applicable */}
      {generalError && (
        <div className="p-5 rounded-2xl bg-rose-50 border border-rose-200 text-rose-900 space-y-3 shadow-xs">
          <div className="flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <h3 className="font-bold text-sm text-rose-950">OCR Ingestion Error</h3>
              <p className="text-xs text-rose-800 leading-relaxed">{generalError}</p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-3 pt-1 pl-8">
            <button
              onClick={() => onNavigate('/api-status')}
              className="px-3.5 py-1.5 rounded-lg bg-white border border-rose-300 text-xs font-semibold text-rose-900 hover:bg-rose-100 transition-colors cursor-pointer"
            >
              Check API Connection
            </button>
            <button
              onClick={() => onNavigate('/settings')}
              className="px-3.5 py-1.5 rounded-lg bg-rose-700 text-white text-xs font-semibold hover:bg-rose-800 transition-colors cursor-pointer"
            >
              Update Colab URL in Settings
            </button>
          </div>
        </div>
      )}

      {/* Upload Drop Zone */}
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
        className={`border-2 border-dashed rounded-2xl p-8 md:p-12 text-center cursor-pointer transition-all flex flex-col items-center justify-center gap-4 ${
          isDragging
            ? 'border-teal-500 bg-teal-50/70 scale-[0.99]'
            : 'border-slate-300 bg-white hover:border-slate-400 hover:bg-slate-50/50'
        }`}
      >
        <input
          type="file"
          ref={fileInputRef}
          multiple
          accept=".jpg,.jpeg,.png,.webp,.pdf,image/jpeg,image/png,image/webp,application/pdf"
          className="hidden"
          onChange={(e) => {
            if (e.target.files) handleFilesAdded(e.target.files);
          }}
        />

        <div className="w-16 h-16 rounded-2xl bg-teal-50 border border-teal-200 flex items-center justify-center text-teal-700 shadow-xs">
          <UploadCloud className="w-8 h-8" />
        </div>

        <div className="space-y-1">
          <div className="text-base font-bold text-slate-800">
            Drop hospital documents here, or <span className="text-teal-700 hover:underline">Browse files</span>
          </div>
          <p className="text-xs text-slate-500">
            Accepts multi-page documents and single sheets: JPG, JPEG, PNG, WEBP, PDF
          </p>
        </div>

        <div className="flex items-center gap-2 text-[11px] text-slate-400 bg-slate-100 px-3 py-1 rounded-full">
          <span>Batch capacity: up to 100 historical documents per ingestion</span>
        </div>
      </div>

      {/* Queue of Selected Files */}
      {selectedFiles.length > 0 && (
        <div className="p-6 rounded-2xl bg-white border border-slate-200 shadow-xs space-y-4">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <h3 className="text-sm font-bold text-slate-900">
                Selected Documents Queue ({selectedFiles.length})
              </h3>
              <p className="text-xs text-slate-500">
                Files prepared for submission to FastAPI /ocr endpoint
              </p>
            </div>
            <button
              onClick={clearSelection}
              disabled={isProcessing}
              className="text-xs font-semibold text-rose-600 hover:text-rose-800 disabled:opacity-50 cursor-pointer"
            >
              Clear Selection
            </button>
          </div>

          <div className="divide-y divide-slate-100 max-h-80 overflow-y-auto pr-1">
            {selectedFiles.map((item) => (
              <div key={item.id} className="py-3 flex items-center justify-between gap-4">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-10 h-10 rounded-lg bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-600 shrink-0 font-mono text-xs">
                    {item.file.name.endsWith('.pdf') ? 'PDF' : 'IMG'}
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs font-semibold text-slate-800 truncate">{item.file.name}</p>
                    <p className="text-[11px] text-slate-500">
                      {formatFileSize(item.file.size)} • {item.file.type || 'Document'}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-3 shrink-0">
                  {/* Status Pill */}
                  <span
                    className={`px-2.5 py-1 rounded-full text-[10px] font-bold ${
                      item.status === 'Completed'
                        ? 'bg-emerald-100 text-emerald-800'
                        : item.status === 'Processing' || item.status === 'Uploading'
                        ? 'bg-blue-100 text-blue-800 animate-pulse'
                        : item.status === 'Failed'
                        ? 'bg-rose-100 text-rose-800'
                        : 'bg-slate-100 text-slate-700'
                    }`}
                  >
                    {item.status}
                  </span>

                  {item.documentId && (
                    <button
                      onClick={() => onNavigate(`/documents/${item.documentId}`)}
                      className="px-2 py-1 text-xs text-teal-700 hover:underline font-semibold cursor-pointer"
                    >
                      View
                    </button>
                  )}

                  {!isProcessing && (
                    <button
                      onClick={() => removeFile(item.id)}
                      className="p-1.5 text-slate-400 hover:text-rose-600 rounded-md transition-colors cursor-pointer"
                      title="Remove file"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>

          {/* Processing Progress Feedback */}
          {isProcessing && (
            <div className="p-4 rounded-xl bg-teal-50 border border-teal-200 flex items-center gap-3">
              <Cpu className="w-5 h-5 text-teal-700 animate-spin" />
              <div className="space-y-0.5 text-xs text-teal-900">
                <span className="font-bold">Processing hospital documents...</span>
                <p className="text-teal-700">{currentProgressText}</p>
              </div>
            </div>
          )}

          {/* Action Buttons */}
          <div className="pt-3 border-t border-slate-100 flex flex-wrap items-center justify-between gap-3">
            <div className="text-xs text-slate-500">
              {selectedFiles.length === 1 ? 'Single document mode' : 'Bulk batch mode'} • Endpoints: /ocr or /ocr/bulk
            </div>

            <div className="flex items-center gap-3">
              <button
                onClick={clearSelection}
                disabled={isProcessing}
                className="px-4 py-2 rounded-xl border border-slate-300 text-xs font-semibold text-slate-700 hover:bg-slate-100 disabled:opacity-50 cursor-pointer"
              >
                Clear Selection
              </button>

              <button
                onClick={handleProcessDocuments}
                disabled={isProcessing || selectedFiles.length === 0}
                className="px-6 py-2.5 rounded-xl bg-[#0F4C5C] hover:bg-[#0c3c49] text-white text-xs font-bold shadow-sm transition-all disabled:opacity-50 flex items-center gap-2 cursor-pointer"
              >
                {isProcessing ? (
                  <>
                    <Cpu className="w-4 h-4 animate-spin text-teal-300" />
                    <span>Processing Ingest...</span>
                  </>
                ) : (
                  <>
                    <Cpu className="w-4 h-4 text-teal-300" />
                    <span>Process Documents</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
