/**
 * Ficha de ator (ApplicationV2). Personagem e NPC compartilham esta base.
 */

import { MMRPG } from "../../config.mjs";
import { ABILITY_KEYS, MAX_RANK } from "../../rules/index.mjs";
import { rollAbilityCheck } from "../../actions/executor.mjs";
import { descriptionsOpenByDefault, openAppearanceDialog } from "../../helpers/appearance.mjs";

const { ActorSheetV2 } = foundry.applications.sheets;
const { HandlebarsApplicationMixin } = foundry.applications.api;

const loc = (key, data) => (data ? game.i18n.format(key, data) : game.i18n.localize(key));

export default class MMRPGActorSheet extends HandlebarsApplicationMixin(ActorSheetV2) {
  /** @override */
  static DEFAULT_OPTIONS = {
    classes: ["mmrpg", "sheet", "actor"],
    position: { width: 860, height: 880 },
    window: { resizable: true },
    form: { submitOnChange: true },
    actions: {
      switchTab: MMRPGActorSheet.#onSwitchTab,
      editImage: MMRPGActorSheet.#onEditImage,
      rollAbility: MMRPGActorSheet.#onRollAbility,
      rollInitiative: MMRPGActorSheet.#onRollInitiative,
      useAction: MMRPGActorSheet.#onUseAction,
      createItem: MMRPGActorSheet.#onCreateItem,
      editItem: MMRPGActorSheet.#onEditItem,
      deleteItem: MMRPGActorSheet.#onDeleteItem,
      toggleEquipped: MMRPGActorSheet.#onToggleEquipped,
      toggleForm: MMRPGActorSheet.#onToggleForm,
      resetUses: MMRPGActorSheet.#onResetUses,
      createEffect: MMRPGActorSheet.#onCreateEffect,
      editEffect: MMRPGActorSheet.#onEditEffect,
      deleteEffect: MMRPGActorSheet.#onDeleteEffect,
      toggleEffect: MMRPGActorSheet.#onToggleEffect,
      toggleStatus: MMRPGActorSheet.#onToggleStatus,
      teamManeuver: MMRPGActorSheet.#onTeamManeuver,
      openAppearance: MMRPGActorSheet.#onOpenAppearance
    }
  };

  /** Aba ativa (mantida entre renderizações). */
  #activeTab = "main";

  /** Descrições abertas/fechadas pelo usuário (id do item → aberta), mantidas entre renderizações. */
  #descriptionState = new Map();

  /** Texto do filtro da lista de poderes e equipamentos. */
  #filter = "";

  /* -------------------------------------------- */
  /*  Contexto                                    */
  /* -------------------------------------------- */

