/**
 * Automação ligada ao combate e à saúde: expiração de efeitos e derrota de NPCs.
 * Tudo roda só no GM ativo.
 */

import { MMRPG } from "../config.mjs";

export function registerCombatHooks() {
  // Efeitos com duração em rodadas expiram quando a rodada chega ao fim da duração.
  Hooks.on("updateCombat", async (combat, changes) => {
    if (!game.user.isActiveGM || !("round" in changes)) return;
    for (const combatant of combat.combatants) {
      const actor = combatant.actor;
      if (!actor) continue;
      const expired = actor.effects.filter((e) => {
        const expires = e.getFlag(MMRPG.id, "expires");
        return expires && expires.combat === combat.id && combat.round >= expires.round;
      });
      if (expired.length) await actor.deleteEmbeddedDocuments("ActiveEffect", expired.map((e) => e.id));
    }
  });

  // Efeitos presos a um combate que termina são removidos.
  Hooks.on("deleteCombat", async (combat) => {
    if (!game.user.isActiveGM) return;
    for (const combatant of combat.combatants) {
      const actor = combatant.actor;
      if (!actor) continue;
      const ids = actor.effects
        .filter((e) => e.getFlag(MMRPG.id, "expires")?.combat === combat.id)
        .map((e) => e.id);
      if (ids.length) await actor.deleteEmbeddedDocuments("ActiveEffect", ids);
    }
  });

  // NPCs com 0 de Health ou menos ficam derrotados.
  Hooks.on("updateActor", async (actor, changes) => {
    if (!game.user.isActiveGM || actor.type !== "npc") return;
    if (!game.settings.get(MMRPG.id, "autoDefeat")) return;
    if (foundry.utils.getProperty(changes, "system.health.value") === undefined) return;
    const defeated = actor.system.health.value <= 0;
    const has = actor.statuses.has("dead");
    if (defeated !== has) await actor.toggleStatusEffect("dead", { active: defeated, overlay: defeated });
  });
}
