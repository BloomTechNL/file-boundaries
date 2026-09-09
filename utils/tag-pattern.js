/**
 * Shared by utils/extract-tags.js (the authoritative, AST-comment-based
 * extraction used by tagging-rule) and utils/files-with-tag.js (a raw-text
 * prescan used only to build a `files:` list before ESLint even runs). Both
 * need to agree on what counts as a tag, so this lives in one place rather
 * than being duplicated and risking drift.
 */
const TAG_REGEX = /@(\w+)\s+([^\s*]+)/g;

module.exports = { TAG_REGEX };
