/**
 * Testes de integração no Foundry simulado (tests/support/foundry-stub.mjs).
 *
 * Carregam o sistema de verdade (ponto de entrada, modelos de dados, documentos, motor de ações,
 * fichas e templates). Não substituem um teste num mundo do Foundry v14.
 */

import test from "node:test";
import assert from "node:assert/strict";
import { installFoundry, dice } from "./support/foundry-stub.mjs";

const env = installFoundry();
await import("../module/mmrpg.mjs");
const { MMRPG } = await import("../module/config.mjs");
const { ABILITY_KEYS, defenseScore, damageMultiplier } = await import("../module/rules/index.mjs");
const { requestApply } = await import("../module/actions/apply.mjs");
const { rollAbilityCheck } = await import("../module/actions/executor.mjs");
const { rerollDie, placeTemplate } = await import("../module/actions/listeners.mjs");
const { importItems, exportItems, exportPackItems } = await import("../module/helpers/importer.mjs");
const compendia = await import("../module/helpers/compendia.mjs");
const { parseContent } = await import("../module/helpers/content-format.mjs");
const compat = await import("../module/helpers/compat.mjs");
const { defaultMessageMode, messageModeChoices } = await import("../module/actions/roll-config.mjs");

await Hooks.callAll("init");
await Hooks.callAll("ready");

/** Falha se o HTML tem sinais de dado ausente ou helper quebrado. */
function assertClean(html, label) {
  assert.equal(typeof html, "string", `${label}: sem HTML`);
  assert.ok(html.length > 50, `${label}: HTML curto demais`);
  for (const bad of ["undefined", "[object", "NaN", "{{", "null"]) {
    assert.ok(!html.includes(bad), `${label}: contém "${bad}"`);
  }
}

/** Define as próximas faces sorteadas, descartando sobras de testes anteriores. */
function rig(...faces) {
  dice.queue.length = 0;
  dice.push(...faces);
}

const sheetFor = async (SheetClass, document) => new SheetClass({ document });

/* -------------------------------------------- */

test("hook init registra classes, modelos, fichas, condições e configurações", () => {
  assert.equal(CONFIG.MMRPG, MMRPG);
  assert.deepEqual(Object.keys(CONFIG.Actor.dataModels).sort(), ["character", "npc"]);
  assert.deepEqual(Object.keys(CONFIG.Item.dataModels).sort(), ["gear", "occupation", "origin", "power", "tag", "trait", "weapon"]);
  assert.equal(CONFIG.statusEffects.length, MMRPG.statuses.length);
  assert.equal(CONFIG.specialStatusEffects.DEFEATED, "dead");
  assert.ok(CONFIG.Dice.terms.m, "dado Marvel registrado");
  assert.equal(CONFIG.Dice.rolls.length, 1);
  assert.equal(env.registeredSheets.filter((s) => s.scope === "mmrpg").length, 3);
  assert.equal(env.settings.get("mmrpg", "autoApply"), false);
  assert.ok(game.mmrpg.useItem && game.mmrpg.rollAbility && game.mmrpg.openImporter);
  assert.ok(env.settings.menus.has("mmrpg.importer"));
});

test(`fichas registradas pela API da v${env.generation}`, () => {
  const mine = env.registeredSheets.filter((s) => s.scope === "mmrpg");
  assert.equal(mine.length, 3);
  const via = env.generation >= 14 ? "collection" : "config";
  assert.ok(mine.every((s) => s.via === via), `todas pela API "${via}"`);
  assert.deepEqual(env.deprecatedSheetCalls, [], "não usa a API de registro antiga na v13");
  const retired = env.unregisteredSheets.map((s) => s.name);
  assert.ok(retired.includes("ActorSheetV2") && retired.includes("ItemSheetV2"), "tira as fichas V2 do núcleo");
  if (env.generation < 14) {
    assert.ok(retired.includes("LegacyActorSheet") && retired.includes("LegacyItemSheet"), "v13: tira também as fichas antigas (AppV1)");
  }
});

test("modo de mensagem: lista, padrão do usuário e criação do cartão", async () => {
  assert.equal(compat.foundryGeneration(), env.generation);

  // Lista de modos: nomes internos, sem "ic", com rótulos localizados.
  const choices = messageModeChoices();
  assert.deepEqual(choices.map((c) => c.value), ["public", "gm", "blind", "self"]);
  assert.ok(choices.every((c) => typeof c.label === "string" && c.label.length));

  // Padrão do usuário, lido da configuração do núcleo da versão.
  const key = env.generation >= 14 ? "messageMode" : "rollMode";
  const names = env.generation >= 14
    ? { public: "public", gm: "gm", blind: "blind", self: "self", ic: "ic" }
    : { public: "publicroll", gm: "gmroll", blind: "blindroll", self: "selfroll" };
  const original = env.settings.get("core", key);
  for (const [internal, native] of Object.entries(names)) {
    env.settings.set("core", key, native);
    assert.equal(defaultMessageMode(), internal === "ic" ? "public" : internal, `padrão para ${native}`);
  }
  env.settings.set("core", key, original);

  // Criação: cada modo resulta na visibilidade certa nas duas versões.
  game.messages.clear?.();
  for (const mode of ["public", "gm", "blind", "self"]) {
    const msg = await compat.createChatMessage({ content: "x" }, mode);
    assert.equal(msg.effectiveMode, mode, `visibilidade ${mode}`);
    if (env.generation >= 14) assert.equal(msg.messageMode, mode);
    else assert.equal(msg.messageMode, undefined, "v13 não usa messageMode");
  }
  // Nomes da v13 também são aceitos (módulos e macros antigos).
  assert.equal((await compat.createChatMessage({ content: "x" }, "gmroll")).effectiveMode, "gm");
  // Sem modo: usa o do usuário.
  assert.equal((await compat.createChatMessage({ content: "x" })).effectiveMode, "public");
  // Modo desconhecido nunca vaza: vira público.
  assert.equal((await compat.createChatMessage({ content: "x" }, "qualquer")).effectiveMode, "public");
});

