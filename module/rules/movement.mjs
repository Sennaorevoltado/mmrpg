/**
 * Movimento — regras puras.
 *
 * Cada tipo de movimento tem um modo de cálculo relativo ao deslocamento de corrida (run):
 *  - fixed:  usa o valor base
 *  - half:   metade da corrida (arredondada para cima)
 *  - full:   igual à corrida
 *  - double: o dobro da corrida
 *  - triple: o triplo da corrida
 *  - rank:   valor base (mínimo 1) × Rank
 *  - runRank: corrida × Rank (voo do poder Flight)
 */

import { toInt } from "./abilities.mjs";

export const MOVEMENT_MODES = Object.freeze(["fixed", "half", "full", "double", "triple", "rank", "runRank"]);

/**
 * @typedef {{ base: number, bonus?: number, mode: string }} MovementEntry
 */

/**
 * Calcula o deslocamento de todos os tipos de movimento.
 * @param {Record<string, MovementEntry>} entries
 * @param {number} rank
 * @returns {Record<string, number>}
 */
export function computeMovement(entries, rank) {
  const out = {};
  const run = entries.run ? Math.max(0, toInt(entries.run.base) + toInt(entries.run.bonus)) : 0;
  out.run = run;
  for (const [key, entry] of Object.entries(entries)) {
    if (key === "run") continue;
    const bonus = toInt(entry.bonus);
    let value;
    switch (entry.mode) {
      case "half":
        value = Math.ceil(run / 2);
        break;
      case "full":
        value = run;
        break;
      case "double":
        value = run * 2;
        break;
      case "triple":
        value = run * 3;
        break;
      case "rank":
        value = Math.max(1, toInt(entry.base)) * toInt(rank);
        break;
      case "runRank":
        value = run * Math.max(1, toInt(rank));
        break;
      default:
        value = toInt(entry.base);
    }
    out[key] = Math.max(0, value + bonus);
  }
  return out;
}
