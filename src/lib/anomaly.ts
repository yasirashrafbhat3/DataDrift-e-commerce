// ============================================================================
// Anomaly Detection & Forecasting
//
// Anomaly detection: IQR-based + z-score method on daily order volume and revenue.
// Forecasting: 7-day moving average + linear trend extrapolation (documented, simple).
// Evaluation: chronological split, MAPE when a test period is available.
// ============================================================================
import type { Dataset } from './types';
import { toOrderRecords } from './csv';

export interface DailyPoint {
  date: string;
  orders: number;
  revenue: number;
}

export interface AnomalyPoint {
  date: string;
  orders: number;
  revenue: number;
  type: 'orders' | 'revenue';
  direction: 'high' | 'low';
  baseline: number;
  reason: string;
}

export interface AnomalyResult {
  daily: DailyPoint[];
  anomalies: AnomalyPoint[];
  method: string;
}

export interface ForecastPoint {
  date: string;
  forecast: number;
  type: 'orders' | 'revenue';
}

export interface ForecastResult {
  historical: { date: string; actual: number }[];
  forecast: ForecastPoint[];
  mape: number | null;
  method: string;
  note: string;
}

/** Build daily aggregation of orders + revenue. */
export function buildDailySeries(dataset: Dataset): DailyPoint[] {
  const rows = toOrderRecords(dataset.rows);
  const map = new Map<string, DailyPoint>();
  for (const r of rows) {
    const d = String(r.order_date ?? '');
    if (!d || !/^\d{4}-\d{2}-\d{2}$/.test(d)) continue;
    const entry = map.get(d) || { date: d, orders: 0, revenue: 0 };
    entry.orders += 1;
    if (r.amount !== null && (r.amount as number) > 0) entry.revenue += r.amount as number;
    map.set(d, entry);
  }
  return [...map.values()].sort((a, b) => a.date.localeCompare(b.date));
}

/** Detect anomalies in daily orders/revenue using IQR + z-score. */
export function detectAnomalies(dataset: Dataset): AnomalyResult {
  const daily = buildDailySeries(dataset);
  if (daily.length < 4) {
    return { daily, anomalies: [], method: 'IQR + z-score (insufficient data)' };
  }

  const anomalies: AnomalyPoint[] = [];
  const orderVals = daily.map((d) => d.orders);
  const revenueVals = daily.map((d) => d.revenue);

  detectIqr(daily, orderVals, 'orders', anomalies);
  detectIqr(daily, revenueVals, 'revenue', anomalies);

  return { daily, anomalies, method: 'IQR (1.5×IQR rule) + z-score (|z|>2.5)' };
}

function detectIqr(daily: DailyPoint[], vals: number[], type: 'orders' | 'revenue', out: AnomalyPoint[]) {
  const sorted = [...vals].sort((a, b) => a - b);
  const q1 = sorted[Math.floor(sorted.length * 0.25)];
  const q3 = sorted[Math.floor(sorted.length * 0.75)];
  const iqr = q3 - q1;
  const lower = q1 - 1.5 * iqr;
  const upper = q3 + 1.5 * iqr;

  const m = mean(vals);
  const s = std(vals);

  for (let i = 0; i < daily.length; i++) {
    const v = vals[i];
    const z = s > 0 ? Math.abs((v - m) / s) : 0;
    if (v < lower && z > 2.5) {
      out.push({
        date: daily[i].date,
        orders: daily[i].orders,
        revenue: daily[i].revenue,
        type,
        direction: 'low',
        baseline: +m.toFixed(2),
        reason: `${type} value (${v.toFixed(2)}) is below the IQR lower bound (${lower.toFixed(2)}) with z-score ${z.toFixed(2)}.`,
      });
    } else if (v > upper && z > 2.5) {
      out.push({
        date: daily[i].date,
        orders: daily[i].orders,
        revenue: daily[i].revenue,
        type,
        direction: 'high',
        baseline: +m.toFixed(2),
        reason: `${type} value (${v.toFixed(2)}) exceeds the IQR upper bound (${upper.toFixed(2)}) with z-score ${z.toFixed(2)}.`,
      });
    }
  }
}

