const assert = require('assert');
const espree = require('espree');
const { SourceCode } = require('eslint');
const { createSuppressionChecker } = require('../utils/inner-rule-suppression');

function sourceCodeFor(code) {
  const ast = espree.parse(code, {
    ecmaVersion: 2015,
    loc: true,
    range: true,
    comment: true,
    tokens: true,
  });
  return new SourceCode(code, ast);
}

describe('inner-rule-suppression', () => {
  it('does not suppress when there is no relevant comment', () => {
    const sourceCode = sourceCodeFor('"bad";');
    const isSuppressed = createSuppressionChecker(sourceCode, 'no-bad-literal');
    assert.strictEqual(isSuppressed({ line: 1, column: 0 }), false);
  });

  it('suppresses a report on the same line as an eslint-disable-line comment naming the rule', () => {
    const sourceCode = sourceCodeFor('"bad"; // eslint-disable-line no-bad-literal\n"also bad";');
    const isSuppressed = createSuppressionChecker(sourceCode, 'no-bad-literal');
    assert.strictEqual(isSuppressed({ line: 1, column: 0 }), true);
    assert.strictEqual(isSuppressed({ line: 2, column: 0 }), false);
  });

  it('does not suppress when the comment names a different rule', () => {
    const sourceCode = sourceCodeFor('"bad"; // eslint-disable-line some-other-rule');
    const isSuppressed = createSuppressionChecker(sourceCode, 'no-bad-literal');
    assert.strictEqual(isSuppressed({ line: 1, column: 0 }), false);
  });

  it('suppresses a report on the line after an eslint-disable-next-line comment naming the rule', () => {
    const sourceCode = sourceCodeFor('// eslint-disable-next-line no-bad-literal\n"bad";\n"also bad";');
    const isSuppressed = createSuppressionChecker(sourceCode, 'no-bad-literal');
    assert.strictEqual(isSuppressed({ line: 2, column: 0 }), true);
    assert.strictEqual(isSuppressed({ line: 3, column: 0 }), false);
  });

  it('matches one of several comma-separated names', () => {
    const sourceCode = sourceCodeFor('"bad"; // eslint-disable-line some-other-rule, no-bad-literal');
    const isSuppressed = createSuppressionChecker(sourceCode, 'no-bad-literal');
    assert.strictEqual(isSuppressed({ line: 1, column: 0 }), true);
  });

  it('suppresses everything inside a disable/enable block naming the rule', () => {
    const sourceCode = sourceCodeFor([
      '/* eslint-disable no-bad-literal */',
      '"bad";',
      '/* eslint-enable no-bad-literal */',
      '"bad";',
    ].join('\n'));
    const isSuppressed = createSuppressionChecker(sourceCode, 'no-bad-literal');
    assert.strictEqual(isSuppressed({ line: 2, column: 0 }), true);
    assert.strictEqual(isSuppressed({ line: 4, column: 0 }), false);
  });

  it('suppresses to end of file when a disable block is never re-enabled', () => {
    const sourceCode = sourceCodeFor([
      '/* eslint-disable no-bad-literal */',
      '"bad";',
      '"bad";',
    ].join('\n'));
    const isSuppressed = createSuppressionChecker(sourceCode, 'no-bad-literal');
    assert.strictEqual(isSuppressed({ line: 2, column: 0 }), true);
    assert.strictEqual(isSuppressed({ line: 3, column: 0 }), true);
  });

  it('a bare eslint-enable closes a block opened for a specific rule', () => {
    const sourceCode = sourceCodeFor([
      '/* eslint-disable no-bad-literal */',
      '"bad";',
      '/* eslint-enable */',
      '"bad";',
    ].join('\n'));
    const isSuppressed = createSuppressionChecker(sourceCode, 'no-bad-literal');
    assert.strictEqual(isSuppressed({ line: 2, column: 0 }), true);
    assert.strictEqual(isSuppressed({ line: 4, column: 0 }), false);
  });
});
