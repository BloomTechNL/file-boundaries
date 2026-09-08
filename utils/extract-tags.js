const TAG_REGEX = /@(\w+)\s+([^\s\*]+)/g;

/**
 * Scans a file's JSDoc block comments for the first one that can be
 * interpreted as a "tags block": a block containing at least one of the
 * given tag names. Plain documentation blocks (e.g. `/** Does X. *\/`) and
 * blocks whose only "tags" are unrelated JSDoc annotations (e.g.
 * `@param`/`@returns`) don't count, even if they appear before the real
 * tags block.
 *
 * Mirrors the tags-block detection used by tagging-rule so both rules agree
 * on what counts as "the" tagging comment for a file.
 *
 * @param {import('eslint').SourceCode} sourceCode
 * @param {string[]} tagNames Tag names (without the `@`) to look for.
 * @returns {{
 *   tags: Record<string, string>,
 *   jsDocComment: object | undefined,
 *   jsDocAtTop: boolean,
 *   taggingComments: object[],
 * }}
 */
function extractTags(sourceCode, tagNames) {
  const comments = sourceCode.getAllComments();
  const jsDocComments = comments.filter(comment => comment.type === 'Block' && comment.value.startsWith('*'));

  const containsConfiguredTag = comment => {
    const tagRegex = new RegExp(TAG_REGEX);
    let match;
    while ((match = tagRegex.exec(comment.value)) !== null) {
      if (tagNames.includes(match[1])) {
        return true;
      }
    }
    return false;
  };

  const taggingComments = jsDocComments.filter(containsConfiguredTag);
  const jsDocComment = taggingComments[0];

  const tags = {};
  let jsDocAtTop = false;

  if (jsDocComment) {
    const tokensBefore = sourceCode.getTokensBefore(jsDocComment);
    jsDocAtTop = tokensBefore.length === 0;

    const tagRegex = new RegExp(TAG_REGEX);
    let match;
    while ((match = tagRegex.exec(jsDocComment.value)) !== null) {
      tags[match[1]] = match[2];
    }
  }

  return { tags, jsDocComment, jsDocAtTop, taggingComments };
}

module.exports = extractTags;
