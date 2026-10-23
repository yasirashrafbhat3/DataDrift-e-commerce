// ============================================================================
// Data Quality Pipeline
//
// Stages (per project spec):
//  1. Load dataset
//  2. Inspect schema
//  3. Validate required columns
//  4. Check data types
//  5. Detect duplicate order IDs
//  6. Detect missing required fields
//  7. Detect invalid quantities
//  8. Detect negative/invalid amounts
//  9. Validate date fields
// 10. Check invalid status values
// 11. Identify suspicious outliers (flagged, not auto-corrected)
// 12. Generate structured incident report
// 13. Propose safe corrections
// (14–15 correction preview/approve + revalidate happen in the UI store)
// ============================================================================
import type {
  ColumnInfo,
  Correction,
  Dataset,
  Incident,
  PipelineResult,
  PipelineStage,
  QualityScore,
  Severity,
} from './types';
import { REQUIRED_COLUMNS, toOrderRecords } from './csv';

const VALID_STATUSES = ['Delivered', 'Shipped', 'Processing', 'Cancelled', 'Returned'];
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const NUM_RE = /^-?\d*\.?\d+$/;

function stage(name: string, status: PipelineStage['status'], detail: string): PipelineStage {
  return { name, status, detail };
}

export function runPipeline(dataset: Dataset): PipelineResult {
  const stages: PipelineStage[] = [];
  const incidents: Incident[] = [];
  const corrections: Correction[] = [];

  // --- Stage 1: Load ---
  stages.push(stage('Load dataset', 'pass', `${dataset.rowCount} rows loaded from "${dataset.name}".`));

  // --- Stage 2: Inspect schema ---
  const presentCols = new Set(dataset.columns.map((c) => c.name));
  stages.push(
    stage('Inspect schema', 'pass', `Columns: ${dataset.columns.map((c) => c.name).join(', ')}`),
  );

  // --- Stage 3: Validate required columns ---
  const missingCols = REQUIRED_COLUMNS.filter((c) => !presentCols.has(c));
  if (missingCols.length > 0) {
    stages.push(stage('Validate required columns', 'fail', `Missing: ${missingCols.join(', ')}`));
    incidents.push({
      incident_id: 'INC-SCHEMA',
      issue_type: 'Schema Mismatch',
      severity: 'Critical',
      description: `Dataset is missing required column(s): ${missingCols.join(', ')}.`,
      affected_rows: dataset.rowCount,
      affected_row_ids: [],
      evidence: { missing_columns: missingCols },
      recommended_action: 'Re-upload a CSV containing all required columns.',
      status: 'Open',
    });
  } else {
    stages.push(stage('Validate required columns', 'pass', 'All required columns present.'));
  }

  const rows = toOrderRecords(dataset.rows);

  // --- Stage 4: Check data types ---
  let typeIssues = 0;
  const badTypeRows: string[] = [];
  for (const r of rows) {
    const qtyBad = r.quantity !== null && !NUM_RE.test(String(r.quantity));
    const amtBad = r.amount !== null && !NUM_RE.test(String(r.amount));
    if (qtyBad || amtBad) {
      typeIssues++;
      if (r.order_id) badTypeRows.push(String(r.order_id));
    }
  }
  if (typeIssues > 0) {
    stages.push(stage('Check data types', 'warn', `${typeIssues} rows have non-numeric quantity or amount.`));
    incidents.push({
      incident_id: 'INC-TYPES',
      issue_type: 'Invalid Data Types',
      severity: 'High',
      description: `${typeIssues} rows contain non-numeric values in quantity or amount columns.`,
      affected_rows: typeIssues,
      affected_row_ids: dedupe(badTypeRows).slice(0, 200),
      evidence: { bad_type_count: typeIssues },
      recommended_action: 'Review rows with non-numeric quantity/amount and correct or remove them.',
      status: 'Open',
    });
  } else {
    stages.push(stage('Check data types', 'pass', 'Quantity and amount columns are numeric.'));
  }

  // --- Stage 5: Duplicate order IDs ---
  const idCounts = new Map<string, number>();
  for (const r of rows) {
    const id = String(r.order_id ?? '');
    if (!id) continue;
    idCounts.set(id, (idCounts.get(id) || 0) + 1);
  }
  const dupIds = [...idCounts.entries()].filter(([, c]) => c > 1);
  if (dupIds.length > 0) {
    const totalDupRows = dupIds.reduce((s, [, c]) => s + c, 0);
    const dupIdList = dupIds.map(([id]) => id);
    stages.push(stage('Detect duplicate order IDs', 'warn', `${dupIds.length} order IDs appear more than once (${totalDupRows} rows).`));
    incidents.push({
      incident_id: 'INC-DUPES',
      issue_type: 'Duplicate Order IDs',
      severity: 'High',
      description: `${dupIds.length} order IDs are duplicated across ${totalDupRows} rows, which can cause double-counting in analytics.`,
      affected_rows: totalDupRows,
      affected_row_ids: dupIdList.slice(0, 200),
      evidence: { duplicate_ids: dupIds.length, sample_ids: dupIdList.slice(0, 10) },
      recommended_action: 'Keep the first occurrence of each order_id and mark the rest as duplicates to be removed.',
      status: 'Open',
    });
    // corrections: remove duplicate rows (keep first)
    const seen = new Set<string>();
    for (const r of rows) {
      const id = String(r.order_id ?? '');
      if (!id) continue;
      if (seen.has(id)) {
        corrections.push({
          row_id: id,
          field: '__row__',
          current_value: 'duplicate row',
          proposed_value: null,
          reason: 'Duplicate order_id — remove this row, keeping the first occurrence.',
          incident_id: 'INC-DUPES',
          approved: false,
        });
      } else {
        seen.add(id);
      }
    }
  } else {
    stages.push(stage('Detect duplicate order IDs', 'pass', 'No duplicate order IDs found.'));
  }

  // --- Stage 6: Missing required fields ---
  const requiredFields = ['order_id', 'customer_id', 'product_category', 'order_date', 'status'];
  for (const field of requiredFields) {
    const missingRows = rows.filter((r) => {
      const v = r[field];
      return v === '' || v === null || v === undefined;
    });
    if (missingRows.length > 0) {
      stages.push(stage(`Detect missing ${field}`, 'warn', `${missingRows.length} rows missing "${field}".`));
      incidents.push({
        incident_id: `INC-MISSING-${field}`,
        issue_type: 'Missing Required Field',
        severity: field === 'order_id' ? 'Critical' : 'Medium',
        description: `${missingRows.length} rows have a missing value in the required "${field}" column.`,
        affected_rows: missingRows.length,
        affected_row_ids: missingRows.map((r) => String(r.order_id ?? '')).filter(Boolean).slice(0, 200),
        evidence: { field, missing_count: missingRows.length },
        recommended_action: `Review rows with missing ${field}; fill from source or exclude from analysis.`,
        status: 'Open',
      });
    } else {
      stages.push(stage(`Detect missing ${field}`, 'pass', `"${field}" present in all rows.`));
    }
  }

  // Also check quantity & amount missing
  for (const field of ['quantity', 'amount']) {
    const missingRows = rows.filter((r) => r[field] === null || r[field] === '' || r[field] === undefined);
    if (missingRows.length > 0) {
      stages.push(stage(`Detect missing ${field}`, 'warn', `${missingRows.length} rows missing "${field}".`));
      incidents.push({
        incident_id: `INC-MISSING-${field}`,
        issue_type: 'Missing Required Field',
        severity: 'Medium',
        description: `${missingRows.length} rows have a missing value in the "${field}" column.`,
        affected_rows: missingRows.length,
        affected_row_ids: missingRows.map((r) => String(r.order_id ?? '')).filter(Boolean).slice(0, 200),
        evidence: { field, missing_count: missingRows.length },
        recommended_action: `Review rows with missing ${field}; impute or exclude from analysis.`,
        status: 'Open',
      });
    } else {
      stages.push(stage(`Detect missing ${field}`, 'pass', `"${field}" present in all rows.`));
    }
  }

  // --- Stage 7: Invalid quantities ---
  const invalidQty = rows.filter((r) => r.quantity !== null && (r.quantity as number) <= 0);
  if (invalidQty.length > 0) {
    stages.push(stage('Detect invalid quantities', 'warn', `${invalidQty.length} rows with quantity <= 0.`));
    incidents.push({
      incident_id: 'INC-QTY',
      issue_type: 'Invalid Quantity',
      severity: 'High',
      description: `${invalidQty.length} rows have quantity values of zero or less, which are invalid for order records.`,
      affected_rows: invalidQty.length,
      affected_row_ids: invalidQty.map((r) => String(r.order_id ?? '')).filter(Boolean).slice(0, 200),
      evidence: { invalid_quantities: invalidQty.length, sample_quantities: invalidQty.slice(0, 10).map((r) => r.quantity) },
      recommended_action: 'Set quantity to null (exclude from analytics) or correct to a positive integer if the source is known.',
      status: 'Open',
    });
    for (const r of invalidQty) {
      corrections.push({
        row_id: String(r.order_id ?? ''),
        field: 'quantity',
        current_value: r.quantity,
        proposed_value: null,
        reason: 'Quantity <= 0 is invalid; set to null to exclude from analytics.',
        incident_id: 'INC-QTY',
        approved: false,
      });
    }
  } else {
    stages.push(stage('Detect invalid quantities', 'pass', 'All quantities are positive.'));
  }

  // --- Stage 8: Negative/invalid amounts ---
  const invalidAmt = rows.filter((r) => r.amount !== null && (r.amount as number) <= 0);
  if (invalidAmt.length > 0) {
    stages.push(stage('Detect invalid amounts', 'warn', `${invalidAmt.length} rows with amount <= 0.`));
    incidents.push({
      incident_id: 'INC-AMT',
      issue_type: 'Invalid Amount',
      severity: 'High',
      description: `${invalidAmt.length} rows have amount values of zero or less, which are invalid for revenue records.`,
      affected_rows: invalidAmt.length,
      affected_row_ids: invalidAmt.map((r) => String(r.order_id ?? '')).filter(Boolean).slice(0, 200),
      evidence: { invalid_amounts: invalidAmt.length, sample_amounts: invalidAmt.slice(0, 10).map((r) => r.amount) },
      recommended_action: 'Set amount to null (exclude from revenue) or correct to a positive value if the source is known.',
      status: 'Open',
    });
    for (const r of invalidAmt) {
      corrections.push({
        row_id: String(r.order_id ?? ''),
        field: 'amount',
        current_value: r.amount,
        proposed_value: null,
        reason: 'Amount <= 0 is invalid; set to null to exclude from revenue analytics.',
        incident_id: 'INC-AMT',
        approved: false,
      });
    }
  } else {
    stages.push(stage('Detect invalid amounts', 'pass', 'All amounts are positive.'));
  }

  // --- Stage 9: Validate dates ---
  const invalidDates = rows.filter((r) => {
    const d = String(r.order_date ?? '');
    if (!d) return false; // missing handled above
    return !DATE_RE.test(d) || isNaN(Date.parse(d));
  });
  if (invalidDates.length > 0) {
    stages.push(stage('Validate date fields', 'warn', `${invalidDates.length} rows with malformed order_date.`));
    incidents.push({
      incident_id: 'INC-DATE',
      issue_type: 'Invalid Date',
      severity: 'Medium',
      description: `${invalidDates.length} rows have malformed or unparseable order_date values.`,
      affected_rows: invalidDates.length,
      affected_row_ids: invalidDates.map((r) => String(r.order_id ?? '')).filter(Boolean).slice(0, 200),
      evidence: { invalid_dates: invalidDates.length, sample_dates: invalidDates.slice(0, 10).map((r) => String(r.order_date)) },
      recommended_action: 'Correct date format to YYYY-MM-DD or set to null if unrecoverable.',
      status: 'Open',
    });
    for (const r of invalidDates) {
      corrections.push({
        row_id: String(r.order_id ?? ''),
        field: 'order_date',
        current_value: r.order_date,
        proposed_value: null,
        reason: 'Malformed date; set to null so it is excluded from time-based analytics.',
        incident_id: 'INC-DATE',
        approved: false,
      });
    }
  } else {
    stages.push(stage('Validate date fields', 'pass', 'All order_date values are valid.'));
  }

  // --- Stage 10: Invalid status values ---
  const invalidStatus = rows.filter((r) => {
    const s = String(r.status ?? '');
    return s && !VALID_STATUSES.includes(s);
  });
  if (invalidStatus.length > 0) {
    stages.push(stage('Check invalid status values', 'warn', `${invalidStatus.length} rows with unexpected status.`));
    incidents.push({
      incident_id: 'INC-STATUS',
      issue_type: 'Invalid Status',
      severity: 'Low',
      description: `${invalidStatus.length} rows have status values outside the expected set (${VALID_STATUSES.join(', ')}).`,
      affected_rows: invalidStatus.length,
      affected_row_ids: invalidStatus.map((r) => String(r.order_id ?? '')).filter(Boolean).slice(0, 200),
      evidence: { invalid_statuses: invalidStatus.length, sample_statuses: invalidStatus.slice(0, 10).map((r) => String(r.status)) },
      recommended_action: 'Map unexpected status to the closest valid status or flag for manual review.',
      status: 'Open',
    });
  } else {
    stages.push(stage('Check invalid status values', 'pass', 'All status values are recognized.'));
  }

  // --- Stage 11: Suspicious outliers (flag only, not errors) ---
  const amounts = rows.map((r) => r.amount).filter((a): a is number => typeof a === 'number' && a !== null && a > 0);
  const outliers = detectOutliers(rows, amounts);
  if (outliers.length > 0) {
    stages.push(stage('Identify suspicious outliers', 'warn', `${outliers.length} rows have unusually high amounts (statistical outliers, not confirmed errors).`));
    incidents.push({
      incident_id: 'INC-OUTLIER',
      issue_type: 'Statistical Outlier',
      severity: 'Low',
      description: `${outliers.length} rows have amounts more than 3 standard deviations above the mean. These are statistical anomalies and are not automatically treated as errors.`,
      affected_rows: outliers.length,
      affected_row_ids: outliers.map((r) => String(r.order_id ?? '')).filter(Boolean).slice(0, 200),
      evidence: {
        mean: mean(amounts).toFixed(2),
        std: std(amounts).toFixed(2),
        outlier_threshold: (mean(amounts) + 3 * std(amounts)).toFixed(2),
        sample_outliers: outliers.slice(0, 10).map((r) => ({ order_id: r.order_id, amount: r.amount })),
      },
      recommended_action: 'Inspect these rows manually. Outliers may be legitimate bulk orders or data-entry errors.',
      status: 'Open',
    });
  } else {
    stages.push(stage('Identify suspicious outliers', 'pass', 'No statistical outliers detected.'));
  }

  // --- Stage 12 & 13 handled above via incidents/corrections ---
  stages.push(stage('Generate incident report', 'pass', `${incidents.length} incident(s) generated.`));
  stages.push(stage('Propose safe corrections', corrections.length > 0 ? 'warn' : 'pass', `${corrections.length} correction(s) proposed for review.`));

  // --- Quality score ---
  const qualityScore = computeQualityScore(dataset.rowCount, incidents);

  // --- Build "cleaned" rows (apply only approved corrections; here none approved yet) ---
  const cleanedRows = applyCorrections(dataset.rows, corrections.filter((c) => c.approved));

  const summary = `Pipeline completed with ${incidents.length} incident(s) and ${corrections.length} proposed correction(s). Data quality score: ${qualityScore.overall}/100.`;

  return {
    datasetId: dataset.id,
    runAt: Date.now(),
    stages,
    incidents,
    corrections,
    qualityScore,
    cleanedRows,
    summary,
  };
}

