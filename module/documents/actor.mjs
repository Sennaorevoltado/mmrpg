/**
 * Ator do sistema: dados de rolagem, iniciativa e a rolagem d616 de atributo.
 * @extends {Actor}
 */
export class MarvelMultiverseActor extends Actor {
  /**
   * Dados usados nas fórmulas de rolagem.
   *
   * Os atributos ficam também na raiz, para fórmulas como `@mle.value + 4`.
   * @override
   */
  getRollData() {
    const data = {};

    if (this.system.abilities) {
      for (const [k, v] of Object.entries(this.system.abilities)) {
        data[k] = foundry.utils.deepClone(v);
      }
    }

    data.rank = this.system.attributes?.rank?.value;

    return { ...super.getRollData(), ...data };
  }

  /* -------------------------------------------- */

  /** @inheritdoc */
  async rollInitiative(options = {}) {
    return super.rollInitiative(options);
  }

  /**
   * Rolagem de iniciativa, ainda sem resultado.
   * @param {object} [options]  Opções da rolagem
   * @returns {MarvelMultiverseRoll}
   */
  getInitiativeRoll(options = {}) {
    if (this._cachedInitiativeRoll) return this._cachedInitiativeRoll.clone();
    return new CONFIG.Dice.MarvelMultiverseRoll("{1d6,1dm,1d6}", this.getRollData(), options);
  }

  /* -------------------------------------------- */

  /**
   * Rola d616 + o valor de um atributo e manda para o chat.
   *
   * @param {string} abilityKey                 mle, agl, res, vig, ego ou log
   * @param {object} [options]
   * @param {"ability"|"noncom"} [options.kind]  Teste de atributo (padrão) ou fora de combate
   * @param {Item} [options.item]               Poder, arma ou item que originou a rolagem
   * @param {string} [options.damageType]       health ou focus, para o botão de dano
   * @param {string} [options.formula]          Dados da rolagem (padrão: {1d6,1dm,1d6})
   * @returns {Promise<MarvelMultiverseRoll|null>}
   */
  async rollAbility(abilityKey, { kind = "ability", item = null, damageType = "", formula = "{1d6,1dm,1d6}" } = {}) {
    const config = CONFIG.MARVEL_MULTIVERSE;
    if (!(abilityKey in config.abilities)) {
      ui.notifications.warn(game.i18n.localize("MARVEL_MULTIVERSE.Warn.noAbility"));
      return null;
    }

    const field = kind === "noncom" ? "noncom" : "value";
    const roll = new CONFIG.Dice.MarvelMultiverseRoll(
      `${formula || "{1d6,1dm,1d6}"}+@abilities.${abilityKey}.${field}`,
      this.getRollData()
    );

    const esc = (text) => Handlebars.escapeExpression(String(text ?? ""));
    const parts = [esc(game.i18n.localize(config.abilities[abilityKey]))];
    if (kind === "noncom") parts.push(esc(game.i18n.localize("MARVEL_MULTIVERSE.NonCombat")));
    if (item) parts.push(`${esc(game.i18n.localize(`TYPES.Item.${item.type}`))}: ${esc(item.name)}`);
    if (damageType in config.damageTypes) {
      parts.push(`${esc(game.i18n.localize("MARVEL_MULTIVERSE.DamageType"))}: ${esc(game.i18n.localize(config.damageTypes[damageType]))}`);
    }

    const rollMode = game.settings.get("core", "rollMode");
    await roll.toMessage(
      {
        speaker: ChatMessage.getSpeaker({ actor: this }),
        flavor: parts.join(" &middot; "),
      },
      {
        rollMode,
        flags: { ability: abilityKey, kind, damageType, itemId: item?.id ?? null },
      }
    );
    return roll;
  }
}
