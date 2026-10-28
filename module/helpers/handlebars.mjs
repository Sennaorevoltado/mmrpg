/**
 * Helpers de Handlebars e pré-carregamento de templates.
 */

import { MMRPG } from "../config.mjs";
import { registerHelperIfMissing } from "./compat.mjs";

export const TEMPLATE_PATHS = [
  "actor/parts/bar.hbs",
  "actor/parts/body.hbs",
  "apps/budget-config.hbs"
].map((p) => `${MMRPG.path}/templates/${p}`);

/** Registra os helpers. */
export function registerHandlebarsHelpers() {
  // Comparações que os templates usam. O núcleo já as traz; só entram se faltarem.
  registerHelperIfMissing("eq", (a, b) => a === b);
  registerHelperIfMissing("ne", (a, b) => a !== b);
  registerHelperIfMissing("not", (a) => !a);
  registerHelperIfMissing("and", (...args) => args.slice(0, -1).every(Boolean));
  registerHelperIfMissing("or", (...args) => args.slice(0, -1).some(Boolean));

  // +3, 0, -2: bônus com sinal.
  Handlebars.registerHelper("mmrpgSigned", (value) => {
    const n = Math.trunc(Number(value) || 0);
    return n >= 0 ? `+${n}` : `${n}`;
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
}

/** Pré-carrega os templates. */
export async function preloadTemplates() {
  return foundry.applications.handlebars.loadTemplates(TEMPLATE_PATHS);
}
