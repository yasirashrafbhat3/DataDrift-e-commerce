// ============================================================================
// Export utilities — CSV/JSON download helpers
// ============================================================================
import { toCsv } from './csv';
import type { Incident, PipelineResult } from './types';
import type { AnalyticsResult } from './analytics';

export function downloadText(filename: string, text: string, mime = 'text/plain') {
  const blob = new Blob([text], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export function downloadCsv(filename: string, rows: Record<string, string | number | null>[]) {
  downloadText(filename, toCsv(rows), 'text/csv');
}

export function downloadJson(filename: string, data: unknown) {
  downloadText(filename, JSON.stringify(data, null, 2), 'application/json');
}

export function incidentsToCsv(incidents: Incident[]): string {
  const rows = incidents.map((i) => ({
    incident_id: i.incident_id,
    issue_type: i.issue_type,
    severity: i.severity,
    status: i.status,
    affected_rows: i.affected_rows,
    affected_row_ids: i.affected_row_ids.join('; '),
    description: i.description,
    recommended_action: i.recommended_action,
  }));
  return toCsv(rows);
}

export function pipelineSummaryToCsv(result: PipelineResult): string {
  const rows = result.stages.map((s) => ({
    stage: s.name,
    status: s.status,
    detail: s.detail,
  }));
  rows.push({ stage: '---', status: 'pass', detail: '' });
  rows.push({ stage: 'Quality Score', status: 'pass', detail: result.summary });
  return toCsv(rows);
}

export function analyticsSummaryToCsv(analytics: AnalyticsResult): string {
  const lines: Record<string, string | number | null>[] = [];
  const m = analytics.metrics;
  lines.push({ metric: 'Total Orders', value: m.totalOrders });
  lines.push({ metric: 'Total Revenue', value: m.totalRevenue.toFixed(2) });
  lines.push({ metric: 'Avg Order Value', value: m.avgOrderValue.toFixed(2) });
  lines.push({ metric: 'Total Units Sold', value: m.totalUnitsSold });
  lines.push({ metric: 'Duplicates', value: m.duplicates });
  lines.push({ metric: 'Missing Required', value: m.missingRequired });
  lines.push({ metric: 'Invalid Records', value: m.invalidRecords });
  lines.push({ metric: 'Returned Orders', value: analytics.returnsAnalysis.returnedOrders });
  lines.push({ metric: 'Cancelled Orders', value: analytics.returnsAnalysis.cancelledOrders });
  return toCsv(lines);
}
