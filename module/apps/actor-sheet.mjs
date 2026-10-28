/**
 * Ficha de ator (ApplicationV2). Personagem e NPC compartilham esta base.
 *
 * Duas partes: a barra fixa do topo (identidade, atributos, Saúde, Foco e Karma) e o corpo,
 * que rola por baixo dela.
 */

import { MMRPG } from "../config.mjs";
import { ABILITY_KEYS, summarizeCreation, stepAbility } from "../rules/index.mjs";
import { getBudgetTable, isStrictBudget } from "../helpers/budget.mjs";
import { openAppearanceDialog } from "../helpers/appearance.mjs";
import BudgetConfig from "./budget-config.mjs";

const { ActorSheetV2 } = foundry.applications.sheets;
const { HandlebarsApplicationMixin } = foundry.applications.api;

const loc = (key, data) => (data ? game.i18n.format(key, data) : game.i18n.localize(key));

export class MMRPGActorSheet extends HandlebarsApplicationMixin(ActorSheetV2) {
  /** @override */
  static DEFAULT_OPTIONS = {
    classes: ["mmrpg", "sheet", "actor"],
    position: { width: 760, height: 760 },
    window: { resizable: true },
    form: { submitOnChange: true },
    actions: {
      editImage: MMRPGActorSheet.#onEditImage,
      adjustAbility: MMRPGActorSheet.#onAdjustAbility,
      setMode: MMRPGActorSheet.#onSetMode,
      openBudget: MMRPGActorSheet.#onOpenBudget,
      openAppearance: MMRPGActorSheet.#onOpenAppearance
    }
  };

  /** @override */
  static PARTS = {
    bar: { template: `${MMRPG.path}/templates/actor/parts/bar.hbs` },
    body: { template: `${MMRPG.path}/templates/actor/parts/body.hbs`, scrollable: [""] }
  };

  /* -------------------------------------------- */
  /*  Contexto                                    */
  /* -------------------------------------------- */

  /** O personagem está no modo criação (com pontos e teto)? NPC e modo livre: não. */
  get #guided() {
    return this.actor.type === "character" && !this.actor.system.creation.free;
  }

  /** Dados que a compra de pontos usa (os mesmos na ficha e nos botões). */
  #creationInput() {
    const system = this.actor.system;
    return {
      rank: system.rank,
      values: Object.fromEntries(ABILITY_KEYS.map((key) => [key, system.abilities[key].value])),
      bonusPoints: system.creation.bonusPoints,
      bonusCap: system.creation.bonusCap,
      table: getBudgetTable(),
      guided: this.#guided,
      strict: isStrictBudget()
    };
  }

  /** @override */
  async _prepareContext(options) {
    const context = await super._prepareContext(options);
    const actor = this.actor;
    const system = actor.system;
    const editable = this.isEditable;
    const isCharacter = actor.type === "character";
    const guided = this.#guided;

    const input = this.#creationInput();
    const summary = summarizeCreation(input);

    context.actor = actor;
    context.system = system;
    context.editable = editable;
    context.isCharacter = isCharacter;
    context.isGM = game.user.isGM;
    context.rankOptions = MMRPG.ranks.map((rank) => ({ value: rank, label: String(rank) }));

    context.abilities = ABILITY_KEYS.map((key) => ({
      key,
      label: loc(`MMRPG.Ability.${key}.long`),
      abbr: loc(`MMRPG.Ability.${key}.abbr`),
      value: system.abilities[key].value,
      defense: system.abilities[key].defense,
      noncom: system.abilities[key].noncom,
      overCap: guided && summary.overCap.includes(key),
      canDecrease: editable && stepAbility({ ...input, key, delta: -1 }).changed,
      canIncrease: editable && stepAbility({ ...input, key, delta: 1 }).changed
    }));

    context.vitals = ["health", "focus", "karma"].map((key) => ({
      key,
      label: loc(`MMRPG.Resource.${key}`),
      value: system[key].value,
      max: system[key].max
    }));

    context.guided = guided;
    context.canToggleMode = isCharacter && editable;
    context.creation = {
      status: summary.status,
      pointsNumber: summary.remaining === null ? "—" : Math.abs(summary.remaining),
      pointsLabel: loc(`MMRPG.Creation.points.${summary.status}`, { rank: summary.rank }),
      capNumber: summary.cap === null ? "—" : summary.cap,
      overCapCount: summary.overCap.length,
      overCapText: summary.overCap.length
        ? loc("MMRPG.Creation.overCap", { cap: summary.cap, names: summary.overCap.map((key) => loc(`MMRPG.Ability.${key}.long`)).join(", ") })
        : "",
      undefinedText: loc("MMRPG.Creation.undefinedBudget", { rank: summary.rank }),
      bonusPoints: system.creation.bonusPoints,
      bonusCap: system.creation.bonusCap
    };
    return context;
  }

  /* -------------------------------------------- */
  /*  Janela                                      */
  /* -------------------------------------------- */

  /** Menu da janela (⋮): acrescenta a aparência. */
  _getHeaderControls() {
    const controls = super._getHeaderControls?.() ?? [];
    controls.push({ icon: "fa-solid fa-font", label: "MMRPG.Appearance.title", action: "openAppearance" });
    return controls;
  }

  /* -------------------------------------------- */
  /*  Ações                                       */
  /* -------------------------------------------- */

  static async #onEditImage(event, target) {
    if (!this.isEditable) return null;
    const attr = target.dataset.edit || "img";
    const current = foundry.utils.getProperty(this.actor._source, attr);
    const picker = new foundry.applications.apps.FilePicker.implementation({
      type: "image",
      current,
      callback: (path) => this.actor.update({ [attr]: path })
    });
    return picker.browse();
  }

  /** Botões − e + de um atributo. */
  static async #onAdjustAbility(event, target) {
    if (!this.isEditable) return null;
    const key = target.dataset.ability;
    if (!ABILITY_KEYS.includes(key)) return null;
    const result = stepAbility({ ...this.#creationInput(), key, delta: Number(target.dataset.delta) });
    if (!result.changed) return null;
    return this.actor.update({ [`system.abilities.${key}.value`]: result.value });
  }

  /** Escolhe o modo criação ou o modo livre (só personagens). */
  static async #onSetMode(event, target) {
    if (!this.isEditable || this.actor.type !== "character") return null;
    const free = target.dataset.mode === "free";
    if (free === this.actor.system.creation.free) return null;
    return this.actor.update({ "system.creation.free": free });
  }

  static #onOpenBudget() {
    return BudgetConfig.open();
  }

  static #onOpenAppearance() {
    return openAppearanceDialog();
  }
}

export class CharacterSheet extends MMRPGActorSheet {}

export class NpcSheet extends MMRPGActorSheet {}
