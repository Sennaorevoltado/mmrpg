/**
 * Cartões de chat das ações.
 *
 * O cartão guarda em flags tudo o que é preciso para recalcular o resultado (ação, atacante,
 * alvos e o que já foi aplicado). O HTML é regerado a cada mudança (re-rolagem, aplicação).
 */

import { MMRPG } from "../config.mjs";
import { resolveAction, toInt } from "../rules/index.mjs";
import { createChatMessage } from "../helpers/compat.mjs";

export const FLAG_SCOPE = MMRPG.id;
export const FLAG_CARD = "card";

const CARD_TEMPLATE = `${MMRPG.path}/templates/chat/action-card.hbs`;
const CHECK_TEMPLATE = `${MMRPG.path}/templates/chat/check-card.hbs`;

/**
 * Monta os dados persistentes de um cartão.
 * @param {object} p
 * @returns {object}
 */
export function makeCard({ actor, item, action, targets, attacker }) {
  return {
    version: 1,
    actorUuid: actor.uuid,
    actorName: actor.name,
    actorImg: actor.img,
    itemUuid: item?.uuid ?? null,
    itemName: item?.name ?? "",
    itemImg: item?.img ?? "",
    action,
    attacker,
    targets,
    applied: {
      targets: targets.map(() => ({ damage: false, healing: false, effects: false })),
      self: { healing: false, effects: false }
    }
  };
}

/**
 * Resultado das regras para um cartão (recalculado sempre que necessário).
 * @param {object} card
 * @param {D616Roll|null} roll
 */
export function computeResult(card, roll) {
  const rolled = card.action.roll.mode !== "none" && roll;
  const summary = rolled ? roll.summary : null;
  return resolveAction({
    action: card.action,
    roll: summary,
    attacker: card.attacker,
    targets: card.targets
  });
}

/** Algum efeito do cartão já foi aplicado? */
export function anyApplied(card) {
  const t = card.applied.targets.some((s) => s.damage || s.healing || s.effects);
  return t || card.applied.self.healing || card.applied.self.effects;
}

/* -------------------------------------------- */

function effectLabel(card, id) {
  const def = card.action.effects.find((e) => e.id === id);
  if (!def) return "";
  if (def.name) return def.name;
  if (def.status) return game.i18n.localize(`MMRPG.Status.${def.status}`);
  return game.i18n.localize("MMRPG.Effect.generic");
}

/** Rótulo da fração do dano no cálculo do cartão ("" quando o dano é inteiro). */
function scaleLabel(scale) {
  if (scale === undefined || scale === 1) return "";
  return scale === 0.5 ? "½" : String(scale);
}

function damageView(card, d, marvelValue) {
  if (!d) return null;
  return {
    amount: d.amount,
    resource: d.resource,
    resourceLabel: game.i18n.localize(`MMRPG.Resource.${d.resource}`),
    multiplier: d.effectiveMultiplier,
    additive: d.base - toInt(marvelValue) * d.effectiveMultiplier,
    marvelValue,
    doubled: d.doubled,
    scaleLabel: scaleLabel(d.scale),
    reduction: d.reduction,
    zero: d.effectiveMultiplier === 0
  };
}

/**
 * Dados para o template do cartão.
 * @param {object} card
 * @param {D616Roll|null} roll
 * @returns {Promise<object>}
 */
