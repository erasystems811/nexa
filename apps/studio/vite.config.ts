import path from "node:path";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  // @nexa/design-system ships its .tsx source directly and its own
  // components import "@/lib/utils" expecting this app's own "@" alias to
  // resolve it (the shim at src/lib/utils.ts re-exports the real one) — same
  // trick apps/customer's Next config relies on via its own "@/*" path.
  resolve: { alias: { "@": path.resolve(__dirname, "./src") } },
  server: { port: 5173 },
});
