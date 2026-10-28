/**
 * Formas (armaduras, formas alternativas e transformações): regras puras, sem Foundry.
 *
 * Uma forma ativa muda o personagem de três jeitos:
 *  - altera valores da ficha (Rank, atributos, Saúde máxima...) por um Active Effect;
 *  - concede itens (poderes, traços, tags);
 *  - mexe nas reservas: o dano sofrido acompanha o corpo quando o máximo muda.
 * Quem faz tudo isso é `Actor#setFormActive` (documents/actor.mjs).
 */

/** Categorias de forma. Só uma forma de cada categoria fica ativa por vez. */
export const FORM_KINDS = Object.freeze(["suit", "alternate", "transformation"]);

/** Como a forma mexe no Rank: não altera, passa a valer pelo menos X ("set") ou soma X ("add"). */
export const FORM_RANK_MODES = Object.freeze(["none", "set", "add"]);

/** Tipos de alteração aceitos (os mesmos dos Active Effects). */
export const FORM_CHANGE_TYPES = Object.freeze(["add", "multiply", "override", "upgrade", "downgrade"]);

/** Campo do ator em que o Rank mora. */
export const RANK_KEY = "system.attributes.rank.value";

/**
 * Prioridade do "Rank pelo menos X": menor que a das somas (20), para que o Rank que uma armadura
 * define valha antes de uma transformação somar o dela, em qualquer ordem de ativação.
 */
export const RANK_SET_PRIORITY = 5;

/** Inteiro de qualquer entrada (texto, número, vazio). */
export function toInt(value) {
  const n = Math.trunc(Number(value));
  return Number.isFinite(n) ? n : 0;
}

/** Categoria válida (uma forma com categoria estranha vira armadura). */
export function formKind(value) {
  return FORM_KINDS.includes(value) ? value : "suit";
}

/**
 * Alterações que a forma aplica ao personagem, na ordem: Rank primeiro, depois as da forma.
 * Uma forma emprestada não altera nada: só concede os itens e usa o Rank de quem veste.
 *
 * @param {{borrowed?: boolean, rank?: {mode?: string, value?: number}, changes?: object[]}} form
 * @returns {{key: string, type: string, value: string, priority?: number}[]}
 */
export function formChanges(form = {}) {
  if (form.borrowed) return [];
  const out = [];
  const rank = form.rank ?? {};
  const value = toInt(rank.value);
  if (rank.mode === "set" && value > 0) out.push({ key: RANK_KEY, type: "upgrade", value: String(value), priority: RANK_SET_PRIORITY });
  if (rank.mode === "add" && value !== 0) out.push({ key: RANK_KEY, type: "add", value: String(value) });

  for (const change of form.changes ?? []) {
    const key = String(change?.key ?? "").trim();
    if (!key) continue;
    const entry = {
      key,
      type: FORM_CHANGE_TYPES.includes(change.type) ? change.type : "add",
      value: String(change.value ?? ""),
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
 * @param {number} value     Valor atual (antes da troca)
 * @param {number} oldMax    Máximo antes da troca
 * @param {number} newMax    Máximo depois da troca
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

/**
 * Campos do ator que uma alteração costuma mexer (sugestões na ficha da forma).
 * `label` é a chave de texto; `ability` completa o texto com o nome do atributo.
 */
export function suggestedChangeKeys(abilityKeys = []) {
  const keys = [
    { key: "system.health.max", label: "MARVEL_MULTIVERSE.Form.Key.healthMax" },
    { key: "system.focus.max", label: "MARVEL_MULTIVERSE.Form.Key.focusMax" },
    { key: "system.healthDamageReduction", label: "MARVEL_MULTIVERSE.Form.Key.healthDamageReduction" },
    { key: "system.focusDamageReduction", label: "MARVEL_MULTIVERSE.Form.Key.focusDamageReduction" },
    { key: "system.movement.run.value", label: "MARVEL_MULTIVERSE.Form.Key.run" },
    { key: "system.attributes.init.value", label: "MARVEL_MULTIVERSE.Form.Key.init" },
  ];
  for (const ability of abilityKeys) {
    keys.push({ key: `system.abilities.${ability}.value`, label: "MARVEL_MULTIVERSE.Form.Key.abilityValue", ability });
    keys.push({ key: `system.abilities.${ability}.defense`, label: "MARVEL_MULTIVERSE.Form.Key.abilityDefense", ability });
  }
  return keys;
}
