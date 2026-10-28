/**
 * Marvel Multiverse RPG (não oficial) para Foundry VTT, em português do Brasil.
 *
 * Base: sistema de mjording / Rollbones Projects (licença MIT). Veja NOTICE e LICENSE.
 */

// Documentos
import { MarvelMultiverseActor } from "./module/documents/actor.mjs";
import { MarvelMultiverseItem } from "./module/documents/item.mjs";
import { ChatMessageMarvel } from "./module/documents/chat-message.mjs";
// Fichas
import { MarvelMultiverseCharacterSheet } from "./module/sheets/character-sheet.mjs";
import { MarvelMultiverseNPCSheet } from "./module/sheets/npc-sheet.mjs";
import { MarvelMultiverseItemSheet } from "./module/sheets/item-sheet.mjs";
// Apoio
import { preloadHandlebarsTemplates } from "./module/helpers/templates.mjs";
import { registerDocumentSheet, unregisterCoreSheets, foundryGeneration, rootOf } from "./module/helpers/compat.mjs";
import { addImportButton, importContent } from "./module/helpers/importer.mjs";
import { registerFormHooks, registerFormSettings } from "./module/helpers/form-hooks.mjs";
import { MARVEL_MULTIVERSE } from "./module/config.mjs";
// Modelos de dados e dados
import * as models from "./module/data/_module.mjs";
import * as dice from "./module/dice/_module.mjs";

const SYSTEM_ID = "mmrpg";
const REPO_URL = "https://github.com/Sennaorevoltado/mmrpg";

globalThis.MarvelMultiverse = {
  MarvelMultiverseActor,
  MarvelMultiverseItem,
  rollItemMacro,
  importContent,
  config: MARVEL_MULTIVERSE,
  dice,
  models,
  MarvelMultiverseCharacterSheet,
  MarvelMultiverseNPCSheet,
  MarvelMultiverseItemSheet,
  ChatMessageMarvel,
};

/* -------------------------------------------- */
/*  Init                                        */
/* -------------------------------------------- */

Hooks.once("init", () => {
  globalThis.MarvelMultiverse = game.MarvelMultiverse = Object.assign(game.system, globalThis.MarvelMultiverse);

  console.log(`${SYSTEM_ID} | iniciando o sistema Marvel Multiverse RPG (Foundry v${foundryGeneration()}), versão ${game.system.version}`);

  CONFIG.MARVEL_MULTIVERSE = MARVEL_MULTIVERSE;

  // Iniciativa: d616 + bônus de iniciativa.
  CONFIG.Combat.initiative = {
    formula: "{1d6,1dm,1d6} + @attributes.init.value",
    decimals: 2,
  };

  // Documentos e modelos de dados.
  CONFIG.Actor.documentClass = MarvelMultiverseActor;
  CONFIG.Actor.dataModels = {
    character: models.MarvelMultiverseCharacter,
    npc: models.MarvelMultiverseNPC,
  };
  CONFIG.ChatMessage.documentClass = ChatMessageMarvel;
  CONFIG.Item.documentClass = MarvelMultiverseItem;
  CONFIG.Item.dataModels = {
    item: models.MarvelMultiverseItem,
    weapon: models.MarvelMultiverseWeapon,
    trait: models.MarvelMultiverseTrait,
    origin: models.MarvelMultiverseOrigin,
    occupation: models.MarvelMultiverseOccupation,
    tag: models.MarvelMultiverseTag,
    power: models.MarvelMultiversePower,
    form: models.MarvelMultiverseForm,
  };

  // Dado Marvel (dm) e rolagem d616.
  CONFIG.Dice.MarvelDie = dice.MarvelDie;
  CONFIG.Dice.types.push(dice.MarvelDie);
  Roll.TOOLTIP_TEMPLATE = `systems/${SYSTEM_ID}/templates/chat/roll-breakdown.hbs`;
  Roll.CHAT_TEMPLATE = `systems/${SYSTEM_ID}/templates/dice/roll.hbs`;
  CONFIG.Dice.MarvelMultiverseRoll = dice.MarvelMultiverseRoll;
  CONFIG.Dice.rolls.push(dice.MarvelMultiverseRoll);
  CONFIG.Dice.terms.m = dice.MarvelDie;

  _configureFonts();

  // Formas (armaduras, formas alternativas e transformações).
  registerFormSettings();
  registerFormHooks();

  // Fichas: tira as do núcleo e registra as do sistema.
  unregisterCoreSheets("Actor");
  unregisterCoreSheets("Item");
  registerDocumentSheet("Actor", SYSTEM_ID, MarvelMultiverseCharacterSheet, {
    types: ["character"],
    makeDefault: true,
    label: "MARVEL_MULTIVERSE.SheetLabels.Actor",
  });
  registerDocumentSheet("Actor", SYSTEM_ID, MarvelMultiverseNPCSheet, {
    types: ["npc"],
    makeDefault: true,
    label: "MARVEL_MULTIVERSE.SheetLabels.NPC",
  });
  registerDocumentSheet("Item", SYSTEM_ID, MarvelMultiverseItemSheet, {
    makeDefault: true,
    label: "MARVEL_MULTIVERSE.SheetLabels.Item",
  });

  return preloadHandlebarsTemplates();
});

/* -------------------------------------------- */
/*  Handlebars                                  */
/* -------------------------------------------- */

Handlebars.registerHelper("toLowerCase", (value) => String(value ?? "").toLowerCase());

