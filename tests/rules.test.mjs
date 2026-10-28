import test from "node:test";
import assert from "node:assert/strict";
import {
  EDGE_MODE,
  countedValue,
  summarizeD616,
  resolveReroll,
  applyReroll,
  parseEdgeMode,
  combineEdgeModes,
  buildFormula,
  autoRerollIndex,
  defenseScore,
  nonCombatBonus,
  damageMultiplier,
  initiativeBonus,
  computeDamage,
  computeMarvelHealing,
  damagePool,
  healPool,
  computeMovement,
  resolveAction,
  effectTriggers
} from "../module/rules/index.mjs";

const dice = (a, m, b) => [
  { role: "d6", results: [{ result: a, active: true }] },
  { role: "marvel", results: [{ result: m, active: true }] },
  { role: "d6", results: [{ result: b, active: true }] }
];

test("o M do dado Marvel conta 6", () => {
  assert.equal(countedValue("marvel", 1), 6);
  assert.equal(countedValue("marvel", 4), 4);
  assert.equal(countedValue("d6", 1), 1);
});

test("summarizeD616 soma os dados e o modificador", () => {
  const s = summarizeD616(dice(3, 4, 5), 2);
  assert.equal(s.diceTotal, 12);
  assert.equal(s.total, 14);
  assert.equal(s.marvelValue, 4);
  assert.equal(s.fantastic, false);
  assert.equal(s.ultimate, false);
});

test("M no dado Marvel é Fantástico e vale 6", () => {
  const s = summarizeD616(dice(2, 1, 3), 0);
  assert.equal(s.fantastic, true);
  assert.equal(s.marvelValue, 6);
  assert.equal(s.total, 11);
  assert.equal(s.ultimate, false);
});

test("6, M, 6 é Ultimate", () => {
  const s = summarizeD616(dice(6, 1, 6), 3);
  assert.equal(s.fantastic, true);
  assert.equal(s.ultimate, true);
  assert.equal(s.total, 21);
});

test("um 1 num d6 comum não é Fantástico", () => {
  assert.equal(summarizeD616(dice(1, 5, 1)).fantastic, false);
});

test("exige três dados", () => {
  assert.throws(() => summarizeD616([]));
});

test("Edge mantém o melhor resultado", () => {
  assert.deepEqual(resolveReroll({ role: "d6", oldFace: 2, newFace: 5, mode: EDGE_MODE.EDGE }).keepNew, true);
  assert.deepEqual(resolveReroll({ role: "d6", oldFace: 5, newFace: 2, mode: EDGE_MODE.EDGE }).keepNew, false);
});

test("Trouble mantém o pior resultado", () => {
  assert.equal(resolveReroll({ role: "d6", oldFace: 5, newFace: 2, mode: EDGE_MODE.TROUBLE }).keepNew, true);
  assert.equal(resolveReroll({ role: "d6", oldFace: 2, newFace: 5, mode: EDGE_MODE.TROUBLE }).keepNew, false);
});

test("o M é o melhor possível: Edge o prefere em empate, Trouble o evita", () => {
  // old = 6 comum, new = M (também conta 6)
  assert.equal(resolveReroll({ role: "marvel", oldFace: 6, newFace: 1, mode: EDGE_MODE.EDGE }).keepNew, true);
  // old = M, new = 6 comum
  assert.equal(resolveReroll({ role: "marvel", oldFace: 1, newFace: 6, mode: EDGE_MODE.EDGE }).keepNew, false);
  assert.equal(resolveReroll({ role: "marvel", oldFace: 1, newFace: 6, mode: EDGE_MODE.TROUBLE }).keepNew, true);
  // Trouble com M antigo e 3 novo troca o M
  assert.equal(resolveReroll({ role: "marvel", oldFace: 1, newFace: 3, mode: EDGE_MODE.TROUBLE }).keepNew, true);
});

test("resolveReroll recusa o modo normal", () => {
  assert.throws(() => resolveReroll({ role: "d6", oldFace: 1, newFace: 2, mode: EDGE_MODE.NORMAL }));
});

test("applyReroll preserva o histórico e não altera o original", () => {
  const original = dice(2, 3, 4);
  const { dice: next, outcome } = applyReroll(original, 0, EDGE_MODE.EDGE, 6);
  assert.equal(outcome.keepNew, true);
  assert.equal(original[0].results.length, 1);
  assert.equal(original[0].results[0].active, true);
  assert.equal(next[0].results.length, 2);
  assert.equal(next[0].results[0].discarded, true);
  assert.equal(summarizeD616(next).diceTotal, 6 + 3 + 4);
});

