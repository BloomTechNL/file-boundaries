const taggingRule = require('./rules/tagging-rule');
const filesWithTag = require('./utils/files-with-tag');

module.exports = {
  rules: {
    'tagging-rule': taggingRule,
  },
  filesWithTag,
};
