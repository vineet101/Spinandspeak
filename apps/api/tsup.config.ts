import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/index.ts"],
  format: ["esm"],
  target: "node22",
  platform: "node",
  sourcemap: true,
  clean: true,
  bundle: true,
  noExternal: [
    "@spin-and-speak/domain",
    "@spin-and-speak/scoring",
    "@spin-and-speak/api-types"
  ]
});
