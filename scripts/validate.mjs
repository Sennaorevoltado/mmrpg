/**
 * Validação estática do sistema (sem Foundry).
 *
 * Confere: system.json, grafo de importações, templates (sintaxe Handlebars e parciais),
 * chaves de idioma (paridade pt-BR/en, uso e as montadas em código), o CSS e as convenções
 * do projeto (sem emoji, sem arquivos de conteúdo privado, sem endereços externos na interface).
 *
 * Uso: node scripts/validate.mjs
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import Handlebars from "handlebars";
import { MARVEL_MULTIVERSE } from "../module/config.mjs";
import { TEMPLATE_PATHS } from "../module/helpers/templates.mjs";
import { ITEM_TYPES } from "../module/helpers/importer.mjs";
import { FORM_CHANGE_TYPES, FORM_KINDS, FORM_RANK_MODES } from "../module/helpers/forms.mjs";
import { walk, collectLiteralKeys, collectConfigKeys, flatten } from "./lib/keys.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SYSTEM_ID = "mmrpg";
const errors = [];
const warnings = [];
const rel = (f) => path.relative(root, f).split(path.sep).join("/");
const read = (f) => fs.readFileSync(f, "utf8");
const exists = (p) => fs.existsSync(path.join(root, p));

function section(title) {
  console.log(`\n== ${title}`);
}

/* -------------------------------------------- */
section("system.json");

const system = JSON.parse(read(path.join(root, "system.json")));
for (const field of ["id", "title", "version", "compatibility", "esmodules", "languages", "documentTypes", "license", "readme"]) {
  if (!system[field]) errors.push(`system.json: campo "${field}" ausente`);
}
if (system.id !== SYSTEM_ID) errors.push(`system.json: id "${system.id}" deveria ser "${SYSTEM_ID}" (os caminhos dos templates usam esse id)`);
if (!/^\d+\.\d+\.\d+$/.test(system.version ?? "")) errors.push(`system.json: versão "${system.version}" não é x.y.z`);
const pkg = JSON.parse(read(path.join(root, "package.json")));
if (pkg.version !== system.version) errors.push(`package.json (${pkg.version}) e system.json (${system.version}) têm versões diferentes`);
for (const f of [...(system.esmodules ?? []), ...(system.styles ?? []), system.license, system.readme]) {
  if (f && !exists(f)) errors.push(`system.json: arquivo não encontrado: ${f}`);
}
for (const l of system.languages ?? []) {
  if (!exists(l.path)) errors.push(`system.json: idioma não encontrado: ${l.path}`);
}

const entry = read(path.join(root, "mmrpg.mjs"));
const registered = (documentName) => {
  const m = entry.match(new RegExp(`CONFIG\\.${documentName}\\.dataModels\\s*=\\s*\\{([\\s\\S]*?)\\};`));
  return m ? [...m[1].matchAll(/^\s*(\w+):/gm)].map((x) => x[1]).sort() : [];
};
const declared = (documentName) => Object.keys(system.documentTypes?.[documentName] ?? {}).sort();
for (const documentName of ["Actor", "Item"]) {
  if (JSON.stringify(declared(documentName)) !== JSON.stringify(registered(documentName))) {
    errors.push(`${documentName}: system.json declara [${declared(documentName)}] mas o código registra [${registered(documentName)}]`);
  }
}
if (JSON.stringify(declared("Item")) !== JSON.stringify([...ITEM_TYPES].sort())) {
  errors.push(`Item: system.json [${declared("Item")}] difere dos tipos que o importador aceita [${[...ITEM_TYPES].sort()}]`);
}
console.log(`  v${system.version}, atores: ${declared("Actor").join(", ")}; itens: ${declared("Item").join(", ")}`);

/* -------------------------------------------- */
section("Importações");

