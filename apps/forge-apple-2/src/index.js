// -----------------------------------------------------------------------------
// Forge Apple 2 - handlers for the "Forge Apple 2" workflow.
//
// Like forge-apple-1, this file only wires Jira events to the shared library
// @vinod/forge-common. It reuses addComment (also used by app 1) and adds
// validateRequiredFields + setLabel - no logic is duplicated between the apps.
// -----------------------------------------------------------------------------
import { getIssue, validateRequiredFields, addComment, setLabel, LIB_VERSION } from '@vinod/forge-common';

const REQUIRED_FIELDS = ['description', 'priority'];
const PROCESSED_LABEL = 'forge-apple-2-processed';

/**
 * Workflow validator - "FA2 – Description and priority required".
 *
 *   args = { issue: { key }, transition: { from, to, modifiedFields } }
 * Must return { result: boolean, errorMessage?: string }.
 */
export const validateRequired = async (args) => {
  const issueKey = args.issue.key;
  try {
    // Start from the values stored on the issue...
    const issue = await getIssue(issueKey, REQUIRED_FIELDS);
    const fields = { ...issue.fields };

    // ...then let values entered on a transition screen take precedence.
    const modified = args.transition?.modifiedFields ?? {};
    for (const fieldId of REQUIRED_FIELDS) {
      if (modified[fieldId] != null) fields[fieldId] = modified[fieldId];
    }

    return validateRequiredFields(fields, REQUIRED_FIELDS);
  } catch (error) {
    // Fail closed: if the rule cannot be checked, block the transition and say why.
    console.error(`[FA2 validator] ${issueKey}: ${error.message}`);
    return { result: false, errorMessage: 'FA2: could not check required fields. Please try again.' };
  }
};

/**
 * Post function - "FA2 – Add audit comment + label".
 *
 * Runs asynchronously after the transition. Adds the audit comment first, then
 * marks the issue as processed (existing labels are kept).
 */
export const auditCommentAndLabel = async (event) => {
  const issueKey = event.issue.key ?? event.issue.id;
  try {
    await addComment(issueKey, 'Forge Apple 2 transition executed');
    await setLabel(issueKey, PROCESSED_LABEL);
    console.log(`[FA2 post function] processed ${issueKey} (forge-common v${LIB_VERSION})`);
  } catch (error) {
    console.error(`[FA2 post function] ${issueKey}: ${error.message}`);
  }
};
