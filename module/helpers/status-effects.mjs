/**
 * Condições do sistema como status effects do Foundry.
 */

import { MMRPG } from "../config.mjs";

/** Substitui a lista padrão de status effects pela do sistema. */
export function registerStatusEffects() {
  CONFIG.statusEffects = MMRPG.statuses.map((s) => ({
    id: s.id,
    name: `MMRPG.Status.${s.id}`,
    img: s.img,
    icon: s.img
  }));
  if (CONFIG.specialStatusEffects) CONFIG.specialStatusEffects.DEFEATED = "dead";
}
