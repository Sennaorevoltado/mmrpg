/**
 * Configuração do sistema (CONFIG.MMRPG).
 */

import { ABILITY_KEYS, MIN_RANK, MAX_RANK } from "./rules/index.mjs";

export const MMRPG = {
  /** Identificador do sistema (o mesmo do system.json). */
  id: "mmrpg",
  /** Caminho do sistema dentro do Foundry. */
  path: "systems/mmrpg",
  /** Atributos, na ordem em que aparecem na ficha. */
  abilities: ABILITY_KEYS,
  /** Ranks da ficha. */
  ranks: Array.from({ length: MAX_RANK - MIN_RANK + 1 }, (_, i) => MIN_RANK + i)
};
