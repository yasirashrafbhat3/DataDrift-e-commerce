// ============================================================================
// Page: Business Analytics
// ============================================================================
import { useMemo, useState } from 'react';
import { BarChart3, Filter, TrendingUp, Package, RotateCcw } from 'lucide-react';
import {
  AreaChart, Area, BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, PieChart, Pie, Cell, Legend,
} from 'recharts';
import { useApp } from '@/lib/store';
import { Card, CardHeader, Badge, EmptyState, Button, MetricCard } from '@/components/ui';

const PIE_COLORS = ['#3b82f6', '#14b8a6', '#f59e0b', '#ef4444', '#8b5cf6', '#10b981', '#ec4899', '#6366f1'];

type DateGranularity = 'day' | 'week' | 'month';

export function AnalyticsPage() {
  const { activeDataset, analytics, runPipelineNow } = useApp();
  const [granularity, setGranularity] = useState<DateGranularity>('day');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');

  const filteredAnalytics = useMemo(() => {
    if (!analytics || !activeDataset) return null;
    // Filtering is applied on the trend + category views in the render layer
    return analytics;
  }, [analytics, activeDataset]);

  const filteredTrend = useMemo(() => {
    if (!filteredAnalytics) return [];
    let data = filteredAnalytics.revenueTrend;
    // apply category/status filter — need raw rows for that, but trend is pre-aggregated
    // So we re-aggregate from raw if filters are active
    if (categoryFilter !== 'all' || statusFilter !== 'all') {
      const map = new Map<string, { date: string; revenue: number; orders: number }>();
      for (const r of activeDataset!.rows) {
        const d = String(r.order_date ?? '');
        if (!d || !/^\d{4}-\d{2}-\d{2}$/.test(d)) continue;
        if (categoryFilter !== 'all' && String(r.product_category ?? '') !== categoryFilter) continue;
        if (statusFilter !== 'all' && String(r.status ?? '') !== statusFilter) continue;
        const entry = map.get(d) || { date: d, revenue: 0, orders: 0 };
        if (r.amount !== null && (r.amount as number) > 0) entry.revenue += r.amount as number;
        entry.orders += 1;
        map.set(d, entry);
      }
      data = [...map.values()].sort((a, b) => a.date.localeCompare(b.date));
    }

    if (granularity === 'week') {
      return groupBy(data, (p) => {
        const date = new Date(p.date);
        const day = date.getDay();
        const monday = new Date(date.getTime() - day * 86400000);
        return monday.toISOString().slice(0, 10);
      });
    }
    if (granularity === 'month') {
      return groupBy(data, (p) => p.date.slice(0, 7));
    }
    return data;
  }, [filteredAnalytics, granularity, categoryFilter, statusFilter, activeDataset]);

  if (!activeDataset) {
    return <EmptyState icon={<BarChart3 className="w-12 h-12" />} title="No dataset selected" message="Load or upload a dataset to view business analytics." />;
  }

  if (!analytics) {
    return <EmptyState icon={<BarChart3 className="w-12 h-12" />} title="Run the pipeline first" message="Analytics are computed during the pipeline run." action={<Button onClick={runPipelineNow}>Run Pipeline</Button>} />;
  }

  const categories = activeDataset.columns.find((c) => c.name === 'product_category')
    ? [...new Set(activeDataset.rows.map((r) => String(r.product_category ?? '')).filter(Boolean))]
    : [];
  const statuses = [...new Set(activeDataset.rows.map((r) => String(r.status ?? '')).filter(Boolean))];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-lg font-bold text-gray-900">Business Analytics</h2>
          <p className="text-sm text-gray-500">All metrics computed from the active dataset's actual rows.</p>
        </div>
      </div>

      {/* Filters */}
      <Card className="p-4">
        <div className="flex items-center gap-4 flex-wrap">
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-gray-400" />
            <span className="text-sm font-medium text-gray-600">Filters:</span>
          </div>
          <label className="flex items-center gap-1.5 text-sm">
            <span className="text-gray-500">Granularity</span>
            <select className="border border-gray-200 rounded-lg px-2 py-1 text-sm" value={granularity} onChange={(e) => setGranularity(e.target.value as DateGranularity)}>
              <option value="day">Daily</option>
              <option value="week">Weekly</option>
              <option value="month">Monthly</option>
            </select>
          </label>
          {categories.length > 0 && (
            <label className="flex items-center gap-1.5 text-sm">
              <span className="text-gray-500">Category</span>
              <select className="border border-gray-200 rounded-lg px-2 py-1 text-sm" value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)}>
                <option value="all">All</option>
                {categories.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </label>
          )}
          {statuses.length > 0 && (
            <label className="flex items-center gap-1.5 text-sm">
              <span className="text-gray-500">Status</span>
              <select className="border border-gray-200 rounded-lg px-2 py-1 text-sm" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
                <option value="all">All</option>
                {statuses.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </label>
          )}
        </div>
      </Card>

      {/* Top metrics */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <MetricCard label="Revenue (filtered)" value={`$${filteredTrend.reduce((s, p) => s + p.revenue, 0).toFixed(0)}`} icon={<TrendingUp className="w-5 h-5" />} />
        <MetricCard label="Orders (filtered)" value={filteredTrend.reduce((s, p) => s + p.orders, 0).toLocaleString()} icon={<BarChart3 className="w-5 h-5" />} />
        <MetricCard label="Avg Order Value" value={`$${analytics.metrics.avgOrderValue.toFixed(2)}`} icon={<TrendingUp className="w-5 h-5" />} />
        <MetricCard label="Units Sold" value={analytics.metrics.totalUnitsSold.toLocaleString()} icon={<Package className="w-5 h-5" />} />
      </div>

      {/* Revenue + Orders trend */}
      {analytics.hasDateData ? (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card>
            <CardHeader title="Revenue Trend" subtitle={`By ${granularity}`} />
            <div className="p-4">
              <ResponsiveContainer width="100%" height={300}>
                <AreaChart data={filteredTrend}>
                  <defs>
                    <linearGradient id="revGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip formatter={(v) => `$${Number(v).toFixed(2)}`} />
                  <Area type="monotone" dataKey="revenue" stroke="#3b82f6" strokeWidth={2} fill="url(#revGrad)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </Card>

          <Card>
            <CardHeader title="Order Volume Trend" subtitle={`By ${granularity}`} />
            <div className="p-4">
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={filteredTrend}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip />
                  <Bar dataKey="orders" fill="#14b8a6" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Card>
        </div>
      ) : (
        <Card className="p-6">
          <p className="text-sm text-gray-500">Date-based analyses are unavailable — the order_date column is missing or invalid in this dataset.</p>
        </Card>
      )}

      {/* Category + Status */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader title="Category Performance" subtitle="Revenue and order count by category" />
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-600">Category</th>
                  <th className="px-4 py-2 text-right text-xs font-medium text-gray-600">Revenue</th>
                  <th className="px-4 py-2 text-right text-xs font-medium text-gray-600">Orders</th>
                  <th className="px-4 py-2 text-right text-xs font-medium text-gray-600">Units</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {analytics.categoryPerformance.map((c) => (
                  <tr key={c.category} className="hover:bg-gray-50">
                    <td className="px-4 py-2 text-gray-800">{c.category}</td>
                    <td className="px-4 py-2 text-right text-gray-700">${c.revenue.toFixed(2)}</td>
                    <td className="px-4 py-2 text-right text-gray-700">{c.orders}</td>
                    <td className="px-4 py-2 text-right text-gray-700">{c.units}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>

        <Card>
          <CardHeader title="Order Status Distribution" />
          <div className="p-4">
            <ResponsiveContainer width="100%" height={260}>
              <PieChart>
                <Pie data={analytics.statusDistribution.map((s) => ({ name: s.status, value: s.count }))} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={90} label>
                  {analytics.statusDistribution.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                </Pie>
                <Tooltip />
                <Legend wrapperStyle={{ fontSize: 12 }} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </Card>
      </div>

      {/* Top products */}
      {analytics.hasProductData && (
        <Card>
          <CardHeader title="Top Products" subtitle="By revenue" />
          <div className="p-4">
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={analytics.topProducts} layout="vertical" margin={{ left: 60 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis type="number" tick={{ fontSize: 11 }} />
                <YAxis dataKey="product_id" type="category" tick={{ fontSize: 10 }} width={60} />
                <Tooltip formatter={(v) => `${Number(v).toFixed(2)}`} />
                <Bar dataKey="revenue" fill="#3b82f6" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>
      )}

      {/* Returns / cancellations */}
      {(analytics.returnsAnalysis.returnedOrders > 0 || analytics.returnsAnalysis.cancelledOrders > 0) && (
        <Card>
          <CardHeader title="Returns & Cancellations Analysis" subtitle="When corresponding data exists" />
          <div className="p-4 grid grid-cols-2 md:grid-cols-4 gap-4">
            <MetricCard label="Returned Orders" value={analytics.returnsAnalysis.returnedOrders} icon={<RotateCcw className="w-5 h-5" />} />
            <MetricCard label="Returned Revenue" value={`$${analytics.returnsAnalysis.returnedRevenue.toFixed(2)}`} tone="red" />
            <MetricCard label="Cancelled Orders" value={analytics.returnsAnalysis.cancelledOrders} icon={<RotateCcw className="w-5 h-5" />} />
            <MetricCard label="Cancelled Revenue" value={`$${analytics.returnsAnalysis.cancelledRevenue.toFixed(2)}`} tone="red" />
          </div>
        </Card>
      )}
    </div>
  );
}

function groupBy(data: { date: string; revenue: number; orders: number }[], keyFn: (p: { date: string }) => string) {
  const map = new Map<string, { date: string; revenue: number; orders: number }>();
  for (const p of data) {
    const k = keyFn(p);
    const e = map.get(k) || { date: k, revenue: 0, orders: 0 };
    e.revenue += p.revenue;
    e.orders += p.orders;
    map.set(k, e);
  }
  return [...map.values()].sort((a, b) => a.date.localeCompare(b.date));
}
