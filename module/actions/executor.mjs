/**
 * Executor de ações: do clique no item até o cartão no chat.
 *
 * Fluxo: validar → alvos → diálogo → cobrar custo → rolar → resolver (regras puras) → cartão.
 */

import D616Roll from "../dice/d616-roll.mjs";
import { EDGE_MODE, parseEdgeMode, combineEdgeModes } from "../rules/index.mjs";
import { attackerSnapshot, targetSnapshot, edgeModeFor, rollModifierFor } from "./snapshots.mjs";
import { availabilityProblem, payCost } from "./cost.mjs";
import { defaultMessageMode, promptRollConfig } from "./roll-config.mjs";
import { makeCard, postCard, renderCheckCard } from "./card.mjs";
import { requestApply } from "./apply.mjs";
import { MMRPG } from "../config.mjs";
import { createChatMessage } from "../helpers/compat.mjs";
import { toInt } from "../rules/abilities.mjs";

/** O clique pede execução direta, sem diálogo? (Shift) */
function isFastForward(event) {
  return !!(event?.shiftKey);
}

/** Token de origem para o speaker. */
function sourceToken(actor) {
  return canvas?.tokens?.controlled?.find((t) => t.actor?.id === actor.id)?.document ?? actor.activeToken?.document ?? null;
}

/**
 * Alvos da ação.
 * @param {Actor} actor
 * @param {object} action
 * @returns {object[]}
 */
export function collectTargets(actor, action) {
  if (action.target.type === "self") {
    const snap = targetSnapshot(actor.activeToken ?? actor);
    return snap ? [snap] : [];
  }
  let list = [...(game.user?.targets ?? [])].map((t) => targetSnapshot(t)).filter(Boolean);
  const max = action.target.count;
  if (max > 0 && list.length > max) {
    ui.notifications.info(game.i18n.format("MMRPG.Info.targetLimit", { count: max }));
    list = list.slice(0, max);
  }
  return list;
}

/**
 * Avisa quando um alvo está além do alcance (apenas aviso; não bloqueia).
 * @param {Actor} actor
 * @param {object} action
 */
function warnRange(actor, action) {
  const limit = action.target.distance;
  if (!(limit > 0) || !canvas?.grid) return;
  const from = actor.activeToken;
  if (!from) return;
  for (const target of game.user.targets) {
    try {
      const d = canvas.grid.measurePath([from.center, target.center]).distance;
      if (d > limit) {
        ui.notifications.warn(game.i18n.format("MMRPG.Warn.outOfRange", { name: target.name, distance: Math.round(d), range: limit }));
      }
    } catch (err) {
      return;
    }
  }
}

/**
 * Usa uma ação de um item.
 *
 * @param {Item} item
 * @param {string} [actionId]            Padrão: a primeira ação do item.
 * @param {object} [options]
 * @param {Event} [options.event]
 * @param {boolean} [options.fastForward]
 * @param {number} [options.focus]       Foco a gastar, quando o custo da ação é um mínimo (padrão: o mínimo).
 * @returns {Promise<ChatMessage|null>}
 */