test("o cartão de ação e o teste de atributo respeitam o modo escolhido", async () => {
  const { hero, villain, power } = await makeScene();
  game.user.targets = new Set([target(villain)]);
  const { DialogV2 } = foundry.applications.api;
  for (const mode of ["blind", "self", "gm"]) {
    DialogV2.answer = { edge: "normal", bonus: 0, messageMode: mode };
    rig(2, 3, 2);
    const card = await power.use("golpe");
    assert.equal(card.effectiveMode, mode, `cartão ${mode}`);
    rig(2, 3, 2);
    const check = await rollAbilityCheck(hero, "mle");
    assert.equal(check.effectiveMode, mode, `teste ${mode}`);
  }
  DialogV2.answer = null;
});

test("todos os modelos de dados têm valores iniciais válidos", async () => {
  for (const type of Object.keys(CONFIG.Actor.dataModels)) {
    const actor = await Actor.create({ name: `Teste ${type}`, type });
    assert.deepEqual(actor.system.validate(), [], `ator ${type}`);
  }
  for (const type of Object.keys(CONFIG.Item.dataModels)) {
    const item = await Item.create({ name: `Teste ${type}`, type });
    assert.deepEqual(item.system.validate(), [], `item ${type}`);
  }
});

test("armas e equipamentos novos já vêm com uma ação; poderes não", async () => {
  const weapon = await Item.create({ name: "Cano", type: "weapon" });
  const gear = await Item.create({ name: "Kit", type: "gear" });
  const power = await Item.create({ name: "Rajada", type: "power" });
  assert.equal(weapon.actions.length, 1);
  assert.equal(weapon.actions[0].damage.enabled, true);
  assert.equal(weapon.actions[0].rolls, true);
  assert.equal(gear.actions.length, 1);
  assert.equal(gear.actions[0].rolls, false);
  assert.equal(power.actions.length, 0);
  assert.equal(weapon.img, MMRPG.itemIcons.weapon);
});

test("dados derivados do ator seguem as regras puras", async () => {
  const actor = await Actor.create({
    name: "Derivado",
    type: "character",
    system: {
      rank: 3,
      abilities: { mle: { value: 4, defenseBonus: 1 }, vig: { value: 2 }, agl: { value: -1 } },
      init: { bonus: 1 }
    }
  });
  const a = actor.system.abilities;
  assert.equal(a.mle.defense, defenseScore(4, 1));
  assert.equal(a.agl.defense, defenseScore(-1, 0));
  assert.equal(a.mle.multiplier, damageMultiplier(3, 0));
  assert.equal(actor.system.init.total, 3);
  assert.deepEqual(Object.keys(actor.system.defenses).sort(), [...ABILITY_KEYS].sort());
  assert.equal(actor.system.getRollData().rank, 3);
  assert.ok(Number.isFinite(actor.system.movement.run.value));
});

/* -------------------------------------------- */
/*  Uso de ações                                */
/* -------------------------------------------- */

async function makeScene() {
  const hero = await Actor.create({
    name: "Heroína",
    type: "character",
    system: {
      rank: 2,
      abilities: { mle: { value: 3 }, agl: { value: 2 }, ego: { value: 1 }, log: { value: 1 }, vig: { value: 2 }, res: { value: 1 } },
      health: { value: 30, max: 30 },
      focus: { value: 10, max: 10 }
    }
  });
  const villain = await Actor.create({
    name: "Vilão",
    type: "npc",
    system: { rank: 1, abilities: { agl: { value: 1 } }, health: { value: 40, max: 40 }, focus: { value: 5, max: 5 } }
  });
  const [power] = await hero.createEmbeddedDocuments("Item", [
    {
      name: "Golpe Gélido",
      type: "power",
      system: {
        powerSet: "basic",
        actions: [
          {
            id: "golpe",
            name: "Golpe",
            roll: { mode: "attack", ability: "mle", kind: "close", targetDefense: "agl" },
            damage: { enabled: true, element: "ice" },
            cost: { focus: 2 },
            effects: [{ id: "lento", when: "hit", target: "targets", status: "slowed", rounds: 2 }]
          },
          {
            id: "cura",
            name: "Recuperar fôlego",
            target: { type: "self" },
            roll: { mode: "none" },
            healing: { enabled: true, mode: "flat", resource: "health", target: "self", flat: 5 }
          },
          {
            id: "teste",
            name: "Concentração",
            target: { type: "self" },
            roll: { mode: "check", ability: "log", difficulty: 10 }
          },
          {
            id: "limitada",
            name: "Descarga",
            roll: { mode: "attack", ability: "mle", targetDefense: "agl" },
            damage: { enabled: true },
            uses: { value: 1, max: 1 }
          }
        ]
      }
    }
  ]);
  assert.deepEqual(power.system.validate(), [], "poder de teste válido");
  return { hero, villain, power };
}

const target = (actor) => ({ actor, name: actor.name, document: { name: actor.name, texture: { src: actor.img } } });

test("usar uma ação rola, cobra custo e posta o cartão com os dados guardados", async () => {
  const { hero, villain, power } = await makeScene();
  game.user.targets = new Set([target(villain)]);
  rig(3, 4, 5); // d6, dado Marvel (4), d6 -> 12 + modificador

  const msg = await power.use("golpe", { fastForward: true });
  assert.ok(msg, "mensagem criada");
  assert.equal(hero.system.focus.value, 8, "custo cobrado");
  assertClean(msg.content, "cartão de ataque");
  assert.ok(msg.content.includes("Vilão"));

  const card = msg.getFlag("mmrpg", "card");
  assert.equal(card.targets.length, 1);
  assert.equal(card.action.id, "golpe");
  assert.equal(msg.rolls.length, 1);
  assert.equal(msg.rolls[0].isD616, true);
  assert.equal(msg.rolls[0].marvelValue, 4);
  assert.equal(msg.rolls[0].summary.total, 3 + 4 + 5 + hero.system.abilities.mle.attack);
});

