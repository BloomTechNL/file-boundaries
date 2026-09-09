const assert = require('assert');
const { globToRegExp, staticPrefix } = require('../utils/glob-match');

describe('globToRegExp', () => {
  const cases = [
    ['*.js', 'foo.js', true],
    ['*.js', 'dir/foo.js', false],
    ['**/*.js', 'foo.js', true],
    ['**/*.js', 'a/b/foo.js', true],
    ['src/**/*.ts', 'src/foo.ts', true],
    ['src/**/*.ts', 'src/a/b/foo.ts', true],
    ['src/**/*.ts', 'other/foo.ts', false],
    ['src/**', 'src/a/b/c.ts', true],
    ['src/**', 'other/c.ts', false],
    ['apps/*/src/**/*.{ts,tsx}', 'apps/foo/src/deep/bar.tsx', true],
    ['apps/*/src/**/*.{ts,tsx}', 'apps/foo/src/bar.ts', true],
    ['apps/*/src/**/*.{ts,tsx}', 'apps/foo/src/bar.js', false],
    ['apps/*/src/**/*.{ts,tsx}', 'apps/foo/bar/src/deep/bar.tsx', false],
    ['file?.js', 'file1.js', true],
    ['file?.js', 'file12.js', false],
    ['src/file.js', 'src/file.js', true],
    ['src/file.js', 'src/other.js', false],
  ];

  for (const [pattern, filePath, expected] of cases) {
    it(`${pattern} ${expected ? 'matches' : 'does not match'} ${filePath}`, () => {
      assert.strictEqual(globToRegExp(pattern).test(filePath), expected);
    });
  }
});

describe('staticPrefix', () => {
  it('returns the whole pattern when it has no glob metacharacters', () => {
    assert.strictEqual(staticPrefix('src/file.js'), 'src/file.js');
  });

  it('stops at the first segment containing a metacharacter', () => {
    assert.strictEqual(staticPrefix('src/**/*.ts'), 'src');
    assert.strictEqual(staticPrefix('apps/*/src/**/*.ts'), 'apps');
  });

  it('returns an empty string when the first segment is already a glob', () => {
    assert.strictEqual(staticPrefix('*.js'), '');
  });
});
