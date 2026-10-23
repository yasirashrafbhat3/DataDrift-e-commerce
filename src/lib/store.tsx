// ============================================================================
// App state store — React context for datasets, pipeline, incidents, analytics
// ============================================================================
import { createContext, useContext, useState, useCallback, type ReactNode } from 'react';
import type { Dataset, Incident, PipelineResult, Correction, IncidentStatus } from './types';
import { parseCsv, toCsv } from './csv';
import { runPipeline, applyCorrections, revalidate } from './pipeline';
import { generateCleanData, generateCorruptedData } from './sampleData';
import { computeAnalytics, type AnalyticsResult } from './analytics';
import { downloadText, downloadCsv } from './exportUtils';

let datasetCounter = 0;

function makeId() {
  datasetCounter++;
  return `ds-${Date.now()}-${datasetCounter}`;
}

function rowsFromData(data: { order_id: string; customer_id: string; product_id: string; product_category: string; quantity: number; amount: number; order_date: string; status: string }[]) {
  return data.map((r) => ({
    order_id: r.order_id,
    customer_id: r.customer_id,
    product_id: r.product_id,
    product_category: r.product_category,
    quantity: r.quantity,
    amount: r.amount,
    order_date: r.order_date,
    status: r.status,
  }));
}

interface AppState {
  datasets: Dataset[];
  activeDatasetId: string | null;
  pipelineResult: PipelineResult | null;
  analytics: AnalyticsResult | null;
  isLoading: boolean;
  error: string | null;

  // actions
  loadSample: (which: 'clean' | 'corrupted') => void;
  uploadCsv: (filename: string, text: string) => void;
  selectDataset: (id: string) => void;
  runPipelineNow: () => void;
  approveCorrection: (index: number) => void;
  approveAllCorrections: () => void;
  rejectCorrection: (index: number) => void;
  setIncidentStatus: (incidentId: string, status: IncidentStatus) => void;
  downloadOriginal: () => void;
  downloadCleaned: () => void;
  clearError: () => void;

  activeDataset: Dataset | null;
}

const AppContext = createContext<AppState | null>(null);

export function useApp(): AppState {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be used within AppProvider');
  return ctx;
}

