import React from 'react';
import {
  Activity,
  CheckCircle2,
  AlertTriangle,
  Bell,
  UploadCloud,
  Layers,
  Sparkles
} from 'lucide-react';
import { getOcrApiBaseUrl } from '../services/ocrApi';
import { isDemoModeActive } from '../services/storageService';

interface TopHeaderProps {
  title: string;
  subtitle?: string;
  apiConnected: boolean;
  latencyMs?: number;
  onDigitiseClick: () => void;
  onNavigate: (path: string) => void;
  onOpenConnectionModal?: () => void;
}

export const TopHeader: React.FC<TopHeaderProps> = ({
  title,
  subtitle,
  apiConnected,
  latencyMs,
  onDigitiseClick,
  onNavigate,
  onOpenConnectionModal,
}) => {
  const ocrBaseUrl = getOcrApiBaseUrl();
  const demoActive = isDemoModeActive();

  return (
    <header className="h-16 bg-white border-b border-slate-200 px-6 flex items-center justify-between shadow-xs shrink-0 z-10">
      {/* Page Title & Breadcrumb */}
      <div className="flex flex-col">
        <div className="flex items-center gap-2">
          <h1 className="text-lg font-bold text-slate-900 tracking-tight">{title}</h1>
          {demoActive && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber-100 text-amber-800 border border-amber-300">
              <Sparkles className="w-3 h-3 text-amber-600" /> DEMO MODE — SYNTHETIC DATA
            </span>
          )}
        </div>
        {subtitle && <p className="text-xs text-slate-500 font-normal">{subtitle}</p>}
      </div>

      {/* Right Controls */}
      <div className="flex items-center gap-4">
        {/* Quick Action */}
        <button
          onClick={onDigitiseClick}
          className="hidden sm:inline-flex items-center gap-2 px-3.5 py-1.5 rounded-lg bg-[#0F4C5C] hover:bg-[#0c3c49] text-white text-xs font-semibold shadow-xs transition-colors cursor-pointer"
        >
          <UploadCloud className="w-4 h-4 text-teal-300" />
          <span>+ Digitise Documents</span>
        </button>

        {/* API Status Indicator */}
        <div
          onClick={() => {
            if (onOpenConnectionModal) {
              onOpenConnectionModal();
            } else {
              onNavigate('/api-status');
            }
          }}
          className={`cursor-pointer flex items-center gap-2 px-3 py-1.5 rounded-lg border text-xs font-medium transition-all ${
            apiConnected
              ? 'bg-emerald-50 hover:bg-emerald-100 border-emerald-200 text-emerald-900'
              : 'bg-rose-50 hover:bg-rose-100 border-rose-200 text-rose-900'
          }`}
          title={`Backend: ${ocrBaseUrl} ${latencyMs ? `(${latencyMs}ms)` : ''} — Click to manage Colab connection`}
        >
          <div className="flex items-center gap-1.5">
            <span
              className={`w-2 h-2 rounded-full ${
                apiConnected ? 'bg-emerald-500 ring-2 ring-emerald-200 animate-pulse' : 'bg-rose-500 ring-2 ring-rose-200'
              }`}
            />
            <span className="font-semibold">
              {apiConnected ? 'Colab Online' : 'Colab Offline (Click to connect)'}
            </span>
          </div>
          {latencyMs && apiConnected && (
            <span className="text-[10px] text-emerald-700 font-mono">
              {latencyMs}ms
            </span>
          )}
        </div>

        {/* Notification bell placeholder */}
        <button
          className="p-2 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 relative"
          title="System notifications"
        >
          <Bell className="w-4 h-4" />
          <span className="absolute top-1.5 right-1.5 w-1.5 h-1.5 bg-teal-500 rounded-full" />
        </button>

        {/* Prototype User/Profile */}
        <div className="flex items-center gap-2.5 pl-3 border-l border-slate-200">
          <div
            className="w-8 h-8 rounded-full bg-gradient-to-tr from-slate-800 to-teal-700 text-white flex items-center justify-center font-bold text-xs shadow-xs"
            title="Prototype Records Officer Profile"
          >
            RO
          </div>
          <div className="hidden lg:flex flex-col text-left">
            <span className="text-xs font-semibold text-slate-800 leading-tight">
              Hospital Records Officer
            </span>
            <span className="text-[10px] text-slate-500">
              Prototype Session (Lagos GH)
            </span>
          </div>
        </div>
      </div>
    </header>
  );
};
