const taggingRule = require('./rules/tagging-rule');
const importRule = require('./rules/import-rule');
const filesWithTag = require('./utils/files-with-tag');

module.exports = {
  rules: {
    'tagging-rule': taggingRule,
    'import-rule': importRule,
  },
  filesWithTag,
};
