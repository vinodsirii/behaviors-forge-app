import { renameField } from '../helpers.js';

/*
 * 6. Epic planning (Epic issue type only)
 *
 *  - Assignee:     read-only (the product owner assigns epics later).
 *  - Fix versions: renamed to "Target release" and made required.
 *
 * Test: choose Issue type = Epic -> Assignee is greyed out, Fix versions is called
 *       "Target release" and has a red asterisk.
 */

export default {
  id: 'epic-planning',
  fields: ['assignee', 'fixVersions'],
  triggers: [],

  apply(ctx) {
    const isEpic = ctx.issueType === 'epic';

    const assignee = ctx.field('assignee');
    if (assignee) assignee.setReadOnly(isEpic);

    const fixVersions = ctx.field('fixVersions');
    if (fixVersions) {
      renameField(fixVersions, isEpic ? 'Target release' : null);
      fixVersions.setRequired(isEpic);
    }
  },
};