test("aplicar o cartão causa dano, cria o efeito e trava o cartão", async () => {
  const { villain, power } = await makeScene();
  game.user.targets = new Set([target(villain)]);
  rig(3, 4, 5);
  const msg = await power.use("golpe", { fastForward: true });

  await requestApply(msg, { scope: "all" });

  assert.ok(villain.system.health.value < 40, "perdeu Health");
  const stored = msg.getFlag("mmrpg", "card");
  assert.equal(stored.applied.targets[0].damage, true);
  assert.equal(stored.applied.targets[0].effects, true);
  assert.ok(villain.statuses.has("slowed"), "condição aplicada");
  assertClean(msg.content, "cartão depois de aplicar");

  const before = villain.system.health.value;
  await requestApply(msg, { scope: "all" });
  assert.equal(villain.system.health.value, before, "não aplica duas vezes");
});

test("resultado Fantástico acerta qualquer defesa e dobra o dano", async () => {
  const { villain, power } = await makeScene();
  villain.system.updateSource({ abilities: { agl: { value: 30 } } });
  villain.prepareData();
  game.user.targets = new Set([target(villain)]);
  rig(2, 1, 2); // dado Marvel = 1 ("M")
  const msg = await power.use("golpe", { fastForward: true });
  const roll = msg.rolls[0];
  assert.equal(roll.isFantastic, true);
  assert.equal(roll.marvelValue, 6);
  await requestApply(msg, { scope: "all" });
  assert.ok(villain.system.health.value < 40);
});

test("errar não causa dano nem aplica efeitos de acerto", async () => {
  const { villain, power } = await makeScene();
  villain.system.updateSource({ abilities: { agl: { value: 30 } } });
  villain.prepareData();
  game.user.targets = new Set([target(villain)]);
  rig(2, 2, 2);
  const msg = await power.use("golpe", { fastForward: true });
  await requestApply(msg, { scope: "all" });
  assert.equal(villain.system.health.value, 40);
  assert.equal(villain.statuses.has("slowed"), false);
});

test("cura em si mesmo e teste contra dificuldade fixa", async () => {
  const { hero, power } = await makeScene();
  hero.system.updateSource({ health: { value: 10 } });
  hero.prepareData();
  const heal = await power.use("cura", { fastForward: true });
  assertClean(heal.content, "cartão de cura");
  await requestApply(heal, { scope: "self" });
  assert.equal(hero.system.health.value, 15);

  rig(6, 3, 6);
  const check = await power.use("teste", { fastForward: true });
  assertClean(check.content, "cartão de teste");
  assert.equal(check.getFlag("mmrpg", "card").action.roll.difficulty, 10);
});

test("usos limitados são consumidos e bloqueiam a ação quando acabam", async () => {
  const { villain, power } = await makeScene();
  game.user.targets = new Set([target(villain)]);
  env.notices.warn.length = 0;
  assert.ok(await power.use("limitada", { fastForward: true }));
  assert.equal(power.system.getAction("limitada").uses.value, 0);
  assert.equal(await power.use("limitada", { fastForward: true }), null);
  assert.equal(env.notices.warn.length, 1);
});

test("custo mínimo de Foco: gasta o que o jogador escolher e soma o valor fixo por Foco", async () => {
  const { hero } = await makeScene();
  hero.system.updateSource({ health: { value: 5 } });
  hero.prepareData();
  const [power] = await hero.createEmbeddedDocuments("Item", [
    {
      name: "Toque Curativo",
      type: "power",
      system: {
        powerSet: "healing",
        actions: [
          {
            id: "tocar",
            target: { type: "self" },
            roll: { mode: "none" },
            healing: { enabled: true, mode: "flat", resource: "health", target: "self", perFocus: 1 },
            cost: { focus: 4, scalable: true }
          },
          {
            id: "raio",
            roll: { mode: "attack", ability: "mle", targetDefense: "agl" },
            damage: { enabled: true, perFocus: 0.5 },
            cost: { focus: 5, scalable: true }
          }
        ]
      }
    }
  ]);
  assert.deepEqual(power.system.validate(), []);

  // Sem informar o Foco, gasta o mínimo.
  const min = await power.use("tocar", { fastForward: true });
  assert.equal(hero.system.focus.value, 6);
  assert.equal(min.getFlag("mmrpg", "card").action.healing.flat, 4);

  // Informando mais Foco, gasta tudo e a cura cresce.
  const more = await power.use("tocar", { fastForward: true, focus: 6 });
  assert.equal(hero.system.focus.value, 0);
  const card = more.getFlag("mmrpg", "card");
  assert.equal(card.action.cost.focus, 6);
  assert.equal(card.action.healing.flat, 6);
  await requestApply(more, { scope: "self" });
  assert.equal(hero.system.health.value, 11);

  // Mais Foco do que a ficha tem: recusa e não cobra nada.
  hero.system.updateSource({ focus: { value: 5 } });
  hero.prepareData();
  env.notices.warn.length = 0;
  assert.equal(await power.use("tocar", { fastForward: true, focus: 9 }), null);
  assert.equal(env.notices.warn.length, 1);
  assert.equal(hero.system.focus.value, 5);

  // Dano: +1 a cada 2 de Foco (0,5 por ponto), contando todo o Foco gasto.
  hero.system.updateSource({ focus: { value: 20, max: 20 } });
  hero.prepareData();
  const atk = await power.use("raio", { fastForward: true, focus: 11 });
  assert.equal(hero.system.focus.value, 9);
  assert.equal(atk.getFlag("mmrpg", "card").action.damage.flat, 5);
});

test("custo acima dos recursos bloqueia a ação", async () => {
  const { hero, villain, power } = await makeScene();
  hero.system.updateSource({ focus: { value: 1 } });
  hero.prepareData();
  game.user.targets = new Set([target(villain)]);
  env.notices.warn.length = 0;
  assert.equal(await power.use("golpe", { fastForward: true }), null);
  assert.equal(env.notices.warn.length, 1);
  assert.equal(hero.system.focus.value, 1);
});

