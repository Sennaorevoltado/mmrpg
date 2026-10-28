import ActionItemBase from "./action-item-base.mjs";

export default class GearData extends ActionItemBase {
  /** @inheritdoc */
  static defineSchema() {
    const f = foundry.data.fields;
    return {
      ...super.defineSchema(),
      category: new f.StringField({ required: true, blank: true, initial: "" }),
      price: new f.StringField({ required: true, blank: true, initial: "" }),
      quantity: new f.NumberField({ required: true, nullable: false, integer: true, initial: 1, min: 0 }),
      equipped: new f.BooleanField({ required: true, initial: false })
    };
  }
}
