import ActionItemBase from "./action-item-base.mjs";
import { MMRPG } from "../config.mjs";

export default class WeaponData extends ActionItemBase {
  /** @inheritdoc */
  static defineSchema() {
    const f = foundry.data.fields;
    return {
      ...super.defineSchema(),
      kind: new f.StringField({ required: true, blank: false, choices: Object.keys(MMRPG.weaponKinds), initial: "close" }),
      category: new f.StringField({ required: true, blank: true, initial: "" }),
      range: new f.StringField({ required: true, blank: true, initial: "" }),
      reach: new f.StringField({ required: true, blank: true, initial: "" }),
      recommendedRank: new f.StringField({ required: true, blank: true, initial: "" }),
      quantity: new f.NumberField({ required: true, nullable: false, integer: true, initial: 1, min: 0 }),
      equipped: new f.BooleanField({ required: true, initial: false })
    };
  }
}
