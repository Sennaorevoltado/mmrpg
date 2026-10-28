/**
 * Resolução de ações — junta rolagem, atacante e alvos num resultado pronto para o chat.
 *
 * Função pura: recebe objetos simples e devolve objetos simples.
 * É chamada na criação do cartão de chat e novamente quando uma re-rolagem (Edge/Trouble)
 * altera o resultado, para recalcular acertos e dano.
 */

import { computeDamage, computeMarvelHealing } from "./damage.mjs";
import { toInt } from "./abilities.mjs";

/**
 * @typedef {object} RollSummary
 * @property {number} total
 * @property {number} marvelValue
 * @property {boolean} fantastic
 * @property {boolean} ultimate
 *
 * @typedef {object} AttackerSnapshot
 * @property {Record<string, number>} abilities      Pontuação de cada atributo.
 * @property {Record<string, number>} multipliers    Multiplicador de dano de cada atributo.
 * @property {number} [damageFlat=0]                 Bônus fixo já calculado para o dano.
 * @property {number} [healingFlat=0]                Bônus fixo já calculado para a cura.
 *
 * @typedef {object} TargetSnapshot
 * @property {string} id
 * @property {string} name
 * @property {Record<string, number>} defenses
 * @property {{ health: number, focus: number }} [reduction]
 */

/**
 * Decide se um efeito dispara.
 * @param {string} when
 * @param {{ mode: string, hit: boolean, success: boolean, fantastic: boolean }} ctx
 * @returns {boolean}
 */
export function effectTriggers(when, ctx) {
  switch (when) {
    case "always":
      return true;
    case "hit":
      return ctx.mode === "attack" ? ctx.hit : ctx.success;
    case "miss":
      return ctx.mode === "attack" ? !ctx.hit : !ctx.success;
    case "success":
      return ctx.success;
    case "failure":
      return !ctx.success;
    case "fantastic":
      return ctx.fantastic;
    default:
      return false;
  }
}

/**
 * Resolve uma ação.
 *
 * @param {object} p
 * @param {object} p.action                 Dados da ação (ver data/action.mjs).
 * @param {RollSummary|null} p.roll         Resumo da rolagem (null se a ação não rola).
 * @param {AttackerSnapshot} p.attacker
 * @param {TargetSnapshot[]} [p.targets=[]]
 * @returns {object}
 */
export function resolveAction({ action, roll, attacker, targets = [] }) {
  const mode = action.roll?.mode ?? "none";
  const rolled = mode !== "none" && !!roll;
  const fantastic = rolled && !!roll.fantastic;
  const ultimate = rolled && !!roll.ultimate;
  const total = rolled ? roll.total : null;

  const rollAbility = action.roll?.ability || "mle";
  const damageAbility = action.damage?.ability || rollAbility;
  const abilityValue = toInt(attacker.abilities?.[damageAbility]);
  const baseMultiplier =
    toInt(attacker.multipliers?.[damageAbility]) + toInt(action.damage?.multiplierBonus);

  // Teste contra dificuldade fixa.
  let check = null;
  if (mode === "check") {
    const difficulty = toInt(action.roll.difficulty);
    check = { difficulty, success: fantastic || total >= difficulty, margin: total - difficulty };
  }

  const resolveTarget = (t) => {
    const defenseKey = action.roll?.targetDefense || "agl";
    const defense = toInt(t.defenses?.[defenseKey]);
    let hit = false;
    let success = true;
    if (mode === "attack") {
      hit = fantastic || total >= defense;
      success = hit;
    } else if (mode === "check") {
      hit = check.success;
      success = check.success;
    } else {
      hit = true;
      success = true;
    }

    const ctx = { mode, hit, success, fantastic };

    // Dano
    let damage = null;
    if (action.damage?.enabled && rolled && hit) {
      const resource = action.damage.resource === "focus" ? "focus" : "health";
      const reduction = toInt(t.reduction?.[resource]);
      const result = computeDamage({
        marvelValue: roll.marvelValue,
        multiplier: baseMultiplier,
        abilityValue,
        flat: attacker.damageFlat ?? 0,
        fantastic,
        reduction,
        fantasticFactor: action.damage.fantasticFactor ?? 2
      });
      damage = { ...result, resource, reduction };
    }

    // Cura (só quando o alvo da cura é "targets")
    let healing = null;
    if (action.healing?.enabled && action.healing.target !== "self" && success) {
      healing = resolveHealing(action, roll, attacker);
    }

    const effects = (action.effects ?? [])
      .filter((e) => (e.target ?? "targets") !== "self" && effectTriggers(e.when, ctx))
      .map((e) => e.id);

    return {
      id: t.id,
      name: t.name,
      defense: mode === "attack" ? defense : null,
      hit,
      margin: mode === "attack" ? total - defense : null,
      damage,
      healing,
      effects
    };
  };

  const resolvedTargets = targets.map(resolveTarget);

  // Efeitos e cura em si mesmo
  const selfSuccess = mode === "attack"
    ? resolvedTargets.length === 0 || resolvedTargets.some((t) => t.hit)
    : mode === "check"
      ? check.success
      : true;
  const selfCtx = { mode, hit: selfSuccess, success: selfSuccess, fantastic };
  const selfEffects = (action.effects ?? [])
    .filter((e) => e.target === "self" && effectTriggers(e.when, selfCtx))
    .map((e) => e.id);
  const selfHealing =
    action.healing?.enabled && action.healing.target === "self" && selfSuccess
      ? resolveHealing(action, roll, attacker)
      : null;

  // Prévia de dano sem alvos (ex.: nada marcado no mapa)
  let preview = null;
  if (action.damage?.enabled && rolled && targets.length === 0) {
    const resource = action.damage.resource === "focus" ? "focus" : "health";
    preview = {
      ...computeDamage({
        marvelValue: roll.marvelValue,
        multiplier: baseMultiplier,
        abilityValue,
        flat: attacker.damageFlat ?? 0,
        fantastic,
        reduction: 0,
        fantasticFactor: action.damage.fantasticFactor ?? 2
      }),
      resource,
      reduction: 0
    };
  }

  return {
    mode,
    rolled,
    total,
    fantastic,
    ultimate,
    check,
    targets: resolvedTargets,
    self: { success: selfSuccess, effects: selfEffects, healing: selfHealing },
    preview
  };
}

/**
 * Calcula a cura de uma ação.
 * @returns {{ amount: number, resource: string }}
 */
function resolveHealing(action, roll, attacker) {
  const h = action.healing;
  const resource = ["health", "focus", "karma"].includes(h.resource) ? h.resource : "health";
  let amount;
  if (h.mode === "flat" || !roll) {
    amount = toInt(attacker.healingFlat);
  } else {
    const ability = h.ability || action.roll?.ability || "mle";
    amount = computeMarvelHealing({
      marvelValue: roll.marvelValue,
      multiplier: toInt(attacker.multipliers?.[ability]) + toInt(h.multiplierBonus),
      abilityValue: toInt(attacker.abilities?.[ability]),
      flat: attacker.healingFlat ?? 0
    });
  }
  return { amount: Math.max(0, amount), resource };
}