test("usar com diálogo respeita a escolha do jogador", async () => {
  const { hero, villain, power } = await makeScene();
  game.user.targets = new Set([target(villain)]);
  const { DialogV2 } = foundry.applications.api;
  DialogV2.answer = { edge: "edge", bonus: 2, messageMode: "gm" };
  rig(1, 3, 2); // d6=1, Marvel=3, d6=2
  const msg = await power.use("golpe");
  DialogV2.answer = null;
  assert.ok(msg);
  assert.equal(msg.effectiveMode, "gm");
  assert.equal(msg.rolls[0].edgeMode, 1);
  assert.equal(msg.rolls[0].modifier, hero.system.abilities.mle.attack + 2);
  assert.equal(msg.rolls[0].canReroll, true);
});

test("Edge: re-rolar um dado mantém o melhor resultado e atualiza o cartão", async () => {
  const { villain, power } = await makeScene();
  game.user.targets = new Set([target(villain)]);
  const { DialogV2 } = foundry.applications.api;
  DialogV2.answer = { edge: "edge", bonus: 0, messageMode: "public" };
  rig(1, 3, 2);
  const msg = await power.use("golpe");
  DialogV2.answer = null;
  const before = msg.rolls[0].summary.total;
  dice.push(6);
  await rerollDie(msg, 0);
  assert.equal(msg.rolls[0].summary.total, before + 5, "1 trocado por 6");
  assert.equal(msg.rolls[0].canReroll, false, "só uma vez");
  assertClean(msg.content, "cartão depois de re-rolar");
});

test("teste de atributo direto da ficha", async () => {
  const { hero } = await makeScene();
  rig(2, 2, 2);
  const msg = await rollAbilityCheck(hero, "agl", { fastForward: true });
  assert.ok(msg);
  assertClean(msg.content, "cartão de teste de atributo");
  assert.equal(msg.rolls[0].summary.total, 6 + hero.system.abilities.agl.noncom);
});

test("iniciativa é d616 + Vigilance e re-rola sozinha com Edge", async () => {
  const { hero } = await makeScene();
  hero.system.updateSource({ init: { edge: true } });
  hero.prepareData();
  const combatant = new CONFIG.Combatant.documentClass();
  combatant.actor = hero;
  const roll = combatant.getInitiativeRoll();
  rig(1, 3, 2, 6);
  await roll.evaluate();
  assert.equal(roll.options.rerolled.keepNew, true);
  assert.equal(roll.total, 6 + 3 + 2 + hero.system.init.total);
});

test("área de efeito vira Região no v14 e gabarito nas versões sem Regiões", async () => {
  const { hero, power } = await makeScene();
  await power.update({
    "system.actions": [
      { id: "onda", name: "Onda", target: { type: "area" }, area: { shape: "cone", size: 20 }, roll: { mode: "attack", ability: "ego" }, damage: { enabled: true } }
    ]
  });
  const msg = await power.use("onda", { fastForward: true });
  assert.ok(msg.content.includes("place-template"), "botão de posicionar no cartão");

  const created = [];
  const token = { center: { x: 500, y: 300 } };
  hero.getActiveTokens = () => [token];
  canvas.scene = { createEmbeddedDocuments: async (name, data) => (created.push({ name, data }), data) };
  canvas.dimensions = { size: 100, distance: 5 };

  game.release = { generation: 14 };
  CONFIG.Region = class Region {};
  await placeTemplate(msg);
  assert.equal(created.at(-1).name, "Region");
  const region = created.at(-1).data[0];
  assert.equal(region.shapes[0].type, "polygon");
  assert.equal(region.flags.mmrpg.messageId, msg.id);

  // Sem Regiões: gabarito clássico, em unidades da cena.
  game.release = { generation: 13 };
  delete CONFIG.Region;
  await placeTemplate(msg);
  assert.equal(created.at(-1).name, "MeasuredTemplate");
  assert.equal(created.at(-1).data[0].t, "cone");
  assert.equal(created.at(-1).data[0].distance, 20);

  // Falha ao criar a Região: cai no gabarito.
  game.release = { generation: 14 };
  CONFIG.Region = class Region {};
  let first = true;
  canvas.scene.createEmbeddedDocuments = async (name, data) => {
    if (name === "Region" && first) {
      first = false;
      throw new Error("falhou");
    }
    created.push({ name, data });
    return data;
  };
  await placeTemplate(msg);
  assert.equal(created.at(-1).name, "MeasuredTemplate");

  game.release = { generation: env.generation };
  delete CONFIG.Region;
  canvas.scene = null;
});

/* -------------------------------------------- */
/*  Automação                                   */
/* -------------------------------------------- */

test("efeitos com duração em rodadas expiram quando a rodada chega", async () => {
  const { villain, power } = await makeScene();
  const combat = { id: "c1", round: 1, started: true, combatants: [{ actor: villain }] };
  game.combat = combat;
  game.user.targets = new Set([target(villain)]);
  rig(3, 4, 5);
  const msg = await power.use("golpe", { fastForward: true });
  await requestApply(msg, { scope: "all" });
  assert.ok(villain.statuses.has("slowed"));

  combat.round = 2;
  await Hooks.callAll("updateCombat", combat, { round: 2 });
  assert.ok(villain.statuses.has("slowed"), "ainda dura");
  combat.round = 3;
  await Hooks.callAll("updateCombat", combat, { round: 3 });
  assert.equal(villain.statuses.has("slowed"), false, "expirou");
  game.combat = null;
});

test("NPC com Health 0 fica derrotado e volta ao curar", async () => {
  const { villain } = await makeScene();
  await villain.update({ "system.health.value": 0 });
  assert.ok(villain.statuses.has("dead"));
  await villain.update({ "system.health.value": 5 });
  assert.equal(villain.statuses.has("dead"), false);
});

