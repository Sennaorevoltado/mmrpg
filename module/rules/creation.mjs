/**
 * Criação de personagem: compra de pontos de atributo — regras puras.
 *
 * O orçamento (pontos para distribuir e teto de cada atributo) depende do Rank e vem de uma
 * tabela que o Narrador pode editar nas configurações do sistema. O que não está na tabela
 * fica "não definido" (status "unset"): a ficha avisa em vez de inventar um número.
 *
 * Suposições (confira no seu livro):
 *  - Cada atributo começa em 0 e os pontos gastos são a soma das pontuações;
 *  - os botões −/+ não descem abaixo de 0 (digitando, vale qualquer número inteiro).
 */

import { ABILITY_KEYS, MIN_RANK, MAX_RANK, clampRank, toInt } from "./abilities.mjs";

/**
 * Orçamento padrão. Só o Rank 1 vem preenchido (teto 4, 5 pontos), conferido no criador de
 * personagens da Demiplane. Os demais Ranks ficam em branco até o Narrador preencher.
 */
export const DEFAULT_BUDGET = Object.freeze({ 1: Object.freeze({ points: 5, cap: 4 }) });

/** Inteiro >= 0, ou null quando em branco/inválido (= "não definido"). */
function parseLimit(value) {
  if (value === null || value === undefined || value === "") return null;
  const n = Number(value);
  if (!Number.isFinite(n)) return null;
  return Math.max(0, Math.trunc(n));
}

/**
 * Tabela completa (Ranks 1 a 6), com `points` e `cap` inteiros ou null.
 * @param {object} [raw]  Tabela salva (qualquer formato parcial).
 * @returns {Record<number, { points: number|null, cap: number|null }>}
 */
export function normalizeBudgetTable(raw = DEFAULT_BUDGET) {
  const table = {};
  for (let rank = MIN_RANK; rank <= MAX_RANK; rank++) {
    const entry = raw && typeof raw === "object" ? raw[rank] : undefined;
    table[rank] = { points: parseLimit(entry?.points), cap: parseLimit(entry?.cap) };
  }
  return table;
}

/**
 * Lê a tabela a partir dos campos do formulário de configuração
 * (`points-<rank>` e `cap-<rank>`).
 * @param {Record<string, *>} data
 */
export function parseBudgetForm(data = {}) {
  const raw = {};
  for (let rank = MIN_RANK; rank <= MAX_RANK; rank++) {
    raw[rank] = { points: data[`points-${rank}`], cap: data[`cap-${rank}`] };
  }
  return normalizeBudgetTable(raw);
}

/**
 * Orçamento de um Rank.
 * @returns {{ points: number|null, cap: number|null }}
 */
export function budgetFor(table, rank) {
  const entry = table?.[clampRank(rank)];
  return { points: parseLimit(entry?.points), cap: parseLimit(entry?.cap) };
}

/**
 * Situação da compra de pontos.
 *
 * @param {object} p
 * @param {number} p.rank
 * @param {Record<string, number>} p.values   Pontuação de cada atributo.
 * @param {number} [p.bonusPoints=0]          Pontos extras (Origem, Ocupação, traits, Narrador…).
 * @param {number} [p.bonusCap=0]             Teto extra.
 * @param {object} [p.table]                  Tabela de orçamento.
 * @returns {{
 *   rank: number, points: number|null, cap: number|null, spent: number, remaining: number|null,
 *   overCap: string[], status: "unset"|"open"|"done"|"over"
 * }}
 */
export function summarizeCreation({ rank, values = {}, bonusPoints = 0, bonusCap = 0, table = DEFAULT_BUDGET } = {}) {
  const budget = budgetFor(table, rank);
  const scores = Object.fromEntries(ABILITY_KEYS.map((key) => [key, toInt(values[key])]));
  const spent = ABILITY_KEYS.reduce((sum, key) => sum + scores[key], 0);
  const points = budget.points === null ? null : budget.points + toInt(bonusPoints);
  const cap = budget.cap === null ? null : Math.max(0, budget.cap + toInt(bonusCap));
  const remaining = points === null ? null : points - spent;
  const overCap = cap === null ? [] : ABILITY_KEYS.filter((key) => scores[key] > cap);

  let status;
  if (points === null) status = "unset";
  else if (remaining < 0) status = "over";
  else if (remaining === 0) status = "done";
  else status = "open";

  return { rank: clampRank(rank), points, cap, spent, remaining, overCap, status };
}

/**
 * Efeito de apertar − ou + num atributo.
 *
 * Sem `guided` (modo livre) qualquer passo vale. No modo criação, − para em 0; + só para quando
 * `strict` está ligado e o atributo chegou ao teto ou os pontos acabaram.
 *
 * @param {object} p
 * @param {string} p.key
 * @param {number} p.delta       Sinal do passo (− ou +).
 * @param {boolean} [p.guided=true]
 * @param {boolean} [p.strict=false]
 * @returns {{ value: number, changed: boolean, blocked: null|"min"|"cap"|"points" }}
 */
export function stepAbility({ key, delta, values = {}, rank, bonusPoints = 0, bonusCap = 0, table = DEFAULT_BUDGET, guided = true, strict = false }) {
  const current = toInt(values[key]);
  const amount = Number(delta);
  if (!Number.isFinite(amount) || amount === 0) return { value: current, changed: false, blocked: null };
  const direction = amount < 0 ? -1 : 1;

  if (!guided) return { value: current + direction, changed: true, blocked: null };

  if (direction < 0) {
    if (current <= 0) return { value: current, changed: false, blocked: "min" };
    return { value: current - 1, changed: true, blocked: null };
  }

  if (strict) {
    const summary = summarizeCreation({ rank, values, bonusPoints, bonusCap, table });
    if (summary.cap !== null && current >= summary.cap) return { value: current, changed: false, blocked: "cap" };
    if (summary.remaining !== null && summary.remaining <= 0) return { value: current, changed: false, blocked: "points" };
  }
  return { value: current + 1, changed: true, blocked: null };
}
