// ============================================================================
// Page: Anomaly Detection & Forecasting
// ============================================================================
import { useMemo, useState } from 'react';
import { LineChart as LineChartIcon, AlertTriangle, TrendingUp, Info } from 'lucide-react';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  ReferenceDot, Legend, ComposedChart,
} from 'recharts';
import { useApp } from '@/lib/store';
import { Card, CardHeader, Badge, EmptyState, Button } from '@/components/ui';
import { detectAnomalies, forecastSeries, buildDailySeries } from '@/lib/anomaly';

type ForecastType = 'orders' | 'revenue';

export function AnomalyPage() {
  const { activeDataset, runPipelineNow } = useApp();
  const [forecastType, setForecastType] = useState<ForecastType>('orders');
  const [horizon, setHorizon] = useState(14);

  const anomalyResult = useMemo(() => {
    if (!activeDataset) return null;
    return detectAnomalies(activeDataset);
  }, [activeDataset]);

  const forecastResult = useMemo(() => {
    if (!activeDataset) return null;
    return forecastSeries(activeDataset, forecastType, horizon);
  }, [activeDataset, forecastType, horizon]);

  // Combined chart data for forecast
  const forecastChartData = useMemo(() => {
    if (!forecastResult || forecastResult.historical.length === 0) return [];
    const hist = forecastResult.historical.map((p) => ({ date: p.date, actual: p.actual, forecast: null as number | null }));
    const fc = forecastResult.forecast.map((p) => ({ date: p.date, actual: null as number | null, forecast: p.forecast }));
    return [...hist, ...fc];
  }, [forecastResult]);

  if (!activeDataset) {
    return <EmptyState icon={<LineChartIcon className="w-12 h-12" />} title="No dataset selected" message="Load or upload a dataset to run anomaly detection and forecasting." />;
  }

  if (!anomalyResult) {
    return <EmptyState icon={<LineChartIcon className="w-12 h-12" />} title="Run the pipeline first" message="Anomaly detection requires a processed dataset." action={<Button onClick={runPipelineNow}>Run Pipeline</Button>} />;
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-bold text-gray-900">Anomaly Detection & Forecasting</h2>
        <p className="text-sm text-gray-500">Statistical anomaly detection and trend-based forecasting on daily data.</p>
      </div>

      {/* Anomaly detection */}
      <Card>
        <CardHeader title="Daily Anomaly Detection" subtitle={`Method: ${anomalyResult.method}`} />
        {anomalyResult.daily.length < 4 ? (
          <div className="p-6">
            <div className="flex items-start gap-3 bg-yellow-50 border border-yellow-200 rounded-lg p-4">
              <Info className="w-5 h-5 text-yellow-500 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-yellow-700">Insufficient daily data points (need at least 4). Load a dataset with more date variety to enable anomaly detection.</p>
            </div>
          </div>
        ) : (
          <>
            <div className="p-4">
              <ResponsiveContainer width="100%" height={320}>
                <ComposedChart data={anomalyResult.daily}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                  <YAxis yAxisId="left" tick={{ fontSize: 11 }} />
                  <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 11 }} />
                  <Tooltip />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  <Line yAxisId="left" type="monotone" dataKey="orders" stroke="#3b82f6" strokeWidth={2} dot={false} name="Orders" />
                  <Line yAxisId="right" type="monotone" dataKey="revenue" stroke="#14b8a6" strokeWidth={2} dot={false} name="Revenue" />
                  {anomalyResult.anomalies.map((a, i) => (
                    <ReferenceDot
                      key={i}
                      x={a.date}
                      y={a.type === 'orders' ? a.orders : a.revenue}
                      yAxisId={a.type === 'orders' ? 'left' : 'right'}
                      r={6}
                      fill={a.direction === 'high' ? '#ef4444' : '#f59e0b'}
                      stroke="#fff"
                      strokeWidth={2}
                    />
                  ))}
                </ComposedChart>
              </ResponsiveContainer>
            </div>
            <div className="border-t border-gray-100">
              <div className="px-6 py-3 bg-gray-50">
                <p className="text-sm font-medium text-gray-700">Detected Anomalies ({anomalyResult.anomalies.length})</p>
                <p className="text-xs text-gray-500">Red dots = unusually high, amber dots = unusually low. These are statistical anomalies, not confirmed data errors.</p>
              </div>
              <div className="divide-y divide-gray-100 max-h-64 overflow-y-auto">
                {anomalyResult.anomalies.length === 0 ? (
                  <p className="text-sm text-gray-400 py-6 text-center">No anomalies detected — daily values fall within expected ranges.</p>
                ) : (
                  anomalyResult.anomalies.map((a, i) => (
                    <div key={i} className="px-6 py-3">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm font-medium text-gray-800">{a.date}</p>
                          <p className="text-xs text-gray-500">{a.reason}</p>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge color={a.direction === 'high' ? 'red' : 'yellow'}>
                            {a.direction === 'high' ? 'High' : 'Low'} {a.type}
                          </Badge>
                          <Badge color="gray">baseline: {a.baseline}</Badge>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </>
        )}
      </Card>

      {/* Forecasting */}
      <Card>
        <CardHeader
          title="Forecasting"
          subtitle={forecastResult?.method || '7-day moving average + linear trend'}
          action={
            <div className="flex items-center gap-2">
              <select className="border border-gray-200 rounded-lg px-2 py-1 text-sm" value={forecastType} onChange={(e) => setForecastType(e.target.value as ForecastType)}>
                <option value="orders">Forecast Orders</option>
                <option value="revenue">Forecast Revenue</option>
              </select>
              <select className="border border-gray-200 rounded-lg px-2 py-1 text-sm" value={horizon} onChange={(e) => setHorizon(Number(e.target.value))}>
                <option value={7}>7 days</option>
                <option value={14}>14 days</option>
                <option value={30}>30 days</option>
              </select>
            </div>
          }
        />
        {forecastResult && forecastResult.historical.length === 0 ? (
          <div className="p-6">
            <div className="flex items-start gap-3 bg-yellow-50 border border-yellow-200 rounded-lg p-4">
              <Info className="w-5 h-5 text-yellow-500 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm text-yellow-700">{forecastResult.note}</p>
                <p className="text-xs text-yellow-600 mt-1">Sample demonstration: load the clean sample dataset (270 days of history) to see a real forecast.</p>
              </div>
            </div>
          </div>
        ) : forecastResult ? (
          <>
            <div className="p-4">
              <ResponsiveContainer width="100%" height={320}>
                <LineChart data={forecastChartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip formatter={(v) => (forecastType === 'revenue' ? `${Number(v).toFixed(2)}` : Number(v).toFixed(0))} />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  <Line type="monotone" dataKey="actual" stroke="#3b82f6" strokeWidth={2} dot={false} name="Actual" connectNulls={false} />
                  <Line type="monotone" dataKey="forecast" stroke="#f59e0b" strokeWidth={2} strokeDasharray="5 5" dot={false} name="Forecast (estimate)" connectNulls={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
            <div className="px-6 py-3 border-t border-gray-100 bg-gray-50 flex items-center gap-4 flex-wrap">
              <div className="flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-gray-400" />
                <span className="text-xs text-gray-600">Forecast: {forecastResult.forecast.length} days ahead</span>
              </div>
              {forecastResult.mape !== null && (
                <Badge color="teal">MAPE: {forecastResult.mape}% (test-set error)</Badge>
              )}
              <Badge color="yellow">Estimates — not guarantees</Badge>
            </div>
          </>
        ) : null}
      </Card>

      {/* Daily series table */}
      {anomalyResult && anomalyResult.daily.length > 0 && (
        <Card>
          <CardHeader title="Daily Aggregation" subtitle={`${anomalyResult.daily.length} days with valid dates`} />
          <div className="overflow-x-auto max-h-80 overflow-y-auto">
            <table className="w-full text-xs">
              <thead className="bg-gray-50 border-b border-gray-200 sticky top-0">
                <tr>
                  <th className="px-4 py-2 text-left font-medium text-gray-600">Date</th>
                  <th className="px-4 py-2 text-right font-medium text-gray-600">Orders</th>
                  <th className="px-4 py-2 text-right font-medium text-gray-600">Revenue</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {anomalyResult.daily.map((d) => {
                  const isAnomaly = anomalyResult.anomalies.some((a) => a.date === d.date);
                  return (
                    <tr key={d.date} className={isAnomaly ? 'bg-red-50' : 'hover:bg-gray-50'}>
                      <td className="px-4 py-2 text-gray-800">{d.date} {isAnomaly && <AlertTriangle className="w-3 h-3 text-red-500 inline ml-1" />}</td>
                      <td className="px-4 py-2 text-right text-gray-700">{d.orders}</td>
                      <td className="px-4 py-2 text-right text-gray-700">${d.revenue.toFixed(2)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  );
}
