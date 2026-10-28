/**
 * d616 — regras puras da rolagem de três dados (sem dependência do Foundry).
 *
 * A rolagem é composta por dois d6 e um "dado Marvel" (posição central).
 * Um 1 no dado Marvel aparece como "M", conta como 6 e é um resultado Fantástico.
 *
 * Este módulo só manipula estruturas simples de dados, para poder ser testado
 * fora do Foundry (ver tests/rules.test.mjs).
 *
 * @typedef {{ result: number, active?: boolean, discarded?: boolean }} DieResult
 * @typedef {{ role: "d6"|"marvel", results: DieResult[] }} DieState
 */

/** Modo de Edge/Trouble de uma rolagem. */
export const EDGE_MODE = Object.freeze({ TROUBLE: -1, NORMAL: 0, EDGE: 1 });

/** Papéis dos dados, na ordem em que aparecem na fórmula. */
export const DIE_ROLES = Object.freeze(["d6", "marvel", "d6"]);

/** Face do dado Marvel que representa o "M". */
export const MARVEL_FACE = 1;

/** Valor que o "M" conta na soma. */
export const MARVEL_COUNTED_VALUE = 6;

/**
 * Valor contado na soma para uma face.
 * @param {"d6"|"marvel"} role
 * @param {number} face
 * @returns {number}
 */
export function countedValue(role, face) {
  return role === "marvel" && face === MARVEL_FACE ? MARVEL_COUNTED_VALUE : face;
}

/**
 * Indica se a face é o "M" do dado Marvel.
 * @param {"d6"|"marvel"} role
 * @param {number} face
 * @returns {boolean}
 */
export function isMarvelFace(role, face) {
  return role === "marvel" && face === MARVEL_FACE;
}

/**
 * Resultado ativo (não descartado) de um dado. Se houve re-rolagem, é o resultado mantido.
 * @param {DieState} die
 * @returns {DieResult|null}
 */
export function activeResult(die) {
  for (let i = die.results.length - 1; i >= 0; i--) {
    const r = die.results[i];
    if (r.active !== false && !r.discarded) return r;
  }
  return null;
}

/**
 * Resume uma rolagem d616.
 * @param {DieState[]} dice       Três dados, na ordem [d6, marvel, d6].
 * @param {number} [modifier=0]   Valor fixo somado (atributo, bônus, penalidades).
 * @returns {{ values: number[], marvelValue: number, fantastic: boolean, ultimate: boolean, diceTotal: number, total: number }}
 */
export function summarizeD616(dice, modifier = 0) {
  if (!Array.isArray(dice) || dice.length !== 3) {
    throw new Error("Uma rolagem d616 precisa de exatamente três dados.");
  }
  const values = dice.map((die) => {
    const r = activeResult(die);
    return r ? countedValue(die.role, r.result) : 0;
  });
  const marvelIndex = dice.findIndex((d) => d.role === "marvel");
  if (marvelIndex < 0) throw new Error("Rolagem d616 sem dado Marvel.");
  const marvel = activeResult(dice[marvelIndex]);
  const fantastic = !!marvel && marvel.result === MARVEL_FACE;
  // "Ultimate": M no dado Marvel e 6 nos dois d6.
  const ultimate =
    fantastic &&
    dice.every((d, i) => {
      if (i === marvelIndex) return true;
      const r = activeResult(d);
      return !!r && r.result === 6;
    });
  const diceTotal = values.reduce((a, b) => a + b, 0);
  return {
    values,
    marvelValue: values[marvelIndex],
    fantastic,
    ultimate,
    diceTotal,
    total: diceTotal + (Number(modifier) || 0)
  };
}

/**
 * Decide qual resultado fica após uma re-rolagem por Edge ou Trouble.
 * - Edge: fica o melhor dos dois (o "M" é o melhor possível).
 * - Trouble: fica o pior dos dois.
 * Em empate de valor contado, Edge prefere o "M" e Trouble evita o "M".
 *
 * @param {object} p
 * @param {"d6"|"marvel"} p.role
 * @param {number} p.oldFace
 * @param {number} p.newFace
 * @param {number} p.mode   EDGE_MODE.EDGE ou EDGE_MODE.TROUBLE
 * @returns {{ keepNew: boolean, keptFace: number, discardedFace: number }}
 */
