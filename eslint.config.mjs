import { dirname } from "path";
import { fileURLToPath } from "url";
import { FlatCompat } from "@eslint/eslintrc";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const compat = new FlatCompat({
  baseDirectory: __dirname,
});

// CLAUDE.md rule 2 / rule 9 — enforced import fences.
const RESEND_PATH = {
  name: "resend",
  message: "Send email only through src/lib/email.ts (CLAUDE.md rule 2 / 9).",
};
const DB_PATTERN = {
  group: ["@/db", "@/db/*"],
  message:
    "Only src/db, src/lib/dal.ts and src/auth.ts may import the database (CLAUDE.md rule 2).",
};

const eslintConfig = [
  ...compat.extends("next/core-web-vitals", "next/typescript"),
  {
    rules: {
      "no-restricted-imports": [
        "error",
        { paths: [RESEND_PATH], patterns: [DB_PATTERN] },
      ],
    },
  },
  // The email chokepoint may import `resend`, but still not the database.
  {
    files: ["src/lib/email.ts"],
    rules: {
      "no-restricted-imports": ["error", { patterns: [DB_PATTERN] }],
    },
  },
  // DB owners may import the database, but still not `resend`.
  {
    files: ["src/db/**", "src/lib/dal.ts", "src/auth.ts"],
    rules: {
      "no-restricted-imports": ["error", { paths: [RESEND_PATH] }],
    },
  },
  {
    ignores: [
      "node_modules/**",
      ".next/**",
      "out/**",
      "build/**",
      "next-env.d.ts",
      "drizzle/**",
    ],
  },
];

export default eslintConfig;
