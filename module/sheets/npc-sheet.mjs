import { MarvelMultiverseCharacterSheet } from "./character-sheet.mjs";

/**
 * Ficha de NPC: a mesma da personagem, com um modelo (template) mais enxuto e janela menor.
 * @extends {MarvelMultiverseCharacterSheet}
 */
export class MarvelMultiverseNPCSheet extends MarvelMultiverseCharacterSheet {
  /** @override */
  static get defaultOptions() {
    return foundry.utils.mergeObject(super.defaultOptions, {
      height: 680,
      tabs: [],
    });
  }
}
