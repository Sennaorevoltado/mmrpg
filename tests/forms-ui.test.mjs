import { test } from "node:test";
import assert from "node:assert/strict";
import { loadSystem, sampleCharacter } from "./support/load-system.mjs";
import { renderTemplate } from "./support/foundry-stub.mjs";
import { balanceProblems, leakedText, nestedAnchors } from "./support/html.mjs";
import { FakeElement, makeRoot, eventOn } from "./support/fake-dom.mjs";

const sys = await loadSystem();
const { MarvelMultiverseCharacterSheet, MarvelMultiverseNPCSheet, MarvelMultiverseItemSheet } = sys.sheets;
const { suggestedChangeKeys, FORM_KINDS } = await import("../module/helpers/forms.mjs");
const { cleanChange, takeChangeRows, putChangeRows, withBlankRow, withoutRow } = await import("../module/helpers/form-data.mjs");
const { onUpdateForm, formChangeNeedsRefresh, registerFormSettings } = await import("../module/helpers/form-hooks.mjs");

const tick = () => new Promise((resolve) => setTimeout(resolve));
const click = (root, el) => root.fire("click", eventOn(el));
const li = (itemId) => new FakeElement({ tag: "li", classes: ["item"], dataset: { itemId } });

function heroWithForms(type = "character") {
  return new CONFIG.Actor.documentClass({
    name: "Aranha de Teste",
    type,
    system: { attributes: { rank: { value: 3 } }, health: { value: 38, max: 50 } },
    items: [
      {
        name: "Armadura Mark III",
        type: "form",
        system: {
          kind: "suit",
          active: true,
          activatedAt: 1,
          rank: { mode: "set", value: 5 },
          changes: [{ key: "system.health.max", type: "add", value: "20" }],
          powers: [{ name: "Flight 2" }, { name: "Elemental Blast", note: "Energy" }],
          traits: [{ name: "Tech Reliance" }],
          tags: [{ name: "Extreme Appearance", note: "Flashy" }],
        },
      },
      { name: "Hulkbuster", type: "form", system: { kind: "suit", rank: { mode: "set", value: 6 }, borrowed: true } },
      { name: "Forma Bestial", type: "form", system: { kind: "alternate", rank: { mode: "add", value: 1 } } },
      { name: "Simbionte", type: "form", system: { kind: "transformation", rank: { mode: "add", value: -1 } } },
    ],
  });
}

/* -------------------------------------------- */
/*  Aba Formas                                  */
/* -------------------------------------------- */

for (const [label, Sheet, type] of [["personagem", MarvelMultiverseCharacterSheet, "character"], ["NPC", MarvelMultiverseNPCSheet, "npc"]]) {
  test(`ficha de ${label}: lista as formas por categoria, com a ligada destacada`, async () => {
    const sheet = new Sheet(heroWithForms(type));
    const html = await renderTemplate(sheet.template, sheet.getData());

    assert.deepEqual(leakedText(html), []);
    assert.deepEqual(balanceProblems(html), []);
    assert.deepEqual(nestedAnchors(html), []);
    assert.deepEqual([...sys.missingKeys], []);

    for (const heading of ["Armaduras", "Formas alternativas", "Transformações"]) assert.ok(html.includes(`>${heading}<`), heading);
    for (const name of ["Armadura Mark III", "Hulkbuster", "Forma Bestial", "Simbionte"]) assert.ok(html.includes(name), name);
    // Resumo de cada forma.
    assert.ok(html.includes("Rank mín. 5"));
    assert.ok(html.includes("Rank mín. 6, Emprestada"));
    assert.ok(html.includes("Rank +1"));
    assert.ok(html.includes("Rank -1"));
    // Só a ligada tem o destaque, o selo e o ícone de ligado.
    assert.equal((html.match(/mm-item -active/g) ?? []).length, 1);
    assert.equal((html.match(/class="mm-badge"/g) ?? []).length, 1);
    assert.equal((html.match(/fa-toggle-on/g) ?? []).length, 1);
    assert.equal((html.match(/fa-toggle-off/g) ?? []).length, 3);
    // Botão + de cada categoria.
    for (const kind of FORM_KINDS) assert.ok(html.includes(`data-type="form" data-kind="${kind}"`), kind);
    assert.ok(!html.includes("Nenhuma forma ainda"));
  });
}

