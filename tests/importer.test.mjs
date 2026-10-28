import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { loadSystem, sampleCharacter } from "./support/load-system.mjs";

const sys = await loadSystem();
const { parseContent, folderPath, importItems, importContent, addImportButton, CONTENT_FORMAT, ITEM_TYPES } = await import(
  "../module/helpers/importer.mjs"
);
const { MarvelMultiverseCharacterSheet, MarvelMultiverseItemSheet } = sys.sheets;

const pack = (items, extra = {}) => JSON.stringify({ format: CONTENT_FORMAT, version: 2, items, ...extra });
const file = (text, name = "conteudo.json") => ({ name, text: async () => text });

function reset() {
  game.items.clear();
  game.folders.clear();
  sys.notices.info.length = 0;
  sys.notices.error.length = 0;
  sys.notices.warn.length = 0;
  sys.dialogs.length = 0;
  sys.dialogAnswer.value = true;
}

/* -------------------------------------------- */
/*  Leitura do arquivo                          */
/* -------------------------------------------- */

test("arquivo que não é JSON é recusado com a mensagem de arquivo ilegível", () => {
  assert.throws(() => parseContent("{não é json"), (err) => err.i18n === "MARVEL_MULTIVERSE.Import.BadFile");
});

test("JSON de outro formato é recusado", () => {
  assert.throws(() => parseContent(JSON.stringify({ format: "outra-coisa", items: [] })), (err) => err.i18n === "MARVEL_MULTIVERSE.Import.NotContent");
  assert.throws(() => parseContent(JSON.stringify([1, 2])), (err) => err.i18n === "MARVEL_MULTIVERSE.Import.NotContent");
  assert.throws(() => parseContent("null"), (err) => err.i18n === "MARVEL_MULTIVERSE.Import.NotContent");
});

test("arquivo sem itens aproveitáveis é recusado", () => {
  assert.throws(() => parseContent(pack([])), (err) => err.i18n === "MARVEL_MULTIVERSE.Import.Empty");
  assert.throws(() => parseContent(pack([{ type: "power" }, { name: "x", type: "naoexiste" }])), (err) => err.i18n === "MARVEL_MULTIVERSE.Import.Empty");
});

test("itens inválidos são contados e os bons seguem", () => {
  const { items, skipped } = parseContent(
    pack([
      { type: "power", name: "  Raio  ", system: { cost: "5" } },
      { type: "naoexiste", name: "Ruim" },
      { type: "trait", name: "" },
      { type: "tag", name: "Herói", system: "texto solto" },
      { type: "tag", name: "Vilão" },
    ])
  );
  assert.deepEqual(
    items.map((i) => [i.type, i.name]),
    [
      ["power", "Raio"],
      ["tag", "Vilão"],
    ]
  );
  assert.equal(skipped, 3);
  assert.deepEqual(items[1].system, {}, "sem system vira objeto vazio");
});

test("o caminho de pastas vai da raiz ao tipo e às subpastas do arquivo", () => {
  const typeName = (t) => `tipo-${t}`;
  assert.deepEqual(folderPath({ type: "power", folder: "Magic/Chaos" }, "Raiz", typeName), ["Raiz", "tipo-power", "Magic", "Chaos"]);
  assert.deepEqual(folderPath({ type: "tag", folder: "" }, "Raiz", typeName), ["Raiz", "tipo-tag"]);
  assert.deepEqual(folderPath({ type: "item", folder: " A / / B " }, "Raiz", typeName), ["Raiz", "tipo-item", "A", "B"]);
});

/* -------------------------------------------- */
/*  Importação                                  */
/* -------------------------------------------- */

const mini = [
  { type: "power", name: "Raio", folder: "Elemental Control", system: { powerSet: "Elemental Control", cost: "5 de Foco" } },
  { type: "power", name: "Feitiço", folder: "Magic/Chaos", system: { powerSet: "Magic" } },
  { type: "trait", name: "Durão", system: { restriction: "x" } },
];