export async function useAction(item, actionId, { event, fastForward, focus } = {}) {
  const actor = item.actor;
  if (!actor) {
    ui.notifications.warn(game.i18n.localize("MMRPG.Warn.noActor"));
    return null;
  }
  const data = actionId ? item.system.getAction?.(actionId) : item.actions[0];
  if (!data) {
    ui.notifications.warn(game.i18n.localize("MMRPG.Warn.noAction"));
    return null;
  }
  const action = data.toObject();

  const problem = availabilityProblem(actor, action);
  if (problem) {
    ui.notifications.warn(problem);
    return null;
  }

  const targets = collectTargets(actor, action);
  warnRange(actor, action);

  // Configuração da rolagem (e do Foco gasto, quando o custo é um mínimo)
  let config = { edge: "normal", bonus: 0, messageMode: defaultMessageMode(), focus: null };
  const rolls = action.roll.mode !== "none";
  const scalable = !!action.cost.scalable && action.cost.focus > 0;
  const focusRange = scalable ? { min: action.cost.focus, max: Math.max(action.cost.focus, toInt(actor.system.focus.value)) } : null;
  if ((rolls || scalable) && !(fastForward ?? isFastForward(event))) {
    const ability = actor.system.abilities[action.roll.ability];
    const summaryParts = rolls
      ? [`${game.i18n.localize(`MMRPG.Ability.${action.roll.ability}.long`)} ${formatSigned(rollModifierFor(actor, action))}`]
      : [];
    const chosen = await promptRollConfig({
      title: action.name || item.name,
      summary: summaryParts.join(" "),
      edgeMode: rolls ? edgeModeFor(actor, action) : 0,
      showBonus: rolls && !!ability,
      showEdge: rolls,
      focus: focusRange
    });
    if (!chosen) return null;
    config = chosen;
  }

  // Foco realmente gasto: o mínimo da ação ou o que o jogador escolheu.
  if (scalable) {
    const wanted = Math.trunc(Number(focus ?? config.focus ?? focusRange.min)) || focusRange.min;
    const spent = Math.max(focusRange.min, wanted);
    if (spent > toInt(actor.system.focus.value)) {
      ui.notifications.warn(
        game.i18n.format("MMRPG.Warn.noResource", { resource: game.i18n.localize("MMRPG.Resource.focus") })
      );
      return null;
    }
    action.cost.focus = spent;
    if (action.damage.perFocus > 0) action.damage.flat = toInt(action.damage.flat) + Math.floor(spent * action.damage.perFocus);
    if (action.healing.perFocus > 0) action.healing.flat = toInt(action.healing.flat) + Math.floor(spent * action.healing.perFocus);
  }

  await payCost(actor, item, action);

  // Rolagem
  let roll = null;
  if (rolls) {
    const edgeMode = edgeModeFor(actor, action, config.edge);
    roll = D616Roll.build({
      modifier: rollModifierFor(actor, action, config.bonus),
      edgeMode,
      flavor: action.name || item.name
    });
    await roll.evaluate();
  }

  const card = makeCard({
    actor,
    item,
    action,
    targets,
    attacker: attackerSnapshot(actor, action)
  });

  const message = await postCard({
    card,
    roll,
    speaker: ChatMessage.getSpeaker({ actor, token: sourceToken(actor) }),
    messageMode: config.messageMode
  });

  if (message && game.settings.get(MMRPG.id, "autoApply")) await requestApply(message);
  return message;
}

/**
 * Teste de atributo fora de uma ação (clique no atributo da ficha).
 *
 * @param {Actor} actor
 * @param {string} abilityKey
 * @param {object} [options]
 * @param {Event} [options.event]
 * @param {boolean} [options.fastForward]
 * @param {"attack"|"noncom"} [options.kind="noncom"]
 * @returns {Promise<ChatMessage|null>}
 */
export async function rollAbilityCheck(actor, abilityKey, { event, fastForward, kind = "noncom" } = {}) {
  const ability = actor.system.abilities?.[abilityKey];
  if (!ability) return null;
  const label = game.i18n.localize(`MMRPG.Ability.${abilityKey}.long`);
  const base = kind === "attack" ? ability.attack : ability.noncom;

  let config = { edge: "normal", bonus: 0, messageMode: defaultMessageMode() };
  const inherited = combineEdgeModes(
    ability.edge ? EDGE_MODE.EDGE : 0,
    ability.trouble ? EDGE_MODE.TROUBLE : 0
  );
  if (!(fastForward ?? isFastForward(event))) {
    const chosen = await promptRollConfig({
      title: label,
      summary: `${label} ${formatSigned(base)}`,
      edgeMode: inherited
    });
    if (!chosen) return null;
    config = chosen;
  }

  const roll = D616Roll.build({
    modifier: base + config.bonus,
    edgeMode: combineEdgeModes(inherited, parseEdgeMode(config.edge)),
    flavor: label
  });
  await roll.evaluate();

  const content = await renderCheckCard({
    actor,
    title: label,
    subtitle: game.i18n.localize(kind === "attack" ? "MMRPG.Roll.attack" : "MMRPG.Roll.check"),
    roll
  });
  return createChatMessage(
    {
      speaker: ChatMessage.getSpeaker({ actor, token: sourceToken(actor) }),
      content,
      rolls: [roll]
    },
    config.messageMode
  );
}

function formatSigned(n) {
  const v = Math.trunc(Number(n) || 0);
  return v >= 0 ? `+${v}` : `${v}`;
}
