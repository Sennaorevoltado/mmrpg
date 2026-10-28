import { test } from "node:test";
import assert from "node:assert/strict";
import { loadSystem, sampleCharacter } from "./support/load-system.mjs";
import { Die, ChatMessage } from "./support/foundry-stub.mjs";

const sys = await loadSystem();

const { computeDamage, isFantasticPool } = await import("../module/documents/chat-message.mjs");
const { MarvelDie } = await import("../module/dice/dietype/marvel-die.mjs");

/* -------------------------------------------- */
/*  Dano                                        */
/* -------------------------------------------- */

test("dano = dado Marvel x multiplicador + atributo", () => {
  assert.deepEqual(computeDamage({ marvelValue: 4, multiplier: 3, abilityScore: 2 }), { net: 3, dmg: 14 });
});

test("o Fantástico dobra o dano", () => {
  assert.equal(computeDamage({ marvelValue: 6, multiplier: 2, abilityScore: 1, fantastic: true }).dmg, 26);
});

test("a Redução de Dano do alvo tira do multiplicador", () => {
  const { net, dmg } = computeDamage({ marvelValue: 5, multiplier: 3, reduction: 1, abilityScore: 2 });
  assert.equal(net, 2);
  assert.equal(dmg, 12);
});

test("multiplicador zerado pela redução não causa dano", () => {
  assert.equal(computeDamage({ marvelValue: 6, multiplier: 2, reduction: 2, abilityScore: 4 }).dmg, 0);
});

test("dano nunca fica negativo", () => {
  assert.equal(computeDamage({ marvelValue: 1, multiplier: 1, reduction: 3, abilityScore: 0 }).dmg, 0);
});

/* -------------------------------------------- */
/*  Dado Marvel                                 */
/* -------------------------------------------- */

test("o dado Marvel mostra M no 1 e conta 6", () => {
  const original = Die.nextFace;
  try {
    Die.nextFace = () => 1;
    const die = new MarvelDie({ number: 1 });
    die.roll();
    assert.equal(die.total, 6);
    assert.equal(die.getResultLabel({ result: 1 }), "m");
    assert.equal(die.getResultLabel({ result: 4 }), "4");
    assert.ok(die.getResultCSS({ result: 1 }).includes("fantastic"));
    assert.ok(die.getResultCSS({ result: 6 }).includes("max"));

    Die.nextFace = () => 3;
    const other = new MarvelDie({ number: 1 });
    other.roll();
    assert.equal(other.total, 3);
  } finally {
    Die.nextFace = original;
  }
});

test("isFantasticPool enxerga o M no dado do meio", () => {
  const pool = (result, active = true) => ({ rolls: [{}, { dice: [{ results: [{ result, active }] }] }, {}] });
  assert.equal(isFantasticPool(pool(1)), true);
  assert.equal(isFantasticPool(pool(1, false)), false);
  assert.equal(isFantasticPool(pool(5)), false);
  assert.equal(isFantasticPool(null), false);
});

/* -------------------------------------------- */
/*  Rolagens do ator e do item                  */
/* -------------------------------------------- */

class FakeRoll {
  static sent = [];
  constructor(formula, data) {
    this.formula = formula;
    this.data = data;
  }
  async toMessage(message, options) {
    FakeRoll.sent.push({ formula: this.formula, message, options });
  }
}

function withFakeRoll(fn) {
  return async () => {
    const original = CONFIG.Dice.MarvelMultiverseRoll;
    CONFIG.Dice.MarvelMultiverseRoll = FakeRoll;
    FakeRoll.sent.length = 0;
    ChatMessage.created.length = 0;
    try {
      await fn();
    } finally {
      CONFIG.Dice.MarvelMultiverseRoll = original;
    }
  };
}

test("teste de atributo soma o valor do atributo e guarda o atributo na mensagem", withFakeRoll(async () => {
  const actor = sampleCharacter();
  await actor.rollAbility("mle");
  const [sent] = FakeRoll.sent;
  assert.equal(sent.formula, "{1d6,1dm,1d6}+@abilities.mle.value");
  assert.deepEqual(sent.options.flags, { ability: "mle", kind: "ability", damageType: "", itemId: null });
  assert.match(sent.message.flavor, /Corpo a Corpo/);
}));

test("teste fora de combate usa o valor fora de combate", withFakeRoll(async () => {
  const actor = sampleCharacter();
  await actor.rollAbility("log", { kind: "noncom" });
  const [sent] = FakeRoll.sent;
  assert.equal(sent.formula, "{1d6,1dm,1d6}+@abilities.log.noncom");
  assert.match(sent.message.flavor, /Lógica/);
  assert.match(sent.message.flavor, /Fora de combate/);
}));

test("atributo desconhecido avisa e não rola", withFakeRoll(async () => {
  const actor = sampleCharacter();
  const result = await actor.rollAbility("xyz");
  assert.equal(result, null);
  assert.equal(FakeRoll.sent.length, 0);
  assert.deepEqual(sys.notices.warn, ["Atributo desconhecido para esta rolagem."]);
}));

test("usar um poder com ataque mostra o cartão e rola o atributo do poder", withFakeRoll(async () => {
  const actor = new CONFIG.Actor.documentClass({
    name: "A",
    type: "character",
    items: [{ name: "Raio", type: "power", system: { ability: "ego", damageType: "focus", cost: "2", range: "10", description: "<p>Dispara.</p>", effect: "<p>Causa dano.</p>" } }],
  });
  const power = actor.items.contents[0];
  await power.roll();
  assert.equal(ChatMessage.created.length, 1);
  const card = ChatMessage.created[0];
  assert.match(card.flavor, /Poder: Raio/);
  assert.match(card.content, /Custo:/);
  assert.match(card.content, /Alcance:/);
  assert.match(card.content, /Dispara\./);
  const [sent] = FakeRoll.sent;
  assert.equal(sent.formula, "{1d6,1dm,1d6}+@abilities.ego.value");
  assert.equal(sent.options.flags.damageType, "focus");
  assert.equal(sent.options.flags.itemId, power.id);
  assert.match(sent.message.flavor, /Dano em: Foco/);
}));

test("usar um trait só mostra o cartão, sem rolar", withFakeRoll(async () => {
  const actor = new CONFIG.Actor.documentClass({ name: "A", type: "character", items: [{ name: "Durão", type: "trait", system: { description: "<p>Aguenta.</p>" } }] });
  await actor.items.contents[0].roll();
  assert.equal(ChatMessage.created.length, 1);
  assert.equal(FakeRoll.sent.length, 0);
}));

test("nome de item com HTML não vira marcação no chat", withFakeRoll(async () => {
  const actor = new CONFIG.Actor.documentClass({ name: "A", type: "character", items: [{ name: "<img src=x onerror=alert(1)>", type: "trait" }] });
  await actor.items.contents[0].roll();
  assert.ok(!ChatMessage.created[0].flavor.includes("<img"));
}));
