import { test } from "node:test";
import assert from "node:assert/strict";
import { loadSystem, sampleCharacter } from "./support/load-system.mjs";
import { renderTemplate } from "./support/foundry-stub.mjs";
import { balanceProblems, leakedText, nestedAnchors } from "./support/html.mjs";
import { FakeElement, makeRoot, eventOn } from "./support/fake-dom.mjs";

const sys = await loadSystem();
const cfg = sys.MARVEL_MULTIVERSE;
const { MarvelMultiverseCharacterSheet, MarvelMultiverseNPCSheet, MarvelMultiverseItemSheet } = sys.sheets;

const POWER_SETS = ["Basic", "Magic"];

function fullCharacter(type = "character") {
  const actor = new CONFIG.Actor.documentClass({
    name: "Teste Silva",
    type,
    system: { attributes: { rank: { value: 3 } }, abilities: { mle: { value: 3 }, vig: { value: 2 } }, health: { value: 40, max: 50 } },
    items: [
      { name: "Soco Forte", type: "power", system: { powerSet: "Basic", cost: "2", ability: "mle", description: "<p>Um soco.</p>" } },
      { name: "Raio Mágico", type: "power", system: { powerSet: "Magic", isElemental: true, element: "fire" } },
      { name: "Gambiarra", type: "power", system: { powerSet: "Conjunto Inventado" } },
      { name: "Durão", type: "trait" },
      { name: "Herói", type: "tag" },
      { name: "Escudo", type: "weapon" },
      { name: "Corda", type: "item", system: { quantity: 3 } },
      { name: "Acadêmico", type: "origin" },
      { name: "Detetive", type: "occupation" },
    ],
  });
  return actor;
}

/* -------------------------------------------- */
/*  Renderização                                */
/* -------------------------------------------- */

for (const [kind, Sheet] of [["personagem", MarvelMultiverseCharacterSheet], ["NPC", MarvelMultiverseNPCSheet]]) {
  test(`ficha de ${kind}: renderiza sem texto vazando e com as marcas em ordem`, async () => {
    const actor = fullCharacter(kind === "NPC" ? "npc" : "character");
    const sheet = new Sheet(actor);
    const html = await renderTemplate(sheet.template, sheet.getData());

    assert.deepEqual(leakedText(html), [], "texto de chave ou valor indefinido apareceu na ficha");
    assert.deepEqual(balanceProblems(html), []);
    assert.deepEqual(nestedAnchors(html), []);
    assert.deepEqual([...sys.missingKeys], []);

    // Atributos traduzidos e rolaveis.
    for (const name of ["Corpo a Corpo", "Agilidade", "Resiliência", "Vigilância", "Ego", "Lógica"]) {
      assert.ok(html.includes(name), `falta o atributo ${name}`);
    }
    for (const key of Object.keys(cfg.abilities)) assert.ok(html.includes(`data-ability="${key}"`), `atributo ${key} sem rolagem`);

    // Poderes agrupados por conjunto, com o nome em português e um grupo para o conjunto desconhecido.
    assert.ok(html.includes("Básicos"));
    assert.ok(html.includes("Magia"));
    assert.ok(html.includes("Conjunto Inventado"));
    assert.ok(html.includes("Soco Forte"));
    assert.ok(html.includes("Durão") && html.includes("Herói"));
    assert.ok(html.includes("Custo: 2"));
  });
}

test("ficha de personagem: abas, equipamento e efeitos", async () => {
  const sheet = new MarvelMultiverseCharacterSheet(fullCharacter());
  const html = await renderTemplate(sheet.template, sheet.getData());
  for (const tab of ["abilities", "biography", "gear", "effects"]) assert.ok(html.includes(`data-tab="${tab}"`), tab);
  for (const label of ["Poderes", "Biografia", "Equipamento", "Efeitos"]) assert.ok(html.includes(label), label);
  assert.ok(html.includes("Escudo") && html.includes("Corda") && html.includes("x3"));
  assert.ok(html.includes("Acadêmico") && html.includes("Detetive"));
});

test("ficha vazia mostra as dicas de arrastar", async () => {
  const sheet = new MarvelMultiverseCharacterSheet(sampleCharacter());
  const html = await renderTemplate(sheet.template, sheet.getData());
  assert.ok(html.includes("Arraste uma origem"));
  assert.ok(html.includes("Arraste uma ocupação"));
  assert.ok(html.includes("Nenhum poder ainda"));
});

test("tudo que é rolável sabe o que rolar", async () => {
  const sheet = new MarvelMultiverseCharacterSheet(fullCharacter());
  const html = await renderTemplate(sheet.template, sheet.getData());
  const tags = [...html.matchAll(/<(\w+)([^>]*class="[^"]*\brollable\b[^"]*"[^>]*)>/g)];
  assert.ok(tags.length > 10);
  for (const [, , attrs] of tags) {
    assert.ok(/data-ability=|data-roll-type="item"|roll-initiative/.test(attrs), `rolável sem alvo: ${attrs}`);
  }
});

