const path = require('path');
const extractTags = require('../utils/extract-tags');

module.exports = {
  meta: {
    type: 'suggestion',
    docs: {
      description: 'Enforce file tagging via JSDoc',
      category: 'Possible Errors',
      recommended: true,
    },
    fixable: 'code',
    schema: [
      {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            tag: { type: 'string' },
            mandatory: { type: 'boolean' },
            checkPath: {
              oneOf: [
                { enum: ['none', 'consistent', 'strict'] },
                {
                  type: 'object',
                  properties: {
                    mode: { enum: ['consistent', 'strict'] },
                    includeFileName: { type: 'boolean' },
                  },
                  required: ['mode'],
                  additionalProperties: false,
                },
              ],
            },
            values: {
              type: 'array',
              items: { type: 'string' },
            },
          },
          required: ['tag', 'values'],
          additionalProperties: false,
        },
      },
    ],
  },
  create(context) {
    const options = context.options[0] || [];
    const filename = context.getFilename();
    const sourceCode = context.getSourceCode();

    const { tags: tagsInFile, jsDocComment, jsDocAtTop, taggingComments } = extractTags(
      sourceCode,
      options.map(config => config.tag)
    );

    return {
      Program(node) {
        if (jsDocComment && !jsDocAtTop) {
            context.report({
                node: jsDocComment,
                message: 'JSDoc for tagging must be at the top of the file.',
            });
        }

        if (taggingComments.length > 1) {
            // Any additional block that can also be interpreted as a tags
            // block (i.e. it contains one of the configured tags) is a
            // duplicate and must be flagged.
            taggingComments.slice(1).forEach(comment => {
                context.report({
                    node: comment,
                    message: 'JSDoc for tagging must be at the top of the file.',
                });
            });
        }

        options.forEach(config => {
          const { tag, mandatory, checkPath, values } = config;
          const value = tagsInFile[tag];

          // checkPath can be a plain string ('none' | 'consistent' | 'strict'),
          // or an object ({ mode, includeFileName }) when the file name itself
          // should be excluded from the path match.
          const checkPathMode = typeof checkPath === 'object' && checkPath !== null ? checkPath.mode : checkPath;
          const includeFileName = typeof checkPath === 'object' && checkPath !== null ? checkPath.includeFileName !== false : true;

          if (mandatory && !value) {
            context.report({
              node,
              message: `Tag "@${tag}" is mandatory.`,
            });
          }

          if (checkPathMode && checkPathMode !== 'none') {
            const pathToCheck = includeFileName ? filename : path.dirname(filename);
            const sortedValues = [...values].sort((a, b) => b.length - a.length);
            const pathValue = sortedValues.find(v => pathToCheck.includes(v));

            if (checkPathMode === 'strict' && !pathValue) {
              context.report({
                node,
                message: `Tag "@${tag}" must be present in the path. Allowed values: ${values.join(', ')}.`,
              });
            }

            if (pathValue) {
              if (value && value !== pathValue) {
                context.report({
                  node: jsDocComment ? {
                    type: 'Identifier',
                    loc: jsDocComment.loc,
                    range: jsDocComment.range
                  } : node,
                  message: `Tag "@${tag}" must be "${pathValue}" because it is in the path.`,
                  fix(fixer) {
                    if (jsDocComment) {
                      const tagRegex = new RegExp(`@${tag}\\s+([^\\s\\*]+)`);
                      const newValue = jsDocComment.value.replace(tagRegex, `@${tag} ${pathValue}`);
                      if (newValue !== jsDocComment.value) {
                        return fixer.replaceText(jsDocComment, `/*${newValue}*/`);
                      }
                    } else {
                        // If no JSDoc, we could potentially create one, but let's stick to updating existing
                    }
                  }
                });
              } else if (!value) {
                  context.report({
                      node,
                      message: `Tag "@${tag}" should be "${pathValue}" because it is in the path.`,
                      fix(fixer) {
                          if (jsDocComment) {
                              const lastTagIndex = jsDocComment.value.lastIndexOf('@');
                              let newValue;
                              if (lastTagIndex !== -1) {
                                  // Find end of last tag line
                                  const endOfLine = jsDocComment.value.indexOf('\n', lastTagIndex);
                                  if (endOfLine !== -1) {
                                      newValue = jsDocComment.value.slice(0, endOfLine) + `\n * @${tag} ${pathValue}` + jsDocComment.value.slice(endOfLine);
                                  } else {
                                      newValue = jsDocComment.value + `\n * @${tag} ${pathValue}`;
                                  }
                              } else {
                                  newValue = jsDocComment.value + `\n * @${tag} ${pathValue}`;
                              }
                              return fixer.replaceText(jsDocComment, `/*${newValue}*/`);
                          } else {
                              return fixer.insertTextBefore(node, `/**\n * @${tag} ${pathValue}\n */\n`);
                          }
                      }
                  });
              }
            }
          }

          if (value && !values.includes(value)) {
              context.report({
                  node: jsDocComment ? {
                      type: 'Identifier',
                      loc: jsDocComment.loc,
                      range: jsDocComment.range
                  } : node,
                  message: `Tag "@${tag}" has invalid value "${value}". Allowed values: ${values.join(', ')}.`,
              });
          }
        });
      },
    };
  },
};
