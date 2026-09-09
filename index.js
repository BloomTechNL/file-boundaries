const taggingRule = require('./rules/tagging-rule');
const tagScopedRule = require('./rules/tag-scoped-rule');
const { registerRule } = require('./utils/rule-registry');

module.exports = {
  rules: {
    'tagging-rule': taggingRule,
    'tag-scoped-rule': tagScopedRule,
  },
  registerRule,
};