test("importa os itens, cria as pastas aninhadas e deixa cada item na sua pasta", async () => {
  reset();
  const result = await importItems(parseContent(pack(mini)).items);
  assert.deepEqual(result, { created: 3, skipped: 0 });

  const names = game.folders.contents.map((f) => f.name).sort();
  assert.deepEqual(names, ["Chaos", "Conteúdo MMRPG", "Elemental Control", "Magic", "Poderes", "Traços"]);

  const chaos = game.folders.find((f) => f.name === "Chaos");
  assert.equal(chaos.folder.name, "Magic");
  assert.equal(chaos.folder.folder.name, "Poderes");
  assert.equal(chaos.folder.folder.folder.name, "Conteúdo MMRPG");

  const raio = game.items.find((i) => i.name === "Raio");
  assert.equal(raio.folder.name, "Elemental Control");
  assert.equal(raio.system.cost, "5 de Foco");
  assert.equal(game.items.find((i) => i.name === "Feitiço").folder, chaos);
  assert.equal(game.items.find((i) => i.name === "Durão").folder.name, "Traços");
});

test("importar duas vezes não duplica itens nem pastas", async () => {
  reset();
  await importItems(parseContent(pack(mini)).items);
  const folders = game.folders.size;
  const second = await importItems(parseContent(pack(mini)).items);
  assert.deepEqual(second, { created: 0, skipped: 3 });
  assert.equal(game.items.size, 3);
  assert.equal(game.folders.size, folders);
});

test("formas (armaduras, formas alternativas, transformações) entram na pasta Formas, com o que concedem", async () => {
  reset();
  const form = {
    type: "form",
    name: "Armadura de Teste",
    folder: "Armaduras de Batalha/Perfil do Tony",
    system: {
      kind: "suit",
      rank: { mode: "set", value: 4 },
      changes: [{ key: "system.health.max", type: "add", value: "20", priority: null }],
      powers: [{ name: "Flight 2" }, { name: "Elemental Blast", note: "Energy" }],
      traits: [{ name: "Tech Reliance" }],
      tags: [{ name: "Extreme Appearance", note: "Flashy" }],
    },
  };
  assert.ok(ITEM_TYPES.includes("form"));
  const parsed = parseContent(pack([form]));
  assert.equal(parsed.skipped, 0);
  assert.deepEqual(await importItems(parsed.items), { created: 1, skipped: 0 });

  const item = game.items.find((i) => i.name === "Armadura de Teste");
  assert.equal(item.type, "form");
  assert.equal(item.system.kind, "suit");
  assert.equal(item.system.active, false);
  assert.deepEqual(item.system.rank.toObject?.() ?? item.system.rank, { mode: "set", value: 4 });
  assert.equal(item.system.powers.length, 2);
  assert.equal(item.folder.name, "Perfil do Tony");
  assert.equal(item.folder.folder.name, "Armaduras de Batalha");
  assert.equal(item.folder.folder.folder.name, "Formas");
  assert.equal(item.folder.folder.folder.folder.name, "Conteúdo MMRPG");
});

test("o fluxo completo pergunta antes, importa e avisa o resultado", async () => {
  reset();
  const result = await importContent({ file: file(pack(mini), "meu-grupo.json") });
  assert.deepEqual(result, { created: 3, skipped: 0 });
  assert.equal(sys.dialogs.length, 1);
  assert.match(sys.dialogs[0].content, /Importar 3 itens de "meu-grupo\.json"/);
  assert.deepEqual(sys.notices.info, ["Importando conteúdo... pode levar um instante.", "Importação concluída: 3 criados, 0 ignorados."]);
});

test("se o Narrador recusar, nada é criado", async () => {
  reset();
  sys.dialogAnswer.value = false;
  assert.equal(await importContent({ file: file(pack(mini)) }), null);
  assert.equal(game.items.size, 0);
  assert.equal(game.folders.size, 0);
});