  /** @override */
  async _prepareContext(options) {
    const context = await super._prepareContext(options);
    const actor = this.actor;
    const system = actor.system;
    const source = actor._source.system;

    context.actor = actor;
    context.editable = this.isEditable;
    context.config = MMRPG;
    context.system = system;
    context.source = source;
    context.isCharacter = actor.type === "character";
    context.owner = actor.isOwner;
    context.limited = actor.limited;
    context.tab = this.#activeTab;

    context.abilities = ABILITY_KEYS.map((key) => {
      const a = system.abilities[key];
      return {
        key,
        label: loc(`MMRPG.Ability.${key}.long`),
        abbr: loc(`MMRPG.Ability.${key}.abbr`),
        isAttack: MMRPG.abilities[key].attack,
        source: source.abilities[key],
        value: a.value,
        defense: a.defense,
        attack: a.attack,
        noncom: a.noncom,
        multiplier: a.multiplier,
        edge: a.edge,
        trouble: a.trouble
      };
    });

    context.sizeOptions = Object.entries(MMRPG.sizes).map(([value, v]) => ({ value, label: loc(v.label) }));
    context.movementModeOptions = Object.entries(MMRPG.movementModes).map(([value, label]) => ({ value, label: loc(label) }));

    context.movement = Object.entries(system.movement).map(([key, m]) => ({
      key,
      label: loc(MMRPG.movementTypes[key].label),
      source: source.movement[key],
      value: m.value,
      active: m.active
    }));
    context.activeMovement = context.movement.filter((m) => m.active);

    context.healthPercent = percent(system.health.value, system.health.max);
    context.focusPercent = percent(system.focus.value, system.focus.max);
    context.karmaPercent = percent(system.karma.value, system.karma.max);

    const descriptions = await this.#enrichDescriptions();
    Object.assign(context, this.#prepareItems(descriptions));
    context.filter = this.#filter;
    context.damageRows = context.abilities
      .filter((a) => a.isAttack)
      .map((a) => ({
        key: a.key,
        label: a.label,
        abbr: a.abbr,
        multiplier: a.multiplier,
        score: Number(a.value) + Number(source.abilities[a.key].damageBonus ?? 0)
      }));
    context.identity = {
      origin: context.origins.map((i) => i.name).join(", "),
      occupation: context.occupations.map((i) => i.name).join(", ")
    };
    context.maxRank = MAX_RANK;
    Object.assign(context, this.#prepareForms(descriptions));
    context.effects = this.#prepareEffects();
    context.statuses = MMRPG.statuses.map((s) => ({ id: s.id, label: loc(`MMRPG.Status.${s.id}`), img: s.img, active: actor.statuses.has(s.id) }));

    context.maneuverTypes = MMRPG.teamManeuvers.types.map((value) => ({ value, label: loc(`MMRPG.TeamManeuver.${value}.name`) }));

    context.enriched = {
      biography: await enrich(system.biography, actor),
      personality: await enrich(system.personality, actor),
      notes: await enrich(system.notes, actor)
    };
    return context;
  }

  /** Descrições (HTML enriquecido) de todos os itens da ficha, por id. */
  async #enrichDescriptions() {
    const map = new Map();
    await Promise.all(
      this.actor.items.contents.map(async (item) => {
        const raw = item.system.description ?? "";
        if (raw.trim()) map.set(item.id, await enrich(raw, item));
      })
    );
    return map;
  }

  /** Dados comuns de descrição e busca de um item da lista. */
  #descriptionView(item, descriptions) {
    const html = descriptions.get(item.id) ?? "";
    const excerpt = excerptOf(item.system.description);
    const open = this.#descriptionState.has(item.id) ? this.#descriptionState.get(item.id) : descriptionsOpenByDefault();
    return {
      hasDescription: html !== "",
      descriptionHtml: html,
      excerpt,
      descriptionOpen: open,
      search: `${item.name} ${excerptOf(item.system.description, 700)}`.toLocaleLowerCase()
    };
  }

  /** Itens agrupados para a ficha. */
  #prepareItems(descriptions) {
    const items = this.actor.items.contents;
    const view = (item) => {
      const actions = (item.actions ?? []).map((a) => ({
        id: a.id,
        label: a.displayName,
        rolls: a.rolls,
        ability: a.rolls ? loc(`MMRPG.Ability.${a.roll.ability}.abbr`) : "",
        damage: a.damage.enabled,
        limited: a.limitedUses,
        uses: a.uses,
        hasCost: a.hasCost,
        cost: [
          a.cost.focus ? `${a.cost.focus} ${loc("MMRPG.Resource.focus")}` : "",
          a.cost.karma ? `${a.cost.karma} ${loc("MMRPG.Resource.karma")}` : "",
          a.cost.health ? `${a.cost.health} ${loc("MMRPG.Resource.health")}` : ""
        ].filter(Boolean).join(", ")
      }));
      return {
        id: item.id,
        uuid: item.uuid,
        name: item.name,
        img: item.img,
        type: item.type,
        system: item.system,
        actions,
        hasActions: actions.length > 0,
        equipped: item.system.equipped,
        quantity: item.system.quantity,
        showQuantity: Number(item.system.quantity) > 1,
        powerSet: item.system.powerSet,
        meta: itemMeta(item),
        ...this.#descriptionView(item, descriptions)
      };
    };
    const byType = (t) => items.filter((i) => i.type === t).sort((a, b) => a.sort - b.sort).map(view);

