# eslint-plugin-file-boundaries

Enforce multi-dimensional, file-level boundaries using JSDoc tags — and keep those tags consistent with your file paths.

## Philosophy

File hierarchy alone is often insufficient for defining boundaries in a complex codebase, because it only allows differentiation along one axis (the folder structure) and forces every file sharing a boundary to physically live under the same directory. `eslint-plugin-file-boundaries` taps into JSDoc annotations instead, which gives you two things directory structure alone can't:

- **Multi-dimensional tagging.** A file can be tagged along several independent axes at once (e.g. `@layer` and `@subdomain`), so you can enforce architectural layers and subdomain boundaries simultaneously, without needing a folder for every combination of the two.
- **Boundaries at the file level, independent of directory structure.** A tag travels with the file itself, not with whatever folder it happens to sit in. That means a single file can carry its own boundary even while living alongside files with a different boundary in the same folder — no reorganizing directories required.

Where the two *do* align — most codebases mirror layers or subdomains in folders — `checkPath` keeps the tag and the path in sync automatically (and can auto-fix drift). That guarantee is useful beyond this plugin: once a tag can't silently drift from the path it's supposed to reflect, any other tool — a custom ESLint rule, a dependency-cruiser config, a codeowners generator, an LLM — can treat the JSDoc tag as ground truth without re-implementing your path-matching rules or worrying they've gone stale.

Example of a tagged file:

```typescript
/**
 * @layer api
 * @subdomain ordering
 */
export const myService = {};
```

### File-level boundaries without mirroring folders

Two files can live in the very same folder yet belong to different layers — no directory reshuffling required:

```typescript
// src/shared/formatCurrency.ts
/**
 * @layer frontend
 */
export function formatCurrency(amount: number) {
  /* ... */
}
```

```typescript
// src/shared/hashPassword.ts
/**
 * @layer api
 */
export function hashPassword(password: string) {
  /* ... */
}
```

Both files sit under `src/shared/`, but each still carries its own, independently enforced `@layer` tag — the boundary lives on the file, not on the folder.

### Keeping tags and paths consistent for other tooling

When most of your codebase *does* follow a `src/<layer>/...` convention, enable `checkPath` so the tag can never silently drift from the folder it's declared to represent:

```javascript
"file-boundaries/tagging-rule": ["error", [
  {
    "tag": "layer",
    "mandatory": true,
    "checkPath": "strict",
    "values": ["api", "frontend"]
  }
]]
```

With this in place, `src/api/orders.ts` is guaranteed to always carry `@layer api` — the rule reports, and can `--fix`, any mismatch. Because that guarantee holds, other tooling can trust the tag without knowing anything about your folder layout, e.g. a standalone script unrelated to this plugin:

```javascript
const isFrontendFile = (source) => /@layer\s+frontend\b/.test(source);
```

This lets other tools or lint rules answer "is this file frontend code?" straight from the tag, instead of re-deriving their own path-matching logic — and it stays correct even for the file-level exceptions described above, which `checkPath` deliberately leaves untouched.

## Installation

```bash
npm install eslint-plugin-file-boundaries --save-dev
```

Add it to your `eslint.config.js`:

```javascript
const fileBoundaries = require("eslint-plugin-file-boundaries");

module.exports = [
  {
    plugins: {
      "file-boundaries": fileBoundaries,
    },
    rules: {
      "file-boundaries/tagging-rule": ["error", [
        {
          "tag": "layer",
          "mandatory": true,
          "values": ["api", "frontend", "composition-root"]
        },
        {
          "tag": "subdomain",
          "checkPath": "consistent",
          "values": ["ordering", "fulfillment", "inventory"]
        }
      ]]
    }
  }
];
```

## Rules

### `tagging-rule`

Ensures that files are correctly tagged using JSDoc. The JSDoc block containing the tags must be at the top of the file.

#### Configuration

An array of objects with the following properties:

