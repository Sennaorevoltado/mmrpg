/**
 * Aplicação do resultado de um cartão (dano, cura e efeitos).
 *
 * Quem não é GM pede ao GM ativo: o pedido leva só o id da mensagem e o escopo. O GM relê o
 * cartão gravado na mensagem e recalcula os valores, então o jogador não escolhe quantidades.
 */

import { requestGM, onSocket } from "../helpers/socket.mjs";
import { FLAG_SCOPE, FLAG_CARD, computeResult, renderCard } from "./card.mjs";

const ALL_KINDS = ["damage", "healing", "effects"];
const SOCKET_TYPE = "applyCard";

/** Liga o tratamento do pedido no lado do GM. Chamar no "ready". */
export function registerApplyHandler() {
  onSocket(SOCKET_TYPE, (payload, userId) => executeApply(payload, userId));
}

/**
 * Pede a aplicação de parte de um cartão.
 *
 * @param {ChatMessage} message
 * @param {object} [options]
 * @param {"target"|"self"|"all"} [options.scope="all"]
 * @param {number} [options.index]      Índice do alvo quando scope é "target".
 * @param {string[]} [options.kinds]    "damage", "healing", "effects" (padrão: todos).
 */
export async function requestApply(message, { scope = "all", index = 0, kinds = ALL_KINDS } = {}) {
  const ok = await requestGM(SOCKET_TYPE, { messageId: message.id, scope, index, kinds });
  if (!ok) ui.notifications.warn(game.i18n.localize("MMRPG.Warn.noGM"));
}

/**
 * Execução (no GM ativo).
 * @param {{ messageId: string, scope: string, index: number, kinds: string[] }} payload
 * @param {string} userId
 */
async function executeApply(payload, userId) {
  const message = game.messages.get(payload.messageId);
  if (!message) return;
  const sender = game.users.get(userId);
  if (!sender || !(sender.isGM || message.author?.id === userId)) return;

  const stored = message.getFlag(FLAG_SCOPE, FLAG_CARD);
  if (!stored) return;
  const card = foundry.utils.deepClone(stored);
  const roll = message.rolls[0] ?? null;
  const result = computeResult(card, roll);
  const kinds = (payload.kinds ?? ALL_KINDS).filter((k) => ALL_KINDS.includes(k));

  let indexes = [];
  if (payload.scope === "all") indexes = result.targets.map((_, i) => i);
  else if (payload.scope === "target") indexes = [Number(payload.index)];
  const includeSelf = payload.scope === "all" || payload.scope === "self";

  const origin = card.itemUuid;

  for (const i of indexes) {
    const t = result.targets[i];
    const snap = card.targets[i];
    const state = card.applied.targets[i];
    if (!t || !state) continue;
    const actor = await fromUuid(snap.id);
    if (!actor) continue;

    if (kinds.includes("damage") && t.damage && !state.damage) {
      await actor.applyDamage(t.damage.amount, t.damage.resource);
      state.damage = true;
    }
    if (kinds.includes("healing") && t.healing && !state.healing) {
      await actor.applyHealing(t.healing.amount, t.healing.resource);
      state.healing = true;
    }
    if (kinds.includes("effects") && t.effects.length && !state.effects) {
      for (const id of t.effects) {
        const def = card.action.effects.find((e) => e.id === id);
        if (def) await actor.applyActionEffect(def, { origin, label: card.itemName });
      }
      state.effects = true;
    }
  }

  if (includeSelf) {
    const actor = await fromUuid(card.actorUuid);
    if (actor) {
      if (kinds.includes("healing") && result.self.healing && !card.applied.self.healing) {
        await actor.applyHealing(result.self.healing.amount, result.self.healing.resource);
        card.applied.self.healing = true;
      }
      if (kinds.includes("effects") && result.self.effects.length && !card.applied.self.effects) {
        for (const id of result.self.effects) {
          const def = card.action.effects.find((e) => e.id === id);
          if (def) await actor.applyActionEffect(def, { origin, label: card.itemName });
        }
        card.applied.self.effects = true;
      }
    }
  }

  await message.update({
    content: await renderCard(card, roll),
    [`flags.${FLAG_SCOPE}.${FLAG_CARD}`]: card
  });
}
