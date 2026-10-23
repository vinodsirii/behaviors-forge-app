// -----------------------------------------------------------------------------
// __APP_NAME__ - handlers for the "__WORKFLOW_NAME__" workflow.
//
// Generated from templates/workflow-app. Keep this file THIN: it only translates
// Jira workflow events into calls to @vinod/forge-common. If a rule needs logic
// that the library does not have yet, add it to packages/forge-common (with a
// unit test) instead of writing it here, so every workflow app can reuse it.
// -----------------------------------------------------------------------------
import { getIssue, validateRequiredFields, addComment, LIB_VERSION } from '@vinod/forge-common';

// EXAMPLE: replace with the fields this workflow's DC validator required.
const REQUIRED_FIELDS = ['description'];

/**
 * Workflow validator (EXAMPLE) - "__PREFIX__ – Validator: Required fields".
 *
 * Jira calls this when a user attempts the transition.
 *   args = { issue: { key }, transition: { from, to, modifiedFields } }
 * Must return { result: boolean, errorMessage?: string }; result=false blocks it.
 */
export const validateRequired = async (args) => {
  const issueKey = args.issue.key;
  try {
    // Saved values first, then values typed on a transition screen take precedence.
    const issue = await getIssue(issueKey, REQUIRED_FIELDS);
    const fields = { ...issue.fields };
    const modified = args.transition?.modifiedFields ?? {};
    for (const fieldId of REQUIRED_FIELDS) {
      if (modified[fieldId] != null) fields[fieldId] = modified[fieldId];
    }
    return validateRequiredFields(fields, REQUIRED_FIELDS);
  } catch (error) {
    // Fail closed: if the rule cannot be checked, block the transition and say why.
    console.error(`[__PREFIX__ validator] ${issueKey}: ${error.message}`);
    return { result: false, errorMessage: '__PREFIX__: could not check required fields. Please try again.' };
  }
};

/**
 * Post function (EXAMPLE) - "__PREFIX__ – Post function: Add audit comment".
 *
 * Jira calls this asynchronously AFTER the transition completes.
 *   event = { issue: { id, key }, transition, ... }
 * The return value is ignored, so outcomes are logged (see `forge logs`).
 */
export const auditComment = async (event) => {
  const issueKey = event.issue.key ?? event.issue.id;
  try {
    await addComment(issueKey, '__WORKFLOW_NAME__ transition executed');
    console.log(`[__PREFIX__ post function] commented on ${issueKey} (forge-common v${LIB_VERSION})`);
  } catch (error) {
    console.error(`[__PREFIX__ post function] ${issueKey}: ${error.message}`);
  }
};
