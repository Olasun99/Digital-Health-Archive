import React, { useState, useMemo, useEffect, useRef } from 'react';
import {
  Table as TableIcon,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  CheckCircle2,
  AlertCircle,
  ShieldCheck,
  Search,
  Filter,
  Eye,
  Trash2,
  Undo2,
  Download,
  Copy,
  Check,
  Edit2,
  FileSpreadsheet,
  FileText,
  UserCheck,
  Sparkles,
  Link2,
  AlertTriangle,
  UserPlus,
  SlidersHorizontal,
  ChevronDown,
  ChevronUp,
  X,
  RefreshCw,
  ExternalLink,
  Activity,
  Maximize2
} from 'lucide-react';
import {
  CleanDataFrameRow,
  IMPORTANT_COLUMNS,
  crossReferenceHospitalNumber,
  PatientMatchEvaluation,
  downloadDataFrameCsv,
  downloadHospitalMultiSheetExcel,
} from '../services/dataFrameEngine';
import { storageService, StoredPatient } from '../services/storageService';

export interface DataFrameTableProps {
  rows: CleanDataFrameRow[];
  activeColumns?: string[];
  onCellEdit?: (rowIndex: number, columnKey: string, newValue: string) => void;
  onDeleteRow?: (rowIndex: number) => void;
  onRowsUpdate?: (updatedRows: CleanDataFrameRow[]) => void;
  title?: string;
  subtitle?: string;
  onNavigate?: (path: string) => void;
  showDuplicatePreventionBanner?: boolean;
}

type SortDirection = 'asc' | 'desc' | null;

interface SortState {
  column: string | null;
  direction: SortDirection;
}

interface CellEditState {
  rowIndex: number;
  columnKey: string;
}

interface ModifiedCellTracker {
  [key: string]: { original: string; current: string }; // key is `${rowIdx}_${colKey}`
}

