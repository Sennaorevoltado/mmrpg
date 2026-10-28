import { test } from "node:test";
import assert from "node:assert/strict";
import { loadSystem, sampleCharacter } from "./support/load-system.mjs";
import { ChatMessage } from "./support/foundry-stub.mjs";

const sys = await loadSystem();
const forms = await import("../module/helpers/forms.mjs");
const grants = await import("../module/helpers/grants.mjs");
const compat = await import("../module/helpers/compat.mjs");

const { formChanges, carryPoolValue, formKind, FORM_KINDS, RANK_KEY, RANK_SET_PRIORITY } = forms;

function reset() {
  game.items.clear();
  ChatMessage.created.length = 0;
  game.settings.values.announceForms = true;
}

/** Cria uma forma na ficha e devolve o item. */
async function addForm(actor, name, system = {}) {
  const [item] = await actor.createEmbeddedDocuments("Item", [{ name, type: "form", system }]);
  return item;
}

const rank = (actor) => actor.system.attributes.rank.value;

/* -------------------------------------------- */
/*  Regras puras                                */
/* -------------------------------------------- */

test("as categorias de forma são armadura, forma alternativa e transformação", () => {
  assert.deepEqual([...FORM_KINDS], ["suit", "alternate", "transformation"]);
  assert.equal(formKind("alternate"), "alternate");
  assert.equal(formKind("xpto"), "suit");
  assert.equal(formKind(undefined), "suit");
});

test("o Rank 'pelo menos' vira Upgrade com prioridade baixa e a soma vira Add", () => {
  assert.deepEqual(formChanges({ rank: { mode: "set", value: 4 } }), [{ key: RANK_KEY, type: "upgrade", value: "4", priority: RANK_SET_PRIORITY }]);
  assert.deepEqual(formChanges({ rank: { mode: "add", value: 2 } }), [{ key: RANK_KEY, type: "add", value: "2" }]);
  assert.deepEqual(formChanges({ rank: { mode: "none", value: 9 } }), []);
  assert.deepEqual(formChanges({ rank: { mode: "set", value: 0 } }), []);
  assert.deepEqual(formChanges({ rank: { mode: "add", value: 0 } }), []);
  assert.equal(RANK_KEY, "system.attributes.rank.value");
});

test("forma emprestada não altera nada", () => {
  assert.deepEqual(formChanges({ borrowed: true, rank: { mode: "set", value: 5 }, changes: [{ key: "system.health.max", type: "add", value: "10" }] }), []);
});

test("alterações da forma: chave vazia sai, tipo estranho vira soma, prioridade só se for inteira", () => {
  const out = formChanges({
    changes: [
      { key: "  ", type: "add", value: "1" },
      { key: "system.health.max", type: "XPTO", value: 20 },
      { key: "system.abilities.mle.value", type: "upgrade", value: "8", priority: 7 },
      { key: "system.focus.max", type: "multiply", value: "2", priority: null },
      { key: "system.movement.run.value", type: "add", value: "1", priority: "abc" },
    ],
  });
  assert.deepEqual(out, [
    { key: "system.health.max", type: "add", value: "20" },
    { key: "system.abilities.mle.value", type: "upgrade", value: "8", priority: 7 },
    { key: "system.focus.max", type: "multiply", value: "2" },
    { key: "system.movement.run.value", type: "add", value: "1" },
  ]);
});

test("o dano sofrido acompanha o corpo quando o máximo muda", () => {
  assert.equal(carryPoolValue(40, 50, 70), 60);
  assert.equal(carryPoolValue(60, 70, 50), 40);
  assert.equal(carryPoolValue(5, 50, 20), 0, "não passa de zero");
  assert.equal(carryPoolValue(50, 50, 70), 70, "cheio continua cheio");
  assert.equal(carryPoolValue(40, 50, 70, false), 40, "sem acompanhar, fica como está");
  assert.equal(carryPoolValue(70, 70, 50, false), 50, "e é cortado se passar do máximo novo");
});

