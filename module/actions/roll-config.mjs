/**
 * Diálogo de configuração de rolagem (Edge/Trouble, bônus e visibilidade).
 */

import { MMRPG } from "../config.mjs";
import { userMessageMode, messageModeList } from "../helpers/compat.mjs";

/** Modo de mensagem padrão do usuário (nomes internos: public, gm, blind, self). */
export function defaultMessageMode() {
  return userMessageMode();
}

/** Modos de mensagem disponíveis, no formato de lista de opções. */
export function messageModeChoices() {
  return messageModeList();
}

/**
 * Abre o diálogo e devolve a escolha do jogador.
 *
 * @param {object} p
 * @param {string} p.title
 * @param {string} p.summary         Linha de resumo (ex.: "Melee +3").
 * @param {number} [p.edgeMode=0]    Modo já vindo da ficha/ação (apenas informativo).
 * @param {boolean} [p.showBonus=true]
 * @param {boolean} [p.showEdge=true]   Mostra Edge/Trouble (ações sem rolagem não precisam).
 * @param {{ min: number, max: number }|null} [p.focus]  Foco a gastar, quando o custo é um mínimo.
 * @returns {Promise<{ edge: string, bonus: number, messageMode: string, focus: number|null }|null>}
 */
export async function promptRollConfig({ title, summary = "", edgeMode = 0, showBonus = true, showEdge = true, focus = null } = {}) {
  const current = defaultMessageMode();
  const content = await foundry.applications.handlebars.renderTemplate(`${MMRPG.path}/templates/dialog/roll-config.hbs`, {
    summary,
    inheritedEdgeLabel: edgeMode === 1 ? MMRPG.edgeModes.edge : edgeMode === -1 ? MMRPG.edgeModes.trouble : "",
    edgeChoices: MMRPG.edgeModes,
    showBonus,
    showEdge,
    focus,
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
          focus: focus ? Math.trunc(Number(data.focus)) || focus.min : null,
          messageMode: data.messageMode || current
        };
      }
    }
  });
}