test("applyReroll descarta o novo resultado quando ele é pior no Edge", () => {
  const { dice: next, outcome } = applyReroll(dice(5, 3, 4), 0, EDGE_MODE.EDGE, 1);
  assert.equal(outcome.keepNew, false);
  assert.equal(next[0].results[1].discarded, true);
  assert.equal(summarizeD616(next).values[0], 5);
});

test("Trouble no dado Marvel remove o Fantástico", () => {
  const { dice: next } = applyReroll(dice(3, 1, 3), 1, EDGE_MODE.TROUBLE, 2);
  assert.equal(summarizeD616(next).fantastic, false);
});

test("parseEdgeMode e combineEdgeModes", () => {
  assert.equal(parseEdgeMode("edge"), 1);
  assert.equal(parseEdgeMode("trouble"), -1);
  assert.equal(parseEdgeMode("whatever"), 0);
  assert.equal(combineEdgeModes(1, -1), 0);
  assert.equal(combineEdgeModes(1, 1), 1);
  assert.equal(combineEdgeModes(-1, 0, -1), -1);
});

test("buildFormula", () => {
  assert.equal(buildFormula(0), "1d6 + 1dm + 1d6");
  assert.equal(buildFormula(3), "1d6 + 1dm + 1d6 + 3");
  assert.equal(buildFormula(-2), "1d6 + 1dm + 1d6 - 2");
  assert.equal(buildFormula("x"), "1d6 + 1dm + 1d6");
});

test("atributos derivados", () => {
  assert.equal(defenseScore(3), 13);
  assert.equal(defenseScore(-1, 2), 11);
  assert.equal(nonCombatBonus(2, 1), 3);
  assert.equal(damageMultiplier(3, 1), 4);
  assert.equal(damageMultiplier(1, -5), 0);
  assert.equal(initiativeBonus(2, 1), 3);
});

test("dano: dado Marvel × multiplicador + atributo", () => {
  const r = computeDamage({ marvelValue: 4, multiplier: 3, abilityValue: 2 });
  assert.equal(r.amount, 14);
});

test("dano: Fantástico dobra", () => {
  const r = computeDamage({ marvelValue: 6, multiplier: 2, abilityValue: 1, fantastic: true });
  assert.equal(r.amount, 26);
  assert.equal(r.doubled, true);
});

test("dano: redução subtrai do multiplicador", () => {
  const r = computeDamage({ marvelValue: 5, multiplier: 3, abilityValue: 2, reduction: 1 });
  assert.equal(r.effectiveMultiplier, 2);
  assert.equal(r.amount, 12);
});

test("dano: multiplicador zerado ou negativo não causa dano", () => {
  assert.equal(computeDamage({ marvelValue: 6, multiplier: 2, abilityValue: 5, reduction: 2 }).amount, 0);
  assert.equal(computeDamage({ marvelValue: 6, multiplier: 2, abilityValue: 5, reduction: 9 }).amount, 0);
});

test("dano: fração do dano (metade) e Fantástico por cima", () => {
  const base = { marvelValue: 5, multiplier: 3, abilityValue: 2 };
  assert.equal(computeDamage({ ...base, scale: 0.5 }).amount, Math.floor(17 / 2));
  // Metade em qualquer acerto; no Fantástico dobra, voltando ao dano inteiro.
  assert.equal(computeDamage({ ...base, scale: 0.5, fantastic: true }).amount, 17);
  assert.equal(computeDamage({ ...base, scale: 0.5 }).scale, 0.5);
  assert.equal(computeDamage({ ...base }).scale, 1);
  assert.equal(computeDamage({ ...base, scale: -1 }).amount, 17, "valor inválido vira 1");
});

test("dano que ignora a Redução de Dano do alvo", () => {
  const act = attackAction({
    damage: { enabled: true, ability: "", resource: "health", multiplierBonus: 0, fantasticFactor: 2, ignoreReduction: true }
  });
  const r = resolveAction({
    action: act,
    roll: { total: 20, marvelValue: 4, fantastic: false, ultimate: false },
    attacker,
    targets: [target("A", 10, { health: 2, focus: 0 })]
  });
  assert.equal(r.targets[0].damage.amount, 4 * 2 + 3, "a redução 2 não conta");
  assert.equal(r.targets[0].damage.reduction, 0);
});

