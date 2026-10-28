/**
 * Ficha de item (ApplicationV2). Um único arquivo atende todos os tipos de item.
 */

import { MMRPG } from "../../config.mjs";
import ActionEditor from "../action-editor.mjs";

const { ItemSheetV2 } = foundry.applications.sheets;
const { HandlebarsApplicationMixin } = foundry.applications.api;

const loc = (key, data) => (data ? game.i18n.format(key, data) : game.i18n.localize(key));

export default class MMRPGItemSheet extends HandlebarsApplicationMixin(ItemSheetV2) {
  /** @override */
  static DEFAULT_OPTIONS = {
    classes: ["mmrpg", "sheet", "item"],
    position: { width: 660, height: 720 },
    window: { resizable: true },
    form: { submitOnChange: true },
    actions: {
      switchTab: MMRPGItemSheet.#onSwitchTab,
      editImage: MMRPGItemSheet.#onEditImage,
      addAction: MMRPGItemSheet.#onAddAction,
      editAction: MMRPGItemSheet.#onEditAction,
      duplicateAction: MMRPGItemSheet.#onDuplicateAction,
      removeAction: MMRPGItemSheet.#onRemoveAction,
      useAction: MMRPGItemSheet.#onUseAction,
      removeGrant: MMRPGItemSheet.#onRemoveGrant,
      createEffect: MMRPGItemSheet.#onCreateEffect,
      editEffect: MMRPGItemSheet.#onEditEffect,
      deleteEffect: MMRPGItemSheet.#onDeleteEffect,
      toggleEffect: MMRPGItemSheet.#onToggleEffect
    }
  };

  /** @override */
  static PARTS = {
    body: { template: `${MMRPG.path}/templates/item/item.hbs`, scrollable: [".mmrpg-panels"] }
  };

  #activeTab = "description";

  /* -------------------------------------------- */

  /** @override */
  async _prepareContext(options) {
    const context = await super._prepareContext(options);
    const item = this.item;
    const system = item.system;

    context.item = item;
    context.editable = this.isEditable;
    context.config = MMRPG;
    context.system = system;
    context.source = item._source.system;
    context.tab = this.#activeTab;
    context.type = item.type;
    context.typeLabel = loc(`TYPES.Item.${item.type}`);
    context.hasActions = MMRPG.actionItemTypes.includes(item.type);
    context.isGranting = MMRPG.grantingItemTypes.includes(item.type);
    context.isEmbedded = !!item.actor;

    context.powerSetOptions = MMRPG.powerSets.map((value) => ({ value, label: loc(MMRPG.powerSetLabels[value]) }));
    context.weaponKindOptions = Object.entries(MMRPG.weaponKinds).map(([value, label]) => ({ value, label: loc(label) }));

    context.actions = (system.actionList ?? []).map((a) => ({
      id: a.id,
      label: a.displayName || loc("MMRPG.Action.unnamed"),
      activation: loc(MMRPG.activationTypes[a.activation]),
      rollSummary: a.rolls
        ? `${loc(MMRPG.rollModes[a.roll.mode])} · ${loc(`MMRPG.Ability.${a.roll.ability}.abbr`)}`
        : loc("MMRPG.ActionRoll.none"),
      damage: a.damage.enabled,
      healing: a.healing.enabled,
      effects: a.effects.length,
      costs: [
        a.cost.focus ? `${a.cost.focus} ${loc("MMRPG.Resource.focus")}` : "",
        a.cost.karma ? `${a.cost.karma} ${loc("MMRPG.Resource.karma")}` : "",
        a.cost.health ? `${a.cost.health} ${loc("MMRPG.Resource.health")}` : ""
      ].filter(Boolean).join(", "),
      uses: a.limitedUses ? `${a.uses.value}/${a.uses.max}` : ""
    }));

    context.grants = (system.grants ?? []).map((g, index) => ({
      index,
      name: g.name,
      type: g.type ? loc(`TYPES.Item.${g.type}`) : "",
      note: g.note ?? "",
      linked: !!g.uuid
    }));

    context.effects = item.effects.contents.map((e) => ({
      id: e.id,
      name: e.name,
      img: e.img,
      disabled: e.disabled,
      transfer: e.transfer
    }));

    context.enriched = {
      description: await foundry.applications.ux.TextEditor.implementation.enrichHTML(system.description ?? "", {
        secrets: item.isOwner,
        relativeTo: item
      })
    };
    return context;
  }