test("a alteração de efeito leva o tipo (v14) e o modo numérico (v13)", () => {
  assert.deepEqual(compat.changeData({ key: "k", type: "upgrade", value: 4, priority: 5 }), { key: "k", type: "upgrade", mode: 4, value: "4", priority: 5 });
  assert.deepEqual(compat.changeData({ key: "k", mode: 5, value: "x" }), { key: "k", type: "override", mode: 5, value: "x", priority: null });
  assert.equal(compat.changeTypeOf({ mode: 3 }), "downgrade");
  assert.equal(compat.changeTypeOf({}), "add");
});

test("concessão escrita como 'Nome (nota)' é separada em nome e nota", () => {
  assert.deepEqual(grants.parseGrantLabel("Elemental Blast (Energy)"), { name: "Elemental Blast", note: "Energy" });
  assert.deepEqual(grants.parseGrantLabel("  Flight 2 "), { name: "Flight 2" });
  assert.deepEqual(grants.parseGrantLabel("(sozinha)"), { name: "(sozinha)" });
  assert.equal(grants.parseGrantLabel("   "), null);
  assert.equal(grants.grantLabel({ name: "Weakness", note: "Silver" }), "Weakness (Silver)");
  assert.equal(grants.grantLabel("Fearless"), "Fearless");
});

test("o elemento sai da nota (chave ou nome em português)", () => {
  assert.equal(grants.elementFromNote("Energy"), "energy");
  assert.equal(grants.elementFromNote("Fogo"), "fire");
  assert.equal(grants.elementFromNote("Energy; 10 pontos para quebrar"), "energy");
  assert.equal(grants.elementFromNote("Bats/Rodents"), "");
  assert.equal(grants.elementFromNote(""), "");
});

/* -------------------------------------------- */
/*  Ligar e desligar                            */
/* -------------------------------------------- */

test("armadura com Rank 'pelo menos' sobe o Rank e o multiplicador, e desligar devolve", async () => {
  reset();
  const actor = sampleCharacter();
  const suit = await addForm(actor, "Mark I", { kind: "suit", rank: { mode: "set", value: 4 } });
  assert.equal(rank(actor), 2);

  assert.equal(await actor.setFormActive(suit, true), true);
  assert.equal(suit.system.active, true);
  assert.ok(suit.system.activatedAt > 0);
  assert.equal(rank(actor), 4);
  assert.equal(actor.system.abilities.mle.damageMultiplier, 4);

  assert.equal(await actor.setFormActive(suit, false), true);
  assert.equal(suit.system.active, false);
  assert.equal(suit.system.activatedAt, 0);
  assert.equal(rank(actor), 2);
  assert.equal(actor.effects.size, 0);
});

test("o Rank 'pelo menos' não rebaixa quem já é maior", async () => {
  reset();
  const actor = sampleCharacter({ system: { attributes: { rank: { value: 5 } } } });
  const suit = await addForm(actor, "Mark I", { rank: { mode: "set", value: 4 } });
  await actor.setFormActive(suit, true);
  assert.equal(rank(actor), 5);
});

test("transformação que soma Rank vale em qualquer ordem junto com a armadura", async () => {
  for (const order of ["suit-first", "transformation-first"]) {
    reset();
    const actor = sampleCharacter();
    const suit = await addForm(actor, "Armadura", { kind: "suit", rank: { mode: "set", value: 4 } });
    const change = await addForm(actor, "Simbionte", { kind: "transformation", rank: { mode: "add", value: 2 } });
    const sequence = order === "suit-first" ? [suit, change] : [change, suit];
    for (const form of sequence) await actor.setFormActive(form, true);
    assert.equal(rank(actor), 6, order);
  }
});

