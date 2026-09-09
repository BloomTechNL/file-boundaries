/**
 * A process-wide registry mapping names to live ESLint rule objects.
 *
 * `tag-scoped-rule` needs to apply an arbitrary wrapped rule, but ESLint 9's
 * flat config merges every rule's *options* through `structuredClone`
 * (node_modules/eslint/lib/config/flat-config-schema.js), which throws on
 * any value containing a function — and a rule object always carries a
 * `create` function. So the wrapped rule can never be passed through
 * `context.options`; it has to be registered here, outside of config
 * merging, and looked up by name at runtime instead.
 *
 * Registration happens once, in the user's `eslint.config.js`, before the
 * config array is built:
 *
 *   const fileBoundaries = require('eslint-plugin-file-boundaries');
 *   fileBoundaries.registerRule('no-restricted-imports', someRuleObject);
 *
 * and `tag-scoped-rule` is then configured with `rule: 'no-restricted-imports'`
 * (a plain string, which clones fine) instead of the rule object itself.
 */
const registry = new Map();

function registerRule(name, rule) {
  if (!name || typeof name !== 'string') {
    throw new Error('registerRule requires a string `name`.');
  }
  if (!rule || typeof rule.create !== 'function') {
    throw new Error('registerRule requires a real ESLint rule object (with a `create` function).');
  }
  registry.set(name, rule);
}

function getRule(name) {
  return registry.get(name);
}

module.exports = { registerRule, getRule };
