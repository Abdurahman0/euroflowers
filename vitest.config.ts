import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

export default defineConfig({
  // `@/...` — Next'dagi bilan BIR XIL alias (lib testlari komponentni ham chaqira olsin:
  // masalan lib/richText.test.ts → components/chat/RichText)
  // JSX — Next'dagidek avtomatik transform (komponent testlarida `React` import qilinmaydi)
  esbuild: { jsx: "automatic" },
  resolve: { alias: { "@": fileURLToPath(new URL("./", import.meta.url)) } },
  test: {
    include: ["lib/**/*.test.ts"],
    environment: "node",
  },
});