export function resolveReroll({ role, oldFace, newFace, mode }) {
  if (mode !== EDGE_MODE.EDGE && mode !== EDGE_MODE.TROUBLE) {
    throw new Error("Re-rolagem só existe para Edge ou Trouble.");
  }
  const oldV = countedValue(role, oldFace);
  const newV = countedValue(role, newFace);
  const oldM = isMarvelFace(role, oldFace);
  const newM = isMarvelFace(role, newFace);
  let keepNew;
  if (mode === EDGE_MODE.EDGE) {
    keepNew = newV > oldV || (newV === oldV && newM && !oldM);
  } else {
    keepNew = newV < oldV || (newV === oldV && oldM && !newM);
  }
  return {
    keepNew,
    keptFace: keepNew ? newFace : oldFace,
    discardedFace: keepNew ? oldFace : newFace
  };
}

/**
 * Aplica uma re-rolagem a um dos dados e devolve um novo estado (sem alterar o original).
 * @param {DieState[]} dice
 * @param {number} dieIndex
 * @param {number} mode
 * @param {number} newFace
 * @returns {{ dice: DieState[], outcome: ReturnType<typeof resolveReroll> }}
 */
export function applyReroll(dice, dieIndex, mode, newFace) {
  const next = dice.map((d) => ({ role: d.role, results: d.results.map((r) => ({ ...r })) }));
  const die = next[dieIndex];
  if (!die) throw new Error(`Dado inexistente: ${dieIndex}`);
  const current = activeResult(die);
  if (!current) throw new Error("O dado ainda não foi rolado.");
  const outcome = resolveReroll({ role: die.role, oldFace: current.result, newFace, mode });
  if (outcome.keepNew) {
    current.active = false;
    current.discarded = true;
    die.results.push({ result: newFace, active: true });
  } else {
    die.results.push({ result: newFace, active: false, discarded: true });
  }
  return { dice: next, outcome };
}

/**
 * Converte o modo textual usado nas ações em EDGE_MODE.
 * @param {string|number} value  "edge", "trouble", "normal", 1, -1, 0
 * @returns {number}
 */
export function parseEdgeMode(value) {
  if (value === EDGE_MODE.EDGE || value === "edge") return EDGE_MODE.EDGE;
  if (value === EDGE_MODE.TROUBLE || value === "trouble") return EDGE_MODE.TROUBLE;
  return EDGE_MODE.NORMAL;
}

/**
 * Combina vários modos (de várias fontes) em um só: Edge e Trouble se anulam.
 * @param {...number} modes
 * @returns {number}
 */
export function combineEdgeModes(...modes) {
  const sum = modes.reduce((acc, m) => acc + Math.sign(m || 0), 0);
  return Math.sign(sum);
}

/**
 * Monta a fórmula textual da rolagem d616 com um modificador fixo.
 * @param {number} [modifier=0]
 * @returns {string}
 */
export function buildFormula(modifier = 0) {
  const base = "1d6 + 1dm + 1d6";
  const mod = Math.trunc(Number(modifier) || 0);
  if (mod === 0) return base;
  return `${base} ${mod > 0 ? "+" : "-"} ${Math.abs(mod)}`;
}

/**
 * Escolhe automaticamente qual dado re-rolar (usado quando ninguém escolhe, como na iniciativa).
 * - Edge: o dado de menor valor contado (em empate, o primeiro).
 * - Trouble: o dado de maior valor contado (em empate, o dado Marvel tem prioridade).
 *
 * @param {DieState[]} dice
 * @param {number} mode  EDGE_MODE.EDGE ou EDGE_MODE.TROUBLE
 * @returns {number} índice do dado
 */
export function autoRerollIndex(dice, mode) {
  let best = 0;
  let bestScore = null;
  dice.forEach((die, i) => {
    const r = activeResult(die);
    const value = r ? countedValue(die.role, r.result) : 0;
    // Trouble favorece o dado Marvel em empates.
    const score = mode === EDGE_MODE.EDGE ? -value : value + (die.role === "marvel" ? 0.5 : 0);
    if (bestScore === null || score > bestScore) {
      best = i;
      bestScore = score;
    }
  });
  return best;
}