/**
 * Forecast: 7-day moving average + linear trend, extrapolated forward.
 * Chronological 80/20 split for MAPE evaluation.
 */
export function forecastSeries(dataset: Dataset, type: 'orders' | 'revenue', horizon = 14): ForecastResult {
  const daily = buildDailySeries(dataset);

  if (daily.length < 14) {
    return {
      historical: [],
      forecast: [],
      mape: null,
      method: '7-day moving average + linear trend',
      note: 'Insufficient historical data (need at least 14 days). Load a dataset with more history to enable forecasting.',
    };
  }

  const series = daily.map((d) => ({ date: d.date, actual: d[type] }));

  // 80/20 chronological split
  const splitIdx = Math.floor(series.length * 0.8);
  const train = series.slice(0, splitIdx);
  const test = series.slice(splitIdx);

  // Linear regression on train
  const { slope, intercept } = linearRegression(train.map((p, i) => [i, p.actual]));

  // 7-day moving average of last training point
  const maWindow = 7;
  const ma = movingAverage(train.map((p) => p.actual), maWindow);

  // Evaluate: forecast test period using trend, compute MAPE
  let mape: number | null = null;
  if (test.length > 0) {
    const errors: number[] = [];
    for (let i = 0; i < test.length; i++) {
      const idx = train.length + i;
      const predicted = slope * idx + intercept;
      const actual = test[i].actual;
      if (actual !== 0) errors.push(Math.abs((actual - predicted) / actual));
    }
    if (errors.length > 0) mape = +((errors.reduce((s, e) => s + e, 0) / errors.length) * 100).toFixed(2);
  }

  // Forecast horizon days forward from last date
  const lastDate = new Date(series[series.length - 1].date);
  const lastIdx = series.length;
  const forecast: ForecastPoint[] = [];
  for (let i = 1; i <= horizon; i++) {
    const d = new Date(lastDate.getTime() + i * 86400000);
    const idx = lastIdx + i;
    const trendVal = Math.max(0, slope * idx + intercept);
    forecast.push({
      date: d.toISOString().slice(0, 10),
      forecast: +trendVal.toFixed(2),
      type,
    });
  }

  return {
    historical: series,
    forecast,
    mape,
    method: '7-day moving average + linear trend (80/20 chronological split)',
    note: forecast.length > 0 ? `Forecast is an estimate based on historical trend. MAPE on test period: ${mape !== null ? mape + '%' : 'N/A'}.` : 'No forecast produced.',
  };
}

function linearRegression(points: [number, number][]): { slope: number; intercept: number } {
  const n = points.length;
  if (n === 0) return { slope: 0, intercept: 0 };
  const sumX = points.reduce((s, p) => s + p[0], 0);
  const sumY = points.reduce((s, p) => s + p[1], 0);
  const sumXY = points.reduce((s, p) => s + p[0] * p[1], 0);
  const sumX2 = points.reduce((s, p) => s + p[0] * p[0], 0);
  const denom = n * sumX2 - sumX * sumX;
  const slope = denom === 0 ? 0 : (n * sumXY - sumX * sumY) / denom;
  const intercept = (sumY - slope * sumX) / n;
  return { slope, intercept };
}

function movingAverage(vals: number[], window: number): number[] {
  const out: number[] = [];
  for (let i = 0; i < vals.length; i++) {
    const start = Math.max(0, i - window + 1);
    const slice = vals.slice(start, i + 1);
    out.push(slice.reduce((s, v) => s + v, 0) / slice.length);
  }
  return out;
}

function mean(a: number[]): number {
  return a.length ? a.reduce((s, x) => s + x, 0) / a.length : 0;
}
function std(a: number[]): number {
  if (a.length < 2) return 0;
  const m = mean(a);
  return Math.sqrt(a.reduce((s, x) => s + (x - m) ** 2, 0) / a.length);
}