test("dano ao Foco usando a Redução de Dano à Saúde do alvo", () => {
  const act = attackAction({
    damage: { enabled: true, ability: "", resource: "focus", reductionFrom: "health", multiplierBonus: 0, fantasticFactor: 2 }
  });
  const r = resolveAction({
    action: act,
    roll: { total: 20, marvelValue: 4, fantastic: false, ultimate: false },
    attacker,
    targets: [target("A", 10, { health: 1, focus: 0 })]
  });
  assert.equal(r.targets[0].damage.resource, "focus");
  assert.equal(r.targets[0].damage.amount, 4 * 1 + 3, "multiplicador 2 − redução da Saúde 1");
});

test("dano: bônus fixo entra antes de dobrar", () => {
  const r = computeDamage({ marvelValue: 3, multiplier: 2, abilityValue: 1, flat: 2, fantastic: true });
  assert.equal(r.amount, (3 * 2 + 1 + 2) * 2);
});

test("cura baseada no dado Marvel", () => {
  assert.equal(computeMarvelHealing({ marvelValue: 4, multiplier: 2, abilityValue: 1 }), 9);
  assert.equal(computeMarvelHealing({ marvelValue: 4, multiplier: 0, abilityValue: 1 }), 0);
});

test("recursos: dano respeita o piso, cura respeita o máximo", () => {
  assert.equal(damagePool({ value: 10, max: 20 }, 4), 6);
  assert.equal(damagePool({ value: 3, max: 20 }, 10, 0), 0);
  assert.equal(damagePool({ value: 3, max: 20 }, 10), -7);
  assert.equal(healPool({ value: 15, max: 20 }, 10), 20);
  assert.equal(healPool({ value: -3, max: 20 }, 5), 2);
});

test("movimento relativo à corrida", () => {
  const m = computeMovement(
    {
      run: { base: 5, mode: "fixed" },
      climb: { base: 0, mode: "half" },
      swim: { base: 0, mode: "half" },
      jump: { base: 0, mode: "half", bonus: 1 },
      flight: { base: 0, mode: "double" },
      swingline: { base: 3, mode: "rank" },
      glide: { base: 4, mode: "fixed" }
    },
    2
  );
  assert.equal(m.run, 5);
  assert.equal(m.climb, 3);
  assert.equal(m.jump, 4);
  assert.equal(m.flight, 10);
  assert.equal(m.swingline, 6);
  assert.equal(m.glide, 4);

  // Voo = corrida × Rank, acompanhando bônus de corrida.
  const f = computeMovement({ run: { base: 5, bonus: 1, mode: "fixed" }, flight: { base: 0, mode: "runRank", bonus: 2 } }, 3);
  assert.equal(f.flight, 6 * 3 + 2);
});

// ---------------------------------------------------------------------------
// resolveAction
// ---------------------------------------------------------------------------

const attacker = {
  abilities: { mle: 3, agl: 1, res: 0, vig: 2, ego: 0, log: 0 },
  multipliers: { mle: 2, agl: 2, res: 2, vig: 2, ego: 2, log: 2 }
};
const attackAction = (extra = {}) => ({
  roll: { mode: "attack", ability: "mle", targetDefense: "mle", difficulty: 10 },
  damage: { enabled: true, ability: "", resource: "health", multiplierBonus: 0, fantasticFactor: 2 },
  healing: { enabled: false },
  effects: [],
  ...extra
});
const target = (id, mle, reduction = { health: 0, focus: 0 }) => ({
  id,
  name: id,
  defenses: { mle, agl: mle, res: mle, vig: mle, ego: mle, log: mle },
  reduction
});

test("ataque acerta quando o total alcança a defesa", () => {
  const r = resolveAction({
    action: attackAction(),
    roll: { total: 13, marvelValue: 4, fantastic: false, ultimate: false },
    attacker,
    targets: [target("A", 13), target("B", 14)]
  });
  assert.equal(r.targets[0].hit, true);
  assert.equal(r.targets[0].damage.amount, 4 * 2 + 3);
  assert.equal(r.targets[1].hit, false);
  assert.equal(r.targets[1].damage, null);
});

