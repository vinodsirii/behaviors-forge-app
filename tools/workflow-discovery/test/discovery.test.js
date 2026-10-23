import { readFileSync } from 'node:fs';
import { classifyRule, shortClassName } from '../src/classify.js';
import { parseWorkflowXml } from '../src/parse.js';
import { toInventoryRows, toCsv, toMarkdown, summariseArgs } from '../src/report.js';

const xml = readFileSync(new URL('./fixtures/Sample Approval Workflow.xml', import.meta.url), 'utf8');
const wf = parseWorkflowXml(xml, 'Sample Approval Workflow');
const byName = (name) => wf.transitions.find((t) => t.name === name);

describe('classifyRule', () => {
  test.each([
    ['com.onresolve.jira.groovy.GroovyValidator', 'ScriptRunner', true],
    ['com.innovalog.jmwe.plugins.functions.SetFieldValueFunction', 'JMWE', true],
    ['com.googlecode.jsu.workflow.condition.ValueFieldCondition', 'JSU', true],
    ['com.atlassian.jira.workflow.condition.AllowOnlyAssigneeCondition', 'Jira (built-in)', false],
    ['com.acme.jira.Custom', 'Unknown / in-house plugin', true],
    ['', 'Unknown / in-house plugin', true],
  ])('%s -> %s', (className, vendor, custom) => {
    expect(classifyRule('validator', className)).toMatchObject({ vendor, custom });
  });

  test('maps custom rules to the matching Forge module', () => {
    expect(classifyRule('condition', 'com.onresolve.X').forgeModule).toBe('jira:workflowCondition (Jira expression)');
    expect(classifyRule('validator', 'com.onresolve.X').forgeModule).toBe('jira:workflowValidator');
    expect(classifyRule('post-function', 'com.onresolve.X').forgeModule).toBe('jira:workflowPostFunction');
  });

  test('built-in rules need no build', () => {
    expect(classifyRule('post-function', 'com.atlassian.jira.X').forgeModule).toBe('native in Cloud (no build)');
  });

  test('shortClassName', () => {
    expect(shortClassName('com.a.b.GroovyValidator')).toBe('GroovyValidator');
    expect(shortClassName('')).toBe('');
  });
});

describe('parseWorkflowXml', () => {
  test('reads steps', () => {
    expect(wf.steps).toEqual([
      { id: '1', name: 'To Do' }, { id: '3', name: 'In Progress' }, { id: '6', name: 'Done' },
    ]);
  });

  test('finds initial, global, common and step transitions', () => {
    expect(wf.transitions.map((t) => [t.name, t.scope])).toEqual([
      ['Create', 'initial'], ['Reopen', 'global'], ['Done', 'common'], ['Start Progress', 'step'],
    ]);
  });

  test('resolves from/to status names, including common action references', () => {
    expect(byName('Start Progress')).toMatchObject({ from: ['To Do'], to: 'In Progress' });
    expect(byName('Done')).toMatchObject({ from: ['To Do', 'In Progress'], to: 'Done' });
    expect(byName('Reopen')).toMatchObject({ from: ['(any status)'], to: 'To Do' });
    expect(byName('Create')).toMatchObject({ from: ['(create)'], to: 'To Do' });
  });

  test('flattens nested AND/OR conditions', () => {
    const conditions = byName('Start Progress').rules.filter((r) => r.type === 'condition');
    expect(conditions.map((c) => c.vendor)).toEqual(['JSU', 'Jira (built-in)', 'ScriptRunner']);
  });

  test('keeps CDATA scripts and removes class.name from args', () => {
    const validator = byName('Start Progress').rules.find((r) => r.type === 'validator');
    expect(validator.className).toBe('com.onresolve.jira.groovy.GroovyValidator');
    expect(validator.args.FIELD_CONDITION).toBe('issue.summary?.trim()?.length() >= 10');
    expect(validator.args).not.toHaveProperty('class.name');
  });

  test('collects post functions from results', () => {
    const post = byName('Done').rules.filter((r) => r.type === 'post-function');
    expect(post.map((p) => p.vendor)).toEqual(['Jira (built-in)', 'JMWE']);
  });

  test('rejects files that are not workflows', () => {
    expect(() => parseWorkflowXml('<project/>', 'bad')).toThrow('not a Jira workflow export');
  });
});

describe('report', () => {
  test('hides built-in rules by default but keeps every transition', () => {
    const rows = toInventoryRows([wf]);
    expect(rows.find((r) => r.transition === 'Create')).toMatchObject({ status: 'no custom rules', ruleType: '' });
    expect(rows.filter((r) => r.vendor === 'Jira (built-in)')).toHaveLength(0);
    // Start Progress: JSU + ScriptRunner conditions, ScriptRunner validator, ScriptRunner post function
    expect(rows.filter((r) => r.transition === 'Start Progress')).toHaveLength(4);
  });

  test('--all includes built-in rules as native', () => {
    const rows = toInventoryRows([wf], { includeBuiltIn: true });
    expect(rows.find((r) => r.rule === 'PermissionValidator')).toMatchObject({ status: 'native' });
  });

  test('summariseArgs prefers scripts and collapses whitespace', () => {
    expect(summariseArgs({ FIELD_INLINE_SCRIPT: '  a\n   b  ' })).toBe('a b');
    expect(summariseArgs({ field: 'resolution', value: 'Done' })).toBe('field=resolution; value=Done');
    expect(summariseArgs({ FIELD_INLINE_SCRIPT: 'x'.repeat(200) })).toHaveLength(121);
  });

  test('CSV quotes fields and escapes embedded quotes', () => {
    const csv = toCsv(toInventoryRows([wf]));
    expect(csv.startsWith('"Workflow","Transition"')).toBe(true);
    expect(csv).toContain('""quotes""');
    expect(csv.endsWith('\r\n')).toBe(true);
  });

  test('Markdown escapes pipes and includes a summary', () => {
    const md = toMarkdown([wf], toInventoryRows([wf]));
    expect(md).toContain('| Sample Approval Workflow | 4 | 6 | Unknown / in-house plugin, JMWE, JSU, ScriptRunner |');
    expect(md).toContain('\\| pipes');
  });
});
