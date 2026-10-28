/**
 * Combatente: a iniciativa é uma rolagem d616 com Vigilance (mais o bônus de iniciativa).
 * Edge/Trouble marcados na ficha re-rolam automaticamente o dado mais fraco/forte.
 */

import D616Roll from "../dice/d616-roll.mjs";
import { EDGE_MODE, combineEdgeModes } from "../rules/index.mjs";

export default class MMRPGCombatant extends Combatant {
  /** @inheritdoc */
  getInitiativeRoll(formula) {
    const system = this.actor?.system;
    if (!system?.init) return super.getInitiativeRoll(formula);

    const modes = [];
    if (system.init.edge) modes.push(EDGE_MODE.EDGE);
    if (system.init.trouble) modes.push(EDGE_MODE.TROUBLE);

    const roll = D616Roll.build({
      modifier: system.init.total,
      edgeMode: combineEdgeModes(...modes)
    });
    roll.options.autoReroll = true;
    return roll;
  }
}
