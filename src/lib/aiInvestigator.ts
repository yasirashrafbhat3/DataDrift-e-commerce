// ============================================================================
// AI Incident Investigator
//
// Modular design:
//  - The AI provider interface (AIProvider) is defined here so the team can
//    plug in an LLM later (Ollama, Gemma, etc.) without touching call sites.
//  - The default provider (EvidenceBasedFallback) produces rule-based,
//    evidence-grounded explanations WITHOUT calling any external model.
//    It clearly distinguishes observed facts from hypotheses.
//  - No API keys are ever exposed in the browser.
// ============================================================================
import type { Incident, Dataset } from './types';
import { toOrderRecords } from './csv';

export interface InvestigationResult {
  incident_id: string;
  summary: string;
  established_facts: string[];
  hypotheses: string[];
  investigation_steps: string[];
  corrective_actions: string[];
  business_impact: string;
  citations: string[];
  provider: string;
  isFallback: boolean;
}

export interface AIProvider {
  name: string;
  investigate(incident: Incident, dataset: Dataset): InvestigationResult;
}

// ---------------------------------------------------------------------------
// Evidence-based fallback provider — always available, no external model.
// ---------------------------------------------------------------------------
export const EvidenceBasedFallback: AIProvider = {
  name: 'Evidence-Based Rules Engine (offline fallback)',

  investigate(incident: Incident, dataset: Dataset): InvestigationResult {
    const rows = toOrderRecords(dataset.rows);
    const ev = incident.evidence;

    const facts: string[] = [];
    const hypotheses: string[] = [];
    const steps: string[] = [];
    const actions: string[] = [];
    const citations: string[] = [];
    let summary = '';
    let impact = '';

    switch (incident.issue_type) {
      case 'Duplicate Order IDs': {
        const sampleIds = (ev.sample_ids as string[]) || [];
        facts.push(`${incident.affected_rows} rows share duplicated order_id values.`);
        facts.push(`${(ev.duplicate_ids as number) || 0} unique order IDs appear more than once.`);
        if (sampleIds.length) facts.push(`Sample duplicated IDs: ${sampleIds.join(', ')}.`);
        hypotheses.push('A batch re-upload may have inserted the same orders twice.');
        hypotheses.push('A race condition in the order ingestion system may have created duplicate commits.');
        steps.push('Compare the full row contents of each duplicate group to confirm they are true duplicates vs. legitimate re-orders with the same ID.');
        steps.push('Check ingestion logs around the affected order_id range for re-runs.');
        actions.push('Keep the first occurrence and remove subsequent duplicates after manual confirmation.');
        citations.push(`Incident evidence field: duplicate_ids, sample_ids`);
        citations.push(`Affected rows: ${incident.affected_row_ids.length} order IDs listed in incident.affected_row_ids`);
        summary = `${incident.affected_rows} rows with duplicated order IDs were detected. Duplicates can inflate order counts and revenue in downstream analytics.`;
        impact = 'If uncorrected, revenue and order counts may be overstated. The magnitude depends on the amounts in the duplicated rows.';
        break;
      }

      case 'Missing Required Field': {
        const field = String(ev.field || 'a required field');
        facts.push(`${incident.affected_rows} rows are missing a value in the "${field}" column.`);
        hypotheses.push('An upstream ETL job may have dropped the field during transformation.');
        hypotheses.push('The source system may allow nulls for this field, unlike the expected schema.');
        steps.push(`Trace the affected rows back to the source system to check whether "${field}" exists there.`);
        steps.push('Check whether the missing values cluster in a specific date range or category.');
        actions.push(`If the source has the value, re-extract and reload. Otherwise, exclude these rows from analyses that require "${field}".`);
        citations.push(`Incident evidence field: field="${field}", missing_count=${ev.missing_count}`);
        citations.push(`Affected rows: ${incident.affected_row_ids.length} order IDs`);
        summary = `${incident.affected_rows} rows are missing the required "${field}" field, which limits the reliability of related analytics.`;
        impact = field === 'amount' ? 'Revenue totals may be understated for the affected period.' : field === 'order_date' ? 'Time-series analyses will be incomplete.' : 'The impact is limited to analyses that depend on this field.';
        break;
      }

      case 'Invalid Quantity': {
        facts.push(`${incident.affected_rows} rows have quantity values of zero or less.`);
        const sampleQ = (ev.sample_quantities as number[]) || [];
        if (sampleQ.length) facts.push(`Sample invalid quantities: ${sampleQ.join(', ')}.`);
        hypotheses.push('A data-entry or parsing error may have introduced negative or zero quantities.');
        hypotheses.push('A return or adjustment may have been recorded as a negative quantity in the orders feed.');
        steps.push('Inspect each affected row alongside its status field — returned orders may legitimately show negative quantities.');
        actions.push('If the values are errors, set quantity to null. If they represent returns, consider separating returns into a dedicated field.');
        citations.push(`Incident evidence: invalid_quantities, sample_quantities`);
        summary = `${incident.affected_rows} rows contain invalid quantity values (zero or negative).`;
        impact = 'Units-sold totals may be inaccurate if these values are included in aggregations.';
        break;
      }

      case 'Invalid Amount': {
        facts.push(`${incident.affected_rows} rows have amount values of zero or less.`);
        const sampleA = (ev.sample_amounts as number[]) || [];
        if (sampleA.length) facts.push(`Sample invalid amounts: ${sampleA.join(', ')}.`);
        hypotheses.push('A pricing or discounting bug may have produced zero or negative totals.');
        hypotheses.push('A currency or unit mismatch during data transfer may have corrupted the amount.');
        steps.push('Cross-reference the affected order IDs with the billing system to verify the expected amount.');
        actions.push('Set amount to null for confirmed errors; correct to the true value if recoverable.');
        citations.push(`Incident evidence: invalid_amounts, sample_amounts`);
        summary = `${incident.affected_rows} rows contain invalid amount values (zero or negative).`;
        impact = 'Revenue calculations are directly affected — these rows should be excluded from revenue aggregations.';
        break;
      }

      case 'Invalid Date': {
        facts.push(`${incident.affected_rows} rows have malformed order_date values.`);
        const sampleD = (ev.sample_dates as string[]) || [];
        if (sampleD.length) facts.push(`Sample malformed dates: ${sampleD.join(', ')}.`);
        hypotheses.push('A date-format mismatch (e.g., DD/MM/YYYY vs YYYY-MM-DD) may have corrupted the values.');
        hypotheses.push('A text value may have been written into the date column by an upstream system.');
        steps.push('Inspect the raw source to determine the original date format.');
        actions.push('Reformat to YYYY-MM-DD where possible; set to null if unrecoverable.');
        citations.push(`Incident evidence: invalid_dates, sample_dates`);
        summary = `${incident.affected_rows} rows have unparseable order_date values, blocking time-based analysis.`;
        impact = 'Time-series and trend analyses will miss these orders unless the dates are recovered.';
        break;
      }

      case 'Invalid Status': {
        facts.push(`${incident.affected_rows} rows have status values outside the expected set.`);
        const sampleS = (ev.sample_statuses as string[]) || [];
        if (sampleS.length) facts.push(`Sample unexpected statuses: ${sampleS.join(', ')}.`);
        hypotheses.push('A new status was introduced in the source system but not yet mapped in the schema.');
        hypotheses.push('A free-text field may have been used instead of a controlled vocabulary.');
        steps.push('Review the source system status list and update the mapping.');
        actions.push('Map the unexpected value to the closest valid status, or add it to the controlled vocabulary if legitimate.');
        citations.push(`Incident evidence: invalid_statuses, sample_statuses`);
        summary = `${incident.affected_rows} rows contain unrecognized status values.`;
        impact = 'Status-based filtering and return/cancellation analysis may misclassify these orders.';
        break;
      }

      case 'Statistical Outlier': {
        facts.push(`${incident.affected_rows} rows have amounts more than 3 standard deviations above the mean.`);
        facts.push(`Mean amount: ${ev.mean}, standard deviation: ${ev.std}, threshold: ${ev.outlier_threshold}.`);
        hypotheses.push('These may be legitimate large bulk orders rather than data errors.');
        hypotheses.push('A decimal-place error (e.g., cents vs dollars) may have inflated the amount.');
        steps.push('Inspect each outlier row and confirm whether a bulk order of that size is plausible.');
        actions.push('Do NOT auto-correct. Confirm with the source; only flag as an error if the value is confirmed wrong.');
        citations.push(`Incident evidence: mean, std, outlier_threshold, sample_outliers`);
        summary = `${incident.affected_rows} rows are statistical outliers in amount. These are flagged for review, not automatically treated as errors.`;
        impact = 'These rows can disproportionately affect revenue totals and anomaly detection if included without review.';
        break;
      }

      case 'Schema Mismatch': {
        const missing = (ev.missing_columns as string[]) || [];
        facts.push(`The dataset is missing required column(s): ${missing.join(', ')}.`);
        hypotheses.push('The uploaded file may be from a different export template.');
        steps.push('Re-export the data with the required columns and re-upload.');
        actions.push('Re-upload a CSV with all required columns: order_id, customer_id, product_id, product_category, quantity, amount, order_date, status.');
        citations.push(`Incident evidence: missing_columns`);
        summary = 'The dataset schema does not match the expected e-commerce order schema.';
        impact = 'Pipeline processing cannot proceed reliably without the required columns.';
        break;
      }

      case 'Invalid Data Types': {
        facts.push(`${incident.affected_rows} rows have non-numeric values in quantity or amount.`);
        hypotheses.push('A text value or formatting artifact was written into a numeric column.');
        steps.push('Inspect the raw cell values to identify the non-numeric content.');
        actions.push('Correct or remove the non-numeric values; ensure the source exports numeric fields as numbers.');
        citations.push(`Incident evidence: bad_type_count`);
        summary = `${incident.affected_rows} rows contain non-numeric data in numeric columns.`;
        impact = 'Aggregations on these columns will fail or produce incorrect results.';
        break;
      }

      default: {
        facts.push(`Incident type "${incident.issue_type}" was detected affecting ${incident.affected_rows} rows.`);
        steps.push('Review the incident evidence and affected rows manually.');
        actions.push('Apply the recommended action from the incident record.');
        citations.push('Incident evidence object');
        summary = incident.description;
        impact = 'Impact depends on the specific issue type.';
        break;
      }
    }

    // Cross-check affected rows actually exist (only when order_id is meaningful)
    if (incident.affected_row_ids.length > 0 && incident.issue_type !== 'Schema Mismatch') {
      const idSet = new Set(incident.affected_row_ids);
      const matched = rows.filter((r) => idSet.has(String(r.order_id ?? ''))).length;
      citations.push(`Cross-check: ${matched} of ${incident.affected_row_ids.length} affected row IDs found in the current dataset (${rows.length} total rows).`);
    }

    return {
      incident_id: incident.incident_id,
      summary,
      established_facts: facts,
      hypotheses: hypotheses.map((h) => `HYPOTHESIS: ${h}`),
      investigation_steps: steps,
      corrective_actions: actions,
      business_impact: impact,
      citations,
      provider: EvidenceBasedFallback.name,
      isFallback: true,
    };
  },
};

// ---------------------------------------------------------------------------
// Provider registry — swap in a real LLM provider here when available.
// ---------------------------------------------------------------------------
let activeProvider: AIProvider = EvidenceBasedFallback;

export function setAIProvider(provider: AIProvider) {
  activeProvider = provider;
}

export function investigateIncident(incident: Incident, dataset: Dataset): InvestigationResult {
  return activeProvider.investigate(incident, dataset);
}

export function getActiveProviderName(): string {
  return activeProvider.name;
}
