// -----------------------------------------------------------------------------
// report.js - flattens parsed workflows into inventory rows and renders them as
// CSV (for Excel / Google Sheets) and Markdown (for the migration plan / PRs).
// -----------------------------------------------------------------------------
import { shortClassName } from './classify.js';

const SCRIPT_PREVIEW_LENGTH = 120;

/**
 * Picks the most useful argument to show reviewers: a script if there is one,
 * otherwise a compact "key=value" list of the rule's settings.
 */
export function summariseArgs(args) {
  const scriptKey = Object.keys(args).find((k) => /script|condition|expression/i.test(k) && args[k]);
  const text = scriptKey
    ? args[scriptKey]
    : Object.entries(args).map(([k, v]) => `${k}=${v}`).join('; ');
  const oneLine = text.replace(/\s+/g, ' ').trim();
  return oneLine.length > SCRIPT_PREVIEW_LENGTH ? `${oneLine.slice(0, SCRIPT_PREVIEW_LENGTH)}…` : oneLine;
}

/**
 * One row per rule (a transition with no rules still gets one row, so every
 * transition appears in the inventory).
 * @param {object[]} workflows   results of parseWorkflowXml
 * @param {{ includeBuiltIn?: boolean }} options  built-in Jira rules are hidden by default
 */
export function toInventoryRows(workflows, { includeBuiltIn = false } = {}) {
  const rows = [];
  for (const wf of workflows) {
    for (const t of wf.transitions) {
      const base = {
        workflow: wf.workflow,
        transition: t.name,
        from: t.from.join(' | '),
        to: t.to,
        scope: t.scope,
      };
      const rules = t.rules.filter((r) => includeBuiltIn || r.custom);
      if (rules.length === 0) {
        rows.push({ ...base, ruleType: '', vendor: '', rule: '', details: '', forgeModule: '', status: 'no custom rules' });
        continue;
      }
      for (const r of rules) {
        rows.push({
          ...base,
          ruleType: r.type,
          vendor: r.vendor,
          rule: shortClassName(r.className),
          details: summariseArgs(r.args),
          forgeModule: r.forgeModule,
          status: r.custom ? 'to do' : 'native',
        });
      }
    }
  }
  return rows;
}

export const COLUMNS = [
  ['workflow', 'Workflow'], ['transition', 'Transition'], ['from', 'From'], ['to', 'To'],
  ['scope', 'Scope'], ['ruleType', 'Rule type'], ['vendor', 'Vendor'], ['rule', 'DC rule'],
  ['details', 'Details / script'], ['forgeModule', 'Forge target'], ['status', 'Status'],
];

/** RFC 4180 CSV: quote every field and double any embedded quotes. */
export function toCsv(rows) {
  const escape = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
  const header = COLUMNS.map(([, label]) => escape(label)).join(',');
  const body = rows.map((row) => COLUMNS.map(([key]) => escape(row[key])).join(','));
  return [header, ...body].join('\r\n') + '\r\n';
}

/** Markdown: a summary table per workflow, then the detailed rule table. */
export function toMarkdown(workflows, rows) {
  const cell = (v) => String(v ?? '').replace(/\|/g, '\\|');
  const lines = ['# Workflow migration inventory', ''];

  lines.push('## Summary', '', '| Workflow | Transitions | Custom rules | Vendors |', '|---|---|---|---|');
  for (const wf of workflows) {
    const custom = wf.transitions.flatMap((t) => t.rules).filter((r) => r.custom);
    const vendors = [...new Set(custom.map((r) => r.vendor))].join(', ') || '—';
    lines.push(`| ${cell(wf.workflow)} | ${wf.transitions.length} | ${custom.length} | ${cell(vendors)} |`);
  }

  lines.push('', '## Rules', '', `| ${COLUMNS.map(([, l]) => l).join(' | ')} |`, `|${COLUMNS.map(() => '---').join('|')}|`);
  for (const row of rows) lines.push(`| ${COLUMNS.map(([k]) => cell(row[k])).join(' | ')} |`);

  return lines.join('\n') + '\n';
}
