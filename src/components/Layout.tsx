// ============================================================================
// Layout shell — sidebar navigation + top bar
// ============================================================================
import { useState, type ReactNode } from 'react';
import {
  LayoutDashboard,
  Upload,
  GitBranch,
  BarChart3,
  LineChart,
  Bot,
  Download,
  Info,
  Database,
  Menu,
  X,
} from 'lucide-react';
import type { PageId } from '@/lib/types';
import { useApp } from '@/lib/store';
import { Badge } from './ui';

const NAV_ITEMS: { id: PageId; label: string; icon: ReactNode }[] = [
  { id: 'dashboard', label: 'Overview Dashboard', icon: <LayoutDashboard className="w-4 h-4" /> },
  { id: 'upload', label: 'Upload Dataset', icon: <Upload className="w-4 h-4" /> },
  { id: 'pipeline', label: 'Data Quality & Pipeline', icon: <GitBranch className="w-4 h-4" /> },
  { id: 'analytics', label: 'Business Analytics', icon: <BarChart3 className="w-4 h-4" /> },
  { id: 'anomaly', label: 'Anomaly & Forecasting', icon: <LineChart className="w-4 h-4" /> },
  { id: 'investigator', label: 'AI Incident Investigator', icon: <Bot className="w-4 h-4" /> },
  { id: 'exports', label: 'Cleaned Data & Exports', icon: <Download className="w-4 h-4" /> },
  { id: 'about', label: 'About Project', icon: <Info className="w-4 h-4" /> },
];

export function Layout({
  currentPage,
  onNavigate,
  children,
}: {
  currentPage: PageId;
  onNavigate: (page: PageId) => void;
  children: ReactNode;
}) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const { datasets, activeDataset, pipelineResult } = useApp();

  const currentItem = NAV_ITEMS.find((n) => n.id === currentPage);
  const incidentCount = pipelineResult?.incidents.length || 0;

  return (
    <div className="min-h-screen bg-gray-50 flex">
      {/* Sidebar — desktop */}
      <aside
        className={`fixed lg:static inset-y-0 left-0 z-40 w-64 bg-slate-900 text-slate-300 flex flex-col transition-transform duration-200 ${
          mobileOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
        }`}
      >
        <div className="flex items-center gap-2 px-5 py-5 border-b border-slate-800">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-500 to-teal-400 flex items-center justify-center">
            <Database className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-white font-bold text-sm tracking-tight">DataDrift</h1>
            <p className="text-[10px] text-slate-400">E-commerce Data Intelligence</p>
          </div>
        </div>

        <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-0.5">
          {NAV_ITEMS.map((item) => {
            const active = currentPage === item.id;
            return (
              <button
                key={item.id}
                onClick={() => {
                  onNavigate(item.id);
                  setMobileOpen(false);
                }}
                className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors ${
                  active ? 'bg-blue-600 text-white' : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                }`}
              >
                {item.icon}
                <span className="flex-1 text-left">{item.label}</span>
                {item.id === 'investigator' && incidentCount > 0 && (
                  <span className="bg-teal-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded">
                    {incidentCount}
                  </span>
                )}
              </button>
            );
          })}
        </nav>

        <div className="px-4 py-4 border-t border-slate-800 text-[11px] text-slate-500">
          <p className="font-medium text-slate-400 mb-1">Active Dataset</p>
          <p className="truncate">{activeDataset ? activeDataset.name : 'None selected'}</p>
          <p className="mt-1">{datasets.length} dataset(s) loaded</p>
        </div>
      </aside>

      {/* Mobile overlay */}
      {mobileOpen && (
        <div className="fixed inset-0 bg-black/50 z-30 lg:hidden" onClick={() => setMobileOpen(false)} />
      )}

      {/* Main content */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top bar */}
        <header className="bg-white border-b border-gray-200 px-4 lg:px-6 py-3 flex items-center justify-between sticky top-0 z-20">
          <div className="flex items-center gap-3">
            <button className="lg:hidden text-gray-500" onClick={() => setMobileOpen(true)}>
              <Menu className="w-5 h-5" />
            </button>
            <h2 className="text-sm font-semibold text-gray-900">{currentItem?.label}</h2>
          </div>
          <div className="flex items-center gap-3">
            {activeDataset ? (
              <Badge color="teal">
                <span className="inline-flex items-center gap-1">
                  <Database className="w-3 h-3" />
                  {activeDataset.rowCount} rows
                </span>
              </Badge>
            ) : (
              <Badge color="gray">No dataset</Badge>
            )}
            {activeDataset?.isSample && <Badge color="blue">Sample data</Badge>}
          </div>
        </header>

        <main className="flex-1 p-4 lg:p-6 overflow-x-hidden">{children}</main>
      </div>

      {/* Mobile close button — invisible helper */}
      {mobileOpen && (
        <button className="lg:hidden fixed top-3 right-3 z-50 text-white" onClick={() => setMobileOpen(false)}>
          <X className="w-5 h-5" />
        </button>
      )}
    </div>
  );
}
