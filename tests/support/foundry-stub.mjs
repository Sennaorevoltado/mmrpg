/**
 * Foundry simulado para testes de integração.
 *
 * NÃO é o Foundry: implementa só o suficiente da API (campos de dados, documentos, rolagens,
 * ApplicationV2, Handlebars) para carregar o sistema, validar os esquemas de dados, montar o
 * contexto das fichas e renderizar os templates. Serve para achar erros de código e de dados
 * antes de abrir o Foundry de verdade; não substitui um teste num mundo v14.
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import Handlebars from "handlebars";

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

/* -------------------------------------------- */
/*  Utilitários                                 */
/* -------------------------------------------- */

const isPlain = (v) => v !== null && typeof v === "object" && !Array.isArray(v) && Object.getPrototypeOf(v) === Object.prototype;

let idCounter = 0;
function randomID(length = 16) {
  const chars = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  let id = String(++idCounter).padStart(4, "0");
  while (id.length < length) id += chars[Math.floor(Math.random() * chars.length)];
  return id;
}

function deepClone(value) {
  if (Array.isArray(value)) return value.map(deepClone);
  if (isPlain(value)) return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, deepClone(v)]));
  return value;
}

function getProperty(obj, key) {
  let cur = obj;
  for (const part of String(key).split(".")) {
    if (cur === null || cur === undefined) return undefined;
    cur = cur[part];
  }
  return cur;
}

function setProperty(obj, key, value) {
  const parts = String(key).split(".");
  let cur = obj;
  for (const part of parts.slice(0, -1)) {
    if (!isPlain(cur[part]) && !Array.isArray(cur[part])) cur[part] = {};
    cur = cur[part];
  }
  cur[parts.at(-1)] = value;
  return true;
}

function expandObject(obj) {
  const out = {};
  for (const [key, value] of Object.entries(obj ?? {})) setProperty(out, key, isPlain(value) ? expandObject(value) : value);
  return out;
}

function mergeObject(original, other = {}, { inplace = true, overwrite = true, insertKeys = true } = {}) {
  const target = inplace ? original : deepClone(original);
  const src = expandObject(other);
  for (const [key, value] of Object.entries(src)) {
    if (isPlain(value) && isPlain(target[key])) mergeObject(target[key], value, { inplace: true, overwrite, insertKeys });
    else if (!(key in target) && !insertKeys) continue;
    else if (key in target && !overwrite) continue;
    else target[key] = deepClone(value);
  }
  return target;
}

/* -------------------------------------------- */
/*  Campos de dados                             */
/* -------------------------------------------- */

class DataField {
  constructor(options = {}) {
    this.options = { required: false, nullable: false, ...options };
    this.name = "";
  }
  get initialValue() {
    const i = this.options.initial;
    return typeof i === "function" ? i() : deepClone(i);
  }
  /** Devolve a lista de erros (strings) do valor. */
  check(value, where) {
    if (value === undefined) return this.options.required ? [`${where}: obrigatório e ausente`] : [];
    if (value === null) return this.options.nullable ? [] : [`${where}: não pode ser nulo`];
    return this.checkType(value, where);
  }
  checkType() {
    return [];
  }
  clean(value) {
    return value === undefined ? this.initialValue : value;
  }
}

class StringField extends DataField {
  checkType(value, where) {
    if (typeof value !== "string") return [`${where}: precisa ser texto`];
    if (value === "") return this.options.blank === false ? [`${where}: não pode ficar em branco`] : [];
    const c = this.options.choices;
    if (c) {
      const list = Array.isArray(c) ? c : Object.keys(c);
      if (!list.includes(value)) return [`${where}: "${value}" não está entre as opções`];
    }
    return [];
  }
}
class HTMLField extends StringField {}

class NumberField extends DataField {
  get initialValue() {
    const v = super.initialValue;
    if (v !== undefined) return v;
    return this.options.nullable ? null : undefined;
  }
  checkType(value, where) {
    if (typeof value !== "number" || !Number.isFinite(value)) return [`${where}: precisa ser número`];
    const { integer, min, max } = this.options;
    const errors = [];
    if (integer && !Number.isInteger(value)) errors.push(`${where}: precisa ser inteiro`);
    if (min !== undefined && value < min) errors.push(`${where}: ${value} abaixo do mínimo ${min}`);
    if (max !== undefined && value > max) errors.push(`${where}: ${value} acima do máximo ${max}`);
    return errors;
  }
}