test("ficha de personagem: cinco abas, com Formas depois de Poderes", async () => {
  const sheet = new MarvelMultiverseCharacterSheet(heroWithForms());
  const html = await renderTemplate(sheet.template, sheet.getData());
  const tabs = [...html.matchAll(/<a class="item" data-tab="(\w+)">/g)].map((m) => m[1]);
  assert.deepEqual(tabs, ["abilities", "forms", "biography", "gear", "effects"]);
  assert.ok(html.includes("mm-tabs -five"));
  assert.ok(html.includes('data-tab="forms"'));
});

test("sem formas, a aba mostra a dica e as três categorias para criar", async () => {
  const sheet = new MarvelMultiverseCharacterSheet(sampleCharacter());
  const html = await renderTemplate(sheet.template, sheet.getData());
  assert.ok(html.includes("Nenhuma forma ainda"));
  assert.equal((html.match(/data-type="form"/g) ?? []).length, 3);
});

function wire(actor) {
  const sheet = new MarvelMultiverseCharacterSheet(actor);
  const root = makeRoot();
  sheet.activateListeners(root);
  return { sheet, root };
}

test("o ícone de ligar liga e desliga a forma", async () => {
  const actor = heroWithForms();
  const { root } = wire(actor);
  const bestial = actor.items.find((i) => i.name === "Forma Bestial");
  const toggle = new FakeElement({ tag: "a", classes: ["item-control", "form-toggle"], parent: li(bestial.id) });

  click(root, toggle);
  await tick();
  await actor.setFormActive(bestial, true); // espera a fila terminar
  assert.equal(bestial.system.active, true);
  assert.equal(actor.system.attributes.rank.value, 4, "Rank 3 + 1 da forma alternativa");

  click(root, toggle);
  await tick();
  await actor.setFormActive(bestial, false);
  assert.equal(bestial.system.active, false);
});

test("clicar no nome da forma também liga e desliga", async () => {
  const actor = heroWithForms();
  const { root } = wire(actor);
  const bestial = actor.items.find((i) => i.name === "Forma Bestial");
  click(root, new FakeElement({ tag: "a", classes: ["rollable"], dataset: { rollType: "item" }, parent: li(bestial.id) }));
  await tick();
  await actor.setFormActive(bestial, true);
  assert.equal(bestial.system.active, true);
});

test("o botão + cria a forma da categoria certa, desligada", async () => {
  const actor = sampleCharacter();
  const { root } = wire(actor);
  click(root, new FakeElement({ tag: "a", classes: ["item-create"], dataset: { type: "form", kind: "transformation" } }));
  await tick();
  const created = actor.items.contents.at(0);
  assert.equal(created.name, "Novo: Forma");
  assert.equal(created.type, "form");
  assert.equal(created.system.kind, "transformation");
  assert.equal(created.system.active, false);
});

test("editar e excluir uma forma usam os mesmos botões dos outros itens", async () => {
  const actor = heroWithForms();
  const { root } = wire(actor);
  const bestial = actor.items.find((i) => i.name === "Forma Bestial");
  const rendered = [];
  bestial.sheet = { render: (force) => rendered.push(force) };
  click(root, new FakeElement({ tag: "a", classes: ["item-edit"], parent: li(bestial.id) }));
  assert.deepEqual(rendered, [true]);
  click(root, new FakeElement({ tag: "a", classes: ["item-delete"], parent: li(bestial.id) }));
  await tick();
  assert.ok(!actor.items.get(bestial.id));
});

/* -------------------------------------------- */
/*  Ficha da forma                              */
/* -------------------------------------------- */

async function renderForm(item) {
  const sheet = new MarvelMultiverseItemSheet(item);
  return { sheet, html: await renderTemplate(sheet.template, sheet.getData()) };
}

test("ficha da forma: renderiza, com os campos no modelo de dados", async () => {
  const actor = heroWithForms();
  const suit = actor.items.find((i) => i.name === "Armadura Mark III");
  const { html } = await renderForm(suit);

  assert.deepEqual(leakedText(html), []);
  assert.deepEqual(balanceProblems(html), []);
  assert.deepEqual([...sys.missingKeys], []);
  for (const tab of ["attributes", "changes", "grants"]) assert.ok(html.includes(`data-tab="${tab}"`), tab);
  assert.ok(html.includes("mm-tabs -three"));

  for (const [, path] of html.matchAll(/name="(system\.[\w.]+)"/g)) {
    let cur = suit.system;
    for (const part of path.split(".").slice(1)) {
      assert.ok(cur !== undefined && cur !== null && part in cur, `campo ${path} não existe no modelo`);
      cur = cur[part];
    }
  }

  // Categoria e Rank em português, com o valor atual selecionado.
  assert.match(html, /<option value="suit" selected>Armadura<\/option>/);
  assert.match(html, /<option value="alternate">Forma alternativa<\/option>/);
  assert.match(html, /<option value="set" selected>Pelo menos<\/option>/);
  assert.match(html, /name="system\.rank\.value" value="5"/);
  // Alteração existente, com tipo traduzido, e a lista de campos sugeridos.
  assert.match(html, /name="system\.changes\.0\.key" value="system\.health\.max"/);
  assert.match(html, /<option value="add" selected>Somar<\/option>/);
  assert.match(html, /<datalist id="mm-change-keys">/);
  assert.ok(html.includes("Saúde máxima") && html.includes("Corpo a Corpo: valor"));
  // Concessões com a nota.
  for (const text of ["Flight 2", "Elemental Blast (Energy)", "Tech Reliance", "Extreme Appearance (Flashy)"]) assert.ok(html.includes(text), text);
  // Dentro de uma ficha: mostra o estado e o botão.
  assert.ok(html.includes("Esta forma está ligada."));
  assert.ok(html.includes("form-item-toggle") && html.includes("Desligar"));
});