test("só uma forma de cada categoria fica ativa; categorias diferentes convivem", async () => {
  reset();
  const actor = sampleCharacter();
  const a = await addForm(actor, "Armadura A", { kind: "suit", rank: { mode: "add", value: 1 } });
  const b = await addForm(actor, "Armadura B", { kind: "suit", rank: { mode: "add", value: 2 } });
  const alt = await addForm(actor, "Forma Bestial", { kind: "alternate", rank: { mode: "add", value: 1 } });

  await actor.setFormActive(a, true);
  await actor.setFormActive(alt, true);
  assert.equal(rank(actor), 4);

  await actor.setFormActive(b, true);
  assert.equal(a.system.active, false, "a outra armadura desliga");
  assert.equal(alt.system.active, true, "a forma alternativa continua");
  assert.equal(b.system.active, true);
  assert.equal(rank(actor), 5);
  assert.deepEqual(actor.activeForms.map((f) => f.name), ["Forma Bestial", "Armadura B"]);
  assert.equal(actor.effects.size, 2, "um efeito por forma ativa");
});

test("ligar duas vezes ou desligar uma forma desligada não muda nada", async () => {
  reset();
  const actor = sampleCharacter();
  const suit = await addForm(actor, "Mark I", { rank: { mode: "add", value: 1 } });
  assert.equal(await actor.setFormActive(suit, false), false);
  await actor.setFormActive(suit, true);
  assert.equal(await actor.setFormActive(suit, true), false);
  assert.equal(actor.effects.size, 1);
  assert.equal(await actor.setFormActive("não existe", true), false);
  assert.equal(await actor.setFormActive(await Item.create({ name: "Solta", type: "form" }), true), false, "forma fora de uma ficha");
});

test("a forma pode ser ligada pelo id e pelo nome", async () => {
  reset();
  const actor = sampleCharacter();
  const suit = await addForm(actor, "Mark I", { rank: { mode: "add", value: 1 } });
  await actor.setFormActive(suit.id, true);
  assert.equal(suit.system.active, true);
  await actor.setFormActive("Mark I", false);
  assert.equal(suit.system.active, false);
});

test("forma emprestada concede os itens mas não mexe em Rank nem nos valores", async () => {
  reset();
  const actor = sampleCharacter();
  const suit = await addForm(actor, "Armadura emprestada", {
    borrowed: true,
    rank: { mode: "set", value: 6 },
    changes: [{ key: "system.abilities.mle.value", type: "upgrade", value: "9" }],
    powers: [{ name: "Flight 2" }],
  });
  await actor.setFormActive(suit, true);
  assert.equal(rank(actor), 2);
  assert.equal(actor.system.abilities.mle.value, 3);
  assert.equal(actor.effects.size, 0);
  assert.deepEqual(actor.items.filter((i) => i.type === "power").map((i) => i.name), ["Flight 2"]);
});

test("as alterações da forma mexem em atributos e reservas", async () => {
  reset();
  const actor = sampleCharacter();
  const suit = await addForm(actor, "Hulkbuster", {
    changes: [
      { key: "system.abilities.mle.value", type: "upgrade", value: "8" },
      { key: "system.abilities.agl.value", type: "upgrade", value: "1" },
      { key: "system.healthDamageReduction", type: "add", value: "2" },
    ],
  });
  await actor.setFormActive(suit, true);
  assert.equal(actor.system.abilities.mle.value, 8);
  assert.equal(actor.system.abilities.mle.defense, 18);
  assert.equal(actor.system.abilities.agl.value, 2, "pelo menos: quem já é maior fica");
  assert.equal(actor.system.healthDamageReduction, 2);
});

/* -------------------------------------------- */
/*  Concessões                                  */
/* -------------------------------------------- */

test("a forma concede poderes, traços e tags marcados com a forma, e desligar tira só o que ela deu", async () => {
  reset();
  const actor = sampleCharacter({ items: [{ name: "Voo", type: "power", system: {} }] });
  const suit = await addForm(actor, "Mark I", {
    powers: [{ name: "Voo" }, { name: "Repulsor" }],
    traits: [{ name: "Tech Reliance" }],
    tags: [{ name: "Extreme Appearance", note: "Flashy" }],
  });
  await actor.setFormActive(suit, true);

  const names = actor.items.map((i) => `${i.type}:${i.name}`).sort();
  assert.deepEqual(names, ["form:Mark I", "power:Repulsor", "power:Voo", "tag:Extreme Appearance (Flashy)", "trait:Tech Reliance"]);
  const given = actor.items.filter((i) => i.getFlag("mmrpg", "grantedBy") === suit.id).map((i) => i.name).sort();
  assert.deepEqual(given, ["Extreme Appearance (Flashy)", "Repulsor", "Tech Reliance"], "o Voo que já era do personagem não é da forma");

  await actor.setFormActive(suit, false);
  assert.deepEqual(actor.items.map((i) => `${i.type}:${i.name}`).sort(), ["form:Mark I", "power:Voo"]);
});

