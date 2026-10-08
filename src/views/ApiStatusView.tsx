import React, { useState, useEffect } from 'react';
import {
  Activity,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  ExternalLink,
  ShieldCheck,
  Server,
  Cpu,
  Clock,
  Save,
  Copy,
  Check,
  Terminal,
  HelpCircle,
  Sparkles
} from 'lucide-react';
import { ocrService, getOcrApiBaseUrl, setOcrApiBaseUrl, BackendHealthResponse } from '../services/ocrApi';

export const ApiStatusView: React.FC = () => {
  const [health, setHealth] = useState<BackendHealthResponse | null>(null);
  const [isConnected, setIsConnected] = useState<boolean>(false);
  const [latency, setLatency] = useState<number | null>(null);
  const [errorDetails, setErrorDetails] = useState<string | null>(null);
  const [lastChecked, setLastChecked] = useState<string>('');
  const [isTesting, setIsTesting] = useState(false);
  const [urlInput, setUrlInput] = useState(getOcrApiBaseUrl());
  const [copiedSnippet, setCopiedSnippet] = useState(false);

  useEffect(() => {
    runHealthTest();
  }, []);

  const runHealthTest = async () => {
    setIsTesting(true);
    setErrorDetails(null);

    const result = await ocrService.checkHealth();
    setIsConnected(result.ok);
    setLatency(result.latencyMs);
    setHealth(result.data);
    if (!result.ok) {
      setErrorDetails(result.error || 'Connection refused or Localtunnel 503 error.');
    }
    setLastChecked(new Date().toLocaleTimeString());
    setIsTesting(false);
  };

  const handleSaveAndTestUrl = () => {
    setOcrApiBaseUrl(urlInput);
    runHealthTest();
  };

  const colabLocaltunnelCode = `# === CELL IN GOOGLE COLAB ===
# 1. Install dependencies
!pip install -q fastapi uvicorn python-multipart python-doctr[torch]

# 2. Install localtunnel
!npm install -g localtunnel

# 3. Start FastAPI backend with docTR in background
import subprocess, time

# Run uvicorn on port 8000
proc = subprocess.Popen(["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"])
time.sleep(3)

# 4. Expose port 8000 using localtunnel
# Tip: Use your password from: curl https://loca.lt/mytunnelpassword
!lt --port 8000 --subdomain nasty-melons-sleep`;

  const copySnippet = () => {
    navigator.clipboard.writeText(colabLocaltunnelCode);
    setCopiedSnippet(true);
    setTimeout(() => setCopiedSnippet(false), 2000);
  };

  return (
    <div className="p-6 md:p-8 space-y-6 max-w-4xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">Backend & OCR API Telemetry</h1>
          <p className="text-xs text-slate-500">
            Real-time diagnostic telemetry for your Google Colab docTR FastAPI backend.
          </p>
        </div>
        <button
          onClick={runHealthTest}
          disabled={isTesting}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-[#0F4C5C] hover:bg-[#0c3c49] text-white text-xs font-bold shadow-xs cursor-pointer disabled:opacity-50"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isTesting ? 'animate-spin' : ''}`} />
          <span>{isTesting ? 'Testing Link...' : 'Test Connection'}</span>
        </button>
      </div>

      {/* Main Connection Status Card */}
      <div className="p-6 rounded-2xl bg-white border border-slate-200 shadow-xs space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-100 pb-5">
          <div className="flex items-center gap-3">
            <div
              className={`w-12 h-12 rounded-2xl flex items-center justify-center ${
                isConnected ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-600'
              }`}
            >
              {isConnected ? <CheckCircle2 className="w-6 h-6" /> : <AlertCircle className="w-6 h-6" />}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-sm font-bold text-slate-900">OCR Backend Health:</span>
                <span
                  className={`px-2.5 py-0.5 rounded-full text-xs font-bold ${
                    isConnected ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'
                  }`}
                >
                  {isConnected ? '● ONLINE' : '○ OFFLINE (503 Tunnel Unavailable)'}
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                Last checked: {lastChecked || 'Just now'} • Latency:{' '}
                {latency !== null ? `${latency} ms` : '—'}
              </p>
            </div>
          </div>

          <div className="text-right text-xs">
            <span className="text-slate-400 block text-[11px] uppercase font-semibold">Active Base URL</span>
            <span className="font-mono font-medium text-slate-800 text-xs bg-slate-100 px-2 py-1 rounded">
              {getOcrApiBaseUrl()}
            </span>
          </div>
        </div>

        {/* Live URL Update Bar */}
        <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-2">
          <label className="text-xs font-semibold text-slate-700 flex items-center gap-1.5">
            <span>Update Active Colab Backend URL:</span>
          </label>
          <div className="flex flex-col sm:flex-row gap-2">
            <input
              type="text"
              value={urlInput}
              onChange={(e) => setUrlInput(e.target.value)}
              placeholder="https://nasty-melons-sleep.loca.lt"
              className="flex-1 px-3 py-2 rounded-lg bg-white border border-slate-300 font-mono text-xs text-slate-800 focus:ring-1 focus:ring-teal-500"
            />
            <button
              onClick={handleSaveAndTestUrl}
              className="px-4 py-2 rounded-lg bg-teal-700 hover:bg-teal-800 text-white text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <Save className="w-4 h-4" />
              <span>Save & Test</span>
            </button>
          </div>
          <span className="text-[11px] text-slate-400">
            If Colab assigned a new URL when restarting, paste it here to reconnect immediately.
          </span>
        </div>

        {/* Telemetry Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
          <div className="p-4 rounded-xl bg-slate-50 border border-slate-100 space-y-1">
            <span className="text-slate-400 uppercase font-semibold text-[10px] flex items-center gap-1">
              <Cpu className="w-3.5 h-3.5 text-teal-600" /> OCR Engine
            </span>
            <div className="text-sm font-bold text-slate-900">
              {health?.engine || 'docTR (mindee/doctr)'}
            </div>
            <p className="text-[11px] text-slate-500">Optical Character Recognition</p>
          </div>

          <div className="p-4 rounded-xl bg-slate-50 border border-slate-100 space-y-1">
            <span className="text-slate-400 uppercase font-semibold text-[10px] flex items-center gap-1">
              <Server className="w-3.5 h-3.5 text-indigo-600" /> Backend Stack
            </span>
            <div className="text-sm font-bold text-slate-900">
              {health?.backend || 'FastAPI (Python)'}
            </div>
            <p className="text-[11px] text-slate-500">Google Colab Runtime</p>
          </div>

          <div className="p-4 rounded-xl bg-slate-50 border border-slate-100 space-y-1">
            <span className="text-slate-400 uppercase font-semibold text-[10px] flex items-center gap-1">
              <Clock className="w-3.5 h-3.5 text-amber-600" /> Tunnel Bridge
            </span>
            <div className="text-sm font-bold text-slate-900">
              Localtunnel (.loca.lt)
            </div>
            <p className="text-[11px] text-slate-500">Bypass headers enabled</p>
          </div>
        </div>

        {/* Exact explanation of why 503 happens and how to reconnect */}
        <div className="p-5 rounded-2xl bg-amber-50/80 border border-amber-300 text-xs text-amber-950 space-y-3">
          <div className="flex items-center justify-between">
            <span className="font-bold flex items-center gap-1.5 text-amber-900">
              <Terminal className="w-4 h-4 text-amber-700" /> Why does "503 - Tunnel Unavailable" happen?
            </span>
            <button
              onClick={copySnippet}
              className="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-white border border-amber-300 text-amber-900 text-[11px] font-semibold hover:bg-amber-100 cursor-pointer"
            >
              {copiedSnippet ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copiedSnippet ? 'Copied' : 'Copy Colab Script'}</span>
            </button>
          </div>

          <div className="space-y-2 text-amber-900 leading-relaxed">
            <p>
              In Google Colab, Localtunnel creates a temporary reverse proxy to your running FastAPI server on port 8000.
              <strong> 503 Tunnel Unavailable</strong> happens when:
            </p>
            <ul className="list-disc pl-5 space-y-1 text-[11px]">
              <li>The Google Colab notebook cell stopped executing or timed out.</li>
              <li>The Colab runtime disconnected or entered idle sleep.</li>
              <li>The Localtunnel process (<code className="bg-amber-100 px-1 py-0.5 rounded font-mono">lt --port 8000</code>) crashed or restarted.</li>
            </ul>
            <p className="font-semibold text-amber-950">How to restore connection in Colab:</p>
            <ol className="list-decimal pl-5 space-y-1 text-[11px]">
              <li>Open your Google Colab tab and re-run the FastAPI + Localtunnel execution cell.</li>
              <li>If Localtunnel prints a new URL, paste that new URL into the box above and click <strong>Save & Test</strong>.</li>
              <li>Keep the Colab browser tab open so the runtime remains active.</li>
            </ol>
          </div>

          {/* Code block snippet */}
          <div className="p-3 bg-slate-900 text-slate-100 rounded-xl font-mono text-[11px] overflow-x-auto">
            <pre>{colabLocaltunnelCode}</pre>
          </div>
        </div>
      </div>
    </div>
  );
};