  /** @override */
  _onRender(context, options) {
    super._onRender(context, options);
    this.#applyTab();

    // Soltar itens na lista de concessões (Origem e Ocupação).
    const zone = this.element.querySelector("[data-grants-drop]");
    if (zone && this.isEditable) {
      zone.addEventListener("dragover", (event) => event.preventDefault());
      zone.addEventListener("drop", (event) => this.#onDropGrant(event));
      for (const input of zone.querySelectorAll("input[data-grant-note]")) {
        input.addEventListener("change", (event) => this.#onGrantNote(event));
      }
    }
  }

  #applyTab() {
    for (const el of this.element.querySelectorAll("[data-tab]")) {
      el.classList.toggle("active", el.dataset.tab === this.#activeTab);
    }
  }

  async #onDropGrant(event) {
    event.preventDefault();
    const data = foundry.applications.ux.TextEditor.implementation.getDragEventData(event);
    if (data?.type !== "Item" || !data.uuid) return;
    const doc = await fromUuid(data.uuid);
    if (!doc || !MMRPG.grantableItemTypes.includes(doc.type)) {
      ui.notifications.warn(loc("MMRPG.Warn.notGrantable"));
      return;
    }
    const grants = this.item.system.toObject().grants;
    if (grants.some((g) => g.uuid === doc.uuid && !g.note)) return;
    grants.push({ uuid: doc.uuid, name: doc.name, type: doc.type, note: "" });
    await this.item.update({ "system.grants": grants });
  }

  /** Edita a observação de uma concessão (ex.: o tipo de Connections). */
  async #onGrantNote(event) {
    event.stopPropagation();
    const index = Number(event.target.dataset.index);
    const grants = this.item.system.toObject().grants;
    if (!grants[index]) return;
    grants[index].note = String(event.target.value ?? "").trim();
    await this.item.update({ "system.grants": grants });
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
    const current = foundry.utils.getProperty(this.item._source, attr);
    const picker = new foundry.applications.apps.FilePicker.implementation({
      type: "image",
      current,
      callback: (path) => this.item.update({ [attr]: path })
    });
    return picker.browse();
  }

  static async #onAddAction() {
    const id = await this.item.addAction();
    ActionEditor.open(this.item, id);
  }

  static #onEditAction(event, target) {
    ActionEditor.open(this.item, target.dataset.actionId);
  }

  static async #onDuplicateAction(event, target) {
    const actions = this.item.system.toObject().actions;
    const original = actions.find((a) => a.id === target.dataset.actionId);
    if (!original) return;
    const copy = foundry.utils.deepClone(original);
    copy.id = foundry.utils.randomID();
    for (const e of copy.effects) e.id = foundry.utils.randomID();
    copy.name = copy.name ? `${copy.name} (${loc("MMRPG.Action.copy")})` : "";
    actions.splice(actions.indexOf(original) + 1, 0, copy);
    await this.item.setActions(actions);
  }

  static async #onRemoveAction(event, target) {
    const actions = this.item.system.toObject().actions.filter((a) => a.id !== target.dataset.actionId);
    await this.item.setActions(actions);
  }

  static #onUseAction(event, target) {
    return this.item.use(target.dataset.actionId, { event });
  }

  static async #onRemoveGrant(event, target) {
    const grants = this.item.system.toObject().grants;
    grants.splice(Number(target.dataset.index), 1);
    await this.item.update({ "system.grants": grants });
  }

  static async #onCreateEffect() {
    const [effect] = await this.item.createEmbeddedDocuments("ActiveEffect", [
      { name: this.item.name, img: this.item.img, origin: this.item.uuid, transfer: true }
    ]);
    effect?.sheet.render({ force: true });
  }

  static #onEditEffect(event, target) {
    this.item.effects.get(target.dataset.effectId)?.sheet.render({ force: true });
  }

  static async #onDeleteEffect(event, target) {
    await this.item.effects.get(target.dataset.effectId)?.delete();
  }

  static async #onToggleEffect(event, target) {
    const effect = this.item.effects.get(target.dataset.effectId);
    if (effect) await effect.update({ disabled: !effect.disabled });
  }
}
