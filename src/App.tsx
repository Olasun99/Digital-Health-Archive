import React, { useState, useEffect } from 'react';
import { Sidebar } from './components/Sidebar';
import { TopHeader } from './components/TopHeader';
import { DashboardView } from './views/DashboardView';
import { UploadView } from './views/UploadView';
import { ArchiveView } from './views/ArchiveView';
import { ProcessingView } from './views/ProcessingView';
import { DocumentDetailView } from './views/DocumentDetailView';
import { ReviewView } from './views/ReviewView';
import { PatientsView } from './views/PatientsView';
import { EncountersView } from './views/EncountersView';
import { LaboratoryView } from './views/LaboratoryView';
import { MedicationsView } from './views/MedicationsView';
import { SearchView } from './views/SearchView';
import { AnalyticsView } from './views/AnalyticsView';
import { ExportsView } from './views/ExportsView';
import { ApiStatusView } from './views/ApiStatusView';
import { SettingsView } from './views/SettingsView';
import { DeepScanWorkspaceView } from './views/DeepScanWorkspaceView';
import { DataFrameStudioView } from './views/DataFrameStudioView';
import { ocrService } from './services/ocrApi';
import { isDemoModeActive, setDemoModeActive } from './services/storageService';
import { Menu, X } from 'lucide-react';

