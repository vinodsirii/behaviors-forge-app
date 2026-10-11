import { isFieldPresent, validateRequiredFields, validateSummaryLength } from '../src/validators.js';

describe('isFieldPresent', () => {
  test.each([
    [{ a: 'x' }, true],
    [{ a: '   ' }, false],
    [{ a: null }, false],
    [{}, false],
    [{ a: [] }, false],
    [{ a: ['l1'] }, true],
    [{ a: { name: 'High' } }, true],
    [{ a: { type: 'doc', content: [] } }, false],
    [{ a: { type: 'doc', content: [{ type: 'paragraph' }] } }, true],
  ])('%j -> %s', (fields, expected) => {
    expect(isFieldPresent(fields, 'a')).toBe(expected);
  });

  test('handles null/non-object fields', () => {
    expect(isFieldPresent(null, 'a')).toBe(false);
    expect(isFieldPresent('oops', 'a')).toBe(false);
  });
});

describe('validateRequiredFields', () => {
  test('passes when all present', () => {
    expect(validateRequiredFields({ description: 'd', priority: { name: 'High' } }, ['description', 'priority']))
      .toEqual({ result: true });
  });
  test('lists every missing field', () => {
    expect(validateRequiredFields({ description: null }, ['description', 'priority']))
      .toEqual({ result: false, errorMessage: 'Required field(s) missing: description, priority' });
  });
  test('empty list always passes', () => {
    expect(validateRequiredFields({}, [])).toEqual({ result: true });
  });
});

describe('validateSummaryLength', () => {
  test('exactly min passes', () => expect(validateSummaryLength('1234567890', 10)).toEqual({ result: true }));
  test('short fails with count', () => {
    expect(validateSummaryLength('short', 10)).toEqual({
      result: false, errorMessage: 'Summary must be at least 10 characters (currently 5).',
    });
  });
  test('whitespace is trimmed', () => expect(validateSummaryLength('   abc    ', 5).result).toBe(false));
  test('null/undefined fails', () => {
    expect(validateSummaryLength(null, 1).result).toBe(false);
    expect(validateSummaryLength(undefined, 1).result).toBe(false);
  });
});
