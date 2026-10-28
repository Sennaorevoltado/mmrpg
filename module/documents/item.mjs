/**
 * Documento Item do sistema.
 */

import { MMRPG } from "../config.mjs";
import ActionData from "../data/action.mjs";

export default class MMRPGItem extends Item {
  /** Ações executáveis deste item (lista vazia para tipos sem ações). */
  get actions() {
    return this.system.actionList ?? [];
  }

  /** O item tem ao menos uma ação? */
  get hasActions() {
    return this.actions.length > 0;
  }

  /** @inheritdoc */
  async _preCreate(data, options, user) {
    if ((await super._preCreate(data, options, user)) === false) return false;

    // Ícone padrão por tipo, quando o criador não escolheu um.
    if (!data.img && MMRPG.itemIcons[this.type]) {
      this.updateSource({ img: MMRPG.itemIcons[this.type] });
    }

    // Uma forma copiada ou arrastada nunca chega ativa: quem liga é o personagem.
    if (this.type === "form" && (data.system?.active || data.system?.activatedAt)) {
      this.updateSource({ "system.active": false, "system.activatedAt": 0 });
    }

    // Armas e equipamentos novos já vêm com uma ação em branco.
    if (["weapon", "gear"].includes(this.type) && data.system?.actions === undefined) {
      this.updateSource({ "system.actions": [ActionData.blank(this.type)] });
    }
  }

  /** Apagar uma forma ativa a desliga antes (concessões, efeito e imagens saem da ficha). */
  async _preDelete(options, user) {
    if ((await super._preDelete(options, user)) === false) return false;
    if (this.type === "form" && this.system.active && this.actor) {
      try {
        await this.actor.setFormActive(this, false, { announce: false });
      } catch (err) {
        console.error(`${MMRPG.id} | falha ao desativar a forma antes de apagar`, err);
      }
    }
  }

  /**
   * Executa uma ação do item.
   * @param {string} [actionId]   Padrão: a primeira ação.
   * @param {object} [options]
   * @returns {Promise<ChatMessage|null>}
   */
  async use(actionId, options = {}) {
    const { useAction } = await import("../actions/executor.mjs");
    return useAction(this, actionId, options);
  }

  /**
   * Substitui a lista de ações (atualização de array inteiro).
   * @param {object[]} actions   Dados simples das ações.
   */
  async setActions(actions) {
    return this.update({ "system.actions": actions });
  }

  /**
   * Acrescenta uma ação em branco.
   * @returns {Promise<string>} id da nova ação.
   */
  async addAction() {
    const actions = this.system.toObject().actions;
    const blank = ActionData.blank(this.type);
    actions.push(blank);
    await this.setActions(actions);
    return blank.id;
  }

  /**
   * Restaura todos os usos limitados das ações.
   */
  async resetUses() {
    const actions = this.system.toObject().actions;
    let changed = false;
    for (const a of actions) {
      if (a.uses.max > 0 && a.uses.value !== a.uses.max) {
        a.uses.value = a.uses.max;
        changed = true;
      }
    }
    if (changed) await this.setActions(actions);
  }
}
