/**
 * Ficha de ator (ApplicationV2). Personagem e NPC compartilham esta base.
 */

import { MMRPG } from "../../config.mjs";
import { ABILITY_KEYS } from "../../rules/index.mjs";
import { rollAbilityCheck } from "../../actions/executor.mjs";

const { ActorSheetV2 } = foundry.applications.sheets;
const { HandlebarsApplicationMixin } = foundry.applications.api;

const loc = (key, data) => (data ? game.i18n.format(key, data) : game.i18n.localize(key));

export default class MMRPGActorSheet extends HandlebarsApplicationMixin(ActorSheetV2) {
  /** @override */
  static DEFAULT_OPTIONS = {
    classes: ["mmrpg", "sheet", "actor"],
    position: { width: 800, height: 860 },
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
      resetUses: MMRPGActorSheet.#onResetUses,
      createEffect: MMRPGActorSheet.#onCreateEffect,
      editEffect: MMRPGActorSheet.#onEditEffect,
      deleteEffect: MMRPGActorSheet.#onDeleteEffect,
      toggleEffect: MMRPGActorSheet.#onToggleEffect,
      toggleStatus: MMRPGActorSheet.#onToggleStatus,
      teamManeuver: MMRPGActorSheet.#onTeamManeuver
    }
  };

  /** Aba ativa (mantida entre renderizações). */
  #activeTab = "main";

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

    Object.assign(context, this.#prepareItems());
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

  /** Itens agrupados para a ficha. */
  #prepareItems() {
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
        powerSet: item.system.powerSet
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
      el.classList.toggle("active", el.dataset.tab === this.#activeTab);
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
