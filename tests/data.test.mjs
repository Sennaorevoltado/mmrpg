import { test } from "node:test";
import assert from "node:assert/strict";
import { loadSystem, sampleCharacter } from "./support/load-system.mjs";

const sys = await loadSystem();
const cfg = sys.MARVEL_MULTIVERSE;

test("todo tipo de ator e de item nasce com dados válidos", () => {
  for (const [type, Model] of Object.entries({ ...CONFIG.Actor.dataModels })) {
    const actor = new CONFIG.Actor.documentClass({ name: type, type });
    assert.deepEqual(actor.system.validate(), [], `ator ${type}`);
    assert.ok(Model);
  }
  for (const type of Object.keys(CONFIG.Item.dataModels)) {
    const item = new CONFIG.Item.documentClass({ name: type, type });
    assert.deepEqual(item.system.validate(), [], `item ${type}`);
  }
});

test("Defesa = 10 + atributo; multiplicador de dano = Rank; fora de combate = atributo", () => {
  const actor = sampleCharacter();
  const { mle, log } = actor.system.abilities;
  assert.equal(mle.defense, 13);
  assert.equal(log.defense, 10);
  assert.equal(mle.damageMultiplier, 2);
  assert.equal(mle.noncom, 3);
});

test("iniciativa = Vigilância", () => {
  const actor = sampleCharacter();
  assert.equal(actor.system.attributes.init.value, 2);
});

test("movimento: escalar, saltar e nadar valem metade da corrida", () => {
  const actor = sampleCharacter();
  const { run, climb, jump, swim } = actor.system.movement;
  assert.equal(run.value, 5);
  for (const m of [climb, jump, swim]) assert.equal(m.value, Math.ceil(run.value / 2));
});

test("o nome do atributo e do movimento já vêm em português", () => {
  const actor = sampleCharacter();
  assert.equal(actor.system.abilities.mle.label, "Corpo a Corpo");
  assert.equal(actor.system.movement.run.label, "Corrida");
});

test("tamanho Big e Huge mexem em Defesa, movimento e alcance", () => {
  const base = sampleCharacter();
  const big = sampleCharacter();
  big.effects.set("size", new ActiveEffect({ ...structuredClone(cfg.sizeEffects.big), name: "Big" }, { parent: big }));
  big.prepareData();
  assert.equal(big.system.size, "big");
  assert.notEqual(
    JSON.stringify([big.system.abilities.mle.defense, big.system.abilities.agl.defense, big.system.reach, big.system.movement.run.value]),
    JSON.stringify([base.system.abilities.mle.defense, base.system.abilities.agl.defense, base.system.reach, base.system.movement.run.value])
  );
});

test("o valor de um atributo aceita -3 e recusa -4", () => {
  const ok = new CONFIG.Actor.documentClass({ name: "a", type: "npc", system: { abilities: { mle: { value: -3 } } } });
  assert.deepEqual(ok.system.validate(), []);
  const bad = new CONFIG.Actor.documentClass({ name: "b", type: "npc", system: { abilities: { mle: { value: -4 } } } });
  assert.ok(bad.system.validate().length > 0);
});

test("o Rank vai de 1 a 6", () => {
  for (const rank of [0, 7]) {
    const actor = new CONFIG.Actor.documentClass({ name: "r", type: "character", system: { attributes: { rank: { value: rank } } } });
    assert.ok(actor.system.validate().length > 0, `rank ${rank}`);
  }
});

test("alcance de arma nasce vazio, sem texto em inglês", () => {
  const weapon = new CONFIG.Item.documentClass({ name: "arma", type: "weapon" });
  assert.equal(weapon.system.range, "");
});

test("poder novo nasce no conjunto Basic (nome canônico em inglês)", () => {
  const power = new CONFIG.Item.documentClass({ name: "p", type: "power" });
  assert.equal(power.system.powerSet, "Basic");
});
