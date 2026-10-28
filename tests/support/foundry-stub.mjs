/**
 * Foundry simulado para os testes.
 *
 * NÃO é o Foundry: implementa só o suficiente da API (campos de dados, documentos, efeitos ativos,
 * janelas antigas ActorSheet/ItemSheet, Handlebars) para carregar o sistema, validar os esquemas,
 * montar o contexto das fichas e renderizar os modelos. Serve para achar erros de código, de dados
 * e de texto antes de abrir o Foundry de verdade; NÃO substitui um teste num mundo v13/v14 real.
 * As rolagens de dados não são simuladas: o que depende do sorteio fica de fora dos testes.
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
  get initialValue() {
    const v = super.initialValue;
    if (v !== undefined) return v;
    return this.options.blank === false ? undefined : this.options.nullable ? null : "";
  }
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

/** Os valores já preparados do modelo (com cálculos derivados e efeitos), como `toObject(false)`. */
DataModel.prototype.liveObject = function liveObject() {
  const out = {};
  for (const key of Object.keys(this.constructor.schema.fields)) out[key] = deepClone(this[key]);
  return out;
};

/* -------------------------------------------- */
/*  Dados                                       */
/* -------------------------------------------- */

class Die {
  static DENOMINATION = "d";
  constructor({ number = 1, faces = 6, modifiers = [] } = {}) {
    this.number = number;
    this.faces = faces;
    this.modifiers = modifiers;
    this.results = [];
  }
  /** Sorteia uma face (os testes trocam `Die.nextFace` para controlar o resultado). */
  roll() {
    const result = { result: Die.nextFace(this.faces), active: true };
    this.results.push(result);
    return result;
  }
  get total() {
    return this.results.filter((r) => r.active !== false && !r.discarded).reduce((sum, r) => sum + r.result, 0);
  }
  static nextFace(faces) {
    return 1 + Math.floor(Math.random() * faces);
  }
}

class Roll {
  constructor(formula, data = {}, options = {}) {
    this.formula = formula;
    this._formula = formula;
    this.data = data;
    this.options = options;
    this.terms = [];
  }
}

class PoolTerm {}
class ParentheticalTerm {}

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

class ActiveEffect {
  static documentName = "ActiveEffect";
  constructor(data = {}, { parent = null } = {}) {
    this.parent = parent;
    this.id = data._id ?? randomID();
    this._id = this.id;
    Object.assign(
      this,
      { name: "", img: "icons/svg/aura.svg", origin: null, changes: [], flags: {}, description: "", disabled: false, duration: {}, transfer: false, statuses: [] },
      deepClone(data)
    );
    this.duration = { label: "", ...this.duration };
    this.sourceName = this.parent?.name ?? "";
  }
  get isTemporary() {
    return false;
  }
  getFlag(scope, key) {
    return getProperty(this.flags, `${scope}.${key}`);
  }
  static async create(data, { parent } = {}) {
    const effect = new ActiveEffect(data, { parent });
    parent.effects.set(effect.id, effect);
    parent.prepareData();
    return effect;
  }
  async update(changes) {
    mergeObject(this, expandObject(changes));
    return this;
  }
  async delete() {
    this.parent.effects.delete(this.id);
    this.parent.prepareData();
    return this;
  }
  toObject() {
    return deepClone({ _id: this.id, name: this.name, img: this.img, changes: this.changes, flags: this.flags, disabled: this.disabled, transfer: this.transfer });
  }
}