const modules = [path.join(root, "mmrpg.mjs"), ...walk(path.join(root, "module"), (f) => f.endsWith(".mjs"))];
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
const prefix = `systems/${SYSTEM_ID}/`;
for (const file of templates) {
  const text = read(file);
  try {
    Handlebars.precompile(text);
  } catch (err) {
    errors.push(`${rel(file)}: Handlebars inválido (${err.message.split("\n")[0]})`);
  }
  for (const m of text.matchAll(/\{\{>\s*["']([^"']+)["']/g)) {
    const p = m[1].replace(prefix, "");
    if (!exists(p)) errors.push(`${rel(file)}: parcial "${m[1]}" não existe`);
  }
}

const listed = new Set(TEMPLATE_PATHS.map((p) => p.replace(prefix, "")));
for (const p of listed) if (!exists(p)) errors.push(`TEMPLATE_PATHS aponta para "${p}", que não existe`);
for (const file of templates) {
  const p = rel(file);
  if (p.includes("/parts/") && !listed.has(p)) errors.push(`${p}: parcial fora de TEMPLATE_PATHS (não seria pré-carregado)`);
}

// Cada tipo de documento tem a sua ficha.
for (const type of declared("Actor")) {
  if (!exists(`templates/actor/actor-${type}-sheet.hbs`)) errors.push(`falta templates/actor/actor-${type}-sheet.hbs`);
}
for (const type of declared("Item")) {
  if (!exists(`templates/item/item-${type}-sheet.hbs`)) errors.push(`falta templates/item/item-${type}-sheet.hbs`);
}
// Templates citados no código existem.
for (const file of modules) {
  for (const m of read(file).matchAll(/systems\/mmrpg\/(templates\/[^`"'$]+?\.hbs)/g)) {
    if (!exists(m[1])) errors.push(`${rel(file)}: template "${m[1]}" não existe`);
  }
}
console.log(`  ${templates.length} templates, ${listed.size} parciais pré-carregados`);

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
const placeholders = (text) => [...String(text).matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort().join(",");
for (const [lang, strings] of Object.entries(langs)) {
  for (const [k, v] of Object.entries(strings)) {
    if (typeof v !== "string" || !v.trim()) errors.push(`${lang}: ${k} vazio`);
    else if (k in base && placeholders(v) !== placeholders(base[k])) {
      errors.push(`${lang}: ${k} usa {${placeholders(v)}} e pt-BR usa {${placeholders(base[k])}}`);
    }
  }
}

// Chaves montadas em código: precisam existir para todo valor possível.
const dynamic = collectConfigKeys(MARVEL_MULTIVERSE);
for (const key of Object.keys(MARVEL_MULTIVERSE.abilities)) dynamic.add(MARVEL_MULTIVERSE.abilities[key].replace(/\.long$/, ".abbr"));
for (const field of ["action", "trigger", "duration", "range", "cost"]) dynamic.add(`MARVEL_MULTIVERSE.Item.Field.${field}`);
for (const key of ["traits", "tags", "powers"]) dynamic.add(`MARVEL_MULTIVERSE.Item.Grants.${key}`);
for (const type of ITEM_TYPES) dynamic.add(`MARVEL_MULTIVERSE.Import.Folder.${type}`);
for (const type of declared("Actor")) dynamic.add(`TYPES.Actor.${type}`);
for (const type of declared("Item")) dynamic.add(`TYPES.Item.${type}`);
for (const size of Object.keys(MARVEL_MULTIVERSE.sizes)) dynamic.add(`MARVEL_MULTIVERSE.SizeEffect.${size}`);
for (const kind of FORM_KINDS) {
  dynamic.add(`MARVEL_MULTIVERSE.Form.Kind.${kind}`);
  dynamic.add(`MARVEL_MULTIVERSE.Form.KindPlural.${kind}`);
}
for (const mode of FORM_RANK_MODES) dynamic.add(`MARVEL_MULTIVERSE.Form.RankMode.${mode}`);
for (const type of FORM_CHANGE_TYPES) dynamic.add(`MARVEL_MULTIVERSE.Form.ChangeType.${type}`);

const literal = collectLiteralKeys(root);
for (const [key, files] of literal) {
  // Textos do próprio Foundry (DOCUMENT.New etc.) não são nossos.
  if (!key.startsWith("MARVEL_MULTIVERSE.") && !key.startsWith("TYPES.")) continue;
  if (!(key in base)) errors.push(`chave de idioma usada e inexistente: ${key} (${[...files].join(", ")})`);
}
for (const key of dynamic) if (!(key in base)) errors.push(`chave de idioma montada em código e inexistente: ${key}`);
const known = new Set([...literal.keys(), ...dynamic]);
for (const k of Object.keys(base)) if (!known.has(k)) warnings.push(`chave de idioma sem uso: ${k}`);
console.log(`  ${Object.keys(base).length} chaves em pt-BR, ${literal.size} usadas literalmente, ${dynamic.size} montadas em código`);

/* -------------------------------------------- */
section("CSS");

for (const f of system.styles ?? []) {
  const css = read(path.join(root, f));
  for (const m of css.matchAll(/\/\*([\s\S]*?)\*\//g)) {
    if (/\/\*/.test(m[1])) warnings.push(`${f}: comentário contém "/*" aninhado`);
  }
  const stripped = css.replace(/\/\*[\s\S]*?\*\//g, "");
  if (/\/\*|\*\//.test(stripped)) errors.push(`${f}: comentário mal fechado ou "*/" solto`);
  const open = (stripped.match(/\{/g) ?? []).length;
  const close = (stripped.match(/\}/g) ?? []).length;
  if (open !== close) errors.push(`${f}: chaves desbalanceadas ({ ${open} / } ${close})`);

  for (const m of stripped.matchAll(/url\(["']?([^"')]+)["']?\)/g)) {
    if (/^data:/.test(m[1])) continue;
    if (/^(https?:)?\/\//.test(m[1])) {
      errors.push(`${f}: url(${m[1]}) aponta para fora do sistema`);
      continue;
    }
    const target = m[1].startsWith("systems/") ? path.join(root, m[1].replace(prefix, "")) : path.resolve(path.dirname(path.join(root, f)), m[1]);
    if (!fs.existsSync(target)) errors.push(`${f}: url(${m[1]}) não existe`);
  }
  if (/@import/.test(stripped)) errors.push(`${f}: @import (o sistema não carrega nada de fora)`);
}

/* -------------------------------------------- */
section("Convenções");

const emoji = /\p{Extended_Pictographic}/u;
const uiFiles = [...templates, ...walk(path.join(root, "lang"), (f) => f.endsWith(".json")), ...walk(path.join(root, "css"), (f) => f.endsWith(".css"))];
for (const file of uiFiles) {
  if (emoji.test(read(file))) errors.push(`${rel(file)}: contém emoji`);
}

// Nada da interface busca coisas na internet.
for (const file of [...templates, ...walk(path.join(root, "css"), (f) => f.endsWith(".css"))]) {
  for (const m of read(file).matchAll(/(?:src|href)\s*=\s*["'](https?:\/\/[^"']+)["']/g)) {
    errors.push(`${rel(file)}: endereço externo na interface (${m[1]})`);
  }
}

// Conteúdo de livro nunca entra no repositório nem no pacote.
const privados = walk(root, (f) => /\.privado\.json$/.test(f) || /conteudo-privado/.test(f));
for (const file of privados) errors.push(`${rel(file)}: conteúdo privado dentro do projeto`);

for (const required of ["LICENSE", "NOTICE", "README.md", "system.json", ".github/workflows/release.yml"]) {
  if (!exists(required)) errors.push(`${required} ausente`);
}
if (exists("LICENSE.txt")) warnings.push("LICENSE.txt sobrando: o sistema aponta para LICENSE");

/* -------------------------------------------- */

for (const w of warnings) console.log(`  aviso: ${w}`);
if (errors.length) {
  console.log(`\n${errors.length} erro(s):`);
  for (const e of errors) console.log(`  - ${e}`);
  process.exit(1);
}
console.log("\nTudo certo.");
