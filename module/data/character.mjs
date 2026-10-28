import ActorBase from "./actor-base.mjs";
import { MMRPG } from "../config.mjs";

export default class CharacterData extends ActorBase {
  /** @inheritdoc */
  static defineSchema() {
    const f = foundry.data.fields;
    return {
      ...super.defineSchema(),
      /** Manobra de equipe em uso (para consulta e para o cartão de custo). */
      teamManeuver: new f.SchemaField({
        type: new f.StringField({
          required: true,
          blank: true,
          choices: ["", ...MMRPG.teamManeuvers.types],
          initial: ""
        }),
        level: new f.NumberField({ required: true, nullable: false, integer: true, initial: 1, min: 1, max: 3 })
      })
    };
  }
}
