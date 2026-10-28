/**
 * Leitura das configurações do orçamento de atributos.
 * (Separado de settings.mjs para a janela de configuração poder importar sem ciclo.)
 */

import { MMRPG } from "../config.mjs";
import { DEFAULT_BUDGET, normalizeBudgetTable } from "../rules/index.mjs";

/** Tabela de orçamento atual (Ranks 1 a 6). Qualquer erro de leitura cai na tabela padrão. */
export function getBudgetTable() {
  try {
    return normalizeBudgetTable(game.settings.get(MMRPG.id, "budget"));
  } catch (err) {
    return normalizeBudgetTable(DEFAULT_BUDGET);
  }
}

/** Os botões + devem parar no teto e quando os pontos acabam? */
export function isStrictBudget() {
  try {
    return game.settings.get(MMRPG.id, "strictBudget") === true;
  } catch (err) {
    return false;
  }
}
