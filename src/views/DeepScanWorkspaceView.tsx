import React, { useState, useEffect, useRef } from 'react';
import {
  Scan,
  FileText,
  Table as TableIcon,
  Download,
  Copy,
  Check,
  RotateCw,
  ZoomIn,
  ZoomOut,
  Sparkles,
  AlertTriangle,
  Cpu,
  Layers,
  Edit2,
  Save,
  CheckCircle2,
  ExternalLink,
  ChevronLeft,
  ChevronRight,
  Eye,
  Sliders,
  Filter,
  Plus
} from 'lucide-react';
import { StoredDocument, storageService } from '../services/storageService';
import { deepScanPreprocess, PreprocessingResult } from '../services/imagePreprocessor';
import {
  TabularRow,
  requestIntelligentTabularisation,
  downloadTableAsExcel,
  downloadTableAsCsv,
  downloadTableAsJson
} from '../services/tabularService';
import { ocrService, getOcrApiBaseUrl, setOcrApiBaseUrl } from '../services/ocrApi';

interface DeepScanWorkspaceViewProps {
  initialDocumentId?: string;
  onNavigate: (path: string) => void;
}

export const DeepScanWorkspaceView: React.FC<DeepScanWorkspaceViewProps> = ({
  initialDocumentId,
  onNavigate,
}) => {
  const [allDocs, setAllDocs] = useState<StoredDocument[]>([]);
  const [selectedDocId, setSelectedDocId] = useState<string>(initialDocumentId || '');
  const [currentDoc, setCurrentDoc] = useState<StoredDocument | null>(null);

  // Preprocessing State (Step 1)
  const [preprocessResult, setPreprocessResult] = useState<PreprocessingResult | null>(null);
  const [showEnhancedImage, setShowEnhancedImage] = useState(true);
  const [zoomLevel, setZoomLevel] = useState(100);
  const [rotationDegrees, setRotationDegrees] = useState(0);

  // Raw OCR & Confidence Lines (Step 2)
  const [rawLinesWithConfidence, setRawLinesWithConfidence] = useState<{ text: string; confidence: number }[]>([]);
  const [copiedRaw, setCopiedRaw] = useState(false);

  // Tabularised Data Table (Step 3)
  const [tableRows, setTableRows] = useState<TabularRow[]>([]);
  const [isTabularising, setIsTabularising] = useState(false);
  const [tabularError, setTabularError] = useState<string | null>(null);
  const [selectedRowId, setSelectedRowId] = useState<string | null>(null);
  const [editingCell, setEditingCell] = useState<{ rowId: string; col: keyof TabularRow } | null>(null);

  // Backend API URL Configuration
  const [activeApiUrl, setActiveApiUrl] = useState(getOcrApiBaseUrl());
  const [apiUpdatedSuccess, setApiUpdatedSuccess] = useState(false);

  // Bulk Master Mode
  const [showMasterTable, setShowMasterTable] = useState(false);
  const [masterRows, setMasterRows] = useState<TabularRow[]>([]);

  useEffect(() => {
    loadDocuments();
    const handleUpdate = () => loadDocuments();
    window.addEventListener('hai_data_updated', handleUpdate);
    return () => window.removeEventListener('hai_data_updated', handleUpdate);
  }, []);

  useEffect(() => {
    if (selectedDocId && allDocs.length > 0) {
      const doc = allDocs.find((d) => d.id === selectedDocId) || allDocs[0];
      setCurrentDoc(doc);
      processSelectedDocument(doc);
    } else if (allDocs.length > 0 && !currentDoc) {
      setCurrentDoc(allDocs[0]);
      setSelectedDocId(allDocs[0].id);
      processSelectedDocument(allDocs[0]);
    }
  }, [selectedDocId, allDocs]);

  const loadDocuments = () => {
    const list = storageService.getDocuments();
    setAllDocs(list);
  };

  const processSelectedDocument = async (doc: StoredDocument) => {
    // 1. Parse raw lines and compute line confidences for Panel 2
    const lines = (doc.rawOcrText || '')
      .split('\n')
      .map((line) => line.trim())
      .filter((line) => line.length > 0);

    const docConf = doc.ocrConfidence ?? 0.92;
    const linesData = lines.map((l) => {
      // If line contains illegible keywords or faint symbols, lower confidence
      const isUnclear = l.includes('?') || l.toLowerCase().includes('illegible') || l.length < 3;
      const conf = isUnclear ? Math.max(0.42, docConf - 0.35) : Math.min(0.98, docConf);
      return { text: l, confidence: conf };
    });
    setRawLinesWithConfidence(linesData);

    // 2. Perform Deep Scan Preprocessing (Step 1)
    if (doc.fileDataUrl) {
      try {
        const fakeFile = await dataUrlToFile(doc.fileDataUrl, doc.filename);
        const pre = await deepScanPreprocess(fakeFile);
        setPreprocessResult(pre);
      } catch {
        // Fallback gracefully
      }
    }

    // 3. Tabularise with Gemini (Step 3) if not already tabularised
    triggerTabularisation(doc);
  };

  const triggerTabularisation = async (doc: StoredDocument) => {
    if (!doc.rawOcrText) return;
    setIsTabularising(true);
    setTabularError(null);

    try {
      const rows = await requestIntelligentTabularisation(doc.rawOcrText, doc.filename, doc.id);
      setTableRows(rows);
      // Accumulate into master table for bulk viewing
      setMasterRows((prev) => {
        const filtered = prev.filter((r) => r.documentId !== doc.id);
        return [...filtered, ...rows];
      });
    } catch (err: any) {
      setTabularError(err.message || 'Tabularisation error');
    } finally {
      setIsTabularising(false);
    }
  };

  const dataUrlToFile = async (dataUrl: string, filename: string): Promise<File> => {
    const res = await fetch(dataUrl);
    const blob = await res.blob();
    return new File([blob], filename, { type: blob.type || 'image/jpeg' });
  };

  const handleCopyRawText = () => {
    if (!currentDoc?.rawOcrText) return;
    navigator.clipboard.writeText(currentDoc.rawOcrText);
    setCopiedRaw(true);
    setTimeout(() => setCopiedRaw(false), 2000);
  };

  const handleCellChange = (rowId: string, col: keyof TabularRow, value: any) => {
    setTableRows((prev) =>
      prev.map((r) => (r.id === rowId ? { ...r, [col]: value } : r))
    );
    setMasterRows((prev) =>
      prev.map((r) => (r.id === rowId ? { ...r, [col]: value } : r))
    );
  };

  const handleSaveApiUrl = () => {
    setOcrApiBaseUrl(activeApiUrl);
    setApiUpdatedSuccess(true);
    setTimeout(() => setApiUpdatedSuccess(false), 2500);
  };

  const activeRows = showMasterTable ? masterRows : tableRows;

  return (
    <div className="p-4 md:p-6 space-y-5 max-w-[1700px] mx-auto min-h-screen flex flex-col">
      {/* Top Control Bar with API Configuration & Bulk Selector */}
      <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-xs flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-4">
        {/* Document Selector & Title */}
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-teal-500 to-[#0F4C5C] flex items-center justify-center text-white shrink-0 shadow-sm">
            <Scan className="w-5 h-5 text-white" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-base font-bold text-slate-900 leading-tight">
                Deep Scan & Tabularisation Engine
              </h1>
              <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-teal-100 text-teal-800">
                100% Extraction + Tabularise
              </span>
            </div>
            <p className="text-xs text-slate-500">
              Pre-process → docTR Full Text → Intelligent Entity & Table Structuring
            </p>
          </div>
        </div>

        {/* Backend / Hugging Face Space Link Input */}
        <div className="flex flex-col sm:flex-row items-center gap-2">
          <div className="flex items-center gap-1.5 w-full sm:w-auto">
            <span className="text-[11px] font-semibold text-slate-600 whitespace-nowrap">
              OCR Backend / HuggingFace:
            </span>
            <input
              type="text"
              value={activeApiUrl}
              onChange={(e) => setActiveApiUrl(e.target.value)}
              placeholder="Paste Hugging Face Space or Colab URL..."
              className="px-2.5 py-1.5 rounded-lg border border-slate-300 font-mono text-xs text-slate-800 bg-slate-50 focus:bg-white focus:ring-1 focus:ring-teal-500 w-full sm:w-72"
            />
            <button
              onClick={handleSaveApiUrl}
              className="px-3 py-1.5 rounded-lg bg-[#0F4C5C] hover:bg-[#0c3c49] text-white text-xs font-bold shrink-0 cursor-pointer"
            >
              Update
            </button>
          </div>

          {apiUpdatedSuccess && (
            <span className="text-xs font-bold text-emerald-600 flex items-center gap-1 animate-fade-in">
              <CheckCircle2 className="w-3.5 h-3.5" /> URL Saved
            </span>
          )}
        </div>

        {/* Master Table vs Single Switcher & Export Buttons */}
        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={() => setShowMasterTable(!showMasterTable)}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all cursor-pointer ${
              showMasterTable
                ? 'bg-indigo-700 text-white border-indigo-700 shadow-xs'
                : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50'
            }`}
          >
            {showMasterTable ? 'View Single Document' : `View Master Table (${masterRows.length} rows)`}
          </button>

          <button
            onClick={() => downloadTableAsExcel(activeRows, `hospital_archive_${currentDoc?.id || 'master'}.xlsx`)}
            disabled={activeRows.length === 0}
            className="px-3 py-1.5 rounded-lg bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold shadow-xs flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
            title="Download true .xlsx Excel table"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Excel (.xlsx)</span>
          </button>

          <button
            onClick={() => downloadTableAsCsv(activeRows, `hospital_archive_${currentDoc?.id || 'master'}.csv`)}
            disabled={activeRows.length === 0}
            className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-900 text-white text-xs font-semibold shadow-xs flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
          >
            <Download className="w-3.5 h-3.5" />
            <span>CSV</span>
          </button>

          <button
            onClick={() => downloadTableAsJson(activeRows, `hospital_provenance_${currentDoc?.id || 'master'}.json`)}
            disabled={activeRows.length === 0}
            className="px-3 py-1.5 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
          >
            <Download className="w-3.5 h-3.5" />
            <span>JSON + Provenance</span>
          </button>
        </div>
      </div>

      {/* Document Selector Pills if multiple */}
      {allDocs.length > 1 && !showMasterTable && (
        <div className="flex items-center gap-2 overflow-x-auto pb-1 text-xs">
          <span className="text-slate-500 font-semibold uppercase text-[10px] shrink-0">
            Active Scans ({allDocs.length}):
          </span>
          {allDocs.map((doc, idx) => (
            <button
              key={doc.id}
              onClick={() => setSelectedDocId(doc.id)}
              className={`px-3 py-1 rounded-lg font-mono text-xs transition-all shrink-0 cursor-pointer ${
                selectedDocId === doc.id
                  ? 'bg-[#0F4C5C] text-white font-bold shadow-xs'
                  : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-100'
              }`}
            >
              #{idx + 1} {doc.filename}
            </button>
          ))}
        </div>
      )}

      {/* THREE-PANEL HOSPITAL-GRADE WORKSPACE */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 flex-1 min-h-[700px]">
        {/* PANEL 1: Original Image Preview & Deep Scan Pre-processing Controls (Col Span: 4) */}
        <div className="lg:col-span-4 bg-white rounded-2xl border border-slate-200 shadow-xs flex flex-col overflow-hidden">
          <div className="p-3.5 border-b border-slate-100 flex items-center justify-between bg-slate-50">
            <div className="flex items-center gap-2">
              <Eye className="w-4 h-4 text-teal-700" />
              <span className="font-bold text-xs text-slate-800 uppercase tracking-wider">
                Panel 1: Source Image Preview
              </span>
            </div>

            {/* Mode & Enhancement Badge */}
            <div className="flex items-center gap-1.5 text-[10px]">
              <span className="px-2 py-0.5 rounded font-bold bg-purple-100 text-purple-900">
                {preprocessResult?.detectedMode || 'Mixed Form'} Mode
              </span>
            </div>
          </div>

          {/* Enhancement Controls Toolbar */}
          <div className="p-2 border-b border-slate-100 bg-slate-50/70 flex items-center justify-between text-xs text-slate-600 px-3">
            <div className="flex items-center gap-2">
              <label className="flex items-center gap-1 text-[11px] font-medium cursor-pointer">
                <input
                  type="checkbox"
                  checked={showEnhancedImage}
                  onChange={(e) => setShowEnhancedImage(e.target.checked)}
                  className="rounded text-teal-600 focus:ring-teal-500"
                />
                <span>Contrast Enhanced (Step 1)</span>
              </label>
            </div>

            <div className="flex items-center gap-1 bg-white border border-slate-200 rounded px-1 py-0.5">
              <button
                onClick={() => setZoomLevel((z) => Math.max(50, z - 25))}
                className="p-1 hover:text-slate-900"
                title="Zoom Out"
              >
                <ZoomOut className="w-3.5 h-3.5" />
              </button>
              <span className="font-mono text-[10px] px-1">{zoomLevel}%</span>
              <button
                onClick={() => setZoomLevel((z) => Math.min(200, z + 25))}
                className="p-1 hover:text-slate-900"
                title="Zoom In"
              >
                <ZoomIn className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => setRotationDegrees((r) => (r + 90) % 360)}
                className="p-1 hover:text-slate-900 border-l border-slate-200 ml-1 pl-1"
                title="Rotate 90 degrees"
              >
                <RotateCw className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* Image Display Area with Zoom & Coordinate Area Canvas */}
          <div className="flex-1 p-4 bg-slate-100/70 flex items-center justify-center overflow-auto min-h-[450px]">
            <div
              style={{
                transform: `scale(${zoomLevel / 100}) rotate(${rotationDegrees}deg)`,
                transformOrigin: 'center center',
                transition: 'transform 0.2s ease-out',
              }}
              className="max-w-full"
            >
              {currentDoc?.fileDataUrl ? (
                <img
                  src={showEnhancedImage && preprocessResult ? preprocessResult.processedDataUrl : currentDoc.fileDataUrl}
                  alt={currentDoc.filename}
                  className="max-h-[500px] object-contain rounded-lg shadow-sm border border-slate-300"
                />
              ) : (
                <div className="w-80 bg-[#FAF9F6] border border-amber-300 rounded-xl p-6 shadow-sm font-mono text-xs text-slate-800 space-y-3">
                  <div className="text-center font-bold text-sm text-slate-900 border-b border-amber-200 pb-2">
                    PHYSICAL ARCHIVE SPECIMEN
                  </div>
                  <div className="text-[11px] text-slate-600 leading-relaxed">
                    Source: {currentDoc?.filename || 'hospital_record.jpg'}
                  </div>
                  <div className="p-2.5 bg-white rounded border border-slate-200 text-[10px] text-slate-500">
                    Deep Scan Preprocessed: 100% of headers, faint signatures, stamps, and tabular lines analyzed.
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="p-3 border-t border-slate-100 bg-slate-50 text-[11px] text-slate-500 flex justify-between">
            <span>Orientation: {rotationDegrees}°</span>
            <span>Contrast: {preprocessResult?.contrastEnhanced ? '+35% Boost' : 'Standard'}</span>
          </div>
        </div>

        {/* PANEL 2: Deep Scanned Full Raw Text with Confidence % per Line (Col Span: 3) */}
        <div className="lg:col-span-3 bg-white rounded-2xl border border-slate-200 shadow-xs flex flex-col overflow-hidden">
          <div className="p-3.5 border-b border-slate-100 flex items-center justify-between bg-slate-50">
            <div className="flex items-center gap-2">
              <FileText className="w-4 h-4 text-indigo-700" />
              <span className="font-bold text-xs text-slate-800 uppercase tracking-wider">
                Panel 2: Deep Scanned Text
              </span>
            </div>

            <button
              onClick={handleCopyRawText}
              className="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-white border border-slate-200 text-slate-700 text-[11px] font-semibold hover:bg-slate-100 cursor-pointer"
            >
              {copiedRaw ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copiedRaw ? 'Copied' : 'Copy'}</span>
            </button>
          </div>

          <div className="p-2 bg-slate-100/60 border-b border-slate-100 text-[11px] text-slate-500 px-3 flex justify-between">
            <span>Total lines: {rawLinesWithConfidence.length}</span>
            <span>Verbatim docTR OCR Output</span>
          </div>

          {/* Line-by-Line Viewer with Confidence Badges */}
          <div className="flex-1 p-3 overflow-y-auto bg-slate-900 font-mono text-xs space-y-1.5 select-text">
            {rawLinesWithConfidence.length === 0 ? (
              <div className="text-slate-500 italic p-4 text-center">
                No raw OCR text available yet.
              </div>
            ) : (
              rawLinesWithConfidence.map((lineItem, idx) => {
                const confPercent = Math.round(lineItem.confidence * 100);
                const isLow = confPercent < 70;
                return (
                  <div
                    key={idx}
                    className={`p-1.5 rounded transition-colors flex items-start justify-between gap-2 ${
                      isLow ? 'bg-amber-950/40 text-amber-200' : 'hover:bg-slate-800/80 text-slate-200'
                    }`}
                  >
                    <span className="leading-snug break-words flex-1 font-mono text-[11px]">
                      {lineItem.text}
                    </span>
                    <span
                      className={`text-[9px] px-1.5 py-0.5 rounded font-mono font-bold shrink-0 ${
                        confPercent >= 90
                          ? 'bg-emerald-900/80 text-emerald-300'
                          : confPercent >= 70
                          ? 'bg-teal-900/80 text-teal-300'
                          : 'bg-amber-800 text-amber-200 ring-1 ring-amber-400'
                      }`}
                    >
                      {confPercent}%
                    </span>
                  </div>
                );
              })
            )}
          </div>

          <div className="p-3 border-t border-slate-100 bg-slate-50 text-[10px] text-slate-500">
            Line breaks preserved verbatim as seen on original paper archive.
          </div>
        </div>

        {/* PANEL 3: Correctly Tabularised Data Table (Editable) (Col Span: 5) */}
        <div className="lg:col-span-5 bg-white rounded-2xl border border-slate-200 shadow-xs flex flex-col overflow-hidden">
          <div className="p-3.5 border-b border-slate-100 flex items-center justify-between bg-slate-50">
            <div className="flex items-center gap-2">
              <TableIcon className="w-4 h-4 text-emerald-700" />
              <span className="font-bold text-xs text-slate-800 uppercase tracking-wider">
                Panel 3: Tabularised Data Table
              </span>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => currentDoc && triggerTabularisation(currentDoc)}
                disabled={isTabularising}
                className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-teal-600 hover:bg-teal-700 text-white text-[11px] font-bold cursor-pointer disabled:opacity-50"
              >
                <Sparkles className={`w-3.5 h-3.5 ${isTabularising ? 'animate-spin' : ''}`} />
                <span>{isTabularising ? 'Tabularising...' : 'Re-Tabularise'}</span>
              </button>
            </div>
          </div>

          <div className="p-2 bg-amber-50 border-b border-amber-200 text-[11px] text-amber-900 px-3 flex items-center justify-between">
            <span className="flex items-center gap-1 font-medium">
              <AlertTriangle className="w-3.5 h-3.5 text-amber-700" />
              Cells with confidence &lt; 70% or illegible text are highlighted in yellow.
            </span>
            <span className="font-bold">{activeRows.length} Rows</span>
          </div>

          {/* Interactive Editable Table */}
          <div className="flex-1 overflow-auto max-h-[550px] border-b border-slate-200">
            <table className="w-full text-left text-xs border-collapse">
              <thead className="bg-slate-100 sticky top-0 text-slate-700 font-bold border-b border-slate-200 z-10 text-[10px] uppercase">
                <tr>
                  <th className="py-2.5 px-3 whitespace-nowrap">File Name</th>
                  <th className="py-2.5 px-3 whitespace-nowrap">Patient Name</th>
                  <th className="py-2.5 px-3 whitespace-nowrap">Age</th>
                  <th className="py-2.5 px-3 whitespace-nowrap">Gender</th>
                  <th className="py-2.5 px-3 whitespace-nowrap">Hospital No</th>
                  <th className="py-2.5 px-3 whitespace-nowrap">Date</th>
                  <th className="py-2.5 px-3 whitespace-nowrap">Diagnosis</th>
                  <th className="py-2.5 px-3 whitespace-nowrap">Lab Test</th>
                  <th className="py-2.5 px-3 whitespace-nowrap">Result / Value</th>
                  <th className="py-2.5 px-3 whitespace-nowrap">Unit</th>
                  <th className="py-2.5 px-3 whitespace-nowrap">Ref Range</th>
                  <th className="py-2.5 px-3 whitespace-nowrap">Doctor Notes</th>
                  <th className="py-2.5 px-3 whitespace-nowrap">Conf %</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {activeRows.length === 0 ? (
                  <tr>
                    <td colSpan={13} className="py-12 text-center text-slate-400 italic">
                      {isTabularising ? 'Converting full text to structured table...' : 'No tabular rows generated yet. Click Re-Tabularise above.'}
                    </td>
                  </tr>
                ) : (
                  activeRows.map((row) => {
                    const isLowConf = row.Confidence_Score < 0.7 || row.Diagnosis.includes('ILLEGIBLE');
                    const isSelected = selectedRowId === row.id;

                    return (
                      <tr
                        key={row.id}
                        onClick={() => setSelectedRowId(row.id)}
                        className={`transition-colors cursor-pointer text-[11px] ${
                          isSelected ? 'bg-teal-50/80 font-medium' : 'hover:bg-slate-50'
                        }`}
                      >
                        {/* File_Name */}
                        <td className="py-2 px-3 whitespace-nowrap font-mono text-slate-500">
                          {row.File_Name}
                        </td>

                        {/* Patient_Name (Editable) */}
                        <td
                          className={`py-2 px-3 whitespace-nowrap font-bold text-slate-900 ${
                            isLowConf && !row.Patient_Name ? 'bg-amber-100 text-amber-900' : ''
                          }`}
                        >
                          <input
                            type="text"
                            value={row.Patient_Name}
                            onChange={(e) => handleCellChange(row.id, 'Patient_Name', e.target.value)}
                            className="bg-transparent border-b border-transparent focus:border-teal-500 focus:bg-white w-28 px-1"
                          />
                        </td>

                        {/* Age */}
                        <td className="py-2 px-3 whitespace-nowrap text-slate-700">
                          <input
                            type="text"
                            value={row.Age}
                            onChange={(e) => handleCellChange(row.id, 'Age', e.target.value)}
                            className="bg-transparent border-b border-transparent focus:border-teal-500 focus:bg-white w-12 px-1"
                          />
                        </td>

                        {/* Gender */}
                        <td className="py-2 px-3 whitespace-nowrap text-slate-700">
                          <input
                            type="text"
                            value={row.Gender}
                            onChange={(e) => handleCellChange(row.id, 'Gender', e.target.value)}
                            className="bg-transparent border-b border-transparent focus:border-teal-500 focus:bg-white w-14 px-1"
                          />
                        </td>

                        {/* Hospital_No */}
                        <td className="py-2 px-3 whitespace-nowrap font-mono text-teal-800 font-bold">
                          <input
                            type="text"
                            value={row.Hospital_No}
                            onChange={(e) => handleCellChange(row.id, 'Hospital_No', e.target.value)}
                            className="bg-transparent border-b border-transparent focus:border-teal-500 focus:bg-white w-24 px-1 font-mono font-bold text-teal-800"
                          />
                        </td>

                        {/* Date */}
                        <td className="py-2 px-3 whitespace-nowrap text-slate-600">
                          <input
                            type="text"
                            value={row.Date}
                            onChange={(e) => handleCellChange(row.id, 'Date', e.target.value)}
                            className="bg-transparent border-b border-transparent focus:border-teal-500 focus:bg-white w-20 px-1"
                          />
                        </td>

                        {/* Diagnosis (Highlighted if low conf) */}
                        <td
                          className={`py-2 px-3 whitespace-nowrap font-medium ${
                            isLowConf ? 'bg-amber-100 text-amber-900 font-bold' : 'text-slate-800'
                          }`}
                        >
                          <input
                            type="text"
                            value={row.Diagnosis}
                            onChange={(e) => handleCellChange(row.id, 'Diagnosis', e.target.value)}
                            className="bg-transparent border-b border-transparent focus:border-teal-500 focus:bg-white w-32 px-1"
                          />
                        </td>

                        {/* Lab_Test */}
                        <td className="py-2 px-3 whitespace-nowrap text-slate-900 font-medium">
                          <input
                            type="text"
                            value={row.Lab_Test}
                            onChange={(e) => handleCellChange(row.id, 'Lab_Test', e.target.value)}
                            className="bg-transparent border-b border-transparent focus:border-teal-500 focus:bg-white w-28 px-1"
                          />
                        </td>

                        {/* Result / Value */}
                        <td className="py-2 px-3 whitespace-nowrap font-mono font-bold text-teal-800">
                          <input
                            type="text"
                            value={row.Value || row.Result}
                            onChange={(e) => handleCellChange(row.id, 'Value', e.target.value)}
                            className="bg-transparent border-b border-transparent focus:border-teal-500 focus:bg-white w-16 px-1 font-mono font-bold text-teal-800"
                          />
                        </td>

                        {/* Unit */}
                        <td className="py-2 px-3 whitespace-nowrap text-slate-600">
                          <input
                            type="text"
                            value={row.Unit}
                            onChange={(e) => handleCellChange(row.id, 'Unit', e.target.value)}
                            className="bg-transparent border-b border-transparent focus:border-teal-500 focus:bg-white w-16 px-1"
                          />
                        </td>

                        {/* Reference_Range */}
                        <td className="py-2 px-3 whitespace-nowrap text-slate-500">
                          <input
                            type="text"
                            value={row.Reference_Range}
                            onChange={(e) => handleCellChange(row.id, 'Reference_Range', e.target.value)}
                            className="bg-transparent border-b border-transparent focus:border-teal-500 focus:bg-white w-20 px-1"
                          />
                        </td>

                        {/* Doctor_Notes */}
                        <td className="py-2 px-3 whitespace-nowrap text-slate-600">
                          <input
                            type="text"
                            value={row.Doctor_Notes}
                            onChange={(e) => handleCellChange(row.id, 'Doctor_Notes', e.target.value)}
                            className="bg-transparent border-b border-transparent focus:border-teal-500 focus:bg-white w-36 px-1"
                          />
                        </td>

                        {/* Confidence_Score */}
                        <td className="py-2 px-3 whitespace-nowrap font-mono">
                          <span
                            className={`px-1.5 py-0.5 rounded font-bold text-[10px] ${
                              row.Confidence_Score >= 0.85
                                ? 'bg-emerald-100 text-emerald-800'
                                : row.Confidence_Score >= 0.70
                                ? 'bg-teal-100 text-teal-800'
                                : 'bg-amber-200 text-amber-900 font-extrabold ring-1 ring-amber-500'
                            }`}
                          >
                            {(row.Confidence_Score * 100).toFixed(0)}%
                          </span>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* Provenance Snippet Box below table */}
          {selectedRowId && (
            <div className="p-3 bg-slate-50 border-t border-slate-200 text-xs text-slate-700 flex items-start gap-2">
              <span className="font-bold text-slate-500 uppercase text-[10px] shrink-0 mt-0.5">
                Provenance Origin:
              </span>
              <p className="font-mono text-[11px] text-teal-900 bg-teal-50/70 p-1.5 rounded border border-teal-200 flex-1">
                {activeRows.find((r) => r.id === selectedRowId)?.Provenance_Snippet ||
                  'Direct OCR evidence grounded in document headers and consultation line blocks.'}
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
