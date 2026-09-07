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
    },
    {
        code: '/** @layer api */',
        filename: 'src/other/service.ts',
        options: [[{ tag: 'layer', values: ['api'], checkPath: 'none' }]],
    },
    {
        code: '/** @layer api */',
        filename: 'src/api/service.ts',
        options: [[{ tag: 'layer', values: ['api'], checkPath: 'strict' }]],
    },
    {
        code: '/** @layer api */\nconst x = 1;',
        options: [[{ tag: 'layer', values: ['api'] }]],
    },
    {
        code: '// comment before\n/** @layer api */',
        options: [[{ tag: 'layer', values: ['api'] }]],
    },
    {
        code: '/** @layer api */\n/** @other tag */',
        options: [[{ tag: 'layer', values: ['api'] }]],
    },
    {
        code: '/**\n * @layer api\n * @layer frontend\n */',
        options: [[{ tag: 'layer', values: ['api', 'frontend'] }]],
    },
    {
        code: '/** @layer api-v2 */',
        options: [[{ tag: 'layer', values: ['api-v2', 'frontend'] }]],
    },
    {
        code: '/**\n * @layer api\n * @subdomain ordering\n */',
        filename: 'src/api/ordering/service.ts',
        options: [[
            { tag: 'layer', values: ['api'], checkPath: 'consistent' },
            { tag: 'subdomain', values: ['ordering'], checkPath: 'strict' }
        ]],
    },
    {
        code: '/**\n * @layer frontend\n * @subdomain fulfillment\n */',
        filename: 'src/api/ordering/service.ts',
        options: [[
            { tag: 'layer', values: ['api', 'frontend'], checkPath: 'none' },
            { tag: 'subdomain', values: ['ordering', 'fulfillment'], checkPath: 'none' }
        ]],
    },
    {
        // "api" only appears in the file name, not the directory, so with
        // includeFileName: false the path check should not match at all.
        code: '/** @layer frontend */',
        filename: 'src/other/api-client.ts',
        options: [[{ tag: 'layer', values: ['api', 'frontend'], checkPath: { mode: 'consistent', includeFileName: false } }]],
    },
    {
        // A plain, tag-less JSDoc block anywhere in the file is not a tags
        // block, so it must not trigger the "must be at the top" check.
        code: 'function helper() {}\n\n/**\n * Does something unrelated, no tags here at all.\n */\nfunction other() {}',
        options: [[{ tag: 'layer', values: ['api'] }]],
    },
    {
        // Same, but the tagging JSDoc block is itself correctly at the top;
        // an unrelated JSDoc block later in the file must still be ignored.
        code: '/** @layer api */\nfunction helper() {}\n\n/**\n * Just documentation, no tags.\n */\nfunction other() {}',
        options: [[{ tag: 'layer', values: ['api'] }]],
    },
    {
        // An unrelated JSDoc block with JSDoc-style tags that aren't
        // configured (e.g. @param/@returns) must not be mistaken for a tags
        // block either.
        code: '/** @layer api */\nfunction helper() {}\n\n/**\n * @param {number} x\n * @returns {number}\n */\nfunction other(x) { return x; }',
        options: [[{ tag: 'layer', values: ['api'] }]],
    },
  ],
  invalid: [
    {
      code: '/** @layer api */',
      filename: 'src/api-v2/service.ts',
      options: [[{ tag: 'layer', values: ['api', 'api-v2'], checkPath: 'consistent' }]],
      errors: [{ message: 'Tag "@layer" must be "api-v2" because it is in the path.' }],
      output: '/** @layer api-v2 */',
    },
    {
      code: 'const x = 1;\n/** @layer api */',
      options: [[{ tag: 'layer', values: ['api'] }]],
      errors: [{ message: 'JSDoc for tagging must be at the top of the file.' }],
    },
    {
        code: '/* not jsdoc */\nconst x = 1;\n/** @layer api */',
        options: [[{ tag: 'layer', values: ['api'] }]],
        errors: [{ message: 'JSDoc for tagging must be at the top of the file.' }],
    },
    {
        code: '/** @layer api */\n/** @layer frontend */',
        options: [[{ tag: 'layer', values: ['api', 'frontend'] }]],
        errors: [{ message: 'JSDoc for tagging must be at the top of the file.' }],
    },
    {
        code: '/** @layer api */',
        filename: 'src/api-v2/service.ts',
        options: [[{ tag: 'layer', values: ['api', 'api-v2'], checkPath: 'strict' }]],
        errors: [{ message: 'Tag "@layer" must be "api-v2" because it is in the path.' }],
        output: '/** @layer api-v2 */',
    },
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
      options: [[{ tag: 'layer', values: ['api', 'frontend'], checkPath: 'consistent' }]],
      errors: [{ message: 'Tag "@layer" must be "api" because it is in the path.' }],
      output: '/** @layer api */',
    },
    {
        code: 'const x = 1;',
        filename: 'src/api/service.ts',
        options: [[{ tag: 'layer', values: ['api'], checkPath: 'consistent' }]],
        errors: [{ message: 'Tag "@layer" should be "api" because it is in the path.' }],
        output: '/**\n * @layer api\n */\nconst x = 1;',
    },
    {
        code: 'const x = 1;',
        filename: 'src/other/service.ts',
        options: [[{ tag: 'layer', values: ['api'], checkPath: 'strict' }]],
        errors: [{ message: 'Tag "@layer" must be present in the path. Allowed values: api.' }],
    },
    {
        code: '/**\n * @layer api\n * @subdomain fulfillment\n */',
        filename: 'src/api/ordering/service.ts',
        options: [[
            { tag: 'layer', values: ['api'], checkPath: 'consistent' },
            { tag: 'subdomain', values: ['ordering', 'fulfillment'], checkPath: 'consistent' }
        ]],
        errors: [{ message: 'Tag "@subdomain" must be "ordering" because it is in the path.' }],
        output: '/**\n * @layer api\n * @subdomain ordering\n */',
    },
    {
        code: '/**\n * @layer api\n * @subdomain ordering\n */',
        filename: 'src/api/other/service.ts',
        options: [[
            { tag: 'layer', values: ['api'], checkPath: 'strict' },
            { tag: 'subdomain', values: ['ordering'], checkPath: 'strict' }
        ]],
        errors: [{ message: 'Tag "@subdomain" must be present in the path. Allowed values: ordering.' }],
    },
    {
        // "api" is only in the file name, not the directory. With
        // includeFileName: false this must not count as a path match, so
        // strict mode reports the value as missing from the path.
        code: '/** @layer frontend */',
        filename: 'src/other/api-client.ts',
        options: [[{ tag: 'layer', values: ['api', 'frontend'], checkPath: { mode: 'strict', includeFileName: false } }]],
        errors: [{ message: 'Tag "@layer" must be present in the path. Allowed values: api, frontend.' }],
    },
    {
        // Directory does contain "api", so with includeFileName: false the
        // tag must be fixed to match, ignoring the unrelated file name.
        code: '/** @layer frontend */',
        filename: 'src/api/other-client.ts',
        options: [[{ tag: 'layer', values: ['api', 'frontend'], checkPath: { mode: 'consistent', includeFileName: false } }]],
        errors: [{ message: 'Tag "@layer" must be "api" because it is in the path.' }],
        output: '/** @layer api */',
    },
    {
        // A plain, tag-less JSDoc block doesn't affect the duplicate check:
        // only the second *tagging* block (the one containing @layer) must
        // be flagged, not the unrelated documentation block before it.
        code: '/** @layer api */\n\n/**\n * Just documentation, no tags.\n */\n\n/** @layer frontend */',
        options: [[{ tag: 'layer', values: ['api', 'frontend'] }]],
        errors: [{ message: 'JSDoc for tagging must be at the top of the file.' }],
    },
  ],
});
