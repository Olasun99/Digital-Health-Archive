import React, { useState, useEffect } from 'react';
import {
  Database,
  Table as TableIcon,
  Download,
  Filter,
  Search,
  Sparkles,
  CheckCircle2,
  Trash2,
  RefreshCw,
  Plus,
  SlidersHorizontal,
  Layers,
  ArrowRight,
  ShieldCheck,
  Check,
  FileSpreadsheet,
  FileText,
  Activity,
  AlertCircle
} from 'lucide-react';
import { storageService, StoredDocument } from '../services/storageService';
import {
  jsonListToCleanDataFrame,
  CleanDataFrameRow,
  DataFrameTelemetry,
  IMPORTANT_COLUMNS,
  downloadDataFrameExcel,
  downloadDataFrameCsv
} from '../services/dataFrameEngine';

interface DataFrameStudioViewProps {
  onNavigate: (path: string) => void;
}

export const DataFrameStudioView: React.FC<DataFrameStudioViewProps> = ({ onNavigate }) => {
  const [documents, setDocuments] = useState<StoredDocument[]>([]);
  const [dataFrameRows, setDataFrameRows] = useState<CleanDataFrameRow[]>([]);
  const [activeColumns, setActiveColumns] = useState<string[]>([]);
  const [telemetry, setTelemetry] = useState<DataFrameTelemetry | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedColumnFilter, setSelectedColumnFilter] = useState<string>('all');
  const [isProcessing, setIsProcessing] = useState(false);
  const [showFhirPreview, setShowFhirPreview] = useState(false);
  const [saveBanner, setSaveBanner] = useState(false);

  useEffect(() => {
    loadAndTransformData();
    const handleUpdate = () => loadAndTransformData();
    window.addEventListener('hai_data_updated', handleUpdate);
    return () => window.removeEventListener('hai_data_updated', handleUpdate);
  }, []);

  const loadAndTransformData = () => {
    setIsProcessing(true);
    const docs = storageService.getDocuments();
    setDocuments(docs);

    if (docs.length > 0) {
      // Map stored documents into raw JSON items expected by the pandas transformation pipeline
      const jsonList = docs.map((d) => ({
        file: d.filename,
        filename: d.filename,
        raw_text: d.rawOcrText,
        pages: d.pages,
      }));

      // Execute Steps 1, 2, 3: Clean JSON → Whitelist Extraction → Pandas DataFrame
      const result = jsonListToCleanDataFrame(jsonList);
      setDataFrameRows(result.rows);
      setActiveColumns(result.activeColumns);
      setTelemetry(result.telemetry);
    } else {
      setDataFrameRows([]);
      setActiveColumns([...IMPORTANT_COLUMNS]);
      setTelemetry({
        filesProcessed: 0,
        noisyTokensRemoved: 0,
        importantColumnsKept: IMPORTANT_COLUMNS.length,
        cleanRowsProduced: 0,
        activeColumns: [...IMPORTANT_COLUMNS],
      });
    }
    setIsProcessing(false);
  };

  const handleCellEdit = (rowIndex: number, columnKey: string, newValue: string) => {
    setDataFrameRows((prev) => {
      const updated = [...prev];
      updated[rowIndex] = {
        ...updated[rowIndex],
        [columnKey]: newValue,
      };
      return updated;
    });
  };

  const handleDeleteRow = (rowIndex: number) => {
    setDataFrameRows((prev) => prev.filter((_, idx) => idx !== rowIndex));
    setSaveBanner(true);
    setTimeout(() => setSaveBanner(false), 2000);
  };

  const filteredRows = dataFrameRows.filter((row) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return Object.values(row).some((val) => typeof val === 'string' && val.toLowerCase().includes(q));
  });

  return (
    <div className="p-4 md:p-8 space-y-6 max-w-[1700px] mx-auto min-h-screen flex flex-col font-sans">
      {/* Figma-Style Header & Action Center */}
      <div className="bg-white rounded-2xl border border-slate-200/90 p-5 md:p-6 shadow-xs flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4">
        <div className="flex items-center gap-3.5">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-slate-900 to-teal-700 flex items-center justify-center text-white shadow-md shrink-0">
            <Database className="w-6 h-6 text-teal-300" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-lg md:text-xl font-bold text-slate-900 tracking-tight">
                Clinical Data Management Studio
              </h1>
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-teal-100 text-teal-800 border border-teal-200 uppercase tracking-wider">
                Pandas DataFrame Engine
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Automated 4-step pipeline: JSON Noise Cleaning → 18 Medical Entity Whitelisting → DataFrame Deduplication → DHIS2/FHIR Ready Export
            </p>
          </div>
        </div>

        {/* Primary Export & Action Buttons */}
        <div className="flex items-center gap-2.5 flex-wrap w-full lg:w-auto justify-end">
          <button
            onClick={() => loadAndTransformData()}
            disabled={isProcessing}
            className="px-3 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer disabled:opacity-50"
            title="Re-run clean JSON-to-DataFrame pipeline"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isProcessing ? 'animate-spin' : ''}`} />
            <span>Re-Run Pipeline</span>
          </button>

          <button
            onClick={() => setShowFhirPreview(!showFhirPreview)}
            className={`px-3 py-2 rounded-xl border text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer ${
              showFhirPreview
                ? 'bg-purple-700 text-white border-purple-700 shadow-xs'
                : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50'
            }`}
          >
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>{showFhirPreview ? 'Hide FHIR Schema' : 'DHIS2 / FHIR Ready'}</span>
          </button>

          <button
            onClick={() => downloadDataFrameExcel(filteredRows, activeColumns)}
            disabled={filteredRows.length === 0}
            className="px-4 py-2 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold shadow-xs flex items-center gap-1.5 transition-all cursor-pointer disabled:opacity-50"
            title="Download clean Excel spreadsheet"
          >
            <FileSpreadsheet className="w-4 h-4 text-emerald-200" />
            <span>Download Clean Excel</span>
          </button>

          <button
            onClick={() => downloadDataFrameCsv(filteredRows, activeColumns)}
            disabled={filteredRows.length === 0}
            className="px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold shadow-xs flex items-center gap-1.5 transition-all cursor-pointer disabled:opacity-50"
            title="Download clean CSV"
          >
            <Download className="w-4 h-4 text-slate-300" />
            <span>Download Clean CSV</span>
          </button>
        </div>
      </div>

      {/* Mandatory Telemetry Banner:
          "Extracted 20 files → Removed 150 noisy words → Kept 8 important columns → 20 clean rows" */}
      {telemetry && (
        <div className="bg-gradient-to-r from-teal-50 via-slate-50 to-indigo-50 border border-teal-200/90 rounded-2xl p-4 md:p-5 shadow-xs flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-teal-600 text-white flex items-center justify-center shrink-0 shadow-xs">
              <Sparkles className="w-4 h-4" />
            </div>
            <div>
              <div className="text-[11px] font-bold text-teal-900 uppercase tracking-wider">
                Data Management Pipeline Telemetry
              </div>
              <div className="text-xs md:text-sm font-semibold text-slate-800 flex items-center gap-2 flex-wrap mt-0.5">
                <span className="font-mono bg-white px-2 py-0.5 rounded border border-teal-200 text-slate-900 font-bold">
                  Extracted {telemetry.filesProcessed} files
                </span>
                <span className="text-teal-600 font-bold">→</span>
                <span className="font-mono bg-white px-2 py-0.5 rounded border border-rose-200 text-rose-800 font-bold">
                  Removed {telemetry.noisyTokensRemoved} noisy tokens (&lt; 0.40 conf / symbols)
                </span>
                <span className="text-teal-600 font-bold">→</span>
                <span className="font-mono bg-white px-2 py-0.5 rounded border border-purple-200 text-purple-900 font-bold">
                  Kept {telemetry.importantColumnsKept} important columns
                </span>
                <span className="text-teal-600 font-bold">→</span>
                <span className="font-mono bg-white px-2 py-0.5 rounded border border-emerald-200 text-emerald-900 font-bold">
                  {telemetry.cleanRowsProduced} clean rows ready
                </span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 text-xs text-slate-500 shrink-0">
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-800 font-bold text-[11px]">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" /> Zero Raw JSON Shown
            </span>
          </div>
        </div>
      )}

      {/* FHIR / DHIS2 Interoperability Preview Card (Collapsible) */}
      {showFhirPreview && (
        <div className="bg-purple-900 text-white rounded-2xl p-5 shadow-lg border border-purple-800 space-y-3 animate-fade-in">
          <div className="flex items-center justify-between border-b border-purple-800/80 pb-2">
            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-purple-200">
              <ShieldCheck className="w-4 h-4 text-teal-400" />
              <span>National Health Standards Alignment: FHIR R4 & DHIS2 Schema Ready</span>
            </div>
            <span className="text-[10px] bg-purple-800 px-2 py-0.5 rounded text-purple-200 font-mono">
              Federal Ministry of Health Interoperability Target
            </span>
          </div>
          <p className="text-xs text-purple-200 leading-relaxed max-w-4xl">
            This clean DataFrame adheres strictly to the 18 whitelisted clinical entities. Columns map directly into
            FHIR R4 resources (<code className="text-teal-300 font-mono">Patient</code>,{' '}
            <code className="text-teal-300 font-mono">Condition</code>,{' '}
            <code className="text-teal-300 font-mono">Observation</code>, and{' '}
            <code className="text-teal-300 font-mono">MedicationRequest</code>) and DHIS2 aggregate data-element values
            without unnecessary metadata or junk OCR tokens.
          </p>
        </div>
      )}

      {/* Filter & Search Bar */}
      <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-xs flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search cleaned DataFrame by patient name, diagnosis, MRN, lab test, drug name, or date..."
            className="w-full pl-10 pr-4 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 font-medium"
          />
        </div>

        <div className="flex items-center gap-2 overflow-x-auto text-xs text-slate-600">
          <span className="font-semibold text-slate-400 text-[11px] uppercase whitespace-nowrap">
            Showing:
          </span>
          <span className="px-2.5 py-1 rounded-lg bg-teal-50 text-teal-800 border border-teal-200 font-bold whitespace-nowrap">
            {filteredRows.length} Rows • {activeColumns.length} Active Columns
          </span>
        </div>
      </div>

      {saveBanner && (
        <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-300 text-emerald-800 text-xs flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-600" />
          <span>DataFrame updated in memory. Ready for export.</span>
        </div>
      )}

      {/* Professional Figma-Grade Interactive Data Grid */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs flex-1 flex flex-col overflow-hidden">
        <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/70">
          <div className="flex items-center gap-2">
            <TableIcon className="w-4 h-4 text-teal-700" />
            <h2 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
              Clean Medical DataFrame Grid
            </h2>
          </div>
          <span className="text-[11px] text-slate-400 italic">
            Click any cell to edit inline • Fully sanitized
          </span>
        </div>

        <div className="flex-1 overflow-auto max-h-[600px]">
          <table className="w-full text-left text-xs border-collapse">
            <thead className="bg-slate-100 sticky top-0 text-slate-700 font-bold border-b border-slate-200 z-10 text-[10px] uppercase tracking-wider">
              <tr>
                <th className="py-3 px-3 whitespace-nowrap w-10 text-center">#</th>
                {activeColumns.map((col) => (
                  <th key={col} className="py-3 px-3.5 whitespace-nowrap">
                    <div className="flex items-center gap-1.5">
                      <span>{col.replace(/_/g, ' ')}</span>
                    </div>
                  </th>
                ))}
                <th className="py-3 px-3 whitespace-nowrap text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredRows.length === 0 ? (
                <tr>
                  <td
                    colSpan={activeColumns.length + 2}
                    className="py-16 text-center text-slate-400 italic space-y-2"
                  >
                    <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center text-slate-300 mx-auto">
                      <TableIcon className="w-6 h-6" />
                    </div>
                    <p className="text-xs font-semibold text-slate-600">
                      {searchQuery
                        ? 'No records match your search filter.'
                        : 'No documents processed into DataFrame yet.'}
                    </p>
                    <p className="text-[11px] text-slate-400">
                      Upload clinical cards or lab reports to populate the clean DataFrame.
                    </p>
                  </td>
                </tr>
              ) : (
                filteredRows.map((row, rowIdx) => (
                  <tr
                    key={rowIdx}
                    className="hover:bg-teal-50/40 transition-colors group text-[11px]"
                  >
                    <td className="py-2 px-3 text-center text-slate-400 font-mono text-[10px]">
                      {rowIdx + 1}
                    </td>

                    {activeColumns.map((col) => {
                      const val = row[col] || '';
                      const isName = col === 'Patient_Name';
                      const isMrn = col === 'Hospital_Number' || col === 'Card_Number';
                      const isDiag = col === 'Diagnosis';

                      return (
                        <td
                          key={col}
                          className={`py-2 px-3.5 whitespace-nowrap border-r border-slate-100/60 ${
                            isName ? 'font-bold text-slate-900' : isMrn ? 'font-mono text-teal-800 font-bold' : isDiag ? 'font-medium text-slate-800' : 'text-slate-600'
                          }`}
                        >
                          <input
                            type="text"
                            value={val}
                            onChange={(e) => handleCellEdit(rowIdx, col, e.target.value)}
                            placeholder="—"
                            className="bg-transparent border-b border-transparent hover:border-slate-300 focus:border-teal-500 focus:bg-white w-full px-1 py-0.5 rounded text-[11px] font-inherit text-inherit transition-all"
                          />
                        </td>
                      );
                    })}

                    <td className="py-2 px-3 text-right whitespace-nowrap">
                      <button
                        onClick={() => handleDeleteRow(rowIdx)}
                        className="p-1 rounded text-slate-300 hover:text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer"
                        title="Delete row"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Footer info bar */}
        <div className="p-3 border-t border-slate-100 bg-slate-50 flex items-center justify-between text-[11px] text-slate-500 px-4">
          <span>
            DataFrame contains {filteredRows.length} cleaned observation rows • Whitelist enforced
          </span>
          <div className="flex items-center gap-4">
            <span>Empty columns dropped automatically per Pandas rule</span>
            <button
              onClick={() => onNavigate('/upload')}
              className="text-teal-700 font-bold hover:underline cursor-pointer"
            >
              + Ingest More Documents
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
