import test from "node:test";
import assert from "node:assert/strict";
import {
  ABILITY_KEYS,
  clampRank,
  defenseScore,
  nonCombatBonus,
  damageMultiplier,
  initiativeBonus,
  DEFAULT_BUDGET,
  normalizeBudgetTable,
  parseBudgetForm,
  budgetFor,
  summarizeCreation,
  stepAbility
} from "../module/rules/index.mjs";

const zero = { mle: 0, agl: 0, res: 0, vig: 0, ego: 0, log: 0 };

/* -------------------------------------------- */
/*  Atributos                                   */
/* -------------------------------------------- */

test("os seis atributos, na ordem da ficha", () => {
  assert.deepEqual([...ABILITY_KEYS], ["mle", "agl", "res", "vig", "ego", "log"]);
});

test("Rank fica entre 1 e 6; valor inválido vira 1", () => {
  assert.equal(clampRank(0), 1);
  assert.equal(clampRank(1), 1);
  assert.equal(clampRank(6), 6);
  assert.equal(clampRank(7), 6);
  assert.equal(clampRank("3"), 3);
  assert.equal(clampRank("abc"), 1);
  assert.equal(clampRank(undefined), 1);
});

test("Defesa, teste fora de combate, multiplicador e iniciativa", () => {
  assert.equal(defenseScore(0), 10);
  assert.equal(defenseScore(3), 13);
  assert.equal(defenseScore(3, 2), 15);
  assert.equal(defenseScore(-1), 9);
  assert.equal(nonCombatBonus(4), 4);
  assert.equal(nonCombatBonus(4, -1), 3);
  assert.equal(damageMultiplier(3), 3);
  assert.equal(damageMultiplier(1, -5), 0);
  assert.equal(initiativeBonus(2, 1), 3);
  assert.equal(defenseScore("x"), 10);
});

/* -------------------------------------------- */
/*  Tabela de orçamento                         */
/* -------------------------------------------- */

test("o orçamento padrão só tem o Rank 1 (5 pontos, teto 4)", () => {
  const table = normalizeBudgetTable();
  assert.deepEqual(table[1], { points: 5, cap: 4 });
  for (const rank of [2, 3, 4, 5, 6]) assert.deepEqual(table[rank], { points: null, cap: null });
  assert.deepEqual(Object.keys(table), ["1", "2", "3", "4", "5", "6"]);
  assert.deepEqual(budgetFor(table, 1), { points: 5, cap: 4 });
  assert.deepEqual(budgetFor(table, 99), { points: null, cap: null }, "Rank 99 vira Rank 6");
});

test("a tabela aceita texto e descarta o que não é número", () => {
  const table = normalizeBudgetTable({
    1: { points: "7", cap: "3" },
    2: { points: "", cap: null },
    3: { points: -4, cap: 2.9 },
    4: { points: "abc", cap: undefined },
    5: "lixo"
  });
  assert.deepEqual(table[1], { points: 7, cap: 3 });
  assert.deepEqual(table[2], { points: null, cap: null });
  assert.deepEqual(table[3], { points: 0, cap: 2 });
  assert.deepEqual(table[4], { points: null, cap: null });
  assert.deepEqual(table[5], { points: null, cap: null });
  assert.deepEqual(normalizeBudgetTable(null)[1], { points: null, cap: null });
});

test("o formulário de configuração vira tabela", () => {
  const table = parseBudgetForm({ "points-1": "5", "cap-1": "4", "points-2": "8", "cap-2": "", "points-3": "x" });
  assert.deepEqual(table[1], { points: 5, cap: 4 });
  assert.deepEqual(table[2], { points: 8, cap: null });
  assert.deepEqual(table[3], { points: null, cap: null });
});

test("o orçamento padrão não pode ser alterado por quem o importa", () => {
  assert.throws(() => {
    "use strict";
    DEFAULT_BUDGET[1].points = 99;
  });
  assert.equal(DEFAULT_BUDGET[1].points, 5);
});

/* -------------------------------------------- */
/*  Compra de pontos                            */
/* -------------------------------------------- */

test("Rank 1 sem nada gasto: 5 pontos restantes e teto 4", () => {
  const s = summarizeCreation({ rank: 1, values: zero });
  assert.equal(s.status, "open");
  assert.equal(s.points, 5);
  assert.equal(s.cap, 4);
  assert.equal(s.spent, 0);
  assert.equal(s.remaining, 5);
  assert.deepEqual(s.overCap, []);
});

test("gastar tudo fecha a compra; gastar demais passa para 'over'", () => {
  assert.equal(summarizeCreation({ rank: 1, values: { ...zero, mle: 2, agl: 3 } }).status, "done");
  const over = summarizeCreation({ rank: 1, values: { ...zero, mle: 4, agl: 2 } });
  assert.equal(over.status, "over");
  assert.equal(over.remaining, -1);
});

