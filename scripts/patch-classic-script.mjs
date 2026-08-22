/* Vite marks the entry script as a module even for iife output, and file://
   refuses to load module scripts. Swap `type="module"` for `defer`: a classic
   script in <head> would otherwise run before #root exists, and module scripts
   are deferred by default, so dropping the attribute alone breaks the mount. */
import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

const shell = resolve(import.meta.dirname, "..", "dist", "client", "index.html");
const original = await readFile(shell, "utf8");
const patched = original
  .replaceAll(/<script\b([^>]*)\stype="module"([^>]*)>/g, "<script$1 defer$2>")
  .replaceAll(/\s+crossorigin(?==""|\s|>)/g, "");

if (!/<script[^>]*\bdefer\b[^>]*\bsrc="[^"]*app\.js"/.test(patched)) {
  throw new Error("The built entry script is not a deferred classic script; file:// would break.");
}

if (patched === original) {
  console.log("Entry script already loads as a deferred classic script.");
} else {
  await writeFile(shell, patched, "utf8");
  console.log("Patched the entry script so file:// can load it.");
}
