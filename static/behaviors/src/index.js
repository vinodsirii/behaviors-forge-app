import { uiModificationsApi } from '@forge/jira-bridge';
import { view } from '@forge/bridge';
import behaviours from './behaviours/index.js';

/*
 * Entry point for the UI modification (the Forge equivalent of ScriptRunner Behaviours).
 *
 * Jira loads this script in the background of the "Create issue" dialog and calls:
 *   - onInit   when the dialog opens, and again whenever the project or issue type changes
 *   - onChange when the user changes one of the registered fields
 *
 * This file contains no business rules. It only runs the behaviours listed in
 * ./behaviours/index.js - one file per behaviour - so the app can grow to many
 * behaviours without this file changing.
 *
 * Every behaviour receives the same `ctx` object:
 *   ctx.issueType       lower-case issue type name, e.g. "bug", "story", "epic"
 *   ctx.isInit          true when the form just opened, false when a field changed
 *   ctx.field(id)       the Jira field object, or undefined when the field is not on the screen
 *   ctx.value(id)       the field's current value (already includes the change being processed)
 *   ctx.setValue(id, v) change a field's value; behaviours that listen to that field run too
 */

const { onInit, onChange } = uiModificationsApi;

// Every field any behaviour touches. Jira only lets us read/change registered fields.
const ALL_FIELDS = [...new Set(behaviours.flatMap((behaviour) => behaviour.fields))];

// The issue type is read once per onInit (Jira runs onInit again when it changes),
// then reused by onChange so field changes stay fast.
let currentIssueType = '';

async function readIssueType() {
  try {
    const context = await view.getContext();
    return (context.extension?.issueType?.name || '').toLowerCase();
  } catch (e) {
    console.error('[Behaviours] Could not read issue type from context', e);
    return '';
  }
}

// Builds the `ctx` object described at the top of this file.
function createContext(api, isInit, knownValues = {}) {
  // Values we already know are newer than what the field would return
  // (re-reading a field inside onChange can still give the previous value).
  const values = { ...knownValues };
  const valuesSetByBehaviours = new Set();

  return {
    issueType: currentIssueType,
    isInit,
    field: (id) => api.getFieldById(id),
    value: (id) => (id in values ? values[id] : api.getFieldById(id)?.getValue()),
    setValue(id, value) {
      const field = api.getFieldById(id);
      if (!field) return;
      field.setValue(value);
      values[id] = value;
      valuesSetByBehaviours.add(id);
    },
    valuesSetByBehaviours,
  };
}

// Runs each behaviour on its own, so one failing behaviour never stops the others.
function runBehaviours(list, ctx) {
  for (const behaviour of list) {
    try {
      behaviour.apply(ctx);
    } catch (e) {
      console.error(`[Behaviours] "${behaviour.id}" failed`, e);
    }
  }
}

onInit(
  async ({ api }) => {
    currentIssueType = await readIssueType();
    runBehaviours(behaviours, createContext(api, true));
  },
  () => ALL_FIELDS,
);

onChange(
  ({ api, change }) => {
    const changedId = change.current.getId();
    const ctx = createContext(api, false, { [changedId]: change.current.getValue() });

    // 1. Run the behaviours that listen to the field the user changed.
    const triggered = behaviours.filter((behaviour) => behaviour.triggers.includes(changedId));
    runBehaviours(triggered, ctx);

    // 2. If those behaviours changed other fields (e.g. Summary "URGENT..." sets Priority),
    //    also run the behaviours listening to those fields. Jira does not fire onChange
    //    for changes made by the app itself, so we do it here.
    const followUps = behaviours.filter(
      (behaviour) =>
        !triggered.includes(behaviour) && behaviour.triggers.some((id) => ctx.valuesSetByBehaviours.has(id)),
    );
    runBehaviours(followUps, ctx);
  },
  () => ALL_FIELDS,
);
