const fs = require('fs');
const path = require('path');

const EXTENSIONS = ['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs'];

/**
 * Resolves a relative import specifier (e.g. "./foo") to a file on disk,
 * the same way an extensionless import ultimately resolves at runtime: the
 * exact path, then the path with a common extension appended, then an index
 * file inside it. Used by import-rule to find the file whose tags it needs
 * to check against - this isn't a full module resolver (no package.json
 * "exports", no node_modules lookup), just enough to follow the relative
 * imports this plugin's boundaries actually apply to.
 *
 * @param {string} fromFile Absolute path of the file containing the import.
 * @param {string} importPath The import specifier, e.g. "./foo".
 * @returns {string | null} Absolute path of the resolved file, or null if
 *   nothing on disk matches.
 */
function resolveRelativeImport(fromFile, importPath) {
  const base = path.resolve(path.dirname(fromFile), importPath);
  const candidates = [
    base,
    ...EXTENSIONS.map(ext => base + ext),
    ...EXTENSIONS.map(ext => path.join(base, `index${ext}`)),
  ];

  for (const candidate of candidates) {
    try {
      if (fs.statSync(candidate).isFile()) {
        return candidate;
      }
    } catch {
      // Doesn't exist - try the next candidate.
    }
  }

  return null;
}

module.exports = resolveRelativeImport;
