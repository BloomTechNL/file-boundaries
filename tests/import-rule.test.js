const { RuleTester } = require('eslint');
const rule = require('../rules/import-rule');
const fs = require('fs');
const path = require('path');

// Helper to create temporary files for testing imports
function createTempFile(filePath, content) {
    const fullPath = path.resolve(__dirname, filePath);
    const dir = path.dirname(fullPath);
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(fullPath, content);
}

// Ensure the directory exists
const tempDir = path.resolve(__dirname, 'temp');
if (!fs.existsSync(tempDir)) {
    fs.mkdirSync(tempDir);
}

createTempFile('temp/api.js', '/** @layer api */\nexport const api = 1;');
createTempFile('temp/db.js', '/** @layer db */\nexport const db = 1;');
createTempFile('temp/frontend.js', '/** @layer frontend */\nimport { api } from "./api.js";');

const ruleTester = new RuleTester({
  parserOptions: {
    ecmaVersion: 2015,
    sourceType: 'module',
  },
});

ruleTester.run('import-rule', rule, {
  valid: [
    {
      code: '/** @layer frontend */\nimport { api } from "./api.js";',
      filename: path.resolve(__dirname, 'temp/frontend.js'),
      options: [[
        {
          conditions: [{ tag: 'layer', value: 'frontend' }],
          shouldOnlyDependOn: [{ tag: 'layer', value: 'api' }]
        }
      ]],
    },
    {
        code: '/** @layer other */\nimport { other } from "./other.js";',
        filename: path.resolve(__dirname, 'temp/other.js'),
        options: [[
          {
            conditions: [{ tag: 'layer', value: 'frontend' }],
            shouldOnlyDependOn: [{ tag: 'layer', value: 'api' }]
          }
        ]],
      }
  ],
  invalid: [
    {
      code: '/** @layer frontend */\nimport { db } from "./db.js";',
      filename: path.resolve(__dirname, 'temp/frontend.js'),
      options: [[
        {
          conditions: [{ tag: 'layer', value: 'frontend' }],
          shouldOnlyDependOn: [{ tag: 'layer', value: 'api' }]
        }
      ]],
      errors: [{ message: 'Import from "./db.js" is not allowed. It must have tags: @layer api.' }],
    },
  ],
});
