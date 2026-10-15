import React, { useState } from 'react';
import {
  X,
  Server,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  Copy,
  Check,
  Terminal,
  ExternalLink,
  ShieldCheck,
  Sparkles,
  Zap,
  Cpu
} from 'lucide-react';
import {
  getOcrApiBaseUrl,
  setOcrApiBaseUrl,
  ocrService,
  BackendHealthResponse
} from '../services/ocrApi';

interface BackendConnectionModalProps {
  isOpen: boolean;
  onClose: () => void;
  apiConnected: boolean;
  onRecheckHealth: () => void;
}

export const BackendConnectionModal: React.FC<BackendConnectionModalProps> = ({
  isOpen,
  onClose,
  apiConnected,
  onRecheckHealth,
}) => {
  const [currentUrl, setCurrentUrl] = useState(getOcrApiBaseUrl());
  const [isTesting, setIsTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ ok: boolean; message: string } | null>(null);
  const [copiedColabCode, setCopiedColabCode] = useState(false);
  const [copiedCloudflareCode, setCopiedCloudflareCode] = useState(false);

  if (!isOpen) return null;

  const handleTestAndSave = async () => {
    setIsTesting(true);
    setTestResult(null);
    setOcrApiBaseUrl(currentUrl);

    try {
      const res = await ocrService.checkHealth();
      if (res.ok) {
        setTestResult({
          ok: true,
          message: `Connected! Engine: ${res.data?.engine || 'docTR'} (Latency: ${res.latencyMs}ms)`,
        });
      } else {
        setTestResult({
          ok: false,
          message: res.error || '503 - Colab tunnel is sleeping or URL has changed.',
        });
      }
      onRecheckHealth();
    } catch (err: any) {
      setTestResult({
        ok: false,
        message: err.message || 'Connection failed.',
      });
    } finally {
      setIsTesting(false);
    }
  };

  const colabCloudflareScript = `# === PERMANENT & ALWAYS ONLINE COLAB SCRIPT ===
# This uses Cloudflare Tunnel (cloudflared) which DOES NOT drop like localtunnel
!pip install -q fastapi uvicorn python-multipart python-doctr[torch]
!wget -q -nc https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64.deb
!dpkg -i cloudflared-linux-amd64.deb > /dev/null 2>&1

import subprocess, time

# 1. Start FastAPI server with docTR
proc_fastapi = subprocess.Popen(["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"])
time.sleep(3)

# 2. Start Cloudflare Tunnel (Stable, No 503 errors, No passwords)
proc_tunnel = subprocess.Popen(["cloudflared", "tunnel", "--url", "http://localhost:8000"], 
                               stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True)

# 3. Print the permanent public URL
for line in proc_tunnel.stderr:
    if "trycloudflare.com" in line:
        import re
        match = re.search(r"https://[a-zA-Z0-9-]+\.trycloudflare\.com", line)
        if match:
            print("\\n" + "="*60)
            print("🚀 YOUR LIVE BACKEND URL IS:")
            print(match.group(0))
            print("="*60 + "\\n")
            break`;

  const colabLocaltunnelScript = `# === STANDARD LOCALTUNNEL SCRIPT ===
!pip install -q fastapi uvicorn python-multipart python-doctr[torch]
!npm install -g localtunnel

import subprocess, time

# Start FastAPI server
subprocess.Popen(["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"])
time.sleep(3)

# Run localtunnel (Keep this cell running!)
!lt --port 8000 --subdomain nasty-melons-sleep`;

  const copyToClipboard = (text: string, type: 'cf' | 'lt') => {
    navigator.clipboard.writeText(text);
    if (type === 'cf') {
      setCopiedCloudflareCode(true);
      setTimeout(() => setCopiedCloudflareCode(false), 2000);
    } else {
      setCopiedColabCode(true);
      setTimeout(() => setCopiedColabCode(false), 2000);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-fade-in">
      <div className="bg-white rounded-3xl border border-slate-200 shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto flex flex-col">
        {/* Header */}
        <div className="p-6 border-b border-slate-100 flex items-center justify-between sticky top-0 bg-white/95 backdrop-blur-xs z-10">
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-white shadow-xs ${
              apiConnected ? 'bg-emerald-600' : 'bg-rose-600'
            }`}>
              <Server className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900">
                Google Colab & OCR Backend Connection
              </h2>
              <div className="flex items-center gap-2 mt-0.5">
                <span className={`inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-full ${
                  apiConnected
                    ? 'bg-emerald-100 text-emerald-800'
                    : 'bg-rose-100 text-rose-800'
                }`}>
                  <span className={`w-1.5 h-1.5 rounded-full ${apiConnected ? 'bg-emerald-500 animate-pulse' : 'bg-rose-500'}`} />
                  {apiConnected ? 'Connected & Online' : 'Offline (503 Tunnel Unavailable)'}
                </span>
              </div>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 space-y-6 text-xs text-slate-700">
          {/* Quick Connect URL Input */}
          <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-3">
            <label className="font-bold text-slate-900 block text-xs">
              Live OCR Backend URL (Google Colab / Ngrok / Hugging Face Space):
            </label>
            <div className="flex flex-col sm:flex-row gap-2">
              <input
                type="text"
                value={currentUrl}
                onChange={(e) => setCurrentUrl(e.target.value)}
                placeholder="https://retrain-smudge-retrace.ngrok-free.dev/ocr"
                className="flex-1 px-3.5 py-2.5 rounded-xl border border-slate-300 font-mono text-xs bg-white text-slate-900 focus:outline-none focus:ring-2 focus:ring-teal-500"
              />
              <button
                onClick={handleTestAndSave}
                disabled={isTesting}
                className="px-5 py-2.5 rounded-xl bg-[#0F4C5C] hover:bg-[#0c3c49] text-white font-bold text-xs shadow-xs flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isTesting ? 'animate-spin' : ''}`} />
                <span>{isTesting ? 'Testing Link...' : 'Test & Connect'}</span>
              </button>
            </div>

            {testResult && (
              <div className={`p-3 rounded-xl border text-xs flex items-center gap-2 ${
                testResult.ok
                  ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
                  : 'bg-rose-50 border-rose-200 text-rose-900'
              }`}>
                {testResult.ok ? <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" /> : <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />}
                <span className="font-medium">{testResult.message}</span>
              </div>
            )}
          </div>

          {/* Where is my app connected to Colab? */}
          <div className="space-y-2.5">
            <h3 className="font-bold text-slate-900 text-sm flex items-center gap-1.5">
              <ShieldCheck className="w-4 h-4 text-teal-700" />
              Where is the app connected to Colab in the code?
            </h3>
            <div className="p-4 rounded-2xl bg-white border border-slate-200 space-y-2 text-[11px] leading-relaxed">
              <p>
                Your application connects to Colab in three synchronized locations:
              </p>
              <ul className="list-disc pl-5 space-y-1.5 font-mono text-slate-800">
                <li>
                  <span className="font-bold text-teal-800">1. /src/services/ocrApi.ts (Line 9):</span>
                  <div className="text-[10px] text-slate-500 font-sans">
                    Defines <code className="bg-slate-100 px-1 py-0.5 rounded font-mono">export const OCR_API_BASE_URL = "{currentUrl}"</code>.
                  </div>
                </li>
                <li>
                  <span className="font-bold text-teal-800">2. /vite.config.ts (Line 289):</span>
                  <div className="text-[10px] text-slate-500 font-sans">
                    The server proxy forwards <code className="bg-slate-100 px-1 py-0.5 rounded font-mono">/api/ocr-proxy/*</code> to your Colab URL with <code className="bg-slate-100 px-1 py-0.5 rounded font-mono">bypass-tunnel-reminder: true</code> headers.
                  </div>
                </li>
                <li>
                  <span className="font-bold text-teal-800">3. Browser Memory (localStorage):</span>
                  <div className="text-[10px] text-slate-500 font-sans">
                    The app stores your active URL so whenever you update it here, it connects automatically on every page refresh.
                  </div>
                </li>
              </ul>
            </div>
          </div>

          {/* Why does it disconnect & how to keep it always online */}
          <div className="space-y-2.5">
            <h3 className="font-bold text-slate-900 text-sm flex items-center gap-1.5">
              <Zap className="w-4 h-4 text-amber-600" />
              How to make it stay online permanently
            </h3>
            <div className="p-4 rounded-2xl bg-amber-50 border border-amber-200 text-amber-950 space-y-3 leading-relaxed text-[11px]">
              <p>
                <strong>Why does Colab disconnect?</strong> Google Colab is designed as a temporary notebook environment. When your browser tab closes or goes idle, Google terminates the background Python uvicorn server, causing Localtunnel to return <code>503 Tunnel Unavailable</code>.
              </p>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-amber-900 flex items-center gap-1">
                    <Terminal className="w-3.5 h-3.5" /> Recommended Solution: Cloudflare Tunnel (Stable, No 503 drops)
                  </span>
                  <button
                    onClick={() => copyToClipboard(colabCloudflareScript, 'cf')}
                    className="px-2.5 py-1 rounded-lg bg-white border border-amber-300 text-amber-900 font-bold hover:bg-amber-100 text-[10px] flex items-center gap-1 cursor-pointer"
                  >
                    {copiedCloudflareCode ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3" />}
                    <span>{copiedCloudflareCode ? 'Copied!' : 'Copy Script'}</span>
                  </button>
                </div>
                <pre className="p-3 bg-slate-900 text-slate-100 rounded-xl font-mono text-[10px] overflow-x-auto">
                  {colabCloudflareScript}
                </pre>
              </div>

              <div className="pt-2 border-t border-amber-200">
                <span className="font-bold text-amber-950">Option B: Free 24/7 Permanent Hosting (Hugging Face Spaces):</span>
                <p className="mt-1">
                  You can deploy your FastAPI + docTR script to a free <strong>Hugging Face Space</strong> (running 24/7 forever). It never sleeps, never resets URLs, and gives you a permanent HTTPS URL like <code className="bg-amber-100 px-1 py-0.5 rounded font-mono">https://YOUR-NAME-ocr.hf.space</code>.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-100 bg-slate-50 flex items-center justify-between px-6">
          <span className="text-[11px] text-slate-500">
            Health Archive Intelligence • Secure Healthcare Cloud Bridge
          </span>
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-900 text-white font-bold text-xs cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
