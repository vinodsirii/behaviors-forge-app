import { PRIORITY_IDS, priorityNameOf } from '../helpers.js';

/*
 * 1. Summary quality
 *
 *  - Summary:  helper text, which turns into a warning when longer than 80 characters.
 *  - Priority: automatically set to "Highest" when the summary starts with "URGENT".
 *
 * Test: type a long summary, then click out of the field -> the warning appears.
 *       Type "URGENT printer on fire" -> Priority switches to Highest (and behaviours
 *       4 and 10, which react to Priority, run straight away too).
 */

const SUMMARY_MAX = 80;
const SUMMARY_HELP = 'Keep it short and specific, e.g. "Login page fails on Safari".';

export default {
  id: 'summary-quality',
  fields: ['summary', 'priority'],
  // Re-run this behaviour whenever the user changes the Summary.
  triggers: ['summary'],

  apply(ctx) {
    const summaryField = ctx.field('summary');
    if (!summaryField) return;

    const summary = ctx.value('summary') || '';
    summaryField.setDescription(
      summary.length > SUMMARY_MAX
        ? `⚠ Summary is ${summary.length} characters. Please keep it under ${SUMMARY_MAX}.`
        : SUMMARY_HELP,
    );

    // Only react to the user typing (not to the form opening), and only when the
    // priority is not already Highest, so we never fight the user's own choice.
    const isUrgent = /^urgent\b/i.test(summary.trim());
    if (!ctx.isInit && isUrgent && priorityNameOf(ctx.value('priority')) !== 'Highest') {
      ctx.setValue('priority', PRIORITY_IDS.Highest);
    }
  },
};
