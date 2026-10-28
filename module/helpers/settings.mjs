/**
 * Configurações do sistema.
 */

import { MMRPG } from "../config.mjs";

export function registerSettings() {
  game.settings.register(MMRPG.id, "autoApply", {
    name: "MMRPG.Settings.autoApply.name",
    hint: "MMRPG.Settings.autoApply.hint",
    scope: "world",
    config: true,
    type: Boolean,
    default: false
  });

  game.settings.register(MMRPG.id, "autoDefeat", {
    name: "MMRPG.Settings.autoDefeat.name",
    hint: "MMRPG.Settings.autoDefeat.hint",
    scope: "world",
    config: true,
    type: Boolean,
    default: true
  });

  game.settings.register(MMRPG.id, "announceForms", {
    name: "MMRPG.Settings.announceForms.name",
    hint: "MMRPG.Settings.announceForms.hint",
    scope: "world",
    config: true,
    type: Boolean,
    default: true
  });
}
