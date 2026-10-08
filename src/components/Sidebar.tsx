import React from 'react';
import {
  LayoutDashboard,
  FolderArchive,
  UploadCloud,
  Cpu,
  Users,
  CalendarCheck,
  FlaskConical,
  Pill,
  Search,
  BarChart3,
  Download,
  Activity,
  Settings,
  CheckCircle2,
  AlertCircle,
  FileCheck,
  Scan,
  Table,
  Database
} from 'lucide-react';

interface SidebarProps {
  currentPath: string;
  onNavigate: (path: string) => void;
  apiConnected: boolean;
  ocrEngineName: string;
}

export const Sidebar: React.FC<SidebarProps> = ({
  currentPath,
  onNavigate,
  apiConnected,
  ocrEngineName,
}) => {
  const mainNav = [
    { name: 'Dashboard', path: '/', icon: LayoutDashboard },
    { name: 'DataFrame Studio', path: '/dataframe', icon: Database },
    { name: 'Deep Scan & Tabularise', path: '/deep-scan', icon: Scan },
    { name: 'Archive', path: '/archive', icon: FolderArchive },
    { name: 'Digitise', path: '/upload', icon: UploadCloud },
    { name: 'Processing', path: '/processing', icon: Cpu },
    { name: 'Review Queue', path: '/review', icon: FileCheck },
    { name: 'Patient Records', path: '/patients', icon: Users },
    { name: 'Encounters', path: '/encounters', icon: CalendarCheck },
    { name: 'Laboratory', path: '/laboratory', icon: FlaskConical },
    { name: 'Medications', path: '/medications', icon: Pill },
    { name: 'Search', path: '/search', icon: Search },
    { name: 'Analytics', path: '/analytics', icon: BarChart3 },
    { name: 'Exports', path: '/exports', icon: Download },
  ];

  const systemNav = [
    { name: 'API Status', path: '/api-status', icon: Activity },
    { name: 'Settings', path: '/settings', icon: Settings },
  ];

  return (
    <aside className="w-64 bg-[#0B192C] text-slate-200 flex flex-col h-full shrink-0 border-r border-slate-800 shadow-xl select-none">
      {/* Brand Header */}
      <div className="p-5 border-b border-slate-800 flex items-start gap-3">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-teal-500 to-cyan-600 flex items-center justify-center text-white shadow-md shrink-0">
          <Activity className="w-6 h-6 text-white" />
        </div>
        <div className="flex flex-col">
          <span className="font-bold text-white text-base tracking-tight leading-snug">
            HEALTH ARCHIVE
          </span>
          <span className="text-xs font-semibold tracking-wider text-teal-400">
            INTELLIGENCE
          </span>
          <span className="text-[10px] text-slate-400 mt-0.5 leading-tight">
            Hospital Archive Digitisation
          </span>
        </div>
      </div>

      {/* Navigation List */}
      <div className="flex-1 overflow-y-auto px-3 py-4 space-y-6">
        <div>
          <div className="px-3 pb-2 text-[11px] font-semibold tracking-wider uppercase text-slate-400">
            Clinical Archive
          </div>
          <nav className="space-y-1">
            {mainNav.map((item) => {
              const Icon = item.icon;
              const isActive = currentPath === item.path || (item.path !== '/' && currentPath.startsWith(item.path));
              return (
                <button
                  key={item.path}
                  onClick={() => onNavigate(item.path)}
                  data-testid={`nav-${item.name.toLowerCase().replace(/\s+/g, '-')}`}
                  className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-all ${
                    isActive
                      ? 'bg-teal-600/20 text-teal-300 font-semibold border-l-3 border-teal-400'
                      : 'text-slate-300 hover:bg-slate-800/60 hover:text-white'
                  }`}
                >
                  <Icon className={`w-4 h-4 shrink-0 ${isActive ? 'text-teal-400' : 'text-slate-400'}`} />
                  <span className="truncate">{item.name}</span>
                </button>
              );
            })}
          </nav>
        </div>

        <div>
          <div className="px-3 pb-2 text-[11px] font-semibold tracking-wider uppercase text-slate-400">
            System
          </div>
          <nav className="space-y-1">
            {systemNav.map((item) => {
              const Icon = item.icon;
              const isActive = currentPath === item.path;
              return (
                <button
                  key={item.path}
                  onClick={() => onNavigate(item.path)}
                  className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-all ${
                    isActive
                      ? 'bg-teal-600/20 text-teal-300 font-semibold border-l-3 border-teal-400'
                      : 'text-slate-300 hover:bg-slate-800/60 hover:text-white'
                  }`}
                >
                  <Icon className={`w-4 h-4 shrink-0 ${isActive ? 'text-teal-400' : 'text-slate-400'}`} />
                  <span className="truncate">{item.name}</span>
                </button>
              );
            })}
          </nav>
        </div>
      </div>

      {/* Backend & OCR Engine Status Card */}
      <div className="p-4 border-t border-slate-800 bg-[#071322]">
        <div className="space-y-2 text-xs">
          <div className="flex items-center justify-between">
            <span className="text-slate-400">OCR Engine</span>
            <div className="flex items-center gap-1.5 font-medium text-slate-200">
              <span className={`w-2 h-2 rounded-full ${apiConnected ? 'bg-emerald-400 animate-pulse' : 'bg-rose-400'}`} />
              <span>{ocrEngineName || 'docTR'}</span>
            </div>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-slate-400">Colab API</span>
            <div className="flex items-center gap-1.5 font-medium">
              {apiConnected ? (
                <span className="text-emerald-400 flex items-center gap-1">
                  <CheckCircle2 className="w-3 h-3" /> Connected
                </span>
              ) : (
                <span className="text-rose-400 flex items-center gap-1" title="Colab tunnel may be sleeping">
                  <AlertCircle className="w-3 h-3" /> Offline
                </span>
              )}
            </div>
          </div>
        </div>
      </div>
    </aside>
  );
};
