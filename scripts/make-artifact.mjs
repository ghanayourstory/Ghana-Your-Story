// Turn the demo build into a single page + supporting files for hosting as a
// claude.ai artifact: inline the CSS and strip the document wrapper.
import { readFileSync, writeFileSync, readdirSync } from "node:fs";
const dir = "dist-demo";
let html = readFileSync(`${dir}/index.html`, "utf8");
html = html.replace(/<link rel="stylesheet"[^>]*href="\.\/(assets\/[^"]+\.css)"[^>]*>/, (_, f) => `<style>${readFileSync(`${dir}/${f}`, "utf8")}</style>`);
const head = html.match(/<head>([\s\S]*)<\/head>/)[1].replace(/<meta charset[^>]*>|<meta name="viewport"[^>]*>/g, "");
const body = html.match(/<body>([\s\S]*)<\/body>/)[1];
writeFileSync(`${dir}/artifact.html`, `${head.trim()}\n${body.trim()}\n`);
console.log("files:", readdirSync(`${dir}/assets`).join(", "));
