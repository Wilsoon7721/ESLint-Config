# @wilsoon/eslint-config

Opinionated, autofixable ESLint + dprint shared configuration for JavaScript and TypeScript projects. Install once, run `npm run lint`, and let the tools clean up your code.

---

## Quick Start

```bash
npm install --save-dev @wilsoon/eslint-config
```

This single install pulls in everything you need: ESLint, dprint, the TypeScript parser, and the stylistic plugin.

> **Note:** These tools are bundled as regular dependencies so you don't have to install them separately. If your project already uses a different major version of ESLint, npm may install a second copy nested inside this package rather than warning about a conflict. If you'd prefer explicit control over tool versions, install them yourself and add the following to your `package.json` instead:
>
> ```json
> "overrides": {
>   "@wilsoon/eslint-config": {
>     "eslint": "$eslint"
>   }
> }
> ```
>
> This tells npm to use your project's versions of those tools inside this package.

### Setup

After installing, run the setup command:

```bash
npx @wilsoon/eslint-config
```

It walks you through scaffolding the config files and the `lint` script, prompting before it touches anything that already exists. It is safe to re-run at any time - if your project is already set up, it says so and changes nothing.

| Flag           | Effect                                                            |
| -------------- | ----------------------------------------------------------------- |
| `-y`, `--yes`  | Accept every prompt (replaces conflicting configs without asking) |
| `-h`, `--help` | Show usage                                                        |

#### Migrating from v0.3.x (Prettier)

v0.4.0 replaces Prettier with **dprint** as the formatter. When you run the setup command, it will:

1. Create `dprint.json` with the equivalent formatting rules.
2. Detect any existing Prettier config and suggest you remove it.

You can safely delete your old `prettier.config.mjs` / `.prettierrc` after setup.

### The Postinstall Script

This package also ships a postinstall script that covers the common case automatically. Because npm runs lifecycle scripts with their output hidden and no usable input, **the postinstall script never asks questions and never overwrites anything**. It only creates what is missing:

1. Creates `eslint.config.mjs` - only if no ESLint config exists.
2. Creates `dprint.json` - only if no dprint config exists.
3. Adds `"lint": "wlint"` - only if your `package.json` has no `lint` script.

If all three are already present, it exits silently and does nothing. Anything that would require a decision - replacing an existing ESLint config, or a `lint` script that differs from the one above - is left to `npx @wilsoon/eslint-config`.

#### Allowing the Postinstall Script (npm v12+)

Starting with **npm v12**, postinstall scripts from dependencies are **blocked by default** for security. After installing, npm will notify you that this package has a script that wasn't run.

To allow it, approve the package's scripts:

```bash
npm approve-scripts @wilsoon/eslint-config
```

This adds the package to an `allowScripts` field in your `package.json`. Then reinstall so the script runs:

```bash
npm install
```

> **Note:** The `allowScripts` entry is saved in your `package.json` and should be committed. Future installs will run the script automatically.

