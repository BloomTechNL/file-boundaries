const extractTags = require('../utils/extract-tags');

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
    // The `rule` option holds a live rule object (a function-bearing value),
    // which can't be expressed as a JSON schema. We validate options by hand
    // in `create` instead. This also means tag-scoped-rule can only be
    // configured from a flat config file (`eslint.config.js`), not from a
    // JSON/YAML legacy config, since those can't carry a rule reference.
    schema: false,
  },
  create(context) {
    const options = context.options[0] || {};
    const { tag, values, rule, ruleOptions = [] } = options;

    if (!tag || typeof tag !== 'string') {
      throw new Error('tag-scoped-rule requires a `tag` option naming the JSDoc tag to filter on.');
    }
    if (!rule || typeof rule.create !== 'function') {
      throw new Error('tag-scoped-rule requires a `rule` option holding a real ESLint rule object (with a `create` function).');
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