test("forma solta (fora de uma ficha) explica que precisa de um personagem", async () => {
  const loose = new CONFIG.Item.documentClass({ name: "Solta", type: "form" });
  const { html } = await renderForm(loose);
  assert.ok(html.includes("Coloque esta forma na ficha de um personagem"));
  assert.ok(!html.includes("form-item-toggle"));
  assert.ok(html.includes("Nenhuma alteração."));
});

test("os campos sugeridos para alterações existem na ficha do personagem", () => {
  const actor = sampleCharacter();
  for (const { key } of suggestedChangeKeys(Object.keys(CONFIG.MARVEL_MULTIVERSE.abilities))) {
    assert.notEqual(foundry.utils.getProperty(actor, key), undefined, `${key} não existe no personagem`);
  }
});

/* -------------------------------------------- */
/*  Lista de alterações                         */
/* -------------------------------------------- */

test("o formulário achatado vira uma lista de alterações, na ordem dos índices", () => {
  const data = {
    name: "X",
    "system.changes.1.key": "system.focus.max",
    "system.changes.1.type": "multiply",
    "system.changes.1.value": "2",
    "system.changes.1.priority": "",
    "system.changes.0.key": " system.health.max ",
    "system.changes.0.type": "add",
    "system.changes.0.value": "20",
    "system.changes.0.priority": "30",
  };
  const rows = takeChangeRows(data);
  assert.deepEqual(rows, [
    { key: "system.health.max", type: "add", value: "20", priority: 30 },
    { key: "system.focus.max", type: "multiply", value: "2", priority: null },
  ]);
  assert.deepEqual(Object.keys(data), ["name"], "os campos achatados saem dos dados");
  putChangeRows(data, rows);
  assert.deepEqual(data["system.changes"], rows);
});

test("o formulário já expandido (objeto com chaves numéricas) também funciona", () => {
  const data = { system: { kind: "suit", changes: { 0: { key: "a", type: "xpto", value: 3 }, 1: { key: "b", type: "upgrade", value: "4", priority: "7" } } } };
  const rows = takeChangeRows(data);
  assert.deepEqual(rows, [
    { key: "a", type: "add", value: "3", priority: null },
    { key: "b", type: "upgrade", value: "4", priority: 7 },
  ]);
  assert.deepEqual(data, { system: { kind: "suit" } });
  putChangeRows(data, rows);
  assert.deepEqual(data.system.changes, rows);
});

test("formulário sem alterações não mexe na lista", () => {
  assert.equal(takeChangeRows({ name: "X", "system.kind": "suit" }), null);
  assert.equal(takeChangeRows({ system: { kind: "suit" } }), null);
  assert.equal(takeChangeRows(null), null);
});

test("limpeza de uma linha: tipo inválido vira soma e prioridade só se for inteira", () => {
  assert.deepEqual(cleanChange({ key: " k ", type: "zzz", value: 5, priority: "x" }), { key: "k", type: "add", value: "5", priority: null });
  assert.deepEqual(cleanChange({ priority: 0 }), { key: "", type: "add", value: "", priority: 0 });
  assert.deepEqual(withBlankRow([{ key: "a", type: "add", value: "1" }]).at(-1), { key: "", type: "add", value: "", priority: null });
  assert.deepEqual(withoutRow([{ key: "a" }, { key: "b" }, { key: "c" }], 1).map((c) => c.key), ["a", "c"]);
});

