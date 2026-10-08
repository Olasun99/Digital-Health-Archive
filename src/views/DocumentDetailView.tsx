import React, { useState, useEffect } from 'react';
import {
  ArrowLeft,
  Copy,
  Download,
  Sparkles,
  Cpu,
  Check,
  ChevronLeft,
  ChevronRight,
  FileText,
  AlertCircle,
  Eye,
  CheckCircle2,
  FileCheck2,
  Layers,
  ZoomIn,
  ZoomOut,
  RotateCw,
  Search,
  Scan,
  Table
} from 'lucide-react';
import { storageService, StoredDocument, StoredHealthRecord } from '../services/storageService';
import { extractClinicalInformation } from '../services/geminiExtraction';

interface DocumentDetailViewProps {
  documentId: string;
  onNavigate: (path: string) => void;
}

export const DocumentDetailView: React.FC<DocumentDetailViewProps> = ({
  documentId,
  onNavigate,
}) => {
  const [docItem, setDocItem] = useState<StoredDocument | null>(null);
  const [existingRecord, setExistingRecord] = useState<StoredHealthRecord | null>(null);
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [totalPages, setTotalPages] = useState<number>(1);
  const [zoomLevel, setZoomLevel] = useState<number>(100);
  const [rotation, setRotation] = useState<number>(0);
  const [copied, setCopied] = useState(false);
  const [isExtracting, setIsExtracting] = useState(false);
  const [extractionStep, setExtractionStep] = useState<string>('');
  const [extractError, setExtractError] = useState<string | null>(null);

  useEffect(() => {
    loadDoc();
  }, [documentId]);

  const loadDoc = () => {
    const doc = storageService.getDocumentById(documentId);
    if (doc) {
      setDocItem(doc);
      setTotalPages(doc.pages || 1);
      const rec = storageService.getRecordByDocumentId(documentId);
      if (rec) setExistingRecord(rec);
    }
  };

  if (!docItem) {
    return (
      <div className="p-8 max-w-4xl mx-auto text-center space-y-4">
        <div className="p-8 bg-white rounded-2xl border border-slate-200">
          <AlertCircle className="w-10 h-10 text-slate-400 mx-auto mb-2" />
          <h2 className="text-lg font-bold text-slate-800">Document Not Found</h2>
          <p className="text-xs text-slate-500 mt-1">The requested document ID {documentId} does not exist.</p>
          <button
            onClick={() => onNavigate('/archive')}
            className="mt-4 px-4 py-2 rounded-lg bg-[#0F4C5C] text-white text-xs font-semibold cursor-pointer"
          >
            Back to Archive
          </button>
        </div>
      </div>
    );
  }

  const handleCopyText = async () => {
    if (!docItem.rawOcrText) return;
    await navigator.clipboard.writeText(docItem.rawOcrText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownloadJson = () => {
    const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(
      JSON.stringify(
        {
          document_id: docItem.id,
          filename: docItem.filename,
          pages: docItem.pages,
          ocr_engine: docItem.ocrEngine,
          ocr_confidence: docItem.ocrConfidence,
          raw_ocr_text: docItem.rawOcrText,
        },
        null,
        2
      )
    );
    const downloadAnchor = window.document.createElement('a');
    downloadAnchor.setAttribute('href', dataStr);
    downloadAnchor.setAttribute('download', `${docItem.id}_OCR.json`);
    window.document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };

  /**
   * Send OCR text to Gemini for clinical information extraction with step telemetry
   */
  const handleExtractWithGemini = async () => {
    setIsExtracting(true);
    setExtractError(null);
    setExtractionStep('1/3: Reading docTR text tokens & bounding positions...');

    try {
      setTimeout(() => {
        setExtractionStep('2/3: Applying conservative Gemini clinical grounding schema...');
      }, 700);

      const extracted = await extractClinicalInformation(
        docItem.rawOcrText,
        docItem.id,
        docItem.pages
      );

      setExtractionStep('3/3: Validating zero-hallucination rules and routing to review queue...');

      const recordId = `REC-${Date.now().toString().slice(-6)}`;
      const newRecord: StoredHealthRecord = {
        id: recordId,
        documentId: docItem.id,
        filename: docItem.filename,
        patientId: extracted.patient.hospital_number || null,
        hospitalNumber: extracted.patient.hospital_number || null,
        extractedAt: new Date().toISOString(),
        status: 'under_review',
        extractedData: extracted,
        reviewedData: JSON.parse(JSON.stringify(extracted)),
        corrections: [],
        reviewedBy: null,
        reviewedAt: null,
        isSynthetic: docItem.isSynthetic,
      };

      storageService.saveRecord(newRecord);
      setExistingRecord(newRecord);

      // Transition smoothly to Human Verification Workspace
      setTimeout(() => {
        onNavigate(`/review/${docItem.id}`);
      }, 400);
    } catch (err: any) {
      setExtractError(err.message || 'Failed to extract clinical information with Gemini.');
    } finally {
      setIsExtracting(false);
      setExtractionStep('');
    }
  };

  return (
    <div className="p-6 md:p-8 space-y-6 max-w-7xl mx-auto">
      {/* Top Navigation & Document Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <button
            onClick={() => onNavigate('/archive')}
            className="p-2 rounded-lg bg-white border border-slate-200 text-slate-600 hover:bg-slate-50 cursor-pointer"
            title="Back to archive"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-mono text-xs font-bold px-2 py-0.5 rounded bg-slate-800 text-teal-300">
                {docItem.id}
              </span>
              <h1 className="text-lg font-bold text-slate-900">{docItem.filename}</h1>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Engine: <strong className="text-slate-700">{docItem.ocrEngine}</strong> • Pages:{' '}
              <strong className="text-slate-700">{docItem.pages}</strong> • Processed:{' '}
              {docItem.dateProcessed}
            </p>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-3">
          <button
            onClick={() => onNavigate(`/deep-scan/${docItem.id}`)}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-purple-700 hover:bg-purple-800 text-white text-xs font-bold shadow-xs cursor-pointer"
            title="Open 3-panel Deep Scan & Tabularisation Workspace"
          >
            <Scan className="w-4 h-4 text-purple-200" />
            <span>Deep Scan & Tabularise</span>
          </button>

          {existingRecord ? (
            <button
              onClick={() => onNavigate(`/review/${docItem.id}`)}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold shadow-xs cursor-pointer"
            >
              <FileCheck2 className="w-4 h-4 text-indigo-200" />
              <span>
                {existingRecord.status === 'approved' ? 'View Approved Record' : 'Continue Human Review'}
              </span>
            </button>
          ) : (
            <button
              onClick={handleExtractWithGemini}
              disabled={isExtracting}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-teal-600 to-[#0F4C5C] hover:from-teal-500 hover:to-[#0c3c49] text-white text-xs font-bold shadow-xs transition-all disabled:opacity-50 cursor-pointer"
            >
              <Sparkles className={`w-4 h-4 text-teal-300 ${isExtracting ? 'animate-spin' : ''}`} />
              <span>{isExtracting ? 'Extracting Clinical Data...' : 'Extract Clinical Information'}</span>
            </button>
          )}
        </div>
      </div>

      {/* Progress or Error Banner */}
      {isExtracting && (
        <div className="p-4 rounded-xl bg-teal-50 border border-teal-200 text-teal-900 text-xs flex items-center gap-3 shadow-xs">
          <Sparkles className="w-5 h-5 text-teal-600 animate-spin shrink-0" />
          <div className="space-y-0.5">
            <span className="font-bold">Gemini Clinical Structuring in Progress:</span>
            <p className="text-teal-700 font-mono text-[11px]">{extractionStep}</p>
          </div>
        </div>
      )}

      {extractError && (
        <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-start gap-2 shadow-xs">
          <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
          <div>
            <span className="font-bold">Extraction Error:</span> {extractError}
          </div>
        </div>
      )}

      {/* Split-Screen Viewer */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 min-h-[620px]">
        {/* LEFT: Original Document Preview */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-xs flex flex-col overflow-hidden">
          <div className="px-5 py-3 border-b border-slate-100 flex items-center justify-between bg-slate-50">
            <span className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
              <Eye className="w-4 h-4 text-slate-500" /> Original Hospital Document Preview
            </span>

            {/* Viewer Zoom & Page Controls */}
            <div className="flex items-center gap-3 text-xs text-slate-600 font-medium">
              <div className="flex items-center gap-1 bg-white border border-slate-200 rounded px-1.5 py-0.5">
                <button
                  onClick={() => setZoomLevel((z) => Math.max(50, z - 25))}
                  className="p-1 hover:text-slate-900"
                  title="Zoom Out"
                >
                  <ZoomOut className="w-3.5 h-3.5" />
                </button>
                <span className="text-[10px] font-mono px-1">{zoomLevel}%</span>
                <button
                  onClick={() => setZoomLevel((z) => Math.min(200, z + 25))}
                  className="p-1 hover:text-slate-900"
                  title="Zoom In"
                >
                  <ZoomIn className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={() => setRotation((r) => (r + 90) % 360)}
                  className="p-1 hover:text-slate-900 border-l border-slate-200 ml-1 pl-1.5"
                  title="Rotate 90 degrees"
                >
                  <RotateCw className="w-3.5 h-3.5" />
                </button>
              </div>

              <div className="flex items-center gap-1">
                <button
                  disabled={currentPage <= 1}
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  className="p-1 rounded hover:bg-slate-200 disabled:opacity-30 cursor-pointer"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <span>
                  Page {currentPage} / {totalPages}
                </span>
                <button
                  disabled={currentPage >= totalPages}
                  onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                  className="p-1 rounded hover:bg-slate-200 disabled:opacity-30 cursor-pointer"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>

          <div className="flex-1 p-6 flex items-center justify-center bg-slate-100/60 overflow-auto">
            <div
              style={{
                transform: `scale(${zoomLevel / 100}) rotate(${rotation}deg)`,
                transformOrigin: 'center center',
                transition: 'transform 0.2s ease-out',
              }}
              className="max-w-full"
            >
              {docItem.fileDataUrl ? (
                <img
                  src={docItem.fileDataUrl}
                  alt={docItem.filename}
                  className="max-h-[520px] object-contain rounded-lg shadow-sm border border-slate-300"
                />
              ) : (
                <div className="w-full max-w-md bg-[#FAF9F6] border border-amber-200/90 rounded-xl p-8 shadow-md font-mono text-xs text-slate-800 space-y-4">
                  <div className="text-center border-b border-amber-300 pb-3">
                    <div className="font-bold text-sm text-slate-900 tracking-wider">
                      {docItem.filename.includes('luth')
                        ? 'LAGOS UNIVERSITY TEACHING HOSPITAL'
                        : docItem.filename.includes('uch')
                        ? 'UNIVERSITY COLLEGE HOSPITAL, IBADAN'
                        : 'NIGERIAN HEALTH ARCHIVE DIVISION'}
                    </div>
                    <div className="text-[10px] text-slate-500 uppercase mt-0.5">
                      Physical Paper Document Scan • {docItem.id}
                    </div>
                  </div>

                  <div className="space-y-2 text-[11px] leading-relaxed text-slate-700">
                    <div className="flex justify-between border-b border-slate-200 pb-1">
                      <span>RECORD ID: {docItem.id}</span>
                      <span>PAGE {currentPage} OF {totalPages}</span>
                    </div>
                    <div className="p-3 bg-white/90 rounded border border-slate-200 text-[10px] text-slate-600 leading-relaxed font-sans">
                      Physical paper document captured. Text lines detected and mapped to docTR OCR coordinate bounding boxes.
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* RIGHT: docTR Normalized OCR Output */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-xs flex flex-col overflow-hidden">
          <div className="px-5 py-3 border-b border-slate-100 flex items-center justify-between bg-slate-50">
            <div className="flex items-center gap-3">
              <span className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                <Cpu className="w-4 h-4 text-teal-600" /> docTR Normalized OCR Output
              </span>
              <span className="text-[11px] px-2 py-0.5 rounded bg-teal-100 text-teal-800 font-semibold">
                {docItem.ocrConfidence !== null
                  ? `Confidence: ${(docItem.ocrConfidence * 100).toFixed(0)}%`
                  : 'Confidence: Not provided'}
              </span>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={handleCopyText}
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg border border-slate-200 bg-white text-xs font-semibold text-slate-700 hover:bg-slate-100 cursor-pointer"
                title="Copy OCR raw text"
              >
                {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copied ? 'Copied' : 'Copy Text'}</span>
              </button>

              <button
                onClick={handleDownloadJson}
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg border border-slate-200 bg-white text-xs font-semibold text-slate-700 hover:bg-slate-100 cursor-pointer"
                title="Download docTR OCR JSON"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Download JSON</span>
              </button>
            </div>
          </div>

          <div className="flex-1 p-5 overflow-y-auto bg-slate-900 text-slate-100 font-mono text-xs leading-relaxed select-text">
            {docItem.rawOcrText ? (
              <pre className="whitespace-pre-wrap font-mono text-slate-200 text-xs">
                {docItem.rawOcrText}
              </pre>
            ) : (
              <div className="text-slate-500 italic p-4 text-center">
                No raw OCR text available for this document.
              </div>
            )}
          </div>

          <div className="px-5 py-3 border-t border-slate-100 bg-slate-50 flex items-center justify-between text-xs text-slate-500">
            <span>Raw docTR text preserved immutably as ground evidence.</span>
            {!existingRecord && (
              <button
                onClick={handleExtractWithGemini}
                disabled={isExtracting}
                className="text-teal-700 font-bold hover:underline cursor-pointer"
              >
                Structure with Gemini →
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
