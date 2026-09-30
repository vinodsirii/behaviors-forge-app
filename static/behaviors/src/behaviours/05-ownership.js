/*
 * 5. Ownership
 *
 *  - Reporter: read-only (always the person creating the issue), with helper text.
 *  - Assignee: helper text explaining what happens when it is left empty
 *              (or, for Epics, why it is locked - see behaviour 6).
 *
 * Test: open Create issue -> Reporter is greyed out and cannot be changed.
 *       Assignee shows the helper text underneath.
 */

export default {
  id: 'ownership',
  fields: ['reporter', 'assignee'],
  triggers: [],

  apply(ctx) {
    const reporter = ctx.field('reporter');
    if (reporter) {
      reporter.setReadOnly(true);
      reporter.setDescription('The reporter is always you. Ask a Jira admin if it must be changed.');
    }

    const assignee = ctx.field('assignee');
    if (assignee) {
      assignee.setDescription(
        ctx.issueType === 'epic'
          ? 'Epics are assigned by the product owner during triage.'
          : "Leave empty to use the project's default assignee.",
      );
    }
  },
};
