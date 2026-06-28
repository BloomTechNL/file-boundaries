# eslint-plugin-file-boundaries

Enforce multi-dimensional boundaries between files using JSDoc tags.

## Philosophy

File hierarchy alone is often insufficient for defining boundaries in a complex codebase because it only allows differentiation along one axis (the folder structure). `eslint-plugin-file-boundaries` taps into JSDoc annotations to allow multi-dimensional tagging of files, helping you enforce strict architectural layers and subdomain boundaries.

Example of a tagged file:

```typescript
/**
 * @layer api
 * @subdomain ordering
 */
export const myService = {};
```

## Installation

```bash
npm install eslint-plugin-file-boundaries --save-dev
```

Add it to your `.eslintrc.json`:

```json
{
  "plugins": ["file-boundaries"],
  "rules": {
    "file-boundaries/tagging-rule": ["error", [
      {
        "tag": "layer",
        "mandatory": true,
        "values": ["api", "frontend", "composition-root"]
      },
      {
        "tag": "subdomain",
        "valueInPath": true,
        "values": ["ordering", "fulfillment", "inventory"]
      }
    ]],
    "file-boundaries/import-rule": ["error", [
      {
        "conditions": [{"tag": "layer", "value": "frontend"}],
        "shouldOnlyDependOn": [{"tag": "layer", "value": "api"}]
      }
    ]]
  }
}
```

## Rules

### `tagging-rule`

Ensures that files are correctly tagged using JSDoc.

#### Configuration

An array of objects with the following properties:

- `tag`: The name of the JSDoc tag (e.g., `layer`).
- `values`: An array of allowed values for this tag.
- `mandatory` (optional, default `false`): If `true`, every file must have this tag.
- `valueInPath` (optional, default `false`): If `true`, if one of the `values` is present as a substring in the file's path (folder name), the file *must* have that value for the tag. This is auto-fixable with `--fix`.

### `import-rule`

Enforces boundaries between files based on their tags.

#### Configuration

An array of boundary definitions:

- `conditions`: A list of tags and values that the *current* file must have for this boundary to apply.
- `shouldOnlyDependOn`: A list of tags and values that the *imported* files must have. If an import doesn't match any of these, an error is reported.

## LLM Compatibility

Using file-level JSDoc tags also helps LLMs understand the architectural context of a file without needing to traverse the entire directory structure.
