import { MarvelMultiverseRoll } from "../dice/roll.mjs";
import { MarvelDie } from "../dice/dietype/marvel-die.mjs";
import { rootOf } from "../helpers/compat.mjs";

/** O grupo de dados {d6, dM, d6} de uma rolagem d616, ou null se não for uma. */
export function d616Pool(roll) {
  const { PoolTerm, ParentheticalTerm } = foundry.dice.terms;
  const first = roll?.terms?.[0];
  let pool = null;
  if (first instanceof ParentheticalTerm && first.roll?.terms?.[0] instanceof PoolTerm) pool = first.roll.terms[0];
  else if (first instanceof PoolTerm) pool = first;
  if (!pool || pool.rolls?.length !== 3) return null;
  return pool.rolls[1]?.terms?.[0] instanceof MarvelDie ? pool : null;
}

/** O dado Marvel do grupo mostra o resultado Fantástico (o "M")? */
export function isFantasticPool(pool) {
  const marvelDie = pool?.rolls?.[1]?.dice?.[0];
  return !!marvelDie?.results?.some((r) => r.active && r.result === 1);
}

/**
 * Dano de um ataque: dado Marvel x (multiplicador - Redução de Dano do alvo) + valor do atributo,
 * dobrado num Sucesso Fantástico. Se a Redução de Dano zera o multiplicador, não há dano.
 *
 * @param {object} input
 * @param {number} input.marvelValue    Resultado do dado Marvel (o "M" vale 6)
 * @param {number} input.multiplier     Multiplicador de dano do atributo
 * @param {number} [input.reduction=0]  Redução de Dano do alvo
 * @param {number} input.abilityScore   Valor do atributo
 * @param {boolean} [input.fantastic=false]
 * @returns {{net: number, dmg: number}}
 */
export function computeDamage({ marvelValue, multiplier, reduction = 0, abilityScore, fantastic = false }) {
  const net = multiplier - reduction;
  let dmg = net === 0 ? 0 : marvelValue * net + abilityScore;
  if (fantastic) dmg *= 2;
  return { net, dmg: Math.max(0, dmg) };
}

/**
 * Mensagem de chat do sistema: liga os botões do cartão de rolagem (Edge, Trouble e Dano).
 * @extends {ChatMessage}
 */
export class ChatMessageMarvel extends ChatMessage {
  /**
   * Chamado depois que o Foundry desenha cada mensagem (hook renderChatMessageHTML).
   * @param {ChatMessage} message
   * @param {HTMLElement|jQuery} html
   */
  static onRenderChatMessageHTML(message, html) {
    if (!(message instanceof ChatMessageMarvel)) return;
    message._enrichChatCard(rootOf(html));
  }

  /** O ator que falou (pelo token, se houver). */
  get speakerActor() {
    return ChatMessage.getSpeakerActor(this.speaker);
  }

  /** O usuário atual pode mexer nos botões desta rolagem? */
  get canUseRollButtons() {
    return game.user.isGM || this.isAuthor || !!this.speakerActor?.isOwner;
  }

  /* -------------------------------------------- */

  /**
   * Liga ou esconde os botões do cartão.
   * @param {HTMLElement} html
   * @protected
   */
  _enrichChatCard(html) {
    if (!html?.querySelectorAll) return;

    const buttons = [...html.querySelectorAll("button.retroEdgeMode, button.damage")];
    const pool = d616Pool(this.rolls?.[0]);
    const isD616 = !!pool;

    // Aviso de Sucesso Fantástico no cartão (todos veem, mesmo sem poder mexer nos botões).
    if (isD616 && isFantasticPool(pool) && !html.querySelector(".mm-fantastic")) {
      const total = html.querySelector(".dice-total");
      if (total) {
        const badge = document.createElement("div");
        badge.className = "mm-fantastic";
        badge.textContent = game.i18n.localize("MARVEL_MULTIVERSE.Fantastic");
        total.before(badge);
      }
    }

    // Os botões só fazem sentido numa rolagem d616 e para quem pode usá-los.
    if (!isD616 || !this.canUseRollButtons) {
      for (const el of buttons) el.remove();
      html.querySelectorAll(".reroll-buttons").forEach((el) => el.remove());
      return;
    }

    const isInitiative = !!this.getFlag("core", "initiativeRoll");

    // O botão de Dano só vale para ataques com um dos quatro atributos de dano.
    const info = this.getFlag("mmrpg", "roll");
    const canDamage = !isInitiative && info?.kind !== "noncom" && CONFIG.MARVEL_MULTIVERSE.damageAbilities.includes(info?.ability);
    if (!canDamage) html.querySelector("button.damage")?.remove();

    for (const el of html.querySelectorAll("button.retroEdgeMode")) {
      if (isInitiative) el.dataset.initiative = "true";
      el.addEventListener("click", (event) => this._onClickRetroButton(event));
    }
    html.querySelector("button.damage")?.addEventListener("click", (event) => this._onClickDamageButton(event));
  }