class BooleanField extends DataField {
  get initialValue() {
    const v = super.initialValue;
    return v === undefined ? false : v;
  }
  checkType(value, where) {
    return typeof value === "boolean" ? [] : [`${where}: precisa ser verdadeiro/falso`];
  }
}

class ObjectField extends DataField {
  get initialValue() {
    return super.initialValue ?? {};
  }
  checkType(value, where) {
    return isPlain(value) ? [] : [`${where}: precisa ser objeto`];
  }
}

class SchemaField extends DataField {
  constructor(fields, options) {
    super(options);
    this.fields = fields;
    for (const [name, field] of Object.entries(fields)) field.name = name;
  }
  get initialValue() {
    return Object.fromEntries(Object.entries(this.fields).map(([k, f]) => [k, f.initialValue]));
  }
  clean(value) {
    const src = isPlain(value) ? value : {};
    return Object.fromEntries(Object.entries(this.fields).map(([k, f]) => [k, f.clean(src[k])]));
  }
  checkType(value, where) {
    if (!isPlain(value)) return [`${where}: precisa ser objeto`];
    return Object.entries(this.fields).flatMap(([k, f]) => f.check(value[k], `${where}.${k}`));
  }
}

class ArrayField extends DataField {
  constructor(element, options) {
    super(options);
    this.element = element;
  }
  get initialValue() {
    return super.initialValue ?? [];
  }
  clean(value) {
    if (!Array.isArray(value)) return this.initialValue;
    return value.map((v) => this.element.clean(v));
  }
  checkType(value, where) {
    if (!Array.isArray(value)) return [`${where}: precisa ser lista`];
    return value.flatMap((v, i) => this.element.check(v, `${where}[${i}]`));
  }
}

class EmbeddedDataField extends DataField {
  constructor(model, options) {
    super(options);
    this.model = model;
  }
  get initialValue() {
    return this.model.schema.initialValue;
  }
  clean(value) {
    return this.model.schema.clean(value);
  }
  checkType(value, where) {
    return this.model.schema.checkType(value, where);
  }
}

/* -------------------------------------------- */
/*  Modelos de dados                            */
/* -------------------------------------------- */

class DataModel {
  constructor(data = {}, { parent = null } = {}) {
    this.parent = parent;
    this._source = this.constructor.schema.clean(data);
    this.#build();
  }

  static get schema() {
    if (!Object.hasOwn(this, "_schema")) this._schema = new SchemaField(this.defineSchema());
    return this._schema;
  }

  /** Reconstrói os campos "vivos" a partir da fonte. */
  #build() {
    const live = deepClone(this._source);
    const wrap = (field, value) => {
      if (field instanceof EmbeddedDataField) return new field.model(value, { parent: this });
      if (field instanceof ArrayField) return value.map((v) => wrap(field.element, v));
      if (field instanceof SchemaField) {
        return Object.fromEntries(Object.entries(field.fields).map(([k, f]) => [k, wrap(f, value[k])]));
      }
      return value;
    };
    const built = wrap(this.constructor.schema, live);
    for (const key of Object.keys(this)) if (!["parent", "_source"].includes(key)) delete this[key];
    Object.assign(this, built);
  }

  reset() {
    this.#build();
  }

  updateSource(changes) {
    const merged = mergeObject(this._source, changes, { inplace: false });
    // Arrays inteiros substituem os antigos.
    for (const [key, value] of Object.entries(expandObject(changes))) this.#replaceArrays(merged, key, value);
    this._source = this.constructor.schema.clean(merged);
    this.#build();
    return changes;
  }

  #replaceArrays(target, key, value) {
    if (Array.isArray(value)) target[key] = deepClone(value);
    else if (isPlain(value)) for (const [k, v] of Object.entries(value)) this.#replaceArrays(target[key], k, v);
  }

  toObject() {
    return deepClone(this._source);
  }

  /** Lista de erros do esquema para a fonte atual. */
  validate() {
    return this.constructor.schema.checkType(this._source, this.constructor.name);
  }
}