    // Poderes agrupados por conjunto, na ordem da configuração.
    const powers = byType("power");
    const order = MMRPG.powerSets;
    const groups = new Map();
    for (const p of powers) {
      const key = p.powerSet || "basic";
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(p);
    }
    const powerGroups = [...groups.entries()]
      .sort(([a], [b]) => {
        const ia = order.indexOf(a);
        const ib = order.indexOf(b);
        if (ia === -1 && ib === -1) return a.localeCompare(b);
        if (ia === -1) return 1;
        if (ib === -1) return -1;
        return ia - ib;
      })
      .map(([key, list]) => ({
        key,
        label: MMRPG.powerSetLabels[key] ? loc(MMRPG.powerSetLabels[key]) : key,
        items: list
      }));

    return {
      powerGroups,
      traits: byType("trait"),
      tags: byType("tag"),
      origins: byType("origin"),
      occupations: byType("occupation"),
      weapons: byType("weapon"),
      gear: byType("gear")
    };
  }

  /** Barra de ferramentas da janela (menu ⋮): acrescenta a aparência. */
  _getHeaderControls() {
    const controls = super._getHeaderControls?.() ?? [];
    controls.push({ icon: "fa-solid fa-font", label: "MMRPG.Appearance.title", action: "openAppearance" });
    return controls;
  }

  /** Formas agrupadas por categoria, formas ativas e Rank efetivo. */
  #prepareForms(descriptions) {
    const forms = this.actor.forms.sort((a, b) => a.sort - b.sort);
    const view = (item) => {
      const s = item.system;
      const badges = [];
      if (s.rank.mode === "set") badges.push(loc("MMRPG.Form.badgeRankSet", { value: s.rank.value }));
      if (s.rank.mode === "add") badges.push(loc("MMRPG.Form.badgeRankAdd", { value: `${s.rank.value >= 0 ? "+" : ""}${s.rank.value}` }));
      if (s.grants.length) badges.push(loc("MMRPG.Form.badgeGrants", { count: s.grants.length }));
      if (s.changes.length) badges.push(loc("MMRPG.Form.badgeChanges", { count: s.changes.length }));
      if (s.portrait || s.token) badges.push(loc("MMRPG.Form.badgeImages"));
      return { id: item.id, name: item.name, img: item.img, active: s.active, borrowed: s.borrowed, badges, ...this.#descriptionView(item, descriptions) };
    };
    const formGroups = Object.keys(MMRPG.formKinds).map((kind) => ({
      kind,
      label: loc(MMRPG.formKindPlurals[kind]),
      items: forms.filter((f) => f.system.kind === kind).map(view)
    }));
    const activeForms = this.actor.activeForms.map((f) => ({ name: f.name, kindLabel: loc(MMRPG.formKinds[f.system.kind]) }));
    const rankChanged = Number(this.actor.system.rank) !== Number(this.actor._source.system.rank);
    return { formGroups, activeForms, rankChanged };
  }

  /** Efeitos ativos do ator. */
  #prepareEffects() {
    return this.actor.effects.contents.map((e) => ({
      id: e.id,
      name: e.name,
      img: e.img,
      disabled: e.disabled,
      origin: originName(e),
      isStatus: e.statuses.size > 0,
      duration: e.getFlag(MMRPG.id, "expires") ? loc("MMRPG.Effect.timed") : ""
    }));
  }

  /* -------------------------------------------- */
  /*  Renderização                                */
  /* -------------------------------------------- */

  /** @override */
  _onRender(context, options) {
    super._onRender(context, options);
    this.#applyTab();
    this.#activateFilter();
    this.#trackDescriptions();

    // Ações arrastáveis para a barra de atalhos.
    for (const el of this.element.querySelectorAll("[data-drag-action]")) {
      el.setAttribute("draggable", "true");
      el.addEventListener("dragstart", (event) => {
        const data = { type: "mmrpgAction", uuid: el.dataset.itemUuid, actionId: el.dataset.actionId };
        event.dataTransfer.setData("text/plain", JSON.stringify(data));
      });
    }
  }

  #applyTab() {
    for (const el of this.element.querySelectorAll("[data-tab]")) {
      const active = el.dataset.tab === this.#activeTab;
      el.classList.toggle("active", active);
      if (el.matches(".mm-tab")) el.setAttribute("aria-selected", String(active));
    }
  }

  /** Campo de busca das listas: esconde o que não combina e os grupos que ficam vazios. */
  #activateFilter() {
    const inputs = this.element.querySelectorAll("input[data-filter]");
    const apply = (text) => {
      this.#filter = text;
      const needle = text.trim().toLocaleLowerCase();
      for (const entry of this.element.querySelectorAll(".mmrpg-entry[data-search]")) {
        entry.hidden = needle !== "" && !entry.dataset.search.includes(needle);
      }
      for (const section of this.element.querySelectorAll(".mmrpg-item-section")) {
        const entries = section.querySelectorAll(".mmrpg-entry");
        if (!entries.length) continue;
        section.hidden = needle !== "" && [...entries].every((e) => e.hidden);
      }
      for (const input of inputs) if (input.value !== text) input.value = text;
    };
    for (const input of inputs) {
      input.addEventListener("input", (event) => apply(event.target.value));
    }
    if (this.#filter) apply(this.#filter);
  }

  /** Lembra quais descrições o usuário abriu ou fechou. */
  #trackDescriptions() {
    for (const details of this.element.querySelectorAll("details[data-item-id]")) {
      details.addEventListener("toggle", () => this.#descriptionState.set(details.dataset.itemId, details.open));
    }
  }

  /* -------------------------------------------- */
  /*  Ações                                       */
  /* -------------------------------------------- */

  static #onSwitchTab(event, target) {
    this.#activeTab = target.dataset.tab;
    this.#applyTab();
  }

  static async #onEditImage(event, target) {
    const attr = target.dataset.edit || "img";
    const current = foundry.utils.getProperty(this.actor._source, attr);
    const picker = new foundry.applications.apps.FilePicker.implementation({
      type: "image",
      current,
      callback: (path) => this.actor.update({ [attr]: path })
    });
    return picker.browse();
  }

  static #onRollAbility(event, target) {
    const kind = target.dataset.kind === "attack" ? "attack" : "noncom";
    return rollAbilityCheck(this.actor, target.dataset.ability, { event, kind });
  }

  static #onRollInitiative() {
    return this.actor.rollInitiative({ createCombatants: true });
  }

  static #onUseAction(event, target) {
    const item = this.actor.items.get(target.dataset.itemId);
    if (!item) return;
    return item.use(target.dataset.actionId || undefined, { event });
  }

  static async #onCreateItem(event, target) {
    const type = target.dataset.type;
    const data = { name: loc(`TYPES.Item.${type}`), type };
    if (target.dataset.powerSet) data.system = { powerSet: target.dataset.powerSet };
    if (type === "form" && target.dataset.kind) {
      data.system = { kind: target.dataset.kind };
      data.name = loc(MMRPG.formKinds[target.dataset.kind]);
    }
    const [item] = await this.actor.createEmbeddedDocuments("Item", [data]);
    item?.sheet.render({ force: true });
  }

  static #onEditItem(event, target) {
    this.actor.items.get(target.dataset.itemId)?.sheet.render({ force: true });
  }

  static async #onDeleteItem(event, target) {
    const item = this.actor.items.get(target.dataset.itemId);
    if (!item) return;
    const ok = await foundry.applications.api.DialogV2.confirm({
      window: { title: loc("MMRPG.Dialog.deleteTitle") },
      content: `<p>${loc("MMRPG.Dialog.deleteItem", { name: item.name })}</p>`,
      rejectClose: false
    });
    if (ok) await item.delete();
  }

  static async #onToggleEquipped(event, target) {
    const item = this.actor.items.get(target.dataset.itemId);
    if (item) await item.update({ "system.equipped": !item.system.equipped });
  }

  static async #onToggleForm(event, target) {
    const item = this.actor.items.get(target.dataset.itemId);
    if (item) await this.actor.setFormActive(item, !item.system.active);
  }

  static async #onResetUses() {
    for (const item of this.actor.items) {
      if (typeof item.resetUses === "function") await item.resetUses();
    }
    ui.notifications.info(loc("MMRPG.Info.usesReset"));
  }

  static async #onCreateEffect() {
    const [effect] = await this.actor.createEmbeddedDocuments("ActiveEffect", [
      { name: loc("MMRPG.Effect.generic"), img: "icons/svg/aura.svg", origin: this.actor.uuid }
    ]);
    effect?.sheet.render({ force: true });
  }

  static #onEditEffect(event, target) {
    this.actor.effects.get(target.dataset.effectId)?.sheet.render({ force: true });
  }

  static async #onDeleteEffect(event, target) {
    await this.actor.effects.get(target.dataset.effectId)?.delete();
  }

  static async #onToggleEffect(event, target) {
    const effect = this.actor.effects.get(target.dataset.effectId);
    if (effect) await effect.update({ disabled: !effect.disabled });
  }

  static async #onToggleStatus(event, target) {
    await this.actor.toggleStatusEffect(target.dataset.status);
  }

  static #onOpenAppearance() {
    return openAppearanceDialog();
  }

  static async #onTeamManeuver() {
    const { default: TeamManeuverApp } = await import("../team-maneuver.mjs");
    TeamManeuverApp.open(this.actor);
  }
}