test("a ficha da forma envia as alterações como lista", () => {
  const actor = heroWithForms();
  const suit = actor.items.find((i) => i.name === "Armadura Mark III");
  const sheet = new MarvelMultiverseItemSheet(suit);
  sheet.__submit = { name: "Mark III", "system.changes.0.key": "system.focus.max", "system.changes.0.type": "add", "system.changes.0.value": "5", "system.changes.0.priority": "" };
  const data = sheet._getSubmitData();
  assert.deepEqual(data["system.changes"], [{ key: "system.focus.max", type: "add", value: "5", priority: null }]);
  assert.ok(!Object.keys(data).some((k) => k.startsWith("system.changes.")));

  // Outro tipo de item não é mexido.
  const trait = new CONFIG.Item.documentClass({ name: "T", type: "trait" });
  const other = new MarvelMultiverseItemSheet(trait);
  other.__submit = { "system.changes.0.key": "x" };
  assert.deepEqual(other._getSubmitData(), { "system.changes.0.key": "x" });
});

function wireItem(item) {
  const sheet = new MarvelMultiverseItemSheet(item);
  const root = makeRoot();
  sheet.activateListeners(root);
  return { sheet, root };
}

test("adicionar e remover alteração mudam a lista da forma", async () => {
  const actor = heroWithForms();
  const suit = actor.items.find((i) => i.name === "Armadura Mark III");
  const { root } = wireItem(suit);

  click(root, new FakeElement({ tag: "button", classes: ["change-add"] }));
  await tick();
  assert.equal(suit.system.changes.length, 2);
  assert.equal(suit.system.changes[1].key, "");

  click(root, new FakeElement({ tag: "a", classes: ["change-remove"], dataset: { index: "0" } }));
  await tick();
  assert.deepEqual(suit.system.changes.map((c) => c.key), [""]);
});

test("concessões: digitar o nome (com nota), repetir e remover", async () => {
  const actor = heroWithForms();
  const suit = actor.items.find((i) => i.name === "Armadura Mark III");
  const { sheet, root } = wireItem(suit);

  await sheet._addGrant("powers", { value: "Sturdy 1" });
  await sheet._addGrant("powers", { value: "Elemental Barrage (Fire)" });
  await sheet._addGrant("powers", { value: "  sturdy 1 " });
  await sheet._addGrant("powers", { value: "   " });
  await sheet._addGrant("campo-estranho", { value: "x" });
  assert.deepEqual(suit.system.powers.map((p) => (p.note ? `${p.name} (${p.note})` : p.name)), ["Flight 2", "Elemental Blast (Energy)", "Sturdy 1", "Elemental Barrage (Fire)"]);

  const input = { value: "Fearless" };
  await sheet._addGrant("traits", input);
  assert.equal(input.value, "", "o campo esvazia depois de adicionar");
  assert.deepEqual(suit.system.traits.map((t) => t.name), ["Tech Reliance", "Fearless"]);

  click(root, new FakeElement({ tag: "a", classes: ["grant-remove"], dataset: { field: "powers", index: "0" } }));
  await tick();
  assert.deepEqual(suit.system.powers.map((p) => p.name), ["Elemental Blast", "Sturdy 1", "Elemental Barrage"]);
  click(root, new FakeElement({ tag: "a", classes: ["grant-remove"], dataset: { field: "nao-existe", index: "0" } }));
  await tick();
  assert.equal(suit.system.powers.length, 3);
});

function dropEvent(data) {
  return { preventDefault() {}, dataTransfer: { getData: () => (typeof data === "string" ? data : JSON.stringify(data)) } };
}

test("soltar um poder, traço ou tag na ficha da forma o põe na lista certa, com os dados do item", async () => {
  const actor = heroWithForms();
  const suit = actor.items.find((i) => i.name === "Armadura Mark III");
  const { sheet } = wireItem(suit);

  const power = new CONFIG.Item.documentClass({ name: "Escudo", type: "power", system: { powerSet: "Shield Bearer", cost: "10 de Foco" } });
  const trait = new CONFIG.Item.documentClass({ name: "Fearless", type: "trait" });
  const tag = new CONFIG.Item.documentClass({ name: "Heroic", type: "tag" });
  for (const [uuid, doc] of [["Item.a", power], ["Item.b", trait], ["Item.c", tag]]) sys.REGISTRY.set(uuid, doc);

  await sheet._onGrantDrop(dropEvent({ type: "Item", uuid: "Item.a" }));
  await sheet._onGrantDrop(dropEvent({ type: "Item", uuid: "Item.b" }));
  await sheet._onGrantDrop(dropEvent({ type: "Item", uuid: "Item.c" }));
  await sheet._onGrantDrop(dropEvent({ type: "Item", uuid: "Item.a" }));

  const dropped = suit.system.powers.find((p) => p.name === "Escudo");
  assert.equal(dropped.system.powerSet, "Shield Bearer");
  assert.equal(suit.system.powers.filter((p) => p.name === "Escudo").length, 1, "soltar de novo não repete");
  assert.ok(suit.system.traits.some((t) => t.name === "Fearless"));
  assert.ok(suit.system.tags.some((t) => t.name === "Heroic"));
});

