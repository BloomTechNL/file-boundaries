const extractTags = require('../utils/extract-tags');
const { getRule } = require('../utils/rule-registry');

module.exports = {
  meta: {
    type: 'suggestion',
    docs: {
      description: 'Apply another ESLint rule only to files carrying a given JSDoc tag',
      category: 'Possible Errors',
      recommended: false,
    },
    // The wrapped rule is an arbitrary, possibly fixable/suggestion-producing
    // rule chosen at config time, but `fixable`/`hasSuggestions` must be
    // static on *this* rule's meta for ESLint to honor fixes/suggestions it
    // produces. We declare both unconditionally; they're simply unused when
    // the wrapped rule doesn't report any.
    fixable: 'code',
    hasSuggestions: true,
    schema: [
      {
        type: 'object',
        properties: {
          tag: { type: 'string' },
          values: {
            type: 'array',
            items: { type: 'string' },
          },
          // A name registered via `registerRule()`, not the rule object
          // itself: ESLint 9's flat config clones every rule's options with
          // `structuredClone`, which throws on anything carrying a function
          // (as any real rule object does, via its `create`). See
          // ../utils/rule-registry.js.
          rule: { type: 'string' },
          ruleOptions: { type: 'array' },
        },
        required: ['tag', 'rule'],
        additionalProperties: false,
      },
    ],
  },
  create(context) {
    const options = context.options[0] || {};
    const { tag, values, rule: ruleName, ruleOptions = [] } = options;

    if (!tag || typeof tag !== 'string') {
      throw new Error('tag-scoped-rule requires a `tag` option naming the JSDoc tag to filter on.');
    }
    if (!ruleName || typeof ruleName !== 'string') {
      throw new Error('tag-scoped-rule requires a `rule` option naming a rule registered via registerRule().');
    }

    const rule = getRule(ruleName);
    if (!rule || typeof rule.create !== 'function') {
      throw new Error(`tag-scoped-rule: no rule is registered under the name "${ruleName}". Call registerRule("${ruleName}", ruleObject) in your config before referencing it.`);
    }

    const sourceCode = context.getSourceCode();
    const { tags: tagsInFile } = extractTags(sourceCode, [tag]);
    const tagValue = tagsInFile[tag];
    const matches = tagValue !== undefined && (!values || values.includes(tagValue));

    if (!matches) {
      return {};
    }

    // The wrapped rule must see its own options, not tag-scoped-rule's.
    // Every other property/method on `context` (report, getFilename,
    // sourceCode, ...) is inherited unchanged. `context` itself is frozen,
    // and `options` is a non-writable inherited property, so a plain
    // assignment (or Object.assign) would throw in strict mode; defining a
    // fresh own property shadows it instead.
    const innerContext = Object.create(context);
    Object.defineProperty(innerContext, 'options', { value: ruleOptions, enumerable: true });

    return rule.create(innerContext);
  },
};
