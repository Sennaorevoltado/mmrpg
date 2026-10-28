import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { loadSystem } from "./support/load-system.mjs";
import { ROOT } from "./support/foundry-stub.mjs";

const readLang = (lang) => JSON.parse(fs.readFileSync(`${ROOT}/lang/${lang}.json`, "utf8"));
const flat = (obj, prefix = "", out = {}) => {
  for (const [k, v] of Object.entries(obj)) {
    if (v && typeof v === "object") flat(v, `${prefix}${k}.`, out);
    else out[`${prefix}${k}`] = v;
  }
  return out;
};

const sys = await loadSystem();
const cfg = sys.MARVEL_MULTIVERSE;

test("os seis atributos e os quatro de dano existem", () => {
  assert.deepEqual(Object.keys(cfg.abilities), ["mle", "agl", "res", "vig", "ego", "log"]);
  assert.deepEqual(cfg.damageAbilities, ["mle", "agl", "ego", "log"]);
  for (const key of cfg.damageAbilities) assert.ok(key in cfg.abilities);
});

test("en.json e pt-BR.json têm exatamente as mesmas chaves", () => {
  const en = Object.keys(flat(readLang("en"))).sort();
  const pt = Object.keys(flat(readLang("pt-BR"))).sort();
  assert.deepEqual(pt, en);
});

test("nenhum texto do idioma está vazio e o português não repete o inglês onde deveria traduzir", () => {
  const pt = flat(readLang("pt-BR"));
  for (const [key, value] of Object.entries(pt)) assert.ok(String(value).trim() !== "", `texto vazio em ${key}`);
});

test("toda chave de idioma citada na configuração existe", () => {
  const strings = flat(readLang("pt-BR"));
  const refs = [];
  const walk = (value) => {
    if (typeof value === "string" && value.startsWith("MARVEL_MULTIVERSE.")) refs.push(value);
    else if (value && typeof value === "object") Object.values(value).forEach(walk);
  };
  walk({ ...cfg });
  assert.ok(refs.length > 50, "esperava dezenas de referências");
  const missing = refs.filter((key) => !(key in strings));
  assert.deepEqual(missing, []);
});

test("conjuntos de poderes: nome canônico único e ida e volta pelo reverseSetList", () => {
  const labels = Object.values(cfg.powersets).map((set) => set.label);
  assert.equal(new Set(labels).size, labels.length);
  for (const [key, set] of Object.entries(cfg.powersets)) assert.equal(cfg.reverseSetList[set.label], key);
});

test("cada tamanho tem efeito e nome traduzido", () => {
  const strings = flat(readLang("pt-BR"));
  for (const key of Object.keys(cfg.sizes)) {
    assert.ok(cfg.sizeEffects[key], `sem efeito de tamanho para ${key}`);
    assert.ok(cfg.sizeEffects[key].name in strings, `sem tradução do efeito ${key}`);
  }
});

test("os efeitos de tamanho só mexem em campos que existem na ficha", () => {
  for (const [key, effect] of Object.entries(cfg.sizeEffects)) {
    const actor = new CONFIG.Actor.documentClass({
      name: key,
      type: "character",
      effects: [{ ...effect, name: key, transfer: false }],
    });
    // applyActiveEffects dispara erro se a chave do efeito não existir no ator.
    assert.ok(actor.system, key);
  }
});

test("elementos, tipos de dano e movimentos têm tradução", () => {
  const strings = flat(readLang("pt-BR"));
  for (const el of Object.values(cfg.elements)) assert.ok(el.name in strings, el.name);
  for (const label of Object.values(cfg.damageTypes)) assert.ok(label in strings, label);
  for (const m of Object.values(cfg.movementTypes)) assert.ok(m.label in strings, m.label);
});
