/**
 * Base de personagens e NPCs.
 *
 * Convenção de campos:
 *  - o que é gravado fica no schema (valor base + campos "bônus" que Active Effects podem alterar);
 *  - o que é calculado (defesa, multiplicador, iniciativa, deslocamento) é preenchido em
 *    prepareDerivedData e nunca é gravado.
 */

import { MMRPG } from "../config.mjs";
import {
  ABILITY_KEYS,
  defenseScore,
  nonCombatBonus,
  damageMultiplier,
  initiativeBonus,
  computeMovement,
  toInt
} from "../rules/index.mjs";

function int(initial = 0, extra = {}) {
  return new foundry.data.fields.NumberField({
    required: true,
    nullable: false,
    integer: true,
    initial,
    ...extra
  });
}

function pool(max = 0) {
  const f = foundry.data.fields;
  return new f.SchemaField({
    value: int(max),
    max: int(max),
    /** Redução de dano aplicada a ataques contra este recurso. */
    reduction: int(0, { min: 0 })
  });
}

export default class ActorBase extends foundry.abstract.TypeDataModel {
  /** @inheritdoc */
  static defineSchema() {
    const f = foundry.data.fields;

    const abilities = {};
    for (const key of ABILITY_KEYS) {
      abilities[key] = new f.SchemaField({
        value: int(0),
        defenseBonus: int(0),
        attackBonus: int(0),
        damageBonus: int(0),
        noncomBonus: int(0),
        multiplierBonus: int(0),
        edge: new f.BooleanField({ required: true, initial: false }),
        trouble: new f.BooleanField({ required: true, initial: false })
      });
    }

    const movement = {};
    for (const [key, cfg] of Object.entries(MMRPG.movementTypes)) {
      movement[key] = new f.SchemaField({
        base: int(cfg.base, { min: 0 }),
        bonus: int(0),
        mode: new f.StringField({
          required: true,
          blank: false,
          choices: Object.keys(MMRPG.movementModes),
          initial: cfg.mode
        }),
        active: new f.BooleanField({ required: true, initial: cfg.active })
      });
    }

    return {
      rank: int(1, { min: 1 }),
      abilities: new f.SchemaField(abilities),

      health: pool(),
      focus: pool(),
      karma: new f.SchemaField({ value: int(0, { min: 0 }), max: int(0, { min: 0 }) }),

      init: new f.SchemaField({
        bonus: int(0),
        edge: new f.BooleanField({ required: true, initial: false }),
        trouble: new f.BooleanField({ required: true, initial: false })
      }),

      size: new f.StringField({
        required: true,
        blank: false,
        choices: Object.keys(MMRPG.sizes),
        initial: "average"
      }),
      reach: int(1, { min: 0 }),
      movement: new f.SchemaField(movement),

      details: new f.SchemaField({
        realName: new f.StringField({ required: true, blank: true, initial: "" }),
        gender: new f.StringField({ required: true, blank: true, initial: "" }),
        height: new f.StringField({ required: true, blank: true, initial: "" }),
        weight: new f.StringField({ required: true, blank: true, initial: "" }),
        eyes: new f.StringField({ required: true, blank: true, initial: "" }),
        hair: new f.StringField({ required: true, blank: true, initial: "" }),
        features: new f.StringField({ required: true, blank: true, initial: "" }),
        teams: new f.StringField({ required: true, blank: true, initial: "" }),
        base: new f.StringField({ required: true, blank: true, initial: "" })
      }),

      biography: new f.HTMLField({ required: true, blank: true, initial: "" }),
      personality: new f.HTMLField({ required: true, blank: true, initial: "" }),
      notes: new f.HTMLField({ required: true, blank: true, initial: "" })
    };
  }

  /* -------------------------------------------- */
  /*  Dados derivados                             */
  /* -------------------------------------------- */

  /** @inheritdoc */
  prepareDerivedData() {
    const rank = toInt(this.rank);

    for (const key of ABILITY_KEYS) {
      const a = this.abilities[key];
      a.defense = defenseScore(a.value, a.defenseBonus);
      a.attack = toInt(a.value) + toInt(a.attackBonus);
      a.noncom = nonCombatBonus(a.value, a.noncomBonus);
      a.multiplier = damageMultiplier(rank, a.multiplierBonus);
    }

    this.init.total = initiativeBonus(this.abilities.vig.value, this.init.bonus);

    const entries = {};
    for (const [key, m] of Object.entries(this.movement)) {
      entries[key] = { base: m.base, bonus: m.bonus, mode: m.mode };
    }
    const computed = computeMovement(entries, rank);
    for (const [key, value] of Object.entries(computed)) this.movement[key].value = value;
  }

  /* -------------------------------------------- */
  /*  Consultas                                   */
  /* -------------------------------------------- */

  /**
   * Dados para fórmulas (@mle, @rank, @abilities.mle.defense…).
   * @returns {object}
   */
  getRollData() {
    const data = {
      rank: this.rank,
      init: this.init.total,
      abilities: {}
    };
    for (const key of ABILITY_KEYS) {
      const a = this.abilities[key];
      data[key] = a.value;
      data.abilities[key] = {
        value: a.value,
        defense: a.defense,
        attack: a.attack,
        noncom: a.noncom,
        multiplier: a.multiplier
      };
    }
    return data;
  }

  /**
   * Defesa de cada atributo, no formato esperado pelas regras puras.
   * @returns {Record<string, number>}
   */
  get defenses() {
    return Object.fromEntries(ABILITY_KEYS.map((k) => [k, this.abilities[k].defense]));
  }

  /**
   * Redução de dano por recurso.
   * @returns {{ health: number, focus: number }}
   */
  get damageReduction() {
    return { health: toInt(this.health.reduction), focus: toInt(this.focus.reduction) };
  }
}