test("arquivo ruim mostra erro e não pergunta nada", async () => {
  reset();
  assert.equal(await importContent({ file: file("isto não é json") }), null);
  assert.equal(sys.dialogs.length, 0);
  assert.equal(sys.notices.error.length, 1);
  assert.match(sys.notices.error[0], /Não foi possível ler o arquivo/);

  assert.equal(await importContent({ file: file(JSON.stringify({ format: "x", items: [] })) }), null);
  assert.equal(sys.notices.error.at(-1), "Este arquivo não é um arquivo de conteúdo deste sistema.");
});

test("só o Narrador importa", async () => {
  reset();
  game.user.isGM = false;
  try {
    assert.equal(await importContent({ file: file(pack(mini)) }), null);
    assert.deepEqual(sys.notices.warn, ["Só o Narrador pode importar conteúdo."]);
    assert.equal(game.items.size, 0);
  } finally {
    game.user.isGM = true;
  }
});

test("o nome do arquivo é escapado na pergunta", async () => {
  reset();
  await importContent({ file: file(pack(mini), '<img src=x onerror="alert(1)">.json') });
  assert.ok(!sys.dialogs[0].content.includes("<img"));
});

/* -------------------------------------------- */
/*  Botão na aba Itens                          */
/* -------------------------------------------- */

function fakeDirectory({ withActions = true } = {}) {
  const made = [];
  globalThis.document = {
    createElement: () => {
      const el = {
        classList: { list: [], add(c) { this.list.push(c); } },
        innerHTML: "",
        listeners: {},
        addEventListener(type, fn) { this.listeners[type] = fn; },
        set type(v) { this._type = v; },
      };
      made.push(el);
      return el;
    },
  };
  const actions = { children: [], append(el) { this.children.push(el); } };
  const root = {
    querySelector: (selector) => {
      if (selector === ".mmrpg-import") return actions.children.find((c) => c.classList.list.includes("mmrpg-import")) ?? null;
      if (selector === ".header-actions") return withActions ? actions : null;
      return null;
    },
    prepend(el) { actions.children.unshift(el); },
  };
  return { root, actions, made };
}

test("o Narrador vê o botão de importar e ele não aparece duas vezes", () => {
  const { root, actions } = fakeDirectory();
  addImportButton({}, root);
  addImportButton({}, root);
  assert.equal(actions.children.length, 1);
  assert.match(actions.children[0].innerHTML, /Importar conteúdo/);
  assert.ok(actions.children[0].classList.list.includes("mmrpg-import"));
});

test("jogadores não veem o botão", () => {
  const { root, actions } = fakeDirectory();
  game.user.isGM = false;
  try {
    addImportButton({}, root);
    assert.equal(actions.children.length, 0);
  } finally {
    game.user.isGM = true;
  }
});

test("sem a área de ações conhecida o botão ainda entra na janela", () => {
  const { root, actions } = fakeDirectory({ withActions: false });
  addImportButton({}, root);
  assert.equal(actions.children.length, 1);
});

/* -------------------------------------------- */
/*  Origens e ocupações com notas               */
/* -------------------------------------------- */

test("a nota da concessão entra no nome do item criado", async () => {
  reset();
  game.items.set("w1", new CONFIG.Item.documentClass({ name: "Connections", type: "trait", system: { description: "<p>contatos</p>", multiple: true } }));
  const actor = sampleCharacter();
  const sheet = new MarvelMultiverseCharacterSheet(actor);
  await sheet._grantItems([{ name: "Connections", note: "Criminal" }, { name: "Connections", note: "Police" }, { name: "Fearless" }], "trait");
  const names = actor.items.contents.map((i) => i.name).sort();
  assert.deepEqual(names, ["Connections (Criminal)", "Connections (Police)", "Fearless"]);
  assert.equal(actor.items.find((i) => i.name === "Connections (Police)").system.description, "<p>contatos</p>");
});

