import { test } from "node:test";
import assert from "node:assert/strict";
import { installFoundry } from "./support/foundry-stub.mjs";

const { registerDocumentSheet, unregisterCoreSheets, foundryGeneration, rootOf, legacySheets } = await import("../module/helpers/compat.mjs");

class FakeSheet {}

test("Foundry 13: registra pela configuração de fichas de documento", () => {
  const env = installFoundry({ generation: 13 });
  assert.equal(foundryGeneration(), 13);
  registerDocumentSheet("Actor", "mmrpg", FakeSheet, { types: ["character"] });
  assert.deepEqual(env.registered.map((r) => r.via), ["config"]);
});

test("Foundry 14: registra pela coleção", () => {
  const env = installFoundry({ generation: 14 });
  assert.equal(foundryGeneration(), 14);
  registerDocumentSheet("Item", "mmrpg", FakeSheet, {});
  assert.deepEqual(env.registered.map((r) => r.via), ["collection"]);
});

test("se o caminho preferido não existe, usa o outro", () => {
  installFoundry({ generation: 14 });
  delete foundry.documents.collections.Actors.registerSheet;
  const registered = [];
  foundry.applications.apps.DocumentSheetConfig.registerSheet = (...args) => registered.push(args[1]);
  registerDocumentSheet("Actor", "mmrpg", FakeSheet, {});
  assert.deepEqual(registered, ["mmrpg"]);
});

test("sem nenhum caminho de registro, avisa com clareza", () => {
  installFoundry({ generation: 14 });
  delete foundry.documents.collections.Actors.registerSheet;
  delete foundry.applications.apps.DocumentSheetConfig.registerSheet;
  assert.throws(() => registerDocumentSheet("Actor", "mmrpg", FakeSheet, {}), /registrar fichas/);
});

test("retirar as fichas do núcleo não falha, mesmo sem a API", () => {
  installFoundry({ generation: 14 });
  assert.doesNotThrow(() => unregisterCoreSheets("Actor"));
  delete foundry.documents.collections.Items.unregisterSheet;
  assert.doesNotThrow(() => unregisterCoreSheets("Item"));
});

test("rootOf aceita elemento e jQuery", () => {
  installFoundry({ generation: 14 });
  const el = new HTMLElement();
  assert.equal(rootOf(el), el);
  assert.equal(rootOf({ 0: el }), el);
});

test("as fichas antigas vêm de foundry.appv1 ou, na falta dela, do global", () => {
  installFoundry({ generation: 14 });
  assert.equal(legacySheets().ActorSheet, foundry.appv1.sheets.ActorSheet);
  const legacy = foundry.appv1;
  delete foundry.appv1;
  assert.equal(legacySheets().ActorSheet, globalThis.ActorSheet);
  foundry.appv1 = legacy;
});
