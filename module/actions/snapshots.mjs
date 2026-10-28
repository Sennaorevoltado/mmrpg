/**
 * Conversão entre documentos do Foundry e os objetos simples que as regras puras usam.
 */

import {
  ABILITY_KEYS,
  EDGE_MODE,
  parseEdgeMode,
  combineEdgeModes,
  toInt
} from "../rules/index.mjs";

/**
 * Pontuações e multiplicadores do atacante, mais os bônus fixos da ação.
 * @param {Actor} actor
 * @param {object} action   Dados da ação (toObject).
 * @returns {object}
 */
export function attackerSnapshot(actor, action) {
  const sys = actor.system;
  const abilities = {};
  const multipliers = {};
  for (const key of ABILITY_KEYS) {
    abilities[key] = toInt(sys.abilities[key].value);
    multipliers[key] = toInt(sys.abilities[key].multiplier);
  }
  const damageAbility = action.damage?.ability || action.roll?.ability || "mle";
  return {
    abilities,
    multipliers,
    damageFlat: toInt(action.damage?.flat) + toInt(sys.abilities[damageAbility]?.damageBonus),
    healingFlat: toInt(action.healing?.flat)
  };
}

/**
 * Defesas e redução de dano de um alvo.
 * @param {Token|TokenDocument|Actor} subject
 * @returns {object|null}
 */
export function targetSnapshot(subject) {
  const token = subject?.document ?? (subject?.documentName === "Token" ? subject : null);
  const actor = subject?.actor ?? (subject?.documentName === "Actor" ? subject : null);
  if (!actor?.system?.abilities) return null;
  return {
    id: actor.uuid,
    name: token?.name ?? subject?.name ?? actor.name,
    img: token?.texture?.src ?? actor.img,
    defenses: actor.system.defenses,
    reduction: actor.system.damageReduction
  };
}

/**
 * Modo Edge/Trouble final de uma ação.
 * Fontes: o modo configurado na ação, as marcas do atributo na ficha e a escolha no diálogo.
 *
 * @param {Actor} actor
 * @param {object} action
 * @param {string|number} [dialogMode]
 * @returns {number}
 */
export function edgeModeFor(actor, action, dialogMode = EDGE_MODE.NORMAL) {
  const modes = [parseEdgeMode(action.roll?.edge), parseEdgeMode(dialogMode)];
  const ability = actor.system.abilities?.[action.roll?.ability];
  if (ability) {
    if (ability.edge) modes.push(EDGE_MODE.EDGE);
    if (ability.trouble) modes.push(EDGE_MODE.TROUBLE);
  }
  return combineEdgeModes(...modes);
}

/**
 * Modificador numérico da rolagem de uma ação.
 * Ataques usam o valor de ataque do atributo; testes usam o bônus fora de combate.
 *
 * @param {Actor} actor
 * @param {object} action
 * @param {number} [extra=0]  Bônus do diálogo.
 * @returns {number}
 */
export function rollModifierFor(actor, action, extra = 0) {
  const ability = actor.system.abilities?.[action.roll?.ability];
  if (!ability) return toInt(action.roll?.bonus) + toInt(extra);
  const base = action.roll?.mode === "check" ? ability.noncom : ability.attack;
  return toInt(base) + toInt(action.roll?.bonus) + toInt(extra);
}
