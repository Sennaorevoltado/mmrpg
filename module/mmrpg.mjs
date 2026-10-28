/**
 * Marvel Multiverse RPG — sistema não oficial para Foundry VTT (v14; v13 experimental).
 *
 * Ponto de entrada: registra modelos de dados, fichas e configurações.
 */

import { MMRPG } from "./config.mjs";
import * as models from "./data/_module.mjs";
import { CharacterSheet, NpcSheet } from "./apps/actor-sheet.mjs";
import { registerHandlebarsHelpers, preloadTemplates } from "./helpers/handlebars.mjs";
import { registerDocumentSheet, unregisterCoreSheets, foundryGeneration } from "./helpers/compat.mjs";
import { registerSettings } from "./helpers/settings.mjs";
import { registerAppearanceSettings, applyAppearance } from "./helpers/appearance.mjs";

Hooks.once("init", () => {
  console.log(`${MMRPG.id} | iniciando o sistema Marvel Multiverse RPG (Foundry v${foundryGeneration()})`);

  CONFIG.MMRPG = MMRPG;

  Object.assign(CONFIG.Actor.dataModels, {
    character: models.CharacterData,
    npc: models.NpcData
  });

  registerSettings();
  registerAppearanceSettings();
  registerHandlebarsHelpers();

  // Fichas (a ficha padrão do núcleo e a forma de registrar mudam entre a v13 e a v14)
  unregisterCoreSheets("Actor");
  registerDocumentSheet("Actor", MMRPG.id, CharacterSheet, {
    types: ["character"],
    makeDefault: true,
    label: "MMRPG.Sheet.character"
  });
  registerDocumentSheet("Actor", MMRPG.id, NpcSheet, {
    types: ["npc"],
    makeDefault: true,
    label: "MMRPG.Sheet.npc"
  });

  game.mmrpg = { config: MMRPG };

  return preloadTemplates();
});

// Aparência escolhida pelo usuário (tema, tamanho do texto) em todas as janelas do sistema.
Hooks.on("renderApplicationV2", (app, element) => {
  if (element?.classList?.contains("mmrpg")) applyAppearance(element);
});
