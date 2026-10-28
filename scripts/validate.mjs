/**
 * Validação estática do sistema (sem Foundry).
 *
 * Confere: system.json, grafo de importações, templates, parciais, sintaxe Handlebars,
 * chaves de idioma (paridade pt-BR/en e uso) e a ligação entre data-action dos templates e
 * os manipuladores nas classes.
 *
 * Uso: node scripts/validate.mjs
 */

import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import Handlebars from "handlebars";
import { MMRPG } from "../module/config.mjs";
import { walk, collectConfigKeys, collectLiteralKeys, flatten } from "./lib/keys.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const errors = [];
const warnings = [];
const rel = (f) => path.relative(root, f);
const read = (f) => fs.readFileSync(f, "utf8");
const exists = (p) => fs.existsSync(path.join(root, p));

function section(title) {
  console.log(`\n== ${title}`);
}

/* -------------------------------------------- */
section("system.json");

const system = JSON.parse(read(path.join(root, "system.json")));
for (const field of ["id", "title", "version", "compatibility", "esmodules", "languages", "documentTypes"]) {
  if (!system[field]) errors.push(`system.json: campo "${field}" ausente`);
}
if (system.id !== MMRPG.id) errors.push(`system.json: id "${system.id}" difere de CONFIG.MMRPG.id "${MMRPG.id}"`);
for (const f of [...(system.esmodules ?? []), ...(system.styles ?? [])]) {
  if (!exists(f)) errors.push(`system.json: arquivo não encontrado: ${f}`);
}
for (const l of system.languages ?? []) {
  if (!exists(l.path)) errors.push(`system.json: idioma não encontrado: ${l.path}`);
}

// Tipos de documento declarados × registrados no ponto de entrada
const entry = read(path.join(root, "module/mmrpg.mjs"));
function registered(label) {
  const m = entry.match(new RegExp(`CONFIG\\.${label}\\.dataModels,\\s*\\{([\\s\\S]*?)\\}\\)`));
  if (!m) return [];
  return [...m[1].matchAll(/^\s*(\w+):/gm)].map((x) => x[1]);
}
for (const [doc, label] of [["Actor", "Actor"], ["Item", "Item"]]) {
  const declared = Object.keys(system.documentTypes[doc] ?? {}).sort();
  const regs = registered(label).sort();
  if (JSON.stringify(declared) !== JSON.stringify(regs)) {
    errors.push(`${doc}: system.json declara [${declared}] mas o código registra [${regs}]`);
  }
}
console.log(`ok: ${system.id} ${system.version}`);

/* -------------------------------------------- */
section("importações e sintaxe (.mjs)");

