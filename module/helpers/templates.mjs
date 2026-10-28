import { loadTemplates } from "./compat.mjs";

/** Caminhos dos templates parciais (pré-carregados para a ficha abrir mais rápido). */
export const TEMPLATE_PATHS = [
  "actor/parts/actor-biography.hbs",
  "actor/parts/actor-damage.hbs",
  "actor/parts/actor-details.hbs",
  "actor/parts/actor-effects.hbs",
  "actor/parts/actor-forms.hbs",
  "actor/parts/actor-items.hbs",
  "actor/parts/actor-occupation.hbs",
  "actor/parts/actor-origin.hbs",
  "actor/parts/actor-powers.hbs",
  "actor/parts/actor-tags.hbs",
  "actor/parts/actor-traits.hbs",
  "actor/parts/actor-weapons.hbs",
  "item/parts/item-effects.hbs",
].map((p) => `systems/mmrpg/templates/${p}`);

/**
 * Pré-carrega os templates parciais.
 * @return {Promise}
 */
export const preloadHandlebarsTemplates = async () => loadTemplates(TEMPLATE_PATHS);