export default function App() {
  const [currentPath, setCurrentPath] = useState<string>('/');
  const [apiConnected, setApiConnected] = useState<boolean>(false);
  const [latencyMs, setLatencyMs] = useState<number | undefined>(undefined);
  const [ocrEngineName, setOcrEngineName] = useState<string>('docTR');
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState<boolean>(false);

  useEffect(() => {
    // If no demo mode set yet, activate it by default so initial showcase presentation has rich clinical data
    if (localStorage.getItem('HAI_DEMO_MODE_ACTIVE') === null) {
      setDemoModeActive(true);
    }

    // Determine current path from location
    const initialPath = window.location.pathname || '/';
    setCurrentPath(initialPath);

    const handlePopState = () => {
      setCurrentPath(window.location.pathname || '/');
    };
    window.addEventListener('popstate', handlePopState);

    // Initial Health Check on Application Startup
    checkBackendHealth();

    // Periodic light health polling every 30s
    const timer = setInterval(() => {
      checkBackendHealth();
    }, 30000);

    const handleUrlChange = () => {
      checkBackendHealth();
    };
    window.addEventListener('ocr_api_url_changed', handleUrlChange);

    return () => {
      window.removeEventListener('popstate', handlePopState);
      window.removeEventListener('ocr_api_url_changed', handleUrlChange);
      clearInterval(timer);
    };
  }, []);

  const checkBackendHealth = async () => {
    try {
      const res = await ocrService.checkHealth();
      setApiConnected(res.ok);
      setLatencyMs(res.latencyMs);
      if (res.data?.engine) {
        setOcrEngineName(res.data.engine);
      }
    } catch {
      setApiConnected(false);
    }
  };

  const navigateTo = (path: string) => {
    setCurrentPath(path);
    setIsMobileMenuOpen(false);
    if (window.location.pathname !== path) {
      window.history.pushState({}, '', path);
    }
  };

  // Helper to resolve route view and parameters
  const renderCurrentView = () => {
    if (currentPath === '/') {
      return <DashboardView onNavigate={navigateTo} apiConnected={apiConnected} />;
    }
    if (currentPath.startsWith('/deep-scan')) {
      const docId = currentPath.replace('/deep-scan/', '').replace('/deep-scan', '');
      return <DeepScanWorkspaceView initialDocumentId={docId || undefined} onNavigate={navigateTo} />;
    }
    if (currentPath === '/dataframe') {
      return <DataFrameStudioView onNavigate={navigateTo} />;
    }
    if (currentPath === '/upload') {
      return <UploadView onNavigate={navigateTo} apiConnected={apiConnected} />;
    }
    if (currentPath === '/archive') {
      return <ArchiveView onNavigate={navigateTo} apiConnected={apiConnected} />;
    }
    if (currentPath === '/processing') {
      return <ProcessingView onNavigate={navigateTo} apiConnected={apiConnected} />;
    }
    if (currentPath.startsWith('/documents/')) {
      const docId = currentPath.replace('/documents/', '');
      return <DocumentDetailView documentId={docId} onNavigate={navigateTo} />;
    }
    if (currentPath.startsWith('/review/')) {
      const docId = currentPath.replace('/review/', '');
      return <ReviewView documentId={docId} onNavigate={navigateTo} />;
    }
    if (currentPath === '/review') {
      return <ReviewView onNavigate={navigateTo} />;
    }
    if (currentPath.startsWith('/patients/')) {
      const patId = currentPath.replace('/patients/', '');
      return <PatientsView onNavigate={navigateTo} selectedPatientId={patId} />;
    }
    if (currentPath === '/patients') {
      return <PatientsView onNavigate={navigateTo} />;
    }
    if (currentPath === '/encounters') {
      return <EncountersView onNavigate={navigateTo} />;
    }
    if (currentPath === '/laboratory') {
      return <LaboratoryView onNavigate={navigateTo} />;
    }
    if (currentPath === '/medications') {
      return <MedicationsView onNavigate={navigateTo} />;
    }
    if (currentPath === '/search') {
      return <SearchView onNavigate={navigateTo} />;
    }
    if (currentPath === '/analytics') {
      return <AnalyticsView />;
    }
    if (currentPath === '/exports') {
      return <ExportsView />;
    }
    if (currentPath === '/api-status') {
      return <ApiStatusView />;
    }
    if (currentPath === '/settings') {
      return <SettingsView onNavigate={navigateTo} />;
    }

    // Default fallback
    return <DashboardView onNavigate={navigateTo} apiConnected={apiConnected} />;
  };

  // Determine title for TopHeader
  const getHeaderMeta = () => {
    if (currentPath === '/') return { title: 'Hospital Archive Intelligence', subtitle: 'Convert paper-based clinical archives into searchable, structured health data.' };
    if (currentPath === '/dataframe') return { title: 'Clinical Data Management Studio', subtitle: 'Pandas DataFrame Engine: JSON Noise Cleaning → Whitelist Extraction → Clean Excel Export.' };
    if (currentPath.startsWith('/deep-scan')) return { title: 'Deep Scan & Tabularisation Engine', subtitle: 'Step 1 Pre-processing → Step 2 Full Text → Step 3 Intelligent Entity & Table Structuring.' };
    if (currentPath === '/upload') return { title: 'Digitise Hospital Documents', subtitle: 'Upload scanned or photographed records for OCR and intelligent structuring.' };
    if (currentPath === '/archive') return { title: 'Hospital Document Archive', subtitle: 'Search and inspect raw docTR OCR transcripts and original records.' };
    if (currentPath === '/processing') return { title: 'Processing Center', subtitle: 'Live batch ingestion progress and docTR processing telemetry.' };
    if (currentPath.startsWith('/documents/')) return { title: 'Document Detail & OCR Viewer', subtitle: 'Split-screen verification between physical source and docTR transcript.' };
    if (currentPath.startsWith('/review')) return { title: 'Human Verification Workspace', subtitle: 'Mandatory clinical review layer: AI suggests, rules validate, humans approve.' };
    if (currentPath.startsWith('/patients')) return { title: 'Patient Clinical Records', subtitle: 'Longitudinal clinical dossier linking multiple paper documents.' };
    if (currentPath === '/encounters') return { title: 'Clinical Encounters', subtitle: 'Chronological register of outpatient and hospital encounters.' };
    if (currentPath === '/laboratory') return { title: 'Laboratory Investigations', subtitle: 'Structured pathology results from historical lab report forms.' };
    if (currentPath === '/medications') return { title: 'Medication Records', subtitle: 'Prescriptions extracted and verified from paper records.' };
    if (currentPath === '/search') return { title: 'Global Clinical Search', subtitle: 'Query across MRNs, diagnoses, lab investigations, and medications.' };
    if (currentPath === '/analytics') return { title: 'Archive Analytics', subtitle: 'Digitization throughput and epidemiological trends from stored data.' };
    if (currentPath === '/exports') return { title: 'Data & Research Exports', subtitle: 'Export structured JSON, CSV datasets, and raw OCR archives.' };
    if (currentPath === '/api-status') return { title: 'Backend & OCR Status', subtitle: 'Real-time telemetry for Google Colab docTR backend.' };
    if (currentPath === '/settings') return { title: 'System Settings', subtitle: 'Manage central OCR base URL and system parameters.' };
    return { title: 'Health Archive Intelligence', subtitle: 'AI-Powered Hospital Archive Digitisation' };
  };

  const headerMeta = getHeaderMeta();

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-[#F8FAFC] text-[#0F172A] font-sans antialiased">
      {/* Desktop Persistent Sidebar */}
      <div className="hidden lg:flex h-full">
        <Sidebar
          currentPath={currentPath}
          onNavigate={navigateTo}
          apiConnected={apiConnected}
          ocrEngineName={ocrEngineName}
        />
      </div>

      {/* Mobile Drawer */}
      {isMobileMenuOpen && (
        <div className="lg:hidden fixed inset-0 z-50 flex">
          <div
            className="fixed inset-0 bg-black/50 backdrop-blur-xs"
            onClick={() => setIsMobileMenuOpen(false)}
          />
          <div className="relative z-10 w-64 h-full">
            <Sidebar
              currentPath={currentPath}
              onNavigate={navigateTo}
              apiConnected={apiConnected}
              ocrEngineName={ocrEngineName}
            />
          </div>
        </div>
      )}

      {/* Main App Canvas */}
      <div className="flex-1 flex flex-col min-w-0 h-full overflow-hidden">
        {/* Mobile menu trigger bar on top if mobile */}
        <div className="lg:hidden h-12 bg-[#0B192C] text-white px-4 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setIsMobileMenuOpen(true)}
              className="p-1.5 rounded-md hover:bg-slate-800 text-slate-300"
            >
              <Menu className="w-5 h-5" />
            </button>
            <span className="font-bold text-sm tracking-tight">HEALTH ARCHIVE INTELLIGENCE</span>
          </div>
          <span
            className={`w-2 h-2 rounded-full ${apiConnected ? 'bg-emerald-400' : 'bg-rose-400'}`}
          />
        </div>

        {/* Persistent Top Header */}
        <TopHeader
          title={headerMeta.title}
          subtitle={headerMeta.subtitle}
          apiConnected={apiConnected}
          latencyMs={latencyMs}
          onDigitiseClick={() => navigateTo('/upload')}
          onNavigate={navigateTo}
        />

        {/* Viewport Content */}
        <main className="flex-1 overflow-y-auto">
          {renderCurrentView()}
        </main>
      </div>
    </div>
  );
}
