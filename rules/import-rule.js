const path = require('path');
const fs = require('fs');

function getTagsFromFile(filePath) {
  if (!fs.existsSync(filePath)) return {};
  const content = fs.readFileSync(filePath, 'utf8');
  const jsDocMatch = content.match(/\/\*\*([\s\S]*?)\*\//);
  if (!jsDocMatch) return {};
  const jsDoc = jsDocMatch[1];
  const tagRegex = /@(\w+)\s+([^\s\*]+)/g;
  const tags = {};
  let match;
  while ((match = tagRegex.exec(jsDoc)) !== null) {
    tags[match[1]] = match[2];
  }
  return tags;
}

module.exports = {
  meta: {
    type: 'problem',
    docs: {
      description: 'Enforce import boundaries based on file tags',
      category: 'Possible Errors',
      recommended: true,
    },
    schema: [
      {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            conditions: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  tag: { type: 'string' },
                  value: { type: 'string' },
                },
                required: ['tag', 'value'],
              },
            },
            shouldOnlyDependOn: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  tag: { type: 'string' },
                  value: { type: 'string' },
                },
                required: ['tag', 'value'],
              },
            },
          },
          required: ['conditions', 'shouldOnlyDependOn'],
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
    const jsDocComment = comments.find(comment => comment.type === 'Block' && comment.value.startsWith('*'));
    // Fallback: check raw source if JSDoc is at the very beginning but not captured by getAllComments (sometimes happens depending on parser)
    let jsDocText = jsDocComment ? jsDocComment.value : null;
    if (!jsDocText) {
        const fullSource = sourceCode.getText();
        const jsDocMatch = fullSource.match(/^\/\*\*([\s\S]*?)\*\//);
        if (jsDocMatch) {
            jsDocText = jsDocMatch[1];
        }
    }

    const currentFileTags = {};
    if (jsDocText) {
      const tagRegex = /@(\w+)\s+([^\s\*]+)/g;
      let match;
      while ((match = tagRegex.exec(jsDocText)) !== null) {
        currentFileTags[match[1]] = match[2];
      }
    }

    const applicableConditions = options.filter(option => {
      return option.conditions.every(condition => {
        return currentFileTags[condition.tag] === condition.value;
      });
    });

    if (applicableConditions.length === 0) {
      return {};
    }

    return {
      ImportDeclaration(node) {
        const importPath = node.source.value;
        if (!importPath.startsWith('.')) {
          // Skip non-relative imports for now or handle them if needed
          return;
        }

        const resolvedPath = path.resolve(path.dirname(filename), importPath);
        // We need to handle extensions since ESLint might be running on TS files but imports might not have extensions
        let finalPath = resolvedPath;
        if (!fs.existsSync(finalPath)) {
            const extensions = ['.ts', '.tsx', '.js', '.jsx'];
            for (const ext of extensions) {
                if (fs.existsSync(resolvedPath + ext)) {
                    finalPath = resolvedPath + ext;
                    break;
                }
                if (fs.existsSync(path.join(resolvedPath, 'index' + ext))) {
                    finalPath = path.join(resolvedPath, 'index' + ext);
                    break;
                }
            }
        }

        const importedTags = getTagsFromFile(finalPath);

        applicableConditions.forEach(condition => {
          const allowed = condition.shouldOnlyDependOn.some(allowedTag => {
            return importedTags[allowedTag.tag] === allowedTag.value;
          });

          if (!allowed) {
            context.report({
              node,
              message: `Import from "${importPath}" is not allowed. It must have tags: ${condition.shouldOnlyDependOn.map(t => `@${t.tag} ${t.value}`).join(' or ')}.`,
            });
          }
        });
      },
    };
  },
};
