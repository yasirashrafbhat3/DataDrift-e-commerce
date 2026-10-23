// ============================================================================
// CSV parsing + column-type inference using PapaParse
// ============================================================================
import Papa from 'papaparse';
import type { ColumnInfo, ColumnType } from './types';

export interface ParsedCsv {
  rows: Record<string, string | number | null>[];
  columns: ColumnInfo[];
  rowCount: number;
}

const REQUIRED_COLUMNS = [
  'order_id',
  'customer_id',
  'product_id',
  'product_category',
  'quantity',
  'amount',
  'order_date',
  'status',
];

export { REQUIRED_COLUMNS };

export function parseCsv(text: string): ParsedCsv {
  const result = Papa.parse<Record<string, string>>(text, {
    header: true,
    skipEmptyLines: true,
    dynamicTyping: false,
  });

  const rows = (result.data || []).map((r) => {
    const clean: Record<string, string | number | null> = {};
    for (const [k, v] of Object.entries(r)) {
      clean[k] = v === undefined ? '' : v;
    }
    return clean;
  });

  const fieldNames = result.meta.fields || [];
  const columns = fieldNames.map((name) => inferColumn(name, rows));
  return { rows, columns, rowCount: rows.length };
}

function inferColumn(name: string, rows: Record<string, string | number | null>[]): ColumnInfo {
  const values = rows.map((r) => r[name]).filter((v) => v !== '' && v !== null && v !== undefined);
  const missing = rows.length - values.length;
  const type = inferType(values);
  return { name, type, missing, sample: String(values[0] ?? '') };
}

function inferType(values: (string | number | null)[]): ColumnType {
  if (values.length === 0) return 'unknown';
  let allInt = true;
  let allFloat = true;
  let allDate = true;
  for (const v of values) {
    const s = String(v);
    if (!/^-?\d+$/.test(s)) allInt = false;
    if (!/^-?\d*\.?\d+$/.test(s)) allFloat = false;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) allDate = false;
  }
  if (allDate) return 'date';
  if (allInt) return 'integer';
  if (allFloat) return 'float';
  return 'string';
}

/** Convert raw string rows into typed order records (best-effort). */
export function toOrderRecords(
  rows: Record<string, string | number | null>[],
): Record<string, string | number | null>[] {
  return rows.map((r) => ({
    order_id: String(r.order_id ?? ''),
    customer_id: String(r.customer_id ?? ''),
    product_id: String(r.product_id ?? ''),
    product_category: String(r.product_category ?? ''),
    quantity: r.quantity === '' || r.quantity == null ? null : Number(r.quantity),
    amount: r.amount === '' || r.amount == null ? null : Number(r.amount),
    order_date: String(r.order_date ?? ''),
    status: String(r.status ?? ''),
  }));
}

/** Serialize rows to CSV text (PapaParse unparse). */
export function toCsv(rows: Record<string, string | number | null>[]): string {
  if (rows.length === 0) return '';
  const fields = Object.keys(rows[0]);
  return Papa.unparse({ fields, data: rows });
}
