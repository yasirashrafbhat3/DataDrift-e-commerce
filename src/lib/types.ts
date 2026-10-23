// ============================================================================
// Core domain types for DataDrift
// ============================================================================

/** A single e-commerce order record (schema enforced by the pipeline). */
export interface OrderRecord {
  order_id: string;
  customer_id: string;
  product_id: string;
  product_category: string;
  quantity: number | null;
  amount: number | null;
  order_date: string; // ISO yyyy-mm-dd
  status: string;
}

/** Inferred type for a column. */
export type ColumnType = 'string' | 'integer' | 'float' | 'date' | 'unknown';

export interface ColumnInfo {
  name: string;
  type: ColumnType;
  missing: number;
  sample: string;
}

/** A dataset held in memory — raw rows plus metadata. */
export interface Dataset {
  id: string;
  name: string;
  isSample: boolean;
  isCorrupted: boolean;
  rows: Record<string, string | number | null>[]; // raw rows from CSV
  columns: ColumnInfo[];
  rowCount: number;
  createdAt: number;
  source?: 'upload' | 'sample';
}

/** Severity levels used across incidents. */
export type Severity = 'Critical' | 'High' | 'Medium' | 'Low';

export type IncidentStatus = 'Open' | 'Reviewed' | 'Resolved' | 'Ignored';

/** A data-quality incident produced by the pipeline. */
export interface Incident {
  incident_id: string;
  issue_type: string;
  severity: Severity;
  description: string;
  affected_rows: number;
  affected_row_ids: string[]; // order_id values, when available
  evidence: Record<string, unknown>;
  recommended_action: string;
  status: IncidentStatus;
}

/** A proposed correction for a specific row + field. */
export interface Correction {
  row_id: string; // order_id of the affected row
  field: string;
  current_value: string | number | null;
  proposed_value: string | number | null;
  reason: string;
  incident_id: string;
  approved: boolean;
}

/** Result of running the quality pipeline. */
export interface PipelineResult {
  datasetId: string;
  runAt: number;
  stages: PipelineStage[];
  incidents: Incident[];
  corrections: Correction[];
  qualityScore: QualityScore;
  cleanedRows: Record<string, string | number | null>[];
  summary: string;
}

export interface PipelineStage {
  name: string;
  status: 'pass' | 'warn' | 'fail';
  detail: string;
}

/** Transparent, rule-based quality score (0–100). */
export interface QualityScore {
  overall: number;
  components: {
    name: string;
    score: number; // 0–100
    weight: number; // 0–1
    detail: string;
  }[];
}

export type PageId =
  | 'dashboard'
  | 'upload'
  | 'pipeline'
  | 'analytics'
  | 'anomaly'
  | 'investigator'
  | 'exports'
  | 'about';
