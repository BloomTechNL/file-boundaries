const taggingRule = require('./rules/tagging-rule');
const tagScopedRule = require('./rules/tag-scoped-rule');

module.exports = {
  rules: {
    'tagging-rule': taggingRule,
    'tag-scoped-rule': tagScopedRule,
  },
};