/* -------------------------------------------- */

function percent(value, max) {
  const v = Number(value) || 0;
  const m = Number(max) || 0;
  if (m <= 0) return 0;
  return Math.max(0, Math.min(100, Math.round((v / m) * 100)));
}

/** Nome do documento de origem de um efeito (vazio se não existir ou não puder ser lido). */
function originName(effect) {
  if (!effect.origin) return "";
  try {
    return fromUuidSync(effect.origin, { strict: false })?.name ?? "";
  } catch (err) {
    return "";
  }
}

/** Linhas curtas "rótulo: valor" de um item, para a lista da ficha. */
function itemMeta(item) {
  const s = item.system;
  const out = [];
  const add = (label, value) => {
    const text = value === undefined || value === null ? "" : String(value).trim();
    if (text) out.push({ label: loc(label), value: text });
  };
  switch (item.type) {
    case "power":
      if (Number(s.level) > 0) add("MMRPG.Item.level", s.level);
      add("MMRPG.Item.range", s.range);
      add("MMRPG.Item.duration", s.duration);
      break;
    case "weapon":
      add("MMRPG.Item.weaponKind", MMRPG.weaponKinds[s.kind] ? loc(MMRPG.weaponKinds[s.kind]) : "");
      add("MMRPG.Item.category", s.category);
      add("MMRPG.Item.range", s.range);
      add("MMRPG.Item.reach", s.reach);
      add("MMRPG.Item.recommendedRank", s.recommendedRank);
      break;
    case "gear":
      add("MMRPG.Item.category", s.category);
      add("MMRPG.Item.price", s.price);
      break;
    case "trait":
      add("MMRPG.Item.restriction", s.restriction);
      break;
    case "tag":
      add("MMRPG.Item.restriction", s.restriction);
      add("MMRPG.Item.rarity", s.rarity);
      break;
  }
  return out;
}

