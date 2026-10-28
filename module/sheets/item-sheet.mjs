import { onManageActiveEffect, prepareActiveEffectCategories } from "../helpers/effects.mjs";
import { legacySheets, rootOf } from "../helpers/compat.mjs";
import { FORM_CHANGE_TYPES, FORM_KINDS, FORM_RANK_MODES, suggestedChangeKeys } from "../helpers/forms.mjs";
import { GRANT_FIELDS, grantLabel, parseGrantLabel } from "../helpers/grants.mjs";
import { putChangeRows, takeChangeRows, withBlankRow, withoutRow } from "../helpers/form-data.mjs";

const { ItemSheet } = legacySheets();

const localize = (key) => game.i18n.localize(key);

/**
 * Ficha de item (uma por tipo: poder, arma, trait, tag, origem, ocupação, equipamento).
 * @extends {ItemSheet}
 */
export class MarvelMultiverseItemSheet extends ItemSheet {
  /** Poderes, armas e origens têm mais campos: a janela deles já abre maior. */
  constructor(item, options = {}) {
    const size = { power: [600, 680], weapon: [600, 680], origin: [520, 660], form: [580, 720] }[item?.type] ?? [520, 520];
    super(item, { width: size[0], height: size[1], ...options });
  }

  /** @override */
  static get defaultOptions() {
    return foundry.utils.mergeObject(super.defaultOptions, {
      classes: ["marvel-multiverse", "sheet", "item"],
      width: 520,
      height: 480,
      tabs: [{ navSelector: ".sheet-tabs", contentSelector: ".sheet-body", initial: "attributes" }],
    });
  }

  /** @override */
  get template() {
    return `systems/mmrpg/templates/item/item-${this.item.type}-sheet.hbs`;
  }

  /* -------------------------------------------- */

  /** @override */
  getData() {
    const context = super.getData();
    const cfg = CONFIG.MARVEL_MULTIVERSE;

    const itemData = context.data;
    context.rollData = this.item.getRollData();
    context.system = itemData.system;
    context.flags = itemData.flags;
    context.effects = prepareActiveEffectCategories(this.item.effects);

    // Listas de escolha (valor gravado -> texto que o jogador vê).
    context.abilities = Object.fromEntries(cfg.damageAbilities.map((key) => [key, localize(cfg.abilities[key])]));
    context.allAbilities = Object.fromEntries(Object.entries(cfg.abilities).map(([key, label]) => [key, localize(label)]));
    context.elements = Object.fromEntries(Object.entries(cfg.elements).map(([key, el]) => [key, localize(el.name)]));
    context.powerSets = Object.fromEntries(Object.values(cfg.powersets).map((set) => [set.label, localize(set.name)]));
    context.damageTypes = Object.fromEntries(Object.entries(cfg.damageTypes).map(([key, label]) => [key, localize(label)]));
    context.attackKinds = Object.fromEntries(Object.entries(cfg.attackKinds).map(([key, label]) => [key, localize(label)]));
    context.attackEdgeModes = Object.fromEntries(Object.entries(cfg.edgeModes).map(([key, label]) => [key, localize(label)]));
    context.selectedElement = context.system.element;

    // O que uma Origem ou Ocupação concede (só leitura: vem do conteúdo importado).
    const label = (entry) => {
      if (typeof entry === "string") return entry;
      if (!entry?.name) return "";
      return entry.note ? `${entry.name} (${entry.note})` : entry.name;
    };
    const names = (list) => (Array.isArray(list) ? list : []).map(label).filter(Boolean);
    context.grants = ["traits", "tags", "powers"]
      .map((key) => ({
        key,
        label: localize(`MARVEL_MULTIVERSE.Item.Grants.${key}`),
        text: names(context.system[key]).join(", "),
      }))
      .filter((grant) => grant.text);

    if (this.item.type === "form") this._prepareFormContext(context);

    return context;
  }

  /**
   * Listas e linhas da ficha da Forma (categoria, Rank, alterações, concessões).
   * @param {object} context
   * @protected
   */
  _prepareFormContext(context) {
    const cfg = CONFIG.MARVEL_MULTIVERSE;
    const system = this.item.system;

    context.formKinds = Object.fromEntries(FORM_KINDS.map((kind) => [kind, localize(`MARVEL_MULTIVERSE.Form.Kind.${kind}`)]));
    context.rankModes = Object.fromEntries(FORM_RANK_MODES.map((mode) => [mode, localize(`MARVEL_MULTIVERSE.Form.RankMode.${mode}`)]));
    context.changeTypes = Object.fromEntries(FORM_CHANGE_TYPES.map((type) => [type, localize(`MARVEL_MULTIVERSE.Form.ChangeType.${type}`)]));
    context.formOwned = !!this.item.actor;
    context.formActive = !!system.active;

    context.changeRows = (system.changes ?? []).map((change, index) => ({
      index,
      key: change.key,
      type: change.type,
      value: change.value,
      priority: change.priority ?? "",
    }));

    context.changeKeyOptions = suggestedChangeKeys(Object.keys(cfg.abilities)).map((entry) => ({
      key: entry.key,
      label: entry.ability
        ? game.i18n.format(entry.label, { ability: localize(cfg.abilities[entry.ability]) })
        : localize(entry.label),
    }));

    context.grantSections = Object.entries(GRANT_FIELDS).map(([type, field]) => ({
      field,
      type,
      label: localize(`MARVEL_MULTIVERSE.Item.Grants.${field}`),
      entries: (system[field] ?? []).map((entry, index) => ({ index, label: grantLabel(entry) })),
    }));
  }

