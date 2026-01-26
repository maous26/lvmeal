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
    "mobile/lvmeal/**",
    "mobile/**/Pods/**",
    "mobile/ios/**",
    "mobile/android/**",
    "mobile/**/ios/build/**",
    "mobile/**/android/build/**",
  ]),

  // Repo-wide overrides: keep lint actionable but non-blocking.
  {
    rules: {
      "@typescript-eslint/no-explicit-any": "warn",
      "@typescript-eslint/no-require-imports": "off",

      // Avoid hard failures from React Compiler / hooks purity rules on existing code.
      "react-hooks/purity": "warn",
      "react-hooks/immutability": "warn",
      "react-hooks/preserve-manual-memoization": "warn",

      // Common in French UI copy; keep as warning if we want to clean later.
      "react/no-unescaped-entities": "warn",

      // Existing codebase has a lot of `let` patterns; don't block CI on this.
      "prefer-const": "warn",
    },
  },
]);

export default eslintConfig;
