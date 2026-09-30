/*
 * The list of all behaviours, in the order they run.
 *
 * To add behaviour #11: create a new file next to these (copy one as a starting
 * point), then import it and add it to the array below. Nothing else needs to change.
 *
 * Every behaviour is a plain object:
 *   id        - a unique name, used in log messages
 *   fields    - every field id the behaviour reads or changes
 *   triggers  - field ids whose change should re-run the behaviour ([] = on open only)
 *   apply(ctx)- does the work (see ../index.js for what `ctx` contains)
 *
 * OWNERSHIP RULE: each field *property* (e.g. "duedate -> required") is changed by
 * exactly one behaviour. If two behaviours set the same property, whichever runs
 * last silently wins, which is very hard to debug. Current owners:
 *
 *   summary      description -> 1        name     -> 10
 *   priority     value       -> 1
 *   description  value       -> 2        name, required -> 3
 *   versions     name, required -> 3     description -> 7     visible -> 8
 *   duedate      required, description -> 4
 *   labels       required, description -> 4
 *   reporter     readOnly, description -> 5
 *   assignee     description -> 5        readOnly -> 6        name -> 9
 *   fixVersions  name, required -> 6     visible -> 8
 *   components   required, description -> 7                   name -> 10
 *   parent       name, required, description -> 9
 */

import summaryQuality from './01-summary-quality.js';
import descriptionTemplate from './02-description-template.js';
import bugReporting from './03-bug-reporting.js';
import prioritySla from './04-priority-sla.js';
import ownership from './05-ownership.js';
import epicPlanning from './06-epic-planning.js';
import customerEscalation from './07-customer-escalation.js';
import releaseFields from './08-release-fields.js';
import storyParent from './09-story-parent.js';
import incidentMode from './10-incident-mode.js';

export default [
  summaryQuality,
  descriptionTemplate,
  bugReporting,
  prioritySla,
  ownership,
  epicPlanning,
  customerEscalation,
  releaseFields,
  storyParent,
  incidentMode,
];