class TypeDataModel extends DataModel {
  prepareBaseData() {}
  prepareDerivedData() {}
}

/* -------------------------------------------- */
/*  Rolagens                                    */
/* -------------------------------------------- */

/** Gerador de números reproduzível para os testes. */
export const dice = {
  queue: [],
  /** Define as próximas faces (d6) a serem sorteadas. */
  push(...faces) {
    this.queue.push(...faces);
  },
  next() {
    return this.queue.length ? this.queue.shift() : 1 + Math.floor(Math.random() * 6);
  }
};

class Die {
  static DENOMINATION = "d";
  constructor({ number = 1, faces = 6 } = {}) {
    this.number = number;
    this.faces = faces;
    this.results = [];
    this._evaluated = false;
  }
  async evaluate() {
    this.results = Array.from({ length: this.number }, () => ({ result: dice.next(), active: true }));
    this._evaluated = true;
    return this;
  }
  get total() {
    if (!this._evaluated) return undefined;
    return this.results.filter((r) => r.active !== false && !r.discarded).reduce((s, r) => s + r.result, 0);
  }
}

class Roll {
  constructor(formula, data = {}, options = {}) {
    this.formula = formula;
    this.data = data;
    this.options = options;
    this._evaluated = false;
    this.terms = [];
    this.#parse();
  }
  #parse() {
    const tokens = this.formula.replace(/\s+/g, "").match(/[+-]?(\d+d[a-z0-9]+|\d+)/gi) ?? [];
    for (const raw of tokens) {
      const sign = raw.startsWith("-") ? -1 : 1;
      const body = raw.replace(/^[+-]/, "");
      const m = body.match(/^(\d+)d([a-z0-9]+)$/i);
      if (m) {
        const Term = CONFIG.Dice.terms[m[2].toLowerCase()] ?? Die;
        const faces = Number(m[2]) || 6;
        this.terms.push(new Term({ number: Number(m[1]), faces }));
      } else {
        this.terms.push({ number: sign * Number(body), isNumeric: true });
      }
    }
  }
  get dice() {
    return this.terms.filter((t) => t instanceof Die);
  }
  async evaluate() {
    return this._evaluate();
  }
  async _evaluate() {
    for (const t of this.dice) await t.evaluate();
    this._evaluated = true;
    this._total = this.#sum();
    return this;
  }
  #sum() {
    return this.terms.reduce((s, t) => s + (t instanceof Die ? t.total : t.number), 0);
  }
  get total() {
    return this._evaluated ? this._total : undefined;
  }
  async render() {
    return `<div class="roll">${this.total}</div>`;
  }
}

/* -------------------------------------------- */
/*  Documentos                                  */
/* -------------------------------------------- */

class Collection extends Map {
  [Symbol.iterator]() {
    return this.values();
  }
  get contents() {
    return [...this.values()];
  }
  find(fn) {
    return this.contents.find(fn);
  }
  filter(fn) {
    return this.contents.filter(fn);
  }
  map(fn) {
    return this.contents.map(fn);
  }
  some(fn) {
    return this.contents.some(fn);
  }
}

const REGISTRY = new Map();

class ActiveEffect {
  static documentName = "ActiveEffect";
  constructor(data = {}, { parent = null } = {}) {
    this.parent = parent;
    this.id = data._id ?? randomID();
    this._source = deepClone(data);
    Object.assign(this, { name: "", img: null, origin: null, changes: [], flags: {}, description: "", disabled: false, duration: {}, transfer: false }, deepClone(data));
    this.statuses = new Set(data.statuses ?? []);
    this.sheet = { render() {} };
  }
  get documentName() {
    return "ActiveEffect";
  }
  get uuid() {
    return `${this.parent?.uuid ?? "ActiveEffect"}.ActiveEffect.${this.id}`;
  }
  getFlag(scope, key) {
    return getProperty(this.flags, `${scope}.${key}`);
  }
  async update(changes) {
    mergeObject(this, expandObject(changes));
    return this;
  }
  async delete() {
    this.parent.effects.delete(this.id);
    return this;
  }
}

