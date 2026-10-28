/**
 * Validação estática do sistema (sem Foundry).
 *
 * Confere: system.json, grafo de importações, templates (sintaxe Handlebars e parciais),
 * chaves de idioma (paridade pt-BR/en, uso e as montadas em código), a ligação entre
 * data-action dos templates e as ações das fichas, e o CSS (chaves, comentários, fontes,
 * variáveis).
 *
 * Uso: node scripts/validate.mjs
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import Handlebars from "handlebars";
import { MMRPG } from "../module/config.mjs";
import { APPEARANCE } from "../module/helpers/appearance.mjs";
import { TEMPLATE_PATHS } from "../module/helpers/handlebars.mjs";
import { walk, collectLiteralKeys, flatten } from "./lib/keys.mjs";

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
if (!/^\d+\.\d+\.\d+$/.test(system.version ?? "")) errors.push(`system.json: versão "${system.version}" não é x.y.z`);
const pkg = JSON.parse(read(path.join(root, "package.json")));
if (pkg.version !== system.version) errors.push(`package.json (${pkg.version}) e system.json (${system.version}) têm versões diferentes`);
for (const f of [...(system.esmodules ?? []), ...(system.styles ?? [])]) {
  if (!exists(f)) errors.push(`system.json: arquivo não encontrado: ${f}`);
}
for (const l of system.languages ?? []) {
  if (!exists(l.path)) errors.push(`system.json: idioma não encontrado: ${l.path}`);
}

const entry = read(path.join(root, "module/mmrpg.mjs"));
const registeredActors = (() => {
  const m = entry.match(/CONFIG\.Actor\.dataModels,\s*\{([\s\S]*?)\}\)/);
  return m ? [...m[1].matchAll(/^\s*(\w+):/gm)].map((x) => x[1]).sort() : [];
})();
const declaredActors = Object.keys(system.documentTypes.Actor ?? {}).sort();
if (JSON.stringify(declaredActors) !== JSON.stringify(registeredActors)) {
  errors.push(`Actor: system.json declara [${declaredActors}] mas o código registra [${registeredActors}]`);
}
console.log(`  v${system.version}, tipos de ator: ${declaredActors.join(", ")}`);

/* -------------------------------------------- */
section("Importações");

const modules = walk(path.join(root, "module"), (f) => f.endsWith(".mjs"));
for (const file of modules) {
  const text = read(file);
  for (const m of text.matchAll(/(?:import|export)\s[^"']*?from\s+["'](\.[^"']+)["']|import\(\s*["'](\.[^"']+)["']\s*\)/g)) {
    const target = path.resolve(path.dirname(file), m[1] ?? m[2]);
    if (!fs.existsSync(target)) errors.push(`${rel(file)}: importa "${m[1] ?? m[2]}", que não existe`);
  }
}
console.log(`  ${modules.length} módulos`);

/* -------------------------------------------- */
section("Templates");