/* -------------------------------------------- */

/** Fontes do sistema (disponíveis também nos editores de texto). */
function _configureFonts() {
  const base = `systems/${SYSTEM_ID}/fonts`;
  Object.assign(CONFIG.fontDefinitions, {
    Roboto: {
      editor: true,
      fonts: [
        { urls: [`${base}/roboto/Roboto-Regular.woff2`] },
        { urls: [`${base}/roboto/Roboto-Bold.woff2`], weight: "bold" },
        { urls: [`${base}/roboto/Roboto-Italic.woff2`], style: "italic" },
        { urls: [`${base}/roboto/Roboto-BoldItalic.woff2`], weight: "bold", style: "italic" },
      ],
    },
    "Roboto Condensed": {
      editor: true,
      fonts: [
        { urls: [`${base}/roboto-condensed/RobotoCondensed-Regular.woff2`] },
        { urls: [`${base}/roboto-condensed/RobotoCondensed-Bold.woff2`], weight: "bold" },
        { urls: [`${base}/roboto-condensed/RobotoCondensed-Italic.woff2`], style: "italic" },
        { urls: [`${base}/roboto-condensed/RobotoCondensed-BoldItalic.woff2`], weight: "bold", style: "italic" },
      ],
    },
    "Roboto Slab": {
      editor: true,
      fonts: [
        { urls: [`${base}/roboto-slab/RobotoSlab-Regular.ttf`] },
        { urls: [`${base}/roboto-slab/RobotoSlab-Bold.ttf`], weight: "bold" },
      ],
    },
  });
}

/* -------------------------------------------- */
/*  Hooks                                       */
/* -------------------------------------------- */

Hooks.once("ready", () => {
  Hooks.on("hotbarDrop", (bar, data, slot) => createItemMacro(data, slot));
});

// Botões de Edge, Trouble e Dano nos cartões de rolagem.
Hooks.on("renderChatMessageHTML", (message, html) => {
  ChatMessageMarvel.onRenderChatMessageHTML(message, html);
});

// Botão "Importar conteúdo" na aba Itens (só o Narrador vê).
Hooks.on("renderItemDirectory", (app, html) => addImportButton(app, html));

// Links do projeto na aba de configurações.
Hooks.on("renderSettings", (app, html) => {
  const root = rootOf(html);
  const info = root?.querySelector?.("section.info");
  if (!info) return;
  const heading = document.createElement("div");
  heading.classList.add("mmrpg", "sidebar-heading");
  heading.innerHTML = `
    <h2 class="mmrpg-game-title">${game.system.title}
      <ul class="links mmrpg-ul">
        <li><a href="${REPO_URL}/releases/latest" target="_blank" rel="noopener">${game.system.version}</a></li>
        <li><a href="${REPO_URL}/issues" target="_blank" rel="noopener">${game.i18n.localize("MARVEL_MULTIVERSE.Issues")}</a></li>
      </ul>
    </h2>
  `;
  info.insertAdjacentElement("beforeend", heading);
});

// Dice So Nice: o dado Marvel e o d6 do sistema.
Hooks.once("diceSoNiceReady", (dice3d) => {
  dice3d.addDicePreset({
    type: "dm",
    labels: ["m", "2", "3", "4", "5", "6"],
    colorset: "red",
    system: "standard",
  });
  dice3d.addDicePreset({
    type: "d6",
    labels: ["1", "2", "3", "4", "5", "6"],
    colorset: "white",
    system: "standard",
  });
});

/* -------------------------------------------- */
/*  Macros da barra                             */
/* -------------------------------------------- */

/**
 * Cria (ou reaproveita) uma macro ao soltar um item da ficha na barra de macros.
 * @param {object} data     Dados soltos
 * @param {number} slot     Posição na barra
 */
async function createItemMacro(data, slot) {
  if (data.type !== "Item") return;
  if (!data.uuid.includes("Actor.") && !data.uuid.includes("Token.")) {
    ui.notifications.warn(game.i18n.localize("MARVEL_MULTIVERSE.Warn.macroOwnedOnly"));
    return;
  }
  const item = await Item.fromDropData(data);

  const command = `game.MarvelMultiverse.rollItemMacro("${data.uuid}");`;
  let macro = game.macros.find((m) => m.name === item.name && m.command === command);
  if (!macro) {
    macro = await Macro.create({
      name: item.name,
      type: "script",
      img: item.img,
      command,
      flags: { [`${SYSTEM_ID}.itemMacro`]: true },
    });
  }
  game.user.assignHotbarMacro(macro, slot);
  return false;
}

/**
 * Usa um item a partir de uma macro.
 * @param {string} itemUuid
 */
function rollItemMacro(itemUuid) {
  Item.fromDropData({ type: "Item", uuid: itemUuid }).then((item) => {
    if (!item || !item.parent) {
      ui.notifications.warn(game.i18n.format("MARVEL_MULTIVERSE.Warn.macroItemMissing", { name: item?.name ?? itemUuid }));
      return;
    }
    item.roll();
  });
}

export {
  MarvelMultiverseActor,
  MarvelMultiverseItem,
  rollItemMacro,
  MARVEL_MULTIVERSE,
  models,
  dice,
  MarvelMultiverseCharacterSheet,
  MarvelMultiverseNPCSheet,
  MarvelMultiverseItemSheet,
  ChatMessageMarvel,
};