export async function buildContext(card, roll) {
  const action = card.action;
  const result = computeResult(card, roll);
  const display = roll?.toDisplay?.() ?? null;
  const marvelValue = display?.marvelValue ?? 0;
  const isAttack = result.mode === "attack";
  const isCheck = result.mode === "check";

  const targets = result.targets.map((t, index) => {
    const snap = card.targets[index];
    const applied = card.applied.targets[index];
    const effects = t.effects.map((id) => ({ id, label: effectLabel(card, id) }));
    return {
      index,
      name: t.name,
      img: snap?.img,
      defense: t.defense,
      hit: t.hit,
      margin: t.margin,
      damage: damageView(card, t.damage, marvelValue),
      healing: t.healing
        ? { ...t.healing, resourceLabel: game.i18n.localize(`MMRPG.Resource.${t.healing.resource}`) }
        : null,
      effects,
      applied,
      hasAnything: !!(t.damage || t.healing || effects.length),
      pending: (t.damage && !applied.damage) || (t.healing && !applied.healing) || (effects.length && !applied.effects)
    };
  });

  const selfEffects = result.self.effects.map((id) => ({ id, label: effectLabel(card, id) }));
  const self = {
    healing: result.self.healing
      ? { ...result.self.healing, resourceLabel: game.i18n.localize(`MMRPG.Resource.${result.self.healing.resource}`) }
      : null,
    effects: selfEffects,
    applied: card.applied.self,
    has: !!(result.self.healing || selfEffects.length),
    pending: (result.self.healing && !card.applied.self.healing) || (selfEffects.length && !card.applied.self.effects)
  };

  const description = action.description
    ? await foundry.applications.ux.TextEditor.implementation.enrichHTML(action.description, { rollData: {} })
    : "";

  const element = action.damage.element || "";

  return {
    actor: { name: card.actorName, img: card.actorImg },
    item: { name: card.itemName, img: card.itemImg },
    title: action.name || card.itemName,
    activation: `MMRPG.Activation.${action.activation}`,
    description,
    mode: result.mode,
    isAttack,
    isCheck,
    rolled: result.rolled,
    roll: display,
    abilityLabel: `MMRPG.Ability.${action.roll.ability}.long`,
    targetDefenseLabel: `MMRPG.Ability.${action.roll.targetDefense}.long`,
    check: result.check,
    fantastic: result.fantastic,
    ultimate: result.ultimate,
    targets,
    hasTargets: targets.length > 0,
    self,
    preview: damageView(card, result.preview, marvelValue),
    element: element ? { key: element, label: MMRPG.elements[element]?.label } : null,
    elementStatus: element && MMRPG.elements[element]?.status ? `MMRPG.Status.${MMRPG.elements[element].status}` : null,
    elementFantasticApplies: !!(element && result.fantastic),
    costs: ["focus", "karma", "health"]
      .filter((k) => action.cost[k] > 0)
      .map((k) => ({ label: `MMRPG.Resource.${k}`, amount: action.cost[k] })),
    uses: action.uses.max > 0 ? { value: action.uses.value, max: action.uses.max } : null,
    isArea: action.target.type === "area" && action.area.size > 0,
    locked: anyApplied(card)
  };
}

/**
 * HTML do cartão de uma ação.
 * @param {object} card
 * @param {D616Roll|null} roll
 * @returns {Promise<string>}
 */
export async function renderCard(card, roll) {
  const context = await buildContext(card, roll);
  return foundry.applications.handlebars.renderTemplate(CARD_TEMPLATE, context);
}

/**
 * HTML de um cartão de teste simples (rolagem de atributo, sem alvo).
 * @param {object} p
 * @returns {Promise<string>}
 */
export async function renderCheckCard({ actor, title, subtitle = "", roll }) {
  return foundry.applications.handlebars.renderTemplate(CHECK_TEMPLATE, {
    actor: { name: actor.name, img: actor.img },
    title,
    subtitle,
    roll: roll.toDisplay()
  });
}

/**
 * Cria a mensagem de chat de uma ação.
 * @param {object} p
 * @returns {Promise<ChatMessage>}
 */
export async function postCard({ card, roll, speaker, messageMode }) {
  const content = await renderCard(card, roll);
  const data = {
    speaker,
    content,
    rolls: roll ? [roll] : [],
    flags: { [FLAG_SCOPE]: { [FLAG_CARD]: card } }
  };
  return createChatMessage(data, messageMode);
}