class BaseDocument {
  constructor(data = {}, { parent = null } = {}) {
    this.parent = parent;
    this.id = data._id ?? randomID();
    this._id = this.id;
    this.name = data.name ?? "";
    this.type = data.type;
    this.img = data.img ?? null;
    this.sort = data.sort ?? 0;
    this.folder = data.folder ? (globalThis.game?.folders?.get?.(data.folder) ?? null) : null;
    this.flags = deepClone(data.flags ?? {});
    this.prototypeToken = deepClone(data.prototypeToken ?? { width: 1, height: 1 });
    this.effects = new Collection();
    const Model = CONFIG[this.constructor.documentName].dataModels[this.type];
    if (!Model) throw new Error(`Tipo de ${this.constructor.documentName} sem modelo de dados: ${this.type}`);
    this.system = new Model(data.system ?? {}, { parent: this });
    for (const e of data.effects ?? []) {
      const effect = new ActiveEffect(e, { parent: this });
      this.effects.set(effect.id, effect);
    }
    this.sheet = { render() {} };
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
  getFlag(scope, key) {
    return getProperty(this.flags, `${scope}.${key}`);
  }
  getRollData() {
    return deepClone(this.system.liveObject());
  }
  async _preCreate() {
    return true;
  }
  async _preDelete() {
    return true;
  }
  updateSource(changes) {
    const { system, ...rest } = expandObject(changes);
    mergeObject(this, rest);
    if (system) this.system.updateSource(system);
    return changes;
  }
  async setFlag(scope, key, value) {
    setProperty(this.flags, `${scope}.${key}`, deepClone(value));
    return this;
  }
  async unsetFlag(scope, key) {
    const parts = `${scope}.${key}`.split(".");
    const holder = parts.slice(0, -1).reduce((obj, part) => obj?.[part], this.flags);
    if (holder) delete holder[parts.at(-1)];
    return this;
  }
  getActiveTokens() {
    return this.tokens ?? [];
  }

  prepareData() {
    this.system.reset();
    this.system.prepareBaseData?.();
    this.system.prepareDerivedData?.();
  }

  /** `toObject()` guarda os dados de origem; `toObject(false)` os dados já preparados. */
  toObject(source = true) {
    return deepClone({
      _id: this.id,
      name: this.name,
      type: this.type,
      img: this.img,
      sort: this.sort,
      flags: this.flags,
      system: source ? this.system.toObject() : this.system.liveObject(),
      effects: this.effects.contents.map((e) => e.toObject()),
      ...(this.items ? { items: this.items.contents.map((i) => i.toObject(source)) } : {}),
    });
  }

  async createEmbeddedDocuments(name, dataArray, options = {}) {
    const created = [];
    for (const data of dataArray) {
      if (name === "ActiveEffect") {
        const effect = new ActiveEffect(data, { parent: this });
        this.effects.set(effect.id, effect);
        created.push(effect);
      } else if (name === "Item") {
        const item = new CONFIG.Item.documentClass(deepClone(data), { parent: this });
        await item._preCreate(deepClone(data), options, game.user.id);
        item.prepareData();
        this.items.set(item.id, item);
        created.push(item);
      } else {
        throw new Error(`Coleção embutida desconhecida: ${name}`);
      }
    }
    this.prepareData();
    return created;
  }

  async deleteEmbeddedDocuments(name, ids) {
    const collection = name === "ActiveEffect" ? this.effects : this.items;
    for (const id of ids) await collection.get(id)?._preDelete?.({}, game.user.id);
    for (const id of ids) collection.delete(id);
    this.prepareData();
    return ids;
  }

  async update(changes) {
    const expanded = expandObject(changes);
    const { system, ...rest } = expanded;
    mergeObject(this, rest);
    if (system) this.system.updateSource(system);
    this.prepareData();
    return this;
  }
}

/** Prioridade padrão das alterações de efeito, por modo (como no Foundry). */
const CHANGE_PRIORITY = { 1: 10, 2: 20, 3: 30, 4: 40, 5: 50 };

/** Aplica uma alteração de efeito (modo do Foundry: 1 multiplicar, 2 somar, 3 no máximo, 4 pelo menos, 5 substituir). */
function applyChange(actor, change) {
  const current = getProperty(actor, change.key);
  if (current === undefined) throw new Error(`Chave de efeito inexistente no ator: ${change.key}`);
  let delta = change.value;
  if (typeof current === "number") {
    delta = Number(change.value);
    if (!Number.isFinite(delta)) throw new Error(`Valor não numérico em ${change.key}: ${change.value}`);
  } else if (typeof current === "boolean") {
    delta = String(change.value) === "true";
  }
  let result = current;
  switch (change.mode) {
    case 1: result = current * delta; break;
    case 2: result = typeof current === "number" ? current + delta : String(current) + String(delta); break;
    case 3: result = Math.min(current, delta); break;
    case 4: result = Math.max(current, delta); break;
    case 5: result = delta; break;
    default: throw new Error(`Modo de efeito desconhecido em ${change.key}: ${change.mode}`);
  }
  const parts = String(change.key).split(".");
  const holder = parts.slice(0, -1).reduce((obj, part) => obj[part], actor);
  holder[parts.at(-1)] = result;
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
    this.prepareData();
  }

