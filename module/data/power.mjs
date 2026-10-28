import ActionItemBase from "./action-item-base.mjs";

export default class PowerData extends ActionItemBase {
  /** @inheritdoc */
  static defineSchema() {
    const f = foundry.data.fields;
    return {
      ...super.defineSchema(),
      /** Chave do conjunto de poderes (ver CONFIG.MMRPG.powerSets) ou texto livre. */
      powerSet: new f.StringField({ required: true, blank: false, initial: "basic" }),
      prerequisites: new f.StringField({ required: true, blank: true, initial: "" }),
      duration: new f.StringField({ required: true, blank: true, initial: "" }),
      range: new f.StringField({ required: true, blank: true, initial: "" }),
      /** Para poderes que podem ser adquiridos mais de uma vez. */
      level: new f.NumberField({ required: true, nullable: false, integer: true, initial: 0, min: 0 })
    };
  }
}
