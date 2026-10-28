/**
 * D616Roll — rolagem de três dados (d6 + dado Marvel + d6) com modificador fixo.
 *
 * Toda a lógica de decisão (Fantástico, Ultimate, Edge/Trouble) está em module/rules/d616.mjs;
 * esta classe só liga essas funções puras aos dados do Foundry.
 */

import { MMRPG } from "../config.mjs";
import MarvelDie from "./marvel-die.mjs";
import {
  EDGE_MODE,
  buildFormula,
  summarizeD616,
  applyReroll,
  autoRerollIndex,
  parseEdgeMode,
  toInt
} from "../rules/index.mjs";

export default class D616Roll extends Roll {
  /** Template usado por Roll#render. */
  static CHAT_TEMPLATE = `${MMRPG.path}/templates/dice/roll.hbs`;

  /**
   * Cria uma rolagem d616 (ainda não avaliada). O nome é `build` e não `create` para não
   * colidir com `Roll.create(formula, data, options)` do Foundry, que tem outra assinatura.
   * @param {object} [p]
   * @param {number} [p.modifier=0]
   * @param {number|string} [p.edgeMode=0]
   * @param {string} [p.flavor]
   * @returns {D616Roll}
   */
  static build({ modifier = 0, edgeMode = EDGE_MODE.NORMAL, flavor = "" } = {}) {
    const mod = toInt(modifier);
    return new this(buildFormula(mod), {}, { modifier: mod, edgeMode: parseEdgeMode(edgeMode), flavor });
  }

  /* -------------------------------------------- */

  /** Modificador fixo somado aos dados. */
  get modifier() {
    return toInt(this.options.modifier);
  }

  /** Modo Edge/Trouble desta rolagem. */
  get edgeMode() {
    return parseEdgeMode(this.options.edgeMode);
  }

  /** A rolagem tem a forma esperada (três dados, o do meio é o dado Marvel)? */
  get isD616() {
    const dice = this.dice;
    return dice.length === 3 && dice[1] instanceof MarvelDie;
  }

  /** Estado dos dados no formato das regras puras. */
  get diceState() {
    return this.dice.map((term) => ({
      role: term instanceof MarvelDie ? "marvel" : "d6",
      results: term.results.map((r) => ({
        result: r.result,
        active: r.active !== false,
        discarded: !!r.discarded
      }))
    }));
  }

  /** Resumo da rolagem (null se ainda não avaliada ou inválida). */
  get summary() {
    if (!this._evaluated || !this.isD616) return null;
    return summarizeD616(this.diceState, this.modifier);
  }

  get isFantastic() {
    return this.summary?.fantastic ?? false;
  }

  get isUltimate() {
    return this.summary?.ultimate ?? false;
  }

  get marvelValue() {
    return this.summary?.marvelValue ?? 0;
  }

  /** Ainda é possível re-rolar um dado (Edge ou Trouble, uma vez por rolagem)? */
  get canReroll() {
    return this._evaluated && this.isD616 && this.edgeMode !== EDGE_MODE.NORMAL && !this.options.rerolled;
  }

  /* -------------------------------------------- */

  /**
   * Com `options.autoReroll`, a re-rolagem de Edge/Trouble é feita sozinha logo após a avaliação
   * (usado na iniciativa, onde ninguém escolhe o dado).
   * @inheritdoc
   */
  async _evaluate(options = {}) {
    await super._evaluate(options);
    if (this.options.autoReroll && this.canReroll) {
      await this.reroll(autoRerollIndex(this.diceState, this.edgeMode));
    }
    return this;
  }

  /**
   * Re-rola um dado conforme Edge (mantém o melhor) ou Trouble (mantém o pior).
   * Altera esta rolagem no lugar e recalcula o total.
   * @param {number} dieIndex   0, 1 (dado Marvel) ou 2
   * @returns {Promise<{ keepNew: boolean, keptFace: number, discardedFace: number, newFace: number }>}
   */
  async reroll(dieIndex) {
    if (!this.canReroll) throw new Error("Esta rolagem não pode ser re-rolada.");
    const faceRoll = await new Roll("1d6").evaluate();
    const newFace = faceRoll.total;
    const { dice, outcome } = applyReroll(this.diceState, dieIndex, this.edgeMode, newFace);
    dice.forEach((state, i) => {
      this.dice[i].results = state.results.map((r) => ({ ...r }));
    });
    this.options.rerolled = { die: dieIndex, newFace, keepNew: outcome.keepNew };
    this._total = this.summary.total;
    this._rerollRoll = faceRoll;
    return { ...outcome, newFace };
  }

  /* -------------------------------------------- */

  /**
   * Dados prontos para a visualização (template de rolagem e cartões).
   * @returns {object|null}
   */
  toDisplay() {
    const summary = this.summary;
    if (!summary) return null;
    const state = this.diceState;
    const dice = state.map((die, index) => {
      const faces = die.results.map((r) => ({
        result: r.result,
        label: die.role === "marvel" && r.result === 1 ? "M" : String(r.result),
        discarded: r.discarded || r.active === false,
        fantastic: die.role === "marvel" && r.result === 1,
        max: r.result === 6
      }));
      return { index, role: die.role, isMarvel: die.role === "marvel", faces };
    });
    const canReroll = this.canReroll;
    return {
      dice,
      modifier: this.modifier,
      modifierAbs: Math.abs(this.modifier),
      modifierPositive: this.modifier > 0,
      total: summary.total,
      diceTotal: summary.diceTotal,
      marvelValue: summary.marvelValue,
      fantastic: summary.fantastic,
      ultimate: summary.ultimate,
      edgeMode: this.edgeMode,
      edge: this.edgeMode === EDGE_MODE.EDGE,
      trouble: this.edgeMode === EDGE_MODE.TROUBLE,
      canReroll,
      rerolled: this.options.rerolled ?? null
    };
  }

  /** @inheritdoc */
  async render({ flavor, template = this.constructor.CHAT_TEMPLATE, isPrivate = false } = {}) {
    if (!this._evaluated) await this.evaluate();
    const display = this.toDisplay();
    if (!display) return super.render({ flavor, template: undefined, isPrivate });
    const html = await foundry.applications.handlebars.renderTemplate(template, {
      ...display,
      flavor: isPrivate ? null : (flavor ?? this.options.flavor),
      isPrivate,
      user: game.user.id
    });
    // Rolagem solta (iniciativa, mensagens antigas): vai dentro de um cartão para ter as cores do sistema.
    return `<div class="mmrpg-card mmrpg-bare-roll">${html}</div>`;
  }
}
