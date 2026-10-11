import { textToAdf } from '../src/adf.js';

describe('textToAdf', () => {
  test('single line', () => {
    expect(textToAdf('hello')).toEqual({
      version: 1, type: 'doc',
      content: [{ type: 'paragraph', content: [{ type: 'text', text: 'hello' }] }],
    });
  });
  test('multi-line and blank lines', () => {
    const doc = textToAdf('a\r\n\nb');
    expect(doc.content).toHaveLength(3);
    expect(doc.content[1]).toEqual({ type: 'paragraph', content: [] });
  });
  test('null and numbers are safe', () => {
    expect(textToAdf(null).content).toEqual([{ type: 'paragraph', content: [] }]);
    expect(textToAdf(42).content[0].content[0].text).toBe('42');
  });
});
