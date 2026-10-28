import ItemBase from "./item-base.mjs";

export default class TraitData extends ItemBase {
  /** @inheritdoc */
  static defineSchema() {
    const f = foundry.data.fields;
    return {
      ...super.defineSchema(),
      restriction: new f.StringField({ required: true, blank: true, initial: "" }),
      multiple: new f.BooleanField({ required: true, initial: false })
    };
  }
}
