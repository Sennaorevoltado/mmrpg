import { onManageActiveEffect, prepareActiveEffectCategories } from "../helpers/effects.mjs";
import { legacySheets, rootOf } from "../helpers/compat.mjs";

const { ItemSheet } = legacySheets();

const localize = (key) => game.i18n.localize(key);

/**
 * Ficha de item (uma por tipo: poder, arma, trait, tag, origem, ocupação, equipamento).
 * @extends {ItemSheet}
 */
export class MarvelMultiverseItemSheet extends ItemSheet {
  /** Poderes, armas e origens têm mais campos: a janela deles já abre maior. */
  constructor(item, options = {}) {
    const size = { power: [600, 680], weapon: [600, 680], origin: [520, 660] }[item?.type] ?? [520, 520];
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

    return context;
  }

  /* -------------------------------------------- */

  /** @override */
  activateListeners(html) {
    super.activateListeners(html);
    if (!this.isEditable) return;

    // Efeitos ativos: criar, editar, ligar/desligar, apagar.
    rootOf(html).addEventListener("click", (event) => {
      const control = event.target.closest?.(".effect-control");
      if (control) onManageActiveEffect(event, this.item, control);
    });
  }
}