test("atributo acima do teto aparece em overCap, mesmo com pontos sobrando", () => {
  const s = summarizeCreation({ rank: 1, values: { ...zero, mle: 5 } });
  assert.deepEqual(s.overCap, ["mle"]);
  assert.equal(s.status, "done");
  const two = summarizeCreation({ rank: 1, values: { ...zero, mle: 5, log: 9 } });
  assert.deepEqual(two.overCap, ["mle", "log"]);
});

test("Rank sem orçamento é 'unset' e nunca inventa número", () => {
  const s = summarizeCreation({ rank: 3, values: { ...zero, mle: 3 } });
  assert.equal(s.status, "unset");
  assert.equal(s.points, null);
  assert.equal(s.remaining, null);
  assert.equal(s.cap, null);
  assert.deepEqual(s.overCap, []);
  assert.equal(s.spent, 3);
});

test("pontos extras e teto extra somam à tabela (e podem ser negativos)", () => {
  const plus = summarizeCreation({ rank: 1, values: zero, bonusPoints: 2, bonusCap: 1 });
  assert.equal(plus.points, 7);
  assert.equal(plus.cap, 5);
  assert.equal(plus.remaining, 7);
  const minus = summarizeCreation({ rank: 1, values: zero, bonusPoints: -1, bonusCap: -9 });
  assert.equal(minus.points, 4);
  assert.equal(minus.cap, 0, "o teto nunca fica negativo");
});

test("pontuação negativa devolve pontos (soma simples)", () => {
  const s = summarizeCreation({ rank: 1, values: { ...zero, mle: 4, agl: 4, res: -3 } });
  assert.equal(s.spent, 5);
  assert.equal(s.remaining, 0);
});

test("valores faltando ou inválidos contam como 0", () => {
  const s = summarizeCreation({ rank: 1, values: { mle: "2", agl: "x" } });
  assert.equal(s.spent, 2);
  assert.equal(s.remaining, 3);
});

test("a tabela do Narrador manda no resultado", () => {
  const table = normalizeBudgetTable({ 2: { points: 9, cap: 5 } });
  const s = summarizeCreation({ rank: 2, values: { ...zero, mle: 6 }, table });
  assert.equal(s.points, 9);
  assert.deepEqual(s.overCap, ["mle"]);
  assert.equal(summarizeCreation({ rank: 1, values: zero, table }).status, "unset", "Rank 1 não está nesta tabela");
});

/* -------------------------------------------- */
/*  Botões − e +                                */
/* -------------------------------------------- */

test("modo criação: − para em 0; + avisa mas não bloqueia", () => {
  const base = { rank: 1, values: { ...zero, mle: 4 } };
  assert.deepEqual(stepAbility({ ...base, key: "agl", delta: -1 }), { value: 0, changed: false, blocked: "min" });
  assert.deepEqual(stepAbility({ ...base, key: "mle", delta: -1 }), { value: 3, changed: true, blocked: null });
  // No teto e sem trava: sobe mesmo assim (a ficha só avisa).
  assert.deepEqual(stepAbility({ ...base, key: "mle", delta: 1 }), { value: 5, changed: true, blocked: null });
});

test("trava ligada: + para no teto e quando os pontos acabam", () => {
  const atCap = stepAbility({ rank: 1, values: { ...zero, mle: 4 }, key: "mle", delta: 1, strict: true });
  assert.deepEqual(atCap, { value: 4, changed: false, blocked: "cap" });
  const noPoints = stepAbility({ rank: 1, values: { ...zero, mle: 3, agl: 2 }, key: "res", delta: 1, strict: true });
  assert.deepEqual(noPoints, { value: 0, changed: false, blocked: "points" });
  const ok = stepAbility({ rank: 1, values: { ...zero, mle: 3 }, key: "agl", delta: 1, strict: true });
  assert.deepEqual(ok, { value: 1, changed: true, blocked: null });
});

test("trava ligada num Rank sem orçamento não bloqueia (não há número para vigiar)", () => {
  const r = stepAbility({ rank: 4, values: { ...zero, mle: 9 }, key: "mle", delta: 1, strict: true });
  assert.equal(r.changed, true);
  assert.equal(r.value, 10);
});

test("modo livre: qualquer passo vale, inclusive abaixo de 0", () => {
  assert.deepEqual(stepAbility({ rank: 1, values: zero, key: "mle", delta: -1, guided: false }), { value: -1, changed: true, blocked: null });
  assert.deepEqual(stepAbility({ rank: 1, values: { ...zero, mle: 9 }, key: "mle", delta: 1, guided: false, strict: true }), { value: 10, changed: true, blocked: null });
});

test("passo 0 ou inválido não faz nada", () => {
  for (const delta of [0, NaN, "x", undefined]) {
    const r = stepAbility({ rank: 1, values: { ...zero, mle: 2 }, key: "mle", delta });
    assert.deepEqual(r, { value: 2, changed: false, blocked: null }, `delta ${delta}`);
  }
});