test("Origem concede os itens ligados ao entrar na ficha", async () => {
  const trait = await Item.create({ name: "Resistente", type: "trait" });
  const origin = await Item.create({
    name: "Mutante",
    type: "origin",
    system: { grants: [{ uuid: trait.uuid, name: trait.name, type: "trait" }] }
  });
  const hero = await Actor.create({ name: "Com origem", type: "character" });
  await hero.createEmbeddedDocuments("Item", [origin.toObject()]);
  assert.ok(hero.items.some((i) => i.type === "trait" && i.name === "Resistente"));
  assert.equal(hero.items.filter((i) => i.type === "trait").length, 1);
  await hero.grantItems(hero.items.find((i) => i.type === "origin"));
  assert.equal(hero.items.filter((i) => i.type === "trait").length, 1, "não duplica");
});

/* -------------------------------------------- */
/*  Fichas e janelas                            */
/* -------------------------------------------- */

test("fichas de personagem e NPC montam o contexto e renderizam sem dados ausentes", async () => {
  const { hero, villain } = await makeScene();
  for (const type of ["trait", "tag", "origin", "occupation", "weapon", "gear"]) {
    await hero.createEmbeddedDocuments("Item", [{ name: `Item ${type}`, type }]);
  }
  await hero.createEmbeddedDocuments("ActiveEffect", [{ name: "Efeito manual", origin: hero.uuid }]);
  await hero.toggleStatusEffect("burning");

  const { CharacterSheet, NpcSheet } = await import("../module/apps/sheets/actor-sheet.mjs");
  const html = await (await sheetFor(CharacterSheet, hero)).renderToString();
  assertClean(html, "ficha de personagem");
  assert.ok(html.includes('value="Heroína"'), "nome no cabeçalho");
  assert.ok(html.includes("Golpe"));
  assert.ok(html.includes("Golpe Gélido"));

  assertClean(await (await sheetFor(NpcSheet, villain)).renderToString(), "ficha de NPC");
});

test("ficha de item renderiza todos os tipos", async () => {
  const MMRPGItemSheet = (await import("../module/apps/sheets/item-sheet.mjs")).default;
  const { power } = await makeScene();
  const items = [power];
  for (const type of Object.keys(CONFIG.Item.dataModels)) items.push(await Item.create({ name: `Item ${type}`, type }));
  for (const item of items) {
    const html = await (await sheetFor(MMRPGItemSheet, item)).renderToString();
    assertClean(html, `ficha de ${item.type}`);
    assert.ok(html.includes(`value="${item.name}"`), `${item.type}: nome no cabeçalho`);
  }
});

test("editor de ação renderiza e grava o formulário no array de ações", async () => {
  const ActionEditor = (await import("../module/apps/action-editor.mjs")).default;
  const { power } = await makeScene();
  const editor = new ActionEditor(power, "golpe");
  assertClean(await editor.renderToString(), "editor de ação");

  const handler = ActionEditor.DEFAULT_OPTIONS.form.handler;
  await handler.call(editor, null, null, {
    object: {
      name: "Golpe renomeado",
      "roll.mode": "check",
      "roll.difficulty": 12,
      "uses.max": 4,
      "damage.enabled": false,
      "effects.0.rounds": 5
    }
  });
  const action = power.system.getAction("golpe");
  assert.equal(action.name, "Golpe renomeado");
  assert.equal(action.roll.mode, "check");
  assert.equal(action.roll.difficulty, 12);
  assert.equal(action.damage.enabled, false);
  assert.equal(action.effects[0].rounds, 5);
  assert.equal(action.effects[0].status, "slowed", "mantém o que o formulário não enviou");
  assert.equal(action.uses.max, 4);
  assert.equal(action.uses.value, 4, "começa com todos os usos");
  assert.deepEqual(power.system.validate(), []);
  assert.ok(power.system.getAction("cura"), "as outras ações continuam");

  await handler.call(editor, null, null, { object: { "uses.max": 2 } });
  assert.equal(power.system.getAction("golpe").uses.value, 2, "uso limitado ao novo máximo");
});

test("janela de manobra de equipe renderiza e cobra Focus de cada integrante", async () => {
  const TeamManeuverApp = (await import("../module/apps/team-maneuver.mjs")).default;
  const { hero } = await makeScene();
  const app = TeamManeuverApp.open(hero);
  assertClean(await app.renderToString(), "manobra de equipe");
  const before = hero.system.focus.value;
  await TeamManeuverApp.DEFAULT_OPTIONS.actions.use.call(app);
  assert.ok(hero.system.focus.value < before);
  await app.close();
});

/* -------------------------------------------- */
/*  Importação                                  */
/* -------------------------------------------- */

test("importar e exportar conteúdo preserva ações, concessões e ids", async () => {
  const file = {
    format: "mmrpg-content",
    version: 1,
    source: "teste",
    items: [
      { type: "trait", name: "Importado A", folder: "Teste/Traços", system: { restriction: "nenhuma" } },
      { type: "origin", name: "Origem Importada", system: { grants: [{ type: "trait", name: "Importado A" }, { type: "trait", name: "Não existe" }] } },
      {
        type: "power",
        name: "Poder Importado",
        system: {
          powerSet: "basic",
          actions: [{ roll: { mode: "attack", ability: "mle" }, damage: { enabled: true }, uses: { max: 3 }, effects: [{ status: "stunned", rounds: 1 }] }]
        }
      }
    ]
  };
  const parsed = parseContent(file);
  assert.deepEqual(parsed.errors, []);
  const report = await importItems(parsed.items, { onDuplicate: "skip" });
  assert.equal(report.created, 3);
  assert.deepEqual(report.failed, []);
  assert.deepEqual(report.unresolved, ["Origem Importada → trait:Não existe"]);

  const power = game.items.find((i) => i.name === "Poder Importado");
  assert.deepEqual(power.system.validate(), []);
  assert.equal(power.actions[0].id, "a1");
  assert.equal(power.actions[0].uses.value, 3);
  assert.equal(power.actions[0].effects[0].id, "a1-e1");

  const origin = game.items.find((i) => i.name === "Origem Importada");
  assert.equal(origin.system.grants[0].uuid, game.items.find((i) => i.name === "Importado A").uuid);
  assert.equal(origin.system.grants[1].uuid, "");

  const again = await importItems(parsed.items, { onDuplicate: "skip" });
  assert.equal(again.created, 0);
  assert.equal(again.skipped, 3);

  const exported = exportItems(["power", "trait", "origin"]);
  const roundTrip = parseContent(exported);
  assert.deepEqual(roundTrip.errors, []);
  assert.ok(roundTrip.items.some((i) => i.name === "Poder Importado"));
});

