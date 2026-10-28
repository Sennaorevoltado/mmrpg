/**
 * Diálogo de configuração de rolagem (Edge/Trouble, bônus e visibilidade).
 */

import { MMRPG } from "../config.mjs";

/** Modo de mensagem padrão do usuário. */
export function defaultMessageMode() {
  try {
    if (game.settings.settings.has("core.messageMode")) return game.settings.get("core", "messageMode");
  } catch (err) {
    /* usa o padrão */
  }
  return "public";
}

/** Modos de mensagem disponíveis, no formato de lista de opções. */
export function messageModeChoices() {
  const modes = CONFIG.ChatMessage?.modes ?? { public: "CHAT.MODES.public", gm: "CHAT.MODES.gm", blind: "CHAT.MODES.blind", self: "CHAT.MODES.self" };
  return Object.entries(modes)
    .filter(([key]) => key !== "ic")
    .map(([key, value]) => ({
      value: key,
      label: game.i18n.localize(typeof value === "string" ? value : (value?.label ?? key))
    }));
}

/**
 * Abre o diálogo e devolve a escolha do jogador.
 *
 * @param {object} p
 * @param {string} p.title
 * @param {string} p.summary         Linha de resumo (ex.: "Melee +3").
 * @param {number} [p.edgeMode=0]    Modo já vindo da ficha/ação (apenas informativo).
 * @param {boolean} [p.showBonus=true]
 * @returns {Promise<{ edge: string, bonus: number, messageMode: string }|null>}
 */
export async function promptRollConfig({ title, summary = "", edgeMode = 0, showBonus = true } = {}) {
  const current = defaultMessageMode();
  const content = await foundry.applications.handlebars.renderTemplate(`${MMRPG.path}/templates/dialog/roll-config.hbs`, {
    summary,
    inheritedEdgeLabel: edgeMode === 1 ? MMRPG.edgeModes.edge : edgeMode === -1 ? MMRPG.edgeModes.trouble : "",
    edgeChoices: MMRPG.edgeModes,
    showBonus,
    modes: messageModeChoices().map((m) => ({ ...m, selected: m.value === current }))
  });

  const { DialogV2 } = foundry.applications.api;
  return DialogV2.prompt({
    classes: ["mmrpg", "mmrpg-dialog"],
    window: { title },
    position: { width: 380 },
    content,
    rejectClose: false,
    modal: false,
    ok: {
      label: game.i18n.localize("MMRPG.Dialog.roll"),
      callback: (event, button) => {
        const data = new foundry.applications.ux.FormDataExtended(button.form).object;
        return {
          edge: data.edge || "normal",
          bonus: Math.trunc(Number(data.bonus)) || 0,
          messageMode: data.messageMode || current
        };
      }
    }
  });
}