const mjs = walk(path.join(root, "module"), (f) => f.endsWith(".mjs")).concat(
  walk(path.join(root, "scripts"), (f) => f.endsWith(".mjs"))
);
for (const file of mjs) {
  try {
    execFileSync(process.execPath, ["--check", file], { stdio: "pipe" });
  } catch (err) {
    errors.push(`sintaxe: ${rel(file)}\n${err.stderr?.toString() ?? err.message}`);
  }
  const text = read(file);
  const specs = new Set();
  for (const m of text.matchAll(/(?:import|export)[^'"`;]*?from\s*["']([^"']+)["']/g)) specs.add(m[1]);
  for (const m of text.matchAll(/import\(\s*["']([^"']+)["']\s*\)/g)) specs.add(m[1]);
  for (const spec of specs) {
    if (!spec.startsWith(".")) continue; // pacotes (ex.: handlebars)
    const target = path.resolve(path.dirname(file), spec);
    if (!fs.existsSync(target)) errors.push(`importação quebrada em ${rel(file)}: ${spec}`);
  }
}
console.log(`${mjs.length} arquivos .mjs verificados`);

/* -------------------------------------------- */
section("templates");

const templates = walk(path.join(root, "templates"), (f) => f.endsWith(".hbs"));
const tplSet = new Set(templates.map((f) => rel(f).replaceAll("\\", "/")));

// Lista pré-carregada × arquivos
const handlebarsHelper = read(path.join(root, "module/helpers/handlebars.mjs"));
const preload = [...handlebarsHelper.matchAll(/^\s*"([^"]+\.hbs)",?\s*$/gm)].map((m) => `templates/${m[1]}`);
for (const p of preload) if (!tplSet.has(p)) errors.push(`pré-carregamento aponta para template inexistente: ${p}`);
for (const p of tplSet) if (!preload.includes(p)) warnings.push(`template fora da lista de pré-carregamento: ${p}`);

// Caminhos de template usados no código
for (const file of mjs) {
  const text = read(file);
  for (const m of text.matchAll(/\$\{(?:MMRPG\.path)\}\/(templates\/[A-Za-z0-9_\-/.]+\.hbs)/g)) {
    if (!tplSet.has(m[1])) errors.push(`${rel(file)}: template inexistente ${m[1]}`);
  }
  for (const m of text.matchAll(/CARD_TEMPLATE|CHECK_TEMPLATE/g)) void m;
}

// Helpers que o Foundry fornece (apenas para a verificação de sintaxe)
const coreHelpers = ["localize", "eq", "ne", "lt", "gt", "lte", "gte", "and", "or", "not"];
const ownHelpers = [...handlebarsHelper.matchAll(/registerHelper\(\s*"([^"]+)"/g)].map((m) => m[1]);
const known = new Set([...coreHelpers, ...ownHelpers]);

for (const file of templates) {
  const text = read(file);
  try {
    Handlebars.precompile(text);
  } catch (err) {
    errors.push(`Handlebars (${rel(file)}): ${err.message.split("\n")[0]}`);
    continue;
  }
  // Parciais
  for (const m of text.matchAll(/\{\{>\s*"([^"]+)"/g)) {
    const p = m[1].replace(/^systems\/mmrpg\//, "");
    if (!tplSet.has(p)) errors.push(`${rel(file)}: parcial inexistente ${m[1]}`);
  }
  // Helpers desconhecidos: {{nome ...}} cujo nome é uma palavra isolada seguida de argumento
  const ast = Handlebars.parse(text);
  const visit = (node) => {
    if (!node || typeof node !== "object") return;
    if (node.type === "SubExpression" || node.type === "MustacheStatement" || node.type === "BlockStatement") {
      const p = node.path;
      if (p?.type === "PathExpression" && p.parts.length === 1 && !p.data && !p.depth) {
        const name = p.parts[0];
        const hasArgs = (node.params?.length ?? 0) > 0 || Object.keys(node.hash?.pairs ?? {}).length > 0 || node.type === "BlockStatement";
        const builtin = ["if", "unless", "each", "with", "else", "log", "lookup"];
        if (hasArgs && node.params?.length && !known.has(name) && !builtin.includes(name)) {
          errors.push(`${rel(file)}: helper desconhecido "${name}"`);
        }
      }
    }
    for (const value of Object.values(node)) {
      if (Array.isArray(value)) value.forEach(visit);
      else if (value && typeof value === "object") visit(value);
    }
  };
  visit(ast);
}
console.log(`${templates.length} templates verificados`);

/* -------------------------------------------- */
section("ligação data-action × manipuladores");

function actionNames(file) {
  const text = read(path.join(root, file));
  const block = text.match(/actions:\s*\{([^}\n]*)\}/) ?? text.match(/actions:\s*\{([\s\S]*?)\n\s{4}\}/);
  if (!block) return new Set();
  return new Set([...block[1].matchAll(/(?:^|,|\{)\s*(\w+):/gm)].map((m) => m[1]));
}
const groups = [
  { files: ["module/apps/sheets/actor-sheet.mjs"], tpl: (t) => t.startsWith("templates/actor/") },
  { files: ["module/apps/sheets/item-sheet.mjs"], tpl: (t) => t.startsWith("templates/item/") },
  { files: ["module/apps/action-editor.mjs"], tpl: (t) => t === "templates/apps/action-editor.hbs" },
  { files: ["module/apps/importer.mjs"], tpl: (t) => t === "templates/apps/importer.hbs" },
  { files: ["module/apps/team-maneuver.mjs"], tpl: (t) => t === "templates/apps/team-maneuver.hbs" }
];
for (const g of groups) {
  const handlers = new Set(g.files.flatMap((f) => [...actionNames(f)]));
  const used = new Map();
  for (const t of tplSet) {
    if (!g.tpl(t)) continue;
    for (const m of read(path.join(root, t)).matchAll(/data-action="(\w+)"/g)) used.set(m[1], t);
  }
  for (const [name, t] of used) {
    if (!handlers.has(name)) errors.push(`${t}: data-action="${name}" sem manipulador em ${g.files.join(", ")}`);
  }
  for (const h of handlers) {
    if (h === "editImage" && !used.has(h)) continue;
    if (!used.has(h)) warnings.push(`manipulador "${h}" (${g.files[0]}) não é usado em nenhum template`);
  }
}

// data-mmrpg-action (cartões de chat) × listeners
const listeners = read(path.join(root, "module/actions/listeners.mjs"));
const handled = new Set([...listeners.matchAll(/case\s+"([\w-]+)"/g)].map((m) => m[1]));
for (const t of ["templates/chat/action-card.hbs", "templates/dice/roll.hbs"]) {
  for (const m of read(path.join(root, t)).matchAll(/data-mmrpg-action="([\w-]+)"/g)) {
    if (!handled.has(m[1])) errors.push(`${t}: data-mmrpg-action="${m[1]}" sem tratamento em listeners.mjs`);
  }
}

/* -------------------------------------------- */
section("idiomas");

const langs = {};
for (const l of system.languages ?? []) langs[l.lang] = flatten(JSON.parse(read(path.join(root, l.path))));
const langCodes = Object.keys(langs);

const used = new Map();
for (const k of collectConfigKeys(MMRPG)) used.set(k, new Set(["config.mjs"]));
for (const [k, files] of collectLiteralKeys(root)) used.set(k, new Set([...(used.get(k) ?? []), ...files]));
for (const [doc, types] of Object.entries(system.documentTypes)) {
  for (const t of Object.keys(types)) used.set(`TYPES.${doc}.${t}`, new Set(["system.json"]));
}

for (const code of langCodes) {
  for (const [key, files] of used) {
    if (!(key in langs[code])) errors.push(`idioma ${code}: falta "${key}" (usada em ${[...files][0]})`);
  }
  for (const key of Object.keys(langs[code])) {
    if (!used.has(key)) warnings.push(`idioma ${code}: chave possivelmente não usada "${key}"`);
  }
}
if (langCodes.length > 1) {
  const [first, ...others] = langCodes;
  for (const other of others) {
    for (const key of Object.keys(langs[first])) if (!(key in langs[other])) errors.push(`paridade: "${key}" existe em ${first} mas não em ${other}`);
    for (const key of Object.keys(langs[other])) if (!(key in langs[first])) errors.push(`paridade: "${key}" existe em ${other} mas não em ${first}`);
  }
}
// Marcadores {nome} usados nas traduções devem bater entre idiomas
if (langCodes.length > 1) {
  const [first, ...others] = langCodes;
  const vars = (s) => [...String(s).matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort().join(",");
  for (const other of others) {
    for (const key of Object.keys(langs[first])) {
      if (key in langs[other] && vars(langs[first][key]) !== vars(langs[other][key])) {
        errors.push(`marcadores diferentes em "${key}" (${first}: ${vars(langs[first][key])} / ${other}: ${vars(langs[other][key])})`);
      }
    }
  }
}
console.log(`${used.size} chaves usadas; idiomas: ${langCodes.join(", ")}`);

/* -------------------------------------------- */
section("convenções");

// Sem emojis na interface (convenção do projeto): templates, idiomas e CSS
const emoji = /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{1F000}-\u{1F2FF}]/u;
for (const file of [...templates, ...walk(path.join(root, "lang"), (f) => f.endsWith(".json")), path.join(root, "styles/mmrpg.css")]) {
  if (emoji.test(read(file))) errors.push(`emoji encontrado em ${rel(file)}`);
}
console.log("sem emojis na interface");

/* -------------------------------------------- */

console.log("");
for (const w of warnings) console.log(`aviso: ${w}`);
for (const e of errors) console.error(`ERRO: ${e}`);
console.log(`\n${errors.length} erro(s), ${warnings.length} aviso(s)`);
process.exit(errors.length ? 1 : 0);
