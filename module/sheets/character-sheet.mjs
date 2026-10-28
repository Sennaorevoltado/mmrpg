import { onManageActiveEffect, prepareActiveEffectCategories } from "../helpers/effects.mjs";
import { legacySheets, rootOf } from "../helpers/compat.mjs";

const { ActorSheet } = legacySheets();

const config = () => CONFIG.MARVEL_MULTIVERSE;
const localize = (key) => game.i18n.localize(key);

/** Conjunto de poderes gravado em um poder ("Magic" ou "Magic, Telepathy") -> nome canônico. */
function powerSetOf(item) {
  const raw = String(item.system?.powerSet ?? "").split(",")[0].trim();
  return raw || "Basic";
}

/**
 * Ficha de personagem. Usa a API antiga de janelas (ApplicationV1), que a v13 e a v14 ainda aceitam.
 * Base: sistema de mjording / Rollbones Projects (MIT).
 *
 * @extends {ActorSheet}
 */
export class MarvelMultiverseCharacterSheet extends ActorSheet {
  /** @override */
  static get defaultOptions() {
    return foundry.utils.mergeObject(super.defaultOptions, {
      classes: ["marvel-multiverse", "sheet", "actor"],
      width: 690,
      height: 980,
      tabs: [{ navSelector: ".sheet-tabs", contentSelector: ".sheet-body", initial: "abilities" }],
    });
  }

  /** @override */
  get template() {
    return `systems/mmrpg/templates/actor/actor-${this.actor.type}-sheet.hbs`;
  }

  /* -------------------------------------------- */

  /** @override */
  getData() {
    const context = super.getData();
    const cfg = config();

    // Cópia dos dados já preparados (com Defesa, movimento etc. calculados).
    const actorData = context.data;
    context.system = actorData.system;
    context.flags = actorData.flags;

    this._prepareItems(context);

    // Atributos, para a tabela da ficha.
    context.abilityRows = Object.keys(cfg.abilities).map((key) => {
      const ability = context.system.abilities[key];
      return {
        key,
        label: localize(cfg.abilities[key]),
        value: ability.value,
        defense: ability.defense,
        noncom: ability.noncom,
      };
    });

    // Dano: multiplicador e atributo dos quatro atributos de ataque.
    context.damageRows = cfg.damageAbilities.map((key) => ({
      key,
      label: localize(cfg.abilities[key].replace(/\.long$/, ".abbr")).toUpperCase(),
      name: localize(cfg.abilities[key]),
      multiplier: context.system.abilities[key].damageMultiplier,
      value: context.system.abilities[key].value,
    }));

    // Velocidade: só os tipos de movimento ativos.
    context.movementRows = Object.entries(context.system.movement ?? {})
      .filter(([, m]) => m.active)
      .map(([key, m]) => ({ key, label: m.label, value: m.value }));

    // Listas de escolha.
    context.sizeSelection = Object.fromEntries(Object.entries(cfg.sizes).map(([key, size]) => [key, localize(size.label)]));
    context.teamManeuverTypes = Object.fromEntries(cfg.teamManeuvers.map((m) => [m.type, localize(m.name)]));
    context.teamManeuverLevels = { 1: "1", 2: "2", 3: "3" };
    context.elements = Object.fromEntries(Object.entries(cfg.elements).map(([key, el]) => [key, localize(el.name)]));

    context.rollData = context.actor.getRollData();
    context.effects = prepareActiveEffectCategories(this.actor.allApplicableEffects());

    return context;
  }

  /**
   * Separa os itens do ator por tipo e os poderes por conjunto, na ordem do livro.
   * @param {object} context
   */
  _prepareItems(context) {
    const cfg = config();
    const gear = [];
    const origins = [];
    const occupations = [];
    const weapons = [];
    const traits = [];
    const tags = [];
    const groups = new Map(Object.values(cfg.powersets).map((set) => [set.label, { label: set.label, name: localize(set.name), items: [] }]));

    for (const i of context.items) {
      i.img = i.img || Item.DEFAULT_ICON;
      switch (i.type) {
        case "origin":
          origins.push(i);
          break;
        case "occupation":
          occupations.push(i);
          break;
        case "item":
          gear.push(i);
          break;
        case "weapon":
          weapons.push(i);
          break;
        case "trait":
          traits.push(i);
          break;
        case "tag":
          tags.push(i);
          break;
        case "power": {
          const label = powerSetOf(i);
          if (!groups.has(label)) groups.set(label, { label, name: label, items: [] });
          groups.get(label).items.push(i);
          break;
        }
      }
    }

    context.gear = gear;
    context.origins = origins;
    context.occupations = occupations;
    context.weapons = weapons;
    context.traits = traits;
    context.tags = tags;
    context.powerGroups = [...groups.values()].filter((g) => g.items.length);
  }

