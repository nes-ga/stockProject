import { build } from "esbuild";
import path from "node:path";
import { fileURLToPath } from "node:url";

const currentDir = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(currentDir, "..");

await build({
  entryPoints: [path.join(projectRoot, "frontend", "newsSignalDashboard.jsx")],
  bundle: true,
  format: "esm",
  platform: "browser",
  target: ["es2020"],
  jsx: "automatic",
  sourcemap: false,
  minify: false,
  outfile: path.join(projectRoot, "public", "news-signal-dashboard.js")
});
