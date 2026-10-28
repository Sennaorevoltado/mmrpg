/**
 * Base de personagens e NPCs.
 *
 * Convenção de campos:
 *  - o que é gravado fica no schema;
 *  - o que é calculado (defesa, fora de combate) é preenchido em prepareDerivedData e nunca é gravado.
 */

import { ABILITY_KEYS, MIN_RANK, MAX_RANK, defenseScore, nonCombatBonus } from "../rules/index.mjs";

function int(initial = 0, extra = {}) {
  return new foundry.data.fields.NumberField({
    required: true,
    nullable: false,
    integer: true,
    initial,
    ...extra
  });
}

/** Saúde e Foco: valor atual e máximo (o máximo é digitado; veja o README). */
function pool(max) {
  const f = foundry.data.fields;
  return new f.SchemaField({ value: int(max), max: int(max, { min: 0 }) });
}

export default class ActorBase extends foundry.abstract.TypeDataModel {
  /** A ficha nasce no modo livre (sem contadores de criação)? NPCs sim, personagens não. */
  static FREE_BY_DEFAULT = false;

  /** @inheritdoc */
  static defineSchema() {
    const f = foundry.data.fields;

    const abilities = {};
    for (const key of ABILITY_KEYS) abilities[key] = new f.SchemaField({ value: int(0) });

    return {
      rank: int(MIN_RANK, { min: MIN_RANK, max: MAX_RANK }),
      abilities: new f.SchemaField(abilities),

      health: pool(10),
      focus: pool(10),
      karma: new f.SchemaField({ value: int(0, { min: 0 }), max: int(0, { min: 0 }) }),

      /** Compra de pontos: modo livre e ajustes manuais (bônus de Origem, Ocupação, traits…). */
      creation: new f.SchemaField({
        free: new f.BooleanField({ required: true, initial: this.FREE_BY_DEFAULT }),
        bonusPoints: int(0),
        bonusCap: int(0)
      }),

      details: new f.SchemaField({
        realName: new f.StringField({ required: true, blank: true, initial: "" })
      })
    };
  }

  /** @inheritdoc */
  prepareDerivedData() {
    for (const key of ABILITY_KEYS) {
      const a = this.abilities[key];
      a.defense = defenseScore(a.value);
      a.noncom = nonCombatBonus(a.value);
    }
  }
}
