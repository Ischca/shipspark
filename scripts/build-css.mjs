import { execSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, "..");
const input = resolve(root, "src/app.css");
const tmpOut = resolve(root, "node_modules/.cache/_tw_out.css");
const dest = resolve(root, "src/_generated_styles.ts");

execSync(
  `npx @tailwindcss/cli -i ${input} -o ${tmpOut} --minify`,
  { cwd: root, stdio: "inherit" }
);

const css = readFileSync(tmpOut, "utf-8");
const escaped = css.replace(/\\/g, "\\\\").replace(/`/g, "\\`").replace(/\$/g, "\\$");
writeFileSync(dest, `export const GENERATED_STYLES = \`${escaped}\`;\n`);

console.log(`[build-css] wrote ${dest} (${css.length} bytes)`);
