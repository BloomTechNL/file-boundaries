const fs = require('fs');
const path = require('path');
const { globToRegExp, staticPrefix } = require('./glob-match');
const { getTagsFromText } = require('./tags-from-text');

const DEFAULT_IGNORED_DIRS = ['node_modules', '.git'];

/**
 * Whether `text` contains a JSDoc-style block comment carrying `tag`
 * (matching `values`, if given). A raw-text approximation of what
 * ../rules/tagging-rule.js actually enforces via a real AST - good enough
 * to build a `files:` list from, since tagging-rule remains the source of
 * truth for whether a file's tag block is well-formed.
 */
function hasTag(text, tag, values) {
  const tags = getTagsFromText(text, [tag]);

  if (!(tag in tags)) {
    return false;
  }

  return !values || values.includes(tags[tag]);
}

function walk(dir, root, ignoredDirs, out) {
  let entries;

  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    // The pattern's static prefix doesn't exist on disk - no matches from
    // this pattern, not an error (a glob that matches nothing is normal).
    return;
  }

  for (const entry of entries) {
    if (entry.isDirectory()) {
      if (ignoredDirs.has(entry.name)) {
        continue;
      }
      walk(path.join(dir, entry.name), root, ignoredDirs, out);
    } else if (entry.isFile()) {
      const rel = path.relative(root, path.join(dir, entry.name)).split(path.sep).join('/');
      out.push(rel);
    }
  }
}

/**
 * Finds the files under `patterns` whose content carries a given JSDoc tag,
 * for use as a flat config block's `files:` list - ESLint's own, native
 * per-file targeting, just fed a content-derived list instead of a
 * path-derived one. Meant to be called directly in `eslint.config.js`:
 *
 *   const frontendFiles = fileBoundaries.filesWithTag('src/**\/*.{js,ts}', { tag: 'layer', values: ['frontend'] });
 *   module.exports = [
 *     { files: frontendFiles, rules: { 'no-restricted-imports': ['error', { patterns: ['**\/api/**'] }] } },
 *   ];
 *
 * Because the wrapped rule is then configured completely normally - under
 * its own real name, with no options round-tripped through anything of
 * ours - it behaves like ordinary ESLint config in every way: real ruleId,
 * real fixes, real `eslint-disable` comments, no wrapper in between.
 *
 * @param {string | string[]} patterns One or more glob patterns (see
 *   ../utils/glob-match.js for supported syntax), relative to `cwd`.
 * @param {object} options
 * @param {string} options.tag The JSDoc tag to filter on (e.g. "layer").
 * @param {string[]} [options.values] Allowed values for the tag. Omit to
 *   match any file that has the tag at all, regardless of its value.
 * @param {string} [options.cwd] Defaults to `process.cwd()`.
 * @param {string[]} [options.ignoreDirs] Extra directory names to prune
 *   while walking, in addition to `node_modules` and `.git`.
 * @returns {string[]} Matching files, as relative POSIX paths.
 */
function filesWithTag(patterns, options = {}) {
  const { tag, values, cwd = process.cwd(), ignoreDirs = [] } = options;

  if (!tag || typeof tag !== 'string') {
    throw new Error('filesWithTag requires a `tag` option naming the JSDoc tag to filter on.');
  }

  const patternList = Array.isArray(patterns) ? patterns : [patterns];
  if (patternList.length === 0) {
    throw new Error('filesWithTag requires at least one glob pattern.');
  }

  const ignoredDirs = new Set([...DEFAULT_IGNORED_DIRS, ...ignoreDirs]);
  const seen = new Set();
  const matched = [];

  for (const pattern of patternList) {
    const walkRoot = path.join(cwd, staticPrefix(pattern));
    const candidates = [];
    walk(walkRoot, cwd, ignoredDirs, candidates);

    const regex = globToRegExp(pattern);
    for (const rel of candidates) {
      if (seen.has(rel) || !regex.test(rel)) {
        continue;
      }
      seen.add(rel);

      const text = fs.readFileSync(path.join(cwd, rel), 'utf8');
      if (hasTag(text, tag, values)) {
        matched.push(rel);
      }
    }
  }

  return matched;
}

module.exports = filesWithTag;