const templates = walk(path.join(root, "templates"), (f) => f.endsWith(".hbs"));
for (const file of templates) {
  const text = read(file);
  try {
    Handlebars.precompile(text);
  } catch (err) {
    errors.push(`${rel(file)}: Handlebars inválido (${err.message.split("\n")[0]})`);
  }
  for (const m of text.matchAll(/\{\{>\s*["']([^"']+)["']/g)) {
    const p = m[1].replace(`${MMRPG.path}/`, "");
    if (!exists(p)) errors.push(`${rel(file)}: parcial "${m[1]}" não existe`);
  }
}
const listed = new Set(TEMPLATE_PATHS.map((p) => p.replace(`${MMRPG.path}/`, "")));
for (const file of templates) {
  const p = path.relative(root, file).split(path.sep).join("/");
  if (!listed.has(p)) errors.push(`${p}: não está em TEMPLATE_PATHS (não seria pré-carregado)`);
}
for (const p of listed) if (!exists(p)) errors.push(`TEMPLATE_PATHS aponta para "${p}", que não existe`);
for (const file of modules) {
  for (const m of read(file).matchAll(/\$\{MMRPG\.path\}\/(templates\/[^`"'$]+)/g)) {
    if (!exists(m[1])) errors.push(`${rel(file)}: template "${m[1]}" não existe`);
    else if (!listed.has(m[1])) errors.push(`${rel(file)}: template "${m[1]}" não está em TEMPLATE_PATHS`);
  }
}
console.log(`  ${templates.length} templates`);

/* -------------------------------------------- */
section("Ações (data-action)");

const handlers = new Set(["editImage"]);
for (const file of modules) {
  for (const block of read(file).matchAll(/actions:\s*\{([\s\S]*?)\n\s*\}/g)) {
    for (const m of block[1].matchAll(/^\s*(\w+):/gm)) handlers.add(m[1]);
  }
}
const used = new Set();
for (const file of templates) {
  for (const m of read(file).matchAll(/data-action="(\w+)"/g)) {
    used.add(m[1]);
    if (!handlers.has(m[1])) errors.push(`${rel(file)}: data-action="${m[1]}" sem manipulador`);
  }
}
const FROM_MENU = new Set(["editImage", "openAppearance"]); // vêm do menu da janela, não de um template
for (const h of handlers) if (!FROM_MENU.has(h) && !used.has(h)) warnings.push(`ação "${h}" existe mas nenhum template a usa`);
console.log(`  ${used.size} ações usadas, ${handlers.size} manipuladores`);

/* -------------------------------------------- */
section("Idiomas");

const langs = {};
for (const l of system.languages ?? []) langs[l.lang] = flatten(JSON.parse(read(path.join(root, l.path))));
const base = langs["pt-BR"] ?? {};
for (const [lang, strings] of Object.entries(langs)) {
  if (lang === "pt-BR") continue;
  for (const k of Object.keys(base)) if (!(k in strings)) errors.push(`${lang}: falta a chave ${k}`);
  for (const k of Object.keys(strings)) if (!(k in base)) errors.push(`${lang}: chave ${k} não existe em pt-BR`);
}
for (const [lang, strings] of Object.entries(langs)) {
  for (const [k, v] of Object.entries(strings)) {
    if (typeof v !== "string" || !v.trim()) errors.push(`${lang}: ${k} vazio`);
    for (const m of v.matchAll(/\{(\w+)\}/g)) {
      const other = base[k]?.match(/\{(\w+)\}/g) ?? [];
      if (lang !== "pt-BR" && !other.includes(m[0])) errors.push(`${lang}: ${k} usa ${m[0]}, que a versão pt-BR não usa`);
    }
  }
}

// Chaves montadas em código: precisam existir para todo valor possível.
const dynamic = new Set();
for (const key of MMRPG.abilities) {
  dynamic.add(`MMRPG.Ability.${key}.abbr`);
  dynamic.add(`MMRPG.Ability.${key}.long`);
}
for (const key of ["health", "focus", "karma"]) dynamic.add(`MMRPG.Resource.${key}`);
for (const status of ["unset", "open", "done", "over"]) dynamic.add(`MMRPG.Creation.points.${status}`);
for (const [key, def] of Object.entries(APPEARANCE)) {
  dynamic.add(`MMRPG.Appearance.${key}.name`);
  dynamic.add(`MMRPG.Appearance.${key}.hint`);
  for (const choice of def.choices) dynamic.add(`MMRPG.Appearance.${key}.${choice}`);
}
for (const type of declaredActors) dynamic.add(`TYPES.Actor.${type}`);

const literal = collectLiteralKeys(root);
for (const [key, files] of literal) {
  if (!(key in base)) errors.push(`chave de idioma usada e inexistente: ${key} (${[...files].join(", ")})`);
}
for (const key of dynamic) if (!(key in base)) errors.push(`chave de idioma montada em código e inexistente: ${key}`);
const known = new Set([...literal.keys(), ...dynamic]);
const orphans = Object.keys(base).filter((k) => !known.has(k));
for (const k of orphans) warnings.push(`chave de idioma sem uso: ${k}`);
console.log(`  ${Object.keys(base).length} chaves em pt-BR, ${literal.size} usadas literalmente, ${dynamic.size} montadas em código`);

/* -------------------------------------------- */
section("CSS");

for (const f of system.styles ?? []) {
  const css = read(path.join(root, f));
  // "*/" dentro de um comentário o encerra antes da hora.
  for (const m of css.matchAll(/\/\*([\s\S]*?)\*\//g)) {
    if (/\/\*/.test(m[1])) warnings.push(`${f}: comentário contém "/*" aninhado`);
  }
  const stripped = css.replace(/\/\*[\s\S]*?\*\//g, "");
  if (/\/\*|\*\//.test(stripped)) errors.push(`${f}: comentário mal fechado ou "*/" solto`);
  const open = (stripped.match(/\{/g) ?? []).length;
  const close = (stripped.match(/\}/g) ?? []).length;
  if (open !== close) errors.push(`${f}: chaves desbalanceadas ({ ${open} / } ${close})`);

  for (const m of stripped.matchAll(/url\(["']?([^"')]+)["']?\)/g)) {
    if (/^(data:|https?:)/.test(m[1])) continue;
    const target = path.resolve(path.dirname(path.join(root, f)), m[1]);
    if (!fs.existsSync(target)) errors.push(`${f}: url(${m[1]}) não existe`);
  }

  const defined = new Set([...stripped.matchAll(/(--mm-[\w-]+)\s*:/g)].map((m) => m[1]));
  for (const m of stripped.matchAll(/var\((--mm-[\w-]+)/g)) {
    if (!defined.has(m[1])) errors.push(`${f}: variável ${m[1]} usada e nunca definida`);
  }
}

/* -------------------------------------------- */
section("Convenções");

// Sem emojis na interface (ícones são Font Awesome).
const emoji = /\p{Extended_Pictographic}/u;
for (const file of [...templates, ...walk(path.join(root, "lang"), (f) => f.endsWith(".json")), ...walk(path.join(root, "styles"), (f) => f.endsWith(".css"))]) {
  if (emoji.test(read(file))) errors.push(`${rel(file)}: contém emoji`);
}
for (const required of ["LICENSE", "NOTICE", "README.md"]) {
  if (!exists(required)) errors.push(`${required} ausente`);
}
if (!exists(".github/workflows/release.yml")) errors.push(".github/workflows/release.yml ausente");

/* -------------------------------------------- */

for (const w of warnings) console.log(`  aviso: ${w}`);
if (errors.length) {
  console.log(`\n${errors.length} erro(s):`);
  for (const e of errors) console.log(`  - ${e}`);
  process.exit(1);
}
console.log("\nTudo certo.");
