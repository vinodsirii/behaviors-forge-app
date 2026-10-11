import { jest } from '@jest/globals';

const mockRequestJira = jest.fn();

// Replace @forge/api BEFORE importing the module under test.
jest.unstable_mockModule('@forge/api', () => ({
  default: { asApp: () => ({ requestJira: mockRequestJira }) },
  // Simplified `route`: joins the template and URL-encodes values, like the real one.
  route: (strings, ...values) =>
    strings.reduce((acc, s, i) => acc + s + (i < values.length ? encodeURIComponent(values[i]) : ''), ''),
}));

const { getIssue, addComment, setLabel } = await import('../src/jira.js');
const { LIB_VERSION } = await import('../src/version.js');

const okResponse = (json = {}) => ({ ok: true, status: 200, json: async () => json, text: async () => '' });

beforeEach(() => mockRequestJira.mockReset());

test('getIssue requests selected fields', async () => {
  mockRequestJira.mockResolvedValue(okResponse({ key: 'FA-1' }));
  await expect(getIssue('FA-1', ['summary', 'priority'])).resolves.toEqual({ key: 'FA-1' });
  expect(mockRequestJira.mock.calls[0][0]).toBe('/rest/api/3/issue/FA-1?fields=summary%2Cpriority');
});

test('getIssue without fields omits the query string', async () => {
  mockRequestJira.mockResolvedValue(okResponse());
  await getIssue('FA-1');
  expect(mockRequestJira.mock.calls[0][0]).toBe('/rest/api/3/issue/FA-1');
});

test('getIssue throws on HTTP error', async () => {
  mockRequestJira.mockResolvedValue({ ok: false, status: 404, text: async () => 'Not found' });
  await expect(getIssue('NOPE-1')).rejects.toThrow('getIssue(NOPE-1) failed with HTTP 404: Not found');
});

test('addComment posts ADF with version prefix', async () => {
  mockRequestJira.mockResolvedValue(okResponse({ id: '100' }));
  await addComment('FA-1', 'hello');
  const [path, options] = mockRequestJira.mock.calls[0];
  expect(path).toBe('/rest/api/3/issue/FA-1/comment');
  expect(options.method).toBe('POST');
  expect(JSON.parse(options.body).body.content[0].content[0].text)
    .toBe(`[forge-common v${LIB_VERSION}] hello`);
});

test('setLabel uses update.add so existing labels are kept', async () => {
  mockRequestJira.mockResolvedValue({ ok: true, status: 204, text: async () => '' });
  await setLabel('FA-1', 'forge-apple-2-processed');
  const [path, options] = mockRequestJira.mock.calls[0];
  expect(path).toBe('/rest/api/3/issue/FA-1');
  expect(options.method).toBe('PUT');
  expect(JSON.parse(options.body)).toEqual({ update: { labels: [{ add: 'forge-apple-2-processed' }] } });
});
