import ItemBase from "./item-base.mjs";
import { grantsField } from "./grants.mjs";

export default class OccupationData extends ItemBase {
  /** @inheritdoc */
  static defineSchema() {
    const f = foundry.data.fields;
    return {
      ...super.defineSchema(),
      examples: new f.StringField({ required: true, blank: true, initial: "" }),
      grants: grantsField()
    };
  }
}
