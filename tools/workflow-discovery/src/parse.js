// -----------------------------------------------------------------------------
// parse.js - turns ONE Jira Data Center workflow XML export into plain objects.
//
// DC workflows are OSWorkflow XML. The parts we care about:
//
//   <workflow>
//     <initial-actions>  <action ...>   the "Create" transition
//     <global-actions>   <action ...>   transitions available from ANY status
//     <common-actions>   <action ...>   shared transitions, referenced from steps
//     <steps>
//       <step id="1" name="To Do">
//         <actions>
//           <common-action id="..."/>   reference to a common action
//           <action id="11" name="Start Progress">
//             <restrict-to><conditions> <condition type="class"> ... </conditions></restrict-to>
//             <validators> <validator type="class"> ... </validators>
//             <results><unconditional-result step="3">
//               <post-functions> <function type="class"> ... </post-functions>
//
// Each <condition>/<validator>/<function> carries its settings as
//   <arg name="class.name">com.vendor.SomeClass</arg>  plus other <arg>s (e.g. scripts).
// -----------------------------------------------------------------------------
import { XMLParser } from 'fast-xml-parser';
import { classifyRule } from './classify.js';

// Tags that can repeat. Forcing them to arrays means the code never has to check
// "is this one object or a list?".
const ARRAY_TAGS = new Set([
  'action', 'common-action', 'step', 'condition', 'conditions',
  'validator', 'function', 'arg', 'meta',
]);

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: '',      // <arg name="x"> -> { name: 'x' }
  textNodeName: '#text',
  trimValues: true,
  parseTagValue: false,         // keep "001" and script text as strings
  parseAttributeValue: false,
  isArray: (tagName) => ARRAY_TAGS.has(tagName),
});

/** Normalises "missing / single / array" to an array. */
const toArray = (value) => (value === undefined || value === null ? [] : Array.isArray(value) ? value : [value]);

/**
 * Reads the <arg> children of a rule into a { name: value } object.
 * Text may be plain or CDATA (e.g. Groovy scripts); both end up in '#text'.
 */
function readArgs(node) {
  const args = {};
  for (const arg of toArray(node.arg)) {
    if (!arg || !arg.name) continue;
    args[arg.name] = typeof arg['#text'] === 'string' ? arg['#text'] : '';
  }
  return args;
}

/** Builds the rule record used everywhere else in the tool. */
function toRule(ruleType, node) {
  const args = readArgs(node);
  const className = args['class.name'] || '';
  delete args['class.name'];
  return { type: ruleType, className, args, ...classifyRule(ruleType, className) };
}

/**
 * Conditions can be nested: <conditions type="AND"><condition/><conditions type="OR">...
 * This walks the tree and returns every leaf <condition>.
 */
function collectConditions(conditionsNodes) {
  const found = [];
  for (const group of toArray(conditionsNodes)) {
    for (const condition of toArray(group.condition)) found.push(toRule('condition', condition));
    found.push(...collectConditions(group.conditions));
  }
  return found;
}

/** Extracts every condition, validator and post function of one <action>. */
function collectRules(action) {
  const result = action.results?.['unconditional-result'] ?? {};
  return [
    ...collectConditions(action['restrict-to']?.conditions),
    ...toArray(action.validators?.validator).map((v) => toRule('validator', v)),
    // Post functions may sit on the action itself or on its result; collect both.
    ...toArray(action['post-functions']?.function).map((f) => toRule('post-function', f)),
    ...toArray(result['post-functions']?.function).map((f) => toRule('post-function', f)),
  ];
}

/**
 * Parses a workflow XML string.
 * @param {string} xml          file contents
 * @param {string} workflowName DC exports do not contain the name, so callers pass it
 *                              (the CLI uses the file name).
 * @returns {{ workflow: string, steps: {id:string,name:string}[], transitions: object[] }}
 */
export function parseWorkflowXml(xml, workflowName) {
  const root = parser.parse(xml).workflow;
  if (!root) throw new Error(`"${workflowName}" is not a Jira workflow export (no <workflow> root element)`);

  const steps = toArray(root.steps?.step).map((s) => ({ id: String(s.id), name: s.name }));
  const stepName = (id) => steps.find((s) => s.id === String(id))?.name ?? `(step ${id})`;

  // Common actions are defined once and referenced from steps by id.
  // First record which steps reference each common action...
  const commonFrom = new Map();
  for (const step of toArray(root.steps?.step)) {
    for (const ref of toArray(step.actions?.['common-action'])) {
      const id = String(ref.id);
      commonFrom.set(id, [...(commonFrom.get(id) ?? []), step.name]);
    }
  }

  const transitions = [];
  const addTransition = (action, scope, from) => {
    const target = action.results?.['unconditional-result']?.step;
    transitions.push({
      id: String(action.id),
      name: action.name,
      scope,                                         // initial | global | common | step
      from,                                          // list of status names
      to: target === undefined || target === '-1' ? '(same status)' : stepName(target),
      rules: collectRules(action),
    });
  };

  for (const a of toArray(root['initial-actions']?.action)) addTransition(a, 'initial', ['(create)']);
  for (const a of toArray(root['global-actions']?.action)) addTransition(a, 'global', ['(any status)']);
  for (const a of toArray(root['common-actions']?.action)) {
    addTransition(a, 'common', commonFrom.get(String(a.id)) ?? ['(unreferenced)']);
  }
  for (const step of toArray(root.steps?.step)) {
    for (const a of toArray(step.actions?.action)) addTransition(a, 'step', [step.name]);
  }

  return { workflow: workflowName, steps, transitions };
}
