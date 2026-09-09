const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const filesWithTag = require('../utils/files-with-tag');

function writeFixture(root, relPath, content) {
  const full = path.join(root, relPath);
  fs.mkdirSync(path.dirname(full), { recursive: true });
  fs.writeFileSync(full, content);
}

describe('filesWithTag', () => {
  let cwd;

  beforeEach(() => {
    cwd = fs.mkdtempSync(path.join(os.tmpdir(), 'files-with-tag-'));
  });

  afterEach(() => {
    fs.rmSync(cwd, { recursive: true, force: true });
  });

  it('finds files under a glob whose leading comment carries the tag', () => {
    writeFixture(cwd, 'src/a.js', '/** @layer frontend */\n"a";');
    writeFixture(cwd, 'src/b.js', '/** @layer api */\n"b";');
    writeFixture(cwd, 'src/c.js', '"c"; // no tag at all');

    const result = filesWithTag('src/**/*.js', { tag: 'layer', values: ['frontend'], cwd });

    assert.deepStrictEqual(result, ['src/a.js']);
  });

  it('matches any value for the tag when `values` is omitted', () => {
    writeFixture(cwd, 'src/a.js', '/** @layer frontend */\n"a";');
    writeFixture(cwd, 'src/b.js', '/** @layer api */\n"b";');
    writeFixture(cwd, 'src/c.js', '"c";');

    const result = filesWithTag('src/**/*.js', { tag: 'layer', cwd });

    assert.deepStrictEqual(result.sort(), ['src/a.js', 'src/b.js']);
  });

  it('ignores node_modules and .git by default', () => {
    writeFixture(cwd, 'src/a.js', '/** @layer frontend */\n"a";');
    writeFixture(cwd, 'node_modules/dep/index.js', '/** @layer frontend */\n"dep";');
    writeFixture(cwd, '.git/hooks/x.js', '/** @layer frontend */\n"hook";');

    const result = filesWithTag('**/*.js', { tag: 'layer', values: ['frontend'], cwd });

    assert.deepStrictEqual(result, ['src/a.js']);
  });

  it('respects extra ignoreDirs', () => {
    writeFixture(cwd, 'src/a.js', '/** @layer frontend */\n"a";');
    writeFixture(cwd, 'dist/a.js', '/** @layer frontend */\n"a";');

    const result = filesWithTag('**/*.js', { tag: 'layer', values: ['frontend'], cwd, ignoreDirs: ['dist'] });

    assert.deepStrictEqual(result, ['src/a.js']);
  });

  it('accepts multiple patterns without double-counting overlaps', () => {
    writeFixture(cwd, 'src/a.js', '/** @layer frontend */\n"a";');

    const result = filesWithTag(['src/**/*.js', 'src/a.js'], { tag: 'layer', cwd });

    assert.deepStrictEqual(result, ['src/a.js']);
  });

  it('returns an empty array when a pattern matches no directory at all', () => {
    writeFixture(cwd, 'src/a.js', '/** @layer frontend */\n"a";');

    const result = filesWithTag('nonexistent/**/*.js', { tag: 'layer', cwd });

    assert.deepStrictEqual(result, []);
  });

  it('throws without a `tag` option', () => {
    assert.throws(() => filesWithTag('src/**/*.js', { cwd }), /requires a `tag` option/);
  });

  it('throws with an empty patterns array', () => {
    assert.throws(() => filesWithTag([], { tag: 'layer', cwd }), /requires at least one glob pattern/);
  });
});
