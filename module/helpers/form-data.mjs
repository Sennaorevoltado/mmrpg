/**
 * Lista de alterações de uma Forma enviada pelo formulário da ficha (sem Foundry).
 *
 * O formulário manda cada campo como `system.changes.0.key`, `system.changes.0.type`...; o Foundry
 * pode entregar isso achatado ou já "expandido" em objeto com chaves numéricas, e uma lista de
 * objetos não se atualiza campo a campo. Aqui as duas formas viram uma lista de verdade.
 */

import { FORM_CHANGE_TYPES } from "./forms.mjs";

const BASE = "system.changes";

/** Uma linha de alteração limpa (tipo válido, prioridade inteira ou nula). */
export function cleanChange(row = {}) {
  const priority = row.priority === "" || row.priority === null || row.priority === undefined ? null : Number(row.priority);
  return {
    key: String(row.key ?? "").trim(),
    type: FORM_CHANGE_TYPES.includes(row.type) ? row.type : FORM_CHANGE_TYPES[0],
    value: String(row.value ?? ""),
    priority: Number.isInteger(priority) ? priority : null,
  };
}

/**
 * Tira de `data` os campos `system.changes.N.campo` (ou o objeto indexado) e devolve a lista,
 * na ordem dos índices. Devolve `null` se o formulário não trouxe alterações.
 *
 * @param {object} data     Dados do formulário (modificado: os campos de alteração saem)
 * @returns {object[]|null}
 */
export function takeChangeRows(data) {
  if (!data || typeof data !== "object") return null;
  const rows = new Map();
  let found = false;
  const row = (index) => {
    if (!rows.has(index)) rows.set(index, {});
    return rows.get(index);
  };

  // Achatado: "system.changes.0.key".
  const flat = new RegExp(`^${BASE.replace(".", "\\.")}\\.(\\d+)\\.(\\w+)$`);
  for (const key of Object.keys(data)) {
    const match = key.match(flat);
    if (!match) continue;
    row(Number(match[1]))[match[2]] = data[key];
    delete data[key];
    found = true;
  }

  // Expandido: data.system.changes = { 0: {...}, 1: {...} } (ou já uma lista).
  const nested = data.system?.changes;
  if (nested && typeof nested === "object") {
    const entries = Array.isArray(nested) ? nested.map((value, i) => [i, value]) : Object.entries(nested);
    for (const [index, value] of entries) {
      if (!/^\d+$/.test(String(index)) || !value || typeof value !== "object") continue;
      Object.assign(row(Number(index)), value);
      found = true;
    }
    delete data.system.changes;
  }

  if (!found) return null;
  return [...rows.entries()].sort((a, b) => a[0] - b[0]).map(([, value]) => cleanChange(value));
}

/** Põe a lista de alterações de volta nos dados do formulário, no mesmo formato em que ele veio. */
export function putChangeRows(data, rows) {
  if (data.system && typeof data.system === "object") data.system.changes = rows;
  else data[BASE] = rows;
  return data;
}

/** Nova lista de alterações sem a linha `index`. */
export function withoutRow(list, index) {
  return (Array.isArray(list) ? list : []).filter((_, i) => i !== index).map(cleanChange);
}

/** Nova lista de alterações com uma linha em branco no fim. */
export function withBlankRow(list) {
  return [...(Array.isArray(list) ? list : []).map(cleanChange), cleanChange({})];
}
