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

### `filesWithTag`

Finds the files whose content carries a given JSDoc tag (as read by the same tag-detection logic as `tagging-rule`), for use as a flat config block's `files:` list. Useful for scoping *any other* ESLint rule to one boundary — e.g. banning a dependency only inside `@layer frontend` files — without needing that boundary to line up with a folder, since the tag isn't tied to where the file lives.

Unlike the rules above, `filesWithTag` isn't an ESLint rule at all — it's a plain function, exported from this package, that you call directly in `eslint.config.js` to compute a `files:` array before ESLint even starts linting:

```javascript
const fileBoundaries = require("eslint-plugin-file-boundaries");

const frontendFiles = fileBoundaries.filesWithTag("src/**/*.{js,ts}", {
  tag: "layer",
  values: ["frontend"],
});

module.exports = [
  {
    files: frontendFiles,
    rules: {
      "no-restricted-imports": ["error", { patterns: ["**/api/**"] }],
    },
  },
];
```

With this config, only files tagged `@layer frontend` are checked against `no-restricted-imports`; every other file is left alone, no matter where it lives on disk. `no-restricted-imports` is otherwise configured completely normally — same as any other flat config block — because `filesWithTag` only ever computes a plain array of file paths; nothing about the rule you're scoping is touched. That means it behaves exactly like ordinary ESLint config in every way that matters: reports show up under its real name, its own fixes and suggestions work, and any `eslint-disable` comment naming it (in its usual, unnamespaced form) just works, because ESLint never even knows a tag was involved in selecting this file.

#### Configuration

- `patterns`: A glob pattern, or array of them, of candidate files (relative to `cwd`). Supports `*`, `**`, `?`, and `{a,b,c}` alternation — not character classes or extglobs.
- `tag`: The name of the JSDoc tag to filter on (e.g., `layer`).
- `values` (optional): An array of allowed values for the tag. If omitted, any file that has the tag at all matches, regardless of its value.
- `cwd` (optional, default `process.cwd()`): Base directory patterns are resolved against; returned paths are relative to it.
- `ignoreDirs` (optional, default `[]`): Extra directory names to skip while walking, in addition to `node_modules` and `.git`.

Returns an array of matching files as relative POSIX paths, ready to hand straight to a config block's `files:`.

