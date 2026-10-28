/**
 * Base dos itens que carregam ações executáveis (poderes, armas e equipamentos).
 */

import ItemBase from "./item-base.mjs";
import ActionData from "./action.mjs";

export default class ActionItemBase extends ItemBase {
  /** @inheritdoc */
  static defineSchema() {
    const f = foundry.data.fields;
    return {
      ...super.defineSchema(),
      actions: new f.ArrayField(new f.EmbeddedDataField(ActionData))
    };
  }

  /** @inheritdoc */
  get actionList() {
    return this.actions;
  }

  /**
   * Busca uma ação pelo id.
   * @param {string} id
   * @returns {ActionData|undefined}
   */
  getAction(id) {
    return this.actions.find((a) => a.id === id);
  }
}
