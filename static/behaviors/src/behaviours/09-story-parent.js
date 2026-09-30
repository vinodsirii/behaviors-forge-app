import { renameField } from '../helpers.js';

/*
 * 9. Story structure (Story issue type only)
 *
 *  - Parent:   renamed to "Epic", made required, with helper text.
 *  - Assignee: renamed to "Developer".
 *
 * Test: Issue type = Story -> "Epic" field with a red asterisk, Assignee is
 *       labelled "Developer". Switch to Task -> original names return.
 *
 * Note: the Parent field is only on the create screen for issue types that can
 * have a parent (e.g. Story under an Epic). If it is missing it is simply skipped.
 */

export default {
  id: 'story-parent',
  fields: ['parent', 'assignee'],
  triggers: [],

  apply(ctx) {
    const isStory = ctx.issueType === 'story';

    const parent = ctx.field('parent');
    if (parent) {
      renameField(parent, isStory ? 'Epic' : null);
      parent.setRequired(isStory);
      parent.setDescription(isStory ? 'Every story must belong to an epic.' : '');
    }

    const assignee = ctx.field('assignee');
    if (assignee) renameField(assignee, isStory ? 'Developer' : null);
  },
};
