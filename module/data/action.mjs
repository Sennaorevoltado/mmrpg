/**
 * ActionData — uma ação executável dentro de um item (poder, arma ou equipamento).
 *
 * A ideia central do sistema: um poder é uma lista de ações, e cada ação descreve
 *   1. como se escolhe o alvo,
 *   2. qual rolagem é feita (ataque contra defesa, teste contra dificuldade ou nenhuma),
 *   3. o que acontece quando funciona (dano, cura e efeitos),
 *   4. quanto custa usá-la.
 *
 * O motor (module/actions/) lê estes dados; as regras puras ficam em module/rules/.
 */

import { ABILITY_KEYS } from "../rules/abilities.mjs";
import { MMRPG } from "../config.mjs";

const keys = (obj) => Object.keys(obj);

/** NumberField inteiro e obrigatório. */
function int(initial = 0, extra = {}) {
  return new foundry.data.fields.NumberField({
    required: true,
    nullable: false,
    integer: true,
    initial,
    ...extra
  });
}

/** StringField com lista de opções. */
function choice(options, initial, extra = {}) {
  return new foundry.data.fields.StringField({
    required: true,
    blank: false,
    choices: options,
    initial,
    ...extra
  });
}

/** StringField que aceita vazio ou uma das opções. */
function optionalChoice(options) {
  return new foundry.data.fields.StringField({
    required: true,
    blank: true,
    choices: ["", ...options],
    initial: ""
  });
}