test("soltar outra coisa na ficha da forma avisa e não muda nada", async () => {
  const actor = heroWithForms();
  const suit = actor.items.find((i) => i.name === "Armadura Mark III");
  const { sheet } = wireItem(suit);
  const weapon = new CONFIG.Item.documentClass({ name: "Escudo de Vibranium", type: "weapon" });
  sys.REGISTRY.set("Item.w", weapon);
  const before = JSON.stringify([suit.system.powers, suit.system.traits, suit.system.tags]);
  sys.notices.warn.length = 0;

  await sheet._onGrantDrop(dropEvent({ type: "Item", uuid: "Item.w" }));
  await sheet._onGrantDrop(dropEvent({ type: "Actor", uuid: "Actor.x" }));
  await sheet._onGrantDrop(dropEvent("isto não é json"));

  assert.deepEqual(sys.notices.warn, ["Só dá para soltar aqui poderes, traços e tags."]);
  assert.equal(JSON.stringify([suit.system.powers, suit.system.traits, suit.system.tags]), before);
});

test("o botão da ficha da forma liga e desliga o personagem", async () => {
  const actor = heroWithForms();
  const bestial = actor.items.find((i) => i.name === "Forma Bestial");
  const { root } = wireItem(bestial);
  click(root, new FakeElement({ tag: "button", classes: ["form-item-toggle"] }));
  await tick();
  await actor.setFormActive(bestial, true);
  assert.equal(bestial.system.active, true);
});

/* -------------------------------------------- */
/*  Ganchos e configuração                      */
/* -------------------------------------------- */

test("quais edições pedem para refazer uma forma ligada", () => {
  assert.equal(formChangeNeedsRefresh({ system: { rank: { value: 3 } } }), true);
  assert.equal(formChangeNeedsRefresh({ system: { powers: [] } }), true);
  assert.equal(formChangeNeedsRefresh({ name: "Novo nome" }), true);
  assert.equal(formChangeNeedsRefresh({ img: "x.png" }), true);
  assert.equal(formChangeNeedsRefresh({ system: { description: "<p>x</p>" } }), false);
  assert.equal(formChangeNeedsRefresh({ system: { restrictions: "x" } }), false);
  assert.equal(formChangeNeedsRefresh({ system: { active: true, activatedAt: 5 } }), false);
  assert.equal(formChangeNeedsRefresh({ sort: 3 }), false);
  assert.equal(formChangeNeedsRefresh(), false);
});

test("editar uma forma ligada refaz o efeito; desligada ou outro usuário, não", async () => {
  const actor = sampleCharacter();
  const [suit] = await actor.createEmbeddedDocuments("Item", [{ name: "Mark I", type: "form", system: { rank: { mode: "add", value: 1 } } }]);
  const changes = { system: { rank: { value: 3 } } };

  // Desligada: nada a refazer.
  assert.equal(await onUpdateForm(suit, changes, {}, game.user.id), false);

  await actor.setFormActive(suit, true);
  assert.equal(actor.system.attributes.rank.value, 3);
  await suit.update({ "system.rank.value": 3 }, { mmrpgSkipRefresh: true });

  assert.equal(await onUpdateForm(suit, changes, { mmrpgSkipRefresh: true }, game.user.id), false, "o próprio ajuste da forma não se repete");
  assert.equal(await onUpdateForm(suit, changes, {}, "outro-usuario"), false, "só refaz quem editou");
  assert.equal(await onUpdateForm(suit, { system: { description: "x" } }, {}, game.user.id), false, "descrição não muda nada");
  assert.equal(actor.system.attributes.rank.value, 3, "o efeito ainda é o antigo");

  assert.equal(await onUpdateForm(suit, changes, {}, game.user.id), true);
  assert.equal(actor.system.attributes.rank.value, 5);
  assert.equal(actor.effects.size, 1);

  const other = new CONFIG.Item.documentClass({ name: "Poder", type: "power" });
  assert.equal(await onUpdateForm(other, changes, {}, game.user.id), false);
});

test("a configuração do aviso no chat nasce ligada", () => {
  delete game.settings.values.announceForms;
  registerFormSettings();
  assert.equal(game.settings.values.announceForms, true);
});
