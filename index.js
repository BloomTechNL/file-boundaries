const taggingRule = require('./rules/tagging-rule');
const importRule = require('./rules/import-rule');

module.exports = {
  rules: {
    'tagging-rule': taggingRule,
    'import-rule': importRule,
  },
};
