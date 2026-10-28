/**
 * Valida arquivos de conteúdo (o JSON da janela de importação) sem abrir o Foundry.
 *
 * Carrega o sistema no Foundry simulado, importa os arquivos para compêndios e confere que cada
 * item cria sem erro, tem dados válidos e que as concessões encontram seus itens.
 *
 * Uso: node scripts/validate-content.mjs arquivo1.json [arquivo2.json ...]
 *
 * Os arquivos são lidos de onde estiverem; nada é copiado. Se for conteúdo de livro, mantenha-o
 * fora do repositório (a pasta conteudo-privado/ já está no .gitignore).
 */

import fs from "node:fs";
import path from "node:path";
import { installFoundry } from "../tests/support/foundry-stub.mjs";

const files = process.argv.slice(2);
if (!files.length) {
  console.error("Uso: node scripts/validate-content.mjs arquivo1.json [arquivo2.json ...]");
  process.exit(2);
}

installFoundry();
await import("../module/mmrpg.mjs");
await Hooks.callAll("init");
await Hooks.callAll("ready");
const { parseContent } = await import("../module/helpers/content-format.mjs");
const { importItems } = await import("../module/helpers/importer.mjs");

let problems = 0;
const fail = (message) => {
  problems++;
  console.error(`ERRO: ${message}`);
};

const all = [];
for (const file of files) {
  const parsed = parseContent(fs.readFileSync(file, "utf8"));
  const label = path.basename(file);
  for (const error of parsed.errors) fail(`${label}: ${error}`);
  for (const warning of parsed.warnings) console.warn(`aviso: ${label}: ${warning}`);
  console.log(`${label}: ${parsed.items.length} itens lidos`);
  all.push(...parsed.items);
}

// Uma só importação: as concessões se resolvem na segunda passada, como na janela do Foundry.
const report = await importItems(all, { destination: "compendia", onDuplicate: "update" });
for (const failure of report.failed) fail(failure);
for (const unresolved of report.unresolved) console.warn(`aviso: concessão sem item correspondente: ${unresolved}`);

// Chaves das alterações de efeitos: precisam existir na ficha (uma chave errada não faz nada no Foundry).
const probe = await Actor.create({ name: "sonda", type: "character" });
const checkChanges = (label, changes = []) => {
  for (const change of changes) {
    const current = foundry.utils.getProperty(probe, change.key);
    if (current === undefined) fail(`${label}: chave de efeito inexistente "${change.key}"`);
    else if (typeof current === "number" && !Number.isFinite(Number(change.value))) {
      fail(`${label}: valor não numérico em "${change.key}": ${change.value}`);
    }
  }
};
for (const entry of all) {
  for (const effect of entry.effects ?? []) checkChanges(`${entry.type} "${entry.name}"`, effect.changes);
  if (entry.type === "form") checkChanges(`form "${entry.name}"`, entry.system.changes);
  for (const action of entry.system.actions ?? []) {
    for (const effect of action.effects ?? []) checkChanges(`${entry.type} "${entry.name}" (ação ${action.id})`, effect.changes);
  }
}

const byType = new Map();
for (const { pack } of [...game.packs].map((pack) => ({ pack }))) {
  for (const item of pack.documents) {
    byType.set(item.type, (byType.get(item.type) ?? 0) + 1);
    const invalid = item.system.validate();
    if (invalid.length) fail(`${item.type} "${item.name}": dados inválidos (${JSON.stringify(invalid).slice(0, 200)})`);
  }
}

console.log(`\ncriados: ${report.created}, atualizados: ${report.updated}, ignorados: ${report.skipped}`);
for (const [type, count] of byType) console.log(`  ${type}: ${count}`);
console.log(`\n${problems} erro(s), ${report.unresolved.length} concessão(ões) sem ligação`);
process.exit(problems ? 1 : 0);
