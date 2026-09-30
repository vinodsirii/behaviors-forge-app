/*
 * 8. Release fields visibility
 *
 *  - Affects versions: only shown for Bugs (it only makes sense for defects).
 *  - Fix versions:     hidden for Bugs and Sub-tasks (set later, during triage).
 *
 * Test: Issue type = Task -> "Affects versions" is gone, "Fix versions" is visible.
 *       Issue type = Bug  -> "Found in version(s)" is visible, "Fix versions" is gone.
 *
 * Safety: we only hide a field for issue types where no other behaviour makes it
 * required, otherwise the user could never submit the form.
 */

const SUBTASK_NAMES = ['sub-task', 'subtask'];

export default {
  id: 'release-fields',
  fields: ['versions', 'fixVersions'],
  triggers: [],

  apply(ctx) {
    const isBug = ctx.issueType === 'bug';
    const isSubtask = SUBTASK_NAMES.includes(ctx.issueType);

    const versions = ctx.field('versions');
    if (versions) versions.setVisible(isBug);

    const fixVersions = ctx.field('fixVersions');
    if (fixVersions) fixVersions.setVisible(!(isBug || isSubtask));
  },
};