test("as concessões usam o item do mundo pelo nome (sem diferença de maiúsculas) ou os dados guardados na forma", async () => {
  reset();
  game.items.set("w1", new CONFIG.Item.documentClass({ name: "Flight 2", type: "power", system: { powerSet: "Basic", cost: "5 de Foco" } }));
  const actor = sampleCharacter();
  const suit = await addForm(actor, "Mark I", {
    powers: [{ name: "flight 2" }, { name: "Escudo", system: { powerSet: "Shield Bearer", cost: "10 de Foco" } }],
  });
  await actor.setFormActive(suit, true);
  assert.equal(actor.items.find((i) => i.name === "Flight 2").system.cost, "5 de Foco");
  assert.equal(actor.items.find((i) => i.name === "Escudo").system.powerSet, "Shield Bearer");
});

test("poder elemental concedido pega o elemento da nota; o resto usa o elemento padrão da ficha", async () => {
  reset();
  game.items.set("w1", new CONFIG.Item.documentClass({ name: "Elemental Blast", type: "power", system: { powerSet: "Elemental Control", isElemental: true } }));
  game.items.set("w2", new CONFIG.Item.documentClass({ name: "Flight 2", type: "power", system: { powerSet: "Basic" } }));
  const actor = sampleCharacter({ system: { defaultElement: "ice" } });
  const suit = await addForm(actor, "Mark I", {
    powers: [{ name: "Elemental Blast", note: "Energy" }, { name: "Flight 2" }],
  });
  await actor.setFormActive(suit, true);
  assert.equal(actor.items.find((i) => i.name === "Elemental Blast (Energy)").system.element, "energy");
  assert.equal(actor.items.find((i) => i.name === "Flight 2").system.element, "", "não é elemental");

  const other = await addForm(actor, "Forma de Gelo", { kind: "alternate", powers: [{ name: "Elemental Blast" }] });
  await actor.setFormActive(other, true);
  assert.equal(actor.items.find((i) => i.name === "Elemental Blast").system.element, "ice");
});

test("dois itens iguais vindos de formas diferentes: desligar uma devolve o que a outra precisa", async () => {
  reset();
  const actor = sampleCharacter();
  const suit = await addForm(actor, "Armadura", { kind: "suit", powers: [{ name: "Flight 2" }, { name: "Sturdy 1" }] });
  const alt = await addForm(actor, "Simbionte", { kind: "transformation", powers: [{ name: "Flight 2" }] });

  await actor.setFormActive(suit, true);
  await actor.setFormActive(alt, true);
  assert.equal(actor.items.filter((i) => i.name === "Flight 2").length, 1, "um só Flight 2");

  await actor.setFormActive(suit, false);
  const flight = actor.items.filter((i) => i.name === "Flight 2");
  assert.equal(flight.length, 1, "o Flight 2 continua, agora por causa do Simbionte");
  assert.equal(flight[0].getFlag("mmrpg", "grantedBy"), alt.id);
  assert.equal(actor.items.filter((i) => i.name === "Sturdy 1").length, 0);
});

/* -------------------------------------------- */
/*  Saúde, Foco e imagens                       */
/* -------------------------------------------- */

test("aumentar a Saúde máxima leva o dano junto e desligar devolve", async () => {
  reset();
  const actor = sampleCharacter(); // Saúde 40/50
  const suit = await addForm(actor, "Mark I", { changes: [{ key: "system.health.max", type: "add", value: "20" }] });
  await actor.setFormActive(suit, true);
  assert.equal(actor.system.health.max, 70);
  assert.equal(actor.system.health.value, 60, "10 de dano continuam sendo 10 de dano");
  await actor.setFormActive(suit, false);
  assert.equal(actor.system.health.max, 50);
  assert.equal(actor.system.health.value, 40);
});

