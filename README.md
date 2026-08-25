# @wilsoon/eslint-config

Opinionated, autofixable ESLint + Prettier shared configuration for JavaScript and TypeScript projects. Install once, run `npm run lint`, and let the tools clean up your code.

---

## Quick Start

```bash
npm install --save-dev @wilsoon/eslint-config
```

This single install pulls in everything you need: ESLint, Prettier, the TypeScript parser, and the stylistic plugin.

> **Note:** These tools are bundled as regular dependencies so you don't have to install them separately. If your project already uses a different major version of ESLint or Prettier, npm may install a second copy nested inside this package rather than warning about a conflict. If you'd prefer explicit control over tool versions, install them yourself and add the following to your `package.json` instead:
>
> ```json
> "overrides": {
>   "@wilsoon/eslint-config": {
>     "eslint": "$eslint",
>     "prettier": "$prettier"
>   }
> }
> ```
>
> This tells npm to use your project's versions of those tools inside this package.

### Allowing the Setup Script (npm v12+)

Starting with **npm v12**, postinstall scripts from dependencies are **blocked by default** for security. After installing, npm will notify you that this package has a script that wasn't run.

This package ships a postinstall script that **scaffolds config files and adds a `lint` command** to your project - saving you from manual setup. It never modifies existing files without asking.

Here's what it does (and nothing else):

1. Creates `eslint.config.js` if one doesn't exist.
2. Creates `prettier.config.js` if no Prettier config exists.
3. Adds `"lint": "eslint --fix . && prettier --write ."` to your `package.json` scripts. If a `lint` script already exists, it asks before replacing it.

To allow it, run:

```bash
npm trust @wilsoon/eslint-config
```

Then reinstall so the script runs:

```bash
npm install
```

> **Note:** `npm trust` is a one-time operation per package. Future installs and updates will run the script automatically.

If you'd rather not trust the script, you can [set everything up manually](#manual-setup) instead.

---

## What This Package Does

This package bundles **three custom ESLint rules**, a curated set of **stylistic ESLint rules**, and a **Prettier configuration** into a single installable dependency. Everything is autofixable - run one command and your code is reformatted.

After setup, the only command you need is:

```bash
npm run lint
```

---

## Rules Reference

### Custom ESLint Rules

These are original rules written specifically for this config. They all provide **autofix**.

#### `local/short-if-body` - Strip Braces From Single-Statement `if`

Removes curly braces from `if` blocks that contain exactly one statement.

- **Short bodies** (< 10 characters) stay on the same line as the condition.
- **Longer bodies** move to the next line, indented.
- **Comments** inside the block are removed along with the braces.

```diff
- if (x) {
-   return;
- }
+ if (x) return;

- if (condition) {
-   doSomethingLonger();
- }
+ if (condition)
+   doSomethingLonger();
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
As Prettier never touches template literal contents, this rule fills that gap.

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

### Prettier Formatting

The bundled Prettier config applies these settings:

| Setting           | Value      | Why                                                                                                |
| ----------------- | ---------- | -------------------------------------------------------------------------------------------------- |
| `printWidth`      | `250`      | Keeps most code on one line - the custom ESLint rule handles tagged template collapsing separately |
| `trailingComma`   | `"none"`   | No trailing commas anywhere                                                                        |
| `bracketSameLine` | `true`     | Opening braces stay on the same line                                                               |
| `singleQuote`     | `true`     | Single quotes for strings                                                                          |
| `semi`            | `true`     | Semicolons at end of statements                                                                    |
| `tabWidth`        | `2`        | 2-space indentation                                                                                |
| `arrowParens`     | `"always"` | Always wrap arrow function params in parentheses                                                   |

---

## Manual Setup

If you prefer not to use the postinstall script, or if you're on npm v12+ and don't want to trust the package, set things up by hand:

### 1. ESLint

Create `eslint.config.js`:

```js
import wilsoonConfig from "@wilsoon/eslint-config/eslint";

export default [
  ...wilsoonConfig,
  // Add your own rule overrides here: they will take precedence.
];
```

### 2. Prettier

Create `prettier.config.js`:

```js
export { default } from "@wilsoon/eslint-config/prettier";
```

Or to extend/override specific settings:

```js
import base from "@wilsoon/eslint-config/prettier";

export default {
  ...base,
  semi: false, // Example override: no semicolons
};
```

### 3. Lint Script

Add to your `package.json`:

```json
{
  "scripts": {
    "lint": "eslint --fix . && prettier --write ."
  }
}
```

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

The config already targets `**/*.{js,jsx,ts,tsx}` by default. To narrow or widen the scope:

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
