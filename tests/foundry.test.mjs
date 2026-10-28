/**
 * Testes de integração com o Foundry SIMULADO (tests/support/foundry-stub.mjs).
 *
 * Provam que o sistema carrega, que os modelos de dados são válidos, que a ficha monta o
 * contexto e renderiza sem dado ausente, e que os botões fazem o que prometem. Não substituem
 * um teste num mundo do Foundry de verdade.
 */

import test from "node:test";
import assert from "node:assert/strict";
import { installFoundry } from "./support/foundry-stub.mjs";

const env = installFoundry();
await import("../module/mmrpg.mjs");
await Hooks.callAll("init");
await Hooks.callAll("ready");

const { MMRPG } = await import("../module/config.mjs");
const { CharacterSheet, NpcSheet } = await import("../module/apps/actor-sheet.mjs");
const BudgetConfig = (await import("../module/apps/budget-config.mjs")).default;
const compat = await import("../module/helpers/compat.mjs");
const appearance = await import("../module/helpers/appearance.mjs");
const { getBudgetTable } = await import("../module/helpers/budget.mjs");
const { DEFAULT_BUDGET, normalizeBudgetTable } = await import("../module/rules/index.mjs");

/** Falha se o HTML tem sinais de dado ausente ou helper quebrado. */
function assertClean(html, label) {
  assert.equal(typeof html, "string", `${label}: sem HTML`);
  assert.ok(html.length > 50, `${label}: HTML curto demais`);
  for (const bad of ["undefined", "[object", "NaN", "{{", "null"]) {
    assert.ok(!html.includes(bad), `${label}: contém "${bad}"`);
  }
}

const sheetFor = (SheetClass, document) => new SheetClass({ document });
const render = (SheetClass, document) => sheetFor(SheetClass, document).renderToString();

/** Chama uma ação da ficha como o Foundry chamaria (this = ficha). */
function act(sheet, name, dataset = {}) {
  const handler = sheet.constructor.DEFAULT_OPTIONS.actions[name];
  assert.equal(typeof handler, "function", `ação ${name} registrada`);
  return handler.call(sheet, { type: "click" }, { dataset });
}

const reset = () => {
  env.settings.set(MMRPG.id, "budget", normalizeBudgetTable(DEFAULT_BUDGET));
  env.settings.set(MMRPG.id, "strictBudget", false);
};

const hero = (system = {}, name = "Homem-Aranha") => Actor.create({ name, type: "character", system });

/* -------------------------------------------- */

test("hook init registra modelos, fichas, configurações e menu", () => {
  assert.equal(CONFIG.MMRPG, MMRPG);
  assert.deepEqual(Object.keys(CONFIG.Actor.dataModels).sort(), ["character", "npc"]);
  const ours = env.registeredSheets.filter((s) => s.scope === "mmrpg");
  assert.equal(ours.length, 2);
  assert.deepEqual(ours.map((s) => s.opts.types[0]).sort(), ["character", "npc"]);
  assert.ok(ours.every((s) => s.opts.makeDefault));
  for (const key of ["budget", "strictBudget", "uiTheme", "uiTextSize"]) {
    assert.ok(env.settings.settings.has(`mmrpg.${key}`), `configuração ${key}`);
  }
  assert.ok(env.settings.menus.has("mmrpg.budgetConfig"));
  assert.equal(env.settings.settings.get("mmrpg.budget").scope, "world");
  assert.equal(env.settings.settings.get("mmrpg.uiTheme").scope, "client");
  assert.equal(env.settings.settings.get("mmrpg.uiTextSize").scope, "client");
  assert.ok(game.mmrpg.config);
});

test(`fichas registradas pela API da v${env.generation}`, () => {
  assert.equal(compat.foundryGeneration(), env.generation);
  const ours = env.registeredSheets.filter((s) => s.scope === "mmrpg");
  assert.ok(ours.every((s) => s.via === (env.generation >= 14 ? "collection" : "config")));
  assert.deepEqual(env.deprecatedSheetCalls, [], "nenhuma chamada à API antiga em versão que a recusa");
});