test("soltar a mesma origem de novo não repete as concessões com nota", async () => {
  reset();
  const actor = sampleCharacter();
  const sheet = new MarvelMultiverseCharacterSheet(actor);
  const origin = { name: "Vampiro", type: "origin", system: { traits: [{ name: "Weakness", note: "Silver/Wood" }] } };
  await sheet._onDropItemCreate(structuredClone(origin), {});
  await sheet._onDropItemCreate(structuredClone(origin), {});
  assert.deepEqual(actor.items.contents.map((i) => i.name).sort(), ["Vampiro", "Weakness (Silver/Wood)"]);
});

test("a ficha da origem mostra as concessões com a nota", () => {
  const item = new CONFIG.Item.documentClass({
    name: "Vampiro",
    type: "origin",
    system: { traits: [{ name: "Weakness", note: "Silver" }, { name: "Monster" }], tags: ["Deceased"] },
  });
  const sheet = new MarvelMultiverseItemSheet(item);
  const context = sheet.getData();
  const byKey = Object.fromEntries(context.grants.map((g) => [g.key, g.text]));
  assert.equal(byKey.traits, "Weakness (Silver), Monster");
  assert.equal(byKey.tags, "Deceased");
  assert.equal(byKey.powers, undefined);
});

/* -------------------------------------------- */
/*  Conteúdo real do grupo (só roda onde o arquivo existe)  */
/* -------------------------------------------- */

const REAL = process.env.MMRPG_CONTEUDO ?? new URL("../../mmrpg-privado/conteudo-mmrpg.privado.json", import.meta.url).pathname;
const hasReal = existsSync(REAL);