const COMPENDIA_FILE = {
  format: "mmrpg-content",
  version: 1,
  source: "teste de compêndios",
  items: [
    { type: "trait", name: "Traço do Compêndio", folder: "Gerais", system: { restriction: "nenhuma" } },
    { type: "power", name: "Poder do Compêndio", folder: "Telecinese", system: { powerSet: "basic", actions: [{ roll: { mode: "attack", ability: "mle" }, damage: { enabled: true }, uses: { max: 2 } }] } },
    { type: "power", name: "Outro Poder", folder: "Telecinese/Avançado", system: { powerSet: "basic" } },
    { type: "origin", name: "Origem do Compêndio", system: { grants: [{ type: "trait", name: "Traço do Compêndio" }, { type: "power", name: "Poder do Compêndio" }] } },
    { type: "tag", name: "Tag do Compêndio", system: {} }
  ]
};

test("importar para compêndios cria um compêndio por tipo, com pastas, e liga as concessões", async () => {
  const parsed = parseContent(COMPENDIA_FILE);
  assert.deepEqual(parsed.errors, []);
  const worldBefore = game.items.size;

  const report = await importItems(parsed.items, { destination: "compendia" });
  assert.deepEqual(report.failed, []);
  assert.deepEqual(report.unresolved, []);
  assert.equal(report.created, 5);
  assert.equal(game.items.size, worldBefore, "nada vai para os itens do mundo");

  // Um compêndio por tipo usado, com o nome e o rótulo certos.
  for (const type of ["trait", "power", "origin", "tag"]) {
    const pack = game.packs.get(compendia.packIdFor(type));
    assert.ok(pack, `compêndio de ${type}`);
    assert.equal(pack.title, game.i18n.localize(`MMRPG.Pack.${type}`));
  }
  assert.equal(game.packs.has(compendia.packIdFor("weapon")), false, "só cria os tipos usados");
  assert.deepEqual(report.packs.sort(), ["Origens", "Poderes", "Tags", "Traços"]);

  // Itens no compêndio certo, válidos, marcados como importados e dentro das pastas.
  const powers = game.packs.get("world.mmrpg-power");
  assert.equal(powers.documents.size, 2);
  const power = powers.documents.contents.find((d) => d.name === "Poder do Compêndio");
  assert.deepEqual(power.system.validate(), []);
  assert.equal(power.getFlag("mmrpg", "imported"), true);
  assert.equal(power.actions[0].uses.value, 2);
  assert.equal(power.folder.name, "Telecinese");
  assert.ok(power.uuid.startsWith("Compendium.world.mmrpg-power.Item."));
  const nested = powers.documents.contents.find((d) => d.name === "Outro Poder");
  assert.equal(nested.folder.name, "Avançado");
  assert.equal(nested.folder.folder.name, "Telecinese", "pasta dentro de pasta");
  assert.equal(powers.folders.size, 2, "a pasta Telecinese é reaproveitada");

  // A Origem concede itens que estão em OUTROS compêndios.
  const origin = game.packs.get("world.mmrpg-origin").documents.contents[0];
  assert.deepEqual(
    origin.system.grants.map((g) => g.uuid.split(".").slice(0, 3).join(".")),
    ["Compendium.world.mmrpg-trait", "Compendium.world.mmrpg-power"]
  );

  // Arrastar a Origem do compêndio para uma ficha cria os itens concedidos.
  const actor = await Actor.create({ name: "Recebe Origem", type: "character" });
  await actor.createEmbeddedDocuments("Item", [origin.toObject()]);
  const names = actor.items.map((i) => i.name).sort();
  assert.deepEqual(names, ["Origem do Compêndio", "Poder do Compêndio", "Traço do Compêndio"]);
});

test("importar de novo para compêndios respeita ignorar, atualizar e copiar", async () => {
  const parsed = parseContent(COMPENDIA_FILE);
  const skipped = await importItems(parsed.items, { destination: "compendia", onDuplicate: "skip" });
  assert.equal(skipped.created, 0);
  assert.equal(skipped.skipped, 5);
  assert.deepEqual(skipped.packs, [], "não cria nada, não menciona compêndios");

  const changed = structuredClone(COMPENDIA_FILE);
  changed.items[1].system.powerSet = "basic";
  changed.items[1].system.description = "<p>Texto novo</p>";
  const updated = await importItems(parseContent(changed).items, { destination: "compendia", onDuplicate: "update" });
  assert.deepEqual(updated.failed, []);
  assert.equal(updated.updated, 5);
  const power = game.packs.get("world.mmrpg-power").documents.contents.find((d) => d.name === "Poder do Compêndio");
  assert.equal(power.system.description, "<p>Texto novo</p>");
  assert.equal(game.packs.get("world.mmrpg-power").documents.size, 2, "atualizou, não duplicou");

  const copies = await importItems(parsed.items.slice(0, 1), { destination: "compendia", onDuplicate: "duplicate" });
  assert.equal(copies.created, 1);
  assert.equal(game.packs.get("world.mmrpg-trait").documents.size, 2);
});