  /* -------------------------------------------- */
  /*  Eventos                                     */
  /* -------------------------------------------- */

  /** @override */
  activateListeners(html) {
    super.activateListeners(html);
    const root = rootOf(html);

    root.addEventListener("click", (event) => this._onSheetClick(event));
    root.addEventListener("change", (event) => {
      if (event.target.matches?.('select[name="system.size"]')) this._onSizeChange(event);
    });

    // Itens podem ser arrastados (para a barra de macros ou para outra ficha).
    if (this.actor.isOwner) {
      for (const li of root.querySelectorAll("li.item")) {
        if (li.classList.contains("mm-item-header")) continue;
        li.setAttribute("draggable", true);
        li.addEventListener("dragstart", (event) => this._onDragStart(event), false);
      }
    }
  }

  /**
   * Um só ouvinte de clique para a ficha inteira.
   * @param {MouseEvent} event
   * @protected
   */
  _onSheetClick(event) {
    const target = event.target;
    const pick = (selector) => target.closest?.(selector);

    let el;
    if ((el = pick(".item-edit"))) {
      event.preventDefault();
      const id = el.closest(".item")?.dataset.itemId;
      this.actor.items.get(id)?.sheet.render(true);
    } else if ((el = pick(".item-create"))) {
      this._onItemCreate(event, el);
    } else if ((el = pick(".item-delete"))) {
      event.preventDefault();
      const id = el.closest(".item")?.dataset.itemId;
      if (id) this.actor.deleteEmbeddedDocuments("Item", [id]);
    } else if ((el = pick(".effect-control"))) {
      const row = el.closest("li");
      const owner = row?.dataset.parentId === this.actor.id ? this.actor : this.actor.items.get(row?.dataset.parentId);
      if (owner) onManageActiveEffect(event, owner, el);
    } else if ((el = pick(".roll-initiative"))) {
      event.preventDefault();
      this.actor.rollInitiative({ createCombatants: true });
    } else if ((el = pick(".rollable"))) {
      this._onRoll(event, el);
    }
  }

  /**
   * Troca o tamanho: tira os efeitos de tamanho antigos e cria o do tamanho escolhido.
   * @param {Event} event
   * @protected
   */
  async _onSizeChange(event) {
    event.preventDefault();
    await this._changeSizeEffect(event.target.value);
  }

  async _changeSizeEffect(sizeKey) {
    const effects = config().sizeEffects;
    const names = Object.values(effects).map((e) => e.name);
    const old = this.actor.effects.filter(
      (effect) => effect.getFlag("mmrpg", "sizeEffect") || names.includes(effect.name)
    );
    if (old.length) await this.actor.deleteEmbeddedDocuments("ActiveEffect", old.map((e) => e.id));

    const effect = effects[sizeKey];
    if (!effect) return;
    const data = foundry.utils.deepClone(effect);
    data.name = localize(effect.name);
    data.flags = { ...(data.flags ?? {}), mmrpg: { sizeEffect: sizeKey } };
    await ActiveEffect.create(data, { parent: this.actor });
  }

  /**
   * Cria um item novo na ficha com os dados do botão (data-type, data-power-set...).
   * @param {Event} event
   * @param {HTMLElement} control
   * @protected
   */
  async _onItemCreate(event, control) {
    event.preventDefault();
    const { type, ...data } = control.dataset;
    const name = game.i18n.format("MARVEL_MULTIVERSE.NewItem", { type: localize(`TYPES.Item.${type}`) });
    return Item.create({ name, type, system: { ...data } }, { parent: this.actor });
  }