// ---------------------------------------------------------------------------
// Outlier detection: mean + 3*std (documented statistical method)
// ---------------------------------------------------------------------------
function detectOutliers(rows: Record<string, string | number | null>[], amounts: number[]) {
  const m = mean(amounts);
  const s = std(amounts);
  const threshold = m + 3 * s;
  return rows.filter((r) => r.amount !== null && Number(r.amount) > threshold);
}

function mean(a: number[]): number {
  if (a.length === 0) return 0;
  return a.reduce((s, x) => s + x, 0) / a.length;
}

function std(a: number[]): number {
  if (a.length < 2) return 0;
  const m = mean(a);
  return Math.sqrt(a.reduce((s, x) => s + (x - m) ** 2, 0) / a.length);
}

// ---------------------------------------------------------------------------
// Transparent quality score
// ---------------------------------------------------------------------------
function computeQualityScore(totalRows: number, incidents: Incident[]): QualityScore {
  if (totalRows === 0) {
    return {
      overall: 0,
      components: [{ name: 'No data', score: 0, weight: 1, detail: 'Dataset is empty.' }],
    };
  }

  const affectedByType = (type: string) =>
    incidents.filter((i) => i.issue_type === type).reduce((s, i) => s + i.affected_rows, 0);

  const completeness = scoreComponent(totalRows - affectedRowsFromIncidents(incidents, ['Missing Required Field']), totalRows);
  const validity = scoreComponent(totalRows - affectedRowsFromIncidents(incidents, ['Invalid Quantity', 'Invalid Amount', 'Invalid Date', 'Invalid Status', 'Invalid Data Types']), totalRows);
  const uniqueness = scoreComponent(totalRows - affectedRowsFromIncidents(incidents, ['Duplicate Order IDs']), totalRows);
  const schema = incidents.some((i) => i.issue_type === 'Schema Mismatch') ? 0 : 100;

  const components = [
    { name: 'Schema', score: schema, weight: 0.2, detail: schema === 100 ? 'All required columns present.' : 'Missing required columns.' },
    { name: 'Completeness', score: completeness.score, weight: 0.25, detail: completeness.detail },
    { name: 'Validity', score: validity.score, weight: 0.3, detail: validity.detail },
    { name: 'Uniqueness', score: uniqueness.score, weight: 0.2, detail: uniqueness.detail },
    { name: 'Outliers', score: 100 - Math.min(100, (affectedByType('Statistical Outlier') / totalRows) * 100 * 5), weight: 0.05, detail: 'Statistical outliers flagged (not auto-corrected).' },
  ];

  const overall = Math.round(components.reduce((s, c) => s + c.score * c.weight, 0));
  return { overall, components };
}

