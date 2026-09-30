import { labelsOf } from '../helpers.js';

/*
 * 7. Customer escalation
 *
 * When the Labels contain "customer":
 *  - Components:       required, with helper text.
 *  - Affects versions: helper text asking which version the customer runs.
 *
 * Test: add the label "customer" and click out of Labels -> Components becomes required.
 *       Remove the label -> Components is optional again.
 */

const TRIGGER_LABEL = 'customer';

export default {
  id: 'customer-escalation',
  fields: ['labels', 'components', 'versions'],
  triggers: ['labels'],

  apply(ctx) {
    const isCustomer = labelsOf(ctx.value('labels')).includes(TRIGGER_LABEL);

    const components = ctx.field('components');
    if (components) {
      components.setRequired(isCustomer);
      components.setDescription(isCustomer ? 'Customer issue: pick the component so the owning team is notified.' : '');
    }

    const versions = ctx.field('versions');
    if (versions) {
      versions.setDescription(isCustomer ? 'Which version is the customer running?' : '');
    }
  },
};