test("compêndio bloqueado: o relatório lista a falha e nada quebra", async () => {
  const pack = game.packs.get("world.mmrpg-tag");
  pack.locked = true;
  const parsed = parseContent({ ...COMPENDIA_FILE, items: [{ type: "tag", name: "Tag Nova", system: {} }] });
  const report = await importItems(parsed.items, { destination: "compendia" });
  pack.locked = false;
  assert.equal(report.created, 0);
  assert.equal(report.failed.length, 1);
  assert.ok(report.failed[0].includes("Destrave"), report.failed[0]);
  assert.equal(pack.documents.size, 1);
});

test("exportar dos compêndios devolve o mesmo conteúdo, com pastas e concessões por nome", async () => {
  const file = await exportPackItems(["power", "trait", "origin", "tag"], { source: "teste" });
  const roundTrip = parseContent(file);
  assert.deepEqual(roundTrip.errors, []);
  const byName = new Map(roundTrip.items.map((i) => [i.name, i]));
  assert.ok(byName.has("Poder do Compêndio") && byName.has("Origem do Compêndio") && byName.has("Tag do Compêndio"));
  assert.deepEqual(byName.get("Outro Poder").folder, ["Telecinese", "Avançado"]);
  const grants = file.items.find((i) => i.name === "Origem do Compêndio").system.grants;
  assert.deepEqual(grants.map((g) => [g.type, g.name]), [["trait", "Traço do Compêndio"], ["power", "Poder do Compêndio"]]);
  assert.ok(grants.every((g) => !g.uuid), "sem uuid: funciona em outro mundo");

  // Só os tipos pedidos e só os compêndios que existem.
  const onlyTags = await exportPackItems(["tag", "weapon"]);
  assert.deepEqual(onlyTags.items.map((i) => i.name), ["Tag do Compêndio"]);
});

test("janela de importação renderiza com destino e origem da exportação", async () => {
  const app = new (await import("../module/apps/importer.mjs")).default();
  const context = await app._prepareContext();
  assert.deepEqual(context.destinationOptions.map((o) => o.value), ["compendia", "world"]);
  assert.deepEqual(context.exportFromOptions.map((o) => o.value), ["world", "compendia"]);
  const html = await foundry.applications.handlebars.renderTemplate(`${MMRPG.path}/templates/apps/importer.hbs`, {
    ...context,
    parsed: parseContent(COMPENDIA_FILE),
    hasItems: true,
    reportPacks: "Poderes, Traços"
  });
  assertClean(html, "janela de importação (compêndios)");
  assert.ok(html.includes('name="destination"') && html.includes('name="exportFrom"'));
  assert.ok(html.includes("Poderes, Traços"));
});

test("concessões com observação criam itens com nome composto e não duplicam", async () => {
  const file = {
    format: "mmrpg-content",
    version: 1,
    items: [
      { type: "trait", name: "Conexões Teste", system: { description: "<p>base</p>" } },
      {
        type: "occupation",
        name: "Ocupação com Observações",
        system: {
          grants: [
            { type: "trait", name: "Conexões Teste", note: "Criminal" },
            { type: "trait", name: "Conexões Teste", note: "Polícia" }
          ]
        }
      }
    ]
  };
  const report = await importItems(parseContent(file).items, { destination: "compendia" });
  assert.deepEqual(report.failed, []);
  assert.deepEqual(report.unresolved, []);
  const occupation = game.packs.get("world.mmrpg-occupation").documents.contents.find((d) => d.name === "Ocupação com Observações");
  assert.deepEqual(occupation.system.grants.map((g) => g.note), ["Criminal", "Polícia"]);
  assert.equal(occupation.system.grants[0].uuid, occupation.system.grants[1].uuid);

  const actor = await Actor.create({ name: "Com Observações", type: "character" });
  await actor.createEmbeddedDocuments("Item", [occupation.toObject()]);
  assert.deepEqual(actor.items.map((i) => i.name).sort(), ["Conexões Teste: Criminal", "Conexões Teste: Polícia", "Ocupação com Observações"]);
  const created = actor.items.find((i) => i.name === "Conexões Teste: Criminal");
  assert.equal(created.system.description, "<p>base</p>", "mantém o texto do item original");

  // Receber a ocupação de novo não duplica.
  await actor.grantItems(occupation);
  assert.equal(actor.items.size, 3);

  // A exportação mantém a observação.
  const exported = await exportPackItems(["occupation"]);
  const grants = exported.items.find((i) => i.name === "Ocupação com Observações").system.grants;
  assert.deepEqual(grants, [
    { type: "trait", name: "Conexões Teste", note: "Criminal" },
    { type: "trait", name: "Conexões Teste", note: "Polícia" }
  ]);
});

