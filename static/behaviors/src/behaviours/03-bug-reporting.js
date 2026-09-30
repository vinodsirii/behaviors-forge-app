import { renameField } from '../helpers.js';

/*
 * 3. Bug reporting (Bug issue type only)
 *
 *  - Description:      renamed to "Steps to reproduce" and made required.
 *  - Affects versions: renamed to "Found in version(s)" and made required.
 *
 * Test: choose Issue type = Bug -> both fields show the new names and a red asterisk.
 *       Switch to Task -> original names come back and they are optional again.
 */

export default {
  id: 'bug-reporting',
  fields: ['description', 'versions'],
  triggers: [],

  apply(ctx) {
    const isBug = ctx.issueType === 'bug';

    const description = ctx.field('description');
    if (description) {
      renameField(description, isBug ? 'Steps to reproduce' : null);
      description.setRequired(isBug);
    }

    const versions = ctx.field('versions');
    if (versions) {
      renameField(versions, isBug ? 'Found in version(s)' : null);
      versions.setRequired(isBug);
    }
  },
};
