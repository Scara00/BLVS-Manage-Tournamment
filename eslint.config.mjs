import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";
import prettier from "eslint-config-prettier/flat";
import storybook from "eslint-plugin-storybook";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  ...storybook.configs["flat/recommended"],
  {
    // The server clock is read only through @/lib/time/server-time (now()).
    files: ["src/**/*.{ts,tsx}"],
    ignores: [
      "src/lib/time/**",
      "src/**/*.test.{ts,tsx}",
      "src/**/*.stories.tsx",
    ],
    rules: {
      "no-restricted-syntax": [
        "error",
        {
          selector: "NewExpression[callee.name='Date'][arguments.length=0]",
          message:
            "Usa now() da @/lib/time/server-time per l'orario del server.",
        },
        {
          selector:
            "CallExpression[callee.object.name='Date'][callee.property.name='now']",
          message:
            "Usa now() da @/lib/time/server-time per l'orario del server.",
        },
      ],
    },
  },
  // Must stay last: turns off stylistic rules that Prettier owns.
  prettier,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    "storybook-static/**",
    "playwright-report/**",
    "test-results/**",
    "graphify-out/**",
  ]),
]);

export default eslintConfig;
