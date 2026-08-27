import js from "@eslint/js";
import globals from "globals";
import tseslint from "typescript-eslint";

const testGlobs = [
  "**/*.{test,spec}.{ts,tsx}",
  "**/__tests__/**",
  "**/__mocks__/**",
];

export default tseslint.config(
  {
    ignores: ["out/**", "dist/**", "node_modules/**", "resources/**"],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ["**/*.{ts,tsx}"],
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      "no-console": "error",
      "no-debugger": "error",
      "no-unreachable": "error",
      "prefer-const": "error",
      "no-var": "error",
      eqeqeq: ["error", "always"],
      "default-case": "warn",
      "@typescript-eslint/no-explicit-any": "error",
      "@typescript-eslint/no-unused-vars": [
        "warn",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
      ],
      "@typescript-eslint/no-empty-function": "warn",
      "@typescript-eslint/consistent-type-imports": [
        "error",
        { prefer: "type-imports", fixStyle: "separate-type-imports" },
      ],
      "@typescript-eslint/no-floating-promises": "error",
    },
  },
  {
    files: ["src/main/**/*.ts", "src/preload/**/*.ts", "src/shared/**/*.ts"],
    languageOptions: {
      globals: globals.node,
    },
  },
  {
    files: ["src/renderer/**/*.{ts,tsx}"],
    languageOptions: {
      globals: globals.browser,
    },
  },
  {
    files: testGlobs,
    rules: {
      "no-console": "off",
      "@typescript-eslint/no-explicit-any": "off",
      "@typescript-eslint/no-unused-vars": "off",
      "@typescript-eslint/no-empty-function": "off",
    },
  },
  {
    files: ["*.config.{js,ts}", "eslint.config.mjs", "scripts/**/*.{js,mjs,cjs}"],
    languageOptions: {
      globals: globals.node,
    },
    rules: {
      "no-console": "off",
      "@typescript-eslint/no-floating-promises": "off",
    },
  },
);