test("a lista de elemento padrão e de tamanho sai em português", async () => {
  const sheet = new MarvelMultiverseCharacterSheet(fullCharacter());
  const html = await renderTemplate(sheet.template, sheet.getData());
  assert.ok(html.includes(">Fogo<") && html.includes(">Gelo<"));
  assert.ok(html.includes(">Médio<") && html.includes(">Grande<"));
  assert.ok(html.includes(">Ofensiva<"));
});

const ITEM_CASES = {
  power: { system: { isElemental: true, element: "ice", ability: "ego", attackKind: "ranged", damageType: "focus", description: "<p>x</p>", effect: "<p>y</p>" } },
  weapon: { system: { ability: "mle", attackTarget: "agl", attackKind: "close", damageType: "health", category: "Escudo" } },
  trait: { system: { restriction: "Nenhuma", multiple: true } },
  tag: { system: { rarity: "Comum" } },
  origin: { system: { examples: "Alguém", minimumRank: 1, traits: [{ name: "Durão" }], powers: [{ name: "Soco" }, "Chute"] } },
  occupation: { system: { examples: "Alguém", tags: [{ name: "Herói" }] } },
  item: { system: { quantity: 2, weight: 4, ability: "mle" } },
};

for (const [type, data] of Object.entries(ITEM_CASES)) {
  test(`ficha de item (${type}): renderiza e confere os campos`, async () => {
    const item = new CONFIG.Item.documentClass({ name: `Exemplo ${type}`, type, ...data });
    const sheet = new MarvelMultiverseItemSheet(item);
    const html = await renderTemplate(sheet.template, sheet.getData());
    assert.deepEqual(leakedText(html), []);
    assert.deepEqual(balanceProblems(html), []);
    assert.deepEqual([...sys.missingKeys], []);
    assert.ok(html.includes(`Exemplo ${type}`));
    assert.ok(html.includes('data-tab="effects"'));
    // Todo campo editável aponta para um caminho que existe no modelo de dados.
    for (const [, path] of html.matchAll(/name="(system\.[\w.]+)"/g)) {
      const parts = path.split(".").slice(1);
      let cur = item.system;
      for (const part of parts) {
        assert.ok(cur !== undefined && cur !== null && part in cur, `${type}: campo ${path} não existe no modelo`);
        cur = cur[part];
      }
    }
  });
}

test("origem e ocupação listam o que concedem", async () => {
  const origin = new CONFIG.Item.documentClass({ name: "O", type: "origin", ...ITEM_CASES.origin });
  const html = await renderTemplate(new MarvelMultiverseItemSheet(origin).template, new MarvelMultiverseItemSheet(origin).getData());
  assert.ok(html.includes("Concede traços") && html.includes("Durão"));
  assert.ok(html.includes("Concede poderes") && html.includes("Soco") && html.includes("Chute"));
});

test("poder: o conjunto escolhido aparece selecionado, em português", async () => {
  const power = new CONFIG.Item.documentClass({ name: "P", type: "power", system: { powerSet: "Telepathy" } });
  const sheet = new MarvelMultiverseItemSheet(power);
  const html = await renderTemplate(sheet.template, sheet.getData());
  assert.match(html, /<option value="Telepathy" selected>Telepatia<\/option>/);
});

/* -------------------------------------------- */
/*  Cliques e arrastos                          */
/* -------------------------------------------- */

function wire(actor) {
  const sheet = new MarvelMultiverseCharacterSheet(actor);
  const root = makeRoot();
  sheet.activateListeners(root);
  const calls = [];
  actor.rollAbility = async (key, options) => calls.push(["rollAbility", key, options]);
  actor.rollInitiative = async (options) => calls.push(["rollInitiative", options]);
  return { sheet, root, calls };
}

const click = (root, el) => root.fire("click", eventOn(el));
const li = (itemId) => new FakeElement({ tag: "li", classes: ["item"], dataset: { itemId } });

test("clicar no nome do atributo rola o teste; clicar no fora de combate rola o outro", () => {
  const { root, calls } = wire(fullCharacter());
  click(root, new FakeElement({ classes: ["rollable"], dataset: { ability: "mle" } }));
  click(root, new FakeElement({ tag: "span", classes: ["rollable"], dataset: { ability: "log", kind: "noncom" } }));
  assert.deepEqual(calls, [
    ["rollAbility", "mle", { kind: "ability" }],
    ["rollAbility", "log", { kind: "noncom" }],
  ]);
});

test("clicar na iniciativa rola a iniciativa", () => {
  const { root, calls } = wire(fullCharacter());
  click(root, new FakeElement({ classes: ["rollable", "roll-initiative"] }));
  assert.deepEqual(calls, [["rollInitiative", { createCombatants: true }]]);
});

