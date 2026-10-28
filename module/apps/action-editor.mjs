/**
 * Editor de uma ação de item.
 *
 * A lista de ações é um array dentro do item; atualizar um índice isolado não funciona no Foundry.
 * Por isso este editor lê a ação, aplica o formulário numa cópia e grava o array inteiro.
 */

import { MMRPG } from "../config.mjs";
import { ABILITY_KEYS } from "../rules/index.mjs";

const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;

const loc = (key, data) => (data ? game.i18n.format(key, data) : game.i18n.localize(key));

/** Editores abertos, para não abrir dois da mesma ação. */
const OPEN = new Map();

/** Converte um objeto indexado ({"0": a, "1": b}) em array, preservando a ordem numérica. */
function indexedToArray(value) {
  if (Array.isArray(value)) return value;
  if (!value || typeof value !== "object") return [];
  return Object.keys(value)
    .sort((a, b) => Number(a) - Number(b))
    .map((k) => value[k]);
}

const options = (map) => Object.entries(map).map(([value, label]) => ({ value, label: loc(label) }));

export default class ActionEditor extends HandlebarsApplicationMixin(ApplicationV2) {
  /** @override */
  static DEFAULT_OPTIONS = {
    classes: ["mmrpg", "mmrpg-action-editor"],
    tag: "form",
    position: { width: 620, height: 720 },
    window: { resizable: true, icon: "fa-solid fa-bolt" },
    form: {
      handler: ActionEditor.#onSubmit,
      submitOnChange: true,
      closeOnSubmit: false
    },
    actions: {
      addEffect: ActionEditor.#onAddEffect,
      removeEffect: ActionEditor.#onRemoveEffect,
      addChange: ActionEditor.#onAddChange,
      removeChange: ActionEditor.#onRemoveChange
    }
  };

  /** @override */
  static PARTS = {
    body: { template: `${MMRPG.path}/templates/apps/action-editor.hbs`, scrollable: [".mmrpg-editor-body"] }
  };

  /**
   * @param {Item} item
   * @param {string} actionId
   */
  constructor(item, actionId, options = {}) {
    super({ id: `mmrpg-action-${item.uuid.replaceAll(".", "-")}-${actionId}`, ...options });
    this.item = item;
    this.actionId = actionId;
  }

  /** Abre (ou traz para frente) o editor de uma ação. */
  static open(item, actionId) {
    const key = `${item.uuid}#${actionId}`;
    let app = OPEN.get(key);
    if (!app) {
      app = new ActionEditor(item, actionId);
      OPEN.set(key, app);
    }
    app.render({ force: true });
    return app;
  }

  /** @override */
  get title() {
    return loc("MMRPG.ActionEditor.title", { name: this.item.name });
  }

  /** @override */
  _onClose(options) {
    super._onClose?.(options);
    OPEN.delete(`${this.item.uuid}#${this.actionId}`);
  }

