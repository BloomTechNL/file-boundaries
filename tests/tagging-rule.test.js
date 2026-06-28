const { RuleTester } = require('eslint');
const rule = require('../rules/tagging-rule');

const ruleTester = new RuleTester({
  parserOptions: {
    ecmaVersion: 2015,
  },
});

ruleTester.run('tagging-rule', rule, {
  valid: [
    {
      code: '/** @layer api */',
      options: [[{ tag: 'layer', values: ['api', 'frontend'] }]],
    },
    {
      code: '/** @layer api\n * @subdomain ordering */',
      options: [[
        { tag: 'layer', values: ['api'] },
        { tag: 'subdomain', values: ['ordering'] }
      ]],
    },
    {
        code: '// No JSDoc, but layer is not mandatory\nconst x = 1;',
        options: [[{ tag: 'layer', values: ['api'] }]],
    }
  ],
  invalid: [
    {
      code: '/** @layer unknown */',
      options: [[{ tag: 'layer', values: ['api'] }]],
      errors: [{ message: 'Tag "@layer" has invalid value "unknown". Allowed values: api.' }],
    },
    {
      code: 'const x = 1;',
      options: [[{ tag: 'layer', values: ['api'], mandatory: true }]],
      errors: [{ message: 'Tag "@layer" is mandatory.' }],
    },
    {
      code: '/** @layer frontend */',
      filename: 'src/api/service.ts',
      options: [[{ tag: 'layer', values: ['api', 'frontend'], valueInPath: true }]],
      errors: [{ message: 'Tag "@layer" must be "api" because it is in the path.' }],
      output: '/** @layer api */',
    },
    {
        code: 'const x = 1;',
        filename: 'src/api/service.ts',
        options: [[{ tag: 'layer', values: ['api'], valueInPath: true }]],
        errors: [{ message: 'Tag "@layer" should be "api" because it is in the path.' }],
        output: '/**\n * @layer api\n */\nconst x = 1;',
    }
  ],
});
