const fs = require('fs');
const extractTags = require('../utils/extract-tags');
const { getTagsFromText } = require('../utils/tags-from-text');
const resolveRelativeImport = require('../utils/resolve-relative-import');

const tagValues = {
  type: 'array',
  items: { type: 'string' },
  minItems: 1,
};

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
            tag: { type: 'string' },
            cannotImport: tagValues,
            canOnlyImport: tagValues,
          },
          required: ['tag'],
          oneOf: [
            { required: ['cannotImport'] },
            { required: ['canOnlyImport'] },
          ],
          additionalProperties: false,
        },
      },
    ],
  },
  create(context) {
    const options = context.options[0] || [];
    const filename = context.getFilename();
    const sourceCode = context.getSourceCode();
    const configuredTags = options.map(config => config.tag);

    const { tags: tagsInFile } = extractTags(sourceCode, configuredTags);

    function checkImport(node, importPath) {
      if (!importPath.startsWith('.')) {
        // Only relative imports point at files this plugin can tag; bare
        // specifiers are packages, not subject to these boundaries.
        return;
      }

      const resolved = resolveRelativeImport(filename, importPath);
      if (!resolved) {
        return;
      }

      let importedText;
      try {
        importedText = fs.readFileSync(resolved, 'utf8');
      } catch {
        return;
      }

      const importedTags = getTagsFromText(importedText, configuredTags);

      options.forEach(config => {
        const { tag, cannotImport, canOnlyImport } = config;
        const importedValue = importedTags[tag];

        if (cannotImport && importedValue && cannotImport.includes(importedValue)) {
          context.report({
            node,
            message: `Cannot import "${importPath}": files with "@${tag} ${importedValue}" cannot be imported here.`,
          });
        }

        if (canOnlyImport) {
          // Inclusion only constrains files that carry the tag themselves -
          // an untagged subject file is left alone.
          const subjectValue = tagsInFile[tag];
          if (!subjectValue) {
            return;
          }

          // An import that isn't tagged at all doesn't violate the
          // whitelist either - only a tag value outside it does.
          if (importedValue && !canOnlyImport.includes(importedValue)) {
            context.report({
              node,
              message: `Cannot import "${importPath}": files tagged "@${tag}" can only import files with "@${tag}" in ${canOnlyImport.join(', ')}, but this one has "${importedValue}".`,
            });
          }
        }
      });
    }

    return {
      ImportDeclaration(node) {
        checkImport(node, node.source.value);
      },
      ExportNamedDeclaration(node) {
        if (node.source) {
          checkImport(node, node.source.value);
        }
      },
      ExportAllDeclaration(node) {
        checkImport(node, node.source.value);
      },
    };
  },
};