  prepareData() {
    this.system.reset();
    this.system.prepareBaseData?.();
    this.applyActiveEffects();
    this.system.prepareDerivedData?.();
  }

  /** Efeitos do ator e dos itens (que transferem), como no Foundry. */
  *allApplicableEffects() {
    for (const effect of this.effects) yield effect;
    for (const item of this.items ?? []) for (const effect of item.effects) if (effect.transfer) yield effect;
  }

  applyActiveEffects() {
    const changes = [];
    for (const effect of this.allApplicableEffects()) {
      if (effect.disabled) continue;
      for (const c of effect.changes ?? []) changes.push({ ...c, priority: c.priority ?? CHANGE_PRIORITY[c.mode] });
    }
    changes.sort((a, b) => a.priority - b.priority);
    for (const change of changes) applyChange(this, change);
  }

  static async create(data) {
    const actor = new CONFIG.Actor.documentClass(deepClone(data));
    game.actors.set(actor.id, actor);
    return actor;
  }
}

class Item extends BaseDocument {
  static documentName = "Item";
  static DEFAULT_ICON = "icons/svg/item-bag.svg";
  get actor() {
    return this.parent instanceof Actor ? this.parent : null;
  }
  static async create(data, options = {}) {
    const item = new CONFIG.Item.documentClass(deepClone(data), options.parent ? { parent: options.parent } : {});
    await item._preCreate(deepClone(data), options, game.user.id);
    if (options.parent) {
      options.parent.items.set(item.id, item);
      options.parent.prepareData();
    } else {
      game.items.set(item.id, item);
    }
    return item;
  }
  static async fromDropData(data) {
    return fromUuid(data.uuid);
  }
  static async createDocuments(list) {
    const created = [];
    for (const data of list) created.push(await Item.create(data));
    return created;
  }
}

class Folder {
  static documentName = "Folder";
  constructor(data = {}) {
    this.id = randomID();
    this.name = data.name;
    this.type = data.type;
    this.folder = data.folder ? (globalThis.game.folders.get(data.folder) ?? null) : null;
  }
  static async create(data) {
    const folder = new Folder(data);
    game.folders.set(folder.id, folder);
    return folder;
  }
}

const REGISTRY = new Map();

class ChatMessage {
  static documentName = "ChatMessage";
  static created = [];
  static getSpeaker({ actor } = {}) {
    return { actor: actor?.id ?? null, alias: actor?.name ?? "" };
  }
  static async create(data) {
    ChatMessage.created.push(deepClone(data));
    return data;
  }
}

/* -------------------------------------------- */
/*  Fichas (API antiga, ApplicationV1)          */
/* -------------------------------------------- */

class DocumentSheetV1 {
  static get defaultOptions() {
    return { classes: ["sheet"], width: 400, height: 400, tabs: [], editable: true };
  }
  constructor(object, options = {}) {
    this.object = object;
    this.options = mergeObject(this.constructor.defaultOptions, options, { inplace: false });
  }
  get document() {
    return this.object;
  }
  get isEditable() {
    return true;
  }
  getData() {
    return {
      cssClass: "editable",
      editable: true,
      document: this.object,
      data: this.object.toObject(false),
      limited: false,
      options: this.options,
      owner: true,
      title: this.object.name,
    };
  }
  activateListeners() {}
  /** Dados do formulário: o teste põe em `sheet.__submit` o que o formulário enviaria. */
  _getSubmitData(updateData = {}) {
    return { ...structuredClone(this.__submit ?? {}), ...updateData };
  }
}