  /* -------------------------------------------- */
  /*  Envio do formulário                         */
  /* -------------------------------------------- */

  /**
   * A lista de alterações da Forma chega do formulário campo a campo; aqui vira uma lista só.
   * @override
   */
  _getSubmitData(updateData = {}) {
    const data = super._getSubmitData(updateData);
    if (this.item.type === "form") {
      const rows = takeChangeRows(data);
      if (rows) putChangeRows(data, rows);
    }
    return data;
  }

  /* -------------------------------------------- */

  /** @override */
  activateListeners(html) {
    super.activateListeners(html);
    if (!this.isEditable) return;
    const root = rootOf(html);

    root.addEventListener("click", (event) => this._onSheetClick(event));

    if (this.item.type === "form") {
      // Enter no campo de concessão adiciona (em vez de enviar o formulário).
      root.addEventListener("keydown", (event) => {
        const input = event.target?.closest?.("input[data-grant-input]");
        if (!input || event.key !== "Enter") return;
        event.preventDefault();
        this._addGrant(input.dataset.grantInput, input);
      });
      root.addEventListener("dragover", (event) => {
        if (event.target?.closest?.(".mm-grant-drop")) event.preventDefault();
      });
      root.addEventListener("drop", (event) => {
        if (event.target?.closest?.(".mm-grant-drop")) this._onGrantDrop(event);
      });
    }
  }

  /**
   * Um só ouvinte de clique para a ficha do item.
   * @param {MouseEvent} event
   * @protected
   */
  _onSheetClick(event) {
    const pick = (selector) => event.target?.closest?.(selector);
    let el;

    // Efeitos ativos: criar, editar, ligar/desligar, apagar.
    if ((el = pick(".effect-control"))) {
      onManageActiveEffect(event, this.item, el);
    } else if ((el = pick(".form-item-toggle"))) {
      event.preventDefault();
      this.item.actor?.setFormActive(this.item, !this.item.system.active);
    } else if ((el = pick(".change-add"))) {
      event.preventDefault();
      this.item.update({ "system.changes": withBlankRow(this.item.system.changes) });
    } else if ((el = pick(".change-remove"))) {
      event.preventDefault();
      this.item.update({ "system.changes": withoutRow(this.item.system.changes, Number(el.dataset.index)) });
    } else if ((el = pick(".grant-add"))) {
      event.preventDefault();
      const field = el.dataset.field;
      this._addGrant(field, el.parentElement?.querySelector?.("input[data-grant-input]"));
    } else if ((el = pick(".grant-remove"))) {
      event.preventDefault();
      const field = el.dataset.field;
      if (!Object.values(GRANT_FIELDS).includes(field)) return;
      const list = (this.item.system[field] ?? []).filter((_, i) => i !== Number(el.dataset.index));
      this.item.update({ [`system.${field}`]: list });
    }
  }

  /**
   * Acrescenta uma concessão escrita à mão ("Nome" ou "Nome (nota)").
   * @param {string} field                     powers, traits ou tags
   * @param {HTMLInputElement|null} input
   * @protected
   */
  async _addGrant(field, input) {
    if (!Object.values(GRANT_FIELDS).includes(field)) return;
    const entry = parseGrantLabel(input?.value);
    if (!entry) return;
    const list = foundry.utils.deepClone(this.item.system[field] ?? []);
    if (!list.some((other) => grantLabel(other).toLowerCase() === grantLabel(entry).toLowerCase())) list.push(entry);
    if (input) input.value = "";
    await this.item.update({ [`system.${field}`]: list });
  }

  /**
   * Item solto na aba de concessões: poder, traço ou tag viram uma concessão (com os dados do item).
   * @param {DragEvent} event
   * @protected
   */
  async _onGrantDrop(event) {
    event.preventDefault();
    let data;
    try {
      data = JSON.parse(event.dataTransfer.getData("text/plain"));
    } catch (err) {
      return;
    }
    if (data?.type !== "Item") return;

    const source = await Item.fromDropData(data);
    const field = GRANT_FIELDS[source?.type];
    if (!field) {
      ui.notifications.warn(localize("MARVEL_MULTIVERSE.Form.DropIgnored"));
      return;
    }

    const list = foundry.utils.deepClone(this.item.system[field] ?? []);
    if (list.some((other) => grantLabel(other).toLowerCase() === source.name.toLowerCase())) return;
    const copy = source.toObject();
    list.push({ name: source.name, img: copy.img, system: foundry.utils.deepClone(copy.system) });
    await this.item.update({ [`system.${field}`]: list });
  }
}
