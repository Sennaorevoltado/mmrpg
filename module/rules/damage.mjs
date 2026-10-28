/**
 * Dano, cura e recursos — regras puras.
 *
 * Dano = (dado Marvel × (multiplicador − redução)) + atributo (+ bônus).
 * Um resultado Fantástico dobra o dano.
 */

import { toInt } from "./abilities.mjs";

/**
 * Calcula o dano de um ataque contra um alvo.
 *
 * @param {object} p
 * @param {number} p.marvelValue        Valor contado do dado Marvel (o "M" conta 6).
 * @param {number} p.multiplier         Multiplicador de dano do atacante.
 * @param {number} p.abilityValue       Pontuação do atributo usado no dano.
 * @param {number} [p.flat=0]           Bônus fixo extra.
 * @param {boolean} [p.fantastic=false] A rolagem foi Fantástica?
 * @param {number} [p.reduction=0]      Redução de dano do alvo (subtrai do multiplicador).
 * @param {number} [p.fantasticFactor=2] Fator aplicado em resultados Fantásticos.
 * @returns {{ amount: number, effectiveMultiplier: number, base: number, doubled: boolean }}
 */
export function computeDamage({
  marvelValue,
  multiplier,
  abilityValue,
  flat = 0,
  fantastic = false,
  reduction = 0,
  fantasticFactor = 2
}) {
  const effectiveMultiplier = Math.max(0, toInt(multiplier) - toInt(reduction));
  if (effectiveMultiplier === 0) {
    return { amount: 0, effectiveMultiplier: 0, base: 0, doubled: false };
  }
  const base = toInt(marvelValue) * effectiveMultiplier + toInt(abilityValue) + toInt(flat);
  const factor = fantastic ? Math.max(1, Number(fantasticFactor) || 1) : 1;
  return {
    amount: Math.max(0, Math.floor(base * factor)),
    effectiveMultiplier,
    base,
    doubled: fantastic && factor > 1
  };
}

/**
 * Valor de cura baseado no dado Marvel (mesma estrutura do dano, sem redução).
 * @param {object} p
 * @param {number} p.marvelValue
 * @param {number} p.multiplier
 * @param {number} p.abilityValue
 * @param {number} [p.flat=0]
 * @returns {number}
 */
export function computeMarvelHealing({ marvelValue, multiplier, abilityValue, flat = 0 }) {
  const mult = Math.max(0, toInt(multiplier));
  if (mult === 0) return 0;
  return Math.max(0, toInt(marvelValue) * mult + toInt(abilityValue) + toInt(flat));
}

/**
 * Aplica dano a um recurso (Health ou Focus).
 * @param {{ value: number, max: number }} pool
 * @param {number} amount
 * @param {number} [floor=-Infinity] Valor mínimo permitido.
 * @returns {number} Novo valor.
 */
export function damagePool(pool, amount, floor = -Infinity) {
  return Math.max(floor, toInt(pool.value) - Math.max(0, toInt(amount)));
}

/**
 * Aplica cura a um recurso, sem passar do máximo.
 * @param {{ value: number, max: number }} pool
 * @param {number} amount
 * @returns {number} Novo valor.
 */
export function healPool(pool, amount) {
  const max = toInt(pool.max);
  const next = toInt(pool.value) + Math.max(0, toInt(amount));
  return Math.min(max, next);
}
