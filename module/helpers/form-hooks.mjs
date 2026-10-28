/**
 * Configuração e ganchos das Formas (armaduras, formas alternativas e transformações).
 */

const SCOPE = "mmrpg";

/** Campos da Forma que, ao mudar numa forma ligada, pedem para refazer o efeito e as concessões. */
const WATCHED_SYSTEM_FIELDS = ["kind", "borrowed", "rank", "carryDamage", "portrait", "token", "changes", "powers", "traits", "tags"];
const WATCHED_ROOT_FIELDS = ["name", "img"];

/** A mudança (o diff do `updateItem`) mexe em algo que uma forma ligada precisa refletir? */
export function formChangeNeedsRefresh(changes = {}) {
  if (WATCHED_ROOT_FIELDS.some((key) => key in changes)) return true;
  const system = changes.system ?? {};
  return WATCHED_SYSTEM_FIELDS.some((key) => key in system);
}

/**
 * Gancho `updateItem`: uma forma ligada que foi editada refaz o efeito e as concessões.
 * Só quem fez a edição refaz, para não duplicar o trabalho em cada janela aberta.
 *
 * @returns {Promise<boolean>}
 */
export async function onUpdateForm(item, changes, options, userId) {
  if (item.type !== "form" || !item.system?.active || !item.parent) return false;
  if (options?.mmrpgSkipRefresh) return false;
  if (userId !== undefined && userId !== game.user?.id) return false;
  if (!formChangeNeedsRefresh(changes)) return false;
  try {
    return await item.parent.refreshForm(item);
  } catch (err) {
    console.warn(`${SCOPE} | não foi possível atualizar a forma "${item.name}"`, err);
    return false;
  }
}

/** Registra a configuração do aviso no chat. */
export function registerFormSettings() {
  game.settings.register(SCOPE, "announceForms", {
    name: "MARVEL_MULTIVERSE.Form.SettingName",
    hint: "MARVEL_MULTIVERSE.Form.SettingHint",
    scope: "world",
    config: true,
    type: Boolean,
    default: true,
  });
}

/** Registra os ganchos das formas. */
export function registerFormHooks() {
  Hooks.on("updateItem", (item, changes, options, userId) => onUpdateForm(item, changes, options, userId));
}
