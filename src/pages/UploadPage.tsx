// ============================================================================
// Page: Upload Dataset
// ============================================================================
import { useRef, useState } from 'react';
import { Upload, FileText, CheckCircle2, Database, Table, FileType2, Download } from 'lucide-react';
import { useApp } from '@/lib/store';
import { Card, CardHeader, Button, Badge, EmptyState } from '@/components/ui';
import type { PageId } from '@/lib/types';

export function UploadPage({ onNavigate }: { onNavigate: (p: PageId) => void }) {
  const { datasets, activeDatasetId, loadSample, uploadCsv, selectDataset, downloadOriginal, isLoading, error } = useApp();
  const fileRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);

  const handleFile = (file: File) => {
    setLocalError(null);
    if (!file.name.toLowerCase().endsWith('.csv')) {
      setLocalError('Please upload a .csv file.');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const text = reader.result as string;
      uploadCsv(file.name, text);
    };
    reader.onerror = () => setLocalError('Could not read the file.');
    reader.readAsText(file);
  };

  const activeDs = datasets.find((d) => d.id === activeDatasetId);

  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <h2 className="text-lg font-bold text-gray-900">Dataset Upload & Management</h2>
        <p className="text-sm text-gray-500 mt-1">Upload your own CSV or load a bundled sample dataset to begin analysis.</p>
      </div>

      {(error || localError) && (
        <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-sm text-red-700">
          {localError || error}
        </div>
      )}

      {/* Upload zone */}
      <Card>
        <CardHeader title="Upload CSV File" subtitle="Expected columns: order_id, customer_id, product_id, product_category, quantity, amount, order_date, status" />
        <div className="p-6">
          <div
            className={`border-2 border-dashed rounded-xl p-10 text-center transition-colors cursor-pointer ${
              dragOver ? 'border-blue-400 bg-blue-50' : 'border-gray-300 hover:border-gray-400'
            }`}
            onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDragOver(false);
              if (e.dataTransfer.files[0]) handleFile(e.dataTransfer.files[0]);
            }}
            onClick={() => fileRef.current?.click()}
          >
            <Upload className="w-10 h-10 text-gray-400 mx-auto mb-3" />
            <p className="text-sm text-gray-600 font-medium">Drag and drop your CSV here, or click to browse</p>
            <p className="text-xs text-gray-400 mt-1">Max file size: 10 MB · CSV format only</p>
            <input
              ref={fileRef}
              type="file"
              accept=".csv"
              className="hidden"
              onChange={(e) => { if (e.target.files?.[0]) handleFile(e.target.files[0]); }}
            />
          </div>
        </div>
      </Card>

      {/* Sample datasets */}
      <Card>
        <CardHeader title="Sample Datasets" subtitle="Reproducible, synthetic e-commerce data (clearly labelled, not real customer data)" />
        <div className="p-6 grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="border border-gray-200 rounded-lg p-4">
            <div className="flex items-center gap-2 mb-2">
              <CheckCircle2 className="w-5 h-5 text-green-500" />
              <h4 className="text-sm font-semibold text-gray-800">Clean Dataset</h4>
              <Badge color="green">600 rows</Badge>
            </div>
            <p className="text-xs text-gray-500 mb-3">A fully valid e-commerce dataset that passes all pipeline checks.</p>
            <Button size="sm" onClick={() => { loadSample('clean'); onNavigate('pipeline'); }}>Load & Run Pipeline</Button>
          </div>
          <div className="border border-gray-200 rounded-lg p-4">
            <div className="flex items-center gap-2 mb-2">
              <FileText className="w-5 h-5 text-amber-500" />
              <h4 className="text-sm font-semibold text-gray-800">Corrupted Dataset</h4>
              <Badge color="red">600 rows</Badge>
            </div>
            <p className="text-xs text-gray-500 mb-3">Contains duplicates, missing values, invalid quantities, bad dates, and outliers.</p>
            <Button size="sm" variant="secondary" onClick={() => { loadSample('corrupted'); onNavigate('pipeline'); }}>Load & Run Pipeline</Button>
          </div>
        </div>
      </Card>

      {/* Dataset list */}
      <Card>
        <CardHeader title="Loaded Datasets" subtitle={`${datasets.length} dataset(s) available`} />
        {datasets.length === 0 ? (
          <EmptyState icon={<Database className="w-10 h-10" />} title="No datasets yet" message="Load a sample or upload a CSV to get started." />
        ) : (
          <div className="divide-y divide-gray-100">
            {datasets.map((ds) => (
              <div key={ds.id} className={`px-6 py-4 flex items-center justify-between ${ds.id === activeDatasetId ? 'bg-blue-50/50' : ''}`}>
                <div className="flex items-center gap-3">
                  <Table className="w-5 h-5 text-gray-400" />
                  <div>
                    <p className="text-sm font-medium text-gray-800">{ds.name}</p>
                    <p className="text-xs text-gray-500">
                      {ds.rowCount} rows · {ds.columns.length} columns
                      {ds.isSample && <span className="ml-2">· <Badge color="blue">Sample</Badge></span>}
                      {ds.isCorrupted && <Badge color="red">Corrupted</Badge>}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {ds.id === activeDatasetId && <Badge color="teal">Active</Badge>}
                  <Button size="sm" variant="ghost" onClick={() => selectDataset(ds.id)} disabled={ds.id === activeDatasetId}>
                    Select
                  </Button>
                  {ds.id === activeDatasetId && (
                    <Button size="sm" variant="ghost" onClick={downloadOriginal}>
                      <Download className="w-3.5 h-3.5 mr-1" /> Original
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* Preview active dataset */}
      {activeDs && (
        <Card>
          <CardHeader title="Data Preview" subtitle={`${activeDs.name} — first 10 rows`} />
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  {activeDs.columns.map((c) => (
                    <th key={c.name} className="px-3 py-2 text-left font-medium text-gray-600">
                      {c.name}
                      <span className="ml-1 text-gray-400 font-normal">({c.type})</span>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {activeDs.rows.slice(0, 10).map((row, i) => (
                  <tr key={i} className="hover:bg-gray-50">
                    {activeDs.columns.map((c) => (
                      <td key={c.name} className="px-3 py-2 text-gray-700 max-w-[120px] truncate">
                        {String(row[c.name] ?? '')}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {/* Column stats */}
          <div className="border-t border-gray-100 px-6 py-4 grid grid-cols-2 sm:grid-cols-4 gap-3">
            {activeDs.columns.map((c) => (
              <div key={c.name} className="text-xs">
                <div className="flex items-center gap-1 text-gray-600 font-medium">
                  <FileType2 className="w-3 h-3" />
                  {c.name}
                </div>
                <div className="text-gray-400">
                  Type: {c.type} · Missing: {c.missing}
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      {isLoading && <p className="text-sm text-gray-500">Loading...</p>}
    </div>
  );
}