test("o sistema só declara os tipos que registra", async () => {
  const fs = await import("node:fs");
  const manifest = JSON.parse(fs.readFileSync(new URL("../system.json", import.meta.url), "utf8"));
  assert.deepEqual(Object.keys(manifest.documentTypes.Actor).sort(), Object.keys(CONFIG.Actor.dataModels).sort());
  assert.equal(manifest.documentTypes.Item, undefined);
});

/* -------------------------------------------- */

test("personagem novo: Rank 1, atributos em 0, Saúde e Foco 10, modo criação", async () => {
  const a = await Actor.create({ name: "Novo", type: "character" });
  assert.equal(a.system.rank, 1);
  for (const key of MMRPG.abilities) {
    assert.equal(a.system.abilities[key].value, 0, key);
    assert.equal(a.system.abilities[key].defense, 10, `defesa ${key}`);
    assert.equal(a.system.abilities[key].noncom, 0, `fora de combate ${key}`);
  }
  assert.deepEqual({ ...a.system.health }, { value: 10, max: 10 });
  assert.deepEqual({ ...a.system.focus }, { value: 10, max: 10 });
  assert.deepEqual({ ...a.system.karma }, { value: 0, max: 0 });
  assert.equal(a.system.creation.free, false);
  assert.equal(a.system.creation.bonusPoints, 0);
  assert.equal(a.system.creation.bonusCap, 0);
  assert.equal(a.system.details.realName, "");
});

test("NPC nasce no modo livre", async () => {
  const npc = await Actor.create({ name: "Rhino", type: "npc" });
  assert.equal(npc.system.creation.free, true);
});

test("dados derivados seguem as regras: Defesa = 10 + pontuação; fora de combate = pontuação", async () => {
  const a = await hero({ abilities: { mle: { value: 3 }, res: { value: -2 } } });
  assert.equal(a.system.abilities.mle.defense, 13);
  assert.equal(a.system.abilities.mle.noncom, 3);
  assert.equal(a.system.abilities.res.defense, 8);
  assert.equal(a.system.abilities.res.noncom, -2);
});

test("todos os modelos de dados têm valores iniciais válidos; Rank fora de 1 a 6 não é", async () => {
  for (const type of Object.keys(CONFIG.Actor.dataModels)) {
    const actor = await Actor.create({ name: `Teste ${type}`, type });
    assert.deepEqual(actor.system.validate(), [], `ator ${type}`);
  }
  for (const rank of [0, 7]) {
    const bad = await Actor.create({ name: "Rank ruim", type: "character", system: { rank } });
    assert.notDeepEqual(bad.system.validate(), [], `Rank ${rank} deveria falhar`);
  }
});

/* -------------------------------------------- */

