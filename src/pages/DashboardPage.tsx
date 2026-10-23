// ============================================================================
// Page: Overview Dashboard
// ============================================================================
import { useMemo } from 'react';
import {
  ShoppingCart,
  DollarSign,
  TrendingUp,
  Package,
  Copy,
  AlertTriangle,
  XCircle,
  Gauge,
  Activity,
} from 'lucide-react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  Legend,
} from 'recharts';
import { useApp } from '@/lib/store';
import { Card, CardHeader, MetricCard, EmptyState, Badge, LoadingOverlay, Button, StatusBadge } from '@/components/ui';
import type { PageId } from '@/lib/types';

const PIE_COLORS = ['#3b82f6', '#14b8a6', '#f59e0b', '#ef4444', '#8b5cf6', '#10b981', '#ec4899', '#6366f1'];

export function DashboardPage({ onNavigate }: { onNavigate: (p: PageId) => void }) {
  const { activeDataset, analytics, pipelineResult, isLoading, loadSample, runPipelineNow } = useApp();

  const trendData = useMemo(() => {
    if (!analytics) return [];
    // Aggregate by month if too many points
    if (analytics.revenueTrend.length > 40) {
      const monthMap = new Map<string, { revenue: number; orders: number }>();
      for (const p of analytics.revenueTrend) {
        const key = p.date.slice(0, 7);
        const e = monthMap.get(key) || { revenue: 0, orders: 0 };
        e.revenue += p.revenue;
        e.orders += p.orders;
        monthMap.set(key, e);
      }
      return [...monthMap.entries()].map(([date, v]) => ({ date, ...v }));
    }
    return analytics.revenueTrend;
  }, [analytics]);

  if (isLoading) return <LoadingOverlay message="Processing dataset..." />;

  if (!activeDataset) {
    return (
      <EmptyState
        icon={<Gauge className="w-12 h-12" />}
        title="No dataset loaded"
        message="Load a sample e-commerce dataset or upload your own CSV to see live metrics, trends, and data-quality insights."
        action={
          <div className="flex gap-2">
            <Button onClick={() => loadSample('clean')}>Load Clean Sample</Button>
            <Button variant="secondary" onClick={() => loadSample('corrupted')}>Load Corrupted Sample</Button>
          </div>
        }
      />
    );
  }

  if (!analytics || !pipelineResult) {
    return (
      <EmptyState
        icon={<Activity className="w-12 h-12" />}
        title="Dataset loaded — run the pipeline"
        message="Run the data-quality pipeline to compute metrics, detect incidents, and generate analytics."
        action={<Button onClick={runPipelineNow}>Run Pipeline</Button>}
      />
    );
  }

  const m = analytics.metrics;
  const qs = pipelineResult.qualityScore;

  const statusData = analytics.statusDistribution.map((s) => ({ name: s.status, value: s.count }));
  const recentIncidents = pipelineResult.incidents.slice(0, 5);
  const stages = pipelineResult.stages.slice(-6);

  return (
    <div className="space-y-6">
      {/* Data source banner */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-gray-900">{activeDataset.name}</h2>
          <p className="text-sm text-gray-500">
            {activeDataset.rowCount} rows · {activeDataset.columns.length} columns
            {activeDataset.isSample && activeDataset.isCorrupted && ' · Contains intentional defects for demonstration'}
            {activeDataset.isSample && !activeDataset.isCorrupted && ' · Clean sample data'}
          </p>
        </div>
        <Button onClick={runPipelineNow} variant="secondary" size="sm">Re-run Pipeline</Button>
      </div>

      {/* Metric cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <MetricCard label="Total Orders" value={m.totalOrders.toLocaleString()} icon={<ShoppingCart className="w-5 h-5" />} />
        <MetricCard label="Total Revenue" value={`$${m.totalRevenue.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`} icon={<DollarSign className="w-5 h-5" />} />
        <MetricCard label="Avg Order Value" value={`$${m.avgOrderValue.toFixed(2)}`} icon={<TrendingUp className="w-5 h-5" />} />
        <MetricCard label="Units Sold" value={m.totalUnitsSold.toLocaleString()} icon={<Package className="w-5 h-5" />} />
      </div>

      {/* Quality metrics */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <MetricCard label="Duplicates" value={m.duplicates} icon={<Copy className="w-5 h-5" />} tone={m.duplicates > 0 ? 'red' : 'green'} />
        <MetricCard label="Missing Required" value={m.missingRequired} icon={<AlertTriangle className="w-5 h-5" />} tone={m.missingRequired > 0 ? 'yellow' : 'green'} />
        <MetricCard label="Invalid Records" value={m.invalidRecords} icon={<XCircle className="w-5 h-5" />} tone={m.invalidRecords > 0 ? 'red' : 'green'} />
        <MetricCard label="Quality Score" value={`${qs.overall}/100`} icon={<Gauge className="w-5 h-5" />} tone={qs.overall >= 80 ? 'green' : qs.overall >= 50 ? 'yellow' : 'red'} />
      </div>

      {/* Charts row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader title="Revenue Trend" subtitle={analytics.hasDateData ? 'Revenue over time' : 'No valid date data available'} />
          <div className="p-4">
            {analytics.hasDateData && trendData.length > 0 ? (
              <ResponsiveContainer width="100%" height={260}>
                <LineChart data={trendData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip formatter={(v) => `$${Number(v).toFixed(2)}`} />
                  <Line type="monotone" dataKey="revenue" stroke="#3b82f6" strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <p className="text-sm text-gray-400 py-12 text-center">Date column missing or invalid — time-based analysis unavailable.</p>
            )}
          </div>
        </Card>

        <Card>
          <CardHeader title="Category Performance" subtitle="Revenue by product category" />
          <div className="p-4">
            {analytics.categoryPerformance.length > 0 ? (
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={analytics.categoryPerformance} layout="vertical" margin={{ left: 80 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis type="number" tick={{ fontSize: 11 }} />
                  <YAxis dataKey="category" type="category" tick={{ fontSize: 11 }} width={80} />
                  <Tooltip formatter={(v) => `$${Number(v).toFixed(2)}`} />
                  <Bar dataKey="revenue" fill="#14b8a6" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <p className="text-sm text-gray-400 py-12 text-center">No category data available.</p>
            )}
          </div>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader title="Order Status Distribution" />
          <div className="p-4">
            {statusData.length > 0 ? (
              <ResponsiveContainer width="100%" height={260}>
                <PieChart>
                  <Pie data={statusData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={90} label>
                    {statusData.map((_, i) => (
                      <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <p className="text-sm text-gray-400 py-12 text-center">No status data available.</p>
            )}
          </div>
        </Card>

        <Card>
          <CardHeader title="Recent Data Incidents" subtitle={`${pipelineResult.incidents.length} total incident(s)`} action={<Button size="sm" variant="ghost" onClick={() => onNavigate('investigator')}>View all</Button>} />
          <div className="divide-y divide-gray-100">
            {recentIncidents.length > 0 ? (
              recentIncidents.map((inc) => (
                <div key={inc.incident_id} className="px-6 py-3 flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-800">{inc.issue_type}</p>
                    <p className="text-xs text-gray-500">{inc.affected_rows} row(s) affected</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge color={inc.severity === 'Critical' || inc.severity === 'High' ? 'red' : inc.severity === 'Medium' ? 'yellow' : 'blue'}>
                      {inc.severity}
                    </Badge>
                    <StatusBadge status={inc.status} />
                  </div>
                </div>
              ))
            ) : (
              <p className="text-sm text-gray-400 py-8 text-center">No incidents detected. Data quality looks good.</p>
            )}
          </div>
        </Card>
      </div>

      {/* Quality score breakdown + pipeline activity */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader title="Data Quality Score" subtitle="Transparent, rule-based breakdown" />
          <div className="p-4 space-y-3">
            <div className="flex items-center gap-3 mb-2">
              <div className={`w-16 h-16 rounded-full flex items-center justify-center text-lg font-bold ${qs.overall >= 80 ? 'bg-green-100 text-green-700' : qs.overall >= 50 ? 'bg-yellow-100 text-yellow-700' : 'bg-red-100 text-red-700'}`}>
                {qs.overall}
              </div>
              <p className="text-sm text-gray-600">Overall quality score out of 100, weighted by component.</p>
            </div>
            {qs.components.map((c) => (
              <div key={c.name}>
                <div className="flex items-center justify-between text-xs">
                  <span className="font-medium text-gray-700">{c.name} <span className="text-gray-400">({(c.weight * 100).toFixed(0)}%)</span></span>
                  <span className="text-gray-600">{c.score}/100</span>
                </div>
                <div className="h-1.5 bg-gray-100 rounded mt-1">
                  <div className={`h-full rounded ${c.score >= 80 ? 'bg-green-400' : c.score >= 50 ? 'bg-yellow-400' : 'bg-red-400'}`} style={{ width: `${c.score}%` }} />
                </div>
                <p className="text-[11px] text-gray-400 mt-0.5">{c.detail}</p>
              </div>
            ))}
          </div>
        </Card>

        <Card>
          <CardHeader title="Recent Pipeline Activity" subtitle="Latest pipeline stages" action={<Button size="sm" variant="ghost" onClick={() => onNavigate('pipeline')}>View all</Button>} />
          <div className="divide-y divide-gray-100">
            {stages.map((s, i) => (
              <div key={i} className="px-6 py-2.5 flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-800">{s.name}</p>
                  <p className="text-xs text-gray-500">{s.detail}</p>
                </div>
                <StatusBadge status={s.status} />
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}
