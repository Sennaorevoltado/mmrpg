/**
 * Helpers de Handlebars e pré-carregamento de templates.
 */

import { MMRPG } from "../config.mjs";
import { registerHelperIfMissing } from "./compat.mjs";

export const TEMPLATE_PATHS = [
  "actor/parts/header.hbs",
  "actor/parts/abilities.hbs",
  "actor/parts/resources.hbs",
  "actor/parts/movement.hbs",
  "actor/parts/items.hbs",
  "actor/parts/biography.hbs",
  "actor/parts/modifiers.hbs",
  "actor/parts/effects.hbs",
  "actor/character.hbs",
  "actor/npc.hbs",
  "item/header.hbs",
  "item/description.hbs",
  "item/details-power.hbs",
  "item/details-trait.hbs",
  "item/details-tag.hbs",
  "item/details-origin.hbs",
  "item/details-occupation.hbs",
  "item/details-weapon.hbs",
  "item/details-gear.hbs",
  "item/actions.hbs",
  "item/grants.hbs",
  "item/effects.hbs",
  "item/item.hbs",
  "chat/action-card.hbs",
  "chat/check-card.hbs",
  "chat/team-card.hbs",
  "dice/roll.hbs",
  "dialog/roll-config.hbs",
  "apps/action-editor.hbs",
  "apps/importer.hbs",
  "apps/team-maneuver.hbs"
].map((p) => `${MMRPG.path}/templates/${p}`);

/** Registra os helpers. */
export function registerHandlebarsHelpers() {
  // Comparações que os templates usam. O núcleo já as traz; só entram se faltarem.
  registerHelperIfMissing("eq", (a, b) => a === b);
  registerHelperIfMissing("ne", (a, b) => a !== b);
  registerHelperIfMissing("lt", (a, b) => a < b);
  registerHelperIfMissing("gt", (a, b) => a > b);
  registerHelperIfMissing("lte", (a, b) => a <= b);
  registerHelperIfMissing("gte", (a, b) => a >= b);
  registerHelperIfMissing("not", (a) => !a);
  registerHelperIfMissing("and", (...args) => args.slice(0, -1).every(Boolean));
  registerHelperIfMissing("or", (...args) => args.slice(0, -1).some(Boolean));

  Handlebars.registerHelper("mmrpgSigned", (value) => {
    const n = Math.trunc(Number(value) || 0);
    return n >= 0 ? `+${n}` : `${n}`;
  });

  Handlebars.registerHelper("mmrpgJoin", (...args) => {
    args.pop();
    return args.filter((a) => a !== undefined && a !== null && a !== "").join(" ");
  });

  // Lista de <option> a partir de [{ value, label }] e do valor selecionado.
  Handlebars.registerHelper("mmrpgOptions", (choices, selected) => {
    const current = String(selected ?? "");
    const esc = (v) => Handlebars.escapeExpression(String(v ?? ""));
    const html = (Array.isArray(choices) ? choices : [])
      .map((c) => `<option value="${esc(c.value)}"${String(c.value) === current ? " selected" : ""}>${esc(c.label)}</option>`)
      .join("");
    return new Handlebars.SafeString(html);
  });

  Handlebars.registerHelper("mmrpgPercent", (value, max) => {
    const v = Number(value) || 0;
    const m = Number(max) || 0;
    if (m <= 0) return 0;
    return Math.max(0, Math.min(100, Math.round((v / m) * 100)));
  });
}

/** Pré-carrega os templates (parciais e janelas). */
export async function preloadTemplates() {
  return foundry.applications.handlebars.loadTemplates(TEMPLATE_PATHS);
}
