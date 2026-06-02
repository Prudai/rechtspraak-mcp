import { defineConfig } from "tsup";

// Build a single Node-runnable bundle. The shebang banner makes `npx rechtspraak-mcp`
// work without a separate wrapper, and bundling means consumers don't need Bun.
export default defineConfig({
  entry: ["src/index.ts"],
  format: ["esm"],
  target: "node18",
  platform: "node",
  clean: true,
  sourcemap: true,
  dts: false,
  banner: {
    js: "#!/usr/bin/env node",
  },
});
