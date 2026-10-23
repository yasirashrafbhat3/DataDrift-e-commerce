// ============================================================================
// Page: About Project
// ============================================================================
import { Info, Users } from 'lucide-react';
import { Card, CardHeader, Badge } from '@/components/ui';

const TEAM = [
  { name: 'Yasir Ashraf Bhat', role: 'Data Engineering Lead', duties: 'Data loading, schema validation, cleaning pipeline, incident generation, data quality tests' },
  { name: 'Amaan Ashraf Bhat', role: 'AI/ML Lead', duties: 'AI provider integration, evidence-grounded explanations, model evaluation, AI error handling' },
  { name: 'Gouthami PM', role: 'Data Analysis & Data Science Lead', duties: 'Business analytics, forecasting & anomaly detection, metrics and evaluation' },
  { name: 'Sostika Yadav', role: 'Frontend & Integration Lead', duties: 'Frontend, dashboard & charts, integration, exports & documentation' },
];

const FEATURES = [
  'Overview dashboard with real, data-derived metrics',
  'CSV upload + bundled synthetic sample datasets (clean & corrupted)',
  '15-stage data-quality pipeline with incident generation',
  'Transparent, rule-based data-quality score',
  'Incident browser with severity/type filters and status tracking',
  'Business analytics with date/category/status filters',
  'Anomaly detection (IQR + z-score) and trend-based forecasting',
  'AI Incident Investigator with evidence-grounded explanations',
  'CSV/JSON exports for cleaned data, incidents, and summaries',
];

const STACK = [
  { label: 'Frontend', value: 'React + TypeScript + Tailwind CSS' },
  { label: 'Charts', value: 'Recharts' },
  { label: 'Icons', value: 'Lucide React' },
  { label: 'CSV', value: 'PapaParse' },
  { label: 'Testing', value: 'Vitest' },
  { label: 'Build', value: 'Vite' },
];

export function AboutPage() {
  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <h2 className="text-lg font-bold text-gray-900">About DataDrift</h2>
        <p className="text-sm text-gray-500 mt-1">AI-Powered E-commerce Data Intelligence Platform</p>
      </div>

      <Card>
        <div className="p-6">
          <div className="flex items-start gap-3 mb-4">
            <Info className="w-6 h-6 text-blue-500 flex-shrink-0 mt-0.5" />
            <div>
              <h3 className="text-sm font-semibold text-gray-800">Project Overview</h3>
              <p className="text-sm text-gray-600 mt-1">
                DataDrift helps e-commerce businesses identify data-quality problems, understand business performance,
                detect unusual patterns, and receive evidence-based explanations and recommendations. All metrics are
                computed from actual loaded data — no hardcoded numbers. Sample data is synthetic and clearly labelled.
              </p>
            </div>
          </div>
        </div>
      </Card>

      <Card>
        <CardHeader title="Key Features" />
        <div className="p-6">
          <ul className="space-y-2">
            {FEATURES.map((f) => (
              <li key={f} className="text-sm text-gray-600 flex items-start gap-2">
                <span className="text-green-500 mt-0.5">✓</span> {f}
              </li>
            ))}
          </ul>
        </div>
      </Card>

      <Card>
        <CardHeader title="Technology Stack" />
        <div className="p-6 grid grid-cols-1 sm:grid-cols-2 gap-3">
          {STACK.map((s) => (
            <div key={s.label} className="flex items-center gap-2 text-sm">
              <Badge color="blue">{s.label}</Badge>
              <span className="text-gray-600">{s.value}</span>
            </div>
          ))}
        </div>
      </Card>

      <Card>
        <CardHeader title="Architecture" subtitle="Modular design for team collaboration" />
        <div className="p-6 space-y-3 text-sm text-gray-600">
          <p><strong className="text-gray-800">Data layer</strong> (<code className="text-xs bg-gray-100 px-1 rounded">src/lib</code>): types, CSV parsing, sample data generation, the quality pipeline, analytics, anomaly detection/forecasting, AI investigator, exports, and the React context store. Each module exposes clear interfaces so the team can work independently.</p>
          <p><strong className="text-gray-800">UI layer</strong> (<code className="text-xs bg-gray-100 px-1 rounded">src/components</code>, <code className="text-xs bg-gray-100 px-1 rounded">src/pages</code>): shared UI primitives, the layout shell, and 8 page components. Pages consume the store via the <code className="text-xs bg-gray-100 px-1 rounded">useApp</code> hook.</p>
          <p><strong className="text-gray-800">AI integration</strong>: the <code className="text-xs bg-gray-100 px-1 rounded">AIProvider</code> interface in <code className="text-xs bg-gray-100 px-1 rounded">aiInvestigator.ts</code> allows plugging in a real LLM (e.g. Gemma via Ollama) later. The default provider is a rules-based engine — no API keys are exposed in the browser.</p>
        </div>
      </Card>

      <Card>
        <CardHeader title="Team" />
        <div className="p-6 grid grid-cols-1 sm:grid-cols-2 gap-4">
          {TEAM.map((m) => (
            <div key={m.name} className="border border-gray-200 rounded-lg p-4">
              <div className="flex items-center gap-2 mb-1">
                <Users className="w-4 h-4 text-gray-400" />
                <h4 className="text-sm font-semibold text-gray-800">{m.name}</h4>
              </div>
              <Badge color="teal">{m.role}</Badge>
              <p className="text-xs text-gray-500 mt-2">{m.duties}</p>
            </div>
          ))}
        </div>
      </Card>

      <Card>
        <CardHeader title="Data Disclaimer" />
        <div className="p-6">
          <p className="text-sm text-gray-600">
            All sample datasets are <strong>synthetic</strong> — generated with a fixed random seed for reproducibility.
            They are not real customer data and are not associated with any real e-commerce platform. The project does
            not claim access to any company's internal systems or confidential data.
          </p>
        </div>
      </Card>
    </div>
  );
}
