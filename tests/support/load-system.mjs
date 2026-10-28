/**
 * Carrega o sistema (configuração, modelos de dados, documentos e fichas) sobre o Foundry simulado.
 */
import { installFoundry } from "./foundry-stub.mjs";

/**
 * @param {object} [options]
 * @param {string} [options.lang="pt-BR"]
 * @param {number} [options.generation=14]
 */
export async function loadSystem(options = {}) {
  const env = installFoundry(options);

  const { MARVEL_MULTIVERSE } = await import("../../module/config.mjs");
  CONFIG.MARVEL_MULTIVERSE = MARVEL_MULTIVERSE;

  const models = await import("../../module/data/_module.mjs");
  const { MarvelMultiverseActor } = await import("../../module/documents/actor.mjs");
  const { MarvelMultiverseItem } = await import("../../module/documents/item.mjs");
  const { MarvelMultiverseCharacterSheet } = await import("../../module/sheets/character-sheet.mjs");
  const { MarvelMultiverseNPCSheet } = await import("../../module/sheets/npc-sheet.mjs");
  const { MarvelMultiverseItemSheet } = await import("../../module/sheets/item-sheet.mjs");
  const { preloadHandlebarsTemplates, TEMPLATE_PATHS } = await import("../../module/helpers/templates.mjs");

  CONFIG.Actor.documentClass = MarvelMultiverseActor;
  CONFIG.Item.documentClass = MarvelMultiverseItem;
  CONFIG.Actor.dataModels = { character: models.MarvelMultiverseCharacter, npc: models.MarvelMultiverseNPC };
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

  await preloadHandlebarsTemplates();

  return {
    ...env,
    MARVEL_MULTIVERSE,
    models,
    TEMPLATE_PATHS,
    sheets: { MarvelMultiverseCharacterSheet, MarvelMultiverseNPCSheet, MarvelMultiverseItemSheet },
  };
}

/** Um personagem de exemplo, com itens, para os testes. */
export function sampleCharacter(overrides = {}) {
  return new CONFIG.Actor.documentClass({
    name: "Teste Silva",
    type: "character",
    system: {
      attributes: { rank: { value: 2 } },
      abilities: {
        mle: { value: 3 },
        agl: { value: 2 },
        res: { value: 1 },
        vig: { value: 2 },
        ego: { value: 1 },
        log: { value: 0 },
      },
      health: { value: 40, max: 50 },
      focus: { value: 10, max: 12 },
      ...overrides.system,
    },
    items: overrides.items ?? [],
  });
}
