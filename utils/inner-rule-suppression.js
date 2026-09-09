/**
 * Support for `eslint-disable`-family comments that name the *wrapped* rule
 * inside `tag-scoped-rule`.
 *
 * Every problem `tag-scoped-rule` reports carries ESLint's own configured
 * ruleId (`<plugin>/tag-scoped-rule`), because that ruleId is fixed by
 * ESLint core at the moment it builds the rule's `context` — see
 * node_modules/eslint/lib/linter/linter.js, where `report()` closes over the
 * ruleId from the outer `rules` config key, not whatever rule's `create()`
 * happens to be running. So ESLint's own disable-directive pass (which just
 * string-matches a problem's ruleId against the names listed in a comment)
 * never recognizes a comment naming the *wrapped* rule (e.g.
 * `// eslint-disable-next-line no-restricted-imports`) as applying to a
 * `tag-scoped-rule` problem — that name never appears as a message's ruleId.
 *
 * This module re-implements just enough of that matching (line, next-line,
 * and disable/enable block comments) scoped to one specific rule name, so
 * `tag-scoped-rule` can honor pre-existing disable comments written for the
 * rule it wraps. It intentionally does not handle bare (unnamed)
 * `eslint-disable` comments — those already suppress `tag-scoped-rule`'s own
 * reports via ESLint's normal handling, since a bare directive matches every
 * ruleId regardless of name.
 */

const DIRECTIVE_RE = /^(eslint-disable-next-line|eslint-disable-line|eslint-disable|eslint-enable)\b(.*)$/;

/**
 * @param {string} rest Everything after the directive keyword, e.g.
 *   " no-restricted-imports, no-console -- because reasons".
 * @returns {string[] | null} The named rules, or null for a bare directive.
 */
function parseRuleNames(rest) {
  const withoutTrailingComment = rest.split(/\s-{2,}\s/u)[0].trim();

  if (!withoutTrailingComment) {
    return null;
  }

  return withoutTrailingComment
    .split(',')
    .map(name => name.trim().replace(/^['"]|['"]$/gu, ''))
    .filter(Boolean);
}

/**
 * @param {import('eslint').SourceCode} sourceCode
 * @param {string} ruleName The name the wrapped rule was registered under.
 * @returns {(loc: { line: number, column: number }) => boolean} Whether a
 *   report at that location is suppressed for `ruleName`.
 */
function createSuppressionChecker(sourceCode, ruleName) {
  const suppressedLines = new Set();
  const blockRanges = [];
  let openBlockStart = null;

  for (const comment of sourceCode.getAllComments()) {
    const match = DIRECTIVE_RE.exec(comment.value.trim());

    if (!match) {
      continue;
    }

    const [, directive, rest] = match;
    const names = parseRuleNames(rest);
    const namesMatch = names !== null && names.includes(ruleName);

    if (directive === 'eslint-disable-line' && namesMatch) {
      suppressedLines.add(comment.loc.start.line);
    } else if (directive === 'eslint-disable-next-line' && namesMatch) {
      suppressedLines.add(comment.loc.start.line + 1);
    } else if (directive === 'eslint-disable' && namesMatch && openBlockStart === null) {
      openBlockStart = comment.range[1];
    } else if (directive === 'eslint-enable' && openBlockStart !== null && (names === null || namesMatch)) {
      // A bare `eslint-enable` (no names) re-enables everything that was
      // disabled, including a block that was opened for this specific name.
      blockRanges.push({ start: openBlockStart, end: comment.range[0] });
      openBlockStart = null;
    }
  }

  if (openBlockStart !== null) {
    blockRanges.push({ start: openBlockStart, end: Infinity });
  }

  return function isSuppressed(loc) {
    if (!loc) {
      return false;
    }
    if (suppressedLines.has(loc.line)) {
      return true;
    }
    if (blockRanges.length === 0) {
      return false;
    }
    const offset = sourceCode.getIndexFromLoc({ line: loc.line, column: loc.column });
    return blockRanges.some(range => offset >= range.start && offset < range.end);
  };
}

module.exports = { createSuppressionChecker };
