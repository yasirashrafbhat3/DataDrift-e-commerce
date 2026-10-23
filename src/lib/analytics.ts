// ============================================================================
// Business Analytics — all computed from actual dataset rows
// ============================================================================
import type { Dataset } from './types';
import { toOrderRecords } from './csv';

export interface OverviewMetrics {
  totalOrders: number;
  totalRevenue: number;
  avgOrderValue: number;
  totalUnitsSold: number;
  duplicates: number;
  missingRequired: number;
  invalidRecords: number;
}

export interface TimeSeriesPoint {
  date: string;
  revenue: number;
  orders: number;
}

export interface CategoryPerf {
  category: string;
  revenue: number;
  orders: number;
  units: number;
}

export interface StatusDist {
  status: string;
  count: number;
  revenue: number;
}

export interface AnalyticsResult {
  metrics: OverviewMetrics;
  revenueTrend: TimeSeriesPoint[];
  categoryPerformance: CategoryPerf[];
  statusDistribution: StatusDist[];
  topProducts: { product_id: string; revenue: number; orders: number }[];
  returnsAnalysis: { returnedRevenue: number; returnedOrders: number; cancelledRevenue: number; cancelledOrders: number };
  hasDateData: boolean;
  hasProductData: boolean;
}

export function computeAnalytics(dataset: Dataset): AnalyticsResult {
  const rows = toOrderRecords(dataset.rows);

  const totalOrders = rows.length;

  const validRevenueRows = rows.filter((r) => r.amount !== null && (r.amount as number) > 0);
  const totalRevenue = validRevenueRows.reduce((s, r) => s + (r.amount as number), 0);
  const avgOrderValue = validRevenueRows.length > 0 ? totalRevenue / validRevenueRows.length : 0;

  const totalUnitsSold = rows
    .filter((r) => r.quantity !== null && (r.quantity as number) > 0)
    .reduce((s, r) => s + (r.quantity as number), 0);

  // Duplicates
  const idCounts = new Map<string, number>();
  for (const r of rows) {
    const id = String(r.order_id ?? '');
    if (id) idCounts.set(id, (idCounts.get(id) || 0) + 1);
  }
  const duplicates = [...idCounts.values()].filter((c) => c > 1).reduce((s, c) => s + c, 0);

  // Missing required
  const requiredFields = ['order_id', 'customer_id', 'product_category', 'order_date', 'status'];
  let missingRequired = 0;
  for (const r of rows) {
    for (const f of requiredFields) {
      if (r[f] === '' || r[f] === null || r[f] === undefined) {
        missingRequired++;
        break;
      }
    }
  }

  // Invalid records (qty <= 0, amount <= 0, bad date)
  const invalidRecords = rows.filter((r) => {
    if (r.quantity !== null && (r.quantity as number) <= 0) return true;
    if (r.amount !== null && (r.amount as number) <= 0) return true;
    const d = String(r.order_date ?? '');
    if (d && (!/^\d{4}-\d{2}-\d{2}$/.test(d) || isNaN(Date.parse(d)))) return true;
    return false;
  }).length;

  // Revenue trend by day
  const hasDateData = rows.some((r) => {
    const d = String(r.order_date ?? '');
    return d && /^\d{4}-\d{2}-\d{2}$/.test(d);
  });

  const trendMap = new Map<string, { revenue: number; orders: number }>();
  for (const r of rows) {
    const d = String(r.order_date ?? '');
    if (!d || !/^\d{4}-\d{2}-\d{2}$/.test(d)) continue;
    const key = d;
    const entry = trendMap.get(key) || { revenue: 0, orders: 0 };
    if (r.amount !== null && (r.amount as number) > 0) entry.revenue += r.amount as number;
    entry.orders += 1;
    trendMap.set(key, entry);
  }
  const revenueTrend = [...trendMap.entries()]
    .map(([date, v]) => ({ date, ...v }))
    .sort((a, b) => a.date.localeCompare(b.date));

  // Category performance
  const catMap = new Map<string, { revenue: number; orders: number; units: number }>();
  for (const r of rows) {
    const cat = String(r.product_category ?? '');
    if (!cat) continue;
    const entry = catMap.get(cat) || { revenue: 0, orders: 0, units: 0 };
    if (r.amount !== null && (r.amount as number) > 0) entry.revenue += r.amount as number;
    if (r.quantity !== null && (r.quantity as number) > 0) entry.units += r.quantity as number;
    entry.orders += 1;
    catMap.set(cat, entry);
  }
  const categoryPerformance = [...catMap.entries()]
    .map(([category, v]) => ({ category, ...v }))
    .sort((a, b) => b.revenue - a.revenue);

  // Status distribution
  const statusMap = new Map<string, { count: number; revenue: number }>();
  for (const r of rows) {
    const st = String(r.status ?? 'Unknown');
    const entry = statusMap.get(st) || { count: 0, revenue: 0 };
    entry.count += 1;
    if (r.amount !== null && (r.amount as number) > 0) entry.revenue += r.amount as number;
    statusMap.set(st, entry);
  }
  const statusDistribution = [...statusMap.entries()]
    .map(([status, v]) => ({ status, ...v }))
    .sort((a, b) => b.count - a.count);

  // Top products
  const hasProductData = rows.some((r) => String(r.product_id ?? '').trim() !== '');
  const prodMap = new Map<string, { revenue: number; orders: number }>();
  for (const r of rows) {
    const pid = String(r.product_id ?? '');
    if (!pid) continue;
    const entry = prodMap.get(pid) || { revenue: 0, orders: 0 };
    if (r.amount !== null && (r.amount as number) > 0) entry.revenue += r.amount as number;
    entry.orders += 1;
    prodMap.set(pid, entry);
  }
  const topProducts = [...prodMap.entries()]
    .map(([product_id, v]) => ({ product_id, ...v }))
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, 10);

  // Returns / cancellations
  const returnedRows = rows.filter((r) => String(r.status ?? '') === 'Returned');
  const cancelledRows = rows.filter((r) => String(r.status ?? '') === 'Cancelled');
  const returnsAnalysis = {
    returnedRevenue: returnedRows.filter((r) => r.amount !== null && (r.amount as number) > 0).reduce((s, r) => s + (r.amount as number), 0),
    returnedOrders: returnedRows.length,
    cancelledRevenue: cancelledRows.filter((r) => r.amount !== null && (r.amount as number) > 0).reduce((s, r) => s + (r.amount as number), 0),
    cancelledOrders: cancelledRows.length,
  };

  return {
    metrics: { totalOrders, totalRevenue, avgOrderValue, totalUnitsSold, duplicates, missingRequired, invalidRecords },
    revenueTrend,
    categoryPerformance,
    statusDistribution,
    topProducts,
    returnsAnalysis,
    hasDateData,
    hasProductData,
  };
}