- `tag`: The name of the JSDoc tag (e.g., `layer`).
- `values`: An array of allowed values for this tag.
- `mandatory` (optional, default `false`): If `true`, every file must have this tag.
- `checkPath` (optional, default `none`): Either a string, or an object for more control over what part of the path is matched.
  - `'none'`: Ignore the file path.
  - `'consistent'`: If one of the `values` is present as a substring in the file's path, the file *must* have that value for the tag. This is auto-fixable with `--fix`.
  - `'strict'`: Same as `consistent`, but also requires that one of the `values` *must* be present in the path.
  - `{ mode: 'consistent' | 'strict', includeFileName?: boolean }`: Same as the string forms above, but lets you control whether the match considers the full path (including the file name) or only the directory portion.
    - `includeFileName: true` (default): Match against the full path, e.g. `src/api/service.ts`.
    - `includeFileName: false`: Match against only the directory, e.g. `src/api`. Use this if a `values` entry could also appear inside a file name (e.g. a value `"api"` shouldn't match a file named `api-client.ts` in an unrelated folder).

### `tag-scoped-rule`

Applies *any other* ESLint rule, but only to files that carry a given JSDoc tag (as read by the same tag-detection logic as `tagging-rule`). Useful for rules that should only apply to one boundary — e.g. banning a dependency only inside `@layer frontend` files — without needing a folder-based `files: [...]` override, since the tag isn't tied to where the file lives.

The wrapped rule must be registered up front via `registerRule(name, rule)`, exported from this package, and then referenced by that name string. It cannot be passed directly as a rule option: ESLint 9's flat config merges every rule's options through `structuredClone`, which throws on any value containing a function — and a rule object always carries one (its `create`). Because registration is a plain function call (not something ESLint's config merging touches), `tag-scoped-rule` only works from a flat config file (`eslint.config.js`), not from a legacy `.eslintrc` JSON/YAML config.

#### Configuration

A single object with the following properties:

- `tag`: The name of the JSDoc tag to filter on (e.g., `layer`).
- `rule`: The name a wrapped rule was registered under via `registerRule()` (see below).
- `values` (optional): An array of allowed values for the tag. If omitted, any file that has the tag at all matches, regardless of its value.
- `ruleOptions` (optional, default `[]`): The options array to pass to the wrapped rule, exactly as you'd write it in its own `rules` entry.

```javascript
const fileBoundaries = require("eslint-plugin-file-boundaries");
const noRestrictedImports = require("eslint/use-at-your-own-risk").builtinRules.get("no-restricted-imports");

fileBoundaries.registerRule("no-restricted-imports", noRestrictedImports);

module.exports = [
  {
    plugins: {
      "file-boundaries": fileBoundaries,
    },
    rules: {
      "file-boundaries/tag-scoped-rule": ["error", {
        "tag": "layer",
        "values": ["frontend"],
        "rule": "no-restricted-imports",
        "ruleOptions": [{ "patterns": ["**/api/**"] }]
      }]
    }
  }
];
```

With this config, only files tagged `@layer frontend` are checked against the `no-restricted-imports` rule; every other file is left alone, no matter where it lives on disk.

Note that any errors it reports are attributed to `file-boundaries/tag-scoped-rule` rather than the wrapped rule's own name, since ESLint attributes reports to whichever configured rule produced them.

#### Disable comments

Despite that attribution, `// eslint-disable-line`, `// eslint-disable-next-line`, and `/* eslint-disable */`/`/* eslint-enable */` block comments naming the *wrapped* rule (e.g. `no-restricted-imports`, as registered) still suppress its reports — `tag-scoped-rule` checks for these itself before reporting, since ESLint's own disable-comment handling only ever sees `file-boundaries/tag-scoped-rule` and wouldn't otherwise recognize a comment naming the rule it wraps.

One side effect: if you have `reportUnusedDisableDirectives` enabled, ESLint will flag such a comment as unused (since, from ESLint's own bookkeeping, no problem was ever reported under that name) even though it did suppress something. This is a (non-fatal, warning-level) false positive rather than a sign the comment didn't work.

