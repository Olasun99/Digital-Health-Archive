import React, { useState } from 'react';
import {
  Settings,
  Save,
  RotateCcw,
  Sparkles,
  ShieldCheck,
  AlertTriangle,
  Trash2,
  CheckCircle2,
  Info,
  Key
} from 'lucide-react';
import {
  getOcrApiBaseUrl,
  setOcrApiBaseUrl,
  DEFAULT_OCR_API_BASE_URL
} from '../services/ocrApi';
import {
  isDemoModeActive,
  setDemoModeActive,
  storageService
} from '../services/storageService';

interface SettingsViewProps {
  onNavigate: (path: string) => void;
}

export const SettingsView: React.FC<SettingsViewProps> = ({ onNavigate }) => {
  const [apiUrl, setApiUrl] = useState(getOcrApiBaseUrl());
  const [demoActive, setDemoActive] = useState(isDemoModeActive());
  const [saveSuccess, setSaveSuccess] = useState(false);

  const handleSaveUrl = () => {
    setOcrApiBaseUrl(apiUrl);
    setSaveSuccess(true);
    setTimeout(() => setSaveSuccess(false), 3000);
  };

  const handleResetUrl = () => {
    setApiUrl(DEFAULT_OCR_API_BASE_URL);
    setOcrApiBaseUrl(DEFAULT_OCR_API_BASE_URL);
    setSaveSuccess(true);
    setTimeout(() => setSaveSuccess(false), 3000);
  };

  const handleToggleDemoMode = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.checked;
    setDemoActive(val);
    setDemoModeActive(val);
  };

  const handleClearAllData = () => {
    if (window.confirm('Are you sure you want to clear all stored digitised documents and clinical records?')) {
      storageService.clearAllData();
      alert('Local clinical storage cleared.');
    }
  };

  return (
    <div className="p-6 md:p-8 space-y-6 max-w-4xl mx-auto">
      <div>
        <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">System Settings & Integrations</h1>
        <p className="text-xs text-slate-500">
          Configure central OCR backend connectivity, demo mode status, and compliance parameters.
        </p>
      </div>

      {saveSuccess && (
        <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-300 text-emerald-800 text-xs flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-600" />
          <span>Configuration saved successfully.</span>
        </div>
      )}

      {/* Central OCR Endpoint Configuration Card */}
      <div className="p-6 rounded-2xl bg-white border border-slate-200 shadow-xs space-y-4">
        <div className="space-y-1">
          <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wider">
            Google Colab OCR API Base URL
          </h2>
          <p className="text-xs text-slate-500 leading-relaxed">
            Central endpoint for the FastAPI + docTR backend. When restarting Google Colab or Localtunnel,
            simply paste your active public tunnel URL here without editing frontend source code.
          </p>
        </div>

        <div className="space-y-2">
          <label className="text-xs font-semibold text-slate-700">OCR_API_BASE_URL</label>
          <div className="flex flex-col sm:flex-row gap-2">
            <input
              type="text"
              value={apiUrl}
              onChange={(e) => setApiUrl(e.target.value)}
              placeholder="https://nasty-melons-sleep.loca.lt"
              className="flex-1 px-3 py-2 rounded-xl bg-slate-50 border border-slate-300 font-mono text-xs text-slate-800 focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500"
            />
            <button
              onClick={handleSaveUrl}
              className="px-4 py-2 rounded-xl bg-[#0F4C5C] hover:bg-[#0c3c49] text-white text-xs font-bold shadow-xs flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <Save className="w-4 h-4" />
              <span>Save URL</span>
            </button>
            <button
              onClick={handleResetUrl}
              className="px-3 py-2 rounded-xl border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold flex items-center justify-center gap-1.5 cursor-pointer"
              title="Reset to default URL"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Reset</span>
            </button>
          </div>
          <div className="text-[11px] text-slate-400">
            Default endpoint: <span className="font-mono text-slate-600">{DEFAULT_OCR_API_BASE_URL}</span>
          </div>
        </div>
      </div>

      {/* Demo Mode Toggle Card */}
      <div className="p-6 rounded-2xl bg-white border border-slate-200 shadow-xs space-y-4">
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-amber-600" />
              <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wider">
                Demo Mode — Synthetic Nigerian Hospital Records
              </h2>
            </div>
            <p className="text-xs text-slate-500 leading-relaxed">
              Enables sample de-identified records from Nigerian institutions (LUTH Lagos, UCH Ibadan, AKTH Kano)
              to facilitate innovation context demonstrations and feature reviews when the Colab instance is idle.
            </p>
          </div>

          <label className="relative inline-flex items-center cursor-pointer">
            <input
              type="checkbox"
              checked={demoActive}
              onChange={handleToggleDemoMode}
              className="sr-only peer"
            />
            <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-amber-600"></div>
          </label>
        </div>

        {demoActive && (
          <div className="p-3 rounded-lg bg-amber-50 border border-amber-200 text-xs text-amber-900 flex items-center gap-2">
            <Info className="w-4 h-4 text-amber-700 shrink-0" />
            <span>
              Demo Mode active: <strong>DEMO MODE — SYNTHETIC DATA</strong>. Sample clinical cards and lab investigations loaded.
            </span>
          </div>
        )}
      </div>

      {/* API Keys & Security Architecture Card */}
      <div className="p-6 rounded-2xl bg-white border border-slate-200 shadow-xs space-y-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <Key className="w-4 h-4 text-teal-700" />
            <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wider">
              API Keys & Credential Architecture
            </h2>
          </div>
          <p className="text-xs text-slate-500 leading-relaxed">
            Understanding credential requirements across the docTR OCR engine and the Gemini clinical intelligence layer.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
          <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-2">
            <div className="flex items-center justify-between">
              <span className="font-bold text-slate-900 flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-600" /> Colab docTR OCR API
              </span>
              <span className="px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 text-[10px] font-bold">
                NO KEY REQUIRED
              </span>
            </div>
            <p className="text-[11px] text-slate-600 leading-relaxed">
              Your Google Colab endpoint (<code className="text-slate-800 bg-white px-1 py-0.5 rounded border border-slate-200 font-mono text-[10px]">https://nasty-melons-sleep.loca.lt</code>) is a public REST interface using FastAPI. It does not require any authorization token or API key.
            </p>
          </div>

          <div className="p-4 rounded-xl bg-teal-50/50 border border-teal-200 space-y-2">
            <div className="flex items-center justify-between">
              <span className="font-bold text-slate-900 flex items-center gap-1.5">
                <Sparkles className="w-4 h-4 text-teal-600" /> Google Gemini API
              </span>
              <span className="px-2 py-0.5 rounded bg-teal-100 text-teal-800 text-[10px] font-bold">
                SERVER INJECTED
              </span>
            </div>
            <p className="text-[11px] text-slate-600 leading-relaxed">
              <strong>Still required for semantic extraction:</strong> While Colab performs optical text detection ("What characters are present?"), Gemini performs clinical interpretation ("What do these values represent?"). Handled server-side automatically via AI Studio environment secrets.
            </p>
          </div>
        </div>
      </div>

      {/* Medical Disclaimer Card */}
      <div className="p-6 rounded-2xl bg-slate-50 border border-slate-200 shadow-xs space-y-3">
        <div className="flex items-center gap-2 text-slate-800">
          <ShieldCheck className="w-5 h-5 text-teal-700" />
          <h2 className="text-xs font-bold uppercase tracking-wider">Medical & Clinical Disclaimer</h2>
        </div>
        <p className="text-xs text-slate-600 leading-relaxed italic bg-white p-4 rounded-xl border border-slate-200">
          "This prototype is designed for document digitisation, information extraction, record organisation, and research/administrative workflows. It is not a substitute for clinical judgment and does not independently diagnose or recommend treatment."
        </p>
        <p className="text-[11px] text-slate-500">
          Prototype created for innovation showcase presentation. Use synthetic or de-identified hospital records for demonstration.
        </p>
      </div>

      {/* Storage Purge */}
      <div className="p-6 rounded-2xl bg-white border border-rose-200 shadow-xs flex items-center justify-between gap-4">
        <div className="space-y-0.5">
          <h3 className="text-xs font-bold text-rose-900 uppercase">Clear Local Archive Cache</h3>
          <p className="text-xs text-slate-500">Purges locally stored records and resets session database.</p>
        </div>
        <button
          onClick={handleClearAllData}
          className="px-3.5 py-1.5 rounded-lg border border-rose-300 text-rose-700 hover:bg-rose-50 text-xs font-semibold flex items-center gap-1.5 cursor-pointer"
        >
          <Trash2 className="w-4 h-4" />
          <span>Clear Local Data</span>
        </button>
      </div>
    </div>
  );
};