class BaseDocument {
  constructor(data = {}, { parent = null } = {}) {
    this.parent = parent;
    this.id = data._id ?? randomID();
    this.name = data.name ?? "";
    this.type = data.type;
    this.img = data.img ?? null;
    this.sort = data.sort ?? 0;
    this.flags = deepClone(data.flags ?? {});
    this.prototypeToken = deepClone(data.prototypeToken ?? {});
    this.effects = new Collection();
    this.sheet = { render() {} };
    const Model = CONFIG[this.constructor.documentName].dataModels[this.type];
    this.system = new Model(data.system ?? {}, { parent: this });
    for (const e of data.effects ?? []) this.effects.set(e._id ?? randomID(), new ActiveEffect(e, { parent: this }));
    REGISTRY.set(this.uuid, this);
    this.prepareData();
  }

  get _source() {
    return {
      _id: this.id,
      name: this.name,
      type: this.type,
      img: this.img,
      flags: this.flags,
      system: this.system.toObject()
    };
  }

  get documentName() {
    return this.constructor.documentName;
  }
  get uuid() {
    return this.parent ? `${this.parent.uuid}.${this.constructor.documentName}.${this.id}` : `${this.constructor.documentName}.${this.id}`;
  }
  get isOwner() {
    return true;
  }
  get limited() {
    return false;
  }
  get statuses() {
    const set = new Set();
    for (const e of this.effects.contents) for (const s of e.statuses) set.add(s);
    return set;
  }

  prepareData() {
    this.system.reset();
    this.system.prepareBaseData?.();
    this.system.prepareDerivedData?.();
  }

  getFlag(scope, key) {
    return getProperty(this.flags, `${scope}.${key}`);
  }
  async setFlag(scope, key, value) {
    setProperty(this.flags, `${scope}.${key}`, value);
    return this;
  }

  toObject() {
    return deepClone({ ...this._source, effects: this.effects.contents.map((e) => e._source) });
  }

  updateSource(changes) {
    const flat = expandObject(changes);
    const { system, ...rest } = flat;
    for (const [k, v] of Object.entries(rest)) {
      if (k === "flags") mergeObject(this.flags, v);
      else if (k === "prototypeToken") mergeObject(this.prototypeToken, v);
      else this[k] = v;
    }
    if (system) this.system.updateSource(system);
    this.prepareData();
  }

  async update(changes, options = {}) {
    const expanded = expandObject(changes);
    this.updateSource(expanded);
    await Hooks.callAll(`update${this.constructor.documentName}`, this, expanded, options, game.user.id);
    return this;
  }

  async _preCreate() {
    return true;
  }
  async _onCreateDescendantDocuments() {}

  async createEmbeddedDocuments(name, dataArray, options = {}) {
    const created = [];
    for (const data of dataArray) {
      if (name === "ActiveEffect") {
        const effect = new ActiveEffect(data, { parent: this });
        this.effects.set(effect.id, effect);
        created.push(effect);
      } else if (name === "Item") {
        const item = new CONFIG.Item.documentClass(deepClone(data), { parent: this });
        await item._preCreate(data, options, game.user);
        this.items.set(item.id, item);
        REGISTRY.set(item.uuid, item);
        created.push(item);
      } else {
        throw new Error(`Coleção embutida desconhecida: ${name}`);
      }
    }
    if (name === "Item") await this._onCreateDescendantDocuments(this, "items", created, dataArray, options, game.user.id);
    this.prepareData();
    return created;
  }

  async deleteEmbeddedDocuments(name, ids) {
    const coll = name === "ActiveEffect" ? this.effects : this.items;
    for (const id of ids) coll.delete(id);
    return ids;
  }

  async delete() {
    this.parent?.items?.delete(this.id);
    return this;
  }
}