export function AppProvider({ children }: { children: ReactNode }) {
  const [datasets, setDatasets] = useState<Dataset[]>([]);
  const [activeDatasetId, setActiveDatasetId] = useState<string | null>(null);
  const [pipelineResult, setPipelineResult] = useState<PipelineResult | null>(null);
  const [analytics, setAnalytics] = useState<AnalyticsResult | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const addDataset = useCallback((ds: Dataset) => {
    setDatasets((prev) => [...prev, ds]);
    setActiveDatasetId(ds.id);
    setPipelineResult(null);
    setAnalytics(null);
  }, []);

  const loadSample = useCallback((which: 'clean' | 'corrupted') => {
    setError(null);
    setIsLoading(true);
    try {
      const data = which === 'clean' ? generateCleanData() : generateCorruptedData();
      const rows = rowsFromData(data);
      const csvText = toCsv(rows);
      const parsed = parseCsv(csvText);
      const ds: Dataset = {
        id: makeId(),
        name: which === 'clean' ? 'Sample E-commerce (Clean)' : 'Sample E-commerce (Corrupted)',
        isSample: true,
        isCorrupted: which === 'corrupted',
        rows: parsed.rows,
        columns: parsed.columns,
        rowCount: parsed.rowCount,
        createdAt: Date.now(),
        source: 'sample',
      };
      addDataset(ds);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load sample data.');
    } finally {
      setIsLoading(false);
    }
  }, [addDataset]);

  const uploadCsv = useCallback((filename: string, text: string) => {
    setError(null);
    setIsLoading(true);
    try {
      if (!text.trim()) {
        setError('The file is empty. Please upload a CSV with data.');
        return;
      }
      const parsed = parseCsv(text);
      if (parsed.rowCount === 0) {
        setError('No data rows found in the CSV.');
        return;
      }
      const ds: Dataset = {
        id: makeId(),
        name: filename,
        isSample: false,
        isCorrupted: false,
        rows: parsed.rows,
        columns: parsed.columns,
        rowCount: parsed.rowCount,
        createdAt: Date.now(),
        source: 'upload',
      };
      addDataset(ds);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to parse CSV file.');
    } finally {
      setIsLoading(false);
    }
  }, [addDataset]);

  const selectDataset = useCallback((id: string) => {
    setActiveDatasetId(id);
    setPipelineResult(null);
    setAnalytics(null);
    setError(null);
  }, []);

  const activeDataset = datasets.find((d) => d.id === activeDatasetId) || null;

  const runPipelineNow = useCallback(() => {
    if (!activeDataset) {
      setError('No dataset selected. Load a sample or upload a CSV first.');
      return;
    }
    setError(null);
    setIsLoading(true);
    try {
      const result = runPipeline(activeDataset);
      setPipelineResult(result);
      setAnalytics(computeAnalytics(activeDataset));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Pipeline execution failed.');
    } finally {
      setIsLoading(false);
    }
  }, [activeDataset]);

  const approveCorrection = useCallback((index: number) => {
    setPipelineResult((prev) => {
      if (!prev) return prev;
      const corrections = prev.corrections.map((c, i) => (i === index ? { ...c, approved: !c.approved } : c));
      const cleanedRows = applyCorrections(prev.cleanedRows, corrections.filter((c) => c.approved));
      // Revalidate
      const rv = revalidate(cleanedRows);
      return { ...prev, corrections, cleanedRows, summary: `${prev.summary} Revalidation: ${rv.detail}` };
    });
  }, []);

  const approveAllCorrections = useCallback(() => {
    setPipelineResult((prev) => {
      if (!prev) return prev;
      const corrections = prev.corrections.map((c) => ({ ...c, approved: true }));
      const cleanedRows = applyCorrections(prev.cleanedRows, corrections.filter((c) => c.approved));
      const rv = revalidate(cleanedRows);
      return { ...prev, corrections, cleanedRows, summary: `${prev.summary} Revalidation: ${rv.detail}` };
    });
  }, []);

  const rejectCorrection = useCallback((index: number) => {
    setPipelineResult((prev) => {
      if (!prev) return prev;
      const corrections = prev.corrections.map((c, i) => (i === index ? { ...c, approved: false } : c));
      const cleanedRows = applyCorrections(prev.cleanedRows, corrections.filter((c) => c.approved));
      return { ...prev, corrections, cleanedRows };
    });
  }, []);

  const setIncidentStatus = useCallback((incidentId: string, status: IncidentStatus) => {
    setPipelineResult((prev) => {
      if (!prev) return prev;
      const incidents = prev.incidents.map((i) => (i.incident_id === incidentId ? { ...i, status } : i));
      return { ...prev, incidents };
    });
  }, []);

  const downloadOriginal = useCallback(() => {
    if (!activeDataset) return;
    downloadCsv(`original-${activeDataset.name.replace(/\.[^/.]+$/, '')}.csv`, activeDataset.rows);
  }, [activeDataset]);

  const downloadCleaned = useCallback(() => {
    if (!pipelineResult) return;
    downloadCsv(`cleaned-${activeDataset?.name.replace(/\.[^/.]+$/, '') || 'dataset'}.csv`, pipelineResult.cleanedRows);
  }, [pipelineResult, activeDataset]);

  const clearError = useCallback(() => setError(null), []);

  const value: AppState = {
    datasets,
    activeDatasetId,
    pipelineResult,
    analytics,
    isLoading,
    error,
    loadSample,
    uploadCsv,
    selectDataset,
    runPipelineNow,
    approveCorrection,
    approveAllCorrections,
    rejectCorrection,
    setIncidentStatus,
    downloadOriginal,
    downloadCleaned,
    clearError,
    activeDataset,
  };

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}