function affectedRowsFromIncidents(incidents: Incident[], types: string[]): number {
  return incidents.filter((i) => types.includes(i.issue_type)).reduce((s, i) => s + i.affected_rows, 0);
}

function scoreComponent(remaining: number, total: number): { score: number; detail: string } {
  const ratio = total === 0 ? 0 : remaining / total;
  const score = Math.round(ratio * 100);
  return { score, detail: `${remaining}/${total} rows passed (${score}%).` };
}

// ---------------------------------------------------------------------------
// Apply approved corrections to produce cleaned rows
// ---------------------------------------------------------------------------
export function applyCorrections(
  rows: Record<string, string | number | null>[],
  approved: Correction[],
): Record<string, string | number | null>[] {
  const byRowId = new Map<string, Correction[]>();
  for (const c of approved) {
    if (c.field === '__row__') continue; // row removal handled separately
    const list = byRowId.get(c.row_id) || [];
    list.push(c);
    byRowId.set(c.row_id, list);
  }
  const removeIds = new Set(approved.filter((c) => c.field === '__row__').map((c) => c.row_id));

  return rows
    .filter((r) => {
      const id = String(r.order_id ?? '');
      return !removeIds.has(id);
    })
    .map((r) => {
      const id = String(r.order_id ?? '');
      const cs = byRowId.get(id);
      if (!cs) return { ...r };
      const copy = { ...r };
      for (const c of cs) {
        (copy as Record<string, unknown>)[c.field] = c.proposed_value;
      }
      return copy;
    });
}

export function revalidate(rows: Record<string, string | number | null>[]): { issues: number; detail: string } {
  const records = toOrderRecords(rows);
  let issues = 0;
  const ids = new Set<string>();
  for (const r of records) {
    if (r.quantity !== null && (r.quantity as number) <= 0) issues++;
    if (r.amount !== null && (r.amount as number) <= 0) issues++;
    const d = String(r.order_date ?? '');
    if (d && (!/^\d{4}-\d{2}-\d{2}$/.test(d) || isNaN(Date.parse(d)))) issues++;
    const id = String(r.order_id ?? '');
    if (id) {
      if (ids.has(id)) issues++;
      else ids.add(id);
    }
  }
  return { issues, detail: issues === 0 ? 'No remaining issues detected.' : `${issues} issue(s) still present.` };
}

function dedupe(arr: string[]): string[] {
  return [...new Set(arr)];
}

export { VALID_STATUSES };
