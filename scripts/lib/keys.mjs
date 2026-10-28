/**
 * Extração das chaves de idioma usadas no código e nos templates.
 */

import fs from "node:fs";
import path from "node:path";

export function walk(dir, filter, out = []) {
  if (!fs.existsSync(dir)) return out;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === "node_modules" || entry.name.startsWith(".")) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, filter, out);
    else if (filter(full)) out.push(full);
  }
  return out;
}

/** Strings "MARVEL_MULTIVERSE.*" dentro de um objeto (qualquer profundidade). */
export function collectConfigKeys(value, out = new Set()) {
  if (typeof value === "string") {
    if (/^MARVEL_MULTIVERSE\.[A-Za-z0-9_.]+$/.test(value)) out.add(value);
  } else if (Array.isArray(value)) {
    for (const v of value) collectConfigKeys(v, out);
  } else if (value && typeof value === "object") {
    for (const v of Object.values(value)) collectConfigKeys(v, out);
  }
  return out;
}

/** Chaves literais usadas em templates (.hbs) e código (.mjs). */
export function collectLiteralKeys(root) {
  const keys = new Map(); // chave -> arquivos
  const add = (key, file) => {
    if (!keys.has(key)) keys.set(key, new Set());
    keys.get(key).add(path.relative(root, file));
  };

  for (const file of walk(path.join(root, "templates"), (f) => f.endsWith(".hbs"))) {
    const text = fs.readFileSync(file, "utf8");
    for (const m of text.matchAll(/localize\s+["']([^"']+)["']/g)) add(m[1], file);
  }

  const code = [path.join(root, "mmrpg.mjs"), ...walk(path.join(root, "module"), (f) => f.endsWith(".mjs"))];
  for (const file of code) {
    const text = fs.readFileSync(file, "utf8");
    for (const m of text.matchAll(/(?:localize|format)\(\s*["']([^"'$]+)["']/g)) add(m[1], file);
    for (const m of text.matchAll(/["'](MARVEL_MULTIVERSE\.[A-Za-z0-9_.]+)["']/g)) add(m[1], file);
    for (const m of text.matchAll(/["'](TYPES\.[A-Za-z0-9_.]+)["']/g)) add(m[1], file);
  }
  return keys;
}

/** Achata um objeto aninhado em chaves com ponto. */
export function flatten(obj, prefix = "", out = {}) {
  for (const [k, v] of Object.entries(obj)) {
    const key = prefix ? `${prefix}.${k}` : k;
    if (v && typeof v === "object" && !Array.isArray(v)) flatten(v, key, out);
    else out[key] = v;
  }
  return out;
}
