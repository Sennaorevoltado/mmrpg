/**
 * Ganchos das formas: quando uma forma ativa é editada, o personagem reaplica o efeito, as
 * concessões e as imagens (senão a ficha ficaria com o que a forma era antes da edição).
 */

import { MMRPG } from "../config.mjs";

/** Campos da forma que mudam o que ela faz no personagem. */
const WATCHED = ["changes", "rank", "borrowed", "grants", "portrait", "token", "carryDamage"];

export function registerFormHooks() {
  Hooks.on("updateItem", (item, changes, options, userId) => {
    if (item.type !== "form" || !item.actor || !item.system.active) return;
    if (userId !== game.user.id || options?.mmrpgSkipRefresh) return;
    const system = changes?.system;
    if (!system || !WATCHED.some((key) => key in system || Object.keys(system).some((k) => k.startsWith(`${key}.`)))) return;
    item.actor.refreshForm(item).catch((err) => console.error(`${MMRPG.id} | falha ao atualizar a forma`, err));
  });
}
