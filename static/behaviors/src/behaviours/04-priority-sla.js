import { priorityNameOf } from '../helpers.js';

/*
 * 4. Priority SLA
 *
 *  - Due date: required when Priority is High or Highest.
 *  - Labels:   required when Priority is Highest.
 *
 * Test: set Priority = High    -> Due date gets a red asterisk and helper text.
 *       set Priority = Highest -> Labels becomes required as well.
 *       set Priority = Medium  -> both go back to optional.
 */

const DUE_DATE_PRIORITIES = ['High', 'Highest'];
const LABELS_PRIORITIES = ['Highest'];

export default {
  id: 'priority-sla',
  fields: ['priority', 'duedate', 'labels'],
  triggers: ['priority'],

  apply(ctx) {
    const priority = priorityNameOf(ctx.value('priority'));

    const dueDate = ctx.field('duedate');
    if (dueDate) {
      const required = DUE_DATE_PRIORITIES.includes(priority);
      dueDate.setRequired(required);
      dueDate.setDescription(required ? `Required for ${priority} priority.` : '');
    }

    const labels = ctx.field('labels');
    if (labels) {
      const required = LABELS_PRIORITIES.includes(priority);
      labels.setRequired(required);
      labels.setDescription(required ? 'Add at least one label (e.g. "incident") for Highest priority.' : '');
    }
  },
};
