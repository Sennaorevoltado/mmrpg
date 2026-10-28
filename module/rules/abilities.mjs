/**
 * Atributos, defesas e valores derivados — regras puras.
 */

/** Chaves dos seis atributos (Melee, Agility, Resilience, Vigilance, Ego, Logic). */
export const ABILITY_KEYS = Object.freeze(["mle", "agl", "res", "vig", "ego", "log"]);

/** Atributos que podem ser usados como atributo de ataque/dano. */
export const ATTACK_ABILITY_KEYS = Object.freeze(["mle", "agl", "ego", "log"]);

/** Valor base somado à pontuação para obter a Defesa. */
export const DEFENSE_BASE = 10;

/**
 * Pontuação de defesa de um atributo.
 * @param {number} value     Pontuação do atributo
 * @param {number} [bonus=0] Bônus de defesa (efeitos, tamanho…)
 * @returns {number}
 */
export function defenseScore(value, bonus = 0) {
  return DEFENSE_BASE + toInt(value) + toInt(bonus);
}

/**
 * Bônus de teste fora de combate de um atributo.
 * @param {number} value
 * @param {number} [bonus=0]
 * @returns {number}
 */
export function nonCombatBonus(value, bonus = 0) {
  return toInt(value) + toInt(bonus);
}

/**
 * Multiplicador de dano de um atributo (Rank mais bônus).
 * @param {number} rank
 * @param {number} [bonus=0]
 * @returns {number}
 */
export function damageMultiplier(rank, bonus = 0) {
  return Math.max(0, toInt(rank) + toInt(bonus));
}

/**
 * Bônus de iniciativa (Vigilance mais bônus).
 * @param {number} vigilance
 * @param {number} [bonus=0]
 * @returns {number}
 */
export function initiativeBonus(vigilance, bonus = 0) {
  return toInt(vigilance) + toInt(bonus);
}

/**
 * Converte para inteiro, tratando valores inválidos como 0.
 * @param {*} n
 * @returns {number}
 */
export function toInt(n) {
  const v = Math.trunc(Number(n));
  return Number.isFinite(v) ? v : 0;
}