test("sem 'acompanhar o dano', a Saúde atual fica como está e só é cortada pelo máximo", async () => {
  reset();
  const actor = sampleCharacter({ system: { health: { value: 50, max: 50 } } });
  const suit = await addForm(actor, "Mark I", { carryDamage: false, changes: [{ key: "system.health.max", type: "add", value: "20" }] });
  await actor.setFormActive(suit, true);
  assert.equal(actor.system.health.value, 50);
  await actor.update({ "system.health.value": 70 });
  await actor.setFormActive(suit, false);
  assert.equal(actor.system.health.value, 50, "cortada pelo máximo antigo");
});

test("retrato e token trocam enquanto a forma está ativa e voltam depois", async () => {
  reset();
  const actor = sampleCharacter();
  actor.img = "heroi.png";
  actor.prototypeToken.texture = { src: "heroi-token.png" };
  const tokenDoc = { texture: { src: "heroi-token.png" }, async update(changes) { this.texture.src = changes["texture.src"]; } };
  actor.tokens = [tokenDoc];
  const suit = await addForm(actor, "Mark I", { portrait: "mark1.png", token: "mark1-token.png" });

  await actor.setFormActive(suit, true);
  assert.equal(actor.img, "mark1.png");
  assert.equal(actor.prototypeToken.texture.src, "mark1-token.png");
  assert.equal(tokenDoc.texture.src, "mark1-token.png");

  await actor.setFormActive(suit, false);
  assert.equal(actor.img, "heroi.png");
  assert.equal(tokenDoc.texture.src, "heroi-token.png");
  assert.equal(actor.getFlag("mmrpg", "formBase"), undefined, "nada guardado quando nenhuma forma troca a imagem");
});

test("valem as imagens da forma ativa mais recente que tiver uma", async () => {
  reset();
  const actor = sampleCharacter();
  actor.img = "heroi.png";
  const suit = await addForm(actor, "Armadura", { kind: "suit", portrait: "armadura.png" });
  const alt = await addForm(actor, "Forma Bestial", { kind: "alternate", portrait: "fera.png" });
  const plain = await addForm(actor, "Sem imagem", { kind: "transformation" });

  await actor.setFormActive(suit, true);
  await actor.setFormActive(alt, true);
  await actor.setFormActive(plain, true);
  assert.equal(actor.img, "fera.png");
  await actor.setFormActive(alt, false);
  assert.equal(actor.img, "armadura.png");
  await actor.setFormActive(suit, false);
  assert.equal(actor.img, "heroi.png");
});

/* -------------------------------------------- */
/*  Chat                                        */
/* -------------------------------------------- */

test("o chat avisa a troca de forma com o Rank e o que foi concedido", async () => {
  reset();
  const actor = sampleCharacter();
  const suit = await addForm(actor, "Mark I", { rank: { mode: "set", value: 4 }, powers: [{ name: "Voo" }] });

  await actor.setFormActive(suit, true);
  assert.equal(ChatMessage.created.length, 1);
  const text = ChatMessage.created[0].content;
  assert.match(text, /Teste Silva/);
  assert.match(text, /Mark I/);
  assert.match(text, /Armadura/);
  assert.match(text, /Rank 2 para 4/);
  assert.match(text, /Voo/);

  await actor.setFormActive(suit, false);
  assert.equal(ChatMessage.created.length, 2);
  assert.match(ChatMessage.created[1].content, /desliga/);
  assert.match(ChatMessage.created[1].content, /Rank 4 para 2/);
});

test("a configuração pode silenciar o aviso", async () => {
  reset();
  game.settings.values.announceForms = false;
  const actor = sampleCharacter();
  const suit = await addForm(actor, "Mark I", { rank: { mode: "add", value: 1 } });
  await actor.setFormActive(suit, true);
  assert.equal(ChatMessage.created.length, 0);
  game.settings.values.announceForms = true;
});

