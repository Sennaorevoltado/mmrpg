/**
 * Aparência das fichas: opções de leitura que cada jogador escolhe para si (escopo "client").
 *
 * - tema: claro (como o papel impresso; padrão) ou escuro;
 * - tamanho do texto: normal, grande, muito grande.
 */

import { MMRPG } from "../config.mjs";

/** Opções válidas de cada configuração e o padrão. */
export const APPEARANCE = {
  uiTheme: { choices: ["light", "dark"], initial: "light", attr: "mmTheme" },
  uiTextSize: { choices: ["normal", "large", "xlarge"], initial: "normal", attr: "mmText" }
};

const loc = (key) => game.i18n.localize(key);

/** Registra as configurações de aparência (por usuário, nunca do mundo). */
export function registerAppearanceSettings() {
  for (const [key, def] of Object.entries(APPEARANCE)) {
    game.settings.register(MMRPG.id, key, {
      name: `MMRPG.Appearance.${key}.name`,
      hint: `MMRPG.Appearance.${key}.hint`,
      scope: "client",
      config: true,
      type: String,
      default: def.initial,
      choices: Object.fromEntries(def.choices.map((value) => [value, `MMRPG.Appearance.${key}.${value}`])),
      onChange: () => refreshOpenWindows()
    });
  }
}

/**
 * Valores atuais. Qualquer erro de leitura (configuração ainda não registrada, valor antigo)
 * cai no padrão: a ficha tem que abrir sempre.
 * @returns {{ uiTheme: string, uiTextSize: string }}
 */
export function getAppearance() {
  const out = {};
  for (const [key, def] of Object.entries(APPEARANCE)) {
    let value = def.initial;
    try {
      const stored = game.settings.get(MMRPG.id, key);
      if (def.choices.includes(stored)) value = stored;
    } catch (err) {
      value = def.initial;
    }
    out[key] = value;
  }
  return out;
}

/**
 * Grava a aparência no elemento da janela (atributos data-mm-*), que o CSS lê.
 * @param {HTMLElement} element
 */
export function applyAppearance(element) {
  if (!element?.dataset) return;
  const current = getAppearance();
  for (const [key, def] of Object.entries(APPEARANCE)) element.dataset[def.attr] = current[key];
}

/** Janelas do sistema abertas no momento. */
function openWindows() {
  const instances = foundry.applications?.instances;
  const apps = instances?.values ? [...instances.values()] : [];
  return apps.filter((app) => app?.element?.classList?.contains("mmrpg"));
}

/** Reaplica a aparência e redesenha as janelas abertas (também usado quando o orçamento muda). */
export function refreshOpenWindows() {
  for (const app of openWindows()) {
    applyAppearance(app.element);
    if (app.rendered) app.render();
  }
}

/** Diálogo rápido de aparência (menu da janela da ficha). */
export async function openAppearanceDialog() {
  const current = getAppearance();
  const esc = (v) =>
    String(v).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  const field = (key) => {
    const def = APPEARANCE[key];
    const options = def.choices
      .map((value) => `<option value="${esc(value)}"${current[key] === value ? " selected" : ""}>${esc(loc(`MMRPG.Appearance.${key}.${value}`))}</option>`)
      .join("");
    return `<div class="form-group"><label for="mmrpg-ap-${key}">${esc(loc(`MMRPG.Appearance.${key}.name`))}</label>
      <div class="form-fields"><select id="mmrpg-ap-${key}" name="${key}">${options}</select></div></div>`;
  };
  const content = `<div class="mmrpg-appearance">${Object.keys(APPEARANCE).map(field).join("")}
    <p class="hint">${esc(loc("MMRPG.Appearance.hint"))}</p></div>`;

  const data = await foundry.applications.api.DialogV2.prompt({
    window: { title: loc("MMRPG.Appearance.title") },
    classes: ["mmrpg"],
    content,
    ok: {
      label: loc("MMRPG.Appearance.save"),
      callback: (event, button) => new foundry.applications.ux.FormDataExtended(button.form).object
    },
    rejectClose: false
  });
  if (!data) return null;
  for (const [key, def] of Object.entries(APPEARANCE)) {
    const value = data[key];
    if (def.choices.includes(value) && value !== current[key]) await game.settings.set(MMRPG.id, key, value);
  }
  return data;
}
