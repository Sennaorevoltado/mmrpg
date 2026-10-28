/**
 * Botões dos cartões do chat.
 */

import { requestApply } from "./apply.mjs";
import { FLAG_SCOPE, FLAG_CARD, FLAG_CHECK, anyApplied, renderCard, renderCheckCard } from "./card.mjs";
import { regionShapeData, unitsToPixels, CONE_SPREAD } from "../helpers/area-shapes.mjs";

const TEMPLATE_TYPES = { circle: "circle", cone: "cone", ray: "ray", rect: "rect" };

/**
 * Liga os botões de um cartão renderizado. Chamado pelo hook renderChatMessageHTML.
 * @param {ChatMessage} message
 * @param {HTMLElement} html
 */
export function activateCardListeners(message, html) {
  const root = html.querySelector?.(".mmrpg-card");
  if (!root) return;

  // Só o autor e o GM mexem no cartão.
  const canControl = game.user.isGM || message.author?.id === game.user.id;
  if (!canControl) {
    root.querySelectorAll("[data-mmrpg-control]").forEach((el) => el.remove());
    return;
  }

  root.addEventListener("click", async (event) => {
    const button = event.target.closest("[data-mmrpg-action]");
    if (!button || !root.contains(button)) return;
    event.preventDefault();
    button.disabled = true;
    try {
      await handleAction(message, button);
    } finally {
      button.disabled = false;
    }
  });
}

async function handleAction(message, button) {
  const action = button.dataset.mmrpgAction;
  const index = Number(button.dataset.index ?? 0);
  switch (action) {
    case "apply-target":
      return requestApply(message, { scope: "target", index });
    case "apply-damage":
      return requestApply(message, { scope: "target", index, kinds: ["damage"] });
    case "apply-healing":
      return requestApply(message, { scope: "target", index, kinds: ["healing"] });
    case "apply-effects":
      return requestApply(message, { scope: "target", index, kinds: ["effects"] });
    case "apply-self":
      return requestApply(message, { scope: "self" });
    case "apply-all":
      return requestApply(message, { scope: "all" });
    case "reroll":
      return rerollDie(message, Number(button.dataset.die));
    case "place-template":
      return placeTemplate(message);
  }
}

/**
 * Re-rola um dado do cartão (Edge/Trouble) e atualiza a mensagem.
 * @param {ChatMessage} message
 * @param {number} dieIndex
 */
export async function rerollDie(message, dieIndex) {
  const card = foundry.utils.deepClone(message.getFlag(FLAG_SCOPE, FLAG_CARD));
  const roll = message.rolls[0];
  if (!roll?.canReroll) return;
  if (card && anyApplied(card)) {
    ui.notifications.warn(game.i18n.localize("MMRPG.Warn.alreadyApplied"));
    return;
  }
  await roll.reroll(dieIndex);
  const faceRoll = roll._rerollRoll;
  if (faceRoll && game.dice3d?.showForRoll) game.dice3d.showForRoll(faceRoll, game.user, true);

  const update = { rolls: [roll] };
  const check = message.getFlag(FLAG_SCOPE, FLAG_CHECK);
  if (card) {
    update.content = await renderCard(card, roll);
  } else if (check) {
    update.content = await renderCheckCard({
      actor: { name: check.actorName, img: check.actorImg },
      title: check.title,
      subtitle: check.subtitle,
      roll
    });
  } else {
    const html = await roll.render({});
    update.content = html;
  }
  await message.update(update);
}

/**
 * Cria no mapa um gabarito de área centrado no token do atacante.
 * @param {ChatMessage} message
 */
export async function placeTemplate(message) {
  const card = message.getFlag(FLAG_SCOPE, FLAG_CARD);
  if (!card || !canvas?.scene) return;
  const actor = await fromUuid(card.actorUuid);
  const token = actor?.getActiveTokens?.(true)?.[0] ?? canvas.tokens.controlled[0];
  if (!token) {
    ui.notifications.warn(game.i18n.localize("MMRPG.Warn.noToken"));
    return;
  }
  const { shape, size } = card.action.area;
  const color = game.user.color?.css ?? game.user.color ?? "#ff0000";
  const flags = { [FLAG_SCOPE]: { messageId: message.id } };

  // Foundry v14: a área vira uma Região. Em versões sem Regiões (ou se a criação falhar), um gabarito.
  let placed = false;
  if ((game.release?.generation ?? 0) >= 14 && CONFIG.Region) {
    try {
      const dims = canvas.dimensions;
      await canvas.scene.createEmbeddedDocuments("Region", [
        {
          name: card.itemName || game.i18n.localize("MMRPG.Card.area"),
          color,
          visibility: CONST.REGION_VISIBILITY?.ALWAYS ?? 0,
          displayMeasurements: true,
          shapes: [
            regionShapeData({
              shape,
              x: token.center.x,
              y: token.center.y,
              length: unitsToPixels(size, dims),
              direction: 0,
              cell: dims.size
            })
          ],
          flags
        }
      ]);
      placed = true;
    } catch (err) {
      console.warn(`${FLAG_SCOPE} | não foi possível criar a Região; usando gabarito`, err);
    }
  }
  if (!placed) {
    await canvas.scene.createEmbeddedDocuments("MeasuredTemplate", [
      {
        t: TEMPLATE_TYPES[shape] ?? "circle",
        user: game.user.id,
        x: token.center.x,
        y: token.center.y,
        direction: 0,
        distance: size,
        angle: shape === "cone" ? CONE_SPREAD : 0,
        width: shape === "ray" ? canvas.dimensions.distance : 0,
        fillColor: color,
        flags
      }
    ]);
  }
  ui.notifications.info(game.i18n.localize("MMRPG.Info.templatePlaced"));
}