  /* -------------------------------------------- */
  /*  Soltar itens na ficha                       */
  /* -------------------------------------------- */

  /**
   * Cria os itens que uma Origem ou Ocupação concede (traits, tags, poderes).
   *
   * Cada entrada pode trazer os dados completos do item ou só o nome. Só com o nome, o sistema
   * procura um item de mesmo nome e tipo no mundo; se não achar, cria um item vazio com o nome.
   *
   * @param {Array<object|string>} entries
   * @param {"trait"|"tag"|"power"} type
   * @protected
   */
  async _grantItems(entries = [], type) {
    const have = new Set(this.actor.items.map((i) => `${i.type}:${i.name}`));
    const toCreate = [];

    for (const raw of entries) {
      const entry = typeof raw === "string" ? { name: raw } : raw;
      if (!entry?.name) continue;

      const wanted = String(entry.name).toLowerCase();
      const world = game.items.find((i) => i.type === type && i.name.toLowerCase() === wanted);
      const source = entry.system && Object.keys(entry.system).length
        ? { name: entry.name, img: entry.img, system: entry.system }
        : world
          ? world.toObject()
          : { name: entry.name };

      const data = foundry.utils.deepClone(source);
      delete data._id;
      delete data.folder;
      delete data.ownership;
      data.type = type;
      data.system ??= {};

      // Nota da concessão ("Connections" + "Criminal"): fica no nome, "Connections (Criminal)".
      if (entry.note) data.name = `${data.name} (${entry.note})`;

      if (type === "power" && !data.system.element && this.actor.system.defaultElement) {
        data.system.element = this.actor.system.defaultElement;
      }

      const key = `${type}:${data.name}`;
      if (have.has(key) && !data.system.multiple) continue;
      have.add(key);
      toCreate.push(data);
    }

    if (toCreate.length) await this.actor.createEmbeddedDocuments("Item", toCreate);
  }

  /**
   * Item solto na ficha. Origem e Ocupação também criam o que concedem; Big e Small ajustam o tamanho.
   * @override
   */
  async _onDropItemCreate(itemData, event) {
    if (Array.isArray(itemData)) {
      const created = [];
      for (const data of itemData) created.push(await this._onDropItemCreate(data, event));
      return created.flat();
    }

    if (this.actor.items.some((i) => i.type === itemData.type && i.name === itemData.name) && !itemData.system?.multiple) {
      return [];
    }

    if (itemData.type === "power" && itemData.system?.powerSet === "Elemental Control" && !itemData.system.element) {
      itemData.system.element = this.actor.system.defaultElement;
    }

    if (itemData.type === "occupation" || itemData.type === "origin") {
      await this._grantItems(itemData.system?.tags, "tag");
      await this._grantItems(itemData.system?.traits, "trait");
      if (itemData.type === "origin") await this._grantItems(itemData.system?.powers, "power");
    }

    if (itemData.type === "trait") {
      const name = String(itemData.name).toLowerCase();
      const sizes = { big: "big", small: "small" };
      for (const [key, value] of Object.entries(sizes)) {
        const names = [key, localize(config().sizes[key].label).toLowerCase()];
        if (names.includes(name)) await this._changeSizeEffect(value);
      }
    }

    return super._onDropItemCreate(itemData, event);
  }

  /* -------------------------------------------- */
  /*  Rolagens                                    */
  /* -------------------------------------------- */

  /**
   * Clique num elemento rolável: um atributo, um teste fora de combate ou um item.
   * @param {MouseEvent} event
   * @param {HTMLElement} element
   * @protected
   */
  _onRoll(event, element) {
    event.preventDefault();
    const dataset = element.dataset;
    const itemId = element.closest(".item")?.dataset?.itemId ?? dataset.itemId;
    const item = itemId ? this.actor.items.get(itemId) : null;

    // Item sem atributo próprio: mostra o cartão (e rola, se o item pedir).
    if (dataset.rollType === "item") {
      return item?.roll();
    }

    // Atributo (teste) ou teste fora de combate.
    if (dataset.ability) {
      return this.actor.rollAbility(dataset.ability, {
        kind: dataset.kind === "noncom" ? "noncom" : "ability",
      });
    }
  }
}
