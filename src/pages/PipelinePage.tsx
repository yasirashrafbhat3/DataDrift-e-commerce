// ============================================================================
// Page: Data Quality & Pipeline
// ============================================================================
import { useMemo, useState } from 'react';
import { GitBranch, Play, CheckCircle2, AlertTriangle, XCircle, ArrowRight } from 'lucide-react';
import { useApp } from '@/lib/store';
import { Card, CardHeader, Button, Badge, EmptyState, LoadingOverlay, StatusBadge } from '@/components/ui';
import { applyCorrections, revalidate } from '@/lib/pipeline';
import type { PageId } from '@/lib/types';

export function PipelinePage({ onNavigate }: { onNavigate: (p: PageId) => void }) {
  const { activeDataset, pipelineResult, runPipelineNow, isLoading, approveCorrection, approveAllCorrections, rejectCorrection } = useApp();
  const [expandedIncident, setExpandedIncident] = useState<string | null>(null);

  const revalidation = useMemo(() => {
    if (!pipelineResult) return null;
    const approved = pipelineResult.corrections.filter((c) => c.approved);
    const cleaned = applyCorrections(pipelineResult.cleanedRows, approved);
    return revalidate(cleaned);
  }, [pipelineResult]);

  if (!activeDataset) {
    return <EmptyState icon={<GitBranch className="w-12 h-12" />} title="No dataset selected" message="Load or upload a dataset to run the quality pipeline." action={<Button onClick={() => onNavigate('upload')}>Go to Upload</Button>} />;
  }

  if (isLoading) return <LoadingOverlay message="Running pipeline..." />;

  if (!pipelineResult) {
    return (
      <EmptyState
        icon={<GitBranch className="w-12 h-12" />}
        title="Pipeline not yet run"
        message="Run the data-quality pipeline to validate schema, detect issues, generate incidents, and propose corrections."
        action={<Button onClick={runPipelineNow}><Play className="w-4 h-4 mr-1" /> Run Pipeline</Button>}
      />
    );
  }

  const approvedCount = pipelineResult.corrections.filter((c) => c.approved).length;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-gray-900">Data Quality Pipeline</h2>
          <p className="text-sm text-gray-500">{activeDataset.name} · {activeDataset.rowCount} rows</p>
        </div>
        <Button onClick={runPipelineNow} variant="secondary" size="sm"><Play className="w-3.5 h-3.5 mr-1" /> Re-run</Button>
      </div>

      {/* Pipeline stages */}
      <Card>
        <CardHeader title="Pipeline Stages" subtitle="15-stage validation and quality check" />
        <div className="divide-y divide-gray-100">
          {pipelineResult.stages.map((s, i) => (
            <div key={i} className="px-6 py-3 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-2">
                  <span className="text-xs text-gray-400 font-mono w-6">{String(i + 1).padStart(2, '0')}</span>
                  {s.status === 'pass' && <CheckCircle2 className="w-4 h-4 text-green-500" />}
                  {s.status === 'warn' && <AlertTriangle className="w-4 h-4 text-yellow-500" />}
                  {s.status === 'fail' && <XCircle className="w-4 h-4 text-red-500" />}
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-800">{s.name}</p>
                  <p className="text-xs text-gray-500">{s.detail}</p>
                </div>
              </div>
              <StatusBadge status={s.status} />
            </div>
          ))}
        </div>
      </Card>

      {/* Quality score */}
      <Card>
        <CardHeader title="Data Quality Score" subtitle="Transparent, rule-based calculation" />
        <div className="p-6">
          <div className="flex items-center gap-6 mb-4">
            <div className={`w-20 h-20 rounded-2xl flex items-center justify-center text-2xl font-bold ${pipelineResult.qualityScore.overall >= 80 ? 'bg-green-100 text-green-700' : pipelineResult.qualityScore.overall >= 50 ? 'bg-yellow-100 text-yellow-700' : 'bg-red-100 text-red-700'}`}>
              {pipelineResult.qualityScore.overall}
            </div>
            <div>
              <p className="text-sm text-gray-600">Overall score out of 100</p>
              <p className="text-xs text-gray-400 mt-1">{pipelineResult.summary}</p>
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {pipelineResult.qualityScore.components.map((c) => (
              <div key={c.name} className="border border-gray-200 rounded-lg p-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-gray-700">{c.name}</span>
                  <span className="text-sm font-bold text-gray-800">{c.score}</span>
                </div>
                <div className="h-1.5 bg-gray-100 rounded mt-2">
                  <div className={`h-full rounded ${c.score >= 80 ? 'bg-green-400' : c.score >= 50 ? 'bg-yellow-400' : 'bg-red-400'}`} style={{ width: `${c.score}%` }} />
                </div>
                <p className="text-[11px] text-gray-400 mt-1">{c.detail}</p>
              </div>
            ))}
          </div>
        </div>
      </Card>

      {/* Incidents */}
      <Card>
        <CardHeader title="Incident Report" subtitle={`${pipelineResult.incidents.length} incident(s) detected`} action={<Button size="sm" variant="ghost" onClick={() => onNavigate('investigator')}>AI Investigator <ArrowRight className="w-3.5 h-3.5 ml-1" /></Button>} />
        <div className="divide-y divide-gray-100">
          {pipelineResult.incidents.length === 0 ? (
            <p className="text-sm text-gray-400 py-8 text-center">No incidents detected. All checks passed.</p>
          ) : (
            pipelineResult.incidents.map((inc) => (
              <div key={inc.incident_id}>
                <button
                  className="w-full px-6 py-3 flex items-center justify-between text-left hover:bg-gray-50"
                  onClick={() => setExpandedIncident(expandedIncident === inc.incident_id ? null : inc.incident_id)}
                >
                  <div>
                    <p className="text-sm font-medium text-gray-800">{inc.issue_type}</p>
                    <p className="text-xs text-gray-500">{inc.description}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge color={inc.severity === 'Critical' || inc.severity === 'High' ? 'red' : inc.severity === 'Medium' ? 'yellow' : 'blue'}>{inc.severity}</Badge>
                    <Badge color="gray">{inc.affected_rows} rows</Badge>
                    <StatusBadge status={inc.status} />
                  </div>
                </button>
                {expandedIncident === inc.incident_id && (
                  <div className="px-6 pb-4 bg-gray-50">
                    <div className="text-xs text-gray-600 space-y-2">
                      <p><strong>Evidence:</strong> {JSON.stringify(inc.evidence)}</p>
                      <p><strong>Recommended action:</strong> {inc.recommended_action}</p>
                      <p><strong>Affected row IDs:</strong> {inc.affected_row_ids.slice(0, 20).join(', ')}{inc.affected_row_ids.length > 20 && ` ... (+${inc.affected_row_ids.length - 20} more)`}</p>
                    </div>
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      </Card>

      {/* Corrections */}
      {pipelineResult.corrections.length > 0 && (
        <Card>
          <CardHeader
            title="Proposed Corrections"
            subtitle={`${pipelineResult.corrections.length} correction(s) · ${approvedCount} approved`}
            action={<Button size="sm" onClick={approveAllCorrections}>Approve All</Button>}
          />
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-4 py-2 text-left font-medium text-gray-600">Row ID</th>
                  <th className="px-4 py-2 text-left font-medium text-gray-600">Field</th>
                  <th className="px-4 py-2 text-left font-medium text-gray-600">Current</th>
                  <th className="px-4 py-2 text-left font-medium text-gray-600">Proposed</th>
                  <th className="px-4 py-2 text-left font-medium text-gray-600">Reason</th>
                  <th className="px-4 py-2 text-left font-medium text-gray-600">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {pipelineResult.corrections.slice(0, 50).map((c, i) => (
                  <tr key={i} className={c.approved ? 'bg-green-50/50' : ''}>
                    <td className="px-4 py-2 text-gray-700">{c.row_id}</td>
                    <td className="px-4 py-2 text-gray-700">{c.field}</td>
                    <td className="px-4 py-2 text-gray-700">{String(c.current_value)}</td>
                    <td className="px-4 py-2 text-gray-700">{String(c.proposed_value)}</td>
                    <td className="px-4 py-2 text-gray-500 max-w-[200px] truncate">{c.reason}</td>
                    <td className="px-4 py-2">
                      {c.approved ? (
                        <Badge color="green">Approved</Badge>
                      ) : (
                        <div className="flex gap-1">
                          <Button size="sm" variant="secondary" onClick={() => approveCorrection(i)}>Approve</Button>
                          <Button size="sm" variant="ghost" onClick={() => rejectCorrection(i)}>Reject</Button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {pipelineResult.corrections.length > 50 && (
            <p className="text-xs text-gray-400 px-6 py-2">Showing first 50 of {pipelineResult.corrections.length} corrections.</p>
          )}
        </Card>
      )}

      {/* Revalidation */}
      {revalidation && (
        <Card className={`p-4 ${revalidation.issues === 0 ? 'border-l-4 border-l-green-400' : 'border-l-4 border-l-yellow-400'}`}>
          <div className="flex items-center gap-3">
            {revalidation.issues === 0 ? <CheckCircle2 className="w-5 h-5 text-green-500" /> : <AlertTriangle className="w-5 h-5 text-yellow-500" />}
            <div>
              <p className="text-sm font-medium text-gray-800">Revalidation after corrections</p>
              <p className="text-xs text-gray-500">{revalidation.detail}</p>
            </div>
          </div>
        </Card>
      )}
    </div>
  );
}
