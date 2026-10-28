/**
 * Macros: arrastar ações do item para a barra de atalhos e API pública (game.mmrpg).
 */

import { MMRPG } from "../config.mjs";

/**
 * Usa uma ação a partir do UUID do item.
 * @param {string} uuid
 * @param {string} [actionId]
 * @param {object} [options]
 */
export async function useItemByUuid(uuid, actionId, options = {}) {
  const item = await fromUuid(uuid);
  if (!item || !item.actor) {
    ui.notifications.warn(game.i18n.localize("MMRPG.Warn.itemNotFound"));
    return null;
  }
  return item.use(actionId, options);
}

/**
 * Cria (ou reaproveita) o macro de uma ação quando um item é solto na barra de atalhos.
 * Os dados chegam no formato { type: "mmrpgAction", uuid, actionId }.
 */
export function registerHotbar() {
  Hooks.on("hotbarDrop", (bar, data, slot) => {
    if (data?.type !== "mmrpgAction") return;
    createActionMacro(data, slot);
    return false;
  });
}

async function createActionMacro(data, slot) {
  const item = await fromUuid(data.uuid);
  if (!item) return;
  const action = item.system.getAction?.(data.actionId);
  const name = action?.name || item.name;
  const command = `game.mmrpg.useItem("${data.uuid}", "${data.actionId ?? ""}", { event });`;
  let macro = game.macros.find((m) => m.name === name && m.command === command && m.isAuthor);
  if (!macro) {
    macro = await Macro.create({ name, type: "script", img: item.img, command, flags: { [MMRPG.id]: { actionMacro: true } } });
  }
  game.user.assignHotbarMacro(macro, slot);
}

/**
 * Macro de teste de atributo para o token selecionado.
 * @param {string} abilityKey
 * @param {object} [options]
 */
export async function rollAbilityForSelected(abilityKey, options = {}) {
  const { rollAbilityCheck } = await import("../actions/executor.mjs");
  const tokens = canvas.tokens?.controlled ?? [];
  if (!tokens.length) {
    ui.notifications.warn(game.i18n.localize("MMRPG.Warn.selectToken"));
    return;
  }
  for (const token of tokens) await rollAbilityCheck(token.actor, abilityKey, options);
}
