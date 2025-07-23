import { dirname } from "path";
import { fileURLToPath } from "url";
import { FlatCompat } from "@eslint/eslintrc";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const compat = new FlatCompat({
  baseDirectory: __dirname,
});

const eslintConfig = [
  ...compat.extends("next/core-web-vitals", "next/typescript"),
  {
    rules: {
      // Allow 'any' types during initial development phase
      "@typescript-eslint/no-explicit-any": "off",
      // Allow unused variables for development (especially request parameters)
      "@typescript-eslint/no-unused-vars": ["warn", {
        "argsIgnorePattern": "^_",
        "varsIgnorePattern": "^_"
      }],
      // Relaxed rules for rapid prototyping
      "prefer-const": "warn",
      "no-console": "off",
    }
  }
];

export default eslintConfig;