test("clicar num item da lista usa o item", () => {
  const actor = fullCharacter();
  const { root } = wire(actor);
  const power = actor.items.find((i) => i.name === "Soco Forte");
  const used = [];
  power.roll = async () => used.push(power.name);
  click(root, new FakeElement({ tag: "a", classes: ["rollable"], dataset: { rollType: "item" }, parent: li(power.id) }));
  assert.deepEqual(used, ["Soco Forte"]);
});

test("excluir um item da lista o tira da ficha", async () => {
  const actor = fullCharacter();
  const { root } = wire(actor);
  const trait = actor.items.find((i) => i.type === "trait");
  click(root, new FakeElement({ tag: "a", classes: ["item-delete"], parent: li(trait.id) }));
  await new Promise((r) => setTimeout(r));
  assert.ok(!actor.items.get(trait.id));
});

test("o botão + cria o item no conjunto certo, com nome em português", async () => {
  const actor = sampleCharacter();
  const { root } = wire(actor);
  click(root, new FakeElement({ tag: "a", classes: ["item-create"], dataset: { type: "power", powerSet: "Magic" } }));
  await new Promise((r) => setTimeout(r));
  const created = actor.items.contents.at(0);
  assert.equal(created.name, "Novo: Poder");
  assert.equal(created.type, "power");
  assert.equal(created.system.powerSet, "Magic");
});

test("trocar o tamanho cria o efeito do tamanho e tira o antigo", async () => {
  const actor = sampleCharacter();
  const sheet = new MarvelMultiverseCharacterSheet(actor);
  await sheet._changeSizeEffect("big");
  assert.equal(actor.effects.contents.filter((e) => e.getFlag("mmrpg", "sizeEffect")).length, 1);
  assert.equal(actor.system.size, "big");
  await sheet._changeSizeEffect("small");
  const sized = actor.effects.contents.filter((e) => e.getFlag("mmrpg", "sizeEffect"));
  assert.equal(sized.length, 1);
  assert.equal(sized[0].getFlag("mmrpg", "sizeEffect"), "small");
  assert.equal(sized[0].name, "Tamanho: Pequeno");
  assert.equal(actor.system.size, "small");
});

test("soltar uma origem cria o que ela concede, sem duplicar", async () => {
  const actor = sampleCharacter();
  const sheet = new MarvelMultiverseCharacterSheet(actor);
  const origin = {
    name: "Mutante",
    type: "origin",
    system: {
      traits: [{ name: "Durão", system: { restriction: "x" } }],
      tags: ["Herói"],
      powers: [{ name: "Raio", system: { powerSet: "Elemental Control" } }, "Soco"],
    },
  };
  await sheet._onDropItemCreate(structuredClone(origin), {});
  const names = () => actor.items.contents.map((i) => `${i.type}:${i.name}`).sort();
  assert.deepEqual(names(), ["origin:Mutante", "power:Raio", "power:Soco", "tag:Herói", "trait:Durão"]);
  // O poder concedido nasce preenchido, não vazio.
  assert.equal(actor.items.find((i) => i.name === "Durão").system.restriction, "x");
  assert.equal(actor.items.find((i) => i.name === "Raio").system.powerSet, "Elemental Control");

  await sheet._onDropItemCreate(structuredClone(origin), {});
  assert.equal(actor.items.size, 5, "soltar de novo não deve duplicar");
});

test("poder elemental solto recebe o elemento padrão da ficha", async () => {
  const actor = sampleCharacter({ system: { defaultElement: "ice" } });
  const sheet = new MarvelMultiverseCharacterSheet(actor);
  await sheet._onDropItemCreate({ name: "Rajada", type: "power", system: { powerSet: "Elemental Control" } }, {});
  assert.equal(actor.items.find((i) => i.name === "Rajada").system.element, "ice");
});

test("soltar o trait Big ou Grande muda o tamanho", async () => {
  for (const name of ["Big", "Grande"]) {
    const actor = sampleCharacter();
    const sheet = new MarvelMultiverseCharacterSheet(actor);
    await sheet._onDropItemCreate({ name, type: "trait", system: {} }, {});
    assert.equal(actor.system.size, "big", name);
  }
});

test("poderes de uma origem usam o item do mundo quando só vem o nome", async () => {
  game.items.set("w1", new CONFIG.Item.documentClass({ name: "Soco", type: "power", system: { powerSet: "Martial Arts", cost: "1" } }));
  const actor = sampleCharacter();
  const sheet = new MarvelMultiverseCharacterSheet(actor);
  await sheet._grantItems(["Soco"], "power");
  const power = actor.items.find((i) => i.name === "Soco");
  assert.equal(power.system.powerSet, "Martial Arts");
  assert.equal(power.system.cost, "1");
  game.items.delete("w1");
});