export const DataFrameTable: React.FC<DataFrameTableProps> = ({
  rows,
  activeColumns: propActiveColumns,
  onCellEdit,
  onDeleteRow,
  onRowsUpdate,
  title = 'Clinical Dataset DataFrame Grid',
  subtitle = 'High-fidelity verification studio with sticky headers, column sorting & in-place clinician editing',
  onNavigate,
  showDuplicatePreventionBanner = true,
}) => {
  // Local rows state for instant editing and undo
  const [tableRows, setTableRows] = useState<CleanDataFrameRow[]>(rows);
  const [activeColumns, setActiveColumns] = useState<string[]>(
    propActiveColumns && propActiveColumns.length > 0 ? propActiveColumns : [...IMPORTANT_COLUMNS]
  );
  const [sortState, setSortState] = useState<SortState>({ column: null, direction: null });
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'verified' | 'unverified' | 'linked_patient' | 'conflict' | 'low_conf'>('all');
  const [density, setDensity] = useState<'comfortable' | 'compact'>('comfortable');
  
  // Track modified cells to highlight clinician edits
  const [modifiedCells, setModifiedCells] = useState<ModifiedCellTracker>({});
  
  // Track verified rows by index
  const [verifiedRows, setVerifiedRows] = useState<Set<number>>(new Set());
  
  // Selected rows for bulk operations
  const [selectedRows, setSelectedRows] = useState<Set<number>>(new Set());

  // In-place editing state
  const [editingCell, setEditingCell] = useState<CellEditState | null>(null);
  const [editValue, setEditValue] = useState<string>('');
  const editInputRef = useRef<HTMLInputElement>(null);

  // Inspector Drawer for clinician drilldown
  const [inspectRowIndex, setInspectRowIndex] = useState<number | null>(null);
  const [copiedCell, setCopiedCell] = useState<string | null>(null);
  const [showColumnPicker, setShowColumnPicker] = useState(false);

  // Patients cache for cross-referencing
  const [patients, setPatients] = useState<StoredPatient[]>([]);

  useEffect(() => {
    setTableRows(rows);
  }, [rows]);

  useEffect(() => {
    if (propActiveColumns && propActiveColumns.length > 0) {
      setActiveColumns(propActiveColumns);
    }
  }, [propActiveColumns]);

  useEffect(() => {
    const pList = storageService.getPatients();
    setPatients(pList);
  }, []);

  // Focus input when editing starts
  useEffect(() => {
    if (editingCell && editInputRef.current) {
      editInputRef.current.focus();
      editInputRef.current.select();
    }
  }, [editingCell]);

  // Compute cross-reference evaluations for every row
  const rowEvaluations = useMemo(() => {
    return tableRows.map((r) => {
      const hospNum = r.Hospital_Number || r.Card_Number;
      return crossReferenceHospitalNumber(hospNum, r.Patient_Name, patients);
    });
  }, [tableRows, patients]);

  // Duplicate prevention metrics
  const deduplicationSummary = useMemo(() => {
    let linked = 0;
    let newPatients = 0;
    let conflicts = 0;
    rowEvaluations.forEach((evalResult) => {
      if (evalResult.status === 'EXACT_MATCH' || evalResult.status === 'NORMALIZED_MATCH') {
        linked++;
      } else if (evalResult.status === 'NEW_PATIENT') {
        newPatients++;
      } else if (evalResult.status === 'DEMOGRAPHIC_CONFLICT') {
        conflicts++;
      }
    });
    return { linked, newPatients, conflicts, total: tableRows.length };
  }, [rowEvaluations, tableRows.length]);

  // Handle column sort toggle
  const handleSort = (column: string) => {
    setSortState((prev) => {
      if (prev.column === column) {
        if (prev.direction === 'asc') return { column, direction: 'desc' };
        if (prev.direction === 'desc') return { column: null, direction: null };
      }
      return { column, direction: 'asc' };
    });
  };

  // Filter & Sort Logic
  const processedRows = useMemo(() => {
    const list = tableRows.map((row, originalIndex) => ({
      row,
      originalIndex,
      evalResult: rowEvaluations[originalIndex],
      isVerified: verifiedRows.has(originalIndex),
    }));

    // Search filter
    const filtered = list.filter(({ row, evalResult, isVerified }) => {
      if (statusFilter === 'verified' && !isVerified) return false;
      if (statusFilter === 'unverified' && isVerified) return false;
      if (statusFilter === 'linked_patient' && !(evalResult.status === 'EXACT_MATCH' || evalResult.status === 'NORMALIZED_MATCH')) return false;
      if (statusFilter === 'conflict' && evalResult.status !== 'DEMOGRAPHIC_CONFLICT') return false;
      if (statusFilter === 'low_conf') {
        const conf = parseInt(row.Confidence_Score || '90', 10);
        if (conf >= 75) return false;
      }

      if (!searchQuery.trim()) return true;
      const q = searchQuery.toLowerCase();
      return Object.values(row).some((val) =>
        String(val || '').toLowerCase().includes(q)
      );
    });

    // Column sorting
    if (sortState.column && sortState.direction) {
      const col = sortState.column as keyof CleanDataFrameRow;
      const dir = sortState.direction === 'asc' ? 1 : -1;

      filtered.sort((a, b) => {
        const valA = (a.row[col] || '').trim();
        const valB = (b.row[col] || '').trim();

        // Numerical sorting check
        const numA = parseFloat(valA);
        const numB = parseFloat(valB);
        if (!isNaN(numA) && !isNaN(numB) && !valA.includes('/') && !valB.includes('/')) {
          return (numA - numB) * dir;
        }

        // Date sorting check (ISO or slash format)
        const dateA = Date.parse(valA);
        const dateB = Date.parse(valB);
        if (!isNaN(dateA) && !isNaN(dateB)) {
          return (dateA - dateB) * dir;
        }

        return valA.localeCompare(valB, undefined, { numeric: true, sensitivity: 'base' }) * dir;
      });
    }

    return filtered;
  }, [tableRows, rowEvaluations, verifiedRows, statusFilter, searchQuery, sortState]);

  // Start cell editing
  const startEditing = (rowIndex: number, columnKey: string, initialValue: string) => {
    setEditingCell({ rowIndex, columnKey });
    setEditValue(initialValue || '');
  };

  // Commit edited cell value
  const commitEdit = () => {
    if (!editingCell) return;
    const { rowIndex, columnKey } = editingCell;
    const oldValue = tableRows[rowIndex]?.[columnKey as keyof CleanDataFrameRow] || '';
    
    if (oldValue !== editValue) {
      const updatedRows = [...tableRows];
      updatedRows[rowIndex] = {
        ...updatedRows[rowIndex],
        [columnKey]: editValue,
      };

      setTableRows(updatedRows);
      
      // Track modified cell
      const cellKey = `${rowIndex}_${columnKey}`;
      setModifiedCells((prev) => ({
        ...prev,
        [cellKey]: {
          original: prev[cellKey]?.original ?? oldValue,
          current: editValue,
        },
      }));

      // Call parent callbacks
      if (onCellEdit) {
        onCellEdit(rowIndex, columnKey, editValue);
      }
      if (onRowsUpdate) {
        onRowsUpdate(updatedRows);
      }
    }

    setEditingCell(null);
  };

  // Revert edited cell
  const revertCell = (rowIndex: number, columnKey: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const cellKey = `${rowIndex}_${columnKey}`;
    const tracking = modifiedCells[cellKey];
    if (!tracking) return;

    const updatedRows = [...tableRows];
    updatedRows[rowIndex] = {
      ...updatedRows[rowIndex],
      [columnKey]: tracking.original,
    };
    setTableRows(updatedRows);

    setModifiedCells((prev) => {
      const next = { ...prev };
      delete next[cellKey];
      return next;
    });

    if (onCellEdit) {
      onCellEdit(rowIndex, columnKey, tracking.original);
    }
    if (onRowsUpdate) {
      onRowsUpdate(updatedRows);
    }
  };

  // Toggle single row verification
  const toggleRowVerification = (originalIndex: number) => {
    setVerifiedRows((prev) => {
      const next = new Set(prev);
      if (next.has(originalIndex)) {
        next.delete(originalIndex);
      } else {
        next.add(originalIndex);
      }
      return next;
    });
  };

  // Bulk verification
  const verifySelectedRows = () => {
    setVerifiedRows((prev) => {
      const next = new Set(prev);
      selectedRows.forEach((idx) => next.add(idx));
      return next;
    });
    setSelectedRows(new Set());
  };

  // Bulk delete
  const deleteSelectedRows = () => {
    if (!window.confirm(`Delete ${selectedRows.size} selected row(s)?`)) return;
    const updated = tableRows.filter((_, idx) => !selectedRows.has(idx));
    setTableRows(updated);
    setSelectedRows(new Set());
    if (onRowsUpdate) onRowsUpdate(updated);
  };

  // Copy cell value
  const copyCellValue = (val: string, key: string, e: React.MouseEvent) => {
    e.stopPropagation();
    navigator.clipboard.writeText(val || '');
    setCopiedCell(key);
    setTimeout(() => setCopiedCell(null), 1500);
  };

  // Toggle select all
  const toggleSelectAll = () => {
    if (selectedRows.size === processedRows.length) {
      setSelectedRows(new Set());
    } else {
      setSelectedRows(new Set(processedRows.map((p) => p.originalIndex)));
    }
  };

  // Toggle single row selection
  const toggleRowSelection = (originalIndex: number) => {
    setSelectedRows((prev) => {
      const next = new Set(prev);
      if (next.has(originalIndex)) next.delete(originalIndex);
      else next.add(originalIndex);
      return next;
    });
  };

  // Export handlers
  const handleExportCsv = () => {
    downloadDataFrameCsv(
      processedRows.map((p) => p.row),
      activeColumns,
      `hospital_verified_dataset_${new Date().toISOString().slice(0, 10)}.csv`
    );
  };

  const handleExportExcel = () => {
    downloadHospitalMultiSheetExcel(
      processedRows.map((p) => p.row),
      activeColumns,
      'Hospital_Master_Clean_Dataset'
    );
  };

  return (
    <div className="flex flex-col h-full bg-white rounded-3xl border border-slate-200 shadow-xs overflow-hidden">
      {/* Top Header & Operational Banner */}
      <div className="p-4 md:p-5 border-b border-slate-200/80 bg-gradient-to-r from-slate-50 via-teal-50/20 to-white flex flex-col gap-4">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-2xl bg-[#0F4C5C] text-white flex items-center justify-center shrink-0 shadow-sm">
              <TableIcon className="w-5 h-5 text-teal-200" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-base font-bold text-slate-900 tracking-tight">
                  {title}
                </h2>
                <span className="px-2 py-0.5 rounded-full bg-teal-100 text-teal-800 text-[10px] font-bold border border-teal-200">
                  {processedRows.length} Rows • {activeColumns.length} Active Columns
                </span>
                {verifiedRows.size > 0 && (
                  <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[10px] font-bold border border-emerald-300 flex items-center gap-1">
                    <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                    {verifiedRows.size} Verified
                  </span>
                )}
                {Object.keys(modifiedCells).length > 0 && (
                  <span className="px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 text-[10px] font-bold border border-amber-300 flex items-center gap-1">
                    <Edit2 className="w-3 h-3 text-amber-600" />
                    {Object.keys(modifiedCells).length} Edits In-Place
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                {subtitle}
              </p>
            </div>
          </div>

          {/* Action Toolbar */}
          <div className="flex items-center gap-2 flex-wrap self-end lg:self-center">
            {/* Density Selector */}
            <div className="flex items-center bg-white border border-slate-200 rounded-xl p-0.5 text-[11px] shadow-2xs">
              <button
                type="button"
                onClick={() => setDensity('comfortable')}
                className={`px-2.5 py-1 rounded-lg font-semibold cursor-pointer transition-colors ${
                  density === 'comfortable'
                    ? 'bg-slate-900 text-white shadow-2xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Comfortable
              </button>
              <button
                type="button"
                onClick={() => setDensity('compact')}
                className={`px-2.5 py-1 rounded-lg font-semibold cursor-pointer transition-colors ${
                  density === 'compact'
                    ? 'bg-slate-900 text-white shadow-2xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Compact
              </button>
            </div>

            {/* Column Picker Trigger */}
            <div className="relative">
              <button
                type="button"
                onClick={() => setShowColumnPicker((p) => !p)}
                className="px-3 py-1.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold flex items-center gap-1.5 shadow-2xs cursor-pointer"
              >
                <SlidersHorizontal className="w-3.5 h-3.5 text-slate-500" />
                <span>Columns ({activeColumns.length})</span>
              </button>

              {/* Column picker popover */}
              {showColumnPicker && (
                <div className="absolute right-0 mt-2 w-72 max-h-80 overflow-y-auto bg-white rounded-2xl border border-slate-200 shadow-xl p-3 z-50 text-xs space-y-2">
                  <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                    <span className="font-bold text-slate-900">Manage Active Columns</span>
                    <button
                      type="button"
                      onClick={() => setShowColumnPicker(false)}
                      className="text-slate-400 hover:text-slate-600"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                  <div className="flex gap-2 text-[10px]">
                    <button
                      type="button"
                      onClick={() => setActiveColumns([...IMPORTANT_COLUMNS])}
                      className="text-teal-700 hover:underline font-bold"
                    >
                      Select All
                    </button>
                    <span>•</span>
                    <button
                      type="button"
                      onClick={() => setActiveColumns(['Patient_Name', 'Hospital_Number', 'Diagnosis', 'Prescription', 'Lab_Result', 'Blood_Pressure'])}
                      className="text-teal-700 hover:underline font-bold"
                    >
                      Key Medical Essentials
                    </button>
                  </div>
                  <div className="space-y-1 pt-1 max-h-56 overflow-y-auto">
                    {IMPORTANT_COLUMNS.map((col) => {
                      const isChecked = activeColumns.includes(col);
                      return (
                        <label
                          key={col}
                          className="flex items-center gap-2 p-1.5 hover:bg-slate-50 rounded-lg cursor-pointer text-slate-700"
                        >
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={() => {
                              setActiveColumns((prev) =>
                                isChecked ? prev.filter((c) => c !== col) : [...prev, col]
                              );
                            }}
                            className="rounded text-teal-600 focus:ring-teal-500"
                          />
                          <span className="truncate">{col.replace(/_/g, ' ')}</span>
                        </label>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>

            {/* Export multi-sheet excel */}
            <button
              type="button"
              onClick={handleExportExcel}
              className="px-3 py-1.5 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold flex items-center gap-1.5 shadow-xs cursor-pointer transition-colors"
            >
              <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-200" />
              <span>Export Multi-Sheet Excel</span>
            </button>

            {/* Export CSV */}
            <button
              type="button"
              onClick={handleExportCsv}
              className="px-3 py-1.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold flex items-center gap-1.5 shadow-2xs cursor-pointer transition-colors"
            >
              <Download className="w-3.5 h-3.5 text-slate-500" />
              <span>CSV</span>
            </button>
          </div>
        </div>

        {/* Clinical Duplicate Prevention & Cross-Referencing Service Banner */}
        {showDuplicatePreventionBanner && (
          <div className="bg-gradient-to-r from-teal-900 via-teal-950 to-slate-900 text-white rounded-2xl p-3.5 shadow-sm border border-teal-800 flex flex-col md:flex-row md:items-center justify-between gap-3 text-xs">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-xl bg-teal-800/80 text-teal-300 flex items-center justify-center shrink-0 border border-teal-700">
                <ShieldCheck className="w-4 h-4" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-bold text-white text-[11px] uppercase tracking-wider">
                    Hospital_Number Cross-Referencing & Duplicate Prevention Engine
                  </span>
                  <span className="px-2 py-0.2 rounded bg-teal-800 text-teal-200 text-[10px] font-mono">
                    Service Layer Active
                  </span>
                </div>
                <div className="text-teal-200 text-[11px] mt-0.5 flex items-center gap-3 flex-wrap">
                  <span className="flex items-center gap-1">
                    <Link2 className="w-3 h-3 text-teal-400" />
                    <strong>{deduplicationSummary.linked}</strong> Linked to Existing Patients (Duplicate Prevented)
                  </span>
                  <span>•</span>
                  <span className="flex items-center gap-1">
                    <UserPlus className="w-3 h-3 text-blue-300" />
                    <strong>{deduplicationSummary.newPatients}</strong> Unique New Patients
                  </span>
                  {deduplicationSummary.conflicts > 0 && (
                    <>
                      <span>•</span>
                      <span className="flex items-center gap-1 text-amber-300 font-bold">
                        <AlertTriangle className="w-3 h-3" />
                        <strong>{deduplicationSummary.conflicts}</strong> Demographic Conflicts (Audit Flagged)
                      </span>
                    </>
                  )}
                </div>
              </div>
            </div>

            {onNavigate && (
              <button
                type="button"
                onClick={() => onNavigate('/patients')}
                className="px-3 py-1 rounded-xl bg-teal-800 hover:bg-teal-700 text-teal-100 text-[11px] font-bold flex items-center gap-1 shrink-0 cursor-pointer border border-teal-700"
              >
                <span>View Patient Registry</span>
                <ExternalLink className="w-3 h-3 text-teal-300" />
              </button>
            )}
          </div>
        )}

        {/* Filter Bar, Search, and Bulk Actions */}
        <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 pt-1">
          {/* Search Bar */}
          <div className="relative flex-1 max-w-lg">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search across all columns (Name, MRN, Diagnosis, Drug, Lab Result)..."
              className="w-full pl-9 pr-4 py-1.5 rounded-xl bg-white border border-slate-200 text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 font-medium"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-xs"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Quick Status Filters */}
          <div className="flex items-center gap-1.5 overflow-x-auto text-xs pb-1 md:pb-0">
            <button
              type="button"
              onClick={() => setStatusFilter('all')}
              className={`px-2.5 py-1 rounded-lg font-semibold whitespace-nowrap cursor-pointer transition-colors ${
                statusFilter === 'all'
                  ? 'bg-slate-900 text-white'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              All Records ({tableRows.length})
            </button>
            <button
              type="button"
              onClick={() => setStatusFilter('linked_patient')}
              className={`px-2.5 py-1 rounded-lg font-semibold whitespace-nowrap cursor-pointer transition-colors flex items-center gap-1 ${
                statusFilter === 'linked_patient'
                  ? 'bg-teal-800 text-white'
                  : 'bg-teal-50 text-teal-800 hover:bg-teal-100 border border-teal-200/60'
              }`}
            >
              <Link2 className="w-3 h-3 text-teal-600" />
              Existing Patient ({deduplicationSummary.linked})
            </button>
            <button
              type="button"
              onClick={() => setStatusFilter('conflict')}
              className={`px-2.5 py-1 rounded-lg font-semibold whitespace-nowrap cursor-pointer transition-colors flex items-center gap-1 ${
                statusFilter === 'conflict'
                  ? 'bg-amber-800 text-white'
                  : 'bg-amber-50 text-amber-800 hover:bg-amber-100 border border-amber-200/60'
              }`}
            >
              <AlertTriangle className="w-3 h-3 text-amber-600" />
              Conflicts ({deduplicationSummary.conflicts})
            </button>
            <button
              type="button"
              onClick={() => setStatusFilter('verified')}
              className={`px-2.5 py-1 rounded-lg font-semibold whitespace-nowrap cursor-pointer transition-colors flex items-center gap-1 ${
                statusFilter === 'verified'
                  ? 'bg-emerald-800 text-white'
                  : 'bg-emerald-50 text-emerald-800 hover:bg-emerald-100 border border-emerald-200/60'
              }`}
            >
              <CheckCircle2 className="w-3 h-3 text-emerald-600" />
              Verified ({verifiedRows.size})
            </button>
            <button
              type="button"
              onClick={() => setStatusFilter('low_conf')}
              className={`px-2.5 py-1 rounded-lg font-semibold whitespace-nowrap cursor-pointer transition-colors flex items-center gap-1 ${
                statusFilter === 'low_conf'
                  ? 'bg-rose-800 text-white'
                  : 'bg-rose-50 text-rose-800 hover:bg-rose-100 border border-rose-200/60'
              }`}
            >
              <AlertCircle className="w-3 h-3 text-rose-600" />
              Low Confidence
            </button>
          </div>
        </div>

        {/* Bulk Action Bar (when rows are selected) */}
        {selectedRows.size > 0 && (
          <div className="bg-teal-900 text-white rounded-xl px-4 py-2 flex items-center justify-between text-xs animate-fade-in shadow-sm">
            <div className="flex items-center gap-3">
              <span className="font-bold">{selectedRows.size} Row(s) Selected</span>
              <span className="text-teal-300">|</span>
              <button
                type="button"
                onClick={verifySelectedRows}
                className="px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-500 font-bold flex items-center gap-1 cursor-pointer transition-colors"
              >
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>Mark Verified</span>
              </button>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={deleteSelectedRows}
                className="px-2.5 py-1 rounded-lg bg-rose-600 hover:bg-rose-500 font-bold flex items-center gap-1 cursor-pointer transition-colors"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Delete Selected</span>
              </button>
              <button
                type="button"
                onClick={() => setSelectedRows(new Set())}
                className="text-teal-200 hover:text-white px-2 py-1 text-xs"
              >
                Deselect
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Main Interactive Table Grid with STICKY Headers & Column Sorting */}
      <div className="flex-1 overflow-auto relative max-h-[680px]">
        <table className="w-full text-left text-xs border-collapse">
          {/* Sticky Header */}
          <thead className="bg-slate-100/95 backdrop-blur-xs sticky top-0 text-slate-700 font-bold border-b border-slate-200 z-20 text-[10px] uppercase tracking-wider shadow-2xs">
            <tr>
              {/* Select All Checkbox */}
              <th className="py-2.5 px-3 sticky left-0 z-30 bg-slate-100 border-r border-slate-200 w-10 text-center">
                <input
                  type="checkbox"
                  checked={selectedRows.size > 0 && selectedRows.size === processedRows.length}
                  onChange={toggleSelectAll}
                  className="rounded text-teal-600 focus:ring-teal-500 cursor-pointer"
                  title="Select all rows"
                />
              </th>

              {/* Row Index */}
              <th className="py-2.5 px-2.5 w-10 text-center font-mono text-slate-500">
                #
              </th>

              {/* Clinician Verification Status Header */}
              <th className="py-2.5 px-3 whitespace-nowrap text-center">
                Sign-off
              </th>

              {/* Active Columns with Sorting */}
              {activeColumns.map((col) => {
                const isSorted = sortState.column === col;
                const sortDir = isSorted ? sortState.direction : null;

                return (
                  <th
                    key={col}
                    onClick={() => handleSort(col)}
                    className={`py-2.5 px-3.5 whitespace-nowrap cursor-pointer select-none transition-colors group ${
                      isSorted ? 'bg-teal-100/70 text-teal-950 font-black' : 'hover:bg-slate-200/70'
                    }`}
                  >
                    <div className="flex items-center gap-1.5 justify-between">
                      <span className="truncate">{col.replace(/_/g, ' ')}</span>
                      <span className="text-slate-400 group-hover:text-slate-600 shrink-0">
                        {sortDir === 'asc' ? (
                          <ArrowUp className="w-3.5 h-3.5 text-teal-700 font-bold" />
                        ) : sortDir === 'desc' ? (
                          <ArrowDown className="w-3.5 h-3.5 text-teal-700 font-bold" />
                        ) : (
                          <ArrowUpDown className="w-3 h-3 opacity-40 group-hover:opacity-100" />
                        )}
                      </span>
                    </div>
                  </th>
                );
              })}

              {/* Actions Header */}
              <th className="py-2.5 px-3 sticky right-0 z-30 bg-slate-100 border-l border-slate-200 whitespace-nowrap text-right">
                Actions
              </th>
            </tr>
          </thead>

          {/* Table Body */}
          <tbody className="divide-y divide-slate-100">
            {processedRows.length === 0 ? (
              <tr>
                <td
                  colSpan={activeColumns.length + 4}
                  className="py-20 text-center text-slate-400 italic space-y-3"
                >
                  <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center text-slate-300 mx-auto">
                    <TableIcon className="w-6 h-6" />
                  </div>
                  <p className="text-xs font-semibold text-slate-700">
                    {searchQuery
                      ? 'No clinical records match your search filter.'
                      : 'No hospital records in this DataFrame view.'}
                  </p>
                  <p className="text-[11px] text-slate-400">
                    Try adjusting the search query or load hospital sample data.
                  </p>
                </td>
              </tr>
            ) : (
              processedRows.map(({ row, originalIndex, evalResult, isVerified }) => {
                const confScore = parseInt(row.Confidence_Score || '90', 10);
                const isLowConf = confScore < 70;
                const isSelected = selectedRows.has(originalIndex);
                const paddingClass = density === 'compact' ? 'py-1.5 px-2.5' : 'py-2 px-3.5';

                return (
                  <tr
                    key={originalIndex}
                    className={`transition-colors group text-[11px] ${
                      isSelected
                        ? 'bg-teal-50/80'
                        : isVerified
                        ? 'bg-emerald-50/20 hover:bg-emerald-50/40'
                        : isLowConf
                        ? 'bg-amber-50/30 hover:bg-amber-50/60'
                        : 'hover:bg-slate-50'
                    }`}
                  >
                    {/* Row Checkbox */}
                    <td className="py-2 px-3 sticky left-0 z-10 bg-inherit border-r border-slate-100 text-center">
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => toggleRowSelection(originalIndex)}
                        className="rounded text-teal-600 focus:ring-teal-500 cursor-pointer"
                      />
                    </td>

                    {/* Row Index */}
                    <td className="py-2 px-2 text-center text-slate-400 font-mono text-[10px]">
                      {originalIndex + 1}
                    </td>

                    {/* Verification Sign-off Toggle */}
                    <td className="py-2 px-3 text-center whitespace-nowrap">
                      <button
                        type="button"
                        onClick={() => toggleRowVerification(originalIndex)}
                        title={isVerified ? 'Verified by Clinician' : 'Click to Verify'}
                        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold cursor-pointer transition-all ${
                          isVerified
                            ? 'bg-emerald-100 text-emerald-800 border border-emerald-300 shadow-2xs'
                            : 'bg-slate-100 text-slate-500 hover:bg-emerald-50 hover:text-emerald-700 border border-slate-200'
                        }`}
                      >
                        <CheckCircle2 className={`w-3 h-3 ${isVerified ? 'text-emerald-600' : 'text-slate-400'}`} />
                        <span>{isVerified ? 'Verified' : 'Sign Off'}</span>
                      </button>
                    </td>

                    {/* Render Columns */}
                    {activeColumns.map((colKey) => {
                      const val = row[colKey as keyof CleanDataFrameRow] || '';
                      const isEditing = editingCell?.rowIndex === originalIndex && editingCell?.columnKey === colKey;
                      const cellKey = `${originalIndex}_${colKey}`;
                      const isCellModified = !!modifiedCells[cellKey];

                      // Special Medical Visual Formatters
                      const isPatientName = colKey === 'Patient_Name';
                      const isMrn = colKey === 'Hospital_Number' || colKey === 'Card_Number';
                      const isFormType = colKey === 'Form_Type';
                      const isDiagnosis = colKey === 'Diagnosis';
                      const isLabFlag = colKey === 'Lab_Flag';
                      const isConfidence = colKey === 'Confidence_Score';
                      const isVitals = ['Blood_Pressure', 'Pulse_Rate', 'Temperature', 'Respiratory_Rate', 'Weight'].includes(colKey);
                      const isRx = ['Drug_Name', 'Dosage', 'Route', 'Frequency', 'Prescription'].includes(colKey);

                      return (
                        <td
                          key={colKey}
                          onClick={() => {
                            if (!isEditing) {
                              startEditing(originalIndex, colKey, val);
                            }
                          }}
                          className={`${paddingClass} whitespace-nowrap border-r border-slate-100/70 relative cursor-pointer select-text group/cell hover:bg-teal-50/50 ${
                            isCellModified ? 'bg-amber-50/70 ring-1 ring-amber-300 ring-inset' : ''
                          }`}
                        >
                          {/* Modified Dot Indicator */}
                          {isCellModified && (
                            <span
                              title={`Modified by clinician (Original: "${modifiedCells[cellKey].original}")`}
                              className="absolute top-1 right-1 w-1.5 h-1.5 rounded-full bg-amber-500 ring-2 ring-white"
                            />
                          )}

                          {isEditing ? (
                            /* Inline Edit Input */
                            <div className="flex items-center gap-1 -m-1">
                              <input
                                ref={editInputRef}
                                type="text"
                                value={editValue}
                                onChange={(e) => setEditValue(e.target.value)}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') commitEdit();
                                  if (e.key === 'Escape') setEditingCell(null);
                                }}
                                onBlur={commitEdit}
                                className="w-full px-2 py-1 bg-white border-2 border-teal-600 rounded-lg text-xs font-semibold text-slate-900 shadow-md focus:outline-none"
                              />
                              <button
                                type="button"
                                onMouseDown={(e) => {
                                  e.preventDefault();
                                  commitEdit();
                                }}
                                className="p-1 bg-teal-600 text-white rounded-lg hover:bg-teal-700"
                              >
                                <Check className="w-3 h-3" />
                              </button>
                            </div>
                          ) : (
                            /* Formatted Cell Content */
                            <div className="flex items-center justify-between gap-1.5">
                              {/* Content by Medical Field Type */}
                              {isPatientName ? (
                                <div className="flex items-center gap-1.5 font-bold text-slate-900">
                                  <div className="w-5 h-5 rounded-full bg-teal-800 text-teal-100 flex items-center justify-center text-[9px] font-bold shrink-0">
                                    {(val.charAt(0) || 'P').toUpperCase()}
                                  </div>
                                  <span className="truncate max-w-[160px]">{val || '—'}</span>
                                </div>
                              ) : isMrn ? (
                                <div className="flex items-center gap-1">
                                  <span className="font-mono text-teal-900 font-bold bg-teal-50 px-1.5 py-0.5 rounded border border-teal-200 text-[10px]">
                                    {val || '—'}
                                  </span>
                                  {/* Duplicate prevention badge */}
                                  {evalResult.status === 'EXACT_MATCH' || evalResult.status === 'NORMALIZED_MATCH' ? (
                                    <span
                                      title={evalResult.notes}
                                      className="text-teal-600 hover:text-teal-800"
                                    >
                                      <Link2 className="w-3 h-3" />
                                    </span>
                                  ) : evalResult.status === 'DEMOGRAPHIC_CONFLICT' ? (
                                    <span
                                      title={evalResult.notes}
                                      className="text-amber-600 hover:text-amber-800 animate-pulse"
                                    >
                                      <AlertTriangle className="w-3.5 h-3.5" />
                                    </span>
                                  ) : (
                                    <span
                                      title={evalResult.notes}
                                      className="text-blue-500 hover:text-blue-700"
                                    >
                                      <UserPlus className="w-3 h-3" />
                                    </span>
                                  )}
                                </div>
                              ) : isFormType ? (
                                <span className="px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 font-semibold text-[10px] border border-slate-200">
                                  {val || 'General Form'}
                                </span>
                              ) : isLabFlag && val ? (
                                <span
                                  className={`px-2 py-0.5 rounded-full text-[10px] font-bold flex items-center gap-1 ${
                                    val === 'High'
                                      ? 'bg-rose-100 text-rose-800 border border-rose-300'
                                      : val === 'Low'
                                      ? 'bg-amber-100 text-amber-800 border border-amber-300'
                                      : 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                                  }`}
                                >
                                  {val === 'High' ? '↑ High' : val === 'Low' ? '↓ Low' : '✓ Normal'}
                                </span>
                              ) : isDiagnosis && val ? (
                                <span className="font-semibold text-slate-800 truncate max-w-[200px]" title={val}>
                                  {val}
                                </span>
                              ) : isConfidence ? (
                                <span
                                  className={`px-1.5 py-0.5 rounded font-mono text-[10px] font-bold ${
                                    confScore >= 90
                                      ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                                      : confScore >= 75
                                      ? 'bg-teal-50 text-teal-800 border border-teal-200'
                                      : 'bg-amber-100 text-amber-900 border border-amber-300'
                                  }`}
                                >
                                  {val}%
                                </span>
                              ) : isVitals && val ? (
                                <span className="font-mono text-slate-800 font-medium">
                                  {val}
                                </span>
                              ) : isRx && val ? (
                                <span className="text-slate-800 font-medium truncate max-w-[180px]" title={val}>
                                  {val}
                                </span>
                              ) : val.includes('[ILLEGIBLE') ? (
                                <span className="px-1.5 py-0.5 rounded bg-amber-100 text-amber-900 border border-amber-300 font-semibold text-[10px]">
                                  {val}
                                </span>
                              ) : (
                                <span className="text-slate-700 truncate max-w-[200px]" title={val}>
                                  {val || <span className="text-slate-300">—</span>}
                                </span>
                              )}

                              {/* Hover Quick Cell Actions */}
                              <div className="opacity-0 group-hover/cell:opacity-100 flex items-center gap-0.5 transition-opacity">
                                <button
                                  type="button"
                                  onClick={(e) => copyCellValue(val, cellKey, e)}
                                  title="Copy cell value"
                                  className="p-0.5 text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 rounded"
                                >
                                  {copiedCell === cellKey ? (
                                    <Check className="w-2.5 h-2.5 text-emerald-600" />
                                  ) : (
                                    <Copy className="w-2.5 h-2.5" />
                                  )}
                                </button>
                                {isCellModified && (
                                  <button
                                    type="button"
                                    onClick={(e) => revertCell(originalIndex, colKey, e)}
                                    title="Revert to original OCR extraction"
                                    className="p-0.5 text-amber-600 hover:text-amber-800 hover:bg-amber-100 rounded"
                                  >
                                    <Undo2 className="w-2.5 h-2.5" />
                                  </button>
                                )}
                              </div>
                            </div>
                          )}
                        </td>
                      );
                    })}

                    {/* Actions Cell (Sticky Right) */}
                    <td className="py-2 px-3 sticky right-0 z-10 bg-inherit border-l border-slate-100 text-right whitespace-nowrap">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          type="button"
                          onClick={() => setInspectRowIndex(originalIndex)}
                          title="Inspect Clinical Entity Card"
                          className="p-1 rounded-lg text-slate-500 hover:text-teal-700 hover:bg-teal-50 cursor-pointer"
                        >
                          <Eye className="w-3.5 h-3.5" />
                        </button>
                        {onDeleteRow && (
                          <button
                            type="button"
                            onClick={() => {
                              if (window.confirm('Delete this record from DataFrame?')) {
                                onDeleteRow(originalIndex);
                              }
                            }}
                            title="Delete Row"
                            className="p-1 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 cursor-pointer"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Footer Info & Telemetry */}
      <div className="p-3 border-t border-slate-200 bg-slate-50/80 flex flex-col sm:flex-row items-center justify-between gap-2 text-[11px] text-slate-500">
        <div className="flex items-center gap-3">
          <span>
            Showing <strong>{processedRows.length}</strong> of <strong>{tableRows.length}</strong> records
          </span>
          <span>•</span>
          <span className="flex items-center gap-1 text-teal-800 font-semibold">
            <Link2 className="w-3 h-3 text-teal-600" />
            Duplicate Prevention: <strong>{deduplicationSummary.linked}</strong> linked to existing patient cards
          </span>
        </div>
        <div className="flex items-center gap-3 text-[10px] text-slate-400">
          <span>Click any cell to edit</span>
          <span>•</span>
          <span>Enter to save</span>
          <span>•</span>
          <span>Esc to cancel</span>
        </div>
      </div>

      {/* Clinical Row Inspection Modal / Drawer */}
      {inspectRowIndex !== null && tableRows[inspectRowIndex] && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-2xl w-full max-h-[85vh] flex flex-col shadow-2xl border border-slate-200 overflow-hidden animate-scale-in">
            {/* Modal Header */}
            <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-slate-50/80">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-teal-800 text-white flex items-center justify-center">
                  <Activity className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900">
                    Clinical Record #{inspectRowIndex + 1}: {tableRows[inspectRowIndex].Patient_Name || 'Unnamed Patient'}
                  </h3>
                  <div className="text-[11px] text-slate-500 flex items-center gap-2">
                    <span className="font-mono font-bold text-teal-800">
                      MRN: {tableRows[inspectRowIndex].Hospital_Number || '—'}
                    </span>
                    <span>•</span>
                    <span>{tableRows[inspectRowIndex].Form_Type || 'Hospital Encounter'}</span>
                  </div>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setInspectRowIndex(null)}
                className="p-1 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Content */}
            <div className="p-6 overflow-y-auto space-y-4 flex-1">
              {/* Patient Match Context */}
              {rowEvaluations[inspectRowIndex] && (
                <div className="p-3.5 rounded-2xl bg-teal-50 border border-teal-200 text-xs">
                  <div className="flex items-center gap-2 font-bold text-teal-900 mb-1">
                    <ShieldCheck className="w-4 h-4 text-teal-700" />
                    <span>Database Cross-Referencing Evaluation</span>
                  </div>
                  <p className="text-teal-800 leading-relaxed text-[11px]">
                    {rowEvaluations[inspectRowIndex].notes}
                  </p>
                </div>
              )}

              {/* Grid of All Clinical Entities */}
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 text-xs">
                {IMPORTANT_COLUMNS.map((key) => {
                  const val = tableRows[inspectRowIndex][key as keyof CleanDataFrameRow] || '';
                  if (!val) return null;
                  return (
                    <div key={key} className="p-2.5 rounded-xl bg-slate-50 border border-slate-100">
                      <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider truncate">
                        {key.replace(/_/g, ' ')}
                      </div>
                      <div className="text-slate-900 font-semibold text-xs mt-0.5 break-words">
                        {val}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Modal Footer */}
            <div className="p-4 border-t border-slate-100 bg-slate-50/80 flex items-center justify-between">
              <button
                type="button"
                onClick={() => toggleRowVerification(inspectRowIndex)}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 cursor-pointer ${
                  verifiedRows.has(inspectRowIndex)
                    ? 'bg-emerald-600 text-white'
                    : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-50'
                }`}
              >
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>{verifiedRows.has(inspectRowIndex) ? 'Verified' : 'Sign Off Record'}</span>
              </button>

              <button
                type="button"
                onClick={() => setInspectRowIndex(null)}
                className="px-4 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
