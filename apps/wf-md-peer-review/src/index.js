// -----------------------------------------------------------------------------
// wf-md-peer-review - handlers for the "MD - Peer Review Workflow" workflow.
//
// Only the function-based rules live here; the condition and the
// "reviewer assigned" validator are Jira expressions in manifest.yml.
// This file stays THIN: it translates Jira workflow events into calls to
// @vinod/forge-common, where the logic is unit-tested and shared.
// -----------------------------------------------------------------------------
import { getIssue, validateRequiredFields, addComment, setLabel, LIB_VERSION } from '@vinod/forge-common';

const REQUIRED_FIELDS = ['description'];
const REVIEW_LABEL = 'md-peer-review';

/**
 * Workflow validator - "MDPR – Validator: Description required for review".
 *
 * Jira calls this when a user attempts the transition.
 *   args = { issue: { key }, transition: { from, to, modifiedFields } }
 * Must return { result: boolean, errorMessage?: string }; result=false blocks it.
 */
export const validateDescription = async (args) => {
  const issueKey = args.issue.key;
  try {
    // Saved value first; a value typed on a transition screen takes precedence.
    const issue = await getIssue(issueKey, REQUIRED_FIELDS);
    const fields = { ...issue.fields };
    const modified = args.transition?.modifiedFields ?? {};
    for (const fieldId of REQUIRED_FIELDS) {
      if (modified[fieldId] != null) fields[fieldId] = modified[fieldId];
    }

    const outcome = validateRequiredFields(fields, REQUIRED_FIELDS);
    // Reword the library's generic message for reviewers.
    return outcome.result
      ? outcome
      : { result: false, errorMessage: 'MDPR: add a description so the reviewer knows what to review.' };
  } catch (error) {
    // Fail closed: if the rule cannot be checked, block the transition and say why.
    console.error(`[MDPR validator] ${issueKey}: ${error.message}`);
    return { result: false, errorMessage: 'MDPR: could not check the description. Please try again.' };
  }
};

/**
 * Post function - "MDPR – Post function: Record peer review".
 *
 * Jira calls this asynchronously AFTER the transition completes.
 *   event = { issue: { id, key }, transition, ... }
 * The return value is ignored, so outcomes are logged (see `forge logs`).
 */
export const recordPeerReview = async (event) => {
  const issueKey = event.issue.key ?? event.issue.id;
  try {
    await addComment(issueKey, 'MD - Peer Review Workflow: peer review step recorded');
    await setLabel(issueKey, REVIEW_LABEL);
    console.log(`[MDPR post function] recorded review on ${issueKey} (forge-common v${LIB_VERSION})`);
  } catch (error) {
    console.error(`[MDPR post function] ${issueKey}: ${error.message}`);
  }
};