class Actor extends BaseDocument {
  static documentName = "Actor";
  constructor(data, options) {
    super(data, options);
    this.items = new Collection();
    for (const i of data?.items ?? []) {
      const item = new CONFIG.Item.documentClass(i, { parent: this });
      this.items.set(item.id, item);
    }
  }
  static async create(data) {
    const actor = new CONFIG.Actor.documentClass(deepClone(data));
    await actor._preCreate(data, {}, game.user);
    game.actors.set(actor.id, actor);
    return actor;
  }
  getActiveTokens() {
    return [];
  }
  async toggleStatusEffect(statusId, { active } = {}) {
    const existing = this.effects.find((e) => e.statuses.has(statusId));
    const want = active ?? !existing;
    if (want && !existing) await this.createEmbeddedDocuments("ActiveEffect", [{ name: statusId, statuses: [statusId] }]);
    if (!want && existing) await existing.delete();
    return want;
  }
  async rollInitiative() {
    return null;
  }
}

class Item extends BaseDocument {
  static documentName = "Item";
  get actor() {
    return this.parent instanceof Actor ? this.parent : null;
  }
  static async create(data) {
    const item = new CONFIG.Item.documentClass(deepClone(data));
    await item._preCreate(data, {}, game.user);
    game.items.set(item.id, item);
    return item;
  }
}

class Combatant {}

class ChatMessage {
  static documentName = "ChatMessage";
  static getSpeaker({ actor } = {}) {
    return { actor: actor?.id ?? null, alias: actor?.name ?? "" };
  }
  static async create(data, options = {}) {
    const msg = new ChatMessage(data);
    msg.messageMode = options.messageMode;
    game.messages.set(msg.id, msg);
    return msg;
  }
  constructor(data) {
    this.id = randomID();
    this.content = data.content ?? "";
    this.speaker = data.speaker ?? {};
    this.flags = deepClone(data.flags ?? {});
    this.rolls = data.rolls ?? [];
    this.author = game.user;
  }
  getFlag(scope, key) {
    return getProperty(this.flags, `${scope}.${key}`);
  }
  async update(changes) {
    for (const [key, value] of Object.entries(changes)) {
      if (key === "content") this.content = value;
      else setProperty(this, key, value);
    }
    return this;
  }
}

/* -------------------------------------------- */
/*  Aplicações (ApplicationV2)                  */
/* -------------------------------------------- */

class ApplicationV2 {
  static DEFAULT_OPTIONS = {};
  static PARTS = {};
  constructor(options = {}) {
    this.options = { ...options };
    this.id = options.id ?? "app";
    this.rendered = false;
    this.element = makeElement();
  }
  async _prepareContext() {
    return {};
  }
  _onRender() {}
  _onClose() {}
  async render() {
    this.rendered = true;
    return this;
  }
  async close() {
    this._onClose({});
  }
}

/** Mixin que renderiza as PARTS com Handlebars (como o do Foundry, sem o tratamento de DOM). */
function HandlebarsApplicationMixin(Base) {
  return class extends Base {
    /** Renderiza todas as partes e devolve o HTML (apenas para testes). */
    async renderToString(options = {}) {
      const context = await this._prepareContext(options);
      let html = "";
      for (const part of Object.values(this.constructor.PARTS)) {
        html += await renderTemplate(part.template, context);
      }
      return html;
    }
  };
}

function makeElement() {
  return { querySelectorAll: () => [], querySelector: () => null };
}

class DocumentSheetV2 extends ApplicationV2 {
  constructor(options = {}) {
    super(options);
    this.document = options.document;
  }
  get isEditable() {
    return true;
  }
  async _prepareContext() {
    return { document: this.document, editable: this.isEditable, owner: this.document.isOwner };
  }
}
class ActorSheetV2 extends DocumentSheetV2 {
  get actor() {
    return this.document;
  }
}
class ItemSheetV2 extends DocumentSheetV2 {
  get item() {
    return this.document;
  }
}

class DialogV2 {
  static answer = null;
  static async prompt() {
    return DialogV2.answer;
  }
  static async confirm() {
    return true;
  }
}

class FormDataExtended {
  constructor(form) {
    this.object = form?.data ?? {};
  }
}