test("dano só no Fantástico e metade do dano com Fantástico por cima", () => {
  const onlyFantastic = attackAction({
    damage: { enabled: true, ability: "", resource: "health", multiplierBonus: 0, fantasticFactor: 2, when: "fantastic" }
  });
  const normal = resolveAction({
    action: onlyFantastic,
    roll: { total: 20, marvelValue: 4, fantastic: false, ultimate: false },
    attacker,
    targets: [target("A", 10)]
  });
  assert.equal(normal.targets[0].hit, true);
  assert.equal(normal.targets[0].damage, null, "acertou, mas o dano é só no Fantástico");
  const fantastic = resolveAction({
    action: onlyFantastic,
    roll: { total: 20, marvelValue: 6, fantastic: true, ultimate: false },
    attacker,
    targets: [target("A", 10)]
  });
  assert.equal(fantastic.targets[0].damage.amount, (6 * 2 + 3) * 2);

  const half = attackAction({
    damage: { enabled: true, ability: "", resource: "health", multiplierBonus: 0, fantasticFactor: 2, scale: 0.5 }
  });
  const ok = resolveAction({ action: half, roll: { total: 20, marvelValue: 4, fantastic: false, ultimate: false }, attacker, targets: [target("A", 10)] });
  assert.equal(ok.targets[0].damage.amount, Math.floor((4 * 2 + 3) / 2));
  const fan = resolveAction({ action: half, roll: { total: 20, marvelValue: 4, fantastic: true, ultimate: false }, attacker, targets: [target("A", 10)] });
  assert.equal(fan.targets[0].damage.amount, 4 * 2 + 3, "metade × 2 = dano inteiro");
});

test("Fantástico acerta sempre e dobra o dano", () => {
  const r = resolveAction({
    action: attackAction(),
    roll: { total: 5, marvelValue: 6, fantastic: true, ultimate: false },
    attacker,
    targets: [target("A", 30)]
  });
  assert.equal(r.targets[0].hit, true);
  assert.equal(r.targets[0].damage.amount, (6 * 2 + 3) * 2);
});

test("redução de dano do alvo vale para o recurso certo", () => {
  const act = attackAction();
  act.damage.resource = "focus";
  const r = resolveAction({
    action: act,
    roll: { total: 20, marvelValue: 5, fantastic: false, ultimate: false },
    attacker,
    targets: [target("A", 10, { health: 5, focus: 1 })]
  });
  assert.equal(r.targets[0].damage.effectiveMultiplier, 1);
  assert.equal(r.targets[0].damage.amount, 5 * 1 + 3);
});

test("sem alvos, mostra uma prévia de dano", () => {
  const r = resolveAction({
    action: attackAction(),
    roll: { total: 20, marvelValue: 3, fantastic: false, ultimate: false },
    attacker,
    targets: []
  });
  assert.equal(r.preview.amount, 3 * 2 + 3);
});

test("multiplicador extra e atributo de dano diferente", () => {
  const act = attackAction();
  act.damage.ability = "agl";
  act.damage.multiplierBonus = 1;
  const r = resolveAction({
    action: act,
    roll: { total: 20, marvelValue: 2, fantastic: false, ultimate: false },
    attacker,
    targets: [target("A", 10)]
  });
  assert.equal(r.targets[0].damage.amount, 2 * 3 + 1);
});

test("teste contra dificuldade fixa", () => {
  const act = { roll: { mode: "check", ability: "vig", difficulty: 12 }, damage: { enabled: false }, healing: { enabled: false }, effects: [] };
  const ok = resolveAction({ action: act, roll: { total: 12, marvelValue: 3, fantastic: false, ultimate: false }, attacker });
  assert.equal(ok.check.success, true);
  const bad = resolveAction({ action: act, roll: { total: 11, marvelValue: 3, fantastic: false, ultimate: false }, attacker });
  assert.equal(bad.check.success, false);
  const fant = resolveAction({ action: act, roll: { total: 2, marvelValue: 6, fantastic: true, ultimate: false }, attacker });
  assert.equal(fant.check.success, true);
});

