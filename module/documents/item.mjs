/**
 * Item do sistema (poder, arma, trait, tag, origem, ocupação, equipamento).
 * @extends {Item}
 */
export class MarvelMultiverseItem extends Item {
  /**
   * Dados usados nas fórmulas de rolagem: os do item e, se estiver numa ficha, os do ator.
   * @override
   */
  getRollData() {
    const rollData = { ...super.getRollData() };
    if (!this.actor) return rollData;
    rollData.actor = this.actor.getRollData();
    return rollData;
  }

  /**
   * Usa o item: mostra a descrição no chat e, se o item tem um atributo de ataque, rola d616.
   * @returns {Promise<MarvelMultiverseRoll|void>}
   */
  async roll() {
    const actor = this.actor;
    if (!actor) return;

    const config = CONFIG.MARVEL_MULTIVERSE;
    const esc = (text) => Handlebars.escapeExpression(String(text ?? ""));
    const speaker = ChatMessage.getSpeaker({ actor });
    const rollMode = game.settings.get("core", "rollMode");

    // Cartão com a descrição (e o efeito, nos poderes).
    const info = [];
    for (const field of ["action", "trigger", "duration", "range", "cost"]) {
      const value = this.system[field];
      if (value) info.push(`<li><b>${esc(game.i18n.localize(`MARVEL_MULTIVERSE.Item.Field.${field}`))}:</b> ${esc(value)}</li>`);
    }
    const body = [
      info.length ? `<ul class="mm-card-info">${info.join("")}</ul>` : "",
      this.system.description ? `<div class="mm-card-text">${this.system.description}</div>` : "",
      this.system.effect ? `<div class="mm-card-text">${this.system.effect}</div>` : "",
    ].join("");

    await ChatMessage.create({
      speaker,
      rollMode,
      flavor: `${esc(game.i18n.localize(`TYPES.Item.${this.type}`))}: ${esc(this.name)}`,
      content: body || `<p>${esc(this.name)}</p>`,
    });

    // Rolagem de ataque.
    const abilityKey = this.system.ability;
    if (!abilityKey || !(abilityKey in config.abilities)) return;

    const damageType = this.system.damageType in config.damageTypes ? this.system.damageType : "";
    const roll = await actor.rollAbility(abilityKey, {
      item: this,
      damageType,
      formula: this.system.formula,
    });

    if (roll && this.system.attack) {
      Hooks.callAll("mmrpg.rollAttack", this, roll);
      Hooks.callAll("mmrpg.calcDamage", this, roll);
    }
    return roll;
  }
}
