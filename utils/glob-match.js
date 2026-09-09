/**
 * A small, dependency-free glob matcher for `filesWithTag`. Supports the
 * subset of glob syntax people actually write in ESLint `files:` patterns:
 * `*`, `**`, `?`, and `{a,b,c}` alternation. No character classes (`[...]`)
 * or extglobs (`!(...)`, `+(...)`) - if you need those, filter the result
 * of `filesWithTag` yourself instead.
 */

function escapeLiteral(str) {
  return str.replace(/[.+^${}()|[\]\\]/gu, '\\$&');
}

/**
 * @param {string} pattern A glob pattern using `/` as its separator.
 * @returns {RegExp} A regex matching a POSIX-style relative path (also
 *   using `/`) against that pattern.
 */
function globToRegExp(pattern) {
  let regexSource = '';
  let i = 0;

  while (i < pattern.length) {
    const char = pattern[i];

    if (char === '*') {
      if (pattern[i + 1] === '*') {
        if (pattern[i + 2] === '/') {
          // `**/` matches zero or more whole path segments.
          regexSource += '(?:.*/)?';
          i += 3;
          continue;
        }
        // A trailing (or otherwise unanchored) `**` matches anything,
        // slashes included.
        regexSource += '.*';
        i += 2;
        continue;
      }
      regexSource += '[^/]*';
      i += 1;
      continue;
    }

    if (char === '?') {
      regexSource += '[^/]';
      i += 1;
      continue;
    }

    if (char === '{') {
      const close = pattern.indexOf('}', i);
      if (close === -1) {
        regexSource += '\\{';
        i += 1;
        continue;
      }
      const alternatives = pattern
        .slice(i + 1, close)
        .split(',')
        .map(escapeLiteral);
      regexSource += `(?:${alternatives.join('|')})`;
      i = close + 1;
      continue;
    }

    regexSource += escapeLiteral(char);
    i += 1;
  }

  return new RegExp(`^${regexSource}$`, 'u');
}

/**
 * The longest leading run of path segments in `pattern` that contains no
 * glob metacharacter - i.e. the directory a naive walk can start from
 * without missing anything the pattern could match. Used to avoid walking
 * an entire project just to filter a pattern scoped to one subdirectory.
 *
 * @param {string} pattern
 * @returns {string} A relative path (possibly `''`, meaning "no shortcut -
 *   start from the walk root").
 */
function staticPrefix(pattern) {
  const segments = pattern.split('/');
  const staticSegments = [];

  for (const segment of segments) {
    if (/[*?{]/u.test(segment)) {
      break;
    }
    staticSegments.push(segment);
  }

  return staticSegments.join('/');
}

module.exports = { globToRegExp, staticPrefix };