export default class ActionData extends foundry.abstract.DataModel {
  /** @inheritdoc */
  static defineSchema() {
    const f = foundry.data.fields;

    return {
      id: new f.StringField({
        required: true,
        blank: false,
        initial: () => foundry.utils.randomID()
      }),
      name: new f.StringField({ required: true, blank: true, initial: "" }),
      activation: choice(keys(MMRPG.activationTypes), "action"),
      description: new f.HTMLField({ required: true, blank: true, initial: "" }),

      target: new f.SchemaField({
        type: choice(keys(MMRPG.targetTypes), "targets"),
        /** Máximo de alvos aceitos (0 = sem limite). */
        count: int(0, { min: 0 }),
        /** Texto livre de alcance, para exibição. */
        range: new f.StringField({ required: true, blank: true, initial: "" }),
        /** Alcance em unidades da cena (0 = não verificar). */
        distance: int(0, { min: 0 })
      }),

      area: new f.SchemaField({
        shape: choice(keys(MMRPG.areaShapes), "circle"),
        /** Tamanho em unidades da cena. */
        size: int(0, { min: 0 })
      }),

      roll: new f.SchemaField({
        mode: choice(keys(MMRPG.rollModes), "attack"),
        ability: choice(ABILITY_KEYS, "mle"),
        kind: choice(keys(MMRPG.attackKinds), "close"),
        /** Defesa do alvo contra a qual o ataque é comparado. */
        targetDefense: choice(ABILITY_KEYS, "agl"),
        /** Dificuldade fixa, quando o modo é "teste". */
        difficulty: int(0),
        /** Bônus fixo adicional na rolagem. */
        bonus: int(0),
        edge: choice(keys(MMRPG.edgeModes), "normal")
      }),

      damage: new f.SchemaField({
        enabled: new f.BooleanField({ required: true, initial: false }),
        /** Atributo cujo valor e multiplicador entram no dano (vazio = o mesmo da rolagem). */
        ability: optionalChoice(ABILITY_KEYS),
        multiplierBonus: int(0),
        flat: int(0),
        resource: choice(keys(MMRPG.damageResources), "health"),
        element: optionalChoice(keys(MMRPG.elements)),
        fantasticFactor: new f.NumberField({ required: true, nullable: false, initial: 2, min: 1 }),
        /** Fração do dano em qualquer acerto (1 = inteiro, 0,5 = metade). O Fantástico multiplica por cima. */
        scale: new f.NumberField({ required: true, nullable: false, initial: 1, min: 0 }),
        /** Quando o dano é causado: em qualquer acerto ("hit") ou só no Sucesso Fantástico ("fantastic"). */
        when: choice(keys(MMRPG.damageWhen), "hit"),
        /** Dano fixo extra por ponto de Foco gasto (0,5 = +1 a cada 2 pontos). */
        perFocus: new f.NumberField({ required: true, nullable: false, initial: 0, min: 0 }),
        /** O dano ignora a Redução de Dano do alvo. */
        ignoreReduction: new f.BooleanField({ required: true, initial: false }),
        /** Qual Redução de Dano do alvo vale (vazio = a do recurso atingido). Ex.: dano ao Foco com a Redução da Saúde. */
        reductionFrom: optionalChoice(keys(MMRPG.damageResources))
      }),

      healing: new f.SchemaField({
        enabled: new f.BooleanField({ required: true, initial: false }),
        mode: choice(keys(MMRPG.healingModes), "marvel"),
        resource: choice(keys(MMRPG.healingResources), "health"),
        target: choice(["self", "targets"], "targets"),
        ability: optionalChoice(ABILITY_KEYS),
        multiplierBonus: int(0),
        flat: int(0),
        /** Cura fixa extra por ponto de Foco gasto. */
        perFocus: new f.NumberField({ required: true, nullable: false, initial: 0, min: 0 })
      }),

      effects: new f.ArrayField(
        new f.SchemaField({
          id: new f.StringField({
            required: true,
            blank: false,
            initial: () => foundry.utils.randomID()
          }),
          name: new f.StringField({ required: true, blank: true, initial: "" }),
          when: choice(keys(MMRPG.effectTriggers), "hit"),
          target: choice(keys(MMRPG.effectTargets), "targets"),
          /** Condição aplicada (vazio = nenhuma). */
          status: optionalChoice(MMRPG.statuses.map((s) => s.id)),
          /** Duração em rodadas (0 = até ser removido). */
          rounds: int(0, { min: 0 }),
          /** Modificações aplicadas ao alvo enquanto o efeito durar. */
          changes: new f.ArrayField(
            new f.SchemaField({
              key: new f.StringField({ required: true, blank: true, initial: "" }),
              type: choice(keys(MMRPG.changeTypes), "add"),
              value: new f.StringField({ required: true, blank: true, initial: "" })
            })
          ),
          /** Texto mostrado no cartão do chat. */
          note: new f.StringField({ required: true, blank: true, initial: "" })
        })
      ),

      cost: new f.SchemaField({
        focus: int(0, { min: 0 }),
        karma: int(0, { min: 0 }),
        health: int(0, { min: 0 }),
        /** O Foco informado é o mínimo: quem usa pode gastar mais (veja `perFocus`). */
        scalable: new f.BooleanField({ required: true, initial: false })
      }),

      uses: new f.SchemaField({
        value: int(0, { min: 0 }),
        /** Máximo de usos (0 = ilimitado). */
        max: int(0, { min: 0 })
      })
    };
  }

  /** O item que contém esta ação. */
  get item() {
    return this.parent?.parent ?? null;
  }

  /** O ator dono do item, se houver. */
  get actor() {
    return this.item?.actor ?? null;
  }

  /** A ação faz alguma rolagem? */
  get rolls() {
    return this.roll.mode !== "none";
  }

  /** A ação tem custo? */
  get hasCost() {
    return this.cost.focus > 0 || this.cost.karma > 0 || this.cost.health > 0;
  }

  /** A ação tem usos limitados? */
  get limitedUses() {
    return this.uses.max > 0;
  }

  /** Nome para exibição (cai no nome do item). */
  get displayName() {
    return this.name || this.item?.name || "";
  }

  /**
   * Cria os dados de uma ação nova com valores padrão para o tipo de item.
   * @param {string} [itemType]
   * @returns {object}
   */
  static blank(itemType) {
    const data = { id: foundry.utils.randomID(), name: "" };
    if (itemType === "weapon") {
      data.roll = { mode: "attack", ability: "mle", kind: "close", targetDefense: "agl" };
      data.damage = { enabled: true };
    } else if (itemType === "gear") {
      data.roll = { mode: "none" };
      data.activation = "action";
    }
    return data;
  }
}
