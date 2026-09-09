const { TAG_REGEX } = require('./tag-pattern');

const BLOCK_COMMENT_RE = /\/\*\*([\s\S]*?)\*\//gu;

/**
 * Raw-text equivalent of extract-tags.js's extractTags, for reading tags off
 * a file that isn't necessarily the one ESLint is currently linting (an
 * imported file, for import-rule; a candidate file, for filesWithTag) - so
 * there's no SourceCode/AST to walk, just the file's text. Mirrors
 * extractTags' "first block comment naming one of the given tags wins"
 * behavior so all three call sites stay in agreement about what counts as
 * "the" tags block for a file.
 *
 * @param {string} text
 * @param {string[]} tagNames Tag names (without the `@`) to look for.
 * @returns {Record<string, string>}
 */
function getTagsFromText(text, tagNames) {
  BLOCK_COMMENT_RE.lastIndex = 0;
  let blockMatch;

  while ((blockMatch = BLOCK_COMMENT_RE.exec(text)) !== null) {
    const tagRegex = new RegExp(TAG_REGEX);
    const tagsInBlock = {};
    let tagMatch;
    let containsConfiguredTag = false;

    while ((tagMatch = tagRegex.exec(blockMatch[1])) !== null) {
      tagsInBlock[tagMatch[1]] = tagMatch[2];
      if (tagNames.includes(tagMatch[1])) {
        containsConfiguredTag = true;
      }
    }

    if (containsConfiguredTag) {
      return tagsInBlock;
    }
  }

  return {};
}

module.exports = { getTagsFromText };
