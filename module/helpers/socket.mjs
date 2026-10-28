/**
 * Canal de socket do sistema.
 *
 * Jogadores não podem alterar atores que não possuem; por isso pedem ao GM ativo para aplicar
 * o resultado de um cartão de chat. O GM não recebe valores do jogador: recebe só o id da
 * mensagem e relê os dados gravados nela (ver actions/apply.mjs).
 */

import { MMRPG } from "../config.mjs";

/** @type {Map<string, (payload: object, userId: string) => Promise<void>|void>} */
const handlers = new Map();

/**
 * Registra o tratamento de um tipo de pedido (executado apenas no GM ativo).
 * @param {string} type
 * @param {(payload: object, userId: string) => Promise<void>|void} fn
 */
export function onSocket(type, fn) {
  handlers.set(type, fn);
}

/** Liga o ouvinte do socket. Chamar uma vez, no hook "ready". */
export function activateSocket() {
  game.socket.on(MMRPG.socket, async (message) => {
    if (!message || typeof message.type !== "string") return;
    if (!game.user.isActiveGM) return;
    const fn = handlers.get(message.type);
    if (!fn) return;
    try {
      await fn(message.payload ?? {}, message.userId);
    } catch (err) {
      console.error(`${MMRPG.id} | erro no pedido de socket "${message.type}"`, err);
    }
  });
}

/**
 * Envia um pedido ao GM ativo (ou executa localmente se este usuário for o GM ativo).
 * @param {string} type
 * @param {object} payload
 * @returns {Promise<boolean>} false se não há GM ativo.
 */
export async function requestGM(type, payload) {
  if (game.user.isActiveGM) {
    const fn = handlers.get(type);
    if (fn) await fn(payload, game.user.id);
    return true;
  }
  if (!game.users.activeGM) return false;
  game.socket.emit(MMRPG.socket, { type, payload, userId: game.user.id });
  return true;
}
