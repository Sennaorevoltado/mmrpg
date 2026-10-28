/**
 * Rolagem do sistema: o d616 ({1d6,1dm,1d6}), em que o dado do meio é o dado Marvel.
 *
 * Base: sistema de mjording / Rollbones Projects (MIT).
 *
 * @extends {Roll}
 * @param {string} formula                  Fórmula
 * @param {object} data                     Dados contra os quais a fórmula é resolvida
 * @param {object} [options={}]             Opções (edgeMode, flavor, rollMode...)
 */
export class MarvelMultiverseRoll extends Roll {
  constructor(formula, data, options) {
    super(formula, data, options);
    if (!this.options.configured) this.configureModifiers();
  }

  /* -------------------------------------------- */

  /**
   * Cria uma MarvelMultiverseRoll a partir de uma Roll comum.
   * @param {Roll} roll
   * @returns {MarvelMultiverseRoll}
   */
  static fromRoll(roll) {
    const newRoll = new MarvelMultiverseRoll(roll.formula, roll.data, roll.options);
    Object.assign(newRoll, roll);
    return newRoll;
  }

  /* -------------------------------------------- */

  /**
   * Modo de Edge da rolagem.
   * @enum {number}
   */
  static EDGE_MODE = {
    NORMAL: 0,
    EDGE: 1,
    TROUBLE: -1,
  };

  /**
   * Edge ou Trouble a partir do que quem rola está segurando (Alt = Edge, Ctrl/Cmd = Trouble).
   * @param {object} [options]
   * @param {Event} [options.event]
   * @param {boolean} [options.edge]
   * @param {boolean} [options.trouble]
   * @param {boolean} [options.fastForward]
   * @returns {{edgeMode: number, isFF: boolean}}
   */
  static determineEdgeMode({ event, edge = false, trouble = false, fastForward } = {}) {
    const isFF = fastForward ?? (event?.shiftKey || event?.altKey || event?.ctrlKey || event?.metaKey);
    let edgeMode = MarvelMultiverseRoll.EDGE_MODE.NORMAL;
    if (edge || event?.altKey) edgeMode = MarvelMultiverseRoll.EDGE_MODE.EDGE;
    else if (trouble || event?.ctrlKey || event?.metaKey) edgeMode = MarvelMultiverseRoll.EDGE_MODE.TROUBLE;
    return { isFF: !!isFF, edgeMode };
  }

  /* -------------------------------------------- */

  /** Template do cartão da rolagem no chat. */
  static CHAT_TEMPLATE = "systems/mmrpg/templates/dice/roll.hbs";

  /** A rolagem é um d616? (três dados dentro de um grupo) */
  get validD616Roll() {
    return this.dice.length === 3 && this.terms[0] instanceof foundry.dice.terms.PoolTerm;
  }

  /** A rolagem tem Edge? */
  get hasEdge() {
    return this.options.edgeMode === MarvelMultiverseRoll.EDGE_MODE.EDGE;
  }

  /** A rolagem tem Trouble? */
  get hasTrouble() {
    return this.options.edgeMode === MarvelMultiverseRoll.EDGE_MODE.TROUBLE;
  }

  /**
   * O dado Marvel deu o resultado Fantástico? Indefinido se a rolagem não foi feita.
   * @type {boolean|void}
   */
  get isFantastic() {
    if (!this._evaluated) return undefined;
    return this.dice[1]?.result === 1;
  }

  /* -------------------------------------------- */

  /**
   * Ajusta o dado Marvel quando o resultado é Fantástico.
   * @private
   */
  configureModifiers() {
    if (!this.validD616Roll) return;
    this.options.fantastic = 1;

    if (this.isFantastic) {
      for (const r of this.dice[1].results) {
        if (r.result === 1) {
          r.discarded = false;
          r.active = true;
        } else {
          r.discarded = true;
          r.active = false;
        }
      }
      this.dice[1].total = 6;
    }

    this.options.configured = true;
  }

  /**
   * Envia a rolagem ao chat.
   *
   * @param {object} [messageData]          Dados da mensagem
   * @param {object} [options]
   * @param {object} [options.flags]        Dados que o chat precisa depois (atributo, tipo de dano, item)
   * @inheritdoc
   */
  async toMessage(messageData = {}, options = {}) {
    if (!this._evaluated) await this.evaluate({});

    messageData.flavor = messageData.flavor || this.options.flavor || "";

    if (options.flags) {
      foundry.utils.setProperty(messageData, "flags.mmrpg.roll", options.flags);
      if (options.flags.itemId) foundry.utils.setProperty(messageData, "flags.mmrpg.itemId", options.flags.itemId);
    }

    if (this.hasEdge) messageData.flavor += ` (${game.i18n.localize("MARVEL_MULTIVERSE.edge")})`;
    else if (this.hasTrouble) messageData.flavor += ` (${game.i18n.localize("MARVEL_MULTIVERSE.trouble")})`;

    options.rollMode = options.rollMode ?? this.options.rollMode;
    return super.toMessage(messageData, options);
  }
}
