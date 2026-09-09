import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";
import boundaries from "eslint-plugin-boundaries";
import { projectStructureParser, projectStructurePlugin } from "eslint-plugin-project-structure";
import { folderStructureConfig } from "./folder-structure.mjs";

// Folder-structure enforcement. Placed FIRST and scoped to code files so the Next/TS configs
// below re-set the TS parser for them, leaving this parser exclusive to the folder rule.
const projectStructureConfig = {
  // Scoped to code files (not "**") so ESLint does not try to read the bracketed
  // app/api/[[...route]] directory as a file. The rule walks the whole tree regardless.
  files: ["**/*.{ts,tsx}"],
  ignores: ["projectStructure.cache.json"],
  languageOptions: { parser: projectStructureParser },
  plugins: { "project-structure": projectStructurePlugin },
  rules: {
    "project-structure/folder-structure": ["error", folderStructureConfig],
  },
};

// Unidirectional import flow: shared -> features -> app.
// - shared/ is importable by anything but may import only shared/
// - a feature may import shared/ + its own files only (no cross-feature)
// - app/ composes features; nothing imports app/
const boundariesConfig = {
  files: ["src/**/*.{ts,tsx}"],
  plugins: { boundaries },
  settings: {
    "boundaries/include": ["src/**/*"],
    "boundaries/elements": [
      { type: "shared", partialMatch: false, pattern: "src/shared/**/*" },
      { type: "feature", partialMatch: false, pattern: "src/features/*/**/*", capture: ["feature"] },
      { type: "app", partialMatch: false, pattern: "src/app/**/*" },
    ],
    // Resolve the @/* path alias so boundaries can map import specifiers to elements.
    "import/resolver": { typescript: { project: "./tsconfig.json" } },
  },
  rules: {
    "boundaries/dependencies": [
      "error",
      {
        default: "disallow",
        policies: [
          // shared/ may import only shared/
          { from: [{ element: { type: "shared" } }], allow: [{ to: { element: { type: "shared" } } }] },
          // a feature may import shared/ + its own files (no cross-feature)
          {
            from: [{ element: { type: "feature" } }],
            allow: [
              { to: { element: { type: "shared" } } },
              { to: { element: { type: "feature", captured: { feature: "{{ from.captured.feature }}" } } } },
            ],
          },
          // app/ composes features and shared, and may import within the app layer
          {
            from: [{ element: { type: "app" } }],
            allow: [
              { to: { element: { type: "shared" } } },
              { to: { element: { type: "feature" } } },
              { to: { element: { type: "app" } } },
            ],
          },
        ],
      },
    ],
  },
};

// Source coding conventions. TS `enum` is banned in favor of an `as const` object with a
// derived union type - the enum-like constant convention (CONSTANT_CASE singular name,
// UPPER_CASE keys, lowercase wire values). Key/name casing itself is not lint-enforceable
// (it cannot be told apart from ordinary objects) so it lives in the rules docs + review.
const conventionsConfig = {
  files: ["src/**/*.{ts,tsx}"],
  rules: {
    "no-restricted-syntax": [
      "error",
      {
        selector: "TSEnumDeclaration",
        message:
          "Do not use `enum`. Use an `as const` object (CONSTANT_CASE name, UPPER_CASE keys) with a derived union type instead.",
      },
    ],
  },
};

// utils/ buckets hold pure helpers. A util must not depend on infrastructure, so forbid the two
// STABLE infra signals: `server-only` (the server marker) and `@/shared/lib/**` (our lib modules).
// No npm-package list - adding a dependency never touches this. The rest of the lib-vs-utils call
// is review-backed against the decision table in architecture.md.
const utilsPurityConfig = {
  files: ["**/utils/**/*.{ts,tsx}"],
  rules: {
    "no-restricted-imports": [
      "error",
      {
        patterns: [
          {
            group: ["server-only", "@/shared/lib/*", "@/shared/lib/**"],
            message:
              "utils/ is for pure helpers. A util must not import server-only or a lib/ module - move it to lib/.",
          },
        ],
      },
    ],
  },
};

const eslintConfig = defineConfig([
  projectStructureConfig,
  ...nextVitals,
  ...nextTs,
  boundariesConfig,
  conventionsConfig,
  utilsPurityConfig,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Generated artifacts are not linted.
    "coverage/**",
    "src/shared/db/migrations/**",
  ]),
]);

export default eslintConfig;
