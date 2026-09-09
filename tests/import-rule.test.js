const assert = require('assert');
const { RuleTester } = require('eslint');
const fs = require('fs');
const os = require('os');
const path = require('path');
const rule = require('../rules/import-rule');

// Fixtures live under a private os.tmpdir() directory (like
// files-with-tag.test.js) rather than under tests/, so mocha's own
// `tests/**/*.js` glob never tries to require them as test files.
const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'import-rule-'));

function createFixture(relPath, content) {
  const fullPath = path.resolve(tempDir, relPath);
  fs.mkdirSync(path.dirname(fullPath), { recursive: true });
  fs.writeFileSync(fullPath, content);
}

createFixture('api.js', '/** @layer api */\nexport const api = 1;');
createFixture('db.js', '/** @layer db */\nexport const db = 1;');
createFixture('shared.js', '/** @layer shared */\nexport const shared = 1;');
createFixture('untagged.js', 'export const untagged = 1;');

after(() => {
  fs.rmSync(tempDir, { recursive: true, force: true });
});

const ruleTester = new RuleTester({
  parserOptions: {
    ecmaVersion: 2015,
    sourceType: 'module',
  },
});

ruleTester.run('import-rule', rule, {
  valid: [
    {
      // cannotImport: importing a file whose tag isn't in the list is fine.
      code: 'import { api } from "./api.js";',
      filename: path.resolve(tempDir, 'frontend.js'),
      options: [[{ tag: 'layer', cannotImport: ['db'] }]],
    },
    {
      // cannotImport: an untagged import is never forbidden.
      code: 'import { untagged } from "./untagged.js";',
      filename: path.resolve(tempDir, 'frontend.js'),
      options: [[{ tag: 'layer', cannotImport: ['db'] }]],
    },
    {
      // cannotImport: bare specifiers (packages) are out of scope.
      code: 'import { thing } from "some-package";',
      filename: path.resolve(tempDir, 'frontend.js'),
      options: [[{ tag: 'layer', cannotImport: ['db'] }]],
    },
    {
      // canOnlyImport: only constrains subject files that carry the tag -
      // this one doesn't, so the disallowed import is left alone.
      code: '/** @other tag */\nimport { db } from "./db.js";',
      filename: path.resolve(tempDir, 'frontend.js'),
      options: [[{ tag: 'layer', canOnlyImport: ['api'] }]],
    },
    {
      // canOnlyImport: subject is tagged, but the import is untagged, so it
      // doesn't violate the whitelist.
      code: '/** @layer frontend */\nimport { untagged } from "./untagged.js";',
      filename: path.resolve(tempDir, 'frontend.js'),
      options: [[{ tag: 'layer', canOnlyImport: ['api'] }]],
    },
    {
      // canOnlyImport: import's tag is in the allowed list.
      code: '/** @layer frontend */\nimport { api } from "./api.js";',
      filename: path.resolve(tempDir, 'frontend.js'),
      options: [[{ tag: 'layer', canOnlyImport: ['api', 'shared'] }]],
    },
    {
      // Re-exports are checked the same way, and pass when allowed.
      code: '/** @layer frontend */\nexport { api } from "./api.js";',
      filename: path.resolve(tempDir, 'frontend.js'),
      options: [[{ tag: 'layer', canOnlyImport: ['api'] }]],
    },
  ],
  invalid: [
    {
      // cannotImport: importing a file tagged with a forbidden value.
      code: 'import { db } from "./db.js";',
      filename: path.resolve(tempDir, 'frontend.js'),
      options: [[{ tag: 'layer', cannotImport: ['db'] }]],
      errors: [{ message: 'Cannot import "./db.js": files with "@layer db" cannot be imported here.' }],
    },
    {
      // canOnlyImport: subject is tagged and the import's tag isn't allowed.
      code: '/** @layer frontend */\nimport { db } from "./db.js";',
      filename: path.resolve(tempDir, 'frontend.js'),
      options: [[{ tag: 'layer', canOnlyImport: ['api'] }]],
      errors: [{ message: 'Cannot import "./db.js": files tagged "@layer" can only import files with "@layer" in api, but this one has "db".' }],
    },
    {
      // export ... from is checked just like import.
      code: '/** @layer frontend */\nexport { db } from "./db.js";',
      filename: path.resolve(tempDir, 'frontend.js'),
      options: [[{ tag: 'layer', canOnlyImport: ['api'] }]],
      errors: [{ message: 'Cannot import "./db.js": files tagged "@layer" can only import files with "@layer" in api, but this one has "db".' }],
    },
    {
      // export * from is checked just like import.
      code: '/** @layer frontend */\nexport * from "./db.js";',
      filename: path.resolve(tempDir, 'frontend.js'),
      options: [[{ tag: 'layer', canOnlyImport: ['api'] }]],
      errors: [{ message: 'Cannot import "./db.js": files tagged "@layer" can only import files with "@layer" in api, but this one has "db".' }],
    },
  ],
});

describe('import-rule schema', () => {
  // Schema validation of a rule's own config only happens synchronously for
  // flat config (eslintrc-style `Linter#verify` skips it, and RuleTester
  // only surfaces it later, as its own deferred mocha `it`), so exercise it
  // through a minimal flat config directly.
  const { Linter } = require('eslint');

  function lint(options) {
    const linter = new Linter({ configType: 'flat' });
    // A plain relative filename - flat config's default `files` matching
    // doesn't apply to a path outside the process cwd, which an absolute
    // tempDir path would be.
    return linter.verify('import { x } from "./x.js";', {
      languageOptions: { ecmaVersion: 2015, sourceType: 'module' },
      plugins: { fb: { rules: { 'import-rule': rule } } },
      rules: { 'fb/import-rule': ['error', options] },
    }, { filename: 'subject.js' });
  }

  it('rejects a config entry with neither cannotImport nor canOnlyImport', () => {
    assert.throws(() => lint([{ tag: 'layer' }]), /should have required property/);
  });

  it('rejects a config entry with both cannotImport and canOnlyImport', () => {
    assert.throws(
      () => lint([{ tag: 'layer', cannotImport: ['db'], canOnlyImport: ['api'] }]),
      /should match exactly one schema/
    );
  });

  it('accepts a config entry with exactly one of them', () => {
    assert.doesNotThrow(() => lint([{ tag: 'layer', cannotImport: ['db'] }]));
  });
});
