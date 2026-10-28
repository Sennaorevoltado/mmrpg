import ItemBase from "./item-base.mjs";
import { grantsField } from "./grants.mjs";

export default class OriginData extends ItemBase {
  /** @inheritdoc */
  static defineSchema() {
    const f = foundry.data.fields;
    return {
      ...super.defineSchema(),
      examples: new f.StringField({ required: true, blank: true, initial: "" }),
      suggestedOccupation: new f.StringField({ required: true, blank: true, initial: "" }),
      limitation: new f.StringField({ required: true, blank: true, initial: "" }),
      minimumRank: new f.NumberField({ required: true, nullable: false, integer: true, initial: 0, min: 0 }),
      grants: grantsField()
    };
  }
}
