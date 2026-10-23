// -----------------------------------------------------------------------------
// classify.js - decides, for one workflow rule, WHO provides it in Data Center
// and WHAT it should become in Jira Cloud / Forge.
//
// Every rule in a DC workflow XML is identified by a Java class name, e.g.
//   com.onresolve.jira.groovy.GroovyValidator   (ScriptRunner)
//   com.atlassian.jira.workflow.function.issue.UpdateIssueStatusFunction (Jira itself)
// The package prefix tells us the vendor, which tells us whether we must rebuild it.
// -----------------------------------------------------------------------------

/**
 * Known vendors, matched by class-name prefix. Order matters: first match wins.
 * `custom: true` means the rule does NOT migrate on its own and needs a Forge rebuild
 * (or the vendor's Cloud app).
 */
const VENDORS = [
  { prefix: 'com.onresolve.', vendor: 'ScriptRunner', custom: true },
  { prefix: 'com.adaptavist.', vendor: 'ScriptRunner', custom: true },
  { prefix: 'com.innovalog.', vendor: 'JMWE', custom: true },
  { prefix: 'com.googlecode.jsu.', vendor: 'JSU', custom: true },
  { prefix: 'com.fca.jira.plugins.workflowToolbox.', vendor: 'Workflow Toolbox', custom: true },
  { prefix: 'com.atlassian.jira.', vendor: 'Jira (built-in)', custom: false },
  { prefix: 'com.atlassian.servicedesk.', vendor: 'Jira Service Management (built-in)', custom: false },
  { prefix: 'com.opensymphony.', vendor: 'Jira (built-in)', custom: false },
];

/** Forge module that replaces each rule type in Jira Cloud. */
const FORGE_MODULE = {
  condition: 'jira:workflowCondition (Jira expression)',
  validator: 'jira:workflowValidator',
  'post-function': 'jira:workflowPostFunction',
};

/**
 * Classifies a single rule.
 * @param {string} ruleType  'condition' | 'validator' | 'post-function'
 * @param {string} className Java class name from the XML (may be empty)
 * @returns {{ vendor: string, custom: boolean, forgeModule: string }}
 */
export function classifyRule(ruleType, className) {
  const name = className || '';
  const match = VENDORS.find((v) => name.startsWith(v.prefix));

  // Anything we do not recognise is treated as custom: safer to review it than miss it.
  const vendor = match ? match.vendor : 'Unknown / in-house plugin';
  const custom = match ? match.custom : true;

  return {
    vendor,
    custom,
    // Built-in Jira rules exist natively in Cloud and migrate with JCMA - nothing to build.
    forgeModule: custom ? FORGE_MODULE[ruleType] ?? 'review manually' : 'native in Cloud (no build)',
  };
}

/** Shortens a fully-qualified class name to its last segment for readable reports. */
export function shortClassName(className) {
  if (!className) return '';
  const parts = className.split('.');
  return parts[parts.length - 1];
}
