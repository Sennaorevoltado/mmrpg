import ActorBase from "./actor-base.mjs";

export default class NpcData extends ActorBase {
  /** @inheritdoc */
  static defineSchema() {
    const f = foundry.data.fields;
    return {
      ...super.defineSchema(),
      /** Classificação livre do NPC (capanga, vilão, aliado…). */
      category: new f.StringField({ required: true, blank: true, initial: "" })
    };
  }
}