test("efeitos disparam conforme o gatilho e o alvo", () => {
  const act = attackAction({
    effects: [
      { id: "e1", when: "hit", target: "targets" },
      { id: "e2", when: "fantastic", target: "targets" },
      { id: "e3", when: "miss", target: "self" },
      { id: "e4", when: "always", target: "self" }
    ]
  });
  const hit = resolveAction({
    action: act,
    roll: { total: 20, marvelValue: 3, fantastic: false, ultimate: false },
    attacker,
    targets: [target("A", 10)]
  });
  assert.deepEqual(hit.targets[0].effects, ["e1"]);
  assert.deepEqual(hit.self.effects, ["e4"]);

  const miss = resolveAction({
    action: act,
    roll: { total: 3, marvelValue: 2, fantastic: false, ultimate: false },
    attacker,
    targets: [target("A", 10)]
  });
  assert.deepEqual(miss.targets[0].effects, []);
  assert.deepEqual(miss.self.effects, ["e3", "e4"]);

  const fant = resolveAction({
    action: act,
    roll: { total: 3, marvelValue: 6, fantastic: true, ultimate: false },
    attacker,
    targets: [target("A", 10)]
  });
  assert.deepEqual(fant.targets[0].effects, ["e1", "e2"]);
});

test("cura em si mesmo e nos alvos", () => {
  const self = resolveAction({
    action: {
      roll: { mode: "check", ability: "res", difficulty: 5 },
      damage: { enabled: false },
      healing: { enabled: true, target: "self", resource: "health", mode: "marvel" },
      effects: []
    },
    roll: { total: 10, marvelValue: 4, fantastic: false, ultimate: false },
    attacker
  });
  assert.equal(self.self.healing.amount, 4 * 2 + 0);

  const others = resolveAction({
    action: {
      roll: { mode: "none", ability: "ego" },
      damage: { enabled: false },
      healing: { enabled: true, target: "targets", resource: "focus", mode: "flat" },
      effects: []
    },
    roll: null,
    attacker: { ...attacker, healingFlat: 5 },
    targets: [target("A", 10)]
  });
  assert.equal(others.targets[0].healing.amount, 5);
  assert.equal(others.targets[0].healing.resource, "focus");

  // Valor fixo + pontuação de um atributo (Regain Focus: Foco igual à Vigilância).
  const byAbility = resolveAction({
    action: {
      roll: { mode: "none", ability: "ego" },
      damage: { enabled: false },
      healing: { enabled: true, target: "self", resource: "focus", mode: "flat", ability: "vig" },
      effects: []
    },
    roll: null,
    attacker,
    targets: []
  });
  assert.equal(byAbility.self.healing.amount, attacker.abilities.vig);
});

test("cura usa o atributo e o bônus de multiplicador da própria cura", () => {
  const r = resolveAction({
    action: {
      roll: { mode: "check", ability: "res", difficulty: 5 },
      damage: { enabled: true, ability: "mle", multiplierBonus: 5 },
      healing: { enabled: true, target: "self", resource: "health", mode: "marvel", ability: "vig", multiplierBonus: 1 },
      effects: []
    },
    roll: { total: 10, marvelValue: 4, fantastic: false, ultimate: false },
    attacker
  });
  // vig: valor 2, multiplicador 2 + 1 de bônus => 4 * 3 + 2
  assert.equal(r.self.healing.amount, 14);
});

test("ação sem rolagem não causa dano", () => {
  const r = resolveAction({
    action: attackAction({ roll: { mode: "none", ability: "mle" } }),
    roll: null,
    attacker,
    targets: [target("A", 10)]
  });
  assert.equal(r.rolled, false);
  assert.equal(r.targets[0].damage, null);
});

test("effectTriggers", () => {
  assert.equal(effectTriggers("always", {}), true);
  assert.equal(effectTriggers("nada", {}), false);
  assert.equal(effectTriggers("failure", { mode: "check", success: false }), true);
});

test("autoRerollIndex: Edge escolhe o menor dado, Trouble o maior", () => {
  assert.equal(autoRerollIndex(dice(3, 5, 2), EDGE_MODE.EDGE), 2);
  assert.equal(autoRerollIndex(dice(3, 5, 2), EDGE_MODE.TROUBLE), 1);
  // M conta 6: é o maior para Trouble e nunca o menor para Edge
  assert.equal(autoRerollIndex(dice(3, 1, 4), EDGE_MODE.TROUBLE), 1);
  assert.equal(autoRerollIndex(dice(3, 1, 4), EDGE_MODE.EDGE), 0);
  // empate: Trouble prefere o dado Marvel
  assert.equal(autoRerollIndex(dice(4, 4, 2), EDGE_MODE.TROUBLE), 1);
});
