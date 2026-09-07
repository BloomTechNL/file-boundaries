const path = require('path');

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
    const comments = sourceCode.getAllComments();

    // Find all JSDoc comments
    const jsDocComments = comments.filter(comment => comment.type === 'Block' && comment.value.startsWith('*'));
    const jsDocComment = jsDocComments[0];

    const tagsInFile = {};
    let jsDocAtTop = false;

    if (jsDocComment) {
      // Check if it's at the top (ignoring shebang/comments before it if we want to be strict, 
      // but let's just check if there's any code before it)
      const tokensBefore = sourceCode.getTokensBefore(jsDocComment);
      jsDocAtTop = tokensBefore.length === 0;

      const tagRegex = /@(\w+)\s+([^\s\*]+)/g;
      let match;
      while ((match = tagRegex.exec(jsDocComment.value)) !== null) {
        tagsInFile[match[1]] = match[2];
      }
    }

    return {
      Program(node) {
        if (jsDocComment && !jsDocAtTop) {
            context.report({
                node: jsDocComment,
                message: 'JSDoc for tagging must be at the top of the file.',
            });
        }
        
        if (jsDocComments.length > 1) {
            // Check if subsequent JSDoc comments contain any of the tags we're looking for
            jsDocComments.slice(1).forEach(comment => {
                const tagRegex = /@(\w+)\s+([^\s\*]+)/g;
                let match;
                while ((match = tagRegex.exec(comment.value)) !== null) {
                    const tagName = match[1];
                    if (options.some(config => config.tag === tagName)) {
                        context.report({
                            node: comment,
                            message: 'JSDoc for tagging must be at the top of the file.',
                        });
                        break;
                    }
                }
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
