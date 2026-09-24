import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
export default defineConfig({
  plugins: [react()],
  build: {
    lib: {
      entry: {
        index: "src/index.ts",
        "plugins/index": "src/plugins/index.ts",
        "plugins/agent/index": "src/plugins/agent/index.ts",
      },
      formats: ["es"],
      fileName: (_format, entryName) => `${entryName}.js`,
      cssFileName: "styles",
    },
    rollupOptions: {
      external: ["react", "react-dom", "react/jsx-runtime", "zod"],
      // The public bundle contains hooks; retain its client boundary after bundling.
      output: { banner: '"use client";' },
    },
  },
});