test("nomes com HTML são escapados no aviso", async () => {
  reset();
  const actor = sampleCharacter();
  const suit = await addForm(actor, "<b>x</b>", { rank: { mode: "add", value: 1 } });
  await actor.setFormActive(suit, true);
  assert.ok(!ChatMessage.created[0].content.includes("<b>x</b>"));
});

/* -------------------------------------------- */
/*  Cópias, apagar, editar, usar                */
/* -------------------------------------------- */

test("uma forma copiada ou arrastada nunca chega ligada", async () => {
  reset();
  const actor = sampleCharacter();
  const copy = await addForm(actor, "Mark I", { active: true, activatedAt: 123, rank: { mode: "add", value: 1 } });
  assert.equal(copy.system.active, false);
  assert.equal(copy.system.activatedAt, 0);
  assert.equal(rank(actor), 2);

  const loose = await Item.create({ name: "Solta", type: "form", system: { active: true } });
  assert.equal(loose.system.active, false);
});

test("apagar uma forma ligada desliga antes: tira o efeito, as concessões e devolve a Saúde", async () => {
  reset();
  const actor = sampleCharacter();
  const suit = await addForm(actor, "Mark I", {
    rank: { mode: "set", value: 4 },
    powers: [{ name: "Voo" }],
    changes: [{ key: "system.health.max", type: "add", value: "20" }],
  });
  await actor.setFormActive(suit, true);
  assert.equal(rank(actor), 4);

  await actor.deleteEmbeddedDocuments("Item", [suit.id]);
  assert.equal(rank(actor), 2);
  assert.equal(actor.effects.size, 0);
  assert.equal(actor.items.size, 0);
  assert.equal(actor.system.health.max, 50);
  assert.equal(actor.system.health.value, 40);
});

test("editar uma forma ativa e atualizar reaplica o efeito e as concessões", async () => {
  reset();
  const actor = sampleCharacter();
  const suit = await addForm(actor, "Mark I", { rank: { mode: "add", value: 1 }, powers: [{ name: "Voo" }] });
  await actor.setFormActive(suit, true);
  assert.equal(rank(actor), 3);

  await suit.update({ "system.rank.value": 3, "system.powers": [{ name: "Escudo" }] });
  assert.equal(await actor.refreshForm(suit), true);
  assert.equal(rank(actor), 5);
  assert.deepEqual(actor.items.filter((i) => i.type === "power").map((i) => i.name), ["Escudo"]);
  assert.equal(suit.system.active, true);
  assert.equal(actor.effects.size, 1);

  await actor.setFormActive(suit, false);
  assert.equal(await actor.refreshForm(suit), false, "forma desligada não precisa atualizar");
});

test("usar a forma (barra de macros) liga e desliga", async () => {
  reset();
  const actor = sampleCharacter();
  const suit = await addForm(actor, "Mark I", { rank: { mode: "add", value: 1 } });
  await suit.roll();
  assert.equal(suit.system.active, true);
  await suit.roll();
  assert.equal(suit.system.active, false);
});

test("trocas seguidas esperam na fila e terminam em ordem", async () => {
  reset();
  const actor = sampleCharacter();
  const a = await addForm(actor, "A", { kind: "suit", rank: { mode: "add", value: 1 } });
  const b = await addForm(actor, "B", { kind: "suit", rank: { mode: "add", value: 2 } });
  await Promise.all([actor.setFormActive(a, true), actor.setFormActive(b, true), actor.setFormActive(a, true)]);
  assert.deepEqual(actor.activeForms.map((f) => f.name), ["A"]);
  assert.equal(rank(actor), 3);
  assert.equal(actor.effects.size, 1);
});

test("uma forma com chave de alteração inválida não derruba o ator ao ser montada", async () => {
  reset();
  const actor = sampleCharacter();
  const item = await addForm(actor, "Quebrada", { changes: [{ key: "system.nao.existe", type: "add", value: "1" }] });
  await assert.rejects(() => actor.setFormActive(item, true), /Chave de efeito inexistente/);
});
