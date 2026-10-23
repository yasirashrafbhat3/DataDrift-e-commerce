// ============================================================================
// Page: Cleaned Data & Exports
// ============================================================================
import { Download, FileSpreadsheet, FileJson, FileText, FileCheck } from 'lucide-react';
import { useApp } from '@/lib/store';
import { Card, CardHeader, Button, Badge, EmptyState } from '@/components/ui';
import { downloadCsv, downloadJson, incidentsToCsv, pipelineSummaryToCsv, analyticsSummaryToCsv, downloadText } from '@/lib/exportUtils';

export function ExportsPage() {
  const { activeDataset, pipelineResult, analytics, downloadOriginal, downloadCleaned } = useApp();

  if (!activeDataset) {
    return <EmptyState icon={<Download className="w-12 h-12" />} title="No dataset selected" message="Load or upload a dataset to access exports." />;
  }

  const approvedCorrections = pipelineResult?.corrections.filter((c) => c.approved).length || 0;

  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <h2 className="text-lg font-bold text-gray-900">Cleaned Data & Exports</h2>
        <p className="text-sm text-gray-500 mt-1">Download datasets, incident reports, analytics summaries, and pipeline execution logs.</p>
      </div>

      {/* Cleaned data preview */}
      {pipelineResult && (
        <Card>
          <CardHeader title="Cleaned Dataset Preview" subtitle={`After ${approvedCorrections} approved correction(s) — first 15 rows`} action={
            <Button size="sm" onClick={downloadCleaned}><Download className="w-3.5 h-3.5 mr-1" /> Download Cleaned CSV</Button>
          } />
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  {activeDataset.columns.map((c) => (
                    <th key={c.name} className="px-3 py-2 text-left font-medium text-gray-600">{c.name}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {pipelineResult.cleanedRows.slice(0, 15).map((row, i) => (
                  <tr key={i} className="hover:bg-gray-50">
                    {activeDataset.columns.map((c) => (
                      <td key={c.name} className="px-3 py-2 text-gray-700 max-w-[120px] truncate">{String(row[c.name] ?? '')}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="border-t border-gray-100 px-6 py-3 flex items-center gap-3">
            <Badge color="teal">{pipelineResult.cleanedRows.length} rows in cleaned dataset</Badge>
            {approvedCorrections > 0 ? <Badge color="green">{approvedCorrections} corrections applied</Badge> : <Badge color="gray">No corrections applied yet</Badge>}
          </div>
        </Card>
      )}

      {/* Export options */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Card className="p-5">
          <div className="flex items-center gap-3 mb-3">
            <FileSpreadsheet className="w-6 h-6 text-blue-500" />
            <div>
              <h3 className="text-sm font-semibold text-gray-800">Original Dataset</h3>
              <p className="text-xs text-gray-500">Raw data as loaded, unmodified.</p>
            </div>
          </div>
          <Button variant="secondary" size="sm" onClick={downloadOriginal}>Download CSV</Button>
        </Card>

        <Card className="p-5">
          <div className="flex items-center gap-3 mb-3">
            <FileCheck className="w-6 h-6 text-green-500" />
            <div>
              <h3 className="text-sm font-semibold text-gray-800">Cleaned Dataset</h3>
              <p className="text-xs text-gray-500">With approved corrections applied.</p>
            </div>
          </div>
          <Button size="sm" onClick={downloadCleaned} disabled={!pipelineResult}>Download CSV</Button>
        </Card>

        <Card className="p-5">
          <div className="flex items-center gap-3 mb-3">
            <FileJson className="w-6 h-6 text-amber-500" />
            <div>
              <h3 className="text-sm font-semibold text-gray-800">Incident Report (JSON)</h3>
              <p className="text-xs text-gray-500">Full incident details with evidence.</p>
            </div>
          </div>
          <Button variant="secondary" size="sm" onClick={() => pipelineResult && downloadJson('incident-report.json', pipelineResult.incidents)} disabled={!pipelineResult}>Download JSON</Button>
        </Card>

        <Card className="p-5">
          <div className="flex items-center gap-3 mb-3">
            <FileSpreadsheet className="w-6 h-6 text-teal-500" />
            <div>
              <h3 className="text-sm font-semibold text-gray-800">Incident Report (CSV)</h3>
              <p className="text-xs text-gray-500">Tabular incident summary.</p>
            </div>
          </div>
          <Button variant="secondary" size="sm" onClick={() => pipelineResult && downloadText('incident-report.csv', incidentsToCsv(pipelineResult.incidents))} disabled={!pipelineResult}>Download CSV</Button>
        </Card>
      </div>

      {/* Pipeline + analytics summaries */}
      <Card>
        <CardHeader title="Summary Exports" subtitle="Pipeline execution and analytics summaries" />
        <div className="p-5 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <FileText className="w-5 h-5 text-gray-400" />
              <div>
                <p className="text-sm font-medium text-gray-800">Pipeline Execution Summary</p>
                <p className="text-xs text-gray-500">All pipeline stages and their results.</p>
              </div>
            </div>
            <Button size="sm" variant="secondary"
              onClick={() => pipelineResult && downloadText('pipeline-summary.csv', pipelineSummaryToCsv(pipelineResult))}
              disabled={!pipelineResult}>Download CSV</Button>
          </div>
          <div className="border-t border-gray-100 pt-3 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <FileText className="w-5 h-5 text-gray-400" />
              <div>
                <p className="text-sm font-medium text-gray-800">Analytics Summary</p>
                <p className="text-xs text-gray-500">Key business metrics in CSV form.</p>
              </div>
            </div>
            <Button size="sm" variant="secondary"
              onClick={() => analytics && downloadText('analytics-summary.csv', analyticsSummaryToCsv(analytics))}
              disabled={!analytics}>Download CSV</Button>
          </div>
        </div>
      </Card>

      {/* Data lineage note */}
      <Card className="p-5">
        <h3 className="text-sm font-semibold text-gray-800 mb-2">Data Lineage</h3>
        <div className="text-xs text-gray-600 space-y-1">
          <p><strong>Original:</strong> The raw uploaded or sample data, preserved unmodified. Always downloadable.</p>
          <p><strong>Proposed corrections:</strong> Generated by the pipeline, shown in the Pipeline page for review. Not applied until approved.</p>
          <p><strong>Approved corrections:</strong> Applied to produce the cleaned dataset. Only approved changes are included.</p>
        </div>
      </Card>
    </div>
  );
}