  /** Cópia editável da ação, ou null se ela foi removida. */
  #current() {
    const actions = this.item.system.toObject().actions;
    const index = actions.findIndex((a) => a.id === this.actionId);
    return index < 0 ? null : { actions, index, action: actions[index] };
  }

  /* -------------------------------------------- */

  /** @override */
  async _prepareContext() {
    const current = this.#current();
    if (!current) return { missing: true };
    const a = current.action;

    return {
      missing: false,
      editable: this.item.isOwner,
      a,
      config: MMRPG,
      activationOptions: options(MMRPG.activationTypes),
      rollModeOptions: options(MMRPG.rollModes),
      attackKindOptions: options(MMRPG.attackKinds),
      edgeOptions: options(MMRPG.edgeModes),
      targetTypeOptions: options(MMRPG.targetTypes),
      areaShapeOptions: options(MMRPG.areaShapes),
      damageResourceOptions: options(MMRPG.damageResources),
      healingResourceOptions: options(MMRPG.healingResources),
      healingModeOptions: options(MMRPG.healingModes),
      healingTargetOptions: [
        { value: "targets", label: loc("MMRPG.EffectTarget.targets") },
        { value: "self", label: loc("MMRPG.EffectTarget.self") }
      ],
      triggerOptions: options(MMRPG.effectTriggers),
      effectTargetOptions: options(MMRPG.effectTargets),
      changeTypeOptions: options(MMRPG.changeTypes),
      abilityOptions: ABILITY_KEYS.map((value) => ({ value, label: loc(`MMRPG.Ability.${value}.long`) })),
      optionalAbilityOptions: [
        { value: "", label: loc("MMRPG.Action.sameAsRoll") },
        ...ABILITY_KEYS.map((value) => ({ value, label: loc(`MMRPG.Ability.${value}.long`) }))
      ],
      elementOptions: [
        { value: "", label: loc("MMRPG.Element.none") },
        ...Object.entries(MMRPG.elements).map(([value, e]) => ({ value, label: loc(e.label) }))
      ],
      statusOptions: [
        { value: "", label: loc("MMRPG.Status.none") },
        ...MMRPG.statuses.map((s) => ({ value: s.id, label: loc(`MMRPG.Status.${s.id}`) }))
      ]
    };
  }

  /* -------------------------------------------- */

  /**
   * Grava o formulário: aplica os campos numa cópia da ação e salva o array de ações.
   * @this {ActionEditor}
   */
  static async #onSubmit(event, form, formData) {
    const current = this.#current();
    if (!current) return;
    const expanded = foundry.utils.expandObject(formData.object);

    // Arrays chegam como objetos indexados.
    if (expanded.effects) {
      expanded.effects = indexedToArray(expanded.effects).map((e) => ({
        ...e,
        changes: indexedToArray(e.changes)
      }));
    }

    const merged = foundry.utils.mergeObject(current.action, expanded, { inplace: false, performDeletions: false });
    // mergeObject não troca arrays por arrays de tamanhos diferentes de forma confiável.
    if (expanded.effects) merged.effects = expanded.effects.map((e, i) => ({ ...(current.action.effects[i] ?? {}), ...e }));
    // Usos limitados: ao definir o máximo pela primeira vez, a ação começa com todos os usos.
    const before = current.action.uses ?? { value: 0, max: 0 };
    const uses = merged.uses ?? (merged.uses = { value: 0, max: 0 });
    uses.max = Math.max(0, Math.trunc(Number(uses.max)) || 0);
    uses.value = Math.max(0, Math.trunc(Number(uses.value)) || 0);
    if (uses.max > 0) uses.value = before.max > 0 ? Math.min(uses.value, uses.max) : uses.max;
    else uses.value = 0;
    current.actions[current.index] = merged;
    await this.item.update({ "system.actions": current.actions });
    this.render();
  }

  static async #mutate(editor, fn) {
    const current = editor.#current();
    if (!current) return;
    fn(current.action);
    await editor.item.update({ "system.actions": current.actions });
    editor.render();
  }

  static #onAddEffect() {
    return ActionEditor.#mutate(this, (action) => {
      action.effects.push({
        id: foundry.utils.randomID(),
        name: "",
        when: "hit",
        target: "targets",
        status: "",
        rounds: 0,
        changes: [],
        note: ""
      });
    });
  }

  static #onRemoveEffect(event, target) {
    return ActionEditor.#mutate(this, (action) => {
      action.effects.splice(Number(target.dataset.index), 1);
    });
  }

  static #onAddChange(event, target) {
    return ActionEditor.#mutate(this, (action) => {
      action.effects[Number(target.dataset.index)]?.changes.push({ key: "", type: "add", value: "" });
    });
  }

  static #onRemoveChange(event, target) {
    return ActionEditor.#mutate(this, (action) => {
      action.effects[Number(target.dataset.effect)]?.changes.splice(Number(target.dataset.index), 1);
    });
  }
}
