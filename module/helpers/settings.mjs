/**
 * Configurações do mundo: orçamento de atributos por Rank e trava da compra de pontos.
 */

import { MMRPG } from "../config.mjs";
import { DEFAULT_BUDGET, normalizeBudgetTable } from "../rules/index.mjs";
import { refreshOpenWindows } from "./appearance.mjs";
import BudgetConfig from "../apps/budget-config.mjs";

export function registerSettings() {
  game.settings.register(MMRPG.id, "budget", {
    scope: "world",
    config: false,
    type: Object,
    default: normalizeBudgetTable(DEFAULT_BUDGET),
    onChange: () => refreshOpenWindows()
  });

  game.settings.register(MMRPG.id, "strictBudget", {
    name: "MMRPG.Settings.strictBudget.name",
    hint: "MMRPG.Settings.strictBudget.hint",
    scope: "world",
    config: true,
    type: Boolean,
    default: false,
    onChange: () => refreshOpenWindows()
  });

  game.settings.registerMenu(MMRPG.id, "budgetConfig", {
    name: "MMRPG.Budget.menuName",
    label: "MMRPG.Budget.menuLabel",
    hint: "MMRPG.Budget.menuHint",
    icon: "fa-solid fa-table-list",
    type: BudgetConfig,
    restricted: true
  });
}