test("efeitos passivos importados viram Active Effects do item e voltam na exportação", async () => {
  const file = {
    format: "mmrpg-content",
    version: 1,
    items: [
      {
        type: "power",
        name: "Poder com Efeito",
        folder: "Teste",
        system: { description: "<p>x</p>", powerSet: "basic" },
        effects: [
          {
            name: "Bônus de teste",
            changes: [
              { key: "system.abilities.mle.multiplierBonus", type: "upgrade", value: 2 },
              { key: "system.health.reduction", type: "upgrade", value: 1 }
            ]
          }
        ]
      }
    ]
  };
  const parsed = parseContent(file);
  assert.deepEqual(parsed.errors, []);
  const report = await importItems(parsed.items, { destination: "compendia" });
  assert.deepEqual(report.failed, []);

  const pack = game.packs.get("world.mmrpg-power");
  const power = pack.documents.contents.find((d) => d.name === "Poder com Efeito");
  assert.equal(power.effects.size, 1);
  const effect = power.effects.contents[0];
  assert.equal(effect.name, "Bônus de teste");
  assert.equal(effect.transfer, true);
  assert.equal(effect.changes.length, 2);
  assert.equal(effect.changes[0].type, "upgrade", "tipo da v14");
  assert.equal(effect.changes[0].mode, 4, "modo numérico da v13 (UPGRADE)");
  assert.equal(effect.changes[0].value, "2");
  assert.equal(effect.getFlag("mmrpg", "imported"), true);

  // Reimportar com "atualizar" troca os efeitos importados, sem duplicar.
  file.items[0].effects[0].changes = [{ key: "system.abilities.mle.multiplierBonus", type: "upgrade", value: 3 }];
  const again = await importItems(parseContent(file).items, { destination: "compendia", onDuplicate: "update" });
  assert.deepEqual(again.failed, []);
  const updated = game.packs.get("world.mmrpg-power").documents.contents.find((d) => d.name === "Poder com Efeito");
  assert.equal(updated.effects.size, 1);
  assert.equal(updated.effects.contents[0].changes.length, 1);
  assert.equal(updated.effects.contents[0].changes[0].value, "3");

  // Atualizar sem o campo "effects" não apaga os efeitos que já existem.
  delete file.items[0].effects;
  await importItems(parseContent(file).items, { destination: "compendia", onDuplicate: "update" });
  const kept = game.packs.get("world.mmrpg-power").documents.contents.find((d) => d.name === "Poder com Efeito");
  assert.equal(kept.effects.size, 1);

  // Exportação devolve os efeitos no formato do arquivo.
  const exported = await exportPackItems(["power"]);
  const row = exported.items.find((i) => i.name === "Poder com Efeito");
  assert.deepEqual(row.effects, [
    { name: "Bônus de teste", transfer: true, disabled: false, changes: [{ key: "system.abilities.mle.multiplierBonus", type: "upgrade", value: "3" }] }
  ]);
  const roundTrip = parseContent(exported);
  assert.deepEqual(roundTrip.errors, []);
});

test("efeitos passivos dos itens alteram o ator: upgrade não acumula, prioridade e movimento", async () => {
  const hero = await Actor.create({ name: "Passivos", type: "character", system: { rank: 2 } });
  const base = hero.system.abilities.mle.multiplier;
  const effectOf = (name, changes) => ({ name, transfer: true, changes: changes.map(compat.changeData) });
  const power = (name, changes) => ({
    name,
    type: "power",
    system: { powerSet: "basic" },
    effects: [effectOf(name, changes)]
  });

  await hero.createEmbeddedDocuments("Item", [
    power("Mighty 1", [{ key: "system.abilities.mle.multiplierBonus", type: "upgrade", value: 1 }]),
    power("Mighty 3", [{ key: "system.abilities.mle.multiplierBonus", type: "upgrade", value: 3 }]),
    power("Sturdy 2", [{ key: "system.health.reduction", type: "upgrade", value: 2 }]),
    power("Reinforced Skeleton", [{ key: "system.health.reduction", type: "upgrade", value: 1 }])
  ]);
  assert.equal(hero.system.abilities.mle.multiplier, base + 3, "upgrade fica com o maior valor, sem somar");
  assert.equal(hero.system.health.reduction, 2, "redução não acumula entre poderes numerados");

  // Voo = corrida × Rank.
  await hero.createEmbeddedDocuments("Item", [
    power("Flight 1", [
      { key: "system.movement.flight.active", type: "override", value: "true" },
      { key: "system.movement.flight.mode", type: "override", value: "runRank" }
    ])
  ]);
  assert.equal(hero.system.movement.flight.active, true);
  assert.equal(hero.system.movement.flight.value, hero.system.movement.run.value * 2);

  // Dois efeitos de override: o de maior prioridade vence, qualquer que seja a ordem.
  await hero.createEmbeddedDocuments("Item", [
    power("Jump 2", [{ key: "system.movement.jump.mode", type: "override", value: "runRank", priority: 60 }]),
    power("Jump 1", [{ key: "system.movement.jump.mode", type: "override", value: "full" }])
  ]);
  assert.equal(hero.system.movement.jump.mode, "runRank");
  assert.equal(hero.system.movement.jump.value, hero.system.movement.run.value * 2);

  // Removendo o item, o bônus some.
  const sturdy = hero.items.find((i) => i.name === "Sturdy 2");
  await hero.deleteEmbeddedDocuments("Item", [sturdy.id]);
  assert.equal(hero.system.health.reduction, 1, "sobra o Reinforced Skeleton");
});

test("o arquivo de exemplo importa sem erros e todos os itens são válidos", async () => {
  const fs = await import("node:fs");
  const text = fs.readFileSync(new URL("../examples/exemplo-conteudo.json", import.meta.url), "utf8");
  const parsed = parseContent(text);
  assert.deepEqual(parsed.errors, []);
  assert.deepEqual(parsed.warnings, []);
  const report = await importItems(parsed.items, { onDuplicate: "skip" });
  assert.deepEqual(report.failed, []);
  assert.deepEqual(report.unresolved, []);
  const imported = game.items.filter((i) => i.getFlag("mmrpg", "imported"));
  assert.ok(imported.length >= parsed.items.length);
  for (const item of imported) assert.deepEqual(item.system.validate(), [], item.name);

  // A Origem de exemplo concede o traço e o poder ao entrar numa ficha.
  const origin = game.items.find((i) => i.type === "origin" && i.name === "Origem de Exemplo");
  assert.equal(origin.system.grants.every((g) => g.uuid), true);
  const hero = await Actor.create({ name: "Exemplo", type: "character" });
  await hero.createEmbeddedDocuments("Item", [origin.toObject()]);
  assert.ok(hero.items.some((i) => i.type === "power" && i.name === "Raio de Exemplo"));
  assert.ok(hero.items.some((i) => i.type === "trait" && i.name === "Traço de Exemplo"));
});

test("janela de importação renderiza", async () => {
  const ContentImporter = (await import("../module/apps/importer.mjs")).default;
  const app = ContentImporter.open();
  assertClean(await app.renderToString(), "janela de importação");
  await app.close();
});

/* -------------------------------------------- */

test("nenhuma chave de tradução ficou sem texto durante os testes", () => {
  assert.deepEqual([...env.missingKeys].sort(), []);
});