  /* -------------------------------------------- */
  /*  Dano                                        */
  /* -------------------------------------------- */

  /**
   * Clique no botão de dano.
   * @param {PointerEvent} event
   * @protected
   */
  _onClickDamageButton(event) {
    event.stopPropagation();
    return this._handleDamageChatButton();
  }

  /**
   * Calcula o dano da rolagem e o mostra no chat. Se há alvos marcados, mostra um por alvo.
   * @protected
   */
  async _handleDamageChatButton() {
    const config = CONFIG.MARVEL_MULTIVERSE;
    const info = this.getFlag("mmrpg", "roll") ?? {};
    const abilityKey = info.ability;
    const actor = this.speakerActor;

    if (!actor || !config.damageAbilities.includes(abilityKey)) {
      ui.notifications.warn(game.i18n.localize("MARVEL_MULTIVERSE.Warn.noDamageAbility"));
      return;
    }

    const pool = d616Pool(this.rolls[0]);
    const [marvelDie] = pool.rolls[1].dice;
    const fantastic = marvelDie.results.some((r) => r.active && r.result === 1);
    const marvelValue = marvelDie.total;

    const damageType = info.damageType in config.damageTypes ? info.damageType : "health";
    const ability = actor.system.abilities[abilityKey];
    const multiplier = ability.damageMultiplier;
    const abilityName = game.i18n.localize(config.abilities[abilityKey]);
    const typeName = game.i18n.localize(config.damageTypes[damageType]);
    const esc = (text) => Handlebars.escapeExpression(String(text ?? ""));

    const compute = (reduction = 0) => computeDamage({ marvelValue, multiplier, reduction, abilityScore: ability.value, fantastic });

    const targets = [...game.user.targets].map((t) => t.actor).filter(Boolean);
    const rows = [];

    if (targets.length === 0) {
      const { dmg } = compute(0);
      rows.push(
        `<p>${game.i18n.format("MARVEL_MULTIVERSE.Damage.generic", {
          amount: `<b>${dmg}${fantastic ? ` ${esc(game.i18n.localize("MARVEL_MULTIVERSE.Fantastic"))}` : ""}</b>`,
          type: esc(typeName),
        })}<br/><small>${game.i18n.format("MARVEL_MULTIVERSE.Damage.breakdown", {
          die: marvelValue,
          multiplier,
          reduction: 0,
          net: multiplier,
          ability: esc(abilityName),
          score: ability.value,
        })}</small></p>`
      );
    } else {
      for (const target of targets) {
        const reduction = Number(
          damageType === "focus" ? target.system?.focusDamageReduction : target.system?.healthDamageReduction
        ) || 0;
        const { net, dmg } = compute(reduction);
        rows.push(
          `<p>${game.i18n.format("MARVEL_MULTIVERSE.Damage.target", {
            name: `<b>${esc(target.name)}</b>`,
            amount: `<b>${dmg}${fantastic ? ` ${esc(game.i18n.localize("MARVEL_MULTIVERSE.Fantastic"))}` : ""}</b>`,
            type: esc(typeName),
          })}<br/><small>${game.i18n.format("MARVEL_MULTIVERSE.Damage.breakdown", {
            die: marvelValue,
            multiplier,
            reduction,
            net,
            ability: esc(abilityName),
            score: ability.value,
          })}</small></p>`
        );
      }
    }

    return ChatMessage.create({
      speaker: ChatMessage.getSpeaker({ actor }),
      rollMode: game.settings.get("core", "rollMode"),
      flavor: `${esc(abilityName)} &middot; ${esc(game.i18n.localize("MARVEL_MULTIVERSE.Damage.title"))}`,
      content: rows.join(""),
    });
  }

  /* -------------------------------------------- */
  /*  Edge e Trouble depois da rolagem            */
  /* -------------------------------------------- */

