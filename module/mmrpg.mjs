/**
 * Marvel Multiverse RPG — sistema não oficial para Foundry VTT (v14; v13 experimental).
 *
 * Ponto de entrada: registra classes, modelos de dados, fichas, hooks e a API pública.
 */

import { MMRPG } from "./config.mjs";
import * as models from "./data/_module.mjs";
import MMRPGActor from "./documents/actor.mjs";
import MMRPGItem from "./documents/item.mjs";
import MMRPGCombatant from "./documents/combatant.mjs";
import { MarvelDie, D616Roll } from "./dice/index.mjs";
import { buildFormula } from "./rules/index.mjs";
import { CharacterSheet, NpcSheet } from "./apps/sheets/actor-sheet.mjs";
import MMRPGItemSheet from "./apps/sheets/item-sheet.mjs";
import ActionEditor from "./apps/action-editor.mjs";
import ContentImporter from "./apps/importer.mjs";
import TeamManeuverApp from "./apps/team-maneuver.mjs";
import { registerHandlebarsHelpers, preloadTemplates } from "./helpers/handlebars.mjs";
import { registerDocumentSheet, unregisterCoreSheets, foundryGeneration } from "./helpers/compat.mjs";
import { registerSettings } from "./helpers/settings.mjs";
import { registerAppearanceSettings, applyAppearance } from "./helpers/appearance.mjs";
import { registerStatusEffects } from "./helpers/status-effects.mjs";
import { registerCombatHooks } from "./helpers/combat.mjs";
import { registerFormHooks } from "./helpers/forms.mjs";
import { registerHotbar, useItemByUuid, rollAbilityForSelected } from "./helpers/macros.mjs";
import { activateSocket } from "./helpers/socket.mjs";
import { registerApplyHandler } from "./actions/apply.mjs";
import { activateCardListeners } from "./actions/listeners.mjs";
import { rollAbilityCheck } from "./actions/executor.mjs";

Hooks.once("init", () => {
  console.log(`${MMRPG.id} | iniciando o sistema Marvel Multiverse RPG (Foundry v${foundryGeneration()})\n${MMRPG.ascii}`);

  CONFIG.MMRPG = MMRPG;

  // Documentos
  CONFIG.Actor.documentClass = MMRPGActor;
  CONFIG.Item.documentClass = MMRPGItem;
  CONFIG.Combatant.documentClass = MMRPGCombatant;

  // Modelos de dados
  Object.assign(CONFIG.Actor.dataModels, {
    character: models.CharacterData,
    npc: models.NpcData
  });
  Object.assign(CONFIG.Item.dataModels, {
    power: models.PowerData,
    trait: models.TraitData,
    tag: models.TagData,
    origin: models.OriginData,
    occupation: models.OccupationData,
    weapon: models.WeaponData,
    gear: models.GearData,
    form: models.FormData
  });

  // Dados
  CONFIG.Dice.terms.m = MarvelDie;
  CONFIG.Dice.rolls.push(D616Roll);

  // Iniciativa: a rolagem real é montada em MMRPGCombatant#getInitiativeRoll.
  CONFIG.Combat.initiative = { formula: buildFormula(0), decimals: 0 };

  registerStatusEffects();
  registerSettings();
  registerAppearanceSettings();
  registerHandlebarsHelpers();
  registerHotbar();
  registerCombatHooks();
  registerFormHooks();

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
  unregisterCoreSheets("Item");
  registerDocumentSheet("Item", MMRPG.id, MMRPGItemSheet, {
    makeDefault: true,
    label: "MMRPG.Sheet.item"
  });

  // Janela de importação também no menu de configurações.
  game.settings.registerMenu(MMRPG.id, "importer", {
    name: "MMRPG.Importer.title",
    label: "MMRPG.Importer.open",
    hint: "MMRPG.Importer.hint",
    icon: "fa-solid fa-file-import",
    type: ContentImporter,
    restricted: true
  });

  // API pública (macros e módulos)
  game.mmrpg = {
    config: MMRPG,
    D616Roll,
    MarvelDie,
    useItem: useItemByUuid,
    rollAbility: rollAbilityForSelected,
    rollActorAbility: rollAbilityCheck,
    openImporter: () => ContentImporter.open(),
    openTeamManeuver: (actor) => TeamManeuverApp.open(actor),
    openActionEditor: (item, actionId) => ActionEditor.open(item, actionId),
    setForm: (actor, form, active = true) => actor.setFormActive(form, active)
  };

  return preloadTemplates();
});

Hooks.once("ready", () => {
  activateSocket();
  registerApplyHandler();
});

// Aparência escolhida pelo usuário (tema, tamanho do texto…) em todas as janelas do sistema.
Hooks.on("renderApplicationV2", (app, element) => {
  if (element?.classList?.contains("mmrpg")) applyAppearance(element);
});

// Botões dos cartões do chat
Hooks.on("renderChatMessageHTML", (message, html) => {
  activateCardListeners(message, html);
});

// Botão de importação nos diretórios de itens e de compêndios (GM)
function addImportButton(app, html) {
  if (!game.user.isGM) return;
  const root = html instanceof HTMLElement ? html : html?.[0];
  if (!root || root.querySelector(".mmrpg-import-button")) return;
  const header = root.querySelector(".header-actions") ?? root.querySelector("header");
  if (!header) return;
  const button = document.createElement("button");
  button.type = "button";
  button.className = "mmrpg-import-button";
  button.innerHTML = `<i class="fa-solid fa-file-import"></i> ${game.i18n.localize("MMRPG.Importer.open")}`;
  button.addEventListener("click", () => ContentImporter.open());
  header.append(button);
}
Hooks.on("renderItemDirectory", addImportButton);
Hooks.on("renderCompendiumDirectory", addImportButton);