test("o conteúdo privado do grupo é aceito pelo sistema", { skip: !hasReal && "arquivo privado não está nesta máquina" }, async () => {
  reset();
  const text = readFileSync(REAL, "utf8");
  const parsed = parseContent(text);
  assert.equal(parsed.skipped, 0, "nenhum item inválido");
  assert.ok(parsed.items.every((i) => ITEM_TYPES.includes(i.type)));

  const cfg = CONFIG.MARVEL_MULTIVERSE;
  const setLabels = new Set(Object.values(cfg.powersets).map((s) => s.label));
  const abilities = new Set(Object.keys(cfg.abilities));

  // Cada item vira um documento válido.
  for (const entry of parsed.items) {
    const doc = new CONFIG.Item.documentClass({ name: entry.name, type: entry.type, system: entry.system });
    assert.equal(doc.name, entry.name);
    if (entry.type === "power") {
      assert.ok(setLabels.has(doc.system.powerSet), `${entry.name}: conjunto ${doc.system.powerSet}`);
      if (doc.system.ability) assert.ok(abilities.has(doc.system.ability), `${entry.name}: atributo ${doc.system.ability}`);
      if (doc.system.attackTarget) assert.ok(abilities.has(doc.system.attackTarget), `${entry.name}: alvo ${doc.system.attackTarget}`);
      if (doc.system.damageType) assert.ok(doc.system.damageType in cfg.damageTypes, `${entry.name}: dano ${doc.system.damageType}`);
      assert.ok(["", "ranged", "close"].includes(doc.system.attackKind), entry.name);
      assert.ok(["", "edge", "trouble", "normal"].includes(doc.system.attackEdgeMode), entry.name);
    }
  }

  // Tudo o que origens e ocupações concedem existe no arquivo (senão a ficha criaria um item vazio).
  const have = new Set(parsed.items.map((i) => `${i.type}:${i.name}`));
  const missing = [];
  for (const entry of parsed.items.filter((i) => ["origin", "occupation"].includes(i.type))) {
    for (const [field, type] of [["tags", "tag"], ["traits", "trait"], ["powers", "power"]]) {
      for (const grant of entry.system[field] ?? []) {
        if (!have.has(`${type}:${grant.name}`)) missing.push(`${entry.name} -> ${type}:${grant.name}`);
      }
    }
  }
  assert.deepEqual(missing, [], "concessões sem item correspondente");

  // Formas: o que concedem existe no arquivo, salvo itens que o resumo do grupo não traz.
  const KNOWN_ABSENT = new Set(["power:Salvation", "power:Summonable", "power:Mysterium", "power:Iconic Item", "power:Warp Portal", "trait:Symbiotic Spider-Blinder"]);
  const forms = parsed.items.filter((i) => i.type === "form");
  assert.ok(forms.length > 0, "o arquivo tem formas");
  const absent = new Set();
  for (const entry of forms) {
    for (const [field, type] of [["tags", "tag"], ["traits", "trait"], ["powers", "power"]]) {
      for (const grant of entry.system[field] ?? []) {
        if (!have.has(`${type}:${grant.name}`) && !KNOWN_ABSENT.has(`${type}:${grant.name}`)) absent.add(`${entry.name} -> ${type}:${grant.name}`);
      }
    }
  }
  assert.deepEqual([...absent], [], "formas concedem itens que não existem no arquivo");

  // Nomes não se repetem dentro do mesmo tipo.
  const seen = new Set();
  for (const i of parsed.items) {
    const key = `${i.type}:${i.name}:${i.folder}`;
    assert.ok(!seen.has(key), `repetido: ${key}`);
    seen.add(key);
  }

  // E a importação inteira funciona de ponta a ponta.
  const result = await importItems(parsed.items);
  assert.equal(result.created, parsed.items.length);
  assert.equal(game.items.size, parsed.items.length);

  // Cada forma liga e desliga numa ficha sem erro, e desligar devolve o personagem ao que era.
  const hero = sampleCharacter();
  const formKinds = new Set();
  for (const entry of forms) {
    const [form] = await hero.createEmbeddedDocuments("Item", [{ name: entry.name, type: "form", system: structuredClone(entry.system) }]);
    formKinds.add(form.system.kind);
    assert.ok(["suit", "alternate", "transformation"].includes(form.system.kind), `${entry.name}: categoria ${form.system.kind}`);
    assert.ok(["none", "set", "add"].includes(form.system.rank.mode), `${entry.name}: Rank ${form.system.rank.mode}`);

    const rankBefore = hero.system.attributes.rank.value;
    assert.equal(await hero.setFormActive(form, true, { announce: false }), true, entry.name);
    assert.equal(form.system.active, true);
    if (form.system.rank.mode === "set") assert.ok(hero.system.attributes.rank.value >= form.system.rank.value, `${entry.name}: Rank`);
    if (form.system.rank.mode === "add") assert.equal(hero.system.attributes.rank.value, rankBefore + form.system.rank.value, `${entry.name}: Rank somado`);
    for (const change of form.system.changes) assert.notEqual(foundry.utils.getProperty(hero, change.key), undefined, `${entry.name}: ${change.key}`);

    await hero.setFormActive(form, false, { announce: false });
    assert.equal(hero.system.attributes.rank.value, rankBefore, `${entry.name}: Rank volta`);
    assert.equal(hero.effects.size, 0, `${entry.name}: efeito sai`);
    assert.deepEqual([...new Set(hero.items.map((i) => i.type))], ["form"], `${entry.name}: concessões saem`);
    await hero.deleteEmbeddedDocuments("Item", [form.id]);
  }
  assert.deepEqual([...formKinds].sort(), ["alternate", "suit", "transformation"], "as três categorias aparecem no conteúdo");

  // Soltar uma origem com concessões numa ficha cria tudo com o texto do conteúdo importado.
  const vampire = game.items.find((i) => i.type === "origin" && i.name === "Monstrous: Vampire");
  if (vampire) {
    const actor = sampleCharacter();
    const sheet = new MarvelMultiverseCharacterSheet(actor);
    await sheet._onDropItemCreate(vampire.toObject ? vampire.toObject() : { name: vampire.name, type: "origin", system: vampire.system }, {});
    const created = actor.items.contents.map((i) => `${i.type}:${i.name}`);
    assert.ok(created.includes("trait:Weakness (Silver/Wood)"), created.join(", "));
    const weakness = actor.items.find((i) => i.name === "Weakness (Silver/Wood)");
    assert.ok(weakness.system.description.length > 20, "veio com a descrição do conteúdo");
  }
});
