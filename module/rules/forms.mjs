/**
 * Formas (armaduras, transformações e formas alternativas) — regras puras, sem Foundry.
 *
 * Uma forma, quando ativa, muda o personagem de três jeitos:
 *  - altera valores da ficha (Rank, atributos, reservas, movimento…) por alterações de Active Effect;
 *  - concede itens (poderes, traços, tags), tratados no documento do ator;
 *  - mexe nas reservas: o dano sofrido acompanha o corpo quando o máximo muda.
 */

import { toInt } from "./abilities.mjs";

/** Categorias de forma. Só uma forma por categoria fica ativa de cada vez. */
export const FORM_KINDS = Object.freeze(["suit", "transformation", "alternate"]);

/** Como a forma mexe no Rank: não altera, passa a valer pelo menos X ("set") ou soma X ("add"). */
export const FORM_RANK_MODES = Object.freeze(["none", "set", "add"]);

/** Tipos de alteração aceitos (os mesmos dos efeitos dos itens). */
export const FORM_CHANGE_TYPES = Object.freeze(["add", "multiply", "override", "upgrade", "downgrade"]);

/**
 * Prioridade do "Rank pelo menos X": menor que a das somas (20), para que o Rank que uma armadura
 * define valha antes de uma transformação somar o dela, em qualquer ordem de ativação.
 */
export const RANK_SET_PRIORITY = 5;

/**
 * Alterações que a forma aplica ao personagem, na ordem: Rank primeiro, depois as da forma.
 * Uma forma emprestada não altera nada: só concede os itens e usa o Rank de quem veste.
 *
 * @param {{ borrowed?: boolean, rank?: { mode?: string, value?: number }, changes?: object[] }} form
 * @returns {{ key: string, type: string, value: string, priority?: number }[]}
 */
export function formChanges(form = {}) {
  if (form.borrowed) return [];
  const out = [];
  const rank = form.rank ?? {};
  const value = toInt(rank.value);
  if (rank.mode === "set" && value > 0) out.push({ key: "system.rank", type: "upgrade", value: String(value), priority: RANK_SET_PRIORITY });
  if (rank.mode === "add" && value !== 0) out.push({ key: "system.rank", type: "add", value: String(value) });
  for (const change of form.changes ?? []) {
    const key = String(change?.key ?? "").trim();
    if (!key) continue;
    const entry = {
      key,
      type: FORM_CHANGE_TYPES.includes(change.type) ? change.type : "add",
      value: String(change.value ?? "")
    };
    if (change.priority !== null && change.priority !== undefined && change.priority !== "") {
      const priority = Number(change.priority);
      if (Number.isInteger(priority)) entry.priority = priority;
    }
    out.push(entry);
  }
  return out;
}

/**
 * Valor atual de uma reserva depois que o máximo mudou.
 *
 * Com `carry`, o dano sofrido acompanha o corpo: o valor novo é o máximo novo menos o dano que o
 * personagem já tinha (sem passar de 0 nem do máximo). Sem `carry`, o valor fica como está e só
 * é cortado se passar do máximo novo.
 *
 * @param {number} value     Valor atual (antes da troca).
 * @param {number} oldMax    Máximo antes da troca.
 * @param {number} newMax    Máximo depois da troca.
 * @param {boolean} [carry=true]
 * @returns {number}
 */
export function carryPoolValue(value, oldMax, newMax, carry = true) {
  const v = toInt(value);
  const from = toInt(oldMax);
  const to = toInt(newMax);
  if (!carry || from === to) return Math.min(v, to);
  return Math.max(0, Math.min(to, to + (v - from)));
}
