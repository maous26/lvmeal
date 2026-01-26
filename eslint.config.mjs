import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",

    // Repo-specific ignores (avoid OOM / huge vendored outputs)
    "**/venv/**",
    "**/.venv/**",
    "**/__pycache__/**",
    "mobile/backend-dspy/**",
    "mobile/**/Pods/**",
    "mobile/**/ios/build/**",
    "mobile/**/android/build/**",
  ]),
]);

export default eslintConfig;
