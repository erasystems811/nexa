import tseslint from "typescript-eslint";

export default tseslint.config(
  { ignores: ["node_modules/**"] },
  ...tseslint.configs.recommended,
  {
    rules: {
      "@typescript-eslint/no-unused-vars": [
        "error",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
      ],
    },
  },

  /**
   * Architecture, enforced. Ported from apps/customer's eslint.config.mjs —
   * PRD Section 17 says booking logic must not call the payment provider
   * directly. Only files inside modules/payments may import the gateway.
   */
  {
    files: ["src/**/*.ts"],
    ignores: ["src/modules/payments/**"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: ["**/modules/payments/gateway", "**/modules/payments/gateway/*"],
              message:
                "The payment gateway is private to modules/payments (PRD Section 17). " +
                "Import holdFunds / releaseFunds / refund from '../modules/payments' instead.",
            },
            {
              group: ["**/modules/payments/service", "**/modules/payments/calculations"],
              message: "Import from modules/payments' index, not from its internals.",
            },
          ],
        },
      ],
    },
  },

  /**
   * Service-role bypasses RLS. Only module internals that already decided
   * they need it (payments, settings' admin writes, provisioning) should
   * import createAdminClient — route handlers should read request.supabase.
   */
  {
    files: ["src/routes/**/*.ts", "src/plugins/**/*.ts"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          paths: [
            {
              name: "../supabase.js",
              importNames: ["createAdminClient"],
              message: "Routes should use request.supabase (RLS-scoped). Service-role access belongs behind a module.",
            },
          ],
        },
      ],
    },
  },
);
