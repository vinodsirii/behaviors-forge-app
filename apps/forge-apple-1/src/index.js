// -----------------------------------------------------------------------------
// Forge Apple 1 - handlers for the "Forge Apple 1" workflow.
//
// This file contains NO business logic. It only translates Jira's workflow
// events into calls to the shared library, so the same rules can be reused by
// other apps (see apps/forge-apple-2) and are unit-tested in one place.
// -----------------------------------------------------------------------------
import { getIssue, validateSummaryLength, addComment, LIB_VERSION } from '@vinod/forge-common';

const MIN_SUMMARY_LENGTH = 10;

/**
 * Workflow validator - "FA1 – Validator: Summary length ≥ 10".
 *
 * Jira calls this when a user attempts the transition.
 *   args = { issue: { key }, transition: { from, to, modifiedFields } }
 * Must return { result: boolean, errorMessage?: string }; result=false blocks it.
 */
export const validateSummary = async (args) => {
  const issueKey = args.issue.key;
  try {
    // If the summary was edited on a transition screen, Jira sends the NEW value
    // in modifiedFields; otherwise we read the stored value from the issue.
    let summary = args.transition?.modifiedFields?.summary;
    if (summary == null) {
      const issue = await getIssue(issueKey, ['summary']);
      summary = issue.fields.summary;
    }
    return validateSummaryLength(summary, MIN_SUMMARY_LENGTH);
  } catch (error) {
    // Fail closed: if the rule cannot be checked, block the transition and say why.
    console.error(`[FA1 validator] ${issueKey}: ${error.message}`);
    return { result: false, errorMessage: 'FA1: could not check the summary. Please try again.' };
  }
};

/**
 * Post function - "FA1 – Post function: Add audit comment".
 *
 * Jira calls this asynchronously AFTER the transition completes.
 *   event = { issue: { id, key }, transition, ... }
 * The return value is ignored, so errors are logged (see `forge logs`).
 */
export const auditComment = async (event) => {
  const issueKey = event.issue.key ?? event.issue.id;
  try {
    await addComment(issueKey, 'Forge Apple 1 transition executed');
    console.log(`[FA1 post function] commented on ${issueKey} (forge-common v${LIB_VERSION})`);
  } catch (error) {
    console.error(`[FA1 post function] ${issueKey}: ${error.message}`);
  }
};
