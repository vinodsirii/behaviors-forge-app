import { priorityNameOf, renameField } from '../helpers.js';

/*
 * 10. Incident mode
 *
 * When Priority is Highest the form switches to "incident wording":
 *  - Summary:    renamed to "Incident summary".
 *  - Components: renamed to "Affected service".
 *
 * Test: set Priority = Highest (or type "URGENT ..." in the Summary, which sets it
 *       via behaviour 1) -> both labels change. Set it back to Medium -> they revert.
 */

export default {
  id: 'incident-mode',
  fields: ['priority', 'summary', 'components'],
  triggers: ['priority'],

  apply(ctx) {
    const isIncident = priorityNameOf(ctx.value('priority')) === 'Highest';

    renameField(ctx.field('summary'), isIncident ? 'Incident summary' : null);
    renameField(ctx.field('components'), isIncident ? 'Affected service' : null);
  },
};