test("ficha de personagem renderiza sem dado ausente, em todos os estados", async () => {
  reset();
  const open = await hero({ abilities: { mle: { value: 2 }, agl: { value: 1 } } });
  const done = await hero({ abilities: { mle: { value: 2 }, agl: { value: 3 } } });
  const over = await hero({ abilities: { mle: { value: 5 }, agl: { value: 2 } } });
  const undef = await hero({ rank: 3, abilities: { mle: { value: 3 } } });
  const free = await hero({ creation: { free: true }, abilities: { res: { value: -1 } } });
  for (const [label, actor] of Object.entries({ open, done, over, undef, free })) {
    assertClean(await render(CharacterSheet, actor), `ficha ${label}`);
  }
  assert.equal(env.missingKeys.size, 0, `chaves de idioma ausentes: ${[...env.missingKeys]}`);

  const htmlOpen = await render(CharacterSheet, open);
  assert.ok(htmlOpen.includes('value="Homem-Aranha"'), "codinome");
  assert.match(htmlOpen, /data-status="open"/);
  assert.match(htmlOpen, /<b>2<\/b><span>pontos restantes<\/span>/);
  assert.match(htmlOpen, /Teto por atributo<\/span>\s*<b>4<\/b>/);
  assert.ok(htmlOpen.includes('data-action="setMode"'), "botões de modo");
  assert.ok(htmlOpen.includes('name="system.creation.bonusPoints"'), "ajustes manuais no modo criação");

  assert.match(await render(CharacterSheet, done), /data-status="done"/);
  const htmlOver = await render(CharacterSheet, over);
  assert.match(htmlOver, /data-status="over"/);
  assert.match(htmlOver, /<b>2<\/b><span>pontos a mais<\/span>/);
  assert.ok(htmlOver.includes("Acima do teto de 4: Corpo a Corpo."));
  assert.match(htmlOver, /mm-ability-row is-over" data-ability="mle"/);

  const htmlUndef = await render(CharacterSheet, undef);
  assert.match(htmlUndef, /data-status="unset"/);
  assert.ok(htmlUndef.includes("O orçamento do Rank 3 ainda não foi definido."));
  assert.ok(htmlUndef.includes('data-action="openBudget"'), "o Narrador vê o botão de definir");

  const htmlFree = await render(CharacterSheet, free);
  assert.ok(!htmlFree.includes("mm-status"), "modo livre não mostra pontos");
  assert.ok(!htmlFree.includes("mm-adjust"), "modo livre não mostra ajustes");
  assert.ok(htmlFree.includes('value="-1"'));
});

test("jogador (não Narrador) vê o aviso em vez do botão de definir orçamento", async () => {
  reset();
  const a = await hero({ rank: 2 });
  game.user.isGM = false;
  try {
    const html = await render(CharacterSheet, a);
    assert.ok(!html.includes('data-action="openBudget"'));
    assert.ok(html.includes("Peça ao Narrador para defini-lo."));
  } finally {
    game.user.isGM = true;
  }
});

test("ficha de NPC renderiza e não oferece troca de modo nem contadores", async () => {
  const npc = await Actor.create({ name: "Rhino", type: "npc", system: { rank: 5, abilities: { mle: { value: 7 } } } });
  const html = await render(NpcSheet, npc);
  assertClean(html, "ficha de NPC");
  assert.ok(!html.includes("setMode"));
  assert.ok(!html.includes("mm-status"));
  assert.ok(html.includes('value="7"'));
});

test("barra fixa: atributos, Saúde, Foco e Karma com valor e máximo editáveis", async () => {
  const a = await hero({ health: { value: 7, max: 12 }, karma: { value: 2, max: 5 }, abilities: { vig: { value: 3 } } });
  const html = await render(CharacterSheet, a);
  for (const name of ["system.health.value", "system.health.max", "system.focus.value", "system.focus.max", "system.karma.value", "system.karma.max", "system.rank", "system.details.realName", "name"]) {
    assert.ok(html.includes(`name="${name}"`), `campo ${name}`);
  }
  assert.match(html, /<abbr>VIG<\/abbr><b>3<\/b>/);
  assert.match(html, /<option value="1" selected>1<\/option>/);
  assert.equal([...html.matchAll(/<option value=/g)].length, 6, "Rank de 1 a 6");
});

test("a ficha tem duas partes: barra e corpo (que rola)", () => {
  assert.deepEqual(Object.keys(CharacterSheet.PARTS), ["bar", "body"]);
  assert.deepEqual(CharacterSheet.PARTS.body.scrollable, [""]);
});

/* -------------------------------------------- */

test("botões −/+: mudam a pontuação, param em 0 e respeitam a trava", async () => {
  reset();
  const a = await hero({ abilities: { mle: { value: 1 } } });
  const sheet = sheetFor(CharacterSheet, a);

  await act(sheet, "adjustAbility", { ability: "mle", delta: "1" });
  assert.equal(a.system.abilities.mle.value, 2);
  await act(sheet, "adjustAbility", { ability: "mle", delta: "-1" });
  await act(sheet, "adjustAbility", { ability: "mle", delta: "-1" });
  assert.equal(a.system.abilities.mle.value, 0);
  await act(sheet, "adjustAbility", { ability: "mle", delta: "-1" });
  assert.equal(a.system.abilities.mle.value, 0, "− para em 0 no modo criação");

  // Sem trava: passa do teto (a ficha só avisa).
  for (let i = 0; i < 6; i++) await act(sheet, "adjustAbility", { ability: "mle", delta: "1" });
  assert.equal(a.system.abilities.mle.value, 6);

  // Com trava: para no teto.
  env.settings.set(MMRPG.id, "strictBudget", true);
  await act(sheet, "adjustAbility", { ability: "agl", delta: "1" });
  assert.equal(a.system.abilities.agl.value, 0, "pontos já estourados: + bloqueado");

  const b = await hero({ abilities: { mle: { value: 3 } } });
  const sb = sheetFor(CharacterSheet, b);
  await act(sb, "adjustAbility", { ability: "mle", delta: "1" });
  assert.equal(b.system.abilities.mle.value, 4);
  await act(sb, "adjustAbility", { ability: "mle", delta: "1" });
  assert.equal(b.system.abilities.mle.value, 4, "teto 4");
  reset();
});

test("botões desabilitados no HTML quando o passo não vale", async () => {
  reset();
  const a = await hero({ abilities: { mle: { value: 4 } } });
  env.settings.set(MMRPG.id, "strictBudget", true);
  const html = await render(CharacterSheet, a);
  const row = (key) => html.match(new RegExp(`data-ability="${key}">[\\s\\S]*?</li>`))[0];
  assert.match(row("mle"), /data-delta="1"[^>]*disabled/, "+ desabilitado no teto");
  assert.doesNotMatch(row("mle"), /data-delta="-1"[^>]*disabled/);
  assert.match(row("agl"), /data-delta="-1"[^>]*disabled/, "− desabilitado em 0");
  reset();
});

test("ação ignora atributo inválido e ficha sem permissão", async () => {
  const a = await hero({});
  const sheet = sheetFor(CharacterSheet, a);
  await act(sheet, "adjustAbility", { ability: "xyz", delta: "1" });
  assert.deepEqual(Object.values(a.system.abilities).map((x) => x.value), [0, 0, 0, 0, 0, 0]);
  Object.defineProperty(sheet, "isEditable", { get: () => false });
  await act(sheet, "adjustAbility", { ability: "mle", delta: "1" });
  assert.equal(a.system.abilities.mle.value, 0);
  await act(sheet, "setMode", { mode: "free" });
  assert.equal(a.system.creation.free, false);
});

test("modo livre: − desce abaixo de 0 e o modo é gravado na ficha", async () => {
  const a = await hero({});
  const sheet = sheetFor(CharacterSheet, a);
  await act(sheet, "setMode", { mode: "free" });
  assert.equal(a.system.creation.free, true);
  await act(sheet, "adjustAbility", { ability: "res", delta: "-1" });
  assert.equal(a.system.abilities.res.value, -1);
  await act(sheet, "setMode", { mode: "guided" });
  assert.equal(a.system.creation.free, false);
  await act(sheet, "setMode", { mode: "guided" });
  assert.equal(a.system.creation.free, false, "repetir o mesmo modo não muda nada");
});

test("NPC ignora a troca de modo", async () => {
  const npc = await Actor.create({ name: "Rhino", type: "npc" });
  await act(sheetFor(NpcSheet, npc), "setMode", { mode: "guided" });
  assert.equal(npc.system.creation.free, true);
});

/* -------------------------------------------- */

test("orçamento do Narrador: a ficha usa a tabela salva", async () => {
  reset();
  env.settings.set(MMRPG.id, "budget", normalizeBudgetTable({ 3: { points: 8, cap: 5 } }));
  assert.deepEqual(getBudgetTable()[3], { points: 8, cap: 5 });
  const a = await hero({ rank: 3, abilities: { mle: { value: 3 }, agl: { value: 2 } } });
  const html = await render(CharacterSheet, a);
  assert.match(html, /data-status="open"/);
  assert.match(html, /<b>3<\/b><span>pontos restantes<\/span>/);
  assert.match(html, /Teto por atributo<\/span>\s*<b>5<\/b>/);
  reset();
});

test("tabela salva com erro cai no padrão em vez de quebrar a ficha", () => {
  const original = game.settings.get;
  game.settings.get = () => { throw new Error("falha"); };
  try {
    assert.deepEqual(getBudgetTable()[1], { points: 5, cap: 4 });
  } finally {
    game.settings.get = original;
  }
});

test("janela de orçamento: mostra os seis Ranks, salva e restaura", async () => {
  reset();
  const app = new BudgetConfig();
  const html = await app.renderToString();
  assertClean(html, "janela de orçamento");
  assert.equal([...html.matchAll(/name="points-\d"/g)].length, 6);
  assert.equal([...html.matchAll(/name="cap-\d"/g)].length, 6);
  assert.ok(html.includes('name="points-1" value="5"'));
  assert.ok(html.includes('name="cap-1" value="4"'));
  assert.ok(html.includes('name="points-2" value=""'));

  const submit = BudgetConfig.DEFAULT_OPTIONS.form.handler;
  await submit.call(app, {}, {}, { object: { "points-1": "6", "cap-1": "4", "points-2": "8", "cap-2": "5" } });
  const saved = game.settings.get(MMRPG.id, "budget");
  assert.deepEqual(saved[1], { points: 6, cap: 4 });
  assert.deepEqual(saved[2], { points: 8, cap: 5 });
  assert.deepEqual(saved[3], { points: null, cap: null });

  await BudgetConfig.DEFAULT_OPTIONS.actions.resetBudget.call(app);
  assert.deepEqual(game.settings.get(MMRPG.id, "budget")[1], { points: 5, cap: 4 });
  assert.deepEqual(game.settings.get(MMRPG.id, "budget")[2], { points: null, cap: null });
});

test("só o Narrador abre a janela de orçamento", () => {
  game.user.isGM = false;
  env.notices.warn.length = 0;
  try {
    assert.equal(BudgetConfig.open(), null);
    assert.equal(env.notices.warn.length, 1);
  } finally {
    game.user.isGM = true;
  }
  const first = BudgetConfig.open();
  assert.ok(first);
  assert.equal(BudgetConfig.open(), first, "uma janela só");
  first._onClose({});
  assert.notEqual(BudgetConfig.open(), first, "depois de fechada, abre uma nova");
});

/* -------------------------------------------- */

test("aparência: padrão claro/normal, valores inválidos caem no padrão, atributos na janela", async () => {
  assert.deepEqual(appearance.getAppearance(), { uiTheme: "light", uiTextSize: "normal" });
  env.settings.set(MMRPG.id, "uiTheme", "dark");
  env.settings.set(MMRPG.id, "uiTextSize", "xlarge");
  const el = { dataset: {} };
  appearance.applyAppearance(el);
  assert.deepEqual(el.dataset, { mmTheme: "dark", mmText: "xlarge" });
  env.settings.set(MMRPG.id, "uiTheme", "lixo");
  assert.equal(appearance.getAppearance().uiTheme, "light");
  env.settings.set(MMRPG.id, "uiTheme", "light");
  env.settings.set(MMRPG.id, "uiTextSize", "normal");
});

test("hook renderApplicationV2 aplica a aparência só nas janelas do sistema", async () => {
  env.settings.set(MMRPG.id, "uiTheme", "dark");
  const ours = { classList: { contains: (c) => c === "mmrpg" }, dataset: {} };
  const other = { classList: { contains: () => false }, dataset: {} };
  await Hooks.callAll("renderApplicationV2", {}, ours);
  await Hooks.callAll("renderApplicationV2", {}, other);
  assert.equal(ours.dataset.mmTheme, "dark");
  assert.equal(other.dataset.mmTheme, undefined);
  env.settings.set(MMRPG.id, "uiTheme", "light");
});

test("diálogo de aparência grava a escolha do jogador", async () => {
  const { DialogV2 } = foundry.applications.api;
  DialogV2.answer = { uiTheme: "dark", uiTextSize: "large" };
  await appearance.openAppearanceDialog();
  assert.deepEqual(appearance.getAppearance(), { uiTheme: "dark", uiTextSize: "large" });
  DialogV2.answer = { uiTheme: "inexistente", uiTextSize: "normal" };
  await appearance.openAppearanceDialog();
  assert.deepEqual(appearance.getAppearance(), { uiTheme: "dark", uiTextSize: "normal" }, "valor inválido é ignorado");
  DialogV2.answer = null;
  assert.equal(await appearance.openAppearanceDialog(), null, "fechar não muda nada");
  env.settings.set(MMRPG.id, "uiTheme", "light");
});

test("menu da janela da ficha ganha o item de aparência", () => {
  const sheet = sheetFor(CharacterSheet, { name: "x" });
  Object.getPrototypeOf(Object.getPrototypeOf(sheet)); // garante a cadeia de protótipos
  const controls = sheet._getHeaderControls();
  assert.ok(controls.some((c) => c.action === "openAppearance" && c.label === "MMRPG.Appearance.title"));
});

test("nenhuma chave de idioma ficou faltando em todo o arquivo", () => {
  assert.equal(env.missingKeys.size, 0, `chaves ausentes: ${[...env.missingKeys]}`);
});
