// ============================================================================
// Page: AI Incident Investigator
// ============================================================================
import { useMemo, useState } from 'react';
import { Bot, Search, FlaskConical, Lightbulb, Wrench, FileSearch, Sparkles } from 'lucide-react';
import { useApp } from '@/lib/store';
import { Card, CardHeader, Badge, EmptyState, Button, SeverityBadge, StatusBadge } from '@/components/ui';
import { investigateIncident, getActiveProviderName } from '@/lib/aiInvestigator';
import type { Incident, IncidentStatus } from '@/lib/types';

const STATUSES: IncidentStatus[] = ['Open', 'Reviewed', 'Resolved', 'Ignored'];

export function InvestigatorPage() {
  const { activeDataset, pipelineResult, setIncidentStatus } = useApp();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [severityFilter, setSeverityFilter] = useState<string>('all');
  const [typeFilter, setTypeFilter] = useState<string>('all');

  const filteredIncidents = useMemo(() => {
    if (!pipelineResult) return [];
    return pipelineResult.incidents.filter((i) => {
      if (severityFilter !== 'all' && i.severity !== severityFilter) return false;
      if (typeFilter !== 'all' && i.issue_type !== typeFilter) return false;
      return true;
    });
  }, [pipelineResult, severityFilter, typeFilter]);

  const selectedIncident = pipelineResult?.incidents.find((i) => i.incident_id === selectedId) || null;

  const investigation = useMemo(() => {
    if (!selectedIncident || !activeDataset) return null;
    return investigateIncident(selectedIncident, activeDataset);
  }, [selectedIncident, activeDataset]);

  const issueTypes = pipelineResult ? [...new Set(pipelineResult.incidents.map((i) => i.issue_type))] : [];

  if (!activeDataset) {
    return <EmptyState icon={<Bot className="w-12 h-12" />} title="No dataset selected" message="Load a dataset and run the pipeline to investigate incidents." />;
  }

  if (!pipelineResult || pipelineResult.incidents.length === 0) {
    return (
      <EmptyState
        icon={<Bot className="w-12 h-12" />}
        title="No incidents to investigate"
        message={pipelineResult ? "The pipeline found no data-quality issues. Try the corrupted sample dataset to see incidents." : "Run the data-quality pipeline first to generate incidents."}
      />
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-gray-900">AI Incident Investigator</h2>
          <p className="text-sm text-gray-500">Evidence-grounded explanations for each data-quality incident.</p>
        </div>
        <Badge color="teal">Provider: {getActiveProviderName()}</Badge>
      </div>

      {/* Info banner */}
      <div className="flex items-start gap-3 bg-blue-50 border border-blue-200 rounded-lg p-4">
        <Sparkles className="w-5 h-5 text-blue-500 flex-shrink-0 mt-0.5" />
        <div>
          <p className="text-sm text-blue-800 font-medium">How this works</p>
          <p className="text-xs text-blue-700 mt-1">
            Each explanation is generated from the incident's structured evidence and relevant dataset metrics. Facts are distinguished from hypotheses.
            The current provider is a rules-based engine (offline). A real LLM provider (e.g., Gemma via Ollama) can be plugged in via the AI provider interface — no API keys are exposed in the browser.
          </p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-4 flex-wrap">
        <div className="flex items-center gap-2">
          <Search className="w-4 h-4 text-gray-400" />
          <span className="text-sm font-medium text-gray-600">Filter:</span>
        </div>
        <select className="border border-gray-200 rounded-lg px-2 py-1 text-sm" value={severityFilter} onChange={(e) => setSeverityFilter(e.target.value)}>
          <option value="all">All severities</option>
          <option value="Critical">Critical</option>
          <option value="High">High</option>
          <option value="Medium">Medium</option>
          <option value="Low">Low</option>
        </select>
        <select className="border border-gray-200 rounded-lg px-2 py-1 text-sm" value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)}>
          <option value="all">All types</option>
          {issueTypes.map((t) => <option key={t} value={t}>{t}</option>)}
        </select>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Incident list */}
        <Card className="lg:col-span-1">
          <CardHeader title="Incidents" subtitle={`${filteredIncidents.length} matching`} />
          <div className="divide-y divide-gray-100 max-h-[600px] overflow-y-auto">
            {filteredIncidents.map((inc) => (
              <button
                key={inc.incident_id}
                onClick={() => setSelectedId(inc.incident_id)}
                className={`w-full text-left px-4 py-3 hover:bg-gray-50 ${selectedId === inc.incident_id ? 'bg-blue-50 border-l-2 border-l-blue-500' : ''}`}
              >
                <div className="flex items-center justify-between mb-1">
                  <p className="text-sm font-medium text-gray-800">{inc.issue_type}</p>
                  <SeverityBadge severity={inc.severity} />
                </div>
                <p className="text-xs text-gray-500 truncate">{inc.description}</p>
                <div className="flex items-center gap-1 mt-1">
                  <Badge color="gray">{inc.affected_rows} rows</Badge>
                  <StatusBadge status={inc.status} />
                </div>
              </button>
            ))}
          </div>
        </Card>

        {/* Investigation detail */}
        <div className="lg:col-span-2">
          {selectedIncident && investigation ? (
            <div className="space-y-4">
              {/* Incident header */}
              <Card>
                <div className="p-5">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-base font-semibold text-gray-900">{selectedIncident.issue_type}</h3>
                    <div className="flex items-center gap-2">
                      <SeverityBadge severity={selectedIncident.severity} />
                      <select
                        className="border border-gray-200 rounded-lg px-2 py-1 text-xs"
                        value={selectedIncident.status}
                        onChange={(e) => setIncidentStatus(selectedIncident.incident_id, e.target.value as IncidentStatus)}
                      >
                        {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
                      </select>
                    </div>
                  </div>
                  <p className="text-sm text-gray-600">{selectedIncident.description}</p>
                  <div className="mt-3 flex gap-2">
                    <Badge color="gray">{selectedIncident.affected_rows} rows affected</Badge>
                    <Badge color="gray">{selectedIncident.affected_row_ids.length} row IDs recorded</Badge>
                  </div>
                </div>
              </Card>

              {/* Investigation result */}
              <Card>
                <CardHeader title="AI Investigation" subtitle={`Generated by: ${investigation.provider}`} action={investigation.isFallback ? <Badge color="yellow">Fallback</Badge> : <Badge color="green">Live AI</Badge>} />
                <div className="p-5 space-y-5">
                  {/* Summary */}
                  <div>
                    <h4 className="text-sm font-semibold text-gray-700 mb-1">Summary</h4>
                    <p className="text-sm text-gray-600">{investigation.summary}</p>
                  </div>

                  {/* Established facts */}
                  <div>
                    <h4 className="text-sm font-semibold text-gray-700 mb-2 flex items-center gap-1.5">
                      <FileSearch className="w-4 h-4 text-blue-500" /> Established Facts
                    </h4>
                    <ul className="space-y-1.5">
                      {investigation.established_facts.map((f, i) => (
                        <li key={i} className="text-sm text-gray-600 flex items-start gap-2">
                          <span className="text-blue-400 mt-0.5">•</span> {f}
                        </li>
                      ))}
                    </ul>
                  </div>

                  {/* Hypotheses */}
                  <div>
                    <h4 className="text-sm font-semibold text-gray-700 mb-2 flex items-center gap-1.5">
                      <FlaskConical className="w-4 h-4 text-amber-500" /> Hypotheses (not confirmed)
                    </h4>
                    <ul className="space-y-1.5">
                      {investigation.hypotheses.map((h, i) => (
                        <li key={i} className="text-sm text-gray-600 flex items-start gap-2">
                          <span className="text-amber-400 mt-0.5">•</span> {h}
                        </li>
                      ))}
                    </ul>
                  </div>

                  {/* Investigation steps */}
                  <div>
                    <h4 className="text-sm font-semibold text-gray-700 mb-2 flex items-center gap-1.5">
                      <Search className="w-4 h-4 text-teal-500" /> Recommended Investigation Steps
                    </h4>
                    <ol className="space-y-1.5">
                      {investigation.investigation_steps.map((s, i) => (
                        <li key={i} className="text-sm text-gray-600 flex items-start gap-2">
                          <span className="text-teal-500 font-medium mt-0.5">{i + 1}.</span> {s}
                        </li>
                      ))}
                    </ol>
                  </div>

                  {/* Corrective actions */}
                  <div>
                    <h4 className="text-sm font-semibold text-gray-700 mb-2 flex items-center gap-1.5">
                      <Wrench className="w-4 h-4 text-green-500" /> Corrective Actions
                    </h4>
                    <ul className="space-y-1.5">
                      {investigation.corrective_actions.map((a, i) => (
                        <li key={i} className="text-sm text-gray-600 flex items-start gap-2">
                          <span className="text-green-400 mt-0.5">•</span> {a}
                        </li>
                      ))}
                    </ul>
                  </div>

                  {/* Business impact */}
                  <div>
                    <h4 className="text-sm font-semibold text-gray-700 mb-2 flex items-center gap-1.5">
                      <Lightbulb className="w-4 h-4 text-yellow-500" /> Potential Business Impact
                    </h4>
                    <p className="text-sm text-gray-600">{investigation.business_impact}</p>
                  </div>

                  {/* Citations */}
                  <div>
                    <h4 className="text-sm font-semibold text-gray-700 mb-2">Citations & Evidence Sources</h4>
                    <div className="bg-gray-50 rounded-lg p-3 space-y-1">
                      {investigation.citations.map((c, i) => (
                        <p key={i} className="text-xs text-gray-500 font-mono">{c}</p>
                      ))}
                    </div>
                  </div>
                </div>
              </Card>
            </div>
          ) : (
            <Card>
              <EmptyState icon={<Bot className="w-10 h-10" />} title="Select an incident" message="Choose an incident from the list to see the AI-generated investigation." />
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