  /**
   * Clique num botão de Edge ou Trouble de um dos dados.
   * @param {PointerEvent} event
   * @protected
   */
  _onClickRetroButton(event) {
    event.stopPropagation();
    const target = event.currentTarget;
    const action = target.dataset.retroAction;
    const isInit = !!target.dataset.initiative;
    const dieIndex = Math.round(Number(target.dataset.index));
    return this._handleChatButton(action, dieIndex, isInit);
  }

  async _handleEdge(active, rollResult) {
    if (active) {
      rollResult.active = true;
      rollResult.discarded = undefined;
    } else {
      rollResult.active = false;
      rollResult.discarded = true;
    }
  }

  /**
   * Rola de novo um dos dados e fica com o melhor (Edge) ou o pior (Trouble).
   * @param {"edge"|"trouble"} action
   * @param {number} dieIndex   0 = primeiro d6, 1 = dado Marvel, 2 = segundo d6
   * @param {boolean} isInit    A rolagem é de iniciativa?
   * @protected
   */
  async _handleChatButton(action, dieIndex, isInit) {
    if (!action || !Number.isInteger(dieIndex)) throw new Error("Missing Information");

    const modifier = action === "edge" ? "kh" : "kl";
    const [roll] = this.rolls;
    const rollTerm = d616Pool(roll);
    if (!rollTerm) return;

    const targetRoll = rollTerm.rolls[dieIndex];
    const targetDie = targetRoll.terms[0];
    const targetIsMarvel = targetDie instanceof MarvelDie;
    const formulaGroups = /(?<number>\d)d(?<dieType>\d|m).*/.exec(targetRoll._formula)?.groups;
    if (!formulaGroups) return;

    const formulaDie = formulaGroups.dieType;

    targetDie.number = 2;

    const targetFormula = `${targetDie.number}d${formulaDie}`;

    targetRoll._formula = `${targetFormula}${modifier}`;

    rollTerm.terms[dieIndex] = targetRoll._formula;

    targetDie.modifiers = [modifier];

    const oldRollResult = targetDie.results.find((r) => r.active);
    const oldFantastic = targetIsMarvel && oldRollResult.result === 1;
    const oldResult = targetIsMarvel && oldRollResult.result === 1 ? 6 : oldRollResult.result;

    const newRoll = new MarvelMultiverseRoll(targetRoll._formula, { ...targetRoll.data });
    await newRoll.evaluate();

    const newRollResult = newRoll.terms[0].results[0];
    const newFantastic = targetIsMarvel && newRollResult.result === 1;
    const newResult = targetIsMarvel && newRollResult.result === 1 ? 6 : newRollResult.result;

    if (modifier === "kh") {
      if (newFantastic || newResult >= oldResult) {
        this._handleEdge(false, oldRollResult);
        this._handleEdge(true, newRollResult);
      } else if (oldFantastic || oldResult >= newResult) {
        this._handleEdge(false, newRollResult);
      }
    } else if (modifier === "kl") {
      if (newFantastic) {
        this._handleEdge(false, newRollResult);
        this._handleEdge(true, oldRollResult);
      } else if (newResult <= oldResult) {
        this._handleEdge(false, oldRollResult);
        this._handleEdge(true, newRollResult);
      } else if (newResult > oldResult) {
        this._handleEdge(false, newRollResult);
        this._handleEdge(true, oldRollResult);
      }
    }

    targetDie.results.push(newRollResult);

    const re = /(\(?{)(\dd\d),(\ddm),(\dd\d)(}.*)/;

    let replacedFormula;
    switch (dieIndex) {
      case 0:
        replacedFormula = roll.formula.replace(re, `$1${targetDie.number}d6${modifier},$3,$4$5`);
        break;
      case 1:
        replacedFormula = roll.formula.replace(re, `$1$2,${targetDie.number}dm${modifier},$4$5`);
        break;
      case 2:
        replacedFormula = roll.formula.replace(re, `$1$2,$3,${targetDie.number}d6${modifier}$5`);
        break;
    }

    roll._formula = replacedFormula;

    if (newRollResult.active) {
      roll._total = roll.total - oldResult + newResult;
    }

    let update = await roll.toMessage({ flavor: this.flavor }, { create: false });
    update = foundry.utils.mergeObject(this.toJSON(), update);

    if (isInit) {
      const actorId = this.speakerActor?.id;
      const combatant = game.combat?.combatants.find((c) => c.actorId === actorId);
      if (combatant) await combatant.update({ initiative: roll.total });
    }

    return this.update(update);
  }
}
