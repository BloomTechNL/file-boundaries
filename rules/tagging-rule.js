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
            valueInPath: { type: 'boolean' },
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

    // Find the first JSDoc comment that might contain our tags
    const jsDocComment = comments.find(comment => comment.type === 'Block' && comment.value.startsWith('*'));

    const tagsInFile = {};
    if (jsDocComment) {
      const tagRegex = /@(\w+)\s+([^\s\*]+)/g;
      let match;
      while ((match = tagRegex.exec(jsDocComment.value)) !== null) {
        tagsInFile[match[1]] = match[2];
      }
    }

    return {
      Program(node) {
        options.forEach(config => {
          const { tag, mandatory, valueInPath, values } = config;
          const value = tagsInFile[tag];

          if (mandatory && !value) {
            context.report({
              node,
              message: `Tag "@${tag}" is mandatory.`,
            });
          }

          if (valueInPath) {
            const pathValue = values.find(v => filename.includes(v));
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
                      const tagRegex = new RegExp(`@${tag}\\s+([\\w-]+)`);
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