You never have to approve it - running `npx @wilsoon/eslint-config` once does everything the postinstall script does, and more. Or [set everything up manually](#manual-setup).

---

## What This Package Does

This package bundles **three custom ESLint rules**, a curated set of **stylistic ESLint rules**, and a **dprint configuration** into a single installable dependency. Everything is autofixable - run one command and your code is reformatted.

After setup, the only command you need day to day is:

```bash
npm run lint
```

### Linting Specific Files

`npm run lint` with no arguments fixes and formats the whole project. Pass files or directories to narrow it down - they are handed to both ESLint and dprint:

```bash
npm run lint src/
```

```bash
npm run lint src/app.ts components/ utils/helpers.js
```

Older npm versions require `--` before the arguments, which is always safe to include:

```bash
npm run lint -- src/
```

> **Note:** ESLint runs first. If it reports a problem it can't autofix, the command stops there and dprint does not run, so formatting is never applied on top of failing code. The exit code is the failing tool's, which keeps it usable in CI.

`wlint` always prefers the ESLint and dprint installed in **your** project, falling back to the copies bundled with this package only if you have neither. To see which ones are selected:

```bash
npx wlint --which
```

### Check Mode

Use `--check` to validate code without modifying any files:

```bash
npm run lint -- --check
```

In check mode:

- ESLint runs **without** `--fix` - it reports issues but doesn't touch files.
- dprint runs `check` instead of `fmt` - it reports files that would change.
- **Both tools always run**, regardless of ESLint's exit status.
- **The exit code is always 0** - check mode is purely informational.

This is ideal for CI pipelines where you want to surface issues without blocking:

```yaml
# GitHub Actions example
- run: npm run lint -- --check
  continue-on-error: true
```

---

## Rules Reference

### Custom ESLint Rules

These are original rules written specifically for this config. They all provide **autofix**.

#### `local/short-if-body` - Strip Braces From Single-Statement Blocks

Removes curly braces from blocks that contain exactly one statement. Despite the name (kept so existing overrides and `eslint-disable` comments keep working) it covers `if`, `else`, `for`, `for...in`, `for...of`, `while` and `do...while`.

- **Short bodies** (< 10 characters) stay on the same line as the condition.
- **Longer bodies** move to the next line, indented.
- **Comments** inside the block are removed along with the braces.

```diff
- if (x) {
-   return;
- }
+ if (x) return;

- for (const item of items) {
-   consume(item);
- }
+ for (const item of items)
+   consume(item);

- if (x) {
-   doTheFirstThing();
- } else {
-   doTheSecondThing();
- }
+ if (x)
+   doTheFirstThing();
+ else
+   doTheSecondThing();
```

**Exceptions.** The braces are left alone when the single statement is itself a block-owning statement - `if`, `else`, `for`, `for...in`, `for...of`, `while`, `do...while`, `switch` or `try`:

```js
// Left as-is: inlining this would rebind the `else` to the inner `if`.
if (x) {
  if (y) first();
} else {
  second();
}
```

They are also left alone where an unbraced body would not be valid JavaScript - a `let`/`const` declaration, a function declaration, or a class declaration. (`var` is still collapsed, since it is legal there.)

```js
// Left as-is: `if (x) const only = 1;` is a SyntaxError.
if (x) {
  const only = 1;
}
```

#### `local/concise-arrow-body` - Concise Arrow Function Bodies

Converts single-statement arrow function blocks into concise (braceless) bodies. Handles both `return` statements and bare expression statements - the built-in `arrow-body-style` rule can't autofix the latter.
Only fires when the result fits on one line. Multi-line bodies are left alone.

```diff
- const fn = (x) => {
-   return x + 1;
- };
+ const fn = (x) => x + 1;

- const log = (msg) => {
-   console.log(msg);
- };
+ const log = (msg) => console.log(msg);

  // Object expressions are wrapped in parens:
- const obj = () => {
-   return { a: 1 };
- };
+ const obj = () => ({ a: 1 });
```

#### `local/collapse-tagged-template` - Collapse Short Tagged Templates

Collapses multi-line tagged template literals (e.g. `` sql`...` ``) onto one line when they're short enough.
As formatters never touch template literal contents, this rule fills that gap.

**Defaults** (configurable):

| Option     | Default   | Description                                    |
| ---------- | --------- | ---------------------------------------------- |
| `tags`     | `['sql']` | Which tagged template tags to target           |
| `maxLines` | `5`       | Templates longer than this are left alone      |
| `maxWidth` | `250`     | Collapsed result wider than this is left alone |

```diff
- const q = sql`
-   SELECT *
-   FROM users
-   WHERE id = ${id}
- `;
+ const q = sql`SELECT * FROM users WHERE id = ${id}`;
```

---

### Stylistic Rules (via `@stylistic/eslint-plugin`)

#### Blank Line After Conditionals

A blank line is enforced after every `if` / `else if` / `else` block, separating conditional logic from the code that follows. Comments between the block and the next statement don't count.

```diff
  if (ready) start();
+
  doNextThing();
```

---

### dprint Formatting

The bundled dprint config applies these settings:

| Setting                              | Value            | Why                                                                                                |
| ------------------------------------ | ---------------- | -------------------------------------------------------------------------------------------------- |
| `lineWidth`                          | `250`            | Keeps most code on one line - the custom ESLint rule handles tagged template collapsing separately |
| `trailingCommas`                     | `"never"`        | No trailing commas anywhere                                                                        |
| `jsx.bracketPosition`                | `"sameLine"`     | Opening braces stay on the same line                                                               |
| `quoteStyle`                         | `"preferSingle"` | Single quotes for strings                                                                          |
| `semiColons`                         | `"always"`       | Semicolons at end of statements                                                                    |
| `indentWidth`                        | `2`              | 2-space indentation                                                                                |
| `useTabs`                            | `false`          | Spaces, not tabs                                                                                   |
| `arrowFunction.useParentheses`       | `"force"`        | Always wrap arrow function params in parentheses                                                   |
| `memberExpression.linePerExpression` | `false`          | Method chains stay on one line when they fit within `lineWidth`                                    |

> **Note:** On first run, dprint downloads the TypeScript/JavaScript formatting plugin (~3 MB WASM file). This is cached globally and only happens once.

---

## Manual Setup

If you'd rather not run either the setup command or the postinstall script, set things up by hand:

### 1. ESLint

Create `eslint.config.mjs` (or `eslint.config.js` if your `package.json` sets `"type": "module"`):

```js
import wilsoonConfig from "@wilsoon/eslint-config/eslint";

export default [
  ...wilsoonConfig,
  // Add your own rule overrides here: they will take precedence.
];
```

### 2. dprint

Create `dprint.json` in your project root:

```json
{
  "$schema": "https://dprint.dev/schemas/v0.json",
  "lineWidth": 250,
  "indentWidth": 2,
  "useTabs": false,
  "typescript": {
    "quoteStyle": "preferSingle",
    "semiColons": "always",
    "trailingCommas": "never",
    "arrowFunction.useParentheses": "force",
    "jsx.bracketPosition": "sameLine",
    "memberExpression.linePerExpression": false
  },
  "plugins": ["https://plugins.dprint.dev/typescript-0.96.1.wasm"]
}
```

To override specific settings, edit the values directly in your `dprint.json`.

The formatting rules are also available as a JS object for programmatic access:

```js
import formatterConfig from "@wilsoon/eslint-config/formatter";
console.log(formatterConfig.lineWidth); // 250
```

### 3. Lint Script

Add to your `package.json`:

```json
{
  "scripts": {
    "lint": "wlint"
  }
}
```

`wlint` is the small runner shipped with this package. It forwards any files or directories you pass to both ESLint and dprint, defaulting to the whole project.

---

## Overriding Rules

ESLint flat config is an array - **the last entry wins**. Spread this package's config first, then add your overrides after:

```js
import wilsoonConfig from "@wilsoon/eslint-config/eslint";

export default [
  ...wilsoonConfig,
  {
    rules: {
      // Disable a rule entirely:
      "local/short-if-body": "off",

      // Change a rule's severity:
      "local/collapse-tagged-template": "warn",

      // Configure a rule's options:
      "local/collapse-tagged-template": ["error", { tags: ["sql", "gql"], maxLines: 3 }],
    },
  },
];
```

Your overrides always take precedence over the shared config.

---

## Applying to Specific Files Only

The config already targets `**/*.{js,jsx,ts,tsx,mjs,cjs,mts,cts}` by default. To narrow or widen the scope:

```js
import wilsoonConfig from "@wilsoon/eslint-config/eslint";

export default [
  ...wilsoonConfig,
  {
    // Only apply to src/ directory:
    files: ["src/**/*.{ts,tsx}"],
    rules: {
      "local/concise-arrow-body": "warn",
    },
  },
];
```

---

## License

MIT
