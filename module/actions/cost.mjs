/**
 * Custos e usos limitados das ações.
 */

/**
 * Verifica se a ação pode ser usada agora.
 * @param {Actor} actor
 * @param {object} action   Dados da ação.
 * @returns {string|null}   Mensagem de erro já localizada, ou null se pode usar.
 */
export function availabilityProblem(actor, action) {
  if (action.uses?.max > 0 && action.uses.value <= 0) {
    return game.i18n.localize("MMRPG.Warn.noUses");
  }
  const missing = actor.missingResource(action.cost);
  if (missing) {
    return game.i18n.format("MMRPG.Warn.noResource", {
      resource: game.i18n.localize(`MMRPG.Resource.${missing}`)
    });
  }
  return null;
}

/**
 * Cobra o custo da ação e consome um uso, se for limitado.
 * @param {Actor} actor
 * @param {Item} item
 * @param {object} action
 */
export async function payCost(actor, item, action) {
  await actor.spend(action.cost);
  if (action.uses?.max > 0) {
    const actions = item.system.toObject().actions;
    const entry = actions.find((a) => a.id === action.id);
    if (entry) {
      entry.uses.value = Math.max(0, entry.uses.value - 1);
      await item.update({ "system.actions": actions });
    }
  }
}

/**
 * Linhas de custo para exibição no cartão.
 * @param {object} action
 * @returns {{ resource: string, amount: number }[]}
 */
export function costLines(action) {
  return ["focus", "karma", "health"]
    .filter((key) => action.cost?.[key] > 0)
    .map((key) => ({ resource: `MMRPG.Resource.${key}`, amount: action.cost[key] }));
}