/** Texto puro e curto da descrição (primeiras palavras), para o resumo da lista. */
export function excerptOf(html, max = 170) {
  const text = String(html ?? "")
    .replace(/<\/(p|div|li|h[1-6]|tr)>/gi, " ")
    .replace(/<br\s*\/?>/gi, " ")
    .replace(/<[^>]*>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, "&")
    .replace(/\s+/g, " ")
    .trim();
  if (text.length <= max) return text;
  const cut = text.slice(0, max);
  const space = cut.lastIndexOf(" ");
  return `${(space > max * 0.6 ? cut.slice(0, space) : cut).replace(/[\s,;:.\-]+$/, "")}…`;
}

function enrich(html, document) {
  return foundry.applications.ux.TextEditor.implementation.enrichHTML(html ?? "", {
    secrets: document.isOwner,
    relativeTo: document
  });
}

/* -------------------------------------------- */

export class CharacterSheet extends MMRPGActorSheet {
  static PARTS = {
    body: { template: `${MMRPG.path}/templates/actor/character.hbs`, scrollable: [".mmrpg-panels"] }
  };
}

export class NpcSheet extends MMRPGActorSheet {
  static PARTS = {
    body: { template: `${MMRPG.path}/templates/actor/npc.hbs`, scrollable: [".mmrpg-panels"] }
  };
}
