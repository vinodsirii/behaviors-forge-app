import { hasText } from '../helpers.js';

/*
 * 2. Description template
 *
 *  - Description: pre-filled with a template when the form opens and it is empty.
 *                 Bugs get a "steps to reproduce" template, everything else a
 *                 "background / acceptance criteria" template.
 *  - Issue type:  decides which template is used.
 *
 * Test: open Create issue -> Description already contains headings.
 *       The template is chosen when the form opens. Switching the issue type
 *       afterwards keeps the current text (the template counts as "not empty");
 *       clear Description first, or choose Bug before opening Create, to get the
 *       Bug template.
 */

// Builders for Atlassian Document Format (ADF), the JSON format of the rich-text editor.
const heading = (text) => ({ type: 'heading', attrs: { level: 3 }, content: [{ type: 'text', text }] });
const paragraph = (text) => ({ type: 'paragraph', content: [{ type: 'text', text }] });

const TEMPLATES = {
  bug: [
    ['Steps to reproduce', '1. '],
    ['Expected result', ' '],
    ['Actual result', ' '],
    ['Environment', 'Browser / OS / version: '],
  ],
  default: [
    ['Background', 'Why is this needed? '],
    ['Acceptance criteria', '- '],
  ],
};

function templateFor(isBug, asAdf) {
  const sections = isBug ? TEMPLATES.bug : TEMPLATES.default;
  if (!asAdf) {
    // Projects that still use the old wiki-markup editor get plain text instead.
    return sections.map(([title, body]) => `h3. ${title}\n${body}`).join('\n\n');
  }
  return {
    type: 'doc',
    version: 1,
    content: sections.flatMap(([title, body]) => [heading(title), paragraph(body)]),
  };
}

export default {
  id: 'description-template',
  fields: ['description'],
  // No triggers: this only runs when the form opens (or the issue type changes,
  // which makes Jira run all behaviours again from scratch).
  triggers: [],

  apply(ctx) {
    const description = ctx.field('description');
    if (!description) return;

    const current = ctx.value('description');
    if (hasText(current)) return; // never overwrite what the user typed

    // A string value means the wiki-markup editor; otherwise the ADF rich-text editor.
    description.setValue(templateFor(ctx.issueType === 'bug', typeof current !== 'string'));
  },
};
