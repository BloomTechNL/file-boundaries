const assert = require('assert');
const { RuleTester } = require('eslint');
const rule = require('../rules/tag-scoped-rule');
const { registerRule } = require('../utils/rule-registry');

// Minimal fixture rules to wrap. Kept independent of any real ESLint/plugin
// rule so these tests don't depend on ESLint's internal rule set.
const noBadLiteral = {
  meta: {
    type: 'problem',
    fixable: 'code',
    schema: [],
  },
  create(context) {
    return {
      Literal(node) {
        if (node.value === 'bad') {
          context.report({
            node,
            message: 'Do not use "bad".',
            fix: fixer => fixer.replaceText(node, '"good"'),
          });
        }
      },
    };
  },
};

const noForbiddenWord = {
  meta: {
    type: 'problem',
    schema: [
      {
        type: 'object',
        properties: { word: { type: 'string' } },
        required: ['word'],
        additionalProperties: false,
      },
    ],
  },
  create(context) {
    const { word } = context.options[0];
    return {
      Literal(node) {
        if (node.value === word) {
          context.report({ node, message: `Do not use "${word}".` });
        }
      },
    };
  },
};

// The wrapped rule is looked up by name at runtime (see
// ../utils/rule-registry.js), so it must be registered before any test runs.
registerRule('no-bad-literal', noBadLiteral);
registerRule('no-forbidden-word', noForbiddenWord);

const ruleTester = new RuleTester({
  parserOptions: {
    ecmaVersion: 2015,
  },
});

ruleTester.run('tag-scoped-rule', rule, {
  valid: [
    {
      // No tag at all: the wrapped rule must not run, even though it would
      // otherwise report.
      code: '"bad";',
      options: [{ tag: 'layer', values: ['frontend'], rule: 'no-bad-literal' }],
    },
    {
      // Tag present, but its value isn't in the configured filter.
      code: '/** @layer api */\n"bad";',
      options: [{ tag: 'layer', values: ['frontend'], rule: 'no-bad-literal' }],
    },
    {
      // Matching tag, but the wrapped rule has nothing to report.
      code: '/** @layer frontend */\n"good";',
      options: [{ tag: 'layer', values: ['frontend'], rule: 'no-bad-literal' }],
    },
    {
      // No `values` filter means any value for the tag matches, but the
      // wrapped rule still only fires for its own inner options.
      code: '/** @layer frontend */\n"nope";',
      options: [{ tag: 'layer', rule: 'no-forbidden-word', ruleOptions: [{ word: 'other' }] }],
    },
  ],
  invalid: [
    {
      // Matching tag: the wrapped rule's report comes through, attributed
      // to tag-scoped-rule, with its fixer intact.
      code: '/** @layer frontend */\n"bad";',
      options: [{ tag: 'layer', values: ['frontend'], rule: 'no-bad-literal' }],
      errors: [{ message: 'Do not use "bad".' }],
      output: '/** @layer frontend */\n"good";',
    },
    {
      // No `values` filter: any value for the tag matches.
      code: '/** @layer anything */\n"bad";',
      options: [{ tag: 'layer', rule: 'no-bad-literal' }],
      errors: [{ message: 'Do not use "bad".' }],
      output: '/** @layer anything */\n"good";',
    },
    {
      // The wrapped rule receives `ruleOptions`, not tag-scoped-rule's own
      // options.
      code: '/** @layer frontend */\n"nope";',
      options: [{ tag: 'layer', values: ['frontend'], rule: 'no-forbidden-word', ruleOptions: [{ word: 'nope' }] }],
      errors: [{ message: 'Do not use "nope".' }],
    },
  ],
});

describe('tag-scoped-rule misconfiguration', () => {
  const stubContext = {
    options: [],
    getSourceCode: () => ({ getAllComments: () => [] }),
  };

  it('throws when `tag` is missing', () => {
    assert.throws(
      () => rule.create({ ...stubContext, options: [{ rule: 'no-bad-literal' }] }),
      /requires a `tag` option/
    );
  });

  it('throws when `rule` is missing', () => {
    assert.throws(
      () => rule.create({ ...stubContext, options: [{ tag: 'layer' }] }),
      /requires a `rule` option/
    );
  });

  it('throws when `rule` names a rule that was never registered', () => {
    assert.throws(
      () => rule.create({ ...stubContext, options: [{ tag: 'layer', rule: 'does-not-exist' }] }),
      /no rule is registered under the name "does-not-exist"/
    );
  });
});

describe('rule-registry', () => {
  it('throws when registering without a string name', () => {
    assert.throws(
      () => registerRule(undefined, noBadLiteral),
      /requires a string `name`/
    );
  });

  it('throws when registering a value that is not a real rule object', () => {
    assert.throws(
      () => registerRule('not-a-rule', {}),
      /requires a real ESLint rule object/
    );
  });
});