class ActorSheet extends DocumentSheetV1 {
  get actor() {
    return this.object;
  }
  getData() {
    const context = super.getData();
    context.actor = this.object;
    context.items = context.data.items;
    context.items.sort((a, b) => (a.sort || 0) - (b.sort || 0));
    context.effects = context.data.effects;
    return context;
  }
  _onDragStart() {}
  async _onDropItemCreate(itemData) {
    return this.actor.createEmbeddedDocuments("Item", Array.isArray(itemData) ? itemData : [itemData]);
  }
}

class ItemSheet extends DocumentSheetV1 {
  get item() {
    return this.object;
  }
  getData() {
    const context = super.getData();
    context.item = this.object;
    return context;
  }
}

/* -------------------------------------------- */
/*  Modelos Handlebars                          */
/* -------------------------------------------- */

const compiled = new Map();

function templateFile(p) {
  return path.join(ROOT, p.replace(/^systems\/mmrpg\//, ""));
}

export async function loadTemplates(paths) {
  for (const p of paths) {
    const src = fs.readFileSync(templateFile(p), "utf8");
    Handlebars.registerPartial(p, src);
    compiled.set(p, Handlebars.compile(src));
  }
  return paths.map((p) => compiled.get(p));
}

export async function renderTemplate(p, data) {
  if (!compiled.has(p)) await loadTemplates([p]);
  return compiled.get(p)(data, { allowProtoMethodsByDefault: true, allowProtoPropertiesByDefault: true });
}

const escapeHtml = (v) => Handlebars.escapeExpression(String(v ?? ""));

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
  H.registerHelper("checked", (v) => (v ? "checked" : ""));
  H.registerHelper("numberFormat", (value, opts) => {
    const { decimals = 0, sign = false } = opts?.hash ?? {};
    const n = Number(value ?? 0);
    return new Intl.NumberFormat("en-US", {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
      signDisplay: sign ? "always" : "auto",
      useGrouping: false,
    }).format(n);
  });
  // {{selectOptions choices selected=x blank=""}}: choices é {valor: texto}; blank cria a opção vazia.
  H.registerHelper("selectOptions", (choices, opts) => {
    const { selected, blank } = opts?.hash ?? {};
    if (choices === null || typeof choices !== "object") {
      throw new Error(`{{selectOptions}} recebeu ${String(choices)} em vez de uma lista de opções`);
    }
    const html = [];
    if (blank !== undefined) html.push(`<option value="">${escapeHtml(game.i18n.localize(blank))}</option>`);
    for (const [value, label] of Object.entries(choices)) {
      if (label !== null && typeof label === "object") throw new Error(`{{selectOptions}}: o texto da opção "${value}" precisa ser texto`);
      html.push(`<option value="${escapeHtml(value)}"${String(selected) === String(value) ? " selected" : ""}>${escapeHtml(label)}</option>`);
    }
    return new H.SafeString(html.join(""));
  });
  H.registerHelper("editor", (content, opts) => {
    const { target } = opts?.hash ?? {};
    return new H.SafeString(`<div class="editor prosemirror"><div class="editor-content" data-edit="${escapeHtml(target)}">${content ?? ""}</div></div>`);
  });
  H.registerHelper("toLowerCase", (value) => String(value ?? "").toLowerCase());
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
 * @param {number} [options.generation=14]   Geração do Foundry simulada (13 ou 14)
 * @returns {object} Ferramentas de teste (chaves de tradução ausentes, notificações, fichas registradas...).
 */
export function installFoundry({ lang = "pt-BR", generation = 14 } = {}) {
  const strings = flatten(JSON.parse(fs.readFileSync(path.join(ROOT, "lang", `${lang}.json`), "utf8")));
  const missingKeys = new Set();
  const notices = { warn: [], info: [], error: [] };

  const i18n = {
    localize(key) {
      if (key in strings) return strings[key];
      if (/^(MARVEL_MULTIVERSE|TYPES)\./.test(key)) missingKeys.add(key);
      return key;
    },
    format(key, data = {}) {
      return i18n.localize(key).replace(/\{(\w+)\}/g, (_, k) => (k in data ? String(data[k]) : `{${k}}`));
    },
    has: (key) => key in strings,
  };

  const registered = [];
  const unregistered = [];
  const dialogs = [];
  const dialogAnswer = { value: true };
  const sheetCollection = (documentName) => ({
    registerSheet: (scope, cls, opts) => registered.push({ documentName, scope, name: cls.name, opts, via: "collection" }),
    unregisterSheet: (scope, cls) => unregistered.push({ documentName, scope, name: cls?.name, via: "collection" }),
  });
  const DocumentSheetConfig = {
    registerSheet: (documentClass, scope, cls, opts) =>
      registered.push({ documentName: documentClass.documentName, scope, name: cls.name, opts, via: "config" }),
    unregisterSheet: (documentClass, scope, cls) =>
      unregistered.push({ documentName: documentClass.documentName, scope, name: cls?.name, via: "config" }),
  };

  registerCoreHelpers();

  const g = globalThis;
  g.Handlebars = Handlebars;
  g.HTMLElement = class HTMLElement {};
  g.Roll = Roll;
  g.Actor = Actor;
  g.Item = Item;
  g.Folder = Folder;
  g.ChatMessage = ChatMessage;
  g.ActiveEffect = ActiveEffect;
  g.ActorSheet = ActorSheet;
  g.ItemSheet = ItemSheet;
  g.Hooks = { once() {}, on() {}, callAll() {} };

  g.foundry = {
    utils: { randomID, deepClone, getProperty, setProperty, mergeObject, expandObject },
    abstract: { DataModel, TypeDataModel },
    data: { fields: { DataField, StringField, HTMLField, NumberField, BooleanField, ObjectField, SchemaField, ArrayField, EmbeddedDataField } },
    dice: { terms: { Die, PoolTerm, ParentheticalTerm } },
    documents: { collections: { Actors: sheetCollection("Actor"), Items: sheetCollection("Item") } },
    // No Foundry 14 as janelas antigas moram em foundry.appv1; na 13 também (com os globais como apelido).
    appv1: { sheets: { ActorSheet, ItemSheet } },
    applications: {
      handlebars: { renderTemplate, loadTemplates },
      apps: { DocumentSheetConfig },
      api: { DialogV2: { confirm: async (options) => { dialogs.push(options); return dialogAnswer.value; } } },
    },
  };

  g.CONFIG = {
    Actor: { dataModels: {}, documentClass: Actor },
    Item: { dataModels: {}, documentClass: Item },
    ChatMessage: {},
    Combat: {},
    Dice: { terms: { d: Die }, rolls: [], types: [] },
    fontDefinitions: {},
  };
  g.CONST = { ACTIVE_EFFECT_MODES: { MULTIPLY: 1, ADD: 2, DOWNGRADE: 3, UPGRADE: 4, OVERRIDE: 5 } };

  g.game = {
    folders: new Collection(),
    release: { generation },
    system: { version: "test" },
    i18n,
    settings: {
      values: {},
      get(scope, key) {
        return key in this.values ? this.values[key] : "publicroll";
      },
      register(scope, key, data) {
        this.values[key] = data.default;
      },
    },
    user: { id: "u1", isGM: true, targets: new Set() },
    actors: new Collection(),
    items: new Collection(),
    macros: { find: () => null },
  };
  g.ui = {
    notifications: {
      warn: (m) => notices.warn.push(m),
      info: (m) => notices.info.push(m),
      error: (m) => notices.error.push(m),
    },
  };
  g.fromUuid = async (uuid) => REGISTRY.get(uuid) ?? null;
  g.fromUuidSync = (uuid) => REGISTRY.get(uuid) ?? null;

  return { missingKeys, notices, registered, unregistered, generation, REGISTRY, dialogs, dialogAnswer };
}

export { Handlebars, Die, Roll, Actor, Item, Folder, ChatMessage, ActorSheet, ItemSheet, TypeDataModel, DataModel, ActiveEffect, Collection, deepClone };