/* -------------------------------------------- */
/*  Templates                                   */
/* -------------------------------------------- */

function templatePath(p) {
  return path.join(ROOT, p.replace(/^systems\/mmrpg\//, ""));
}

const compiled = new Map();
const partialNames = new Set();

export async function loadTemplates(paths) {
  for (const p of paths) {
    const src = fs.readFileSync(templatePath(p), "utf8");
    Handlebars.registerPartial(p, src);
    partialNames.add(p);
    compiled.set(p, Handlebars.compile(src));
  }
  return paths.map((p) => compiled.get(p));
}

export async function renderTemplate(p, data) {
  if (!compiled.has(p)) await loadTemplates([p]);
  return compiled.get(p)(data, { allowProtoMethodsByDefault: true, allowProtoPropertiesByDefault: true });
}

function registerCoreHelpers() {
  const H = Handlebars;
  H.registerHelper("localize", (key, opts) => {
    if (typeof key !== "string") throw new Error(`{{localize}} recebeu ${String(key)} em vez de uma chave`);
    return game.i18n.format(key, opts?.hash ?? {});
  });
  H.registerHelper("eq", (a, b) => a === b);
  H.registerHelper("ne", (a, b) => a !== b);
  H.registerHelper("lt", (a, b) => a < b);
  H.registerHelper("gt", (a, b) => a > b);
  H.registerHelper("lte", (a, b) => a <= b);
  H.registerHelper("gte", (a, b) => a >= b);
  H.registerHelper("and", (...args) => args.slice(0, -1).every(Boolean));
  H.registerHelper("or", (...args) => args.slice(0, -1).some(Boolean));
  H.registerHelper("not", (a) => !a);
}

/* -------------------------------------------- */
/*  Instalação                                  */
/* -------------------------------------------- */

function flatten(obj, prefix = "", out = {}) {
  for (const [k, v] of Object.entries(obj)) {
    const key = prefix ? `${prefix}.${k}` : k;
    if (isPlain(v)) flatten(v, key, out);
    else out[key] = v;
  }
  return out;
}

/**
 * Instala os globais do Foundry simulado.
 * @param {object} [options]
 * @param {string} [options.lang="pt-BR"]
 * @returns {object} Ferramentas de teste (chaves de tradução ausentes, notificações, hooks…).
 */
export function installFoundry({ lang = "pt-BR" } = {}) {
  const strings = flatten(JSON.parse(fs.readFileSync(path.join(ROOT, "lang", `${lang}.json`), "utf8")));
  const missingKeys = new Set();
  const notices = { warn: [], info: [], error: [] };
  const hooks = new Map();
  const socketHandlers = [];
  const emitted = [];

  const i18n = {
    localize(key) {
      if (key in strings) return strings[key];
      if (/^(MMRPG|TYPES)\./.test(key)) missingKeys.add(key);
      return key;
    },
    format(key, data = {}) {
      return i18n.localize(key).replace(/\{(\w+)\}/g, (_, k) => (k in data ? String(data[k]) : `{${k}}`));
    },
    has: (key) => key in strings
  };

  const settingsStore = new Map();
  const settings = {
    settings: new Map(),
    menus: new Map(),
    register(scope, key, data) {
      settings.settings.set(`${scope}.${key}`, data);
      settingsStore.set(`${scope}.${key}`, data.default);
    },
    registerMenu(scope, key, data) {
      settings.menus.set(`${scope}.${key}`, data);
    },
    get(scope, key) {
      const id = `${scope}.${key}`;
      if (!settings.settings.has(id)) throw new Error(`Configuração não registrada: ${id}`);
      return settingsStore.get(id);
    },
    set(scope, key, value) {
      settingsStore.set(`${scope}.${key}`, value);
    }
  };

  const user = { id: "gm1", isGM: true, isActiveGM: true, color: "#cc2222", targets: new Set(), assignHotbarMacro() {} };
  const registeredSheets = [];

  const sheetRegistry = (documentName) => ({
    registerSheet: (scope, cls, opts) => registeredSheets.push({ documentName, scope, cls, opts }),
    unregisterSheet: () => {}
  });

  Handlebars.registerHelper; // garante uso do módulo importado
  registerCoreHelpers();

  const g = globalThis;
  g.Handlebars = Handlebars;
  g.HTMLElement = class HTMLElement {};
  g.Roll = Roll;
  g.Actor = Actor;
  g.Item = Item;
  g.Combatant = Combatant;
  g.ChatMessage = ChatMessage;
  g.ActiveEffect = ActiveEffect;
  g.Folder = { create: async (d) => ({ id: randomID(), ...d }) };
  g.Macro = { create: async (d) => ({ id: randomID(), ...d }) };

  g.foundry = {
    utils: {
      randomID,
      deepClone,
      getProperty,
      setProperty,
      mergeObject,
      expandObject,
      saveDataToFile: () => {}
    },
    abstract: { DataModel, TypeDataModel },
    data: { fields: { DataField, StringField, HTMLField, NumberField, BooleanField, ObjectField, SchemaField, ArrayField, EmbeddedDataField } },
    dice: { terms: { Die } },
    documents: { collections: { Actors: sheetRegistry("Actor"), Items: sheetRegistry("Item") } },
    applications: {
      api: { ApplicationV2, HandlebarsApplicationMixin, DialogV2 },
      sheets: { ActorSheetV2, ItemSheetV2 },
      ux: {
        TextEditor: { implementation: { enrichHTML: async (html) => html ?? "", getDragEventData: () => ({}) } },
        FormDataExtended
      },
      handlebars: { renderTemplate, loadTemplates },
      apps: { FilePicker: { implementation: class FilePicker { browse() {} } } }
    }
  };

  g.CONFIG = {
    Actor: { dataModels: {}, documentClass: Actor },
    Item: { dataModels: {}, documentClass: Item },
    Combatant: { documentClass: Combatant },
    Combat: {},
    Dice: { terms: { d: Die }, rolls: [] },
    statusEffects: [],
    specialStatusEffects: {},
    ChatMessage: {}
  };
  g.CONST = {
    ACTIVE_EFFECT_MODES: { MULTIPLY: 1, ADD: 2, DOWNGRADE: 3, UPGRADE: 4, OVERRIDE: 5 },
    TOKEN_DISPLAY_MODES: { OWNER: 40 },
    TOKEN_DISPOSITIONS: { HOSTILE: -1, NEUTRAL: 0, FRIENDLY: 1 }
  };

  g.Hooks = {
    once(name, fn) {
      hooks.set(name, [...(hooks.get(name) ?? []), { fn, once: true }]);
    },
    on(name, fn) {
      hooks.set(name, [...(hooks.get(name) ?? []), { fn, once: false }]);
    },
    async callAll(name, ...args) {
      const list = hooks.get(name) ?? [];
      hooks.set(name, list.filter((h) => !h.once));
      const results = [];
      for (const h of list) results.push(await h.fn(...args));
      return results;
    }
  };

  g.game = {
    i18n,
    settings,
    user,
    users: { get: (id) => (id === user.id ? user : null), activeGM: user },
    actors: new Collection(),
    items: new Collection(),
    messages: new Collection(),
    macros: { find: () => null },
    folders: { find: () => null },
    combat: null,
    world: { title: "Mundo de teste" },
    socket: { on: (name, fn) => socketHandlers.push({ name, fn }), emit: (name, data) => emitted.push({ name, data }) },
    dice: {}
  };

  g.ui = {
    notifications: {
      warn: (m) => notices.warn.push(m),
      info: (m) => notices.info.push(m),
      error: (m) => notices.error.push(m)
    }
  };
  g.canvas = { tokens: { controlled: [] }, grid: null, scene: null, dimensions: { distance: 5 } };
  g.fromUuid = async (uuid) => REGISTRY.get(uuid) ?? null;
  g.fromUuidSync = (uuid) => REGISTRY.get(uuid) ?? null;

  return { missingKeys, notices, hooks, socketHandlers, emitted, registeredSheets, REGISTRY, user, settings };
}

export { Handlebars, Die, Roll, Actor, Item, ChatMessage, ApplicationV2, DialogV2, TypeDataModel, DataModel };
