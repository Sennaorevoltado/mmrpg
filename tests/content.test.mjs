import test from "node:test";
import assert from "node:assert/strict";
import {
  parseContent,
  countByType,
  buildContentFile,
  resolveGrants,
  contentKey,
  CONTENT_FORMAT
} from "../module/helpers/content-format.mjs";

const file = (items, extra = {}) => ({ format: CONTENT_FORMAT, version: 1, items, ...extra });

test("aceita um arquivo válido e normaliza pastas", () => {
  const r = parseContent(
    file([{ type: "power", name: "  Rajada  ", folder: "Poderes / Teste", system: { powerSet: "basic" } }])
  );
  assert.deepEqual(r.errors, []);
  assert.equal(r.items.length, 1);
  assert.equal(r.items[0].name, "Rajada");
  assert.deepEqual(r.items[0].folder, ["Poderes", "Teste"]);
  assert.equal(r.items[0].key, "power:rajada");
});

test("lê JSON em texto e recusa JSON quebrado", () => {
  assert.equal(parseContent(JSON.stringify(file([]))).errors.length, 0);
  assert.match(parseContent("{ nao eh json").errors[0], /JSON inválido/);
});

test("recusa formato, versão e estrutura inválidos", () => {
  assert.match(parseContent({ format: "outro", items: [] }).errors[0], /Formato desconhecido/);
  assert.match(parseContent({ format: CONTENT_FORMAT, version: 99, items: [] }).errors[0], /versão 99/);
  assert.match(parseContent({ format: CONTENT_FORMAT, version: 1, items: {} }).errors[0], /lista/);
  assert.match(parseContent([]).errors[0], /objeto/);
});

test("aponta itens inválidos sem derrubar os válidos", () => {
  const r = parseContent(
    file([
      { type: "dragao", name: "X" },
      { type: "trait", name: "" },
      { type: "trait", name: "Bom", system: [] },
      { type: "power", name: "Ok", system: { actions: "nao" } },
      { type: "origin", name: "O", system: { grants: [{ foo: 1 }] } },
      { type: "tag", name: "Válido" }
    ])
  );
  assert.equal(r.errors.length, 5);
  assert.equal(r.items.length, 1);
  assert.equal(r.items[0].name, "Válido");
});

test("repetidos: o último vale e há aviso", () => {
  const r = parseContent(
    file([
      { type: "trait", name: "A", system: { restriction: "um" } },
      { type: "trait", name: "a", system: { restriction: "dois" } }
    ])
  );
  assert.equal(r.items.length, 1);
  assert.equal(r.items[0].system.restriction, "dois");
  assert.equal(r.warnings.length, 1);
});

test("countByType e buildContentFile fazem o caminho de volta", () => {
  const parsed = parseContent(
    file([
      { type: "power", name: "P", folder: "A/B", system: {} },
      { type: "trait", name: "T", system: {} },
      { type: "trait", name: "U", system: {} }
    ])
  );
  assert.deepEqual(countByType(parsed.items), { power: 1, trait: 2 });
  const out = buildContentFile(parsed.items, { source: "meu" });
  assert.equal(out.format, CONTENT_FORMAT);
  assert.equal(out.items[0].folder, "A/B");
  assert.equal(parseContent(out).items.length, 3);
});

test("resolveGrants liga por tipo e nome e lista o que falta", () => {
  const known = { "trait:forte": { uuid: "Item.1", name: "Forte", type: "trait" } };
  const lookup = (type, name) => known[contentKey(type, name)] ?? null;
  const r = resolveGrants(
    [
      { type: "trait", name: "Forte" },
      { type: "tag", name: "Faltando" },
      { uuid: "Item.9", name: "Já ligado", type: "power" }
    ],
    lookup
  );
  assert.equal(r.grants[0].uuid, "Item.1");
  assert.equal(r.grants[1].uuid, "");
  assert.equal(r.grants[2].uuid, "Item.9");
  assert.deepEqual(r.unresolved, ["tag:Faltando"]);
});

test("ações importadas ganham ids estáveis e começam com todos os usos", () => {
  const input = file([
    {
      type: "power",
      name: "Rajada",
      system: {
        actions: [
          { uses: { max: 3 }, effects: [{ status: "slowed" }, { id: "meu", status: "dazed" }] },
          { id: "fixa", uses: { max: 2, value: 1 } }
        ]
      }
    }
  ]);
  const a = parseContent(input).items[0].system.actions;
  const b = parseContent(input).items[0].system.actions;
  assert.equal(a[0].id, "a1");
  assert.equal(a[0].uses.value, 3);
  assert.equal(a[0].effects[0].id, "a1-e1");
  assert.equal(a[0].effects[1].id, "meu");
  assert.equal(a[1].id, "fixa");
  assert.equal(a[1].uses.value, 1);
  assert.deepEqual(a, b);
});

test("ação que não é objeto é recusada", () => {
  const r = parseContent(file([{ type: "power", name: "X", system: { actions: ["texto"] } }]));
  assert.equal(r.items.length, 0);
  assert.equal(r.errors.length, 1);
});

test("resolveGrants preserva a observação da concessão", () => {
  const known = { Connections: "Item.c", Rich: "Item.r" };
  const lookup = (type, name) => (known[name] ? { uuid: known[name], name, type } : null);
  const { grants, unresolved } = resolveGrants(
    [
      { type: "trait", name: "Connections", note: " Criminal " },
      { type: "trait", name: "Connections", note: "Police" },
      { type: "trait", name: "Inexistente", note: "x" },
      { type: "tag", name: "Rich" }
    ],
    lookup
  );
  assert.deepEqual(grants.map((g) => g.note), ["Criminal", "Police", "x", ""]);
  assert.deepEqual(unresolved, ["trait:Inexistente"]);
  assert.equal(grants[0].uuid, grants[1].uuid, "o mesmo item serve a duas observações");
});

test("efeitos passivos do item: validação e valores padrão", () => {
  const file = (effects) => ({
    format: "mmrpg-content",
    version: 1,
    items: [{ type: "power", name: "Mighty Teste", effects }]
  });

  const ok = parseContent(file([{ changes: [{ key: "system.abilities.mle.multiplierBonus", type: "upgrade", value: 2 }, { key: "system.health.reduction", value: "1" }] }]));
  assert.deepEqual(ok.errors, []);
  const [item] = ok.items;
  assert.equal(item.effects.length, 1);
  assert.equal(item.effects[0].transfer, true, "efeito do item transfere ao ator por padrão");
  assert.equal(item.effects[0].disabled, false);
  assert.deepEqual(item.effects[0].changes, [
    { key: "system.abilities.mle.multiplierBonus", type: "upgrade", value: "2" },
    { key: "system.health.reduction", type: "add", value: "1" }
  ]);

  const semEfeitos = parseContent({ format: "mmrpg-content", version: 1, items: [{ type: "power", name: "Sem Efeitos" }] });
  assert.equal(semEfeitos.items[0].effects, undefined, "sem o campo, nada é enviado (a atualização não apaga efeitos)");

  for (const bad of [
    "texto",
    [42],
    [{ changes: "x" }],
    [{ changes: [{ type: "add", value: 1 }] }],
    [{ changes: [{ key: "a", type: "mágico", value: 1 }] }],
    [{ changes: [{ key: "a", type: "add" }] }]
  ]) {
    const r = parseContent(file(bad));
    assert.equal(r.items.length, 0, JSON.stringify(bad));
    assert.equal(r.errors.length, 1, JSON.stringify(bad));
  }
});

