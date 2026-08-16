import { dirname } from "path";
import { fileURLToPath } from "url";
import { FlatCompat } from "@eslint/eslintrc";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const compat = new FlatCompat({ baseDirectory: __dirname });

const config = [
  ...compat.extends("next/core-web-vitals", "next/typescript"),

  {
    ignores: [".next/**", "node_modules/**", "next-env.d.ts"],
  },

  {
    files: ["src/**/*.{ts,tsx}"],
    rules: {
      // An adapter method that has to accept a parameter it does not yet use
      // marks it with a leading underscore. Deleting the parameter would break
      // the interface it implements.
      "@typescript-eslint/no-unused-vars": [
        "error",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
      ],
    },
  },

  /**
   * Architecture, enforced.
   *
   * PRD Section 17 says booking logic must not call the payment provider
   * directly. A comment saying so is a suggestion; this is the rule. Only files
   * inside modules/payments may import the gateway.
   */
  {
    files: ["src/**/*.{ts,tsx}"],
    ignores: ["src/modules/payments/**", "src/modules/messaging/**"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: [
                "**/modules/payments/gateway",
                "**/modules/payments/gateway/*",
                "@/modules/payments/gateway",
                "@/modules/payments/gateway/*",
              ],
              message:
                "The payment gateway is private to modules/payments (PRD Section 17). " +
                "Import holdFunds / releaseFunds / refund from '@/modules/payments' instead.",
            },
            {
              group: ["@/modules/payments/service", "@/modules/payments/calculations"],
              message: "Import from '@/modules/payments', not from its internals.",
            },
            {
              // A telephony adapter takes real phone numbers as arguments. Only
              // modules/messaging is allowed to hold one (PRD Section 08).
              group: [
                "**/modules/messaging/telephony",
                "**/modules/messaging/telephony/*",
                "@/modules/messaging/telephony",
                "@/modules/messaging/telephony/*",
              ],
              message:
                "The telephony provider is private to modules/messaging (PRD Section 08): " +
                "it handles real phone numbers. Import startMaskedCall from '@/modules/messaging'.",
            },
            {
              group: [
                "@/modules/messaging/calls",
                "@/modules/messaging/messages",
                "@/modules/messaging/conversations",
                "@/modules/messaging/moderation",
              ],
              message: "Import from '@/modules/messaging', not from its internals.",
            },
          ],
        },
      ],
    },
  },

  /**
   * The service-role key bypasses RLS. Only the payments and settings services
   * and the auth layer have any business holding it; everything else must go
   * through a session-scoped client so the policies in 0011_rls.sql apply.
   */
  {
    files: ["src/app/**/*.{ts,tsx}", "src/components/**/*.{ts,tsx}"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          paths: [
            {
              name: "@/lib/supabase/admin",
              message:
                "Pages and components must use the session-scoped client (@/lib/supabase/server) " +
                "so RLS applies. Service-role access belongs behind a module service.",
            },
          ],
        },
      ],
    },
  },
];

export default config;
